import { useState } from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  useOutletContext,
} from "react-router-dom";
import { Menu, X } from "lucide-react";
import type { User } from "../api";
import { navForUser, pathShowsFilters } from "../auth/roles";
import { FilterSidebar } from "./FilterSidebar";
import {
  FilterSidebarProvider,
  useFilterSidebarContent,
} from "./filterSidebarContext";
import { RcpClock } from "./RcpClock";
import { UserMenu } from "./UserMenu";

export function AppShell() {
  return (
    <FilterSidebarProvider>
      <AppShellInner />
    </FilterSidebarProvider>
  );
}

function AppShellInner() {
  const { user } = useOutletContext<{ user: User }>();
  const location = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const items = navForUser(user);
  const filterContent = useFilterSidebarContent();
  const showFilters =
    pathShowsFilters(location.pathname) || filterContent != null;

  return (
    <div className="app-shell">
      <header className="app-topnav">
        <div className="topnav-left">
          <button
            className="mobile-menu icon-button"
            onClick={() => setMobileNav(true)}
            aria-label="Otwórz menu"
          >
            <Menu size={22} />
          </button>
          <div className="brand">
            <span className="brand-mark">T</span>
            <span>TimeLogic</span>
          </div>
          <nav className="topnav-links" aria-label="Główna nawigacja">
            {items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                aria-label={item.label || "Strona główna"}
                title={item.label || "Strona główna"}
                className={({ isActive }) =>
                  `topnav-link ${isActive ? "active" : ""}${item.label ? "" : " icon-only"}`
                }
              >
                <item.icon size={16} strokeWidth={1.9} />
                {item.label || null}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="topnav-right">
          <RcpClock user={user} />
          <UserMenu user={user} />
        </div>
      </header>
      {mobileNav && (
        <>
          <button
            className="nav-scrim"
            onClick={() => setMobileNav(false)}
            aria-label="Zamknij menu"
          />
          <aside className="mobile-drawer" aria-label="Menu mobilne">
            <div className="brand">
              <span className="brand-mark">T</span>
              <span>TimeLogic</span>
              <button
                className="mobile-close icon-button"
                onClick={() => setMobileNav(false)}
                aria-label="Zamknij menu"
              >
                <X size={20} />
              </button>
            </div>
            <nav>
              {items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/"}
                  aria-label={item.label || "Strona główna"}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "active" : ""}`
                  }
                  onClick={() => setMobileNav(false)}
                >
                  <item.icon size={19} strokeWidth={1.8} />
                  {item.label ? <span>{item.label}</span> : null}
                </NavLink>
              ))}
            </nav>
          </aside>
        </>
      )}
      <div className={`app-body ${showFilters ? "with-filters" : ""}`}>
        {showFilters && <FilterSidebar>{filterContent}</FilterSidebar>}
        <main id="content" className="page">
          <div className="page-width">
            <Outlet context={{ user }} />
          </div>
        </main>
      </div>
    </div>
  );
}
