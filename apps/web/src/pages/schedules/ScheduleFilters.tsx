import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { LeaveType, Position, Shift, Tag } from "../../api";
import { FilterGroup } from "../../layout/FilterGroup";
import { DEFAULT_TAG_COLOR } from "../../tags";
import { matchesQuery } from "../team/roles";
import { KIND_LABELS } from "./dateUtils";
import type { ScheduleViewTab } from "./scheduleViewTab";

export function ScheduleFilters({
  canPlan,
  viewTab,
  search,
  mode,
  draftOnly,
  kindFilter,
  leaveTypeFilter,
  tagFilter,
  positionFilter,
  tags,
  positions,
  leaveTypes,
  onSearch,
  onMode,
  onNavigate,
  onDraftOnly,
  onKindFilter,
  onLeaveTypeFilter,
  onTagFilter,
  onPositionFilter,
}: {
  canPlan: boolean;
  viewTab: ScheduleViewTab;
  search: string;
  mode: "week" | "month";
  draftOnly: boolean;
  kindFilter: "all" | Shift["kind"];
  leaveTypeFilter: string;
  tagFilter: string;
  positionFilter: string;
  tags: Tag[];
  positions: Position[];
  leaveTypes: LeaveType[];
  onSearch: (value: string) => void;
  onMode: (value: "week" | "month") => void;
  onNavigate: (delta: number) => void;
  onDraftOnly: (value: boolean) => void;
  onKindFilter: (value: "all" | Shift["kind"]) => void;
  onLeaveTypeFilter: (value: string) => void;
  onTagFilter: (value: string) => void;
  onPositionFilter: (value: string) => void;
}) {
  const showShiftFilters = viewTab === "all" || viewTab === "shifts";
  const showLeaveTypeFilter = viewTab === "all" || viewTab === "leaves";

  return (
    <>
      {canPlan && (
        <div className="filter-search">
          <Search size={16} />
          <input
            aria-label="Szukaj pracownika"
            placeholder="Szukaj…"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
        </div>
      )}
      <FilterGroup title="Zakres dat" storageKey="timelogic.schedules.fg.zakres">
        {(
          [
            ["week", "Tydzień"],
            ["month", "Miesiąc"],
          ] as const
        ).map(([value, label]) => {
          const active = mode === value;
          return (
            <div
              key={value}
              className={`filter-range-row ${active ? "active" : ""}`}
            >
              <button
                type="button"
                className={`filter-item ${active ? "active" : ""}`}
                onClick={() => onMode(value)}
              >
                {label}
              </button>
              {active && (
                <div className="filter-range-arrows">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Poprzedni okres"
                    onClick={() => onNavigate(-1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Następny okres"
                    onClick={() => onNavigate(1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </FilterGroup>
      {canPlan && showShiftFilters && (
        <FilterGroup title="Widok" storageKey="timelogic.schedules.fg.widok">
          <button
            type="button"
            className={`filter-item ${!draftOnly ? "active" : ""}`}
            onClick={() => onDraftOnly(false)}
          >
            Wszystkie
          </button>
          <button
            type="button"
            className={`filter-item ${draftOnly ? "active" : ""}`}
            onClick={() => onDraftOnly(true)}
          >
            Tylko nieopublikowane
          </button>
        </FilterGroup>
      )}
      {showShiftFilters && (
        <FilterGroup
          title="Grafiki pracy"
          storageKey="timelogic.schedules.fg.rodzaje"
        >
          {(
            [
              ["all", "Wszystkie"],
              ["standard", KIND_LABELS.standard],
              ["flexible", KIND_LABELS.flexible],
              ["on_call", KIND_LABELS.on_call],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`filter-item ${kindFilter === value ? "active" : ""}`}
              onClick={() => onKindFilter(value)}
            >
              {label}
            </button>
          ))}
        </FilterGroup>
      )}
      {showLeaveTypeFilter && (
        <FilterGroup
          title="Typ wniosku"
          storageKey="timelogic.schedules.fg.leave-type"
          searchable
          filterItems={(q) => (
            <>
              {matchesQuery("Wszystkie", q) && (
                <button
                  type="button"
                  className={`filter-item ${leaveTypeFilter === "" ? "active" : ""}`}
                  onClick={() => onLeaveTypeFilter("")}
                >
                  Wszystkie
                </button>
              )}
              {leaveTypes
                .filter((type) => matchesQuery(type.name, q))
                .map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    className={`filter-item ${leaveTypeFilter === type.id ? "active" : ""}`}
                    onClick={() =>
                      onLeaveTypeFilter(
                        leaveTypeFilter === type.id ? "" : type.id,
                      )
                    }
                  >
                    {type.name}
                  </button>
                ))}
              {!leaveTypes.length && (
                <p className="subtle">Brak typów wniosków.</p>
              )}
            </>
          )}
        >
          {null}
        </FilterGroup>
      )}
      {canPlan && (
        <>
          <FilterGroup
            title="Tagi"
            storageKey="timelogic.schedules.fg.tagi"
            searchable
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
                        style={{
                          background: tag.color || DEFAULT_TAG_COLOR,
                        }}
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
            storageKey="timelogic.schedules.fg.stanowiska"
            searchable
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
      )}
    </>
  );
}
