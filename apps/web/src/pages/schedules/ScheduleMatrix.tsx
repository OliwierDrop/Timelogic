import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type UIEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  localTime,
  type AvailabilityEntry,
  type CalendarDayType,
  type Employee,
  type LeaveRequest,
  type LeaveType,
  type Shift,
} from "../../api";
import { Empty, Message } from "../../components";
import { roleLabel } from "../team/roles";
import { DAY_TYPE_LABELS, KIND_LABELS, sameDay } from "./dateUtils";
import { polishHolidayName } from "./polishHolidays";
import { ScheduleCellActions } from "./ScheduleCellActions";
import { ScheduleChipActions } from "./ScheduleChipActions";
import { ScheduleTags } from "./ScheduleTags";
import {
  availabilityClass,
  availabilityStatusOf,
  cellLeaves,
  cellShifts,
  contrastInk,
  dayTypeOf,
  showAvailabilityInTab,
  showDayTypesInTab,
  showLeavesInTab,
  showShiftsInTab,
} from "./scheduleLookups";
import type { ScheduleViewTab } from "./scheduleViewTab";

export function ScheduleMatrix({
  loading,
  error,
  canPlan,
  viewTab,
  days,
  employees,
  visibleShifts,
  dayTypes,
  availability,
  leaveRequests,
  leaveTypes,
  selectedEmployeeIds,
  selectedCell,
  onToggleEmployee,
  onToggleAll,
  onSelectCell,
  onAddShift,
  onAddLeave,
  onEditShift,
  onDeleteShift,
}: {
  loading: boolean;
  error: boolean;
  canPlan: boolean;
  viewTab: ScheduleViewTab;
  days: Date[];
  employees: Employee[];
  visibleShifts: Shift[];
  dayTypes: CalendarDayType[] | undefined;
  availability: AvailabilityEntry[] | undefined;
  leaveRequests: LeaveRequest[];
  leaveTypes: LeaveType[];
  selectedEmployeeIds: string[];
  selectedCell: { employeeId: string; day: Date } | null;
  onToggleEmployee: (id: string) => void;
  onToggleAll: () => void;
  onSelectCell: (employeeId: string, day: Date) => void;
  onAddShift: (employeeId: string, day: Date) => void;
  onAddLeave: (employeeId: string, day: Date) => void;
  onEditShift: (shift: Shift, employeeId: string, day: Date) => void;
  onDeleteShift: (shift: Shift) => void;
}) {
  const showShifts = showShiftsInTab(viewTab);
  const showLeaves = showLeavesInTab(viewTab);
  const showAvailability = showAvailabilityInTab(viewTab);
  const showDayTypes = showDayTypesInTab(viewTab);
  const leaveTypeName = (id: string) =>
    leaveTypes.find((type) => type.id === id)?.name || "Wniosek";
  const matrixWrapRef = useRef<HTMLDivElement>(null);
  const hscrollRef = useRef<HTMLDivElement>(null);
  const scrollSyncLock = useRef(false);
  const [hscrollMetrics, setHscrollMetrics] = useState({
    left: 0,
    width: 0,
    scrollWidth: 0,
    visible: false,
  });

  const showMatrix = !loading && !error && employees.length > 0;

  const allEmployeesSelected =
    employees.length > 0 &&
    employees.every((row) => selectedEmployeeIds.includes(row.id));

  useLayoutEffect(() => {
    if (!showMatrix) {
      setHscrollMetrics((prev) =>
        prev.visible
          ? { left: 0, width: 0, scrollWidth: 0, visible: false }
          : prev,
      );
      return;
    }
    const wrap = matrixWrapRef.current;
    if (!wrap) return;

    const update = () => {
      const rect = wrap.getBoundingClientRect();
      const next = {
        left: rect.left,
        width: rect.width,
        scrollWidth: wrap.scrollWidth,
        visible: wrap.scrollWidth > rect.width + 1,
      };
      setHscrollMetrics((prev) =>
        prev.left === next.left &&
        prev.width === next.width &&
        prev.scrollWidth === next.scrollWidth &&
        prev.visible === next.visible
          ? prev
          : next,
      );
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    if (wrap.firstElementChild) ro.observe(wrap.firstElementChild);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [showMatrix, days.length, employees.length, selectedCell]);

  useLayoutEffect(() => {
    if (!hscrollMetrics.visible) return;
    const wrap = matrixWrapRef.current;
    const bar = hscrollRef.current;
    if (wrap && bar) bar.scrollLeft = wrap.scrollLeft;
  }, [hscrollMetrics.visible, hscrollMetrics.scrollWidth]);

  const syncScroll = (source: "wrap" | "bar") => {
    const wrap = matrixWrapRef.current;
    const bar = hscrollRef.current;
    if (!wrap || !bar || scrollSyncLock.current) return;
    scrollSyncLock.current = true;
    if (source === "wrap") bar.scrollLeft = wrap.scrollLeft;
    else wrap.scrollLeft = bar.scrollLeft;
    scrollSyncLock.current = false;
  };

  const onMatrixScroll = (event: UIEvent<HTMLDivElement>) => {
    void event;
    syncScroll("wrap");
  };

  const onHscrollScroll = (event: UIEvent<HTMLDivElement>) => {
    void event;
    syncScroll("bar");
  };

  if (loading) {
    return <p className="subtle">Ładowanie grafiku…</p>;
  }
  if (error) {
    return <Message>Nie udało się pobrać grafiku.</Message>;
  }
  if (!employees.length) {
    return (
      <Empty title="Brak pracowników">Dodaj osoby w module Zespół.</Empty>
    );
  }

  return (
    <>
      <div
        className="schedule-matrix-wrap"
        ref={matrixWrapRef}
        onScroll={onMatrixScroll}
      >
        <div
          className="schedule-holiday-rail"
          style={
            {
              "--schedule-days": days.length,
            } as CSSProperties
          }
          aria-hidden
        >
          <div className="schedule-holiday-rail-cell schedule-holiday-rail-spacer" />
          {days.map((day) => {
            const holiday = polishHolidayName(day);
            return (
              <div
                key={`hol-${day.toISOString()}`}
                className="schedule-holiday-rail-cell"
              >
                {holiday ? (
                  <span className="schedule-holiday-label" title={holiday}>
                    {holiday}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="schedule-matrix-board">
          <div
            className="schedule-matrix"
            style={
              {
                "--schedule-days": days.length,
              } as CSSProperties
            }
            role="grid"
            aria-label="Grafik pracy"
          >
          <div
            className="schedule-name-col schedule-name-head"
            role="columnheader"
          >
            <div className="schedule-person-head">
              {canPlan && (
                <input
                  type="checkbox"
                  className="schedule-check"
                  checked={allEmployeesSelected}
                  onChange={onToggleAll}
                  aria-label="Zaznacz wszystkich pracowników"
                />
              )}
              <span>Imię i nazwisko, rola i tagi</span>
            </div>
          </div>
          {days.map((day) => {
            const holiday = polishHolidayName(day);
            const weekend = day.getDay() === 0 || day.getDay() === 6;
            return (
              <div
                key={`h-${day.toISOString()}`}
                className={`schedule-day-head${weekend ? " weekend" : ""}${holiday ? " is-holiday" : ""}`}
                role="columnheader"
                title={holiday || undefined}
              >
                <span className="schedule-day-weekday">
                  {day.toLocaleDateString("pl-PL", { weekday: "short" })}
                </span>
                <span className="schedule-day-date">
                  {day.toLocaleDateString("pl-PL", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
            );
          })}
          {employees.map((employee) => {
            const rowSelected = selectedEmployeeIds.includes(employee.id);
            const hasUnpublished = visibleShifts.some(
              (shift) =>
                shift.employee_id === employee.id && !shift.published,
            );
            const rowClass = [
              rowSelected ? "is-selected" : "",
              hasUnpublished ? "has-unpublished" : "",
            ]
              .filter(Boolean)
              .map((cls) => ` ${cls}`)
              .join("");
            return (
              <div key={employee.id} className="schedule-row" role="row">
                <div
                  className={`schedule-name-col${rowClass}`}
                  role="rowheader"
                >
                  <div className="schedule-person-cell">
                    {canPlan && (
                      <input
                        type="checkbox"
                        className="schedule-check"
                        checked={rowSelected}
                        onChange={() => onToggleEmployee(employee.id)}
                        aria-label={`Zaznacz ${employee.first_name} ${employee.last_name}`}
                      />
                    )}
                    <span className="avatar">
                      {employee.first_name?.[0] || "?"}
                      {employee.last_name?.[0] || ""}
                    </span>
                    <div className="schedule-person-meta">
                      <strong>
                        {employee.first_name} {employee.last_name}
                      </strong>
                      <div className="badge-row">
                        {(employee.roles?.length
                          ? employee.roles
                          : ["employee"]
                        ).map((code) => (
                          <span className="role-badge" data-role={code} key={code}>
                            {roleLabel(code)}
                          </span>
                        ))}
                        {employee.tags?.length ? (
                          <ScheduleTags tags={employee.tags} />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
                {days.map((day) => {
                  const items = showShifts
                    ? cellShifts(visibleShifts, employee.id, day)
                    : [];
                  const leaves = showLeaves
                    ? cellLeaves(leaveRequests, employee.id, day)
                    : [];
                  const marker = showDayTypes
                    ? dayTypeOf(dayTypes, employee.id, day)
                    : undefined;
                  const availStatus = showAvailability
                    ? availabilityStatusOf(availability, employee.id, day)
                    : undefined;
                  const selected =
                    selectedCell &&
                    selectedCell.employeeId === employee.id &&
                    sameDay(selectedCell.day, day);
                  const weekend =
                    day.getDay() === 0 || day.getDay() === 6 ? " weekend" : "";
                  const holiday = polishHolidayName(day)
                    ? " is-holiday"
                    : "";
                  return (
                    <div
                      key={`${employee.id}-${day.toISOString()}`}
                      className={`schedule-cell${rowClass}${selected ? " selected" : ""}${weekend}${holiday}${availabilityClass(availStatus)}`}
                      role="gridcell"
                      onClick={() => onSelectCell(employee.id, day)}
                    >
                      {marker && items.length === 0 ? (
                        <span className="day-type-badge">
                          {DAY_TYPE_LABELS[marker.code] || marker.code}
                        </span>
                      ) : null}
                      {items.map((shift) => {
                        const pendingDelete = Boolean(
                          shift.pending_delete || shift.flags?.pending_delete,
                        );
                        const ink = contrastInk(shift.color);
                        return (
                          <div
                            key={shift.id}
                            className={[
                              "schedule-chip",
                              shift.published ? "published" : "draft",
                              pendingDelete ? "pending-delete" : "",
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
                            <span>
                              <span
                                className={
                                  pendingDelete
                                    ? "schedule-chip-time is-removed"
                                    : "schedule-chip-time"
                                }
                              >
                                {localTime(shift.started_at)}–
                                {localTime(shift.ended_at)}
                              </span>
                              {shift.kind !== "standard" ? (
                                <small>
                                  {KIND_LABELS[shift.kind] || shift.kind}
                                </small>
                              ) : null}
                              {pendingDelete ? <small>Usunięcie</small> : null}
                            </span>
                            {canPlan ? (
                              <ScheduleChipActions
                                showEdit={!pendingDelete}
                                onEdit={() =>
                                  onEditShift(shift, employee.id, day)
                                }
                                onDelete={() => onDeleteShift(shift)}
                              />
                            ) : null}
                          </div>
                        );
                      })}
                      {leaves.map((leave) => (
                        <span
                          key={leave.id}
                          className={`schedule-leave-chip${leave.status === "pending" ? " is-pending" : ""}`}
                          title={leaveTypeName(leave.leave_type_id)}
                        >
                          {leaveTypeName(leave.leave_type_id)}
                        </span>
                      ))}
                      {canPlan ? (
                        <ScheduleCellActions
                          showShift={showShifts}
                          showLeave={showLeaves}
                          onAddShift={() => onAddShift(employee.id, day)}
                          onAddLeave={() => onAddLeave(employee.id, day)}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
          </div>
        </div>
      </div>
      {hscrollMetrics.visible
        ? createPortal(
            <div
              className="schedule-hscroll"
              ref={hscrollRef}
              style={{
                left: hscrollMetrics.left,
                width: hscrollMetrics.width,
              }}
              onScroll={onHscrollScroll}
              aria-hidden
            >
              <div
                className="schedule-hscroll-spacer"
                style={{ width: hscrollMetrics.scrollWidth }}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
