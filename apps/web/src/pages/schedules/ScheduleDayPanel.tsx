import { useEffect, useRef, useState } from "react";
import { Clock, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import {
  localTime,
  type AvailabilityEntry,
  type CalendarDayType,
  type Employee,
  type EmploymentTerm,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
  type Shift,
} from "../../api";
import { Button } from "../../components";
import { toDateKey } from "./dateUtils";
import {
  availabilityStatusOf,
  cellLeaves,
  cellShifts,
  contrastInk,
  dayTypeOf,
} from "./scheduleLookups";
import { ScheduleTags } from "./ScheduleTags";
import { ShiftHistoryModal } from "./ShiftHistoryModal";
import { roleLabel } from "../team/roles";

const AVAIL_LABELS: Record<AvailabilityEntry["status"], string> = {
  available: "Dostępny",
  hours: "Wybrane godziny",
  unavailable: "Niedostępny",
};

function shiftDurationLabel(shift: Shift) {
  const start = new Date(shift.started_at).getTime();
  const end = new Date(shift.ended_at).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return "—";
  }
  const hours = Math.round((end - start) / 3_600_000);
  return `${hours}h`;
}

function plannedMinutes(shifts: Shift[]) {
  return shifts.reduce((sum, shift) => {
    if (shift.pending_delete || shift.flags?.pending_delete) return sum;
    const start = new Date(shift.started_at).getTime();
    const end = new Date(shift.ended_at).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return sum;
    }
    return sum + (end - start) / 60_000;
  }, 0);
}

function DayShiftChip({
  shift,
  canPlan,
  onEdit,
  onDelete,
}: {
  shift: Shift;
  canPlan: boolean;
  onEdit: (shift: Shift) => void;
  onDelete: (shift: Shift) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pendingDelete = Boolean(
    shift.pending_delete || shift.flags?.pending_delete,
  );
  const ink = contrastInk(shift.color);
  const editable = canPlan && !pendingDelete;

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  return (
    <li
      className={[
        "day-shift-chip",
        shift.published ? "published" : "draft",
        pendingDelete ? "pending-delete" : "",
        editable ? "is-editable" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        shift.color
          ? {
              backgroundColor: shift.color,
              borderColor: shift.color,
              color: ink,
            }
          : undefined
      }
    >
      <button
        type="button"
        className="day-shift-chip-main"
        disabled={!editable}
        onClick={() => editable && onEdit(shift)}
        aria-label={
          editable
            ? shift.published
              ? "Edytuj grafik (nowa wersja)"
              : "Edytuj grafik"
            : undefined
        }
      >
        <span
          className={`day-shift-check${shift.published ? " is-checked" : ""}`}
          aria-hidden
        />
        <span className="day-shift-times">
          <span className="day-shift-pill">{localTime(shift.started_at)}</span>
          <span className="day-shift-arrow" aria-hidden>
            →
          </span>
          <span className="day-shift-pill">{localTime(shift.ended_at)}</span>
        </span>
        <span className="day-shift-duration">{shiftDurationLabel(shift)}</span>
      </button>
      {canPlan ? (
        <div className="day-shift-kebab" ref={menuRef}>
          <button
            type="button"
            className="day-shift-kebab-btn"
            aria-label="Akcje grafiku"
            aria-expanded={menuOpen}
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((open) => !open);
            }}
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen ? (
            <div className="day-shift-kebab-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(shift);
                }}
              >
                <Trash2 size={14} />
                Usuń
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function ScheduleDayPanel({
  cell,
  canPlan,
  canEditAvailability,
  employees,
  visibleShifts,
  dayTypes,
  availability,
  leaveRequests,
  leaveTypes,
  activeNorm,
  balances,
  onClose,
  onPrevDay,
  onNextDay,
  onAvailability,
  onDayType,
  onAddShift,
  onEditShift,
  onDeleteShift,
  onAddLeave,
}: {
  cell: { employeeId: string; day: Date };
  canPlan: boolean;
  canEditAvailability: boolean;
  employees: Employee[];
  visibleShifts: Shift[];
  dayTypes: CalendarDayType[] | undefined;
  availability: AvailabilityEntry[] | undefined;
  leaveRequests: LeaveRequest[];
  leaveTypes: LeaveType[];
  activeNorm: EmploymentTerm | null;
  balances: LeaveBalance[] | undefined;
  onClose: () => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  onAvailability: (status: AvailabilityEntry["status"]) => void;
  onDayType: (code: CalendarDayType["code"]) => void;
  onAddShift: () => void;
  onEditShift: (shift: Shift) => void;
  onDeleteShift: (shift: Shift) => void;
  onAddLeave: () => void;
}) {
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const employee = employees.find((row) => row.id === cell.employeeId);
  const shifts = cellShifts(visibleShifts, cell.employeeId, cell.day);
  const leaves = cellLeaves(leaveRequests, cell.employeeId, cell.day);
  const availStatus = availabilityStatusOf(
    availability,
    cell.employeeId,
    cell.day,
  );
  const dayTypeCode = dayTypeOf(dayTypes, cell.employeeId, cell.day).code;
  const leaveTypeName = (id: string) =>
    leaveTypes.find((type) => type.id === id)?.name || "Wniosek";
  const initials = employee
    ? `${employee.first_name?.[0] || "?"}${employee.last_name?.[0] || ""}`
    : "?";
  const fullName = employee
    ? `${employee.first_name} ${employee.last_name}`
    : cell.employeeId.slice(0, 8);
  const plannedHours = Math.round(plannedMinutes(shifts) / 60);
  const dayKey = toDateKey(cell.day);

  return (
    <aside
      className={`schedule-day-panel${limitsOpen ? " is-limits-open" : ""}`}
      aria-label="Panel dnia"
    >
      <div className="schedule-day-panel-head">
        <strong className="schedule-day-panel-date">
          {cell.day.toLocaleDateString("pl-PL", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}
        </strong>
        <div className="schedule-day-panel-head-actions">
          <button
            type="button"
            className="icon-button"
            aria-label="Poprzedni dzień"
            onClick={onPrevDay}
          >
            ‹
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Następny dzień"
            onClick={onNextDay}
          >
            ›
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Zamknij panel"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>

      <div className="schedule-day-panel-body">
        <div className="schedule-day-panel-person">
          <span className="avatar">{initials}</span>
          <div className="schedule-day-panel-person-meta">
            <strong>{fullName}</strong>
            <div className="badge-row">
              {(employee?.roles?.length ? employee.roles : ["employee"]).map(
                (code) => (
                  <span className="role-badge" data-role={code} key={code}>
                    {roleLabel(code)}
                  </span>
                ),
              )}
              {employee?.tags?.length ? (
                <ScheduleTags tags={employee.tags} />
              ) : null}
            </div>
          </div>
        </div>

        <div className="schedule-day-panel-field">
          <span className="schedule-day-panel-label">Dostępność</span>
          {canEditAvailability ? (
            <select
              className={`schedule-day-avail-select avail-${availStatus}`}
              value={availStatus}
              onChange={(event) =>
                onAvailability(
                  event.target.value as AvailabilityEntry["status"],
                )
              }
              aria-label="Dostępność"
            >
              <option value="available">{AVAIL_LABELS.available}</option>
              <option value="hours">{AVAIL_LABELS.hours}</option>
              <option value="unavailable">{AVAIL_LABELS.unavailable}</option>
            </select>
          ) : (
            <div className={`schedule-day-avail-bar avail-${availStatus}`}>
              {AVAIL_LABELS[availStatus]}
              {canPlan ? (
                <span className="schedule-day-avail-hint">sugestia</span>
              ) : null}
            </div>
          )}
        </div>
        {canPlan ? (
          <div className="schedule-day-panel-field">
            <span className="schedule-day-panel-label">Typ dnia</span>
            <select
              className="schedule-day-type-select"
              value={dayTypeCode}
              onChange={(event) =>
                onDayType(event.target.value as CalendarDayType["code"])
              }
              aria-label="Typ dnia"
            >
              <option value="P">P — 5-dniowy tydzień pracy</option>
              <option value="ND">ND — za niedzielę</option>
              <option value="SW">ŚW — za święto</option>
              <option value="TP5">5TP — wolne (5-dniowy tydzień)</option>
              <option value="HW">HW — harmonogramowo wolne</option>
            </select>
          </div>
        ) : (
          <div className="schedule-day-panel-field">
            <span className="schedule-day-panel-label">Typ dnia</span>
            <div className="schedule-day-avail-bar">{dayTypeCode}</div>
          </div>
        )}

        <div className="schedule-day-panel-section">
          <h3>Grafiki pracy</h3>
          <div className="schedule-day-norm-row">
            <span>Norma</span>
            <strong>
              {activeNorm
                ? `${Math.round(activeNorm.daily_minutes / 60)}h`
                : "—"}
            </strong>
          </div>
          {shifts.length > 0 ? (
            <ul className="day-shift-chips">
              {shifts.map((shift) => (
                <DayShiftChip
                  key={shift.id}
                  shift={shift}
                  canPlan={canPlan}
                  onEdit={onEditShift}
                  onDelete={onDeleteShift}
                />
              ))}
            </ul>
          ) : null}
          <div className="schedule-day-norm-row">
            <span>Zaplanowany czas</span>
            <strong>{`${plannedHours}h`}</strong>
          </div>
          {canPlan ? (
            <div className="schedule-day-shift-actions">
              <Button type="button" variant="quiet" size="small" onClick={onAddShift}>
                <Plus size={14} />
                Dodaj grafik pracy
              </Button>
              <Button
                type="button"
                variant="quiet"
                size="small"
                onClick={() => setHistoryOpen(true)}
              >
                <Clock size={14} aria-hidden />
                Pokaż historię
              </Button>
            </div>
          ) : null}
        </div>

        <div className="schedule-day-panel-section">
          <h3>Wnioski</h3>
          {leaves.length > 0 ? (
            <ul className="day-shift-list">
              {leaves.map((leave) => (
                <li key={leave.id}>
                  <strong>{leaveTypeName(leave.leave_type_id)}</strong>
                  <span
                    className={`table-status ${leave.status === "approved" ? "active" : "open"}`}
                  >
                    {leave.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {canPlan ? (
            <Button type="button" variant="quiet" size="small" onClick={onAddLeave}>
              <Plus size={14} />
              Dodaj wniosek
            </Button>
          ) : null}
        </div>

        {balances && balances.length > 0 ? (
          <div className="schedule-day-panel-section schedule-day-limits">
            <div className="panel-section-head">
              <h3>Limity wniosków i zużycie</h3>
              <button
                type="button"
                className="text-button"
                onClick={() => setLimitsOpen((open) => !open)}
                aria-expanded={limitsOpen}
              >
                {limitsOpen ? "Zwiń" : "Rozwiń"}
              </button>
            </div>
            {!limitsOpen ? (
              <p className="subtle schedule-day-limits-summary">
                Wnioski urlopowe · {balances.length}{" "}
                {balances.length === 1 ? "limit" : "limitów"}
              </p>
            ) : (
              <ul className="schedule-day-limits-list">
                {balances.map((row) => {
                  const code =
                    row.leave_type_code ||
                    leaveTypes.find((type) => type.id === row.leave_type_id)
                      ?.code ||
                    "—";
                  const name =
                    row.leave_type_name || leaveTypeName(row.leave_type_id);
                  const usage = row.unlimited
                    ? "∞"
                    : `${row.used_days}d/${row.granted_days}d`;
                  return (
                    <li key={row.id} title={`${name}: ${usage}`}>
                      <span className="schedule-day-limit-code">{code}</span>
                      <span className="schedule-day-limit-name">{name}</span>
                      <span className="schedule-day-limit-usage">{usage}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>
      {historyOpen ? (
        <ShiftHistoryModal
          employeeId={cell.employeeId}
          dayKey={dayKey}
          onClose={() => setHistoryOpen(false)}
        />
      ) : null}
    </aside>
  );
}
