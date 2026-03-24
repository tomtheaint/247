import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Layout } from "./components/Layout/Layout";
import { LandingPage } from "./pages/Landing";
import { LoginPage } from "./pages/Login";
import { RegisterPage } from "./pages/Register";
import { DashboardPage } from "./pages/Dashboard";
import { CalendarPage } from "./pages/Calendar";
import { GoalsPage } from "./pages/Goals";
import { TracksPage } from "./pages/Tracks";
import { CommunityPage } from "./pages/Community";
import { SettingsPage } from "./pages/Settings";
import { AdminPage } from "./pages/Admin";
import { ReviewerPage } from "./pages/Reviewer";
import { RecurringEventsPage } from "./pages/RecurringEvents";
import { useAuthStore } from "./store/authStore";
import type { UserRole } from "./types";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuthStore();
  if (!accessToken) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireRole({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (!user || !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const { loadUser } = useAuthStore();
  useEffect(() => { loadUser(); }, [loadUser]);

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ className: "dark:bg-gray-800 dark:text-white" }} />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/tracks" element={<TracksPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/recurring" element={<RecurringEventsPage />} />
          <Route path="/admin" element={<RequireRole roles={["ADMIN"]}><AdminPage /></RequireRole>} />
          <Route path="/reviewer" element={<RequireRole roles={["ADMIN", "REVIEWER"]}><ReviewerPage /></RequireRole>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
