import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  del,
  post,
  put,
  patch,
  type AvailabilityEntry,
  type CalendarDayType,
  type LeaveRequest,
  type Shift,
} from "../../api";
import { type BulkPayload } from "./BulkWizard";
import { toDateKey } from "./dateUtils";
import {
  buildShiftPayload,
  type ShiftFormValues,
} from "./ShiftFormModal";
import { shiftsForTargets } from "./scheduleLookups";

type CellRef = { employeeId: string; day: Date } | null;

export function useScheduleMutations({
  fromIso,
  toIso,
  fromKey,
  toKey,
  cell,
  selectedEmployeeIds,
  targetEmployeeIds,
  visibleShifts,
  copyTarget,
  onSavedShift,
  onBulkDone,
  onActionsDone,
  onCopyDone,
  onLeaveDone,
}: {
  fromIso: string;
  toIso: string;
  fromKey: string;
  toKey: string;
  cell: CellRef;
  selectedEmployeeIds: string[];
  targetEmployeeIds: string[];
  visibleShifts: Shift[];
  copyTarget: string;
  onSavedShift: () => void;
  onBulkDone: (employeeIds: string[]) => void;
  onActionsDone: () => void;
  onCopyDone: () => void;
  onLeaveDone: () => void;
}) {
  const client = useQueryClient();

  const invalidate = () => {
    client.invalidateQueries({ queryKey: ["shifts"] });
    client.invalidateQueries({ queryKey: ["day-types"] });
    client.invalidateQueries({ queryKey: ["availability"] });
  };

  const saveShift = useMutation({
    mutationFn: async (values: ShiftFormValues) => {
      const payload = buildShiftPayload(values);
      if ("error" in payload) {
        throw new ApiError(422, payload.error || "Czas wymagany");
      }
      if (values.edit_id) {
        return patch<Shift>(`/shifts/${values.edit_id}`, {
          started_at: payload.started_at,
          ended_at: payload.ended_at,
          kind: payload.kind,
          color: payload.color,
          note: payload.note,
          flags: payload.flags,
        });
      }
      const body: Record<string, unknown> = { ...payload };
      if (!body.replaces_id) delete body.replaces_id;
      return post<Shift>("/shifts", body);
    },
    onSuccess: () => {
      invalidate();
      onSavedShift();
    },
  });

  const publish = useMutation({
    mutationFn: (shift_ids: string[]) =>
      post<Shift[]>("/shifts/publish", { shift_ids }),
    onSuccess: () => {
      invalidate();
    },
  });

  const rejectDrafts = useMutation({
    mutationFn: () =>
      post<{ removed: string[] }>("/shifts/reject-drafts", {
        employee_ids: selectedEmployeeIds.length
          ? selectedEmployeeIds
          : undefined,
        from_at: fromIso,
        to_at: toIso,
      }),
    onSuccess: () => {
      onActionsDone();
      invalidate();
    },
  });

  const deleteShifts = useMutation({
    mutationFn: async () => {
      const ids = shiftsForTargets(visibleShifts, targetEmployeeIds).map(
        (shift) => shift.id,
      );
      for (const id of ids) await del(`/shifts/${id}`);
    },
    onSuccess: () => {
      onActionsDone();
      invalidate();
    },
  });

  const deleteShift = useMutation({
    mutationFn: (shiftId: string) => del(`/shifts/${shiftId}`),
    onSuccess: () => {
      invalidate();
    },
  });

  const bulk = useMutation({
    mutationFn: (payload: BulkPayload) =>
      post<{ count: number }>("/shifts/bulk", payload).then((result) => ({
        result,
        employeeIds: payload.employee_ids,
      })),
    onSuccess: ({ employeeIds }) => {
      onBulkDone(employeeIds);
      invalidate();
    },
  });

  const copy = useMutation({
    mutationFn: () =>
      post("/shifts/copy", {
        shift_ids: shiftsForTargets(visibleShifts, targetEmployeeIds).map(
          (shift) => shift.id,
        ),
        target_employee_id: copyTarget,
      }),
    onSuccess: () => {
      onCopyDone();
      invalidate();
    },
  });

  const putDayType = useMutation({
    mutationFn: (code: CalendarDayType["code"] | null) =>
      put("/calendar/day-types", {
        employee_id: cell!.employeeId,
        day: toDateKey(cell!.day),
        code,
      }),
    onSuccess: invalidate,
  });

  const putAvailability = useMutation({
    mutationFn: (status: AvailabilityEntry["status"] | null) =>
      put("/calendar/availability", {
        employee_id: cell!.employeeId,
        day: toDateKey(cell!.day),
        status,
        start_minute: status === "hours" ? 8 * 60 : null,
        end_minute: status === "hours" ? 16 * 60 : null,
      }),
    onSuccess: invalidate,
  });

  const resetDayTypes = useMutation({
    mutationFn: () =>
      post("/calendar/day-types/reset", {
        employee_ids: targetEmployeeIds,
        from_date: fromKey,
        to_date: toKey,
      }),
    onSuccess: () => {
      onActionsDone();
      invalidate();
    },
  });

  const resetAvailability = useMutation({
    mutationFn: () =>
      post("/calendar/availability/reset", {
        employee_ids: targetEmployeeIds,
        from_date: fromKey,
        to_date: toKey,
      }),
    onSuccess: () => {
      onActionsDone();
      invalidate();
    },
  });

  const createLeave = useMutation({
    mutationFn: async (payload: {
      employee_ids: string[];
      leave_type_id: string;
      start_date: string;
      end_date: string;
      reason: string | null;
    }) => {
      const results: LeaveRequest[] = [];
      for (const employeeId of payload.employee_ids) {
        results.push(
          await post<LeaveRequest>("/leave-requests", {
            employee_id: employeeId,
            leave_type_id: payload.leave_type_id,
            start_date: payload.start_date,
            end_date: payload.end_date,
            reason: payload.reason,
          }),
        );
      }
      return results;
    },
    onSuccess: () => {
      onLeaveDone();
      client.invalidateQueries({ queryKey: ["leave-requests"] });
      client.invalidateQueries({ queryKey: ["leave-balances"] });
    },
  });

  return {
    saveShift,
    publish,
    rejectDrafts,
    deleteShifts,
    deleteShift,
    bulk,
    copy,
    putDayType,
    putAvailability,
    resetDayTypes,
    resetAvailability,
    createLeave,
  };
}
