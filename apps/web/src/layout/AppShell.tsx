import { useState } from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  useOutletContext,
} from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu, X } from "lucide-react";
import { post, setCsrf, type User } from "../api";
import { navForUser, pathShowsFilters } from "../auth/roles";
import { FilterSidebar } from "./FilterSidebar";
import {
  FilterSidebarProvider,
  useFilterSidebarContent,
} from "./filterSidebarContext";
import { RcpClock } from "./RcpClock";

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
  const client = useQueryClient();
  const [mobileNav, setMobileNav] = useState(false);
  const items = navForUser(user);
  const filterContent = useFilterSidebarContent();
  const showFilters =
    pathShowsFilters(location.pathname) || filterContent != null;

  const logout = useMutation({
    mutationFn: () => post("/auth/logout", {}),
    onSuccess: () => {
      setCsrf(null);
      client.clear();
      window.location.assign("/login");
    },
  });

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
                className={({ isActive }) =>
                  `topnav-link ${isActive ? "active" : ""}`
                }
              >
                <item.icon size={16} strokeWidth={1.9} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="topnav-right">
          <RcpClock user={user} />
          <div className="topbar-user">
            <span className="avatar">{user.email[0].toUpperCase()}</span>
            <span className="user-email">{user.email}</span>
            <button
              className="icon-button"
              title="Wyloguj"
              aria-label="Wyloguj"
              onClick={() => logout.mutate()}
            >
              <LogOut size={18} />
            </button>
          </div>
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
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "active" : ""}`
                  }
                  onClick={() => setMobileNav(false)}
                >
                  <item.icon size={19} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </aside>
        </>
      )}
      <div className={`app-body ${showFilters ? "with-filters" : ""}`}>
        {showFilters && <FilterSidebar>{filterContent}</FilterSidebar>}
        <main id="content" className="page">
          <Outlet context={{ user }} />
        </main>
      </div>
    </div>
  );
}
