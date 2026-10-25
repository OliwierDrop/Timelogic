import { useState } from "react";
import type { Employee, Shift, ShiftFlags, ShiftKind } from "../../api";
import { Button, Field, Message, Modal } from "../../components";
import {
  combineDateAndTime,
  KIND_LABELS,
  timeFromDate,
  toDateKey,
} from "./dateUtils";

const COLORS = [
  "#94a3b8",
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#84cc16",
  "#eab308",
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#ec4899",
  "#a855f7",
  "#6366f1",
];

export type ShiftFormValues = {
  employee_id: string;
  day: string;
  kind: ShiftKind;
  start_time: string;
  end_time: string;
  color: string | null;
  note: string;
  flags: ShiftFlags;
  replaces_id?: string | null;
  /** Existing draft id — PATCH instead of POST */
  edit_id?: string | null;
};

type Props = {
  employees: Employee[];
  initial: ShiftFormValues;
  title?: string;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (values: ShiftFormValues) => void;
};

export function valuesFromShift(shift: Shift, day: Date): ShiftFormValues {
  const start = new Date(shift.started_at);
  const end = new Date(shift.ended_at);
  return {
    employee_id: shift.employee_id,
    day: toDateKey(day),
    kind: shift.kind || "standard",
    start_time: timeFromDate(start),
    end_time: timeFromDate(end),
    color: shift.color,
    note: shift.note || "",
    flags: { ...(shift.flags || {}) },
    replaces_id: shift.published ? shift.id : shift.replaces_id,
    edit_id: shift.published ? null : shift.id,
  };
}

export function defaultShiftValues(
  employeeId: string,
  day: Date,
): ShiftFormValues {
  return {
    employee_id: employeeId,
    day: toDateKey(day),
    kind: "standard",
    start_time: "08:00",
    end_time: "16:00",
    color: COLORS[0],
    note: "",
    flags: {},
  };
}

export function buildShiftPayload(values: ShiftFormValues) {
  const day = new Date(values.day + "T00:00:00");
  const started = combineDateAndTime(day, values.start_time || "08:00");
  let ended = combineDateAndTime(day, values.end_time || "16:00");
  if (ended <= started) ended = new Date(ended.getTime() + 24 * 60 * 60 * 1000);
  if (values.kind === "standard" && !values.start_time) {
    return { error: "Czas wymagany" as const };
  }
  return {
    employee_id: values.employee_id,
    started_at: started.toISOString(),
    ended_at: ended.toISOString(),
    kind: values.kind,
    color: values.color,
    note: values.note || null,
    flags: values.flags,
    replaces_id: values.replaces_id || null,
  };
}

export function ShiftFormModal({
  employees,
  initial,
  title = "Dodaj grafik pracy",
  busy,
  error,
  onClose,
  onSave,
}: Props) {
  const [values, setValues] = useState(initial);
  const [localError, setLocalError] = useState<string | null>(null);
  const flags = values.flags;
  const setFlag = <K extends keyof ShiftFlags>(key: K, value: ShiftFlags[K]) =>
    setValues((current) => ({
      ...current,
      flags: { ...current.flags, [key]: value },
    }));

  return (
    <Modal
      title={title}
      description={`Dzień ${values.day}`}
      size="wide"
      onClose={onClose}
      footer={
        <>
          {(localError || error) && <Message>{localError || error}</Message>}
          <Button type="button" variant="quiet" onClick={onClose}>
            Anuluj
          </Button>
          <Button
            type="button"
            busy={busy}
            onClick={() => {
              if (values.kind === "standard" && (!values.start_time || !values.end_time)) {
                setLocalError("Czas wymagany");
                return;
              }
              setLocalError(null);
              onSave(values);
            }}
          >
            Zapisz
          </Button>
        </>
      }
    >
      <div className="form-grid modal-form">
        <Field label="Pracownik">
          <select
            value={values.employee_id}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                employee_id: event.target.value,
              }))
            }
            required
            disabled={Boolean(values.replaces_id)}
          >
            <option value="">Wybierz</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.first_name} {employee.last_name}
              </option>
            ))}
          </select>
        </Field>
        <div className="shift-kind-tabs" role="tablist">
          {(Object.keys(KIND_LABELS) as ShiftKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              role="tab"
              className={`filter-item ${values.kind === kind ? "active" : ""}`}
              aria-selected={values.kind === kind}
              onClick={() => setValues((current) => ({ ...current, kind }))}
            >
              {KIND_LABELS[kind]}
            </button>
          ))}
        </div>
        {values.kind === "standard" && (
          <div className="shift-time-row">
            <Field label="Od">
              <input
                type="time"
                value={values.start_time}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    start_time: event.target.value,
                  }))
                }
                required
              />
            </Field>
            <Field label="Do">
              <input
                type="time"
                value={values.end_time}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    end_time: event.target.value,
                  }))
                }
                required
              />
            </Field>
          </div>
        )}
        {values.kind === "flexible" && (
          <>
            <Field label="Czas trwania (opcjonalnie)">
              <input
                type="number"
                min={0}
                max={24 * 60}
                value={flags.flexible_duration_minutes ?? ""}
                onChange={(event) =>
                  setFlag(
                    "flexible_duration_minutes",
                    event.target.value ? Number(event.target.value) : undefined,
                  )
                }
                placeholder="minuty"
              />
            </Field>
            <Field label="Okno rozpoczęcia (opcjonalnie)">
              <input
                type="time"
                value={flags.flexible_window_start || ""}
                onChange={(event) =>
                  setFlag("flexible_window_start", event.target.value || undefined)
                }
              />
            </Field>
            <div className="shift-time-row">
              <Field label="Od (orientacyjnie)">
                <input
                  type="time"
                  value={values.start_time}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      start_time: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Do (orientacyjnie)">
                <input
                  type="time"
                  value={values.end_time}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      end_time: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
          </>
        )}
        {values.kind === "on_call" && (
          <>
            <Field label="Rodzaj dyżuru">
              <select
                value={flags.on_call_type || "remote"}
                onChange={(event) => setFlag("on_call_type", event.target.value)}
              >
                <option value="remote">Zdalny</option>
                <option value="onsite">Na miejscu</option>
              </select>
            </Field>
            <div className="shift-time-row">
              <Field label="Od (opcjonalnie)">
                <input
                  type="time"
                  value={values.start_time}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      start_time: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Do (opcjonalnie)">
                <input
                  type="time"
                  value={values.end_time}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      end_time: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
          </>
        )}
        <Field label="Kolor">
          <div className="shift-color-grid">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`shift-color-swatch ${values.color === color ? "selected" : ""}`}
                style={{ background: color }}
                aria-label={`Kolor ${color}`}
                onClick={() =>
                  setValues((current) => ({ ...current, color }))
                }
              />
            ))}
          </div>
        </Field>
        <div className="shift-flags">
          <h3>Dodatkowe opcje</h3>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(flags.count_before)}
              onChange={(event) => setFlag("count_before", event.target.checked)}
            />
            Licz czas pracy przed grafikiem
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(flags.count_after)}
              onChange={(event) => setFlag("count_after", event.target.checked)}
            />
            Licz czas pracy po grafiku
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(flags.auto_break)}
              onChange={(event) => setFlag("auto_break", event.target.checked)}
            />
            Dodaj przerwę automatyczną
          </label>
          {flags.auto_break && (
            <>
              <Field label="Długość przerwy (min)">
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={flags.auto_break_minutes ?? 30}
                  onChange={(event) =>
                    setFlag("auto_break_minutes", Number(event.target.value) || 30)
                  }
                />
              </Field>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={Boolean(flags.unpaid_break)}
                  onChange={(event) =>
                    setFlag("unpaid_break", event.target.checked)
                  }
                />
                Jako przerwa bezpłatna
              </label>
            </>
          )}
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(flags.property_guard)}
              onChange={(event) =>
                setFlag("property_guard", event.target.checked)
              }
            />
            Pilnowanie mienia
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(flags.minors_prohibited)}
              onChange={(event) =>
                setFlag("minors_prohibited", event.target.checked)
              }
            />
            Prace wzbronione młodocianym
          </label>
        </div>
        <Field label="Notatka">
          <textarea
            rows={2}
            value={values.note}
            onChange={(event) =>
              setValues((current) => ({ ...current, note: event.target.value }))
            }
          />
        </Field>
      </div>
    </Modal>
  );
}
