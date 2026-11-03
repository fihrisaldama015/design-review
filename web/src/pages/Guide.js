import { Link } from "react-router-dom";
import { BadgeCheck, BookOpen, Gavel, Monitor, ShieldCheck, Upload } from "lucide-react";
import { Badge } from "components/badge";
import { Card } from "components/card";
import { CHOICES, GLOSSARY, STATUS, TROUBLESHOOTING } from "app/help";
import { FaqList, SectionTitle, Step } from "app/ui";

const FLOW = [
  { icon: <Upload size={28} />, title: "Figma and the code differ", text: "The developer runs the Figma sync. If a component in code no longer matches Figma, a review is sent here." },
  { icon: <Monitor size={28} />, title: "Reviewers look", text: "They see what changed, which pages of the app use it, and the app next to the Figma version." },
  { icon: <Gavel size={28} />, title: "Reviewers decide", text: "Remove it, keep it as old, or keep it and add it to Figma. They can say why." },
  { icon: <BadgeCheck size={28} />, title: "The developer applies it", text: "The code follows the decision. The review turns Applied and the history keeps who decided what." },
];

/** A page that explains the whole service in plain words, for anyone who just got an invitation. */
export default function Guide() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 typo-semi-bold-text-lg"><BookOpen size={22} />How design review works</h1>
        <p className="max-w-3xl text-caption typo-regular-text-sm">A design system lives in two places: in Figma and in code. When they drift apart, this service asks the people who own the design what should happen, and the developer applies the answer. Nothing changes in the code until someone decides.</p>
      </div>

      <section className="flex flex-col gap-4">
        <SectionTitle title="The flow, in four steps" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {FLOW.map((f, i) => (
            <Card key={f.title}>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-primary opacity-70">{f.icon}</span>
                  <span className="typo-semi-bold-text-sm text-caption">Step {i + 1}</span>
                </div>
                <h3 className="typo-semi-bold-text-base">{f.title}</h3>
                <p className="text-caption typo-regular-text-sm">{f.text}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle icon={<ShieldCheck size={20} />} title="Who does what" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card title="Developer" description="Runs the Figma sync.">
            <ul className="flex list-disc flex-col gap-1 pl-5 typo-regular-text-sm">
              <li>Sends reviews with a project token</li>
              <li>Reads the decisions</li>
              <li>Applies them in the code and closes the review</li>
            </ul>
          </Card>
          <Card title="Reviewer (member)" description="A designer or product owner.">
            <ul className="flex list-disc flex-col gap-1 pl-5 typo-regular-text-sm">
              <li>Logs in with their own account</li>
              <li>Looks at each review and decides</li>
              <li>Sees the history of the project</li>
            </ul>
          </Card>
          <Card title="Admin" description="Runs this service.">
            <ul className="flex list-disc flex-col gap-1 pl-5 typo-regular-text-sm">
              <li>Creates projects and their settings</li>
              <li>Creates tokens and adds members</li>
              <li>Sees every project</li>
            </ul>
          </Card>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle title="The three decisions" description="For each thing Figma no longer has, the reviewers pick one." />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {CHOICES.map((c) => (
            <Card key={c.value} title={c.label}>
              <p className="typo-regular-text-sm">{c.meaning}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle title="Where a review stands" description="Every review has one of three statuses." />
        <Card>
          <ul className="flex flex-col gap-4">
            {Object.entries(STATUS).map(([k, s]) => (
              <li key={k} className="flex flex-wrap items-center gap-3">
                <div className="w-52 shrink-0"><Badge tone={s.tone}>{s.label}</Badge></div>
                <p className="min-w-0 flex-1 typo-regular-text-sm">{s.meaning}</p>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle title="Setting up a new project" description="For admins. Each project has a checklist that shows what is left." />
        <ol className="flex flex-col">
          <Step n={1} title="Create the project"><p className="typo-regular-text-sm">In <Link to="/projects" className="text-primary underline">Projects</Link>, press New project. Choose a short key you will keep.</p></Step>
          <Step n={2} title="Create a token and connect the tool"><p className="typo-regular-text-sm">Open the project, then Tokens &amp; setup. It has the files and settings to copy, already filled in with this project's address and key.</p></Step>
          <Step n={3} title="Allow the review page and add its link"><p className="typo-regular-text-sm">In Settings, add the address the app's review page runs on (otherwise the browser blocks it), and the link reviewers open.</p></Step>
          <Step n={4} title="Add the reviewers"><p className="typo-regular-text-sm">In Members, add the designer or product owner. A temporary password is shown once: send it to them.</p></Step>
          <Step n={5} title="Run the Figma sync"><p className="typo-regular-text-sm">When a component differs from Figma, a review appears in the Reviews tab.</p></Step>
        </ol>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle title="Words you will see" />
        <Card>
          <dl className="flex flex-col gap-4">
            {GLOSSARY.map((g) => (
              <div key={g.term} className="flex flex-col gap-0.5 md:flex-row md:gap-6">
                <dt className="w-40 shrink-0 typo-semi-bold-text-sm">{g.term}</dt>
                <dd className="min-w-0 flex-1 typo-regular-text-sm">{g.meaning}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle title="If something does not work" description="The messages you are most likely to see, and what to do." />
        <FaqList items={TROUBLESHOOTING} />
      </section>
    </>
  );
}
