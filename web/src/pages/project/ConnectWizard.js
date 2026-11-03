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
 * see it (a token exists, a token was used, a review arrived) or when the person presses Next on it. `gate` is a sentence that blocks
 * Next on step 1 (the token must be copied first) and is empty when the person may go on.
 */
export function ConnectWizard({ project, snippets, tokens, reviewsCount, createStep, gate, onGo }) {
  const [confirmed, setConfirmed] = useState(() => readDone(project.key));
  const active = (tokens ?? []).filter((t) => !t.revokedAt);
  const used = active.some((t) => t.lastUsedAt);
  const auto = [active.length > 0 && !gate, used, used, false, reviewsCount > 0];
  const isDone = (i) => auto[i] || confirmed.has(i);
  const firstOpen = [0, 1, 2, 3, 4].find((i) => !isDone(i)) ?? 0;
  const [open, setOpen] = useState(firstOpen);
  const [where, setWhere] = useState("file");
  const [check, setCheck] = useState("curl");

  const next = (i) => {
    const set = new Set(confirmed).add(i);
    setConfirmed(set);
    writeDone(project.key, set);
    setOpen(Math.min(i + 1, 4));
  };
  const nav = (i, blocked) => (
    <div className="flex flex-wrap items-center gap-3 pt-2">
      {i > 0 && <Button kind="text" size="sm" prefixIcon={<ArrowLeft />} onClick={() => setOpen(i - 1)}>Back</Button>}
      {i < 4 && <Button status="primary" size="sm" suffixIcon={<ArrowRight />} disabled={Boolean(blocked)} onClick={() => next(i)}>Next</Button>}
      {blocked && <span className="text-caption typo-regular-text-sm">{blocked}</span>}
    </div>
  );
  const row = (i, props, content) => <Row n={i + 1} done={isDone(i)} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} {...props}>{content}</Row>;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-default bg-surface-lv1 p-4">
          <p className="flex items-center gap-2 typo-semi-bold-text-base"><Terminal size={18} />The sync tool</p>
          <p className="typo-regular-text-sm">The Figma-to-Storybook skill in your project: it reads Figma and <strong>sends</strong> reviews here. It needs Figma Desktop and its bridge, so it runs on a developer's computer, not on a build server.</p>
          <p className="text-caption typo-regular-text-sm">Needs: this service's address, this project's key, and the <strong>token</strong>. Steps 1 to 3.</p>
        </div>
        <div className="flex flex-col gap-2 rounded-default bg-surface-lv1 p-4">
          <p className="flex items-center gap-2 typo-semi-bold-text-base"><Monitor size={18} />The review page of your app</p>
          <p className="typo-regular-text-sm">The <code>/review</code> page of your own app, in the browser, where reviewers <strong>see</strong> the review and decide. It runs on your computer while you develop and after you deploy.</p>
          <p className="text-caption typo-regular-text-sm">Needs: this service's address and this project's key only. <strong>Never the token.</strong> Step 4.</p>
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {row(0, { title: "Create a token", summary: active.length ? `${active.length} active token${active.length === 1 ? "" : "s"}` : "Not yet" }, <>
          <p className="typo-regular-text-sm">A token is the sync tool's password for this project. Create one for the place that will run the Figma sync, and copy it when it appears: it is shown once.</p>
          {createStep}
          {nav(0, gate)}
        </>)}
        {row(1, { title: "Tell the sync tool where to send reviews", summary: used ? "A token was used: the tool is connected" : "A file, or environment variables" }, <>
          <div className="rounded-default bg-surface-lv1 p-4 typo-regular-text-sm">
            <p><strong>First, the tool must be in your project.</strong> It is the Figma-to-Storybook skill: the folder <code>.claude/skills/building-storybook-from-figma</code> and the <code>scripts/figma</code> scripts. A project that already has them can skip this. For another project, copy them from a project that has them: the skill's <code>reference/setup.md</code> explains the install. There is no shared package yet.</p>
          </div>
          <p className="typo-regular-text-sm">The tool needs three things: this service's address, this project's key, and your token. Keep them in <strong>one</strong> of these two places:</p>
          <div className="rounded-default bg-surface-lv1 p-4 typo-regular-text-sm">
            <p><strong>How the tool decides.</strong> It looks for the environment variables first (if it finds any of the three, it needs all three). If there are none, it reads the file. If it finds neither, it works alone on your computer and <strong>nobody can answer</strong>, because reviewers need this service. The tool does <strong>not</strong> read your app's <code>.env</code> file: export the variables in the shell that starts Claude Code, or use the file.</p>
          </div>
          <Tabs tabs={[{ value: "file", label: "A file (recommended)" }, { value: "env", label: "Environment variables" }]} value={where} onChange={setWhere} />
          {where === "file" ? (
            <>
              <p className="typo-regular-text-sm">The sync runs on your computer, so the file lives there, in the project's folder. Replace the token placeholder with the token from step 1. The <code>.figma-dump</code> folder stays out of git: never commit a token.</p>
              <CodeBlock title=".figma-dump/review-api.json" code={snippets.apiJson} note={'url is this service, project is this project\'s key. Optional: add a "reviewPage" line with the address of your review page (for example http://localhost:5002/review) so the tool\'s messages tell people where to answer.'} />
            </>
          ) : (
            <>
              <p className="typo-regular-text-sm">The same three values, if you prefer not to keep a file: put them in your shell profile, or in the environment that starts Claude Code. All three are needed, and then you do not need the file.</p>
              <CodeBlock title="Environment variables for the sync tool" code={snippets.toolEnv} />
            </>
          )}
          {nav(1)}
        </>)}
        {row(2, { title: "Check that this computer can reach the project", summary: used ? "Done: a token was used" : "One command" }, <>
          <p className="typo-regular-text-sm">Run one of these in a terminal. The first needs nothing installed.</p>
          <Tabs tabs={[{ value: "curl", label: "With curl (nothing to install)" }, { value: "tool", label: "With the tool (needs the skill)" }]} value={check} onChange={setCheck} />
          {check === "curl" ? (
            <CodeBlock title="Terminal" code={snippets.checkCurl} note={'Replace the placeholder with your token. A working token answers with {"reviews":[],"counts":{...}}. "Unknown or revoked project token" means the token is wrong.'} />
          ) : (
            <CodeBlock title="Run in the project's folder" code={snippets.checkCommand} note="It lists the reviews waiting for an answer, or says it cannot reach the service." />
          )}
          <p className="typo-regular-text-sm">Once the tool has used the token, its “Last used” time shows in the table below.</p>
          {nav(2)}
        </>)}
        {row(3, { title: "Connect the review page of your app", summary: "Two variables, no token" }, <>
          <p className="typo-regular-text-sm">This is a different thing from step 2. The review page is the <code>/review</code> page of your own app (not a separate app), and it runs in the browser, so it only gets the address of this service and the project key. The names start with <code>PUBLIC_</code> because that is how the app's build tool decides which values may be shown in the browser: <strong>never put the token here</strong>.</p>
          <p className="typo-regular-text-sm">Set them in both places the app runs: on your computer while you develop (the app's <code>.env</code> or <code>.env.development</code>), and where it is deployed.</p>
          <CodeBlock title="Environment variables for the app (.env)" code={snippets.pageEnv} note="On your computer, restart the dev server after changing them. On the host (on Vercel: Project → Settings → Environment Variables, for Production and Preview) they are read when the app is built, so deploy again." />
          {nav(3)}
        </>)}
        {row(4, { title: "Allow the page, invite reviewers, send the first review", summary: reviewsCount > 0 ? "A review has arrived" : "Settings, Members, then run the sync" }, <>
          <ol className="flex list-decimal flex-col gap-2 pl-5 typo-regular-text-sm">
            <li>Add the address the review page runs on to <strong>Allowed origins</strong>, otherwise the browser blocks it. It is your app's own address: <code>http://localhost:5002</code> if the app runs on port 5002, <code>http://localhost:3000</code> if it runs on 3000, and the deployed address too.</li>
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
