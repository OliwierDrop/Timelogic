import { useMemo, useState } from "react";
import type {
  Employee,
  Position,
  ShiftFlags,
  ShiftKind,
  Tag,
} from "../../api";
import { Field } from "../../components";
import { KIND_LABELS } from "./dateUtils";
import { WizardDateRangeCalendar } from "./WizardDateRangeCalendar";
import {
  filterWizardEmployees,
  useWizardPeopleState,
  WizardEmployeeTable,
  WizardFilterSidebar,
  WizardSelectedSidebar,
} from "./WizardPeople";
import { WizardShell } from "./WizardShell";

const WEEKDAYS = [
  { value: 0, label: "poniedziałek" },
  { value: 1, label: "wtorek" },
  { value: 2, label: "środa" },
  { value: 3, label: "czwartek" },
  { value: 4, label: "piątek" },
  { value: 5, label: "sobota" },
  { value: 6, label: "niedziela" },
];

const KIND_ORDER: ShiftKind[] = ["standard", "flexible", "on_call"];

const COLORS = [
  "#94a3b8",
  "#64748b",
  "#3b82f6",
  "#2563eb",
  "#06b6d4",
  "#0ea5e9",
  "#10b981",
  "#14b8a6",
  "#84cc16",
  "#22c55e",
  "#eab308",
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#ec4899",
  "#f43f5e",
  "#a855f7",
  "#8b5cf6",
  "#6366f1",
  "#7c3aed",
  "#0f766e",
  "#1d4ed8",
  "#be123c",
  "#334155",
];

export type BulkPayload = {
  employee_ids: string[];
  kind: ShiftKind;
  started_time: string;
  ended_time: string;
  weekdays: number[];
  from_date: string;
  to_date: string;
  skip_holidays: boolean;
  overwrite: boolean;
  color: string | null;
  note: string | null;
  flags: ShiftFlags;
};

type Props = {
  employees: Employee[];
  tags: Tag[];
  positions: Position[];
  seedEmployeeIds?: string[];
  fromDate: Date;
  toDate: Date;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: BulkPayload) => void;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function hmToMinutes(h: string, m: string) {
  const hours = Number(h) || 0;
  const mins = Number(m) || 0;
  return hours * 60 + mins;
}

function addMinutesToTime(start: string, minutes: number) {
  const [h, m] = start.split(":").map(Number);
  const total = ((h || 0) * 60 + (m || 0) + minutes) % (24 * 60);
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

export function BulkWizard({
  employees,
  tags,
  positions,
  seedEmployeeIds = [],
  busy,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [step, setStep] = useState(1);
  const people = useWizardPeopleState(seedEmployeeIds);
  const [kind, setKind] = useState<ShiftKind>("standard");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [durationH, setDurationH] = useState("");
  const [durationM, setDurationM] = useState("");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [onCallType, setOnCallType] = useState("remote");
  const [note, setNote] = useState("");
  const [color, setColor] = useState<string | null>(COLORS[0]);
  const [weekdays, setWeekdays] = useState([0, 1, 2, 3, 4]);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      filterWizardEmployees(employees, {
        search: people.search,
        role: people.role,
        tagId: people.tagId,
        positionId: people.positionId,
      }),
    [employees, people.search, people.role, people.tagId, people.positionId],
  );

  const toggleWeekday = (value: number) =>
    setWeekdays((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value].sort(),
    );

  const buildTimesAndFlags = (): {
    started_time: string;
    ended_time: string;
    flags: ShiftFlags;
    note: string | null;
  } => {
    const durationMinutes = hmToMinutes(durationH, durationM);
    const noteValue = note.trim() || null;
    if (kind === "standard") {
      return {
        started_time: startTime,
        ended_time: endTime,
        flags: {},
        note: noteValue,
      };
    }
    if (kind === "flexible") {
      const started = windowStart || "08:00";
      const ended =
        windowEnd ||
        (durationMinutes
          ? addMinutesToTime(started, durationMinutes)
          : "16:00");
      const flags: ShiftFlags = {};
      if (durationMinutes) flags.flexible_duration_minutes = durationMinutes;
      if (windowStart) flags.flexible_window_start = windowStart;
      return {
        started_time: started,
        ended_time: ended,
        flags,
        note: noteValue,
      };
    }
    const started = windowStart || "08:00";
    const ended =
      windowEnd ||
      (durationMinutes ? addMinutesToTime(started, durationMinutes) : "16:00");
    return {
      started_time: started,
      ended_time: ended,
      flags: { on_call_type: onCallType },
      note: noteValue,
    };
  };

  const next = () => {
    if (step === 1 && !people.selected.length) {
      setLocalError("Wybierz co najmniej jednego pracownika");
      return;
    }
    if (step === 2 && kind === "standard" && (!startTime || !endTime)) {
      setLocalError("Czas wymagany");
      return;
    }
    if (step === 3 && !weekdays.length) {
      setLocalError("Wybierz co najmniej jeden dzień tygodnia");
      return;
    }
    setLocalError(null);
    setStep((current) => Math.min(3, current + 1));
  };

  const sidebar =
    step === 1 ? (
      <WizardFilterSidebar
        tags={tags}
        positions={positions}
        search={people.search}
        role={people.role}
        tagId={people.tagId}
        positionId={people.positionId}
        onSearch={people.setSearch}
        onRole={people.setRole}
        onTag={people.setTagId}
        onPosition={people.setPositionId}
      />
    ) : (
      <WizardSelectedSidebar
        employees={employees}
        selectedIds={people.selected}
      />
    );

  return (
    <WizardShell
      title="Kreator grafików pracy"
      step={step}
      totalSteps={3}
      sidebar={sidebar}
      error={localError || error}
      onClose={onClose}
      onBack={
        step > 1
          ? () => {
              setLocalError(null);
              setStep((current) => current - 1);
            }
          : undefined
      }
      primaryLabel={step < 3 ? "Dalej" : "Zapisz"}
      primaryIsNext={step < 3}
      primaryDisabled={
        (step === 1 && !people.selected.length) ||
        (step === 3 && (!rangeFrom || !rangeTo))
      }
      primaryBusy={busy}
      onPrimary={() => {
        if (step < 3) {
          next();
          return;
        }
        if (!rangeFrom || !rangeTo) {
          setLocalError("Wybierz zakres dat.");
          return;
        }
        const built = buildTimesAndFlags();
        onSubmit({
          employee_ids: people.selected,
          kind,
          started_time: built.started_time,
          ended_time: built.ended_time,
          weekdays,
          from_date: rangeFrom,
          to_date: rangeTo,
          skip_holidays: true,
          overwrite: false,
          color,
          note: built.note,
          flags: built.flags,
        });
      }}
    >
      {step === 1 ? (
        <WizardEmployeeTable
          employees={visible}
          selectedIds={people.selected}
          onToggle={people.toggle}
          onClear={people.clear}
          onToggleAll={() => {
            const allVisibleSelected =
              visible.length > 0 &&
              visible.every((row) => people.selected.includes(row.id));
            if (allVisibleSelected) {
              people.setSelected((current) =>
                current.filter((id) => !visible.some((row) => row.id === id)),
              );
            } else {
              people.setSelected((current) => [
                ...new Set([...current, ...visible.map((row) => row.id)]),
              ]);
            }
          }}
        />
      ) : null}

      {step === 2 ? (
        <div className="wizard-form wizard-form-wide">
          <div>
            <h3 className="wizard-section-title">Typ grafiku pracy</h3>
            <div className="wizard-kind-row" role="tablist">
              {KIND_ORDER.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  className={`wizard-kind-option${kind === item ? " active" : ""}`}
                  aria-selected={kind === item}
                  onClick={() => setKind(item)}
                >
                  {KIND_LABELS[item]}
                </button>
              ))}
            </div>
          </div>

          {kind === "standard" ? (
            <div className="shift-time-row">
              <Field label="Od">
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </Field>
              <Field label="Do">
                <input
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                />
              </Field>
            </div>
          ) : null}

          {kind === "flexible" ? (
            <>
              <Field label="Czas trwania (opcjonalne)">
                <div className="wizard-hm-row">
                  <label>
                    <input
                      inputMode="numeric"
                      value={durationH}
                      onChange={(event) => setDurationH(event.target.value)}
                      placeholder="0"
                    />
                    <span>h</span>
                  </label>
                  <label>
                    <input
                      inputMode="numeric"
                      value={durationM}
                      onChange={(event) => setDurationM(event.target.value)}
                      placeholder="0"
                    />
                    <span>m</span>
                  </label>
                </div>
              </Field>
              <Field label="Godzina rozpoczęcia od – do (opcjonalne)">
                <div className="wizard-hm-row wizard-hm-window">
                  <input
                    type="time"
                    value={windowStart}
                    onChange={(event) => setWindowStart(event.target.value)}
                  />
                  <span className="subtle">–</span>
                  <input
                    type="time"
                    value={windowEnd}
                    onChange={(event) => setWindowEnd(event.target.value)}
                  />
                </div>
              </Field>
            </>
          ) : null}

          {kind === "on_call" ? (
            <>
              <Field label="Czas trwania (opcjonalne)">
                <div className="wizard-hm-row">
                  <label>
                    <input
                      inputMode="numeric"
                      value={durationH}
                      onChange={(event) => setDurationH(event.target.value)}
                      placeholder="0"
                    />
                    <span>h</span>
                  </label>
                  <label>
                    <input
                      inputMode="numeric"
                      value={durationM}
                      onChange={(event) => setDurationM(event.target.value)}
                      placeholder="0"
                    />
                    <span>m</span>
                  </label>
                </div>
              </Field>
              <Field label="Typ dyżuru">
                <select
                  value={onCallType}
                  onChange={(event) => setOnCallType(event.target.value)}
                >
                  <option value="remote">Zdalny</option>
                  <option value="onsite">Na miejscu</option>
                </select>
              </Field>
            </>
          ) : null}

          <Field label="Notatka (opcjonalne)">
            <textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>

          {kind !== "on_call" ? (
            <div>
              <h3 className="wizard-section-title">Kolor</h3>
              <div className="shift-color-grid wizard-color-grid">
                {COLORS.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    className={`shift-color-swatch${color === swatch ? " selected" : ""}`}
                    style={{ background: swatch }}
                    aria-label={`Kolor ${swatch}`}
                    onClick={() => setColor(swatch)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="wizard-form wizard-form-wide">
          <div>
            <h3 className="wizard-section-title">Wybierz dni tygodnia</h3>
            <div className="weekday-pills weekday-pills-row">
              {WEEKDAYS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  className={`filter-item ${weekdays.includes(day.value) ? "active" : ""}`}
                  onClick={() => toggleWeekday(day.value)}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="wizard-section-title">Wybierz zakres dat</h3>
            <WizardDateRangeCalendar
              fromDate={rangeFrom}
              toDate={rangeTo}
              onChange={(from, to) => {
                setRangeFrom(from);
                setRangeTo(to);
              }}
            />
          </div>
        </div>
      ) : null}
    </WizardShell>
  );
}
