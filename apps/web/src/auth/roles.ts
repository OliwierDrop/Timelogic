import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  Clock3,
  FileText,
  Home,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { User } from "../api";

export type AppRole = "employee" | "manager" | "hr" | "admin";

export type AppPath =
  | "/"
  | "/czas"
  | "/pracownicy"
  | "/grafiki"
  | "/wnioski"
  | "/korekty"
  | "/raporty";

export type NavItem = {
  path: AppPath;
  label: string;
  icon: LucideIcon;
  roles?: AppRole[];
};

/** Brak `roles` = dostępne dla każdego zalogowanego. */
export const NAV_ITEMS: NavItem[] = [
  { path: "/", label: "", icon: Home },
  { path: "/czas", label: "Mój czas", icon: Clock3 },
  {
    path: "/pracownicy",
    label: "Pracownicy",
    icon: Users,
    roles: ["manager", "hr", "admin"],
  },
  { path: "/grafiki", label: "Kalendarz", icon: CalendarDays },
  { path: "/wnioski", label: "Wnioski", icon: FileText },
  {
    path: "/korekty",
    label: "Korekty",
    icon: CalendarClock,
    roles: ["manager", "hr", "admin"],
  },
  {
    path: "/raporty",
    label: "Raporty",
    icon: BarChart3,
    roles: ["manager", "hr", "admin"],
  },
];

export function hasAnyRole(user: User, allowed: AppRole[]) {
  return user.roles.some((role) => allowed.includes(role as AppRole));
}

export function canAccessPath(user: User, path: string) {
  const item = NAV_ITEMS.find((nav) => nav.path === path);
  if (!item) return false;
  if (!item.roles) return true;
  return hasAnyRole(user, item.roles);
}

export function navForUser(user: User) {
  return NAV_ITEMS.filter((item) => canAccessPath(user, item.path));
}

export function pathShowsFilters(pathname: string) {
  return (
    pathname === "/pracownicy" ||
    pathname === "/grafiki" ||
    pathname === "/wnioski" ||
    pathname === "/korekty"
  );
}
