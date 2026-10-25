import { useState } from "react";
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
import { KIND_LABELS } from "./dateUtils";
import {
  availabilityStatusOf,
  cellLeaves,
  cellShifts,
  dayTypeOf,
} from "./scheduleLookups";
import { ScheduleTags } from "./ScheduleTags";
import { roleLabel } from "../team/roles";

const AVAIL_LABELS: Record<AvailabilityEntry["status"], string> = {
  available: "Dostępny",
  hours: "Wybrane godziny",
  unavailable: "Niedostępny",
};

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
  onAddLeave: () => void;
}) {
  const [limitsOpen, setLimitsOpen] = useState(false);
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
            <ul className="day-shift-list">
              {shifts.map((shift) => (
                <li key={shift.id}>
                  <strong>{KIND_LABELS[shift.kind]}</strong>
                  <span>
                    {localTime(shift.started_at)}–{localTime(shift.ended_at)}
                  </span>
                  <span
                    className={`table-status ${shift.published ? "active" : "open"}`}
                  >
                    {shift.published ? "Opublikowany" : "Szkic"}
                  </span>
                  {canPlan && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => onEditShift(shift)}
                    >
                      {shift.published ? "Nowa wersja" : "Edytuj"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          {canPlan && (
            <button type="button" className="text-button" onClick={onAddShift}>
              + Dodaj grafik pracy
            </button>
          )}
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
          {canPlan && (
            <button type="button" className="text-button" onClick={onAddLeave}>
              + Dodaj wniosek
            </button>
          )}
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
    </aside>
  );
}
