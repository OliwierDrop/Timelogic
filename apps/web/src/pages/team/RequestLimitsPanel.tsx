import { Pencil, Plus, Trash2 } from "lucide-react";
import type { LeaveCategory, LimitPeriod } from "../../leaveDefaults";
import { Button, Field, Modal } from "../../components";
import { displayLeaveCode, type LimitDraft } from "./leaveLimitDrafts";

export function RequestLimitsPanel({
  canEdit,
  leaveLimitsAllowed,
  leaveYears,
  customYears,
  leaveYear,
  customYear,
  leaveRows,
  customRows,
  canAddLeave,
  canAddCustom,
  onSelectLeaveYear,
  onSelectCustomYear,
  onAdd,
  onRemove,
  onEditYear,
  onChange,
  onSave,
  limitYearModal,
  limitModalYear,
  limitYearChoices,
  usedYearsFor,
  onLimitModalYear,
  onConfirmLimitYear,
  onCloseLimitModal,
}: {
  canEdit: boolean;
  leaveLimitsAllowed: boolean;
  leaveYears: number[];
  customYears: number[];
  leaveYear: number | null;
  customYear: number | null;
  leaveRows: LimitDraft[];
  customRows: LimitDraft[];
  canAddLeave: boolean;
  canAddCustom: boolean;
  onSelectLeaveYear: (year: number) => void;
  onSelectCustomYear: (year: number) => void;
  onAdd: (category: LeaveCategory) => void;
  onRemove: (category: LeaveCategory) => void;
  onEditYear: (category: LeaveCategory) => void;
  onChange: (
    leaveTypeId: string,
    year: number,
    patch: Partial<LimitDraft>,
  ) => void;
  onSave: () => void;
  limitYearModal: null | { category: LeaveCategory; mode: "add" | "edit" };
  limitModalYear: number;
  limitYearChoices: number[];
  usedYearsFor: (category: LeaveCategory) => Set<number>;
  onLimitModalYear: (year: number) => void;
  onConfirmLimitYear: () => void;
  onCloseLimitModal: () => void;
}) {
  return (
    <>
      <h2>Limity wniosków</h2>
      {canEdit ? (
        <div className="profile-form request-limits-stack">
          {leaveLimitsAllowed ? (
            <LimitBlock
              title="Limity wniosków urlopowych"
              category="leave"
              years={leaveYears}
              selectedYear={leaveYear}
              rows={leaveRows}
              canAdd={canAddLeave}
              onSelectYear={onSelectLeaveYear}
              onAdd={() => onAdd("leave")}
              onRemove={() => onRemove("leave")}
              onEditYear={() => onEditYear("leave")}
              onChange={onChange}
            />
          ) : (
            <section className="work-quota-panel request-limit-panel">
              <h3>Limity wniosków urlopowych</h3>
              <p className="field-hint">
                Limity urlopowe są dostępne przy umowie o pracę. Ustaw typ
                umowy w zakładce Zatrudnienie.
              </p>
            </section>
          )}
          <LimitBlock
            title="Limity wniosków dowolnych"
            category="custom"
            years={customYears}
            selectedYear={customYear}
            rows={customRows}
            canAdd={canAddCustom}
            onSelectYear={onSelectCustomYear}
            onAdd={() => onAdd("custom")}
            onRemove={() => onRemove("custom")}
            onEditYear={() => onEditYear("custom")}
            onChange={onChange}
          />
          <form
            id="edit-employee-form"
            onSubmit={(e) => {
              e.preventDefault();
              onSave();
            }}
            hidden
          />
        </div>
      ) : (
        <dl className="detail-list">
          <div>
            <dt>Urlopowe</dt>
            <dd>
              {leaveYears.length ? leaveYears.join(", ") : "Brak limitów"}
            </dd>
          </div>
          <div>
            <dt>Dowolne</dt>
            <dd>
              {customYears.length ? customYears.join(", ") : "Brak limitów"}
            </dd>
          </div>
        </dl>
      )}

      {limitYearModal && (
        <Modal
          title={limitYearModal.mode === "add" ? "Dodaj wpis" : "Edytuj rok"}
          description={
            limitYearModal.mode === "add"
              ? "Wybierz rok dla nowego wpisu."
              : "Wybierz nowy rok dla wybranego zbioru."
          }
          layer={2}
          onClose={onCloseLimitModal}
          footer={
            <>
              <Button type="button" variant="quiet" onClick={onCloseLimitModal}>
                Anuluj
              </Button>
              <Button type="button" onClick={onConfirmLimitYear}>
                {limitYearModal.mode === "add" ? "Dodaj" : "Zapisz"}
              </Button>
            </>
          }
        >
          <Field label="Od">
            <select
              value={limitModalYear}
              onChange={(e) => onLimitModalYear(Number(e.target.value))}
            >
              {(limitYearModal.mode === "add"
                ? limitYearChoices.filter(
                    (y) => !usedYearsFor(limitYearModal.category).has(y),
                  )
                : limitYearChoices.filter(
                    (y) =>
                      y ===
                        (limitYearModal.category === "leave"
                          ? leaveYear
                          : customYear) ||
                      !usedYearsFor(limitYearModal.category).has(y),
                  )
              ).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </Field>
        </Modal>
      )}
    </>
  );
}

function LimitBlock({
  title,
  category,
  years,
  selectedYear,
  rows,
  canAdd,
  onSelectYear,
  onAdd,
  onRemove,
  onEditYear,
  onChange,
}: {
  title: string;
  category: LeaveCategory;
  years: number[];
  selectedYear: number | null;
  rows: LimitDraft[];
  canAdd: boolean;
  onSelectYear: (year: number) => void;
  onAdd: () => void;
  onRemove: () => void;
  onEditYear: () => void;
  onChange: (
    leaveTypeId: string,
    year: number,
    patch: Partial<LimitDraft>,
  ) => void;
}) {
  if (!years.length) {
    return (
      <section className="work-quota-panel request-limit-panel">
        <h3>{title}</h3>
        <button
          type="button"
          className="request-limit-add-empty"
          onClick={onAdd}
        >
          <Plus size={18} /> Dodaj
        </button>
      </section>
    );
  }

  return (
    <section className="work-quota-panel request-limit-panel">
      <h3>{title}</h3>
      <div className="work-quota-toolbar">
        <label className="work-quota-year">
          <span>Od</span>
          <select
            value={selectedYear ?? ""}
            onChange={(e) => onSelectYear(Number(e.target.value))}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <div className="work-quota-actions">
          <Button
            type="button"
            variant="quiet"
            size="small"
            disabled={!canAdd}
            onClick={onAdd}
          >
            <Plus size={14} />
          </Button>
          <Button type="button" variant="quiet" size="small" onClick={onRemove}>
            <Trash2 size={14} /> Usuń
          </Button>
          <Button
            type="button"
            variant="quiet"
            size="small"
            onClick={onEditYear}
          >
            <Pencil size={14} /> Edytuj rok
          </Button>
        </div>
      </div>
      <ul className="request-limit-list">
        {rows.map((row) => (
          <li
            key={`${row.leave_type_id}-${row.year}`}
            className="request-limit-row"
          >
            <div className="request-limit-meta">
              <strong>{row.name}</strong>
              <span className="request-limit-code">
                {displayLeaveCode(row.code)}
              </span>
            </div>
            <div className="request-limit-carry">
              {row.allows_carry_over ? (
                <label className="request-limit-check">
                  <input
                    type="checkbox"
                    checked={row.carry_over}
                    onChange={(e) =>
                      onChange(row.leave_type_id, row.year, {
                        carry_over: e.target.checked,
                      })
                    }
                  />
                  <span>Przenieś niewykorzystany limit</span>
                </label>
              ) : null}
            </div>
            <label className="request-limit-check request-limit-unlimited">
              <input
                type="checkbox"
                checked={row.unlimited}
                onChange={(e) =>
                  onChange(row.leave_type_id, row.year, {
                    unlimited: e.target.checked,
                    granted_days: e.target.checked ? 0 : row.granted_days,
                    period:
                      category === "custom" && !e.target.checked
                        ? row.period || "month"
                        : category === "custom"
                          ? null
                          : row.period,
                  })
                }
              />
              <span>Nielimitowany</span>
            </label>
            <div className="request-limit-days">
              {!row.unlimited ? (
                <>
                  <input
                    type="number"
                    min={0}
                    max={366}
                    step={0.5}
                    value={row.granted_days}
                    onChange={(e) =>
                      onChange(row.leave_type_id, row.year, {
                        granted_days: Number(e.target.value) || 0,
                      })
                    }
                    aria-label={`Dni — ${row.name}`}
                  />
                  <span>dni</span>
                  {category === "custom" ? (
                    <select
                      value={row.period || "month"}
                      onChange={(e) =>
                        onChange(row.leave_type_id, row.year, {
                          period: e.target.value as LimitPeriod,
                        })
                      }
                      aria-label={`Okres — ${row.name}`}
                    >
                      <option value="month">/ miesiąc</option>
                      <option value="year">/ rok</option>
                    </select>
                  ) : null}
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
