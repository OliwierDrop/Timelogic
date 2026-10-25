import { useEffect, useRef, useState } from "react";
import { ChevronUp, Plus } from "lucide-react";
import type { Employee, Shift } from "../../api";
import { Button } from "../../components";
import { shiftsForTargets } from "./scheduleLookups";
import type { ScheduleViewTab } from "./scheduleViewTab";

export function ScheduleHeadingActions({
  viewTab,
  employees,
  drafts,
  selectedEmployeeIds,
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
  onAddLeave: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const addWrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!addOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (!addWrap.current?.contains(event.target as Node)) {
        setAddOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [addOpen]);

  if (viewTab === "availability") {
    return null;
  }

  const targetDrafts = shiftsForTargets(drafts, selectedEmployeeIds);
  const showPublishAndActions = viewTab !== "leaves";
  const canPublish =
    selectedEmployeeIds.length > 0 && targetDrafts.length > 0;

  const addMenu = (
    <div className="actions-menu-wrap" ref={addWrap}>
      <Button
        onClick={() => setAddOpen((open) => !open)}
        aria-expanded={addOpen}
        aria-haspopup="menu"
      >
        <Plus size={16} /> Dodaj
        <ChevronUp
          size={14}
          className={`add-menu-chevron${addOpen ? " open" : ""}`}
        />
      </Button>
      {addOpen ? (
        <div className="actions-menu add-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setAddOpen(false);
              onOpenBulk();
            }}
          >
            Dodaj grafiki pracy
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setAddOpen(false);
              onAddLeave();
            }}
          >
            Dodaj wniosek
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="heading-actions">
      {showPublishAndActions ? (
        <Button
          busy={publishPending}
          disabled={!canPublish}
          onClick={() => onPublish(targetDrafts.map((shift) => shift.id))}
        >
          {canPublish
            ? `Opublikuj (${targetDrafts.length})`
            : "Opublikuj"}
        </Button>
      ) : null}
      {showPublishAndActions ? (
        <div className="actions-menu-wrap">
          <Button variant="quiet" onClick={onToggleActions}>
            Akcje
          </Button>
          {actionsOpen ? (
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
          ) : null}
        </div>
      ) : null}
      {addMenu}
    </div>
  );
}
