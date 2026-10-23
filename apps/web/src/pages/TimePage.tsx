import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { Coffee, Pause, Play, Plus } from "lucide-react";
import {
  ApiError,
  deviceDatetime,
  localTime,
  post,
  type Entry,
  type User,
} from "../api";
import { useCreateOwnEmployee, useEntries } from "../auth/hooks";
import { Button, Empty, Field, Message, Modal, Panel } from "../components";
import { PageHeading } from "../layout/PageHeading";

export function TimePage() {
  const { user } = useOutletContext<{ user: User }>();
  const client = useQueryClient();
  const entries = useEntries(user.employee_id);
  const createCard = useCreateOwnEmployee(user);
  const canCreateCard = user.roles.some((r) => ["admin", "hr"].includes(r));
  const active = entries.data?.find((x) => !x.ended_at);
  const openBreak = active?.breaks.find((x) => !x.ended_at);
  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown }) =>
      post<Entry>(path, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["entries"] }),
  });
  const [correcting, setCorrecting] = useState<Entry | null>(null);
  const [reason, setReason] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const correction = useMutation({
    mutationFn: () =>
      post("/attendance-corrections", {
        time_entry_id: correcting!.id,
        proposed_start: new Date(start).toISOString(),
        proposed_end: new Date(end).toISOString(),
        reason,
      }),
    onSuccess: () => {
      setCorrecting(null);
      setReason("");
      client.invalidateQueries({ queryKey: ["corrections"] });
    },
  });
  return (
    <>
      <PageHeading
        title="Mój czas"
        description="Rejestruj pracę i przerwy. Wszystkie godziny pokazujemy według strefy Europe/Warsaw."
      />
      <Panel className="clock-panel">
        <div className="clock-main">
          <div className="clock-face">
            <span>TERAZ</span>
            <LiveClock />
          </div>
          <div className="clock-copy">
            <span className={`status-chip ${active ? "status-live" : ""}`}>
              {active
                ? openBreak
                  ? "Trwa przerwa"
                  : "Trwa praca"
                : "Poza pracą"}
            </span>
            <h2>
              {!user.employee_id
                ? "Brak karty pracownika"
                : active
                  ? `Start o ${localTime(active.started_at)}`
                  : "Rozpocznij dzień pracy"}
            </h2>
            <p>
              {!user.employee_id
                ? "RCP działa dopiero po powiązaniu konta z kartą pracownika."
                : active
                  ? "Zakończ przerwę przed zatrzymaniem pracy."
                  : "Jedno kliknięcie zapisze godzinę rozpoczęcia."}
            </p>
          </div>
        </div>
        <div className="clock-actions">
          {!user.employee_id ? (
            canCreateCard ? (
              <Button
                busy={createCard.isPending}
                onClick={() => createCard.mutate()}
              >
                <Plus size={17} /> Utwórz moją kartę i włącz RCP
              </Button>
            ) : (
              <span className="subtle">
                Poproś administratora o połączenie konta z kartą pracownika.
              </span>
            )
          ) : !active ? (
            <Button
              busy={action.isPending}
              onClick={() => action.mutate({ path: "/time-entries", body: {} })}
            >
              <Play size={17} fill="currentColor" /> Rozpocznij pracę
            </Button>
          ) : (
            <>
              {openBreak ? (
                <Button
                  busy={action.isPending}
                  onClick={() =>
                    action.mutate({
                      path: `/time-entries/${active.id}/breaks/${openBreak.id}/stop`,
                      body: {},
                    })
                  }
                >
                  <Play size={17} /> Zakończ przerwę
                </Button>
              ) : (
                <>
                  <Button
                    variant="quiet"
                    busy={action.isPending}
                    onClick={() =>
                      action.mutate({
                        path: `/time-entries/${active.id}/breaks`,
                        body: { paid: true },
                      })
                    }
                  >
                    <Coffee size={17} /> Przerwa płatna
                  </Button>
                  <Button
                    variant="quiet"
                    busy={action.isPending}
                    onClick={() =>
                      action.mutate({
                        path: `/time-entries/${active.id}/breaks`,
                        body: { paid: false },
                      })
                    }
                  >
                    <Coffee size={17} /> Przerwa bezpłatna
                  </Button>
                </>
              )}
              <Button
                variant="quiet"
                busy={action.isPending}
                disabled={!!openBreak}
                onClick={() =>
                  action.mutate({
                    path: `/time-entries/${active.id}/stop`,
                    body: {},
                  })
                }
              >
                <Pause size={17} /> Zakończ pracę
              </Button>
            </>
          )}
        </div>
        {createCard.isError && (
          <Message>{(createCard.error as ApiError).message}</Message>
        )}
        {action.isError && (
          <Message>{(action.error as ApiError).message}</Message>
        )}
      </Panel>
      <Panel title="Historia wpisów" className="history-panel">
        {!user.employee_id ? (
          <Empty title="Brak powiązanej karty">
            {canCreateCard
              ? "Utwórz kartę powyżej — potem Start/Stop zadziała od razu."
              : "Administrator może połączyć konto z kartą w module Pracownicy."}
          </Empty>
        ) : entries.isPending ? (
          <p className="subtle">Ładowanie historii…</p>
        ) : entries.isError ? (
          <Message>Nie udało się pobrać historii.</Message>
        ) : entries.data?.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Rozpoczęcie</th>
                  <th>Zakończenie</th>
                  <th>Przerwy</th>
                  <th>Stan</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.data.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      {new Intl.DateTimeFormat("pl-PL", {
                        dateStyle: "medium",
                        timeZone: "Europe/Warsaw",
                      }).format(new Date(entry.started_at))}
                    </td>
                    <td>{localTime(entry.started_at)}</td>
                    <td>{entry.ended_at ? localTime(entry.ended_at) : "—"}</td>
                    <td>{entry.breaks.length}</td>
                    <td>
                      <span
                        className={`table-status ${entry.ended_at ? "" : "open"}`}
                      >
                        {entry.ended_at ? "Zamknięty" : "W toku"}
                      </span>
                    </td>
                    <td>
                      {entry.ended_at && (
                        <button
                          className="table-link"
                          onClick={() => {
                            setCorrecting(entry);
                            setStart(deviceDatetime(entry.started_at));
                            setEnd(deviceDatetime(entry.ended_at!));
                          }}
                        >
                          Zgłoś korektę
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Nie ma jeszcze wpisów">
            Pierwszy zapis pracy pojawi się tutaj.
          </Empty>
        )}
      </Panel>
      {correcting && (
        <Modal
          title="Zgłoś korektę"
          description="Podaj właściwe godziny i powód zmiany. Godziny formularza są w strefie urządzenia."
          onClose={() => setCorrecting(null)}
          footer={
            <>
              {correction.isError && (
                <Message>{(correction.error as ApiError).message}</Message>
              )}
              <Button
                type="button"
                variant="quiet"
                onClick={() => setCorrecting(null)}
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                form="correction-form"
                busy={correction.isPending}
              >
                Wyślij korektę
              </Button>
            </>
          }
        >
          <form
            id="correction-form"
            className="modal-form"
            onSubmit={(e) => {
              e.preventDefault();
              correction.mutate();
            }}
          >
            <Field label="Początek">
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </Field>
            <Field label="Koniec">
              <input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                required
              />
            </Field>
            <Field label="Powód">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                minLength={5}
                maxLength={2000}
                required
              />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <strong>
      {new Intl.DateTimeFormat("pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Europe/Warsaw",
      }).format(now)}
    </strong>
  );
}
