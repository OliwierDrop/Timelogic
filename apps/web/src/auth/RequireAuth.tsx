import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { setCsrf, type Me } from "../api";
import { PreferencesProvider } from "../preferences/PreferencesContext";
import { useMe } from "./useMe";

export function RequireAuth() {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) {
    return (
      <div className="center-state">
        <div className="brand brand-large">
          <span className="brand-mark">T</span> TimeLogic
        </div>
        <p>Ładowanie aplikacji…</p>
      </div>
    );
  }

  if (!me.data) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <PreferencesProvider initial={me.data.user.preferences}>
      <Outlet context={{ user: me.data.user, me: me.data }} />
    </PreferencesProvider>
  );
}

export function GuestOnly() {
  const me = useMe();
  const client = useQueryClient();

  if (me.isPending) {
    return (
      <div className="center-state">
        <div className="brand brand-large">
          <span className="brand-mark">T</span> TimeLogic
        </div>
        <p>Ładowanie aplikacji…</p>
      </div>
    );
  }

  if (me.data) {
    return <Navigate to="/" replace />;
  }

  return (
    <Outlet
      context={{
        onLogin: (data: Me) => {
          setCsrf(data.csrf_token);
          client.setQueryData(["me"], data);
        },
      }}
    />
  );
}
