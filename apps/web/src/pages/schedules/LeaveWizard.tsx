import { useMemo, useState } from "react";
import type { Employee, LeaveType, Position, Tag } from "../../api";
import { Field } from "../../components";
import { toDateKey } from "./dateUtils";
import {
  filterWizardEmployees,
  useWizardPeopleState,
  WizardEmployeeTable,
  WizardFilterSidebar,
  WizardSelectedSidebar,
} from "./WizardPeople";
import { WizardShell } from "./WizardShell";

const LEAVE_KINDS = [
  {
    id: "leave",
    label: "Urlop",
    description:
      "Wnioskuj o urlop wypoczynkowy, zwolnienie lekarskie lub inną płatną/bezpłatną nieobecność.",
    enabled: true,
  },
  {
    id: "custom",
    label: "Dowolny",
    description:
      "Zgłaszaj specjalne wnioski, takie jak praca zdalna lub określone przez twoje miejsce pracy.",
    enabled: false,
  },
  {
    id: "hr",
    label: "Kadrowy",
    description: "Wnioski jak rekompensata za nadgodziny, wyjście prywatne.",
    enabled: false,
  },
  {
    id: "swap",
    label: "Zamiana grafiku",
    description:
      "Wymieniaj się zaplanowanymi grafikami z zespołem, aby zwiększyć elastyczność.",
    enabled: false,
  },
  {
    id: "trip",
    label: "Delegacja",
    description: "Wnioskuj i zarządzaj zgodami na wyjazdy oraz ich szczegółami.",
    enabled: false,
  },
] as const;

type LeaveAction = "create" | "edit" | "delete";

export type LeaveWizardPayload = {
  employee_ids: string[];
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
};

type Props = {
  employees: Employee[];
  tags: Tag[];
  positions: Position[];
  leaveTypes: LeaveType[];
  seedEmployeeIds?: string[];
  seedStartDate?: string;
  seedEndDate?: string;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: LeaveWizardPayload) => void;
};

export function LeaveWizard({
  employees,
  tags,
  positions,
  leaveTypes,
  seedEmployeeIds = [],
  seedStartDate,
  seedEndDate,
  busy,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [step, setStep] = useState(1);
  const people = useWizardPeopleState(seedEmployeeIds);
  const [kind, setKind] = useState<(typeof LEAVE_KINDS)[number]["id"]>("leave");
  const [action, setAction] = useState<LeaveAction>("create");
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id || "");
  const [rangeFrom, setRangeFrom] = useState(
    seedStartDate || toDateKey(new Date()),
  );
  const [rangeTo, setRangeTo] = useState(
    seedEndDate || seedStartDate || toDateKey(new Date()),
  );
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      filterWizardEmployees(employees, {
        search: people.search,
        role: people.role,
        tagId: people.tagId,
        positionId: people.positionId,
      }),
    [employees, people.search, people.role, people.tagId, people.positionId],
  );

  const kindMeta = LEAVE_KINDS.find((item) => item.id === kind);

  const next = () => {
    if (step === 1 && !people.selected.length) {
      setLocalError("Wybierz co najmniej jednego pracownika");
      return;
    }
    if (step === 2 && kind !== "leave") {
      setLocalError("Ten rodzaj wniosku będzie dostępny wkrótce");
      return;
    }
    setLocalError(null);
    setStep((current) => Math.min(3, current + 1));
  };

  const sidebar =
    step === 1 ? (
      <WizardFilterSidebar
        tags={tags}
        positions={positions}
        search={people.search}
        role={people.role}
        tagId={people.tagId}
        positionId={people.positionId}
        onSearch={people.setSearch}
        onRole={people.setRole}
        onTag={people.setTagId}
        onPosition={people.setPositionId}
      />
    ) : (
      <div className="wizard-selected-stack">
        {step >= 2 && kindMeta ? (
          <div className="wizard-kind-summary">
            <h3>Rodzaj wniosku</h3>
            <div className="wizard-person-chip">
              <strong>{kindMeta.label}</strong>
            </div>
          </div>
        ) : null}
        <WizardSelectedSidebar
          employees={employees}
          selectedIds={people.selected}
        />
      </div>
    );

  return (
    <WizardShell
      title={step === 3 ? "Dodaj wniosek" : "Kreator wniosku"}
      step={step}
      totalSteps={3}
      sidebar={sidebar}
      error={localError || error}
      onClose={onClose}
      onBack={
        step > 1
          ? () => {
              setLocalError(null);
              setStep((current) => current - 1);
            }
          : undefined
      }
      primaryLabel={step < 3 ? "Dalej" : "Zapisz"}
      primaryIsNext={step < 3}
      primaryDisabled={
        (step === 1 && !people.selected.length) ||
        (step === 3 && (action !== "create" || !leaveTypeId))
      }
      primaryBusy={busy}
      onPrimary={() => {
        if (step < 3) {
          next();
          return;
        }
        if (action !== "create" || !leaveTypeId) return;
        onSubmit({
          employee_ids: people.selected,
          leave_type_id: leaveTypeId,
          start_date: rangeFrom,
          end_date: rangeTo,
          reason: reason.trim() || null,
        });
      }}
    >
      {step === 1 ? (
        <WizardEmployeeTable
          employees={visible}
          selectedIds={people.selected}
          onToggle={people.toggle}
          onClear={people.clear}
          onToggleAll={() => {
            const allVisibleSelected =
              visible.length > 0 &&
              visible.every((row) => people.selected.includes(row.id));
            if (allVisibleSelected) {
              people.setSelected((current) =>
                current.filter((id) => !visible.some((row) => row.id === id)),
              );
            } else {
              people.setSelected((current) => [
                ...new Set([...current, ...visible.map((row) => row.id)]),
              ]);
            }
          }}
        />
      ) : null}

      {step === 2 ? (
        <div className="wizard-form">
          <h3 className="wizard-section-title">Wybierz rodzaj wniosku</h3>
          <div className="wizard-kind-list">
            {LEAVE_KINDS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`wizard-kind-card${kind === item.id ? " active" : ""}${item.enabled ? "" : " is-disabled"}`}
                disabled={!item.enabled}
                onClick={() => item.enabled && setKind(item.id)}
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
                {!item.enabled ? (
                  <em className="wizard-soon">Wkrótce</em>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="wizard-form">
          <h3 className="wizard-section-title">Wybierz akcję</h3>
          <div className="wizard-action-tabs">
            <button
              type="button"
              className={`filter-item${action === "create" ? " active" : ""}`}
              onClick={() => setAction("create")}
            >
              + Nowy
            </button>
            <button
              type="button"
              className="filter-item is-disabled"
              disabled
              title="Wkrótce"
            >
              Edytuj
            </button>
            <button
              type="button"
              className="filter-item is-disabled"
              disabled
              title="Wkrótce"
            >
              Usuń
            </button>
          </div>
          {action === "create" ? (
            <>
              <Field label="Typ wniosku o urlop">
                <select
                  value={leaveTypeId}
                  onChange={(event) => setLeaveTypeId(event.target.value)}
                >
                  <option value="">Wybierz typ…</option>
                  {leaveTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="shift-time-row">
                <Field label="Od">
                  <input
                    type="date"
                    value={rangeFrom}
                    onChange={(event) => setRangeFrom(event.target.value)}
                  />
                </Field>
                <Field label="Do">
                  <input
                    type="date"
                    value={rangeTo}
                    onChange={(event) => setRangeTo(event.target.value)}
                  />
                </Field>
              </div>
              <Field label="Notatka">
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </Field>
            </>
          ) : null}
        </div>
      ) : null}
    </WizardShell>
  );
}
