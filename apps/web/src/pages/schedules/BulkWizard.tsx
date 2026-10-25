import { useState } from "react";
import type { Employee, ShiftFlags, ShiftKind } from "../../api";
import { Button, Field, Message, Modal } from "../../components";
import { KIND_LABELS, toDateKey } from "./dateUtils";

const WEEKDAYS = [
  { value: 0, label: "Pon" },
  { value: 1, label: "Wt" },
  { value: 2, label: "Śr" },
  { value: 3, label: "Czw" },
  { value: 4, label: "Pt" },
  { value: 5, label: "Sob" },
  { value: 6, label: "Ndz" },
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
  fromDate: Date;
  toDate: Date;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: BulkPayload) => void;
};

export function BulkWizard({
  employees,
  fromDate,
  toDate,
  busy,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [kind, setKind] = useState<ShiftKind>("standard");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [weekdays, setWeekdays] = useState([0, 1, 2, 3, 4]);
  const [rangeFrom, setRangeFrom] = useState(toDateKey(fromDate));
  const [rangeTo, setRangeTo] = useState(toDateKey(toDate));
  const [skipHolidays, setSkipHolidays] = useState(true);
  const [overwrite, setOverwrite] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const toggleEmployee = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  const toggleWeekday = (value: number) =>
    setWeekdays((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value].sort(),
    );

  const next = () => {
    if (step === 1 && !selected.length) {
      setLocalError("Wybierz co najmniej jednego pracownika");
      return;
    }
    if (step === 2 && kind === "standard" && (!startTime || !endTime)) {
      setLocalError("Czas wymagany");
      return;
    }
    setLocalError(null);
    setStep((current) => Math.min(3, current + 1));
  };

  return (
    <Modal
      title="Kreator grafików pracy"
      description={`Krok ${step} z 3`}
      size="wide"
      onClose={onClose}
      footer={
        <>
          {(localError || error) && <Message>{localError || error}</Message>}
          <Button type="button" variant="quiet" onClick={onClose}>
            Anuluj
          </Button>
          {step > 1 && (
            <Button
              type="button"
              variant="quiet"
              onClick={() => setStep((current) => current - 1)}
            >
              Wstecz
            </Button>
          )}
          {step < 3 ? (
            <Button type="button" onClick={next} disabled={step === 1 && !selected.length}>
              Dalej
            </Button>
          ) : (
            <Button
              type="button"
              busy={busy}
              onClick={() =>
                onSubmit({
                  employee_ids: selected,
                  kind,
                  started_time: startTime,
                  ended_time: endTime,
                  weekdays,
                  from_date: rangeFrom,
                  to_date: rangeTo,
                  skip_holidays: skipHolidays,
                  overwrite,
                  color: null,
                  note: null,
                  flags: {},
                })
              }
            >
              Utwórz szkice
            </Button>
          )}
        </>
      }
    >
      {step === 1 && (
        <div className="bulk-employees">
          <p className="subtle">Wybierz pracownika/ów</p>
          <div className="bulk-employee-list">
            {employees.map((employee) => (
              <label key={employee.id} className="toggle-row">
                <input
                  type="checkbox"
                  checked={selected.includes(employee.id)}
                  onChange={() => toggleEmployee(employee.id)}
                />
                {employee.first_name} {employee.last_name}
                <span className="subtle">
                  {employee.roles[0] || "pracownik"}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="form-grid modal-form">
          <div className="shift-kind-tabs">
            {(Object.keys(KIND_LABELS) as ShiftKind[]).map((item) => (
              <button
                key={item}
                type="button"
                className={`filter-item ${kind === item ? "active" : ""}`}
                onClick={() => setKind(item)}
              >
                {KIND_LABELS[item]}
              </button>
            ))}
          </div>
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
        </div>
      )}
      {step === 3 && (
        <div className="form-grid modal-form">
          <Field label="Od daty">
            <input
              type="date"
              value={rangeFrom}
              onChange={(event) => setRangeFrom(event.target.value)}
            />
          </Field>
          <Field label="Do daty">
            <input
              type="date"
              value={rangeTo}
              onChange={(event) => setRangeTo(event.target.value)}
            />
          </Field>
          <div>
            <h3>Dni tygodnia</h3>
            <div className="weekday-pills">
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
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={skipHolidays}
              onChange={(event) => setSkipHolidays(event.target.checked)}
            />
            Pomijaj święta i weekendy
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(event) => setOverwrite(event.target.checked)}
            />
            Nadpisz istniejące grafiki
          </label>
        </div>
      )}
    </Modal>
  );
}
