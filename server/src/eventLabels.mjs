// Plain-language labels for audit events and decisions (contract C1). Pure: the web side has no test runner,
// so the history route sends these ready-made. The MVP review page keeps its own copy with the same strings.
const EVENTS = {
  published: "Sent for review",
  "published (new cycle)": "Sent for review again, as a new review",
  "Figma changed: earlier answers dropped": "Figma changed: earlier answers were cleared, please answer again",
  "republished (same Figma state, answers kept)": "Synced again, nothing changed",
  decided: "Decision saved",
  applied: "Applied in the code",
};
const CHOICES = {
  "follow-figma": "Remove it, to match Figma",
  "keep-deprecated": "Keep it, but mark it as old",
  keep: "Keep it, and add it to Figma",
};

export const eventLabel = (action) => (typeof action === "string" ? (Object.hasOwn(EVENTS, action) ? EVENTS[action] : action) : "");

export const choiceLabel = (choice) => {
  if (choice == null) return "Answer cleared";
  return typeof choice === "string" && Object.hasOwn(CHOICES, choice) ? CHOICES[choice] : choice;
};

/** `removed-prop:searchable` -> `searchable`; `removed-option:kind=outlined` -> `kind="outlined"`. */
export function itemName(id) {
  const rest = String(id).slice(String(id).indexOf(":") + 1);
  if (!String(id).includes(":")) return String(id);
  const eq = rest.indexOf("=");
  return eq < 0 ? rest : `${rest.slice(0, eq)}="${rest.slice(eq + 1)}"`;
}

export function changeLines(changes, migrateBy) {
  if (!changes || typeof changes !== "object") return [];
  return Object.entries(changes).map(
    ([id, choice]) => `${itemName(id)}: ${choiceLabel(choice)}${migrateBy?.[id] ? `, migrate by ${migrateBy[id]}` : ""}`,
  );
}

// What kind of event an audit entry is, so the history can give each kind its own icon and weight.
export function eventKind(action) {
  if (typeof action !== "string") return "other";
  if (action === "decided") return "decided";
  if (action === "applied") return "applied";
  if (action.startsWith("Figma changed")) return "reopened";
  if (action.startsWith("republished")) return "synced";
  if (action.startsWith("published")) return "published";
  return "other";
}
