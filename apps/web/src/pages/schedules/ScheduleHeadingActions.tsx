import { Plus } from "lucide-react";
import type { Employee, Shift } from "../../api";
import { Button } from "../../components";
import { shiftsForTargets } from "./scheduleLookups";
import type { ScheduleViewTab } from "./scheduleViewTab";

export function ScheduleHeadingActions({
  viewTab,
  employees,
  drafts,
  selectedEmployeeIds,
  targetEmployeeIds,
  actionsOpen,
  copyTarget,
  publishPending,
  copyPending,
  onToggleActions,
  onPublish,
  onRejectDrafts,
  onDeleteShifts,
  onCopyTarget,
  onCopy,
  onResetDayTypes,
  onOpenBulk,
  onAddShift,
  onAddLeave,
}: {
  viewTab: ScheduleViewTab;
  employees: Employee[];
  drafts: Shift[];
  selectedEmployeeIds: string[];
  targetEmployeeIds: string[];
  actionsOpen: boolean;
  copyTarget: string;
  publishPending: boolean;
  copyPending: boolean;
  onToggleActions: () => void;
  onPublish: (shiftIds: string[]) => void;
  onRejectDrafts: () => void;
  onDeleteShifts: () => void;
  onCopyTarget: (value: string) => void;
  onCopy: () => void;
  onResetDayTypes: () => void;
  onOpenBulk: () => void;
  onAddShift: () => void;
  onAddLeave: () => void;
}) {
  if (viewTab === "availability") {
    return null;
  }

  if (viewTab === "leaves") {
    return (
      <div className="heading-actions">
        <Button onClick={onAddLeave}>
          <Plus size={16} /> Dodaj wniosek
        </Button>
      </div>
    );
  }

  const targetDrafts = shiftsForTargets(drafts, targetEmployeeIds);

  return (
    <div className="heading-actions">
      {targetDrafts.length > 0 && (
        <Button
          busy={publishPending}
          onClick={() => onPublish(targetDrafts.map((shift) => shift.id))}
        >
          {selectedEmployeeIds.length
            ? `Opublikuj (${targetDrafts.length})`
            : "Opublikuj szkice"}
        </Button>
      )}
      <div className="actions-menu-wrap">
        <Button variant="quiet" onClick={onToggleActions}>
          Akcje
        </Button>
        {actionsOpen && (
          <div className="actions-menu">
            <button type="button" onClick={onRejectDrafts}>
              Odrzuć nieopublikowane
            </button>
            <button type="button" onClick={onDeleteShifts}>
              Usuń grafiki
            </button>
            <div className="actions-copy">
              <select
                value={copyTarget}
                onChange={(event) => onCopyTarget(event.target.value)}
              >
                <option value="">Kopiuj do…</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.first_name} {employee.last_name}
                  </option>
                ))}
              </select>
              <Button
                variant="quiet"
                disabled={!copyTarget}
                busy={copyPending}
                onClick={onCopy}
              >
                Kopiuj
              </Button>
            </div>
            <button type="button" onClick={onResetDayTypes}>
              Reset typów dnia
            </button>
          </div>
        )}
      </div>
      <Button variant="quiet" onClick={onOpenBulk}>
        Kreator
      </Button>
      <Button onClick={onAddShift}>
        <Plus size={16} /> Dodaj
      </Button>
    </div>
  );
}
