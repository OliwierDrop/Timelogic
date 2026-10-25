import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  addMonths,
  sameDay,
  startOfMonth,
  startOfWeek,
  toDateKey,
} from "./dateUtils";

const WEEKDAY_HEADERS = ["pn", "wt", "śr", "cz", "pt", "so", "nd"];

const MONTH_NAMES = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat("pl-PL", { month: "long" }).format(
    new Date(2020, month, 1),
  ),
);

const YEAR_SPAN = 12;

function monthName(value: Date) {
  return new Intl.DateTimeFormat("pl-PL", { month: "long" }).format(value);
}

function yearsAround(center: number) {
  const start = center - Math.floor(YEAR_SPAN / 2);
  return Array.from({ length: YEAR_SPAN }, (_, index) => start + index);
}

function daysForMonth(monthStart: Date) {
  const gridStart = startOfWeek(monthStart, "monday");
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function inRange(day: Date, fromKey: string, toKey: string) {
  if (!fromKey || !toKey) return false;
  const key = toDateKey(day);
  const a = fromKey <= toKey ? fromKey : toKey;
  const b = fromKey <= toKey ? toKey : fromKey;
  return key >= a && key <= b;
}

type Side = "left" | "right";
type PickerKind = "month" | "year";
type OpenPicker = { side: Side; kind: PickerKind } | null;

export function WizardDateRangeCalendar({
  fromDate,
  toDate,
  onChange,
}: {
  fromDate: string;
  toDate: string;
  onChange: (from: string, to: string) => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [pickingEnd, setPickingEnd] = useState(false);
  const [openPicker, setOpenPicker] = useState<OpenPicker>(null);
  const closeTimer = useRef<number | null>(null);

  const months = useMemo(
    () => [viewMonth, addMonths(viewMonth, 1)],
    [viewMonth],
  );

  const clearCloseTimer = () => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const showPicker = (side: Side, kind: PickerKind) => {
    clearCloseTimer();
    setOpenPicker({ side, kind });
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => setOpenPicker(null), 120);
  };

  const togglePicker = (side: Side, kind: PickerKind) => {
    setOpenPicker((current) =>
      current?.side === side && current.kind === kind
        ? null
        : { side, kind },
    );
  };

  const applyPanelDate = (side: Side, year: number, monthIndex: number) => {
    const chosen = new Date(year, monthIndex, 1);
    setViewMonth(side === "left" ? chosen : addMonths(chosen, -1));
    setOpenPicker(null);
  };

  const selectMonth = (side: Side, monthIndex: number) => {
    const panel = side === "left" ? months[0] : months[1];
    applyPanelDate(side, panel.getFullYear(), monthIndex);
  };

  const selectYear = (side: Side, year: number) => {
    const panel = side === "left" ? months[0] : months[1];
    applyPanelDate(side, year, panel.getMonth());
  };

  const onPick = (day: Date) => {
    const key = toDateKey(day);
    if (!pickingEnd || !fromDate) {
      onChange(key, key);
      setPickingEnd(true);
      return;
    }
    if (key < fromDate) {
      onChange(key, fromDate);
    } else {
      onChange(fromDate, key);
    }
    setPickingEnd(false);
  };

  return (
    <div className="wizard-range-calendar">
      <div className="wizard-range-header">
        <button
          type="button"
          className="icon-button"
          aria-label="Poprzedni miesiąc"
          onClick={() => setViewMonth((current) => addMonths(current, -1))}
        >
          <ChevronLeft size={18} />
        </button>

        <div className="wizard-range-labels">
          {months.map((monthStart, index) => {
            const side: Side = index === 0 ? "left" : "right";
            const monthOpen =
              openPicker?.side === side && openPicker.kind === "month";
            const yearOpen =
              openPicker?.side === side && openPicker.kind === "year";
            return (
              <div key={toDateKey(monthStart)} className="wizard-range-label">
                <div
                  className="wizard-range-month-trigger"
                  onMouseEnter={() => showPicker(side, "month")}
                  onMouseLeave={scheduleClose}
                >
                  <button
                    type="button"
                    className="wizard-range-month-name"
                    aria-expanded={monthOpen}
                    aria-haspopup="listbox"
                    onClick={() => togglePicker(side, "month")}
                  >
                    {monthName(monthStart)}
                  </button>
                  {monthOpen ? (
                    <div
                      className="wizard-month-popover"
                      role="listbox"
                      onMouseEnter={() => showPicker(side, "month")}
                      onMouseLeave={scheduleClose}
                    >
                      {MONTH_NAMES.map((label, monthIndex) => (
                        <button
                          key={label}
                          type="button"
                          role="option"
                          aria-selected={monthStart.getMonth() === monthIndex}
                          className={
                            monthStart.getMonth() === monthIndex
                              ? "is-active"
                              : undefined
                          }
                          onClick={() => selectMonth(side, monthIndex)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div
                  className="wizard-range-year-trigger"
                  onMouseEnter={() => showPicker(side, "year")}
                  onMouseLeave={scheduleClose}
                >
                  <button
                    type="button"
                    className="wizard-range-year"
                    aria-expanded={yearOpen}
                    aria-haspopup="listbox"
                    onClick={() => togglePicker(side, "year")}
                  >
                    {monthStart.getFullYear()}
                  </button>
                  {yearOpen ? (
                    <div
                      className="wizard-month-popover wizard-year-popover"
                      role="listbox"
                      onMouseEnter={() => showPicker(side, "year")}
                      onMouseLeave={scheduleClose}
                    >
                      {yearsAround(monthStart.getFullYear()).map((year) => (
                        <button
                          key={year}
                          type="button"
                          role="option"
                          aria-selected={monthStart.getFullYear() === year}
                          className={
                            monthStart.getFullYear() === year
                              ? "is-active"
                              : undefined
                          }
                          onClick={() => selectYear(side, year)}
                        >
                          {year}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="icon-button"
          aria-label="Następny miesiąc"
          onClick={() => setViewMonth((current) => addMonths(current, 1))}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="wizard-range-months">
        {months.map((monthStart) => {
          const days = daysForMonth(monthStart);
          return (
            <div key={toDateKey(monthStart)} className="wizard-range-month">
              <div className="wizard-range-grid">
                {WEEKDAY_HEADERS.map((label) => (
                  <span key={label} className="wizard-range-dow">
                    {label}
                  </span>
                ))}
                {days.map((day) => {
                  const inMonth = day.getMonth() === monthStart.getMonth();
                  const key = toDateKey(day);
                  const hasRange = Boolean(fromDate && toDate);
                  const isStart = hasRange && key === fromDate;
                  const isEnd = hasRange && key === toDate;
                  const selected = inRange(day, fromDate, toDate);
                  const isToday = sameDay(day, new Date());
                  return (
                    <button
                      key={key + String(inMonth)}
                      type="button"
                      className={[
                        "wizard-range-day",
                        inMonth ? "" : " is-outside",
                        selected ? " is-in-range" : "",
                        isStart || isEnd ? " is-edge" : "",
                        isToday ? " is-today" : "",
                      ].join("")}
                      onClick={() => onPick(day)}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
