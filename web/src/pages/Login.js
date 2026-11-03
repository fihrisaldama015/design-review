import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { GitCompare, Gavel, Monitor, Upload } from "lucide-react";
import { Alert } from "components/alert";
import { Button } from "components/button";
import { Card } from "components/card";
import { Field } from "components/field";
import { Input } from "components/input";
import { api, getSession, rememberTemporaryPassword, setSession } from "app/api";

export default function Login() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(state?.expired ? "Your session expired. Log in again." : "");
  const [busy, setBusy] = useState(false);

  if (getSession()?.token) return <Navigate to="/projects" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { token, user } = await api("POST", "/auth/login", { email, password });
      setSession({ token, user });
      rememberTemporaryPassword(user.mustChangePassword ? password : null);
      navigate(user.mustChangePassword ? "/password" : "/projects", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <div className="flex flex-col justify-center gap-8 bg-surface-lv1 p-page-padding md:p-16">
        <div className="flex items-center gap-3">
          <GitCompare size={32} className="text-primary" />
          <span className="typo-semi-bold-text-lg">Design review</span>
        </div>
        <div className="flex max-w-md flex-col gap-2">
          <h1 className="typo-semi-bold-text-lg">Decide what happens when Figma and the code differ</h1>
          <p className="text-caption typo-regular-text-sm">Nothing changes in the app until someone decides. Every decision is saved with who made it and why.</p>
        </div>
        <ul className="flex max-w-md flex-col gap-4">
          <li className="flex items-start gap-3"><Upload size={20} className="mt-0.5 shrink-0 text-primary opacity-70" /><span className="typo-regular-text-sm">The developer sends a review when a component differs from Figma.</span></li>
          <li className="flex items-start gap-3"><Monitor size={20} className="mt-0.5 shrink-0 text-primary opacity-70" /><span className="typo-regular-text-sm">You see what it touches, with the app next to the Figma version.</span></li>
          <li className="flex items-start gap-3"><Gavel size={20} className="mt-0.5 shrink-0 text-primary opacity-70" /><span className="typo-regular-text-sm">You choose what to do, and the developer applies it.</span></li>
        </ul>
      </div>
      <div className="flex items-center justify-center p-page-padding">
        <Card title="Log in" description="Use the account an admin made for you." className="w-full max-w-sm">
          <form onSubmit={submit} className="flex flex-col gap-4">
            {error && <Alert status="danger" kind="outlined">{error}</Alert>}
            <Field label="Email" required>
              <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password" required hint="A new account starts with a temporary password: you change it after logging in.">
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Button type="submit" status="primary" loading={busy} disabled={!email || !password}>Log in</Button>
            <p className="text-caption typo-regular-text-sm">No account, or forgot the password? Ask an admin of your project.</p>
          </form>
        </Card>
      </div>
    </div>
  );
}
