import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronDown, LogOut, UserRound } from "lucide-react";
import { post, setCsrf, type User } from "../api";

function displayName(user: User) {
  const full = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return full || user.email;
}

function initials(user: User) {
  const first = user.first_name?.[0];
  const last = user.last_name?.[0];
  if (first || last) return `${first || ""}${last || ""}`.toUpperCase();
  return user.email[0]?.toUpperCase() || "?";
}

export function UserMenu({ user }: { user: User }) {
  const client = useQueryClient();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const isAdmin = user.roles.includes("admin");
  const name = displayName(user);

  const logout = useMutation({
    mutationFn: () => post("/auth/logout", {}),
    onSuccess: () => {
      setCsrf(null);
      client.clear();
      window.location.assign("/login");
    },
  });

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (
        wrapRef.current &&
        event.target instanceof Node &&
        !wrapRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={wrapRef}>
      <button
        type="button"
        className={`user-menu-trigger${open ? " is-open" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="avatar">{initials(user)}</span>
        <span className="user-menu-name">{name}</span>
        <ChevronDown size={16} strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <div className="user-menu-dropdown" role="menu">
          <div className="user-menu-meta">
            <strong>{name}</strong>
            <span>{user.email}</span>
          </div>
          <Link
            to="/konto"
            className="user-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <UserRound size={16} strokeWidth={1.9} />
            Ustawienia konta
          </Link>
          {isAdmin ? (
            <Link
              to="/admin"
              className="user-menu-item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <Building2 size={16} strokeWidth={1.9} />
              Ustawienia organizacji
            </Link>
          ) : null}
          <div className="user-menu-sep" />
          <button
            type="button"
            className="user-menu-item is-danger"
            role="menuitem"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            <LogOut size={16} strokeWidth={1.9} />
            Wyloguj się
          </button>
        </div>
      ) : null}
    </div>
  );
}
