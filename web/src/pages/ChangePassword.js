import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert } from "components/alert";
import { Button } from "components/button";
import { Card } from "components/card";
import { Field } from "components/field";
import { Input } from "components/input";
import { PageHeader } from "components/page-header";
import { api, forgetTemporaryPassword, getSession, getTemporaryPassword, setSession } from "app/api";

export default function ChangePassword() {
  const navigate = useNavigate();
  const session = getSession();
  const forced = session.user.mustChangePassword;
  // A new account has just typed its temporary password to log in: it is kept in memory, so it is not asked a second time.
  const [known] = useState(() => (forced ? getTemporaryPassword() : null));
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const oldPassword = known ?? current;
  const same = next !== "" && next === oldPassword ? "Choose a different password than the current one." : "";
  const mismatch = again !== "" && again !== next ? "The two passwords are not the same." : "";
  const tooShort = next !== "" && next.length < 10 ? "Use at least 10 characters." : "";

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("POST", "/auth/password", { current: oldPassword, next });
      forgetTemporaryPassword();
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
      <PageHeader
        title={forced ? "Choose your own password" : "Change password"}
        description={forced
          ? (known
            ? `Welcome${session.user.name ? `, ${session.user.name}` : ""}. Your account has a temporary password. Choose your own before you continue; the temporary one stops working.`
            : "Your account has a temporary password. Enter it below, then choose your own before you continue.")
          : undefined}
      />
      <Card className="max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          {error && <Alert status="danger" kind="outlined">{error}</Alert>}
          {known === null && (
            <Field label={forced ? "Temporary password" : "Current password"} required hint={forced ? "The password you logged in with." : undefined}>
              <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </Field>
          )}
          <Field label="New password" required hint="At least 10 characters." error={tooShort || same}>
            <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field label="Type the new password again" required error={mismatch}>
            <Input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
          </Field>
          <Button type="submit" status="primary" loading={busy} disabled={!oldPassword || next.length < 10 || next !== again || Boolean(same)}>{forced ? "Save password and continue" : "Change password"}</Button>
        </form>
      </Card>
    </>
  );
}
