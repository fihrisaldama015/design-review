import { useState } from "react";
import { CheckCircle2, ChevronDown, CircleDashed, ListChecks } from "lucide-react";
import { Button } from "components/button";
import { Card } from "components/card";
import { Collapse } from "app/Collapse";
import { ProgressRing } from "app/ProgressRing";
import { setupChecklist } from "app/setup";

const WHERE = { tokens: "Tokens & setup", settings: "Settings", members: "Members" };

/** What is left to make a project work, from what the service already knows. Admins only. */
export function SetupChecklist({ project, overview, onGo }) {
  const c = setupChecklist(project, overview);
  const [open, setOpen] = useState(null); // null: open while something is left, closed when all is done
  const shown = open ?? !c.complete;
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <ProgressRing value={c.done} max={c.total} size={72} tone={c.complete ? "success" : "warning"} />
          <div className="flex flex-col gap-0.5">
            <h3 className="flex items-center gap-2 typo-semi-bold-text-base"><ListChecks size={18} />{c.complete ? "This project is set up" : "Set up this project"}</h3>
            <p className="text-caption typo-regular-text-sm">
              {c.complete ? "Everything below is done. Reviews can flow from Figma to the reviewers and back." : `${c.done} of ${c.total} done. Finish these so reviews can flow from Figma to the reviewers and back.`}
            </p>
          </div>
        </div>
        <Button kind="text" size="sm" suffixIcon={<ChevronDown className={`transition-transform duration-300 ${shown ? "rotate-180" : ""}`} />} onClick={() => setOpen(!shown)}>{shown ? "Hide steps" : "Show steps"}</Button>
      </div>
      <Collapse open={shown}>
        <ul className="mt-4 flex flex-col gap-3">
          {c.items.map((i) => (
            <li key={i.id} className="flex items-start gap-3">
              {i.done ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-success" /> : <CircleDashed size={20} className="mt-0.5 shrink-0 text-caption" />}
              <div className="flex min-w-0 flex-1 flex-col">
                <span className={i.done ? "typo-regular-text-sm text-caption line-through" : "typo-medium-text-sm"}>{i.label}</span>
                {!i.done && <span className="text-caption typo-regular-text-sm">{i.help}</span>}
              </div>
              {!i.done && <Button kind="outlined" size="sm" onClick={() => onGo(i.tab)}>{`Go to ${WHERE[i.tab]}`}</Button>}
            </li>
          ))}
        </ul>
      </Collapse>
    </Card>
  );
}
