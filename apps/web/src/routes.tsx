import { Navigate, Route, Routes } from "react-router-dom";
import { GuestOnly, RequireAuth } from "./auth/RequireAuth";
import { RequireRole } from "./auth/RequireRole";
import { AppShell } from "./layout/AppShell";
import { AccountPage } from "./pages/AccountPage";
import { AdminPage } from "./pages/AdminPage";
import { CorrectionsPage } from "./pages/CorrectionsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LeavesPage } from "./pages/LeavesPage";
import { LoginPage } from "./pages/LoginPage";
import { ConfirmEmailPage } from "./pages/ConfirmEmailPage";
import { PasswordPage } from "./pages/PasswordPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SchedulesPage } from "./pages/SchedulesPage";
import { TeamPage } from "./pages/TeamPage";
import { TimePage } from "./pages/TimePage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route path="/set-password" element={<PasswordPage />} />
      <Route path="/confirm-email" element={<ConfirmEmailPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="czas" element={<TimePage />} />
          <Route path="grafiki" element={<SchedulesPage />} />
          <Route path="wnioski" element={<LeavesPage />} />
          <Route path="konto" element={<AccountPage />} />
          <Route element={<RequireRole roles={["manager", "hr", "admin"]} />}>
            <Route path="pracownicy" element={<TeamPage />} />
            <Route path="korekty" element={<CorrectionsPage />} />
            <Route path="raporty" element={<ReportsPage />} />
          </Route>
          <Route element={<RequireRole roles={["admin"]} />}>
            <Route path="admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
