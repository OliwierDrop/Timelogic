import { Navigate, Outlet, useOutletContext } from "react-router-dom";
import type { User } from "../api";
import { type AppRole, hasAnyRole } from "./roles";

type AuthContext = { user: User };

export function RequireRole({ roles }: { roles: AppRole[] }) {
  const { user } = useOutletContext<AuthContext>();
  if (!hasAnyRole(user, roles)) {
    return <Navigate to="/" replace state={{ forbidden: true }} />;
  }
  return <Outlet context={{ user }} />;
}
