import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronUp, MoreHorizontal, Search } from "lucide-react";

type FilterGroupProps = {
  title: string;
  storageKey?: string;
  searchable?: boolean;
  manageable?: boolean;
  addLabel?: string;
  onAdd?: () => void;
  onManage?: () => void;
  children: ReactNode;
  /** Optional list filter — when provided, children is a render fn */
  filterItems?: (query: string) => ReactNode;
};

export function FilterGroup({
  title,
  storageKey,
  searchable = false,
  manageable = false,
  addLabel,
  onAdd,
  onManage,
  children,
  filterItems,
}: FilterGroupProps) {
  const key = storageKey || `timelogic.filterGroup.${title}`;
  const [open, setOpen] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? true : raw === "1";
    } catch {
      return true;
    }
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchId = useId();

  useEffect(() => {
    try {
      localStorage.setItem(key, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [key, open]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [menuOpen]);

  const body = useMemo(() => {
    if (filterItems) return filterItems(searchOpen ? query : "");
    return children;
  }, [children, filterItems, query, searchOpen]);

  return (
    <div className={`filter-group ${open ? "is-open" : "is-collapsed"}`}>
      <div className="filter-group-toolbar">
        <h3>{title}</h3>
        <div className="filter-group-actions">
          {manageable && (
            <div className="filter-menu" ref={menuRef}>
              <button
                type="button"
                className={`filter-icon-btn ${menuOpen ? "active" : ""}`}
                aria-label={`Więcej opcji: ${title}`}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreHorizontal size={15} />
              </button>
              {menuOpen && (
                <div className="filter-menu-popover" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onAdd?.();
                    }}
                  >
                    Dodaj
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onManage?.();
                    }}
                  >
                    Zarządzaj
                  </button>
                </div>
              )}
            </div>
          )}
          {searchable && (
            <button
              type="button"
              className={`filter-icon-btn ${searchOpen ? "active" : ""}`}
              aria-label={`Szukaj w: ${title}`}
              aria-pressed={searchOpen}
              onClick={() => {
                setSearchOpen((v) => {
                  if (v) setQuery("");
                  return !v;
                });
              }}
            >
              <Search size={14} />
            </button>
          )}
          <button
            type="button"
            className="filter-icon-btn"
            aria-label={open ? `Zwiń: ${title}` : `Rozwiń: ${title}`}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="filter-group-body">
          {searchOpen && searchable && (
            <label className="filter-group-search" htmlFor={searchId}>
              <Search size={14} />
              <input
                id={searchId}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtruj…"
                autoFocus
              />
            </label>
          )}
          {body}
          {manageable && addLabel && onAdd && (
            <button
              type="button"
              className="filter-add-link"
              onClick={onAdd}
            >
              + {addLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
