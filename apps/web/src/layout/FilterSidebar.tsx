import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";

const STORAGE_KEY = "timelogic.filterSidebar.collapsed";

export function FilterSidebar({ children }: { children?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  if (collapsed) {
    return (
      <aside className="filter-panel filter-panel-collapsed" aria-label="Filtry">
        <button
          type="button"
          className="filter-expand-arrow"
          onClick={() => setCollapsed(false)}
          aria-expanded={false}
          aria-label="Pokaż filtry"
          title="Pokaż filtry"
        >
          <ChevronRight size={18} />
        </button>
        <button
          type="button"
          className="filter-collapsed-label"
          onClick={() => setCollapsed(false)}
          aria-label="Pokaż filtry"
        >
          <Filter size={16} />
          <span className="filter-vertical-text">Filtry</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="filter-panel" aria-label="Filtry">
      <div className="filter-panel-head">
        <Filter size={16} />
        <strong>Filtry</strong>
        <button
          type="button"
          className="filter-toggle filter-toggle-inline"
          onClick={() => setCollapsed(true)}
          aria-expanded={true}
          aria-label="Ukryj filtry"
          title="Ukryj filtry"
        >
          <ChevronLeft size={16} />
        </button>
      </div>
      <div className="filter-sidebar-body">{children}</div>
    </aside>
  );
}
