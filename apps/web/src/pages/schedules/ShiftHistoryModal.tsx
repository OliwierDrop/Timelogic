import { useQuery } from "@tanstack/react-query";
import {
  api,
  ApiError,
  localTime,
  type ShiftDayHistory,
} from "../../api";
import { Button, Message, Modal } from "../../components";
import { KIND_LABELS } from "./dateUtils";

function formatStamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDayTitle(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!y || !m || !d) return dayKey;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function shiftSummary(kind: string, startedAt: string, endedAt: string) {
  const label = KIND_LABELS[kind as keyof typeof KIND_LABELS] || kind;
  return `${label}, ${localTime(startedAt)}-${localTime(endedAt)}`;
}

export function ShiftHistoryModal({
  employeeId,
  dayKey,
  onClose,
}: {
  employeeId: string;
  dayKey: string;
  onClose: () => void;
}) {
  const history = useQuery({
    queryKey: ["shift-history", employeeId, dayKey],
    queryFn: () =>
      api<ShiftDayHistory>(
        `/shifts/history?employee_id=${encodeURIComponent(employeeId)}&day=${encodeURIComponent(dayKey)}`,
      ),
  });

  const current = history.data?.current;
  const currentLabel = current
    ? `${KIND_LABELS[current.kind] || current.kind} ${localTime(current.started_at)}-${localTime(current.ended_at)}`
    : "Brak grafiku";

  return (
    <Modal
      title={`Historia grafików - ${formatDayTitle(dayKey)}`}
      onClose={onClose}
      footer={
        <Button type="button" variant="quiet" onClick={onClose}>
          Anuluj
        </Button>
      }
    >
      {history.isError ? (
        <Message>{(history.error as ApiError).message}</Message>
      ) : null}
      <div className="shift-history">
        <div className="shift-history-current">
          <span className="shift-history-current-label">Aktualny stan</span>
          <strong>{currentLabel}</strong>
        </div>
        {history.isPending ? <p className="subtle">Ładowanie…</p> : null}
        {!history.isPending && (history.data?.events.length ?? 0) === 0 ? (
          <p className="subtle">Brak zdarzeń w historii.</p>
        ) : null}
        <ul className="shift-history-list">
          {history.data?.events.map((event, index) => (
            <li key={`${event.shift_id}-${event.at}-${index}`}>
              <div className="shift-history-event-head">
                <strong>{event.actor_name}</strong>
                <span className="shift-history-stamp">{formatStamp(event.at)}</span>
                <span className="shift-history-badge">{event.action_label}</span>
              </div>
              <p className="shift-history-detail">
                {shiftSummary(event.kind, event.started_at, event.ended_at)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
