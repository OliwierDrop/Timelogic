import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Check, FileText, FolderOpen, Users } from "lucide-react";
import {
  api,
  ApiError,
  patch,
  put,
  type Employee,
  type LeaveType,
  type Position,
  type RequestLimitInput,
  type RequestLimits,
  type ContractType,
  type EmploymentTerm,
  type Tag,
} from "../../api";
import { Button, Field, Message, Modal } from "../../components";
import type { LeaveCategory } from "../../leaveDefaults";
import { DEFAULT_TAG_COLOR } from "../../tags";
import { EmploymentPanel } from "./EmploymentPanel";
import {
  draftsForYear,
  yearsFromDrafts,
  type LimitDraft,
} from "./leaveLimitDrafts";
import { DocumentsPanel } from "./DocumentsPanel";
import { RequestLimitsPanel } from "./RequestLimitsPanel";
import { ROLE_OPTIONS, roleLabel } from "./roles";
import { minutesToParts, partsToMinutes } from "./workQuota";

export function EmployeeEditor({
  employee,
  tags,
  positions,
  peers,
  canEdit,
  isAdmin,
  selectTagId,
  onAddTag,
  onManageTags,
  onAddPosition,
  onManagePositions,
  onClose,
  onSaved,
}: {
  employee: Employee;
  tags: Tag[];
  positions: Position[];
  peers: Employee[];
  canEdit: boolean;
  isAdmin: boolean;
  selectTagId: string | null;
  onAddTag: () => void;
  onManageTags: () => void;
  onAddPosition: () => void;
  onManagePositions: () => void;
  onClose: () => void;
  onSaved: (row: Employee) => void;
}) {
  const client = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [tab, setTab] = useState<
    "main" | "employment" | "limits" | "documents"
  >("main");
  const [firstName, setFirstName] = useState(employee.first_name);
  const [lastName, setLastName] = useState(employee.last_name);
  const [email, setEmail] = useState(employee.email || "");
  const [phone, setPhone] = useState(() => {
    const raw = employee.phone || "";
    return raw.startsWith("+48") ? raw.slice(3) : raw.replace(/^\+/, "");
  });
  const [positionId, setPositionId] = useState(employee.position_id || "");
  const [supervisorId, setSupervisorId] = useState(
    employee.supervisor_id || "",
  );
  const [role, setRole] = useState(employee.roles?.[0] || "employee");
  const [tagIds, setTagIds] = useState<string[]>(employee.tag_ids || []);
  const [active, setActive] = useState(employee.active);
  const [terms, setTerms] = useState<EmploymentTerm[]>([]);
  const [selectedFrom, setSelectedFrom] = useState<string | null>(null);
  const [termModal, setTermModal] = useState<null | "add" | "edit">(null);
  const [modalFrom, setModalFrom] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [modalContract, setModalContract] = useState<ContractType>("employment");
  const [modalHours, setModalHours] = useState(8);
  const [modalMinutes, setModalMinutes] = useState(0);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [limitDrafts, setLimitDrafts] = useState<LimitDraft[]>([]);
  const [leaveYear, setLeaveYear] = useState<number | null>(null);
  const [customYear, setCustomYear] = useState<number | null>(null);
  const [limitYearModal, setLimitYearModal] = useState<null | {
    category: LeaveCategory;
    mode: "add" | "edit";
  }>(null);
  const [limitModalYear, setLimitModalYear] = useState(currentYear);

  const termsQuery = useQuery({
    queryKey: ["employment-terms", employee.id],
    queryFn: () =>
      api<EmploymentTerm[]>(`/employees/${employee.id}/employment-terms`),
  });

  const limitsQuery = useQuery({
    queryKey: ["request-limits", employee.id],
    queryFn: () =>
      api<RequestLimits>(`/employees/${employee.id}/request-limits`),
  });

  useEffect(() => {
    if (!termsQuery.data) return;
    const sorted = [...termsQuery.data].sort((a, b) =>
      a.effective_from.localeCompare(b.effective_from),
    );
    setTerms(sorted);
    if (sorted.length) {
      setSelectedFrom(sorted[sorted.length - 1].effective_from);
    } else {
      setSelectedFrom(null);
    }
  }, [termsQuery.data]);

  useEffect(() => {
    if (!limitsQuery.data) return;
    const data = limitsQuery.data;
    setLeaveTypes(data.types);
    const mapped: LimitDraft[] = [...data.leave, ...data.custom].map((row) => ({
      leave_type_id: row.leave_type_id,
      code: row.leave_type_code || "",
      name: row.leave_type_name || "",
      category: (row.category || "leave") as LeaveCategory,
      allows_carry_over: Boolean(row.allows_carry_over),
      year: row.year,
      granted_days: row.granted_days,
      unlimited: Boolean(row.unlimited),
      carry_over: Boolean(row.carry_over),
      period: row.period,
    }));
    setLimitDrafts(mapped);
    const leaveYs = yearsFromDrafts(mapped, "leave");
    const customYs = yearsFromDrafts(mapped, "custom");
    setLeaveYear(leaveYs.length ? leaveYs[leaveYs.length - 1] : null);
    setCustomYear(customYs.length ? customYs[customYs.length - 1] : null);
  }, [limitsQuery.data]);

  const leaveYears = useMemo(
    () => yearsFromDrafts(limitDrafts, "leave"),
    [limitDrafts],
  );
  const customYears = useMemo(
    () => yearsFromDrafts(limitDrafts, "custom"),
    [limitDrafts],
  );

  const limitYearChoices = useMemo(() => {
    const start = currentYear - 2;
    const end = currentYear + 5;
    const years: number[] = [];
    for (let y = start; y <= end; y += 1) years.push(y);
    for (const y of [...leaveYears, ...customYears]) {
      if (!years.includes(y)) years.push(y);
    }
    return years.sort((a, b) => a - b);
  }, [currentYear, leaveYears, customYears]);

  useEffect(() => {
    if (!selectTagId) return;
    setTagIds((ids) =>
      ids.includes(selectTagId) ? ids : [...ids, selectTagId],
    );
  }, [selectTagId]);

  const activeTerm =
    (selectedFrom != null
      ? terms.find((t) => t.effective_from === selectedFrom)
      : null) ||
    terms[terms.length - 1] ||
    null;
  const dayParts = minutesToParts(activeTerm?.daily_minutes ?? 480);

  const currentContractType = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const applicable = terms
      .filter((t) => t.effective_from <= today)
      .sort((a, b) => a.effective_from.localeCompare(b.effective_from));
    return applicable.length
      ? applicable[applicable.length - 1].contract_type
      : null;
  }, [terms]);
  const leaveLimitsAllowed = currentContractType === "employment";

  const save = useMutation({
    mutationFn: async () => {
      const phoneDigits = phone.replace(/\s+/g, "").trim();
      const row = await patch<Employee>(`/employees/${employee.id}`, {
        first_name: firstName,
        last_name: lastName,
        email: employee.user_id ? email.trim() : undefined,
        phone: phoneDigits
          ? phoneDigits.startsWith("+")
            ? phoneDigits
            : `+48${phoneDigits}`
          : null,
        position_id: positionId || null,
        supervisor_id: supervisorId || null,
        tag_ids: tagIds,
        role: isAdmin && employee.user_id ? role : undefined,
        active,
      });
      if (canEdit) {
        await put<EmploymentTerm[]>(
          `/employees/${employee.id}/employment-terms`,
          terms.map((term) => ({
            effective_from: term.effective_from,
            contract_type: term.contract_type,
            daily_minutes: term.daily_minutes,
          })),
        );
        const payload: RequestLimitInput[] = limitDrafts
          .filter((draft) =>
            leaveLimitsAllowed ? true : draft.category === "custom",
          )
          .map((draft) => ({
            leave_type_id: draft.leave_type_id,
            code: draft.code,
            year: draft.year,
            granted_days: draft.unlimited ? 0 : draft.granted_days,
            unlimited: draft.unlimited,
            carry_over: draft.allows_carry_over ? draft.carry_over : false,
            period:
              draft.category === "custom" && !draft.unlimited
                ? draft.period || "month"
                : null,
          }));
        await put<RequestLimits>(
          `/employees/${employee.id}/request-limits`,
          payload,
        );
      }
      return row;
    },
    onSuccess: (row) => {
      client.invalidateQueries({ queryKey: ["employees"] });
      client.invalidateQueries({ queryKey: ["employment-terms", employee.id] });
      client.invalidateQueries({ queryKey: ["request-limits", employee.id] });
      client.invalidateQueries({ queryKey: ["me"] });
      onSaved(row);
      onClose();
    },
  });

  const toggleTag = (id: string) => {
    setTagIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  };

  const usedFromDates = () => new Set(terms.map((t) => t.effective_from));

  const updateActiveMinutes = (hours: number, minutes: number) => {
    if (selectedFrom == null) return;
    const daily = partsToMinutes(hours, minutes);
    setTerms((rows) =>
      rows.map((row) =>
        row.effective_from === selectedFrom
          ? { ...row, daily_minutes: daily }
          : row,
      ),
    );
  };

  const updateActiveContract = (contract_type: ContractType) => {
    if (selectedFrom == null) return;
    setTerms((rows) =>
      rows.map((row) =>
        row.effective_from === selectedFrom
          ? {
              ...row,
              contract_type,
              daily_minutes:
                contract_type === "employment"
                  ? row.daily_minutes || 480
                  : row.daily_minutes,
            }
          : row,
      ),
    );
  };

  const openAddTermModal = () => {
    setModalFrom(
      selectedFrom ||
        terms[terms.length - 1]?.effective_from ||
        new Date().toISOString().slice(0, 10),
    );
    setModalContract("employment");
    const parts = minutesToParts(activeTerm?.daily_minutes ?? 480);
    setModalHours(parts.hours);
    setModalMinutes(parts.minutes);
    setTermModal("add");
  };

  const openEditTermModal = () => {
    if (!activeTerm) return;
    setModalFrom(activeTerm.effective_from);
    setModalContract(activeTerm.contract_type);
    const parts = minutesToParts(activeTerm.daily_minutes);
    setModalHours(parts.hours);
    setModalMinutes(parts.minutes);
    setTermModal("edit");
  };

  const confirmTermModal = () => {
    if (!termModal || !modalFrom) return;
    const used = usedFromDates();
    const daily =
      modalContract === "employment"
        ? partsToMinutes(modalHours, modalMinutes)
        : 0;
    if (termModal === "add") {
      if (used.has(modalFrom)) return;
      setTerms((rows) =>
        [
          ...rows,
          {
            effective_from: modalFrom,
            contract_type: modalContract,
            daily_minutes: daily,
          },
        ].sort((a, b) => a.effective_from.localeCompare(b.effective_from)),
      );
      setSelectedFrom(modalFrom);
    } else if (termModal === "edit" && selectedFrom != null) {
      if (modalFrom !== selectedFrom && used.has(modalFrom)) return;
      setTerms((rows) =>
        rows
          .map((row) =>
            row.effective_from === selectedFrom
              ? {
                  effective_from: modalFrom,
                  contract_type: modalContract,
                  daily_minutes: daily,
                }
              : row,
          )
          .sort((a, b) => a.effective_from.localeCompare(b.effective_from)),
      );
      setSelectedFrom(modalFrom);
    }
    setTermModal(null);
  };

  const removeActiveTerm = () => {
    if (selectedFrom == null || !terms.length) return;
    const remaining = terms.filter((t) => t.effective_from !== selectedFrom);
    setTerms(remaining);
    setSelectedFrom(
      remaining.length
        ? remaining[remaining.length - 1].effective_from
        : null,
    );
  };

  const usedLimitYears = (category: LeaveCategory) =>
    new Set(yearsFromDrafts(limitDrafts, category));

  const openLimitYearModal = (
    category: LeaveCategory,
    mode: "add" | "edit",
  ) => {
    if (category === "leave" && !leaveLimitsAllowed) return;
    const used = usedLimitYears(category);
    const selected = category === "leave" ? leaveYear : customYear;
    if (mode === "edit" && selected == null) return;
    const available =
      mode === "add"
        ? limitYearChoices.filter((y) => !used.has(y))
        : limitYearChoices.filter((y) => y === selected || !used.has(y));
    const first =
      mode === "edit" && selected != null
        ? selected
        : available.find((y) => y >= currentYear) ||
          available[0] ||
          currentYear + 1;
    setLimitModalYear(first);
    setLimitYearModal({ category, mode });
  };

  const confirmLimitYearModal = () => {
    if (!limitYearModal) return;
    const { category, mode } = limitYearModal;
    const year = limitModalYear;
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return;
    const used = usedLimitYears(category);
    const selected = category === "leave" ? leaveYear : customYear;
    if (mode === "add") {
      if (used.has(year)) return;
      const created = draftsForYear(year, category, leaveTypes);
      if (!created.length) return;
      setLimitDrafts((rows) => [...rows, ...created]);
      if (category === "leave") setLeaveYear(year);
      else setCustomYear(year);
    } else if (mode === "edit" && selected != null) {
      if (year !== selected && used.has(year)) return;
      setLimitDrafts((rows) =>
        rows.map((row) =>
          row.category === category && row.year === selected
            ? { ...row, year }
            : row,
        ),
      );
      if (category === "leave") setLeaveYear(year);
      else setCustomYear(year);
    }
    setLimitYearModal(null);
  };

  const removeLimitYear = (category: LeaveCategory) => {
    const selected = category === "leave" ? leaveYear : customYear;
    if (selected == null) return;
    const remaining = limitDrafts.filter(
      (row) => !(row.category === category && row.year === selected),
    );
    setLimitDrafts(remaining);
    const nextYears = yearsFromDrafts(remaining, category);
    const next = nextYears.length ? nextYears[nextYears.length - 1] : null;
    if (category === "leave") setLeaveYear(next);
    else setCustomYear(next);
  };

  const updateLimitDraft = (
    leaveTypeId: string,
    year: number,
    patchRow: Partial<LimitDraft>,
  ) => {
    setLimitDrafts((rows) =>
      rows.map((row) =>
        row.leave_type_id === leaveTypeId && row.year === year
          ? { ...row, ...patchRow }
          : row,
      ),
    );
  };

  const tabDescription =
    tab === "main"
      ? "Główne"
      : tab === "employment"
        ? "Zatrudnienie"
        : tab === "limits"
          ? "Limity wniosków"
          : "Dokumenty";

  const roleHint =
    ROLE_OPTIONS.find((r) => r.code === role)?.hint ||
    "Wybierz rolę systemową dla powiązanego konta.";

  return (
    <Modal
      title="Edytuj pracownika"
      description={tabDescription}
      size="profile"
      bare
      onClose={onClose}
      footer={
        canEdit ? (
          <>
            {save.isError && (
              <Message>{(save.error as ApiError).message}</Message>
            )}
            <Button type="button" variant="quiet" onClick={onClose}>
              Anuluj
            </Button>
            <Button
              type="submit"
              form="edit-employee-form"
              busy={save.isPending}
            >
              Zapisz
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="profile-modal">
        <aside className="profile-nav">
          <div className="profile-identity">
            <span className="avatar large">
              {employee.first_name[0]}
              {employee.last_name[0]}
            </span>
            <div>
              <strong>
                {employee.first_name} {employee.last_name}
              </strong>
              {employee.email ? (
                <span className="subtle">{employee.email}</span>
              ) : null}
              {employee.pending_email ? (
                <span className="subtle">
                  oczekuje: {employee.pending_email}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className={`profile-nav-item${tab === "main" ? " active" : ""}`}
            onClick={() => setTab("main")}
          >
            <Users size={16} /> Główne
          </button>
          <button
            type="button"
            className={`profile-nav-item${tab === "employment" ? " active" : ""}`}
            onClick={() => setTab("employment")}
          >
            <Briefcase size={16} /> Zatrudnienie
          </button>
          <button
            type="button"
            className={`profile-nav-item${tab === "limits" ? " active" : ""}`}
            onClick={() => setTab("limits")}
          >
            <FolderOpen size={16} /> Limity wniosków
          </button>
          <button
            type="button"
            className={`profile-nav-item${tab === "documents" ? " active" : ""}`}
            onClick={() => setTab("documents")}
          >
            <FileText size={16} /> Dokumenty
          </button>
        </aside>
        <div className="profile-body">
          {tab === "main" ? (
            <>
              <h2>Główne</h2>
              {canEdit ? (
                <form
                  id="edit-employee-form"
                  className="profile-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    save.mutate();
                  }}
                >
                  <div className="name-row">
                    <Field label="Imię">
                      <input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                      />
                    </Field>
                    <Field label="Nazwisko">
                      <input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </Field>
                  </div>
                  {employee.user_id ? (
                    <Field label="E-mail">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                      <span className="field-hint">
                        {employee.pending_email
                          ? `Oczekuje na potwierdzenie: ${employee.pending_email}`
                          : "Zmiana wymaga potwierdzenia linkiem wysłanym na nowy adres."}
                      </span>
                    </Field>
                  ) : null}
                  <Field label="Telefon">
                    <div className="phone-input">
                      <span className="phone-prefix">+48</span>
                      <input
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="123 456 789"
                      />
                    </div>
                  </Field>
                  <Field
                    label={
                      <span className="field-label-row">
                        Stanowisko domyślne
                        <span className="field-label-actions">
                          <button
                            type="button"
                            className="filter-link"
                            onClick={onAddPosition}
                          >
                            Dodaj
                          </button>
                          <span className="subtle"> albo </span>
                          <button
                            type="button"
                            className="filter-link"
                            onClick={onManagePositions}
                          >
                            Zarządzaj
                          </button>
                        </span>
                      </span>
                    }
                  >
                    <select
                      value={positionId}
                      onChange={(e) => setPositionId(e.target.value)}
                    >
                      <option value="">Bez stanowiska</option>
                      {positions.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label={
                      <span className="field-label-row">
                        Tagi
                        <span className="field-label-actions">
                          <button
                            type="button"
                            className="filter-link"
                            onClick={onAddTag}
                          >
                            Dodaj
                          </button>
                          <span className="subtle"> albo </span>
                          <button
                            type="button"
                            className="filter-link"
                            onClick={onManageTags}
                          >
                            Zarządzaj
                          </button>
                        </span>
                      </span>
                    }
                  >
                    <div className="tag-picker">
                      {tags.map((tag) => {
                        const selected = tagIds.includes(tag.id);
                        return (
                          <label
                            key={tag.id}
                            className={`tag-pick${selected ? " is-selected" : ""}`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={selected}
                              onChange={() => toggleTag(tag.id)}
                            />
                            {selected ? (
                              <span className="tag-pick-check" aria-hidden>
                                <Check size={12} strokeWidth={3} />
                              </span>
                            ) : null}
                            <span
                              className="tag-color-dot"
                              style={{
                                background: tag.color || DEFAULT_TAG_COLOR,
                              }}
                              aria-hidden
                            />
                            {tag.name}
                            {tag.is_informational ? (
                              <span className="subtle"> · info</span>
                            ) : null}
                          </label>
                        );
                      })}
                      {!tags.length && (
                        <span className="subtle">Wybierz lub dodaj nowe</span>
                      )}
                    </div>
                  </Field>
                  {isAdmin && employee.user_id ? (
                    <Field label="Rola">
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <span className="field-hint">{roleHint}</span>
                    </Field>
                  ) : null}
                  <Field label="Bezpośredni przełożony">
                    <select
                      value={supervisorId}
                      onChange={(e) => setSupervisorId(e.target.value)}
                    >
                      <option value="">Wybierz przełożonego</option>
                      {peers
                        .filter((peer) => peer.active)
                        .map((peer) => (
                          <option key={peer.id} value={peer.id}>
                            {peer.first_name} {peer.last_name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                    />{" "}
                    Karta aktywna
                  </label>
                </form>
              ) : (
                <dl className="detail-list">
                  <div>
                    <dt>Stanowisko</dt>
                    <dd>{employee.position || "—"}</dd>
                  </div>
                  <div>
                    <dt>Przełożony</dt>
                    <dd>{employee.supervisor_name || "—"}</dd>
                  </div>
                  <div>
                    <dt>Role</dt>
                    <dd>
                      {employee.roles?.map(roleLabel).join(", ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Tagi</dt>
                    <dd>
                      {employee.tags?.map((t) => t.name).join(", ") || "—"}
                    </dd>
                  </div>
                </dl>
              )}
            </>
          ) : tab === "employment" ? (
            <EmploymentPanel
              canEdit={canEdit}
              terms={terms}
              selectedFrom={selectedFrom}
              onSelectFrom={setSelectedFrom}
              activeTerm={activeTerm}
              dayParts={dayParts}
              onAddTerm={openAddTermModal}
              onRemoveTerm={removeActiveTerm}
              onEditTerm={openEditTermModal}
              onUpdateMinutes={updateActiveMinutes}
              onUpdateContract={updateActiveContract}
              onSave={() => save.mutate()}
              termModal={termModal}
              modalFrom={modalFrom}
              modalContract={modalContract}
              modalHours={modalHours}
              modalMinutes={modalMinutes}
              onModalFrom={setModalFrom}
              onModalContract={setModalContract}
              onModalHours={setModalHours}
              onModalMinutes={setModalMinutes}
              onConfirmTermModal={confirmTermModal}
              onCloseTermModal={() => setTermModal(null)}
            />
          ) : tab === "limits" ? (
            <RequestLimitsPanel
              canEdit={canEdit}
              leaveLimitsAllowed={leaveLimitsAllowed}
              leaveYears={leaveYears}
              customYears={customYears}
              leaveYear={leaveYear}
              customYear={customYear}
              leaveRows={limitDrafts.filter(
                (row) => row.category === "leave" && row.year === leaveYear,
              )}
              customRows={limitDrafts.filter(
                (row) =>
                  row.category === "custom" && row.year === customYear,
              )}
              canAddLeave={
                leaveLimitsAllowed &&
                limitYearChoices.some((y) => !usedLimitYears("leave").has(y))
              }
              canAddCustom={limitYearChoices.some(
                (y) => !usedLimitYears("custom").has(y),
              )}
              onSelectLeaveYear={setLeaveYear}
              onSelectCustomYear={setCustomYear}
              onAdd={(category) => openLimitYearModal(category, "add")}
              onRemove={removeLimitYear}
              onEditYear={(category) => openLimitYearModal(category, "edit")}
              onChange={updateLimitDraft}
              onSave={() => save.mutate()}
              limitYearModal={limitYearModal}
              limitModalYear={limitModalYear}
              limitYearChoices={limitYearChoices}
              usedYearsFor={usedLimitYears}
              onLimitModalYear={setLimitModalYear}
              onConfirmLimitYear={confirmLimitYearModal}
              onCloseLimitModal={() => setLimitYearModal(null)}
            />
          ) : (
            <DocumentsPanel employeeId={employee.id} canEdit={canEdit} />
          )}
        </div>
      </div>
    </Modal>
  );
}
