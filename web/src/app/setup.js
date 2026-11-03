// What a developer needs to connect a project to this service: the snippets with the real address and project key already filled
// in (never a real token: it is shown once, when it is created, and the developer pastes it), and the setup checklist of a project.

const trim = (u) => String(u ?? "").replace(/\/+$/, "");

export const TOKEN_PLACEHOLDER = "drp_PASTE_YOUR_TOKEN_HERE";

/** The text to copy into the project: the tool's file or environment, and the review page's environment. */
export function connectSnippets({ origin, project } = {}) {
  const serviceUrl = trim(origin);
  const apiUrl = `${serviceUrl}/api/v1`;
  const key = project || "<project key>";
  return {
    serviceUrl,
    apiUrl,
    // .figma-dump/review-api.json on the machine that runs the Figma sync (per machine, never committed).
    apiJson: JSON.stringify({ url: apiUrl, project: key, token: TOKEN_PLACEHOLDER }, null, 2),
    // The same three values as environment variables, for someone who prefers not to keep a file. All three are needed.
    toolEnv: `REVIEW_API_URL=${apiUrl}\nREVIEW_PROJECT=${key}\nREVIEW_API_KEY=${TOKEN_PLACEHOLDER}`,
    // The app that hosts the /review page reads these when it is built.
    pageEnv: `PUBLIC_REVIEW_SERVICE_URL=${serviceUrl}\nPUBLIC_REVIEW_PROJECT=${key}`,
    checkCommand: "node scripts/figma/reviewState.mjs",
    // The same check with nothing to install: asks the service for this project's reviews with the token.
    checkCurl: `curl -s -H "Authorization: Bearer ${TOKEN_PLACEHOLDER}" ${apiUrl}/projects/${key}/reviews`,
  };
}

/** The five things that make a project work, each marked done from what the service already knows. `tab` is where to do it. */
export function setupChecklist(project, { tokens, members, reviews } = {}) {
  const items = [
    { id: "token", label: "Create a project token", help: "The sync tool uses it to publish reviews to this project.", done: (tokens ?? []).some((t) => !t.revokedAt), tab: "tokens" },
    { id: "origin", label: "Allow the address of the review page", help: "Without it the browser blocks the review page from talking to this service.", done: (project?.allowedOrigins ?? []).length > 0, tab: "settings" },
    { id: "reviewUrl", label: "Add the review page link", help: "Gives reviewers a button that opens the page where they decide.", done: Boolean(project?.reviewUrl), tab: "settings" },
    { id: "member", label: "Add a reviewer", help: "The designer or product owner who decides. They log in with their own account.", done: (members ?? []).length > 0, tab: "members" },
    { id: "review", label: "Publish the first review", help: "Run the Figma sync in the project. A review appears here when a component differs from Figma.", done: (reviews ?? 0) > 0, tab: "tokens" },
  ];
  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length, complete: done === items.length };
}
