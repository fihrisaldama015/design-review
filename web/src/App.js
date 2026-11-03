import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { GitCompare, KeyRound, LogOut } from "lucide-react";
import { Avatar } from "components/avatar";
import { Badge } from "components/badge";
import { Button } from "components/button";
import { clearSession, getSession } from "app/api";
import Login from "pages/Login";
import ChangePassword from "pages/ChangePassword";
import Guide from "pages/Guide";
import Projects from "pages/Projects";
import ProjectDetail from "pages/ProjectDetail";

const navClass = ({ isActive }) => `rounded-default px-3 py-1.5 typo-medium-text-sm transition-colors ${isActive ? "bg-surface-lv1 text-primary" : "text-default hover:bg-surface-lv1"}`;

/** Shell: a top bar with the product, Projects and the Guide, the current user (with their role) and Log out. */
function Shell() {
  const navigate = useNavigate();
  const session = getSession();
  const logout = () => {
    clearSession();
    navigate("/login");
  };
  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-default bg-surface px-page-padding py-3">
        <nav className="flex items-center gap-2">
          <Link to="/projects" className="mr-4 flex items-center gap-2 typo-semi-bold-text-base">
            <GitCompare size={22} className="text-primary" />
            Design review
          </Link>
          <NavLink to="/projects" className={navClass}>Projects</NavLink>
          <NavLink to="/guide" className={navClass}>Guide</NavLink>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Avatar name={session?.user?.name || "?"} size="sm" />
            <div className="flex flex-col leading-tight">
              <span className="typo-medium-text-sm">{session?.user?.name}</span>
              <span className="text-caption typo-regular-text-sm">{session?.user?.email}</span>
            </div>
            <Badge tone={session?.user?.role === "admin" ? "info" : "neutral"} dot={false}>{session?.user?.role === "admin" ? "Admin" : "Reviewer"}</Badge>
          </div>
          <Button as={Link} to="/password" kind="text" size="sm" prefixIcon={<KeyRound />}>Change password</Button>
          <Button kind="text" size="sm" prefixIcon={<LogOut />} onClick={logout}>Log out</Button>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-6 p-page-padding">
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
          <Route path="/guide" element={<Guide />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}
