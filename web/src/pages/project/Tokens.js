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
import { api } from "app/api";
import { TROUBLESHOOTING } from "app/help";
import { SecretAlert } from "app/SecretAlert";
import { connectSnippets } from "app/setup";
import { when } from "app/timeAgo";
import { useLoad } from "app/useAsync";
import { CodeBlock, FaqList, FieldHelp, SectionTitle, Step, TabIntro } from "app/ui";

/** Tokens of a project and the guide that connects the project to this service. Admins only. */
export function Tokens({ project, onChanged, onGo }) {
  const { data, error, reload } = useLoad(() => api("GET", `/projects/${project.key}/tokens`), [project.key]);
  const [label, setLabel] = useState("");
  const [created, setCreated] = useState(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toRevoke, setToRevoke] = useState(null);
  const [acting, setActing] = useState(false);
  const snippets = connectSnippets({ origin: window.location.origin, project: project.key, reviewUrl: project.reviewUrl });

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const res = await api("POST", `/projects/${project.key}/tokens`, { label });
      setCreated(res);
      setLabel("");
      reload();
      onChanged?.();
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
      await api("DELETE", `/projects/${project.key}/tokens/${toRevoke.id}`);
      setToRevoke(null);
      reload();
      onChanged?.();
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
      <TabIntro icon={<KeyRound size={24} />} title="A token lets the sync tool publish reviews to this project">
        <p>It is the only thing the tool needs. People never use it and it never goes in a browser. Below you create one, then follow the steps to connect the project.</p>
      </TabIntro>

      {(error || formError) && <Alert status="danger" kind="outlined">{error || formError}</Alert>}
      {created && <SecretAlert title={`New token: ${created.label}`} secret={created.token} noun="token" onDismiss={() => setCreated(null)} />}

      <section className="flex flex-col gap-4">
        <SectionTitle icon={<KeyRound size={20} />} title="Tokens" description="Make one token per place it is used, so you can revoke one without breaking the others." />
        <Card title="Create a token" description="The token is shown once, right after you create it. Copy it then.">
          <form onSubmit={create} className="flex flex-col gap-4">
            <div className="flex max-w-xl flex-col gap-2">
              <Field label="Label" required hint="Say where it will be used.">
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Aisyah's laptop" />
              </Field>
              <FieldHelp title="What should I write?">
                <p>A short name for the place that will use the token: a person's laptop (“Aisyah's laptop”), a build server (“CI”), or the project folder (“mvp sync”).</p>
                <p>If a laptop is lost or someone leaves, you revoke only that token and the others keep working.</p>
              </FieldHelp>
            </div>
            <div>
              <Button type="submit" status="primary" prefixIcon={<Plus />} loading={busy} disabled={!label.trim()}>Create token</Button>
            </div>
          </form>
        </Card>
        {data && (
          <Card title="Your tokens" padded={false}>
            <DataTable columns={columns} rows={data} empty={<EmptyState icon={<KeyRound size={22} />} title="No tokens yet" description="Create one above. Without a token the sync tool cannot publish reviews here." />} />
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle icon={<Plug size={20} />} title="Connect your project" description="Five steps, in this order. The code blocks already contain this project's address and key: copy them and paste your token where it says." />
        <ol className="flex flex-col">
          <Step n={1} title="Create a token">
            <p className="typo-regular-text-sm">Use the form above and copy the token when it appears. You will paste it in the next step. It starts with <code>drp_</code>.</p>
          </Step>
          <Step n={2} title="Tell the sync tool where this service is">
            <p className="typo-regular-text-sm">On the machine that runs the Figma sync, in the project's folder, create the file below. Replace the token placeholder with the token from step 1. The <code>.figma-dump</code> folder stays out of git: never commit a token.</p>
            <CodeBlock title=".figma-dump/review-api.json" code={snippets.apiJson} note="url is this service, project is this project's key, reviewPage is the page where reviewers decide (used in messages)." />
            <p className="typo-regular-text-sm">On a build server, or when you prefer environment variables, set these three instead (all three are needed):</p>
            <CodeBlock title="Environment variables for the sync tool" code={snippets.toolEnv} />
          </Step>
          <Step n={3} title="Check that the tool can reach this project">
            <CodeBlock title="Run in the project's folder" code={snippets.checkCommand} />
            <p className="typo-regular-text-sm">It lists the reviews waiting for an answer, or says it cannot reach the service. “Unknown or revoked project token” means the token is wrong.</p>
          </Step>
          <Step n={4} title="Connect the review page of the app">
            <p className="typo-regular-text-sm">The app that shows the review page needs to know where this service is. Put these two lines in its <code>.env</code> file, and in your hosting's environment variables (on Vercel: Project → Settings → Environment Variables, for Production and Preview). They are read when the app is built, so build or deploy again after adding them.</p>
            <CodeBlock title="Environment variables for the app (.env)" code={snippets.pageEnv} />
            <div>
              <Button kind="outlined" size="sm" onClick={() => onGo?.("settings")}>Then allow the page's address in Settings</Button>
            </div>
          </Step>
          <Step n={5} title="Publish the first review">
            <p className="typo-regular-text-sm">Run the Figma sync as usual. When a component that already exists in code differs from Figma, the tool publishes a review here and it shows in the Reviews tab as “Waiting for an answer”. Add the people who decide in the Members tab.</p>
            <div>
              <Button kind="outlined" size="sm" onClick={() => onGo?.("members")}>Add reviewers</Button>
            </div>
          </Step>
        </ol>
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
