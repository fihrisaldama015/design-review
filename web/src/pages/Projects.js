import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronDown, ExternalLink, FolderOpen, Hourglass, ListChecks, Plus } from "lucide-react";
import { Alert } from "components/alert";
import { Badge } from "components/badge";
import { Button } from "components/button";
import { Card } from "components/card";
import { EmptyState } from "components/empty-state";
import { Field } from "components/field";
import { Input } from "components/input";
import { useQueryClient } from "@tanstack/react-query";
import { getSession } from "app/api";
import { prefetchProject, useCreateProject, useProjects } from "app/queries";
import { Collapse } from "app/Collapse";
import { FieldHelp, LoadingRow, TabIntro } from "app/ui";

function CreateProject({ onCreated }) {
  const create = useCreateProject();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const project = await create.mutateAsync({ key, name, allowedOrigins: origin.trim() ? [origin.trim()] : [] });
      onCreated(project);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="New project" description="One project per app. After creating it you land in the project, where a checklist shows what is left to do.">
      <form onSubmit={submit} className="flex flex-col gap-6">
        {error && <Alert status="danger" kind="outlined">{error}</Alert>}
        <div className="grid gap-6 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Field label="Key" required hint="Lowercase letters, digits and dashes.">
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="mvp" />
            </Field>
            <FieldHelp title="What is the key?">
              <p>A short name for the app, used in addresses and in the sync tool's settings. Examples: <code>mvp</code>, <code>swt-fe</code>.</p>
              <p><strong>It cannot be changed later</strong>, so choose one you will keep. 2 to 40 characters.</p>
            </FieldHelp>
          </div>
          <div className="flex flex-col gap-2">
            <Field label="Name" required hint="What people see.">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Equipment loan tracker" />
            </Field>
            <FieldHelp title="What do I write?">
              <p>The app's name in plain words. You can change it later in Settings.</p>
            </FieldHelp>
          </div>
          <div className="flex flex-col gap-2">
            <Field label="Allowed origin" hint="Where the review page runs. Optional now.">
              <Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="http://localhost:5002" />
            </Field>
            <FieldHelp title="Which address?">
              <p>The start of the address of your app's review page, without a path: <code>http://localhost:5002</code> on your computer, <code>https://app.example.com</code> online.</p>
              <p>Copy it from the browser's address bar and delete everything after the host. You can add more later in Settings.</p>
            </FieldHelp>
          </div>
        </div>
        <div>
          <Button type="submit" status="primary" prefixIcon={<Plus />} loading={busy} disabled={!key || !name}>Create project</Button>
        </div>
      </form>
    </Card>
  );
}

const WarnChip = ({ children }) => <Badge tone="warning">{children}</Badge>;

function ProjectCard({ project, isAdmin, onOpen, onPrefetch }) {
  const c = project.counts || {};
  const total = (c.pending || 0) + (c.answered || 0) + (c.applied || 0);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onOpen(); } }}
      className="group cursor-pointer rounded-default transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <Card title={project.name} description={`Project key: ${project.key}`}>
        <div className="flex flex-col gap-4">
          {total === 0 ? (
            <p className="text-caption typo-regular-text-sm">No reviews yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {c.pending > 0 && <Badge tone="warning"><Hourglass size={12} />{c.pending} waiting for an answer</Badge>}
              {c.answered > 0 && <Badge tone="info"><CheckCircle2 size={12} />{c.answered} answered</Badge>}
              {c.applied > 0 && <Badge tone="success"><ListChecks size={12} />{c.applied} applied</Badge>}
            </div>
          )}
          {isAdmin && (!project.reviewUrl || project.allowedOrigins.length === 0) && (
            <div className="flex flex-wrap gap-2">
              {!project.reviewUrl && <WarnChip>Review page link missing</WarnChip>}
              {project.allowedOrigins.length === 0 && <WarnChip>No allowed origin</WarnChip>}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-caption transition-colors group-hover:text-primary typo-regular-text-sm">Open the project<ChevronDown size={16} className="-rotate-90" /></span>
            {project.reviewUrl && (
              <Button as="a" href={project.reviewUrl} target="_blank" rel="noreferrer" kind="outlined" size="sm" suffixIcon={<ExternalLink />} onClick={(e) => e.stopPropagation()}>Open the review page</Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

/** The projects the person can see, as cards that say where each stands. */
export default function Projects() {
  const navigate = useNavigate();
  const isAdmin = getSession().user.role === "admin";
  const queryClient = useQueryClient();
  const { data, error, isLoading: loading } = useProjects();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="typo-semi-bold-text-lg">Projects</h1>
          <p className="text-caption typo-regular-text-sm">{isAdmin ? "Every project in the organisation." : "The projects you review."}</p>
        </div>
        {isAdmin && (
          <Button status="primary" prefixIcon={<Plus />} onClick={() => setCreating((v) => !v)}>{creating ? "Close" : "New project"}</Button>
        )}
      </div>
      <TabIntro icon={<FolderOpen size={24} />} title={isAdmin ? "A project is one app with its own Figma file, reviewers and token" : "Open a project to see what needs your decision"}>
        {isAdmin ? (
          <p>Create one project per app. Inside, a checklist walks you through connecting it: a token for the sync tool, the review page's address, and the people who decide. New here? Read the <Link to="/guide" className="text-primary underline">Guide</Link> first.</p>
        ) : (
          <p>The number on a card is how many reviews are waiting for an answer. Open the project, then use <strong>Open the review page</strong> to decide. Need help? Read the <Link to="/guide" className="text-primary underline">Guide</Link>.</p>
        )}
      </TabIntro>
      {loading && <LoadingRow text="Loading the projects…" />}
      {error && <Alert status="danger" kind="outlined">{error.message}</Alert>}
      {isAdmin && (
        <Collapse open={creating}>
          <CreateProject onCreated={(p) => navigate(`/projects/${p.key}`)} />
        </Collapse>
      )}
      {!loading && data && data.length === 0 && (
        <Card>
          <EmptyState
            icon={<FolderOpen size={22} />}
            title="No projects yet"
            description={isAdmin ? "Create the first project, then follow its setup checklist." : "An admin adds you to a project. Until then there is nothing to review."}
            action={isAdmin ? <Button status="primary" prefixIcon={<Plus />} onClick={() => setCreating(true)}>New project</Button> : undefined}
          />
        </Card>
      )}
      {!loading && data && data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {data.map((p) => <ProjectCard key={p.key} project={p} isAdmin={isAdmin} onOpen={() => navigate(`/projects/${p.key}`)} onPrefetch={() => prefetchProject(queryClient, p.key, isAdmin)} />)}
        </div>
      )}
    </>
  );
}
