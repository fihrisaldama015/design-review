import { useState } from "react";
import { KeyRound, Plug, Plus } from "lucide-react";
import { Alert } from "components/alert";
import { Badge } from "components/badge";
import { Button } from "components/button";
import { Card } from "components/card";
import { ConfirmDialog } from "components/confirm-dialog";
import { DataTable } from "components/data-table";
import { EmptyState } from "components/empty-state";
import { Field } from "components/field";
import { Input } from "components/input";
import { TROUBLESHOOTING } from "app/help";
import { useCreateToken, useRevokeToken, useTokens } from "app/queries";
import { SecretAlert } from "app/SecretAlert";
import { connectSnippets } from "app/setup";
import { when } from "app/timeAgo";
import { Checkbox } from "components/checkbox";
import { FaqList, FieldHelp, LoadingRow, SectionTitle, TabIntro } from "app/ui";
import { ConnectWizard } from "pages/project/ConnectWizard";

/** Tokens of a project and the guide that connects the project to this service. Admins only. */
export function Tokens({ project, reviewsCount, onGo }) {
  const { data, error, isLoading } = useTokens(project.key);
  const createToken = useCreateToken(project.key);
  const revokeToken = useRevokeToken(project.key);
  const [label, setLabel] = useState("");
  const [created, setCreated] = useState(null);
  const [secret, setSecret] = useState(""); // the token this page created: kept in memory only, so the next steps can fill it in. A refresh forgets it.
  const [copied, setCopied] = useState(false); // the new token was copied, or the person says it is saved
  const hasActive = (data ?? []).some((t) => !t.revokedAt);
  // Step 1 may only go on once a token exists and, for a new one, was copied: it is shown once.
  const gate = created ? (copied ? "" : "Copy the token first: you will not see it again.") : hasActive ? "" : "Create a token first.";
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toRevoke, setToRevoke] = useState(null);
  const [acting, setActing] = useState(false);
  const snippets = connectSnippets({ origin: window.location.origin, project: project.key, token: secret });

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const res = await createToken.mutateAsync(label);
      setCreated(res);
      setSecret(res.token);
      setCopied(false);
      setLabel("");
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    setActing(true);
    setFormError("");
    try {
      await revokeToken.mutateAsync(toRevoke.id);
      setToRevoke(null);
    } catch (err) {
      setToRevoke(null);
      setFormError(err.message);
    } finally {
      setActing(false);
    }
  };

  const columns = [
    { key: "label", header: "Label" },
    { key: "createdAt", header: "Created", render: (t) => when(t.createdAt) },
    { key: "lastUsedAt", header: "Last used", render: (t) => (t.lastUsedAt ? when(t.lastUsedAt) : <span className="text-caption">Never used yet</span>) },
    { key: "status", header: "Status", render: (t) => (t.revokedAt ? <Badge tone="danger">Revoked</Badge> : <Badge tone="success">Active</Badge>) },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (t) => !t.revokedAt && <Button size="sm" kind="outlined" status="danger" onClick={() => setToRevoke(t)}>Revoke</Button>,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <TabIntro icon={<KeyRound size={24} />} title="Connect this project, step by step">
        <p>Two different programs need to know about this service: the <strong>sync tool</strong> that sends reviews (it needs a secret token), and the <strong>review page</strong> in the browser that shows them (it must never get the token). The steps below set up both.</p>
      </TabIntro>

      {isLoading && <LoadingRow text="Loading the tokens…" />}
      {(error || formError) && <Alert status="danger" kind="outlined">{error?.message || formError}</Alert>}
      <section className="flex flex-col gap-4">
        <SectionTitle icon={<Plug size={20} />} title="Connect your project" description="Five short steps, one open at a time. The code blocks already contain this project's address and key: copy them and paste your token where it says." />
        <ConnectWizard
          project={project}
          snippets={snippets}
          tokens={data}
          reviewsCount={reviewsCount ?? 0}
          onGo={onGo}
          gate={gate}
          createStep={
            <form onSubmit={create} className="flex max-w-xl flex-col gap-3">
              <Field label="Label" required hint="Say where it will be used.">
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Aisyah's laptop" />
              </Field>
              <FieldHelp title="What should I write?">
                <p>A short name for the place that will use the token: a person's laptop (“Aisyah's laptop”), a build server (“CI”), or the project folder (“mvp sync”).</p>
                <p>If a laptop is lost or someone leaves, you revoke only that token and the others keep working.</p>
              </FieldHelp>
              <div>
                <Button type="submit" status="primary" prefixIcon={<Plus />} loading={busy} disabled={!label.trim()}>Create token</Button>
              </div>
              {created && (
                <div className="flex flex-col gap-3">
                  <SecretAlert title={`New token: ${created.label}`} secret={created.token} noun="token" onCopy={() => setCopied(true)} onDismiss={copied ? () => setCreated(null) : undefined} />
                  <Checkbox label="I saved the token somewhere safe" description="Tick this if the Copy button does not work for you." checked={copied} onChange={(e) => setCopied(e.target.checked)} />
                  <p className="text-caption typo-regular-text-sm">The next steps already contain this token, so you can copy each block as it is.</p>
                </div>
              )}
            </form>
          }
        />
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle icon={<KeyRound size={20} />} title="Your tokens" description="Make one token per place it is used, so you can revoke one without breaking the others. “Last used” shows when a tool last connected with it." />
        {data && (
          <Card padded={false}>
            <DataTable columns={columns} rows={data} empty={<EmptyState icon={<KeyRound size={22} />} title="No tokens yet" description="Create one in step 1 above. Without a token the sync tool cannot publish reviews here." />} />
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle title="If something does not work" description="The messages you are most likely to see, and what to do." />
        <FaqList items={TROUBLESHOOTING} />
      </section>

      <ConfirmDialog
        open={!!toRevoke}
        onClose={() => setToRevoke(null)}
        onConfirm={revoke}
        title="Revoke this token?"
        description={`The token "${toRevoke?.label}" stops working at once, and any tool using it can no longer publish. This cannot be undone.`}
        confirmLabel="Revoke token"
        tone="danger"
        loading={acting}
      />
    </div>
  );
}
