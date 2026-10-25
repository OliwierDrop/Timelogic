import { useQuery } from "@tanstack/react-query";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ArrowRight, Clock3 } from "lucide-react";
import { api, localDate, localTime, type Correction, type User } from "../api";
import { useEntries } from "../auth/hooks";
import { Button, Empty, Panel } from "../components";
import { PageHeading } from "../layout/PageHeading";

export function DashboardPage() {
  const { user } = useOutletContext<{ user: User }>();
  const navigate = useNavigate();
  const entries = useEntries(user.employee_id);
  const corrections = useQuery({
    queryKey: ["corrections"],
    queryFn: () => api<Correction[]>("/attendance-corrections"),
    enabled: user.roles.some((r) => ["manager", "hr", "admin"].includes(r)),
  });
  const active = entries.data?.find((x) => !x.ended_at);
  const pending =
    corrections.data?.filter((x) => x.status === "pending").length || 0;
  return (
    <>
      <PageHeading title="Dzień dobry" />
      <div className="dashboard-grid">
        <Panel className="status-panel">
          <div className="status-top">
            <span className="status-icon">
              <Clock3 size={26} />
            </span>
            <span className={`status-chip ${active ? "status-live" : ""}`}>
              {active ? "Trwa praca" : "Poza pracą"}
            </span>
          </div>
          <h2>
            {active
              ? `Od ${localTime(active.started_at)}`
              : "Gotowe do rozpoczęcia"}
          </h2>
          <p>
            {active
              ? "Twój bieżący wpis jest zapisywany w historii czasu."
              : "Rozpocznij pracę z ekranu Mój czas."}
          </p>
          <Button onClick={() => navigate("/czas")}>
            Przejdź do mojego czasu <ArrowRight size={17} />
          </Button>
        </Panel>
        <div className="dashboard-aside">
          <Panel title="Ostatnie zdarzenia">
            {entries.data?.length ? (
              <div className="event-list">
                {entries.data.slice(0, 3).map((entry) => (
                  <div className="event-row" key={entry.id}>
                    <span className="event-dot" />
                    <div>
                      <strong>{localDate(entry.started_at)}</strong>
                      <small>
                        {entry.ended_at
                          ? `${localTime(entry.started_at)}–${localTime(entry.ended_at)}`
                          : `Od ${localTime(entry.started_at)} · trwa`}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="Brak zdarzeń">
                Twoje wpisy pojawią się tutaj po pierwszej rejestracji.
              </Empty>
            )}
          </Panel>
          {user.roles.some((r) => ["manager", "hr", "admin"].includes(r)) && (
            <Panel title="Do rozpatrzenia">
              <div className="approval-summary">
                <strong>{pending}</strong>
                <span>
                  {pending === 1 ? "korekta oczekuje" : "korekt oczekuje"} na
                  decyzję
                </span>
              </div>
              <button className="inline-action" onClick={() => navigate("/korekty")}>
                Otwórz kolejkę <ArrowRight size={16} />
              </button>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
