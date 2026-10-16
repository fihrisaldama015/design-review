import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Alert } from "components/alert";
import { Button } from "components/button";
import { Card } from "components/card";
import { Field } from "components/field";
import { Input } from "components/input";
import { api, getSession, setSession } from "app/api";

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
      navigate(user.mustChangePassword ? "/password" : "/projects", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-page-padding">
      <Card title="Log in to design review" className="w-full max-w-sm">
        <form onSubmit={submit} className="flex flex-col gap-4">
          {error && <Alert status="danger" kind="outlined">{error}</Alert>}
          <Field label="Email" required>
            <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password" required>
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" status="primary" loading={busy} disabled={!email || !password}>Log in</Button>
        </form>
      </Card>
    </div>
  );
}
