import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, UserPlus, Users } from "lucide-react";
import { Alert } from "components/alert";
import { Avatar } from "components/avatar";
import { Button } from "components/button";
import { Card } from "components/card";
import { ConfirmDialog } from "components/confirm-dialog";
import { DataTable } from "components/data-table";
import { EmptyState } from "components/empty-state";
import { Field } from "components/field";
import { Input } from "components/input";
import { useAddMember, useMembers, useRemoveMember } from "app/queries";
import { inviteMessage } from "app/setup";
import { SecretAlert } from "app/SecretAlert";
import { FieldHelp, LoadingRow, SectionTitle, TabIntro } from "app/ui";

/** The people who can open this project's reviews and decide. Admins only. */
export function Members({ project }) {
  const { data, error, isLoading } = useMembers(project.key);
  const addMember = useAddMember(project.key);
  const removeMember = useRemoveMember(project.key);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [temp, setTemp] = useState(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toRemove, setToRemove] = useState(null);
  const [acting, setActing] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    setTemp(null);
    try {
      const res = await addMember.mutateAsync({ email, name });
      setTemp(res.tempPassword ? { email: res.user.email, password: res.tempPassword } : { existing: res.user.email });
      setEmail("");
      setName("");
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setActing(true);
    setFormError("");
    try {
      await removeMember.mutateAsync(toRemove.id);
      setToRemove(null);
    } catch (err) {
      setToRemove(null);
      setFormError(err.message);
    } finally {
      setActing(false);
    }
  };

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (m) => (
        <div className="flex items-center gap-3">
          <Avatar name={m.name} size="sm" />
          <span className="typo-medium-text-sm">{m.name}</span>
        </div>
      ),
    },
    { key: "email", header: "Email" },
    { key: "actions", header: "", align: "right", render: (m) => <Button size="sm" kind="outlined" status="danger" onClick={() => setToRemove(m)}>Remove</Button> },
  ];

  return (
    <div className="flex flex-col gap-8">
      <TabIntro icon={<Users size={24} />} title="Members are the people who decide on this project's reviews">
        <p>Designers and product owners are members. A member logs in with their own account, sees only the projects they were added to, and answers on the review page. The sync tool needs no account: it uses a token.</p>
      </TabIntro>

      {isLoading && <LoadingRow text="Loading the members…" />}
      {(error || formError) && <Alert status="danger" kind="outlined">{error?.message || formError}</Alert>}
      {temp?.password && (
        <SecretAlert
          title={`Temporary password for ${temp.email}`}
          secret={temp.password}
          noun="password"
          onDismiss={() => setTemp(null)}
          extraCopy={{ label: "Copy invite message", text: inviteMessage({ reviewUrl: project.reviewUrl, email: temp.email, password: temp.password }) }}
          details={project.reviewUrl
            ? <p className="mt-2">Log in at <code className="break-all">{project.reviewUrl}</code>. <strong>Copy invite message</strong> puts the address, the email and this password in one text to send.</p>
            : <p className="mt-2">This project has no review page link yet, so the invite message has no address. Add it in <Link className="underline" to="?tab=settings">Settings</Link> (Review page URL).</p>}
        />
      )}
      {temp?.existing && <Alert status="info" kind="outlined" onDismiss={() => setTemp(null)}>{temp.existing} already had an account and now has access to this project.</Alert>}

      <section className="flex flex-col gap-4">
        <SectionTitle icon={<UserPlus size={20} />} title="Add a member" description="A new person gets a temporary password and must change it at the first login." />
        <Card>
          <form onSubmit={add} className="flex flex-col gap-4">
            <div className="grid max-w-xl gap-4 md:grid-cols-2">
              <Field label="Email" required hint="Their login.">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
              </Field>
              <Field label="Name" required hint="Shown in the decision history.">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Siti Aminah" />
              </Field>
            </div>
            <div className="max-w-xl">
              <FieldHelp title="What happens when I add someone?">
                <p>If the email is new, an account is created and a <strong>temporary password is shown once</strong>. Copy it and send it to the person yourself. They change it when they first log in.</p>
                <p>If the email already has an account (for example in another project), nothing is created: they simply get access to this project too.</p>
                <p>Use their real name: it appears next to every decision they make.</p>
              </FieldHelp>
            </div>
            <div>
              <Button type="submit" status="primary" prefixIcon={<UserPlus />} loading={busy} disabled={!email.trim() || !name.trim()}>Add member</Button>
            </div>
          </form>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle icon={<Users size={20} />} title="Members of this project" />
        {data && (
          <Card padded={false}>
            <DataTable columns={columns} rows={data} empty={<EmptyState icon={<Users size={22} />} title="No members yet" description="Add the designer or product owner who decides. Without a member nobody can answer a review." />} />
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle icon={<ShieldCheck size={20} />} title="Who can do what" />
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Member (reviewer)" description="A designer or product owner.">
            <ul className="flex list-disc flex-col gap-1 pl-5 typo-regular-text-sm">
              <li>Sees the Reviews and History of the projects they were added to</li>
              <li>Decides on the review page</li>
              <li>Cannot change settings, tokens or members</li>
            </ul>
          </Card>
          <Card title="Admin" description="Whoever runs the design system.">
            <ul className="flex list-disc flex-col gap-1 pl-5 typo-regular-text-sm">
              <li>Sees every project</li>
              <li>Creates projects and changes their settings</li>
              <li>Manages tokens and members</li>
            </ul>
          </Card>
        </div>
      </section>

      <ConfirmDialog
        open={!!toRemove}
        onClose={() => setToRemove(null)}
        onConfirm={remove}
        title="Remove this member?"
        description={`${toRemove?.name} will no longer see this project. Their account is kept.`}
        confirmLabel="Remove member"
        tone="danger"
        loading={acting}
      />
    </div>
  );
}
