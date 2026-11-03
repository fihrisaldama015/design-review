import { useState } from "react";
import { CheckCircle2, ClipboardList, ExternalLink, Hourglass, ListChecks } from "lucide-react";
import { Alert } from "components/alert";
import { Badge } from "components/badge";
import { Button } from "components/button";
import { Card } from "components/card";
import { DataTable } from "components/data-table";
import { EmptyState } from "components/empty-state";
import { Select } from "components/select";
import { StatCard } from "components/stat-card";
import { api } from "app/api";
import { CHOICES, STATUS } from "app/help";
import { localDay, timeAgo } from "app/timeAgo";
import { useLoad } from "app/useAsync";
import { TabIntro } from "app/ui";

const CHOICE = Object.fromEntries(CHOICES.map((c) => [c.value, c.label]));
const FILTERS = [{ value: "all", label: "All" }, ...Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))];
const dash = "-";

const short = (text, n = 80) => (text.length > n ? `${text.slice(0, n)}...` : text);

/** Reviews of one project, newest first. Old reviews miss the newer fields; every one is optional here. */
export function ReviewsTab({ project, isAdmin, onGo }) {
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
          <span className="typo-semi-bold-text-sm">{r.component}</span>
          {r.jsxName && <span className="text-caption typo-regular-text-sm">{`<${r.jsxName}>`}</span>}
        </div>
      ),
    },
    { key: "status", header: "Status", render: (r) => <Badge tone={STATUS[r.status]?.tone || "neutral"}>{STATUS[r.status]?.label || String(r.status)}</Badge> },
    { key: "choices", header: "Decision", render: (r) => (r.choices?.length ? r.choices.map((c) => CHOICE[c] || c).join(", ") : dash) },
    {
      key: "lastDecision",
      header: "Last decision",
      render: (r) =>
        r.lastDecision ? (
          <div className="flex max-w-xs flex-col break-words">
            <span>{[r.lastDecision.by, timeAgo(r.lastDecision.at)].filter(Boolean).join(", ")}</span>
            {r.lastDecision.note && <span className="text-caption typo-regular-text-sm">{short(r.lastDecision.note)}</span>}
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
    { key: "usageCount", header: "Used in (at last sync)", render: (r) => (r.usageCount == null ? dash : r.usageCount) },
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
    <div className="flex flex-col gap-6">
      <TabIntro icon={<ListChecks size={24} />} title="The queue: what needs a decision, and what is done">
        <p>Each row is a component that exists in code but differs from Figma. Reviewers decide on the review page; this table shows where each review stands, so nobody has to ask.</p>
      </TabIntro>
      {error && <Alert status="danger" kind="outlined">{error}</Alert>}
      {!project.reviewUrl && (
        <Alert status="info" kind="outlined" title="The review page link is not set">
          {isAdmin ? (
            <>
              Add it in Settings so reviewers can open the page where they decide.{" "}
              <Button kind="text" size="sm" onClick={() => onGo?.("settings")}>Go to Settings</Button>
            </>
          ) : (
            "The link to the review page is not set yet. Ask an admin to add it."
          )}
        </Alert>
      )}
      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard label={STATUS.pending.label} value={c.pending || 0} tone="warning" icon={<Hourglass size={20} />} hint={STATUS.pending.meaning} />
            <StatCard label={STATUS.answered.label} value={c.answered || 0} tone="info" icon={<CheckCircle2 size={20} />} hint={STATUS.answered.meaning} />
            <StatCard label={STATUS.applied.label} value={c.applied || 0} tone="success" icon={<ListChecks size={20} />} hint={STATUS.applied.meaning} />
          </div>
          <Card padded={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-default p-4">
              <p className="typo-semi-bold-text-base">Reviews{filter !== "all" && ` · ${rows.length} shown`}</p>
              <div className="w-64">
                <Select options={FILTERS} value={filter} onChange={(v) => setFilter(v || "all")} />
              </div>
            </div>
            <DataTable
              columns={columns}
              rows={rows}
              empty={
                <EmptyState
                  icon={<ClipboardList size={22} />}
                  title={data.reviews.length ? "No reviews match this filter" : "No reviews yet"}
                  description={data.reviews.length ? "Choose another status." : isAdmin ? "They appear when the developer runs the Figma sync and a component differs from Figma. See Tokens & setup to connect the project." : "They appear when the developer sends one."}
                />
              }
            />
          </Card>
        </>
      )}
    </div>
  );
}
