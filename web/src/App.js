import { useEffect, useState } from "react";
import { Link, Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { KeyRound, LogOut } from "lucide-react";
import { Button } from "components/button";
import { clearSession, getSession } from "app/api";
import Login from "pages/Login";
import ChangePassword from "pages/ChangePassword";
import Projects from "pages/Projects";
import ProjectDetail from "pages/ProjectDetail";

/** Shell: a top bar with Projects, the current user and Log out. */
function Shell() {
  const navigate = useNavigate();
  const session = getSession();
  const logout = () => {
    clearSession();
    navigate("/login");
  };
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between gap-4 border-b border-default bg-surface px-page-padding py-3">
        <nav className="flex items-center gap-6">
          <span className="typo-semi-bold-text-base">Design review</span>
          <Link to="/projects" className="typo-medium-text-sm text-primary">Projects</Link>
        </nav>
        <div className="flex items-center gap-3">
          <span className="typo-regular-text-sm text-caption">{session?.user?.name} ({session?.user?.email})</span>
          <Button as={Link} to="/password" kind="text" size="sm" prefixIcon={<KeyRound />}>Change password</Button>
          <Button kind="text" size="sm" prefixIcon={<LogOut />} onClick={logout}>Log out</Button>
        </div>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-page-padding">
        <Outlet />
      </main>
    </div>
  );
}

/** Needs a session; a user who must change the password goes to /password first. */
function RequireSession({ allowPasswordPage = false }) {
  const session = getSession();
  if (!session?.token) return <Navigate to="/login" replace />;
  if (session.user.mustChangePassword && !allowPasswordPage) return <Navigate to="/password" replace />;
  return <Outlet />;
}

export default function App() {
  const navigate = useNavigate();
  const [, bump] = useState(0);
  useEffect(() => {
    const onExpired = () => {
      bump((n) => n + 1);
      navigate("/login", { state: { expired: true } });
    };
    window.addEventListener("dr-unauthorized", onExpired);
    return () => window.removeEventListener("dr-unauthorized", onExpired);
  }, [navigate]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireSession allowPasswordPage />}>
        <Route element={<Shell />}>
          <Route path="/password" element={<ChangePassword />} />
        </Route>
      </Route>
      <Route element={<RequireSession />}>
        <Route element={<Shell />}>
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:key" element={<ProjectDetail />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}
