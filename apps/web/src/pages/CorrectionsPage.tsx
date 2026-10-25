import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { Check, X } from "lucide-react";
import {
  api,
  ApiError,
  localDate,
  localTime,
  post,
  type Correction,
  type Employee,
  type User,
} from "../api";
import { Button, Empty, Message, Panel } from "../components";
import { useSetFilterSidebar } from "../layout/filterSidebarContext";
import { PageHeading } from "../layout/PageHeading";

export function CorrectionsPage() {
  const { user } = useOutletContext<{ user: User }>();
  const client = useQueryClient();
  const [status, setStatus] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("pending");
  const corrections = useQuery({
    queryKey: ["corrections"],
    queryFn: () => api<Correction[]>("/attendance-corrections"),
  });
  const employees = useQuery({
    queryKey: ["employees", "corrections"],
    queryFn: () => api<Employee[]>("/employees"),
  });
  const decision = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      post(`/attendance-corrections/${id}/decision`, { approve }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["corrections"] });
      client.invalidateQueries({ queryKey: ["entries"] });
    },
  });
  const canDecide = user.roles.some((r) =>
    ["manager", "hr", "admin"].includes(r),
  );
  const visible = useMemo(() => {
    const rows = corrections.data || [];
    if (status === "all") return rows;
    return rows.filter((row) => row.status === status);
  }, [corrections.data, status]);
  useSetFilterSidebar(
    () => (
      <>
        <p className="subtle">
          Korekty w Twoim zakresie. Filtruj po statusie decyzji.
        </p>
        <div className="filter-group">
          <h3>Status</h3>
          {(
            [
              ["all", "Wszystkie"],
              ["pending", "Oczekujące"],
              ["approved", "Zatwierdzone"],
              ["rejected", "Odrzucone"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`filter-item ${status === value ? "active" : ""}`}
              onClick={() => setStatus(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </>
    ),
    [status],
  );
  return (
    <>
      <PageHeading title="Korekty czasu" />
      <Panel title="Wnioski">
        {corrections.isPending ? (
          <p className="subtle">Ładowanie wniosków…</p>
        ) : corrections.isError ? (
          <Message>Nie udało się pobrać korekt.</Message>
        ) : visible.length ? (
          <div className="correction-list">
            {visible.map((row) => (
              <article className="correction-row" key={row.id}>
                <div>
                  <span
                    className={`table-status ${row.status === "pending" ? "open" : ""}`}
                  >
                    {row.status === "pending"
                      ? "Oczekuje"
                      : row.status === "approved"
                        ? "Zatwierdzona"
                        : "Odrzucona"}
                  </span>
                  <h3>
                    {employees.data?.find((e) => e.id === row.employee_id)
                      ?.last_name || "Korekta wpisu"}
                  </h3>
                  <p>
                    {localDate(row.proposed_start)} –{" "}
                    {localTime(row.proposed_end)}
                  </p>
                  <small>Powód: {row.reason}</small>
                </div>
                {canDecide && row.status === "pending" && (
                  <div className="decision-actions">
                    <Button
                      variant="quiet"
                      size="small"
                      disabled={decision.isPending}
                      onClick={() =>
                        decision.mutate({ id: row.id, approve: false })
                      }
                    >
                      <X size={15} /> Odrzuć
                    </Button>
                    <Button
                      size="small"
                      disabled={decision.isPending}
                      onClick={() =>
                        decision.mutate({ id: row.id, approve: true })
                      }
                    >
                      <Check size={15} /> Zatwierdź
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty title="Brak wyników">
            {status === "all"
              ? "Nowe korekty pojawią się tutaj."
              : "Brak korekt w wybranym statusie."}
          </Empty>
        )}
        {decision.isError && (
          <Message>{(decision.error as ApiError).message}</Message>
        )}
      </Panel>
    </>
  );
}
