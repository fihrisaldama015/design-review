import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, FolderOpen, Plus } from "lucide-react";
import { Alert } from "components/alert";
import { Button } from "components/button";
import { Card } from "components/card";
import { DataTable } from "components/data-table";
import { EmptyState } from "components/empty-state";
import { Field } from "components/field";
import { Input } from "components/input";
import { PageHeader } from "components/page-header";
import { api, getSession } from "app/api";
import { useLoad } from "app/useAsync";

function CreateProject({ onCreated }) {
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
      const project = await api("POST", "/projects", { key, name, allowedOrigins: origin.trim() ? [origin.trim()] : [] });
      onCreated(project);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="New project" description="The key is used in addresses and tokens: lowercase letters, digits and dashes.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <Alert status="danger" kind="outlined">{error}</Alert>}
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Key" required>
            <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="mvp" />
          </Field>
          <Field label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Equipment loan tracker" />
          </Field>
          <Field label="Allowed origin" hint="Where the review page runs, e.g. http://localhost:5002.">
            <Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="http://localhost:5002" />
          </Field>
        </div>
        <div>
          <Button type="submit" status="primary" prefixIcon={<Plus />} loading={busy} disabled={!key || !name}>Create project</Button>
        </div>
      </form>
    </Card>
  );
}

export default function Projects() {
  const navigate = useNavigate();
  const isAdmin = getSession().user.role === "admin";
  const { data, error, loading } = useLoad(() => api("GET", "/projects"), []);

  const columns = [
    { key: "name", header: "Name" },
    { key: "key", header: "Key" },
    { key: "origins", header: "Allowed origins", render: (p) => p.allowedOrigins.join(", ") || "None" },
    {
      key: "review",
      header: "",
      align: "right",
      render: (p) =>
        p.reviewUrl && (
          <Button
            as="a"
            href={p.reviewUrl}
            target="_blank"
            rel="noreferrer"
            kind="text"
            size="sm"
            suffixIcon={<ExternalLink />}
            onClick={(e) => e.stopPropagation()}
          >
            Open the review page
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader title="Projects" description={isAdmin ? "Every project in the organisation." : "The projects you review."} />
      {error && <Alert status="danger" kind="outlined">{error}</Alert>}
      {isAdmin && <CreateProject onCreated={(p) => navigate(`/projects/${p.key}`)} />}
      {!loading && data && (
        <Card padded={false}>
          <DataTable
            columns={columns}
            rows={data}
            onRowClick={(p) => navigate(`/projects/${p.key}`)}
            empty={<EmptyState icon={<FolderOpen size={22} />} title="No projects yet" description={isAdmin ? "Create the first project above." : "An admin adds you to a project."} />}
          />
        </Card>
      )}
    </>
  );
}
