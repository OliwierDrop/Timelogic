import { useMemo, useState, type CSSProperties } from "react";
import type { Employee, Position, Tag } from "../../api";
import { FilterGroup } from "../../layout/FilterGroup";
import { DEFAULT_TAG_COLOR } from "../../tags";
import { matchesQuery, ROLE_OPTIONS, roleLabel } from "../team/roles";
import { employeeInitials } from "./WizardShell";

export function filterWizardEmployees(
  employees: Employee[],
  {
    search,
    role,
    tagId,
    positionId,
  }: {
    search: string;
    role: string;
    tagId: string;
    positionId: string;
  },
) {
  const q = search.trim().toLowerCase();
  return employees.filter((employee) => {
    if (role && !employee.roles.includes(role)) return false;
    if (tagId && !(employee.tag_ids || []).includes(tagId)) return false;
    if (positionId && employee.position_id !== positionId) return false;
    if (!q) return true;
    const hay = `${employee.first_name} ${employee.last_name} ${employee.roles.map(roleLabel).join(" ")}`.toLowerCase();
    return hay.includes(q);
  });
}

export function WizardFilterSidebar({
  tags,
  positions,
  search,
  role,
  tagId,
  positionId,
  onSearch,
  onRole,
  onTag,
  onPosition,
}: {
  tags: Tag[];
  positions: Position[];
  search: string;
  role: string;
  tagId: string;
  positionId: string;
  onSearch: (value: string) => void;
  onRole: (value: string) => void;
  onTag: (value: string) => void;
  onPosition: (value: string) => void;
}) {
  return (
    <div className="wizard-filters">
      <label className="wizard-search">
        <span className="sr-only">Szukaj</span>
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Szukaj"
        />
      </label>
      <FilterGroup
        title="Role"
        storageKey="timelogic.wizard.fg.roles"
        searchable
        filterItems={(q) => (
          <>
            {matchesQuery("Wszyscy", q) ? (
              <button
                type="button"
                className={`filter-item${role === "" ? " active" : ""}`}
                onClick={() => onRole("")}
              >
                Wszyscy
              </button>
            ) : null}
            {ROLE_OPTIONS.filter((item) => matchesQuery(item.label, q)).map(
              (item) => (
                <button
                  key={item.code}
                  type="button"
                  className={`filter-item${role === item.code ? " active" : ""}`}
                  onClick={() => onRole(item.code)}
                >
                  {item.label}
                </button>
              ),
            )}
          </>
        )}
      >
        {null}
      </FilterGroup>
      <FilterGroup
        title="Tagi"
        storageKey="timelogic.wizard.fg.tags"
        searchable
        filterItems={(q) => (
          <>
            {matchesQuery("Wszystkie", q) ? (
              <button
                type="button"
                className={`filter-item${tagId === "" ? " active" : ""}`}
                onClick={() => onTag("")}
              >
                Wszystkie
              </button>
            ) : null}
            {tags
              .filter((tag) => matchesQuery(tag.name, q))
              .map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={`filter-item${tagId === tag.id ? " active" : ""}`}
                  onClick={() => onTag(tag.id)}
                >
                  <span
                    className="tag-dot"
                    style={{ background: tag.color || DEFAULT_TAG_COLOR }}
                  />
                  {tag.name}
                </button>
              ))}
            {!tags.length ? (
              <span className="subtle">Brak tagów</span>
            ) : null}
          </>
        )}
      >
        {null}
      </FilterGroup>
      <FilterGroup
        title="Stanowiska"
        storageKey="timelogic.wizard.fg.positions"
        searchable
        filterItems={(q) => (
          <>
            {matchesQuery("Wszystkie", q) ? (
              <button
                type="button"
                className={`filter-item${positionId === "" ? " active" : ""}`}
                onClick={() => onPosition("")}
              >
                Wszystkie
              </button>
            ) : null}
            {positions
              .filter((row) => matchesQuery(row.name, q))
              .map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={`filter-item${positionId === row.id ? " active" : ""}`}
                  onClick={() => onPosition(row.id)}
                >
                  {row.name}
                </button>
              ))}
            {!positions.length ? (
              <span className="subtle">Brak stanowisk</span>
            ) : null}
          </>
        )}
      >
        {null}
      </FilterGroup>
    </div>
  );
}

export function WizardSelectedSidebar({
  employees,
  selectedIds,
  heading = "Dla zespołu",
}: {
  employees: Employee[];
  selectedIds: string[];
  heading?: string;
}) {
  const selected = useMemo(
    () => employees.filter((row) => selectedIds.includes(row.id)),
    [employees, selectedIds],
  );
  return (
    <div className="wizard-selected">
      <h3>{heading}</h3>
      <div className="wizard-selected-list">
        {selected.map((employee) => (
          <div key={employee.id} className="wizard-person-chip">
            <span className="avatar avatar-sm">
              {employeeInitials(employee.first_name, employee.last_name)}
            </span>
            <span>
              {employee.first_name} {employee.last_name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WizardEmployeeTable({
  employees,
  selectedIds,
  onToggle,
  onToggleAll,
  onClear,
}: {
  employees: Employee[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onClear: () => void;
}) {
  const allSelected =
    employees.length > 0 &&
    employees.every((row) => selectedIds.includes(row.id));
  const count = selectedIds.length;

  return (
    <div className="wizard-employee-picker">
      <div className="wizard-picker-head">
        <h3>Wybierz pracownika/ów</h3>
        <div className="wizard-picker-meta">
          <span>
            {count} zaznaczonych
            {count > 0 ? (
              <>
                {" "}
                |{" "}
                <button type="button" className="filter-link" onClick={onClear}>
                  Odznacz
                </button>
              </>
            ) : null}
          </span>
        </div>
      </div>
      <div className="table-scroll team-table wizard-employee-table-wrap">
        <table className="wizard-employee-table">
          <thead>
            <tr>
              <th className="col-check">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  aria-label="Zaznacz wszystkich widocznych"
                />
              </th>
              <th>Imię i nazwisko</th>
              <th>Rola i tagi</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => {
              const checked = selectedIds.includes(employee.id);
              const roles = employee.roles?.length
                ? employee.roles
                : ["employee"];
              return (
                <tr
                  key={employee.id}
                  className={checked ? "is-selected" : undefined}
                  onClick={() => onToggle(employee.id)}
                >
                  <td className="col-check" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(employee.id)}
                    />
                  </td>
                  <td>
                    <div className="person-cell">
                      <span className="avatar">
                        {employeeInitials(
                          employee.first_name,
                          employee.last_name,
                        )}
                      </span>
                      <div>
                        <strong>
                          {employee.first_name} {employee.last_name}
                        </strong>
                        {employee.email ? (
                          <span className="subtle">{employee.email}</span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="badge-row">
                      {roles.map((code) => (
                        <span className="role-badge" key={code}>
                          {roleLabel(code)}
                        </span>
                      ))}
                      {(employee.tags || []).map((tag) => (
                        <span
                          className={`tag-badge${tag.is_informational ? " is-info" : ""}`}
                          key={tag.id}
                          style={
                            {
                              "--tag-color": tag.color || DEFAULT_TAG_COLOR,
                            } as CSSProperties
                          }
                        >
                          {tag.name}
                        </span>
                      ))}
                      {!roles.length && !(employee.tags || []).length ? (
                        <span className="subtle">—</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!employees.length ? (
          <p className="subtle wizard-empty">Brak pracowników dla filtrów.</p>
        ) : null}
      </div>
    </div>
  );
}

export function useWizardPeopleState(seedIds: string[] = []) {
  const [selected, setSelected] = useState<string[]>(seedIds);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [tagId, setTagId] = useState("");
  const [positionId, setPositionId] = useState("");

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );

  const clear = () => setSelected([]);

  return {
    selected,
    setSelected,
    search,
    setSearch,
    role,
    setRole,
    tagId,
    setTagId,
    positionId,
    setPositionId,
    toggle,
    clear,
  };
}
