import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Alert } from "components/alert";
import { Button } from "components/button";
import { Card } from "components/card";
import { Input } from "components/input";
import { Modal } from "components/modal";
import { useDeleteProject, useOverview } from "app/queries";
import { SectionTitle } from "app/ui";

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** What deleting the project takes with it, in plain words, from the counts the dashboard already has. */
export function consequences(project, overview) {
  const { reviews = 0, activeTokens = 0, members = 0 } = overview ?? {};
  const are = (n) => (n === 1 ? "is" : "are");
  const s = (n) => (n === 1 ? "s" : "");
  return [
    `${plural(reviews, "review", "reviews")} with every decision the designers and product owners saved, and the activity log, ${are(reviews)} deleted. There is no backup to restore ${reviews === 1 ? "it" : "them"} from.`,
    `${plural(activeTokens, "active token", "active tokens")} stop${s(activeTokens)} working at once. The sync tool of ${project.name} (reviewSync) gets a 401 and cannot publish until someone makes a new project and a new token.`,
    `${plural(members, "member", "members")} lose${s(members)} access to this project. Their accounts are not deleted: they can still log in and open their other projects.`,
    `The review page of the app can no longer load: it shows that the project is not found, and the allowed addresses (origins) stop working.`,
    `The code, the Figma file and Storybook are not touched. The key "${project.key}" becomes free: a project made later with the same key starts empty.`,
  ];
}

/** The danger zone at the end of the settings: delete the project after reading what it takes with it and typing its key. */
export function DeleteProject({ project }) {
  const overview = useOverview(project.key);
  const del = useDeleteProject();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const close = () => { if (!del.isPending) { setOpen(false); setTyped(""); setError(""); } };
  const go = async () => {
    setError("");
    try {
      await del.mutateAsync(project.key);
      navigate("/projects", { replace: true });
    } catch (err) {
      setError(err.message);
    }
  };
  const list = consequences(project, overview.data);
  return (
    <section className="flex flex-col gap-4">
      <SectionTitle icon={<AlertTriangle size={20} className="text-red-600" />} title="Danger zone" description="Things here cannot be undone." />
      <div className="rounded-xl border border-red-300">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex max-w-xl flex-col gap-1">
              <p className="typo-semi-bold-text-sm">Delete this project</p>
              <p className="text-caption typo-regular-text-sm">Removes the project, its reviews, its tokens and its member list for good. You will see what it takes with it before anything is deleted.</p>
            </div>
            <Button status="danger" kind="outlined" prefixIcon={<Trash2 />} onClick={() => setOpen(true)}>Delete this project…</Button>
          </div>
        </Card>
      </div>
      <Modal
        open={open}
        onClose={close}
        title={`Delete ${project.name}?`}
        size="md"
        footer={(
          <>
            <Button kind="text" onClick={close} disabled={del.isPending}>Cancel</Button>
            <Button status="danger" loading={del.isPending} disabled={typed !== project.key} onClick={go}>Delete this project for good</Button>
          </>
        )}
      >
        <div className="flex flex-col gap-4">
          <Alert status="danger" title="This cannot be undone">Deleting a project is final, like deleting a repository. Read what happens, then type the project key to confirm.</Alert>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-slate-700">
            {list.map((line) => <li key={line}>{line}</li>)}
          </ul>
          {error && <Alert status="danger" kind="outlined">{error}</Alert>}
          <Input label={`Type ${project.key} to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
        </div>
      </Modal>
    </section>
  );
}
