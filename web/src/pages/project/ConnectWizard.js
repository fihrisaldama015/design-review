import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Monitor, Terminal } from "lucide-react";
import { Button } from "components/button";
import { Tabs } from "components/tabs";
import { Collapse } from "app/Collapse";
import { CodeBlock } from "app/ui";

const storeKey = (project) => `dr-setup-${project}`;
const readDone = (project) => {
  try { return new Set(JSON.parse(localStorage.getItem(storeKey(project)) ?? "[]")); } catch { return new Set(); }
};
const writeDone = (project, set) => {
  try { localStorage.setItem(storeKey(project), JSON.stringify([...set])); } catch { /* private window: the progress lasts until reload */ }
};

/** One row of the wizard: a number (or a check when done), the title, and the content when it is the open one. */
function Row({ n, title, summary, done, open, onToggle, children }) {
  return (
    <li className={`rounded-default border-2 transition-colors duration-200 ${open ? "border-primary" : "border-default"}`}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onToggle(); } }}
        className="flex cursor-pointer items-center gap-4 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 typo-semi-bold-text-sm transition-colors duration-200 ${done ? "border-success bg-success text-base-color" : "border-primary text-primary"}`}>
          {done ? <Check size={16} strokeWidth={3} /> : n}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="typo-semi-bold-text-base">{title}</span>
          {!open && summary && <span className="text-caption typo-regular-text-sm">{summary}</span>}
        </div>
        <ChevronDown size={20} className={`shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </div>
      <Collapse open={open}>
        <div className="flex flex-col gap-4 border-t border-default p-4 pl-16">{children}</div>
      </Collapse>
    </li>
  );
}

/**
 * The connection guide as a short wizard: one step open at a time, the first unfinished one first. A step is done when the service can
 * see it (a token exists, a token was used, a review arrived) or when the person presses Next on it.
 */
export function ConnectWizard({ project, snippets, tokens, reviewsCount, createStep, onGo }) {
  const [confirmed, setConfirmed] = useState(() => readDone(project.key));
  const active = (tokens ?? []).filter((t) => !t.revokedAt);
  const used = active.some((t) => t.lastUsedAt);
  const auto = [active.length > 0, used, used, false, reviewsCount > 0];
  const isDone = (i) => auto[i] || confirmed.has(i);
  const firstOpen = [0, 1, 2, 3, 4].find((i) => !isDone(i)) ?? 0;
  const [open, setOpen] = useState(firstOpen);
  const [where, setWhere] = useState("file");

  const next = (i) => {
    const set = new Set(confirmed).add(i);
    setConfirmed(set);
    writeDone(project.key, set);
    setOpen(Math.min(i + 1, 4));
  };
  const nav = (i) => (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      {i > 0 && <Button kind="text" size="sm" prefixIcon={<ArrowLeft />} onClick={() => setOpen(i - 1)}>Back</Button>}
      {i < 4 && <Button status="primary" size="sm" suffixIcon={<ArrowRight />} onClick={() => next(i)}>Next</Button>}
    </div>
  );
  const row = (i, props, content) => <Row n={i + 1} done={isDone(i)} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} {...props}>{content}</Row>;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-default bg-surface-lv1 p-4">
          <p className="flex items-center gap-2 typo-semi-bold-text-base"><Terminal size={18} />The sync tool</p>
          <p className="typo-regular-text-sm">The scripts in your project that read Figma and <strong>send</strong> reviews here. They run on a developer's computer or a build server.</p>
          <p className="text-caption typo-regular-text-sm">Needs: this service's address, this project's key, and the <strong>token</strong>. Steps 1 to 3.</p>
        </div>
        <div className="flex flex-col gap-2 rounded-default bg-surface-lv1 p-4">
          <p className="flex items-center gap-2 typo-semi-bold-text-base"><Monitor size={18} />The review page of your app</p>
          <p className="typo-regular-text-sm">The page in the browser where reviewers <strong>see</strong> the review and decide.</p>
          <p className="text-caption typo-regular-text-sm">Needs: this service's address and this project's key only. <strong>Never the token.</strong> Step 4.</p>
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {row(0, { title: "Create a token", summary: active.length ? `${active.length} active token${active.length === 1 ? "" : "s"}` : "Not yet" }, <>
          <p className="typo-regular-text-sm">A token is the sync tool's password for this project. Create one for the place that will run the Figma sync, and copy it when it appears: it is shown once.</p>
          {createStep}
          {nav(0)}
        </>)}
        {row(1, { title: "Tell the sync tool where to send reviews", summary: used ? "A token was used: the tool is connected" : "Choose a file or environment variables" }, <>
          <p className="typo-regular-text-sm">The tool needs three things: this service's address, this project's key, and your token. Keep them in <strong>one</strong> of these two places, whichever suits where the tool runs:</p>
          <Tabs tabs={[{ value: "file", label: "On my computer: a file" }, { value: "env", label: "On a server or CI: environment variables" }]} value={where} onChange={setWhere} />
          {where === "file" ? (
            <>
              <p className="typo-regular-text-sm">In the project's folder, create this file. Replace the token placeholder with the token from step 1. The <code>.figma-dump</code> folder stays out of git: never commit a token.</p>
              <CodeBlock title=".figma-dump/review-api.json" code={snippets.apiJson} note="url is this service, project is this project's key, reviewPage is where reviewers decide (used in messages)." />
            </>
          ) : (
            <>
              <p className="typo-regular-text-sm">Set these three in the environment of the job or server that runs the sync. All three are needed, and then you do not need the file.</p>
              <CodeBlock title="Environment variables for the sync tool" code={snippets.toolEnv} />
            </>
          )}
          {nav(1)}
        </>)}
        {row(2, { title: "Check that the tool can reach this project", summary: used ? "Done: a token was used" : "Run one command" }, <>
          <CodeBlock title="Run in the project's folder" code={snippets.checkCommand} />
          <p className="typo-regular-text-sm">It lists the reviews waiting for an answer, or says it cannot reach the service. “Unknown or revoked project token” means the token is wrong. Once it works, the token shows a “Last used” time below.</p>
          {nav(2)}
        </>)}
        {row(3, { title: "Connect the review page of your app", summary: "Two variables, no token" }, <>
          <p className="typo-regular-text-sm">This is a different thing from step 2. The review page runs in the browser, so it only gets the address of this service and the project key. The names start with <code>PUBLIC_</code> because that is how the app's build tool decides which values may be shown in the browser: <strong>never put the token here</strong>.</p>
          <CodeBlock title="Environment variables for the app (.env)" code={snippets.pageEnv} note="Put them in the app's .env file, and in your hosting's environment variables (on Vercel: Project → Settings → Environment Variables, for Production and Preview). They are read when the app is built, so build or deploy again." />
          {nav(3)}
        </>)}
        {row(4, { title: "Allow the page, invite reviewers, send the first review", summary: reviewsCount > 0 ? "A review has arrived" : "Settings, Members, then run the sync" }, <>
          <ol className="flex list-decimal flex-col gap-2 pl-5 typo-regular-text-sm">
            <li>Add the address the review page runs on to <strong>Allowed origins</strong>, otherwise the browser blocks it.</li>
            <li>Add the designer or product owner who decides to <strong>Members</strong>.</li>
            <li>Run the Figma sync. When a component differs from Figma, a review appears in the Reviews tab as “Waiting for an answer”.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button kind="outlined" size="sm" onClick={() => onGo?.("settings")}>Open Settings</Button>
            <Button kind="outlined" size="sm" onClick={() => onGo?.("members")}>Open Members</Button>
            <Button kind="outlined" size="sm" onClick={() => onGo?.("reviews")}>Open Reviews</Button>
          </div>
          {nav(4)}
        </>)}
      </ol>
    </div>
  );
}
