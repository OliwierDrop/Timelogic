import { useQuery } from "@tanstack/react-query";
import { api, ApiError, localDate } from "../../api";
import { Empty, Message } from "../../components";
import { AccountSection, AccountTile } from "../account/AccountTile";

type AuditRow = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  created_at: string;
};

export function OrgAuditTab() {
  const audit = useQuery({
    queryKey: ["audit", 50],
    queryFn: () => api<AuditRow[]>("/audit-logs?limit=50"),
  });

  return (
    <AccountSection
      title="Audyt"
      description="Ostatnie działania w organizacji (do 50 wpisów)."
    >
      {audit.isError ? (
        <Message>{(audit.error as ApiError).message}</Message>
      ) : null}
      <AccountTile>
        <div className="event-list">
          {audit.isPending ? <p className="subtle">Ładowanie…</p> : null}
          {audit.data?.map((row) => (
            <div className="event-row" key={row.id}>
              <span className="event-dot" />
              <div>
                <strong>{row.action}</strong>
                <small>
                  {row.target_type}
                  {row.target_id ? ` · ${row.target_id.slice(0, 8)}…` : ""} ·{" "}
                  {localDate(row.created_at)}
                </small>
              </div>
            </div>
          ))}
          {!audit.isPending && !audit.data?.length ? (
            <Empty title="Brak działań">
              Historia pojawi się po pierwszych zmianach.
            </Empty>
          ) : null}
        </div>
      </AccountTile>
    </AccountSection>
  );
}
