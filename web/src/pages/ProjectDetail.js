import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, History as HistoryIcon, Plus, UserPlus } from "lucide-react";
import { Alert } from "components/alert";
import { Badge } from "components/badge";
import { Button } from "components/button";
import { ConfirmDialog } from "components/confirm-dialog";
import { Card } from "components/card";
import { DataTable } from "components/data-table";
import { EmptyState } from "components/empty-state";
import { Field } from "components/field";
import { Input } from "components/input";
import { PageHeader } from "components/page-header";
import { Tabs } from "components/tabs";
import { Textarea } from "components/textarea";
import { api, getSession } from "app/api";
import { SecretAlert } from "app/SecretAlert";
import { useLoad } from "app/useAsync";
import { ReviewsTab } from "pages/ReviewsTab";

const when = (iso) => (iso ? new Date(iso).toLocaleString() : "Never");

function Settings({ project, isAdmin, onSaved }) {
  const [form, setForm] = useState({
    name: project.name,
    figmaFileKey: project.figmaFileKey || "",
    storybookUrl: project.storybookUrl || "",
    reviewUrl: project.reviewUrl || "",
    origins: project.allowedOrigins.join("\n"),
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    setSaved(false);
    setForm({ ...form, [k]: e.target.value });
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { origins, ...rest } = form;
      await api("PATCH", `/projects/${project.key}`, {
        ...rest,
        allowedOrigins: origins.split("\n").map((o) => o.trim()).filter(Boolean),
      });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Settings">
      <form onSubmit={submit} className="flex max-w-xl flex-col gap-4">
        {error && <Alert status="danger" kind="outlined">{error}</Alert>}
        {saved && <Alert status="success" kind="outlined">Saved.</Alert>}
        <Field label="Name" required>
          <Input value={form.name} onChange={set("name")} readOnly={!isAdmin} />
        </Field>
        <Field label="Figma file key">
          <Input value={form.figmaFileKey} onChange={set("figmaFileKey")} readOnly={!isAdmin} />
        </Field>
        <Field label="Storybook URL">
          <Input value={form.storybookUrl} onChange={set("storybookUrl")} readOnly={!isAdmin} />
        </Field>
        <Field label="Review page URL" hint="Shown as the link Open the review page.">
          <Input value={form.reviewUrl} onChange={set("reviewUrl")} readOnly={!isAdmin} />
        </Field>
        <Field label="Allowed origins" hint="One per line, for example https://app.example.com. No path.">
          <Textarea value={form.origins} onChange={set("origins")} readOnly={!isAdmin} rows={3} />
        </Field>
        {isAdmin && (
          <div>
            <Button type="submit" status="primary" loading={busy} disabled={!form.name.trim()}>Save settings</Button>
          </div>
        )}
      </form>
    </Card>
  );
}

function Tokens({ project }) {
  const { data, error, reload } = useLoad(() => api("GET", `/projects/${project.key}/tokens`), [project.key]);
  const [label, setLabel] = useState("");
  const [created, setCreated] = useState(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const res = await api("POST", `/projects/${project.key}/tokens`, { label });
      setCreated(res);
      setLabel("");
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const [toRevoke, setToRevoke] = useState(null);
  const [acting, setActing] = useState(false);
  const revoke = async () => {
    setActing(true);
    setFormError("");
    try {
      await api("DELETE", `/projects/${project.key}/tokens/${toRevoke.id}`);
      setToRevoke(null);
      reload();
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
    { key: "lastUsedAt", header: "Last used", render: (t) => when(t.lastUsedAt) },
    { key: "status", header: "Status", render: (t) => (t.revokedAt ? <Badge tone="danger">Revoked</Badge> : <Badge tone="success">Active</Badge>) },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (t) => !t.revokedAt && <Button size="sm" kind="outlined" status="danger" onClick={() => setToRevoke(t)}>Revoke</Button>,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {(error || formError) && <Alert status="danger" kind="outlined">{error || formError}</Alert>}
      {created && <SecretAlert title={`New token: ${created.label}`} secret={created.token} noun="token" onDismiss={() => setCreated(null)} />}
      <Card title="Create a token" description="The design tool uses a token to publish reviews to this project.">
        <form onSubmit={create} className="flex max-w-xl items-end gap-3">
          <Field label="Label" required className="flex-1">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Dev laptop" />
          </Field>
          <Button type="submit" status="primary" prefixIcon={<Plus />} loading={busy} disabled={!label.trim()}>Create token</Button>
        </form>
      </Card>
      {data && (
        <Card title="Tokens" padded={false}>
          <DataTable columns={columns} rows={data} empty={<EmptyState title="No tokens yet" description="Create a token to let the design tool publish." />} />
        </Card>
      )}
      <ConfirmDialog
        open={!!toRevoke}
        onClose={() => setToRevoke(null)}
        onConfirm={revoke}
        title="Revoke this token?"
        description={`The token "${toRevoke?.label}" stops working at once. This cannot be undone.`}
        confirmLabel="Revoke token"
        tone="danger"
        loading={acting}
      />
    </div>
  );
}

function Members({ project }) {
  const { data, error, reload } = useLoad(() => api("GET", `/projects/${project.key}/members`), [project.key]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [temp, setTemp] = useState(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    setTemp(null);
    try {
      const res = await api("POST", `/projects/${project.key}/members`, { email, name });
      setTemp(res.tempPassword ? { email: res.user.email, password: res.tempPassword } : { existing: res.user.email });
      setEmail("");
      setName("");
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const [toRemove, setToRemove] = useState(null);
  const [acting, setActing] = useState(false);
  const remove = async () => {
    setActing(true);
    setFormError("");
    try {
      await api("DELETE", `/projects/${project.key}/members/${toRemove.id}`);
      setToRemove(null);
      reload();
    } catch (err) {
      setToRemove(null);
      setFormError(err.message);
    } finally {
      setActing(false);
    }
  };

  const columns = [
    { key: "name", header: "Name" },
    { key: "email", header: "Email" },
    { key: "actions", header: "", align: "right", render: (m) => <Button size="sm" kind="outlined" status="danger" onClick={() => setToRemove(m)}>Remove</Button> },
  ];

  return (
    <div className="flex flex-col gap-6">
      {(error || formError) && <Alert status="danger" kind="outlined">{error || formError}</Alert>}
      {temp?.password && (
        <SecretAlert title={`Temporary password for ${temp.email}`} secret={temp.password} noun="password" onDismiss={() => setTemp(null)} />
      )}
      {temp?.existing && (
        <Alert status="info" kind="outlined" onDismiss={() => setTemp(null)}>{temp.existing} already had an account and now has access to this project.</Alert>
      )}
      <Card title="Add a member" description="A new person gets a temporary password and must change it at the first login.">
        <form onSubmit={add} className="flex flex-col gap-4">
          <div className="grid max-w-xl gap-4 md:grid-cols-2">
            <Field label="Email" required>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <div>
            <Button type="submit" status="primary" prefixIcon={<UserPlus />} loading={busy} disabled={!email.trim() || !name.trim()}>Add member</Button>
          </div>
        </form>
      </Card>
      {data && (
        <Card title="Members" padded={false}>
          <DataTable columns={columns} rows={data} empty={<EmptyState title="No members yet" description="Add the people who review this project." />} />
        </Card>
      )}
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

const describeChanges = (changes, migrateBy) =>
  Object.entries(changes || {})
    .map(([prop, choice]) => `${prop}: ${choice ?? "cleared"}${migrateBy?.[prop] ? ` (migrate by ${migrateBy[prop]})` : ""}`)
    .join(", ");

function History({ project }) {
  const { data, error } = useLoad(() => api("GET", `/projects/${project.key}/history`), [project.key]);
  const columns = [
    { key: "at", header: "When", render: (h) => when(h.at) },
    { key: "by", header: "Who" },
    { key: "component", header: "Component" },
    { key: "changes", header: "What", render: (h) => (
        <div className="flex flex-col break-words">
          <span>{describeChanges(h.changes, h.migrateBy) || h.action}</span>
          {h.note && <span className="text-subtle">{h.note}</span>}
        </div>
      ),
    },
  ];
  return (
    <>
      {error && <Alert status="danger" kind="outlined">{error}</Alert>}
      {data && (
        <Card title="Decision history" padded={false}>
          <DataTable
            columns={columns}
            rows={data.map((h, i) => ({ ...h, id: i }))}
            empty={<EmptyState icon={<HistoryIcon size={22} />} title="No decisions yet" description="Decisions appear here once reviewers answer a review." />}
          />
        </Card>
      )}
    </>
  );
}

export default function ProjectDetail() {
  const { key } = useParams();
  const isAdmin = getSession().user.role === "admin";
  const { data: projects, error, loading, reload } = useLoad(() => api("GET", "/projects"), []);
  const [tab, setTab] = useState("reviews");
  const project = projects?.find((p) => p.key === key);

  const tabs = [
    { value: "reviews", label: "Reviews" },
    { value: "settings", label: "Settings" },
    ...(isAdmin ? [{ value: "tokens", label: "Tokens" }, { value: "members", label: "Members" }] : []),
    { value: "history", label: "History" },
  ];

  return (
    <>
      <div>
        <Button as={Link} to="/projects" kind="text" size="sm" prefixIcon={<ArrowLeft />}>All projects</Button>
      </div>
      {error && <Alert status="danger" kind="outlined">{error}</Alert>}
      {!loading && !error && !project && <Alert status="warning" kind="outlined">No such project.</Alert>}
      {project && (
        <>
          <PageHeader
            title={project.name}
            description={project.key}
            actions={
              project.reviewUrl && (
                <Button as="a" href={project.reviewUrl} target="_blank" rel="noreferrer" kind="outlined" suffixIcon={<ExternalLink />}>
                  Open the review page
                </Button>
              )
            }
          />
          <Tabs tabs={tabs} value={tab} onChange={setTab} />
          {tab === "reviews" && <ReviewsTab key={project.key} project={project} />}
          {tab === "settings" && <Settings key={project.key} project={project} isAdmin={isAdmin} onSaved={reload} />}
          {tab === "tokens" && isAdmin && <Tokens project={project} />}
          {tab === "members" && isAdmin && <Members project={project} />}
          {tab === "history" && <History project={project} />}
        </>
      )}
    </>
  );
}
