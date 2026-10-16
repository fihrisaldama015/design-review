import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert } from "components/alert";
import { Button } from "components/button";
import { Card } from "components/card";
import { Field } from "components/field";
import { Input } from "components/input";
import { PageHeader } from "components/page-header";
import { api, getSession, setSession } from "app/api";

export default function ChangePassword() {
  const navigate = useNavigate();
  const session = getSession();
  const forced = session.user.mustChangePassword;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const mismatch = again !== "" && again !== next ? "The two passwords are not the same." : "";
  const tooShort = next !== "" && next.length < 10 ? "Use at least 10 characters." : "";

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("POST", "/auth/password", { current, next });
      setSession({ ...session, user: { ...session.user, mustChangePassword: false } });
      navigate("/projects", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Change password" description={forced ? "You must choose a new password before you continue." : undefined} />
      <Card className="max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          {error && <Alert status="danger" kind="outlined">{error}</Alert>}
          <Field label="Current password" required>
            <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label="New password" required hint="At least 10 characters." error={tooShort}>
            <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field label="Repeat the new password" required error={mismatch}>
            <Input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
          </Field>
          <Button type="submit" status="primary" loading={busy} disabled={!current || next.length < 10 || next !== again}>Change password</Button>
        </form>
      </Card>
    </>
  );
}
