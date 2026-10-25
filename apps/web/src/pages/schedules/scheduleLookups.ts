import type {
  AvailabilityEntry,
  CalendarDayType,
  Employee,
  LeaveRequest,
  Shift,
} from "../../api";
import { addDays, toDateKey } from "./dateUtils";
import type { ScheduleViewTab } from "./scheduleViewTab";

export function shiftsForTargets(list: Shift[], targetEmployeeIds: string[]) {
  return list.filter((shift) => targetEmployeeIds.includes(shift.employee_id));
}

export function cellShifts(
  visibleShifts: Shift[],
  employeeId: string,
  day: Date,
) {
  const dayStart = day.getTime();
  const dayEnd = addDays(day, 1).getTime();
  return visibleShifts.filter((shift) => {
    if (shift.employee_id !== employeeId) return false;
    const start = new Date(shift.started_at).getTime();
    const end = new Date(shift.ended_at).getTime();
    return start < dayEnd && end > dayStart;
  });
}

/** Pn–Pt = P, sobota = 5TP, niedziela = ND — jak w API `default_day_type_code`. */
export function defaultDayTypeCode(day: Date): CalendarDayType["code"] {
  const weekday = day.getDay(); // 0=Sun … 6=Sat
  if (weekday === 0) return "ND";
  if (weekday === 6) return "TP5";
  return "P";
}

export function dayTypeOf(
  dayTypes: CalendarDayType[] | undefined,
  employeeId: string,
  day: Date,
): Pick<CalendarDayType, "code"> {
  const stored = dayTypes?.find(
    (row) => row.employee_id === employeeId && row.day === toDateKey(day),
  );
  if (stored) return stored;
  return { code: defaultDayTypeCode(day) };
}

export function availabilityOf(
  availability: AvailabilityEntry[] | undefined,
  employeeId: string,
  day: Date,
) {
  return availability?.find(
    (row) => row.employee_id === employeeId && row.day === toDateKey(day),
  );
}

/** Brak wpisu = dostępny (domyślnie). */
export function availabilityStatusOf(
  availability: AvailabilityEntry[] | undefined,
  employeeId: string,
  day: Date,
): AvailabilityEntry["status"] {
  return availabilityOf(availability, employeeId, day)?.status || "available";
}

export function nameOf(employees: Employee[], id: string) {
  const employee = employees.find((row) => row.id === id);
  return employee
    ? `${employee.first_name} ${employee.last_name}`
    : id.slice(0, 8);
}

export function selectedEmployeesLabel(selectedCount: number) {
  const selectedMod10 = selectedCount % 10;
  const selectedMod100 = selectedCount % 100;
  if (selectedCount === 1) return "1 zaznaczony";
  if (
    selectedMod10 >= 2 &&
    selectedMod10 <= 4 &&
    (selectedMod100 < 10 || selectedMod100 >= 20)
  ) {
    return `${selectedCount} zaznaczone`;
  }
  return `${selectedCount} zaznaczonych`;
}

export function cellLeaves(
  requests: LeaveRequest[] | undefined,
  employeeId: string,
  day: Date,
) {
  const key = toDateKey(day);
  return (requests || []).filter(
    (row) =>
      row.employee_id === employeeId &&
      row.start_date <= key &&
      row.end_date >= key,
  );
}

export function leavesInRange(
  requests: LeaveRequest[] | undefined,
  fromKey: string,
  toKey: string,
  leaveTypeFilter: string,
) {
  return (requests || []).filter((row) => {
    if (leaveTypeFilter && row.leave_type_id !== leaveTypeFilter) return false;
    return row.start_date <= toKey && row.end_date >= fromKey;
  });
}

export function availabilityClass(
  status: AvailabilityEntry["status"] | undefined,
) {
  if (!status) return "";
  if (status === "available") return " avail-available";
  if (status === "unavailable") return " avail-unavailable";
  if (status === "hours") return " avail-hours";
  return "";
}

export function showShiftsInTab(tab: ScheduleViewTab) {
  return tab === "all" || tab === "shifts";
}

export function showLeavesInTab(tab: ScheduleViewTab) {
  return tab === "all" || tab === "leaves";
}

export function showAvailabilityInTab(tab: ScheduleViewTab) {
  return tab === "all" || tab === "availability";
}

export function showDayTypesInTab(tab: ScheduleViewTab) {
  return tab === "all" || tab === "availability";
}
