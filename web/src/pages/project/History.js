import { useState } from "react";
import { BadgeCheck, CheckCircle2, History as HistoryIcon, Info, RefreshCw, RotateCw, Upload } from "lucide-react";
import { Alert } from "components/alert";
import { Card } from "components/card";
import { EmptyState } from "components/empty-state";
import { Select } from "components/select";
import { api } from "app/api";
import { timeAgo, when } from "app/timeAgo";
import { useLoad } from "app/useAsync";
import { TabIntro } from "app/ui";

const ALL = "__all__";

// Each kind of event has its own icon and colour, and decisions and applying stand out from routine events.
const KIND = {
  published: { Icon: Upload, tone: "text-caption", strong: false },
  reopened: { Icon: RefreshCw, tone: "text-warning", strong: false },
  synced: { Icon: RotateCw, tone: "text-caption", strong: false },
  decided: { Icon: CheckCircle2, tone: "text-success", strong: true },
  applied: { Icon: BadgeCheck, tone: "text-primary", strong: true },
  other: { Icon: Info, tone: "text-caption", strong: false },
};

// Who did it, in words a designer or product owner knows: the tool's entries are the Figma sync, or the developer when applied.
const actor = (h) => (h.by === "tool" ? (h.kind === "applied" ? "Developer" : "Figma sync") : h.by || "Someone");

/** Everything that happened to this project's reviews, newest first. */
export function History({ project }) {
  const { data, error } = useLoad(() => api("GET", `/projects/${project.key}/history`), [project.key]);
  const [component, setComponent] = useState(ALL);
  const entries = data || [];
  const names = [...new Set(entries.map((h) => h.component).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const options = [{ value: ALL, label: "All components" }, ...names.map((n) => ({ value: n, label: n }))];
  const filtered = component === ALL ? entries : entries.filter((h) => h.component === component);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <div className="flex flex-col gap-6">
      <TabIntro icon={<HistoryIcon size={24} />} title="Everything that happened to this project's reviews">
        <p>When a review was sent, who decided what and why, and when the developer applied it. Newest first. <strong>Decisions</strong> and <strong>applied</strong> entries are bold; routine syncs are grey.</p>
      </TabIntro>
      {error && <Alert status="danger" kind="outlined">{error}</Alert>}
      {data && (
        <>
          <Card padded={false}>
            <div className="flex flex-wrap items-center gap-3 border-b border-default p-4">
              <div className="w-64">
                <Select options={options} value={component} onChange={(v) => setComponent(v || ALL)} />
              </div>
              <span className="text-caption typo-regular-text-sm">{component === ALL ? `${entries.length} events` : `${filtered.length} of ${entries.length} events`}</span>
            </div>
            {filtered.length === 0 ? (
              <EmptyState
                icon={<HistoryIcon size={22} />}
                title={entries.length ? "No events match this filter" : "Nothing has happened yet"}
                description={entries.length ? "Choose another component." : "Events appear here once the developer sends a review and the reviewers answer it."}
              />
            ) : (
              <ol className="flex flex-col p-4">
                {filtered.map((h, i) => {
                  const { Icon, tone, strong } = KIND[h.kind] ?? KIND.other;
                  return (
                    <li key={`${h.at}-${h.component}-${h.action}-${i}`} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <Icon size={20} className={`shrink-0 ${tone}`} />
                        {i < filtered.length - 1 && <div className="mt-1 w-0 flex-1 border-l border-default" />}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-5">
                        <p className={strong ? "typo-semi-bold-text-sm" : "text-caption typo-regular-text-sm"}>
                          {h.component && <span>{h.component}: </span>}{h.event || h.action}
                        </p>
                        <p className="text-caption typo-regular-text-sm" title={when(h.at)}>{[actor(h), timeAgo(h.at), when(h.at)].filter(Boolean).join(" · ")}</p>
                        {(h.lines || []).map((line) => <p key={line} className="break-words typo-regular-text-sm">{line}</p>)}
                        {h.note && <p className="mt-1 break-words border-l-2 border-default pl-3 text-caption typo-regular-text-sm">&ldquo;{h.note}&rdquo;</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
          <p className="text-caption typo-regular-text-sm">{`Times are shown in your browser's time zone (${zone}).`}</p>
        </>
      )}
    </div>
  );
}
