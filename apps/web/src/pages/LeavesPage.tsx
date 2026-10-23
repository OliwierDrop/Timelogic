import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { Check, Plus, X } from "lucide-react";
import {
  api,
  ApiError,
  post,
  type Employee,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
  type User,
} from "../api";
import { Button, Empty, Field, Message, Modal, Panel } from "../components";
import { useSetFilterSidebar } from "../layout/filterSidebarContext";
import { PageHeading } from "../layout/PageHeading";

export function LeavesPage() {
  const { user } = useOutletContext<{ user: User }>();
  const client = useQueryClient();
  const canDecide = user.roles.some((r) =>
    ["manager", "hr", "admin"].includes(r),
  );
  const canConfigure = user.roles.some((r) => ["hr", "admin"].includes(r));
  const year = new Date().getFullYear();
  const [status, setStatus] = useState<"all" | "pending" | "approved" | "rejected">(
    "all",
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [typeModal, setTypeModal] = useState(false);
  const [balanceModal, setBalanceModal] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [typeCode, setTypeCode] = useState("");
  const [typeName, setTypeName] = useState("");
  const [balanceEmployeeId, setBalanceEmployeeId] = useState("");
  const [balanceTypeId, setBalanceTypeId] = useState("");
  const [grantedDays, setGrantedDays] = useState("26");
  const types = useQuery({
    queryKey: ["leave-types"],
    queryFn: () => api<LeaveType[]>("/leave-types"),
  });
  const requests = useQuery({
    queryKey: ["leave-requests", status],
    queryFn: () =>
      api<LeaveRequest[]>(
        `/leave-requests${status === "all" ? "" : `?status=${status}`}`,
      ),
  });
  const balances = useQuery({
    queryKey: ["leave-balances", user.employee_id, year],
    queryFn: () =>
      api<LeaveBalance[]>(
        `/leave-balances?year=${year}${user.employee_id ? `&employee_id=${user.employee_id}` : ""}`,
      ),
  });
  const employees = useQuery({
    queryKey: ["employees", "leaves"],
    queryFn: () => api<Employee[]>("/employees"),
    enabled: canDecide || canConfigure,
  });
  const create = useMutation({
    mutationFn: () =>
      post<LeaveRequest>("/leave-requests", {
        leave_type_id: leaveTypeId,
        start_date: startDate,
        end_date: endDate,
        reason: reason || null,
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["leave-requests"] });
      client.invalidateQueries({ queryKey: ["leave-balances"] });
      setModalOpen(false);
      setReason("");
    },
  });
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      post(`/leave-requests/${id}/decision`, { approve }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["leave-requests"] });
      client.invalidateQueries({ queryKey: ["leave-balances"] });
    },
  });
  const createType = useMutation({
    mutationFn: () =>
      post<LeaveType>("/leave-types", { code: typeCode, name: typeName }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["leave-types"] });
      setTypeModal(false);
    },
  });
  const saveBalance = useMutation({
    mutationFn: () =>
      post<LeaveBalance>("/leave-balances", {
        employee_id: balanceEmployeeId,
        leave_type_id: balanceTypeId,
        year,
        granted_days: Number(grantedDays),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["leave-balances"] });
      setBalanceModal(false);
    },
  });
  const typeNameOf = (id: string) =>
    types.data?.find((row) => row.id === id)?.name || "Typ";
  const employeeName = (id: string) => {
    const row = employees.data?.find((item) => item.id === id);
    return row ? `${row.first_name} ${row.last_name}` : id.slice(0, 8);
  };
  const statusLabel = (value: string) =>
    value === "pending"
      ? "Oczekuje"
      : value === "approved"
        ? "Zatwierdzony"
        : "Odrzucony";
  useSetFilterSidebar(
    () => (
      <>
        <p className="subtle">Filtruj listę wniosków po statusie decyzji.</p>
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
      <PageHeading
        title="Wnioski"
        description="Nieobecności, salda urlopowe i kolejka decyzji."
        action={
          <div className="heading-actions">
            {canConfigure && (
              <>
                <Button variant="quiet" onClick={() => setTypeModal(true)}>
                  Typ nieobecności
                </Button>
                <Button variant="quiet" onClick={() => setBalanceModal(true)}>
                  Ustaw saldo
                </Button>
              </>
            )}
            <Button
              onClick={() => {
                setLeaveTypeId(types.data?.[0]?.id || "");
                setModalOpen(true);
              }}
              disabled={!types.data?.length && !canConfigure}
            >
              <Plus size={16} /> Nowy wniosek
            </Button>
          </div>
        }
      />
      {!!balances.data?.length && (
        <Panel title={`Saldo ${year}`}>
          <div className="balance-grid">
            {balances.data.map((row) => (
              <div className="balance-card" key={row.id}>
                <strong>{typeNameOf(row.leave_type_id)}</strong>
                <span>
                  {row.unlimited
                    ? "Nielimitowany"
                    : `Pozostało ${row.remaining_days} z ${row.granted_days} dni`}
                </span>
                <small>Wykorzystano {row.used_days}</small>
              </div>
            ))}
          </div>
        </Panel>
      )}
      <Panel title="Lista wniosków">
        {requests.isPending ? (
          <p className="subtle">Ładowanie wniosków…</p>
        ) : requests.isError ? (
          <Message>Nie udało się pobrać wniosków.</Message>
        ) : requests.data?.length ? (
          <div className="correction-list">
            {requests.data.map((row) => (
              <article className="correction-row" key={row.id}>
                <div>
                  <span
                    className={`table-status ${row.status === "pending" ? "open" : row.status === "approved" ? "active" : ""}`}
                  >
                    {statusLabel(row.status)}
                  </span>
                  <h3>
                    {canDecide
                      ? employeeName(row.employee_id)
                      : typeNameOf(row.leave_type_id)}
                  </h3>
                  <p>
                    {typeNameOf(row.leave_type_id)} · {row.start_date} –{" "}
                    {row.end_date} ({row.days}{" "}
                    {row.days === 1 ? "dzień" : "dni"})
                  </p>
                  {row.reason && <small>Powód: {row.reason}</small>}
                </div>
                {canDecide && row.status === "pending" && (
                  <div className="decision-actions">
                    <Button
                      variant="quiet"
                      size="small"
                      disabled={decide.isPending}
                      onClick={() =>
                        decide.mutate({ id: row.id, approve: false })
                      }
                    >
                      <X size={15} /> Odrzuć
                    </Button>
                    <Button
                      size="small"
                      disabled={decide.isPending}
                      onClick={() =>
                        decide.mutate({ id: row.id, approve: true })
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
          <Empty title="Brak wniosków">
            {types.data?.length
              ? "Złóż pierwszy wniosek o nieobecność."
              : "Najpierw dodaj typ nieobecności (HR/admin)."}
          </Empty>
        )}
        {decide.isError && (
          <Message>{(decide.error as ApiError).message}</Message>
        )}
      </Panel>
      {modalOpen && (
        <Modal
          title="Nowy wniosek"
          description="Zakres dat jest wliczany włącznie. Przy saldzie sprawdzamy dostępne dni."
          size="wide"
          onClose={() => setModalOpen(false)}
          footer={
            <>
              {create.isError && (
                <Message>{(create.error as ApiError).message}</Message>
              )}
              <Button
                type="button"
                variant="quiet"
                onClick={() => setModalOpen(false)}
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                form="create-leave-form"
                busy={create.isPending}
              >
                Wyślij wniosek
              </Button>
            </>
          }
        >
          <form
            id="create-leave-form"
            className="form-grid modal-form"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <Field label="Typ">
              <select
                value={leaveTypeId}
                onChange={(event) => setLeaveTypeId(event.target.value)}
                required
              >
                <option value="">Wybierz typ</option>
                {types.data?.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Od">
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
              />
            </Field>
            <Field label="Do">
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                required
              />
            </Field>
            <Field label="Powód">
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={2000}
              />
            </Field>
          </form>
        </Modal>
      )}
      {typeModal && canConfigure && (
        <Modal
          title="Typ nieobecności"
          description="Kod jest stały identyfikatorem typu w organizacji."
          onClose={() => setTypeModal(false)}
          footer={
            <>
              {createType.isError && (
                <Message>{(createType.error as ApiError).message}</Message>
              )}
              <Button
                type="button"
                variant="quiet"
                onClick={() => setTypeModal(false)}
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                form="create-leave-type-form"
                busy={createType.isPending}
              >
                Zapisz typ
              </Button>
            </>
          }
        >
          <form
            id="create-leave-type-form"
            className="modal-form"
            onSubmit={(event) => {
              event.preventDefault();
              createType.mutate();
            }}
          >
            <Field label="Kod">
              <input
                value={typeCode}
                onChange={(event) => setTypeCode(event.target.value)}
                required
                pattern="[a-z0-9_-]+"
              />
            </Field>
            <Field label="Nazwa">
              <input
                value={typeName}
                onChange={(event) => setTypeName(event.target.value)}
                required
              />
            </Field>
          </form>
        </Modal>
      )}
      {balanceModal && canConfigure && (
        <Modal
          title="Ustaw saldo"
          description={`Przyznane dni na rok ${year}.`}
          onClose={() => setBalanceModal(false)}
          footer={
            <>
              {saveBalance.isError && (
                <Message>{(saveBalance.error as ApiError).message}</Message>
              )}
              <Button
                type="button"
                variant="quiet"
                onClick={() => setBalanceModal(false)}
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                form="save-balance-form"
                busy={saveBalance.isPending}
              >
                Zapisz saldo
              </Button>
            </>
          }
        >
          <form
            id="save-balance-form"
            className="modal-form"
            onSubmit={(event) => {
              event.preventDefault();
              saveBalance.mutate();
            }}
          >
            <Field label="Pracownik">
              <select
                value={balanceEmployeeId}
                onChange={(event) => setBalanceEmployeeId(event.target.value)}
                required
              >
                <option value="">Wybierz</option>
                {employees.data?.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.first_name} {row.last_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Typ">
              <select
                value={balanceTypeId}
                onChange={(event) => setBalanceTypeId(event.target.value)}
                required
              >
                <option value="">Wybierz</option>
                {types.data?.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Przyznane dni">
              <input
                type="number"
                min={0}
                max={366}
                step={0.5}
                value={grantedDays}
                onChange={(event) => setGrantedDays(event.target.value)}
                required
              />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}
