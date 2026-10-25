import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import {
  api,
  ApiError,
  type AvailabilityEntry,
  type CalendarDayType,
  type Employee,
  type EmploymentTerm,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
  type Position,
  type Shift,
  type Tag,
  type User,
} from "../api";
import { Message } from "../components";
import { useSetFilterSidebar } from "../layout/filterSidebarContext";
import { PageHeading } from "../layout/PageHeading";
import { BulkWizard } from "./schedules/BulkWizard";
import {
  addDays,
  addMonths,
  daysInRange,
  parseDateKey,
  rangeLabel,
  startOfMonth,
  startOfWeek,
  toDateKey,
} from "./schedules/dateUtils";
import { ScheduleDayPanel } from "./schedules/ScheduleDayPanel";
import { ScheduleFilters } from "./schedules/ScheduleFilters";
import { ScheduleHeadingActions } from "./schedules/ScheduleHeadingActions";
import { ScheduleLeaveModal } from "./schedules/ScheduleLeaveModal";
import { ScheduleMatrix } from "./schedules/ScheduleMatrix";
import { ScheduleViewTabs } from "./schedules/ScheduleViewTabs";
import {
  leavesInRange,
  nameOf,
  selectedEmployeesLabel,
} from "./schedules/scheduleLookups";
import type { ScheduleViewTab } from "./schedules/scheduleViewTab";
import {
  defaultShiftValues,
  ShiftFormModal,
  type ShiftFormValues,
  valuesFromShift,
} from "./schedules/ShiftFormModal";
import { useScheduleMutations } from "./schedules/useScheduleMutations";

export function SchedulesPage() {
  const { user } = useOutletContext<{ user: User }>();
  const canPlan = user.roles.some((r) =>
    ["manager", "hr", "admin"].includes(r),
  );
  const [viewTab, setViewTab] = useState<ScheduleViewTab>("all");
  const [mode, setMode] = useState<"week" | "month">("month");
  const [anchor, setAnchor] = useState(() => startOfMonth(new Date()));
  const [search, setSearch] = useState("");
  const [draftOnly, setDraftOnly] = useState(false);
  const [kindFilter, setKindFilter] = useState<"all" | Shift["kind"]>("all");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [cell, setCell] = useState<{ employeeId: string; day: Date } | null>(
    null,
  );
  const [shiftForm, setShiftForm] = useState<ShiftFormValues | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [copyTarget, setCopyTarget] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [leaveReason, setLeaveReason] = useState("");

  const rangeStart =
    mode === "week" ? startOfWeek(anchor, "monday") : startOfMonth(anchor);
  const days = daysInRange(mode, rangeStart);
  const rangeEnd = addDays(days[days.length - 1], 1);
  const fromIso = rangeStart.toISOString();
  const toIso = rangeEnd.toISOString();
  const fromKey = toDateKey(rangeStart);
  const toKey = toDateKey(days[days.length - 1]);

  const shifts = useQuery({
    queryKey: ["shifts", fromIso, toIso, canPlan],
    queryFn: () =>
      api<Shift[]>(
        `/shifts?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}${canPlan ? "&include_drafts=true" : ""}`,
      ),
  });
  const employees = useQuery({
    queryKey: ["employees", "shifts"],
    queryFn: () => api<Employee[]>("/employees"),
    enabled: canPlan,
  });
  const tags = useQuery({
    queryKey: ["tags"],
    queryFn: () => api<Tag[]>("/tags"),
    enabled: canPlan,
  });
  const positions = useQuery({
    queryKey: ["positions"],
    queryFn: () => api<Position[]>("/positions"),
    enabled: canPlan,
  });
  const dayTypes = useQuery({
    queryKey: ["day-types", fromKey, toKey],
    queryFn: () =>
      api<CalendarDayType[]>(`/calendar/day-types?from=${fromKey}&to=${toKey}`),
  });
  const availability = useQuery({
    queryKey: ["availability", fromKey, toKey],
    queryFn: () =>
      api<AvailabilityEntry[]>(
        `/calendar/availability?from=${fromKey}&to=${toKey}`,
      ),
  });
  const leaveTypes = useQuery({
    queryKey: ["leave-types"],
    queryFn: () => api<LeaveType[]>("/leave-types"),
  });
  const leaveRequests = useQuery({
    queryKey: ["leave-requests", "calendar"],
    queryFn: () => api<LeaveRequest[]>("/leave-requests?limit=200"),
  });
  const cellTerms = useQuery({
    queryKey: ["employment-terms", cell?.employeeId],
    queryFn: () =>
      api<EmploymentTerm[]>(`/employees/${cell!.employeeId}/employment-terms`),
    enabled: Boolean(cell?.employeeId && canPlan),
  });
  const cellBalances = useQuery({
    queryKey: ["leave-balances", cell?.employeeId],
    queryFn: () =>
      api<LeaveBalance[]>(
        `/leave-balances?year=${rangeStart.getFullYear()}&employee_id=${cell!.employeeId}`,
      ),
    enabled: Boolean(cell?.employeeId),
  });

  const employeeRows = useMemo(() => {
    if (!canPlan) {
      if (!user.employee_id) return [];
      return [
        {
          id: user.employee_id,
          first_name: "Twój",
          last_name: "grafik",
          roles: [] as string[],
        } as Employee,
      ];
    }
    const query = search.trim().toLowerCase();
    return (employees.data || []).filter((row) => {
      if (tagFilter && !row.tag_ids?.includes(tagFilter)) return false;
      if (positionFilter && row.position_id !== positionFilter) return false;
      if (query) {
        const haystack =
          `${row.first_name} ${row.last_name} ${row.email || ""} ${row.employee_number || ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [
    canPlan,
    employees.data,
    user.employee_id,
    tagFilter,
    positionFilter,
    search,
  ]);

  const drafts = shifts.data?.filter((shift) => !shift.published) || [];
  const visibleShifts = (shifts.data || []).filter((shift) => {
    if (draftOnly && shift.published) return false;
    if (kindFilter !== "all" && shift.kind !== kindFilter) return false;
    return true;
  });

  const visibleLeaves = useMemo(
    () =>
      leavesInRange(
        leaveRequests.data,
        fromKey,
        toKey,
        leaveTypeFilter,
      ),
    [leaveRequests.data, fromKey, toKey, leaveTypeFilter],
  );

  const targetEmployeeIds = useMemo(
    () =>
      selectedEmployeeIds.length
        ? selectedEmployeeIds
        : employeeRows.map((row) => row.id),
    [selectedEmployeeIds, employeeRows],
  );

  const mutations = useScheduleMutations({
    fromIso,
    toIso,
    fromKey,
    toKey,
    cell,
    selectedEmployeeIds,
    targetEmployeeIds,
    visibleShifts,
    copyTarget,
    leaveTypeId,
    leaveReason,
    onSavedShift: () => setShiftForm(null),
    onBulkDone: () => setBulkOpen(false),
    onActionsDone: () => setActionsOpen(false),
    onCopyDone: () => {
      setActionsOpen(false);
      setCopyTarget("");
    },
    onLeaveDone: () => {
      setLeaveOpen(false);
      setLeaveReason("");
    },
  });

  const openCreate = (employeeId: string, day: Date, existing?: Shift) => {
    if (existing) setShiftForm(valuesFromShift(existing, day));
    else setShiftForm(defaultShiftValues(employeeId, day));
  };

  const openLeave = (employeeId: string, day: Date) => {
    setCell({ employeeId, day });
    setLeaveTypeId(leaveTypes.data?.[0]?.id || "");
    setLeaveOpen(true);
  };

  const navigate = (delta: number) => {
    setAnchor((current) =>
      mode === "week" ? addDays(current, delta * 7) : addMonths(current, delta),
    );
  };

  const activeNorm =
    cellTerms.data
      ?.slice()
      .reverse()
      .find((term) => term.effective_from <= toDateKey(cell?.day || new Date())) ||
    null;

  useSetFilterSidebar(
    () => (
      <ScheduleFilters
        canPlan={canPlan}
        viewTab={viewTab}
        search={search}
        mode={mode}
        draftOnly={draftOnly}
        kindFilter={kindFilter}
        leaveTypeFilter={leaveTypeFilter}
        tagFilter={tagFilter}
        positionFilter={positionFilter}
        tags={tags.data || []}
        positions={positions.data || []}
        leaveTypes={leaveTypes.data || []}
        onSearch={setSearch}
        onMode={(value) => {
          setMode(value);
          setAnchor((current) =>
            value === "week"
              ? startOfWeek(current, "monday")
              : startOfMonth(current),
          );
        }}
        onNavigate={navigate}
        onDraftOnly={setDraftOnly}
        onKindFilter={setKindFilter}
        onLeaveTypeFilter={setLeaveTypeFilter}
        onTagFilter={setTagFilter}
        onPositionFilter={setPositionFilter}
      />
    ),
    [
      canPlan,
      viewTab,
      search,
      draftOnly,
      kindFilter,
      leaveTypeFilter,
      mode,
      tagFilter,
      positionFilter,
      tags.data,
      positions.data,
      leaveTypes.data,
    ],
  );

  const selectedCount = selectedEmployeeIds.length;
  const showMatrix = Boolean(
    !shifts.isPending &&
      !(canPlan && employees.isPending) &&
      !shifts.isError &&
      employeeRows.length,
  );

  const actionError =
    mutations.publish.error ||
    mutations.rejectDrafts.error ||
    mutations.deleteShifts.error ||
    mutations.bulk.error ||
    mutations.copy.error;

  return (
    <div className={showMatrix ? "schedule-page-pad" : undefined}>
      <PageHeading
        title="Kalendarz"
        titleAside={
          <span className="schedule-range-badge">
            {rangeLabel(mode, rangeStart)}
          </span>
        }
        meta={
          canPlan ? (
            <p className="schedule-selection-meta">
              <span>{selectedEmployeesLabel(selectedCount)}</span>
              {selectedCount > 0 && (
                <>
                  <span className="schedule-selection-sep" aria-hidden>
                    |
                  </span>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setSelectedEmployeeIds([])}
                  >
                    Odznacz
                  </button>
                </>
              )}
            </p>
          ) : undefined
        }
        action={
          canPlan ? (
            <ScheduleHeadingActions
              viewTab={viewTab}
              employees={employeeRows}
              drafts={drafts}
              selectedEmployeeIds={selectedEmployeeIds}
              targetEmployeeIds={targetEmployeeIds}
              actionsOpen={actionsOpen}
              copyTarget={copyTarget}
              publishPending={mutations.publish.isPending}
              copyPending={mutations.copy.isPending}
              onToggleActions={() => setActionsOpen((open) => !open)}
              onPublish={(ids) => mutations.publish.mutate(ids)}
              onRejectDrafts={() => mutations.rejectDrafts.mutate()}
              onDeleteShifts={() => mutations.deleteShifts.mutate()}
              onCopyTarget={setCopyTarget}
              onCopy={() => mutations.copy.mutate()}
              onResetDayTypes={() => mutations.resetDayTypes.mutate()}
              onOpenBulk={() => setBulkOpen(true)}
              onAddShift={() =>
                openCreate(employeeRows[0]?.id || "", days[0] || new Date())
              }
              onAddLeave={() => {
                const employeeId =
                  selectedEmployeeIds[0] || employeeRows[0]?.id || "";
                openLeave(employeeId, days[0] || new Date());
              }}
            />
          ) : undefined
        }
      />
      <ScheduleViewTabs value={viewTab} onChange={setViewTab} />
      {actionError && (
        <Message>{(actionError as ApiError).message}</Message>
      )}
      <div className="schedule-layout">
        <div className="schedule-calendar">
          <ScheduleMatrix
            loading={
              shifts.isPending || Boolean(canPlan && employees.isPending)
            }
            error={shifts.isError}
            canPlan={canPlan}
            viewTab={viewTab}
            days={days}
            employees={employeeRows}
            visibleShifts={visibleShifts}
            dayTypes={dayTypes.data}
            availability={availability.data}
            leaveRequests={visibleLeaves}
            leaveTypes={leaveTypes.data || []}
            selectedEmployeeIds={selectedEmployeeIds}
            selectedCell={cell}
            onToggleEmployee={(id) =>
              setSelectedEmployeeIds((current) =>
                current.includes(id)
                  ? current.filter((item) => item !== id)
                  : [...current, id],
              )
            }
            onToggleAll={() => {
              const allSelected =
                employeeRows.length > 0 &&
                employeeRows.every((row) =>
                  selectedEmployeeIds.includes(row.id),
                );
              setSelectedEmployeeIds(
                allSelected ? [] : employeeRows.map((row) => row.id),
              );
            }}
            onSelectCell={(employeeId, day) => setCell({ employeeId, day })}
            onAddShift={(employeeId, day) => openCreate(employeeId, day)}
            onAddLeave={(employeeId, day) => openLeave(employeeId, day)}
          />
        </div>
        {cell && (
          <ScheduleDayPanel
            cell={cell}
            canPlan={canPlan}
            canEditAvailability={
              Boolean(user.employee_id) &&
              user.employee_id === cell.employeeId
            }
            employees={employeeRows}
            visibleShifts={visibleShifts}
            dayTypes={dayTypes.data}
            availability={availability.data}
            leaveRequests={visibleLeaves}
            leaveTypes={leaveTypes.data || []}
            activeNorm={activeNorm}
            balances={cellBalances.data}
            onClose={() => setCell(null)}
            onPrevDay={() =>
              setCell({
                employeeId: cell.employeeId,
                day: addDays(cell.day, -1),
              })
            }
            onNextDay={() =>
              setCell({
                employeeId: cell.employeeId,
                day: addDays(cell.day, 1),
              })
            }
            onAvailability={(status) =>
              mutations.putAvailability.mutate(status)
            }
            onDayType={(code) => mutations.putDayType.mutate(code)}
            onAddShift={() => openCreate(cell.employeeId, cell.day)}
            onEditShift={(shift) =>
              openCreate(cell.employeeId, cell.day, shift)
            }
            onAddLeave={() => openLeave(cell.employeeId, cell.day)}
          />
        )}
      </div>
      {shiftForm && canPlan && (
        <ShiftFormModal
          key={`${shiftForm.edit_id || "new"}-${shiftForm.replaces_id || ""}-${shiftForm.day}`}
          employees={employeeRows}
          initial={shiftForm}
          title={
            shiftForm.edit_id
              ? "Edytuj szkic"
              : shiftForm.replaces_id
                ? "Nowa wersja grafiku"
                : "Dodaj grafik pracy"
          }
          busy={mutations.saveShift.isPending}
          error={
            mutations.saveShift.isError
              ? (mutations.saveShift.error as ApiError).message
              : null
          }
          onClose={() => setShiftForm(null)}
          onSave={(values) => mutations.saveShift.mutate(values)}
        />
      )}
      {bulkOpen && canPlan && (
        <BulkWizard
          employees={employeeRows}
          fromDate={rangeStart}
          toDate={parseDateKey(toKey)}
          busy={mutations.bulk.isPending}
          error={
            mutations.bulk.isError
              ? (mutations.bulk.error as ApiError).message
              : null
          }
          onClose={() => setBulkOpen(false)}
          onSubmit={(payload) => mutations.bulk.mutate(payload)}
        />
      )}
      {leaveOpen && cell && (
        <ScheduleLeaveModal
          titleDescription={`${nameOf(employeeRows, cell.employeeId)} · ${toDateKey(cell.day)}`}
          leaveTypes={leaveTypes.data || []}
          leaveTypeId={leaveTypeId}
          leaveReason={leaveReason}
          busy={mutations.createLeave.isPending}
          error={
            mutations.createLeave.isError
              ? (mutations.createLeave.error as ApiError).message
              : null
          }
          onLeaveTypeId={setLeaveTypeId}
          onLeaveReason={setLeaveReason}
          onClose={() => setLeaveOpen(false)}
          onSave={() => mutations.createLeave.mutate()}
        />
      )}
    </div>
  );
}
