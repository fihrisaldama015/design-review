// The words the dashboard uses to explain itself, in one place so the Guide and the tabs say the same thing.

export const STATUS = {
  pending: { label: "Waiting for an answer", tone: "warning", meaning: "A reviewer still has to decide what happens to something Figma no longer has." },
  answered: { label: "Answered", tone: "info", meaning: "The reviewers decided. The developer applies the decision in the code next." },
  applied: { label: "Applied", tone: "success", meaning: "The developer applied the decision in the code. Nothing left to do." },
};

export const CHOICES = [
  { value: "follow-figma", label: "Remove it, to match Figma", meaning: "The option disappears from the component. Screens that use it lose it and the developers update them." },
  { value: "keep-deprecated", label: "Keep it, but mark it as old", meaning: "Screens that use it keep working until a date (migrate by). New screens do not get it by default." },
  { value: "keep", label: "Keep it, and add it to Figma", meaning: "Nothing changes in the code. The design adds it to Figma so both match." },
];

export const GLOSSARY = [
  { term: "Review", meaning: "One component that exists in code but differs from Figma. It lists what is different and what each difference touches in the app." },
  { term: "Decision", meaning: "What the reviewers choose for each difference: remove it, keep it as old, or keep it and add it to Figma. It is saved with who decided, when and why." },
  { term: "Project", meaning: "One app with its own Figma file, reviewers and settings. Every review belongs to a project." },
  { term: "Project token", meaning: "A secret that lets the sync tool publish reviews to one project. Only the tool uses it, never a person or a browser. It starts with drp_." },
  { term: "Member", meaning: "A person who can open a project's reviews and decide. Designers and product owners are members." },
  { term: "Review page", meaning: "The page of the app itself (usually /review) where members log in and decide. It shows the app next to the Figma version." },
  { term: "Allowed origin", meaning: "The address the review page runs on (for example https://app.example.com). The service only talks to pages on these addresses." },
];

export const TROUBLESHOOTING = [
  { q: "The tool says \"Unknown or revoked project token\"", a: "The token in .figma-dump/review-api.json (or in REVIEW_API_KEY) is wrong, or it was revoked. Create a new token in the Tokens & setup tab and paste it. Also check that `project` is the key of this project." },
  { q: "The review page says \"The review service is not set up\"", a: "The app was built without PUBLIC_REVIEW_SERVICE_URL and PUBLIC_REVIEW_PROJECT. Add both to the app's environment (the .env file, and your hosting's environment variables) and build again: they are read at build time." },
  { q: "The review page cannot reach the service (the browser blocks it)", a: "The address of the page is not in Allowed origins. Open Settings and add it exactly as it shows in the browser's address bar, without a path: https://app.example.com or http://localhost:5002. http and https, and the port, count as different addresses." },
  { q: "A reviewer sees \"Log in again\"", a: "A login lasts 8 hours. The choices they picked stay on the page: they log in again and press Save answers." },
  { q: "No review shows up after the Figma sync", a: "A review appears only when a component that already exists in code differs from Figma. Check what the tool printed, and that the `project` in its file is this project's key." },
  { q: "A reviewer cannot see the project", a: "Add them in the Members tab. A member only sees the projects they were added to." },
];
