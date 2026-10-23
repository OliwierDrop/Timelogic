import { Pencil, Plus, Trash2 } from "lucide-react";
import type { ContractType, EmploymentTerm } from "../../api";
import { Button, Field, Modal } from "../../components";
import { CONTRACT_OPTIONS, contractLabel } from "./contractTypes";
import { minutesToParts } from "./workQuota";

export function EmploymentPanel({
  canEdit,
  terms,
  selectedFrom,
  onSelectFrom,
  activeTerm,
  dayParts,
  onAddTerm,
  onRemoveTerm,
  onEditTerm,
  onUpdateMinutes,
  onUpdateContract,
  onSave,
  termModal,
  modalFrom,
  modalContract,
  modalHours,
  modalMinutes,
  onModalFrom,
  onModalContract,
  onModalHours,
  onModalMinutes,
  onConfirmTermModal,
  onCloseTermModal,
}: {
  canEdit: boolean;
  terms: EmploymentTerm[];
  selectedFrom: string | null;
  onSelectFrom: (from: string) => void;
  activeTerm: EmploymentTerm | null;
  dayParts: { hours: number; minutes: number };
  onAddTerm: () => void;
  onRemoveTerm: () => void;
  onEditTerm: () => void;
  onUpdateMinutes: (hours: number, minutes: number) => void;
  onUpdateContract: (type: ContractType) => void;
  onSave: () => void;
  termModal: null | "add" | "edit";
  modalFrom: string;
  modalContract: ContractType;
  modalHours: number;
  modalMinutes: number;
  onModalFrom: (value: string) => void;
  onModalContract: (value: ContractType) => void;
  onModalHours: (value: number) => void;
  onModalMinutes: (value: number) => void;
  onConfirmTermModal: () => void;
  onCloseTermModal: () => void;
}) {
  return (
    <>
      <h2>Zatrudnienie</h2>
      {canEdit ? (
        <div className="profile-form">
          <section className="work-quota-panel">
            <h3>Warunki zatrudnienia</h3>
            {!terms.length ? (
              <button
                type="button"
                className="request-limit-add-empty"
                onClick={onAddTerm}
              >
                <Plus size={18} /> Dodaj
              </button>
            ) : (
              <>
                <div className="work-quota-toolbar">
                  <label className="work-quota-year">
                    <span>Od</span>
                    <select
                      value={selectedFrom ?? ""}
                      onChange={(e) => onSelectFrom(e.target.value)}
                    >
                      {terms.map((term) => (
                        <option
                          key={term.effective_from}
                          value={term.effective_from}
                        >
                          {term.effective_from} ·{" "}
                          {contractLabel(term.contract_type)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="work-quota-actions">
                    <Button
                      type="button"
                      variant="quiet"
                      size="small"
                      onClick={onAddTerm}
                    >
                      <Plus size={14} />
                    </Button>
                    <Button
                      type="button"
                      variant="quiet"
                      size="small"
                      disabled={!activeTerm}
                      onClick={onRemoveTerm}
                    >
                      <Trash2 size={14} /> Usuń
                    </Button>
                    <Button
                      type="button"
                      variant="quiet"
                      size="small"
                      disabled={!activeTerm}
                      onClick={onEditTerm}
                    >
                      <Pencil size={14} /> Edytuj
                    </Button>
                  </div>
                </div>

                {activeTerm ? (
                  <>
                    <Field label="Typ umowy">
                      <select
                        value={activeTerm.contract_type}
                        onChange={(e) =>
                          onUpdateContract(e.target.value as ContractType)
                        }
                      >
                        {CONTRACT_OPTIONS.map((opt) => (
                          <option key={opt.code} value={opt.code}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {activeTerm.contract_type === "employment" ? (
                      <div className="work-quota-dimension">
                        <span className="work-quota-dimension-label">
                          Wymiar dzienny
                        </span>
                        <div className="work-quota-hm">
                          <input
                            type="number"
                            min={0}
                            max={24}
                            value={dayParts.hours}
                            onChange={(e) =>
                              onUpdateMinutes(
                                Number(e.target.value) || 0,
                                dayParts.minutes,
                              )
                            }
                            aria-label="Godziny dziennie"
                          />
                          <span>h</span>
                          <input
                            type="number"
                            min={0}
                            max={59}
                            value={dayParts.minutes}
                            onChange={(e) =>
                              onUpdateMinutes(
                                dayParts.hours,
                                Number(e.target.value) || 0,
                              )
                            }
                            aria-label="Minuty dziennie"
                          />
                          <span>m</span>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </>
            )}
            <p className="field-hint">
              Dodaj wpisy chronologicznie (np. zlecenie od lipca, potem umowa o
              pracę od listopada). Limity urlopowe wymagają umowy o pracę.
            </p>
          </section>
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
            <dt>Aktualne warunki</dt>
            <dd>
              {activeTerm
                ? `${contractLabel(activeTerm.contract_type)}${
                    activeTerm.contract_type === "employment"
                      ? ` · ${minutesToParts(activeTerm.daily_minutes).hours} h ${minutesToParts(activeTerm.daily_minutes).minutes} m`
                      : ""
                  } (od ${activeTerm.effective_from})`
                : "—"}
            </dd>
          </div>
          {terms.length > 1 ? (
            <div>
              <dt>Historia</dt>
              <dd>
                {terms
                  .map(
                    (term) =>
                      `${term.effective_from}: ${contractLabel(term.contract_type)}`,
                  )
                  .join(" → ")}
              </dd>
            </div>
          ) : null}
        </dl>
      )}

      {termModal && (
        <Modal
          title={termModal === "add" ? "Dodaj warunki" : "Edytuj warunki"}
          description="Ustaw datę wejścia w życie, typ umowy i wymiar."
          layer={2}
          onClose={onCloseTermModal}
          footer={
            <>
              <Button type="button" variant="quiet" onClick={onCloseTermModal}>
                Anuluj
              </Button>
              <Button type="button" onClick={onConfirmTermModal}>
                {termModal === "add" ? "Dodaj" : "Zapisz"}
              </Button>
            </>
          }
        >
          <Field label="Od">
            <input
              type="date"
              value={modalFrom}
              onChange={(e) => onModalFrom(e.target.value)}
            />
          </Field>
          <Field label="Typ umowy">
            <select
              value={modalContract}
              onChange={(e) =>
                onModalContract(e.target.value as ContractType)
              }
            >
              {CONTRACT_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
          {modalContract === "employment" ? (
            <div className="work-quota-dimension">
              <span className="work-quota-dimension-label">Wymiar</span>
              <div className="work-quota-hm">
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={modalHours}
                  onChange={(e) => onModalHours(Number(e.target.value) || 0)}
                  aria-label="Godziny dziennie"
                />
                <span>h</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={modalMinutes}
                  onChange={(e) => onModalMinutes(Number(e.target.value) || 0)}
                  aria-label="Minuty dziennie"
                />
                <span>m</span>
              </div>
            </div>
          ) : null}
        </Modal>
      )}
    </>
  );
}
