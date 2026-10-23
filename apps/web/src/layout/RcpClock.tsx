import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock3, Coffee, Pause, Play, Plus, Square } from "lucide-react";
import { ApiError, localTime, post, type Entry, type User } from "../api";
import { useCreateOwnEmployee, useEntries } from "../auth/hooks";

export function RcpClock({ user }: { user: User }) {
  const client = useQueryClient();
  const entries = useEntries(user.employee_id);
  const createCard = useCreateOwnEmployee(user);
  const active = entries.data?.find((x) => !x.ended_at);
  const openBreak = active?.breaks.find((x) => !x.ended_at);
  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown }) =>
      post<Entry>(path, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["entries"] }),
  });
  if (!user.employee_id) {
    const canCreate = user.roles.some((r) => ["admin", "hr"].includes(r));
    return (
      <div
        className="rcp-chip rcp-chip-muted"
        title="Brak powiązanej karty pracownika"
      >
        <Clock3 size={15} />
        <span>Brak karty RCP</span>
        {canCreate && (
          <button
            className="rcp-action"
            disabled={createCard.isPending}
            onClick={() => createCard.mutate()}
            aria-label="Utwórz moją kartę pracownika"
            title="Utwórz moją kartę pracownika"
          >
            <Plus size={14} />
          </button>
        )}
      </div>
    );
  }
  return (
    <div
      className={`rcp-chip ${active ? "rcp-chip-live" : ""}`}
      title={action.isError ? (action.error as ApiError).message : undefined}
    >
      <Clock3 size={15} />
      <span>
        {active
          ? openBreak
            ? `Przerwa od ${localTime(openBreak.started_at)}`
            : `Praca od ${localTime(active.started_at)}`
          : "Poza pracą"}
      </span>
      {!active && (
        <button
          className="rcp-action"
          disabled={action.isPending}
          onClick={() => action.mutate({ path: "/time-entries", body: {} })}
          aria-label="Start"
        >
          <Play size={14} />
        </button>
      )}
      {active && !openBreak && (
        <>
          <button
            className="rcp-action"
            disabled={action.isPending}
            onClick={() =>
              action.mutate({
                path: `/time-entries/${active.id}/breaks`,
                body: { paid: true },
              })
            }
            aria-label="Przerwa"
          >
            <Coffee size={14} />
          </button>
          <button
            className="rcp-action"
            disabled={action.isPending}
            onClick={() =>
              action.mutate({
                path: `/time-entries/${active.id}/stop`,
                body: {},
              })
            }
            aria-label="Stop"
          >
            <Square size={14} />
          </button>
        </>
      )}
      {active && openBreak && (
        <button
          className="rcp-action"
          disabled={action.isPending}
          onClick={() =>
            action.mutate({
              path: `/time-entries/${active.id}/breaks/${openBreak.id}/stop`,
              body: {},
            })
          }
          aria-label="Zakończ przerwę"
        >
          <Pause size={14} />
        </button>
      )}
    </div>
  );
}
