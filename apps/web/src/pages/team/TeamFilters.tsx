import { Search } from "lucide-react";
import type { Position, Tag } from "../../api";
import { FilterGroup } from "../../layout/FilterGroup";
import { DEFAULT_TAG_COLOR } from "../../tags";
import { matchesQuery, ROLE_OPTIONS } from "./roles";

export function TeamFilters({
  search,
  status,
  roleFilter,
  tagFilter,
  positionFilter,
  canEdit,
  tags,
  positions,
  onSearch,
  onStatus,
  onRoleFilter,
  onTagFilter,
  onPositionFilter,
  onAddTag,
  onManageTags,
  onAddPosition,
  onManagePositions,
}: {
  search: string;
  status: "all" | "active" | "invited" | "inactive";
  roleFilter: string;
  tagFilter: string;
  positionFilter: string;
  canEdit: boolean;
  tags: Tag[];
  positions: Position[];
  onSearch: (value: string) => void;
  onStatus: (value: "all" | "active" | "invited" | "inactive") => void;
  onRoleFilter: (value: string) => void;
  onTagFilter: (value: string) => void;
  onPositionFilter: (value: string) => void;
  onAddTag: () => void;
  onManageTags: () => void;
  onAddPosition: () => void;
  onManagePositions: () => void;
}) {
  return (
    <>
      <div className="filter-search">
        <Search size={16} />
        <input
          aria-label="Szukaj pracownika"
          placeholder="Szukaj…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      <FilterGroup title="Pracownicy" storageKey="timelogic.fg.pracownicy">
        {(
          [
            ["all", "Wszyscy"],
            ["active", "Aktywni"],
            ["invited", "Zaproszeni"],
            ["inactive", "Nieaktywni"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`filter-item ${status === value ? "active" : ""}`}
            onClick={() => onStatus(value)}
          >
            {label}
          </button>
        ))}
      </FilterGroup>

      <FilterGroup
        title="Role"
        storageKey="timelogic.fg.role"
        searchable
        filterItems={(q) => (
          <>
            {matchesQuery("Wszystkie", q) && (
              <button
                type="button"
                className={`filter-item ${roleFilter === "" ? "active" : ""}`}
                onClick={() => onRoleFilter("")}
              >
                Wszystkie
              </button>
            )}
            {ROLE_OPTIONS.filter((role) => matchesQuery(role.label, q)).map(
              (role) => (
                <button
                  key={role.code}
                  type="button"
                  className={`filter-item ${roleFilter === role.code ? "active" : ""}`}
                  onClick={() =>
                    onRoleFilter(roleFilter === role.code ? "" : role.code)
                  }
                >
                  {role.label}
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
        storageKey="timelogic.fg.tagi"
        searchable
        manageable={canEdit}
        addLabel="Dodaj tag"
        onAdd={onAddTag}
        onManage={onManageTags}
        filterItems={(q) => (
          <>
            {matchesQuery("Wszystkie", q) && (
              <button
                type="button"
                className={`filter-item ${tagFilter === "" ? "active" : ""}`}
                onClick={() => onTagFilter("")}
              >
                Wszystkie
              </button>
            )}
            {tags
              .filter((tag) => matchesQuery(tag.name, q))
              .map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={`filter-item ${tagFilter === tag.id ? "active" : ""}`}
                  onClick={() =>
                    onTagFilter(tagFilter === tag.id ? "" : tag.id)
                  }
                >
                  <span
                    className="tag-color-dot"
                    style={{ background: tag.color || DEFAULT_TAG_COLOR }}
                    aria-hidden
                  />
                  {tag.name}
                  {tag.is_informational ? (
                    <span className="subtle"> · info</span>
                  ) : null}
                </button>
              ))}
            {!tags.length && <p className="subtle">Brak tagów.</p>}
          </>
        )}
      >
        {null}
      </FilterGroup>

      <FilterGroup
        title="Stanowiska"
        storageKey="timelogic.fg.stanowiska"
        searchable
        manageable={canEdit}
        addLabel="Dodaj stanowisko"
        onAdd={onAddPosition}
        onManage={onManagePositions}
        filterItems={(q) => (
          <>
            {matchesQuery("Wszystkie", q) && (
              <button
                type="button"
                className={`filter-item ${positionFilter === "" ? "active" : ""}`}
                onClick={() => onPositionFilter("")}
              >
                Wszystkie
              </button>
            )}
            {positions
              .filter((row) => matchesQuery(row.name, q))
              .map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={`filter-item ${positionFilter === row.id ? "active" : ""}`}
                  onClick={() =>
                    onPositionFilter(
                      positionFilter === row.id ? "" : row.id,
                    )
                  }
                >
                  {row.name}
                </button>
              ))}
            {!positions.length && (
              <p className="subtle">Brak stanowisk.</p>
            )}
          </>
        )}
      >
        {null}
      </FilterGroup>
    </>
  );
}
