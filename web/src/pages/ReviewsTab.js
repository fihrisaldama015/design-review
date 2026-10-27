import { useState } from "react";
import { ClipboardList, ExternalLink } from "lucide-react";
import { Alert } from "components/alert";
import { Badge } from "components/badge";
import { Button } from "components/button";
import { Card } from "components/card";
import { DataTable } from "components/data-table";
import { EmptyState } from "components/empty-state";
import { Select } from "components/select";
import { api } from "app/api";
import { localDay, timeAgo } from "app/timeAgo";
import { useLoad } from "app/useAsync";

const STATUS = {
  pending: { label: "Waiting for an answer", tone: "warning" },
  answered: { label: "Answered", tone: "info" },
  applied: { label: "Applied", tone: "success" },
};
const CHOICE = { "follow-figma": "Follow Figma", "keep-deprecated": "Keep, deprecated", keep: "Keep" };
const FILTERS = [{ value: "all", label: "All" }, ...Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))];
const dash = "-";

const short = (text, n = 80) => (text.length > n ? `${text.slice(0, n)}...` : text);

/** Reviews of one project, newest first. Old reviews miss the newer fields; every one is optional here. */
export function ReviewsTab({ project }) {
  const { data, error } = useLoad(() => api("GET", `/projects/${project.key}/reviews`), [project.key]);
  const [filter, setFilter] = useState("all");
  const today = localDay();

  const rows = (data?.reviews || [])
    .filter((r) => filter === "all" || r.status === filter)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .map((r) => ({ ...r, id: r.slug }));

  const columns = [
    {
      key: "component",
      header: "Component",
      render: (r) => (
        <div className="flex flex-col break-words">
          <span className="font-semibold">{r.component}</span>
          {r.jsxName && <span className="text-caption text-sm">{`<${r.jsxName}>`}</span>}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge tone={STATUS[r.status]?.tone || "neutral"}>{STATUS[r.status]?.label || String(r.status)}</Badge>,
    },
    {
      key: "choices",
      header: "Decision",
      render: (r) => (r.choices?.length ? r.choices.map((c) => CHOICE[c] || c).join(", ") : dash),
    },
    {
      key: "lastDecision",
      header: "Last decision",
      render: (r) =>
        r.lastDecision ? (
          <div className="flex max-w-xs flex-col break-words">
            <span>{[r.lastDecision.by, timeAgo(r.lastDecision.at)].filter(Boolean).join(", ")}</span>
            {r.lastDecision.note && <span className="text-caption text-sm">{short(r.lastDecision.note)}</span>}
          </div>
        ) : (
          dash
        ),
    },
    {
      key: "deadline",
      header: "Migrate by",
      render: (r) =>
        r.deadline ? (
          <div className="flex items-center gap-2">
            <span>{r.deadline}</span>
            {r.deadline < today && r.status !== "applied" && <Badge tone="danger">Overdue</Badge>}
          </div>
        ) : (
          dash
        ),
    },
    { key: "usageCount", header: "Usage at last sync", render: (r) => (r.usageCount == null ? dash : r.usageCount) },
    {
      key: "link",
      header: "",
      align: "right",
      render: () =>
        project.reviewUrl && (
          <Button as="a" href={project.reviewUrl} target="_blank" rel="noreferrer" size="sm" kind="outlined" suffixIcon={<ExternalLink />}>
            Open the review page
          </Button>
        ),
    },
  ];

  const c = data?.counts || {};
  return (
    <div className="flex flex-col gap-4">
      {error && <Alert status="danger" kind="outlined">{error}</Alert>}
      {data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-caption text-sm">
              {`${c.pending || 0} waiting for an answer, ${c.answered || 0} answered, ${c.applied || 0} applied`}
              {filter !== "all" && ` · ${rows.length} shown`}
            </p>
            <div className="w-64">
              <Select options={FILTERS} value={filter} onChange={(v) => setFilter(v || "all")} />
            </div>
          </div>
          <Card title="Reviews" padded={false}>
            <DataTable
              columns={columns}
              rows={rows}
              empty={
                <EmptyState
                  icon={<ClipboardList size={22} />}
                  title={data.reviews.length ? "No reviews match this filter" : "No reviews yet"}
                  description={data.reviews.length ? "Choose another status." : "They appear when the developer publishes one."}
                />
              }
            />
          </Card>
        </>
      )}
    </div>
  );
}
