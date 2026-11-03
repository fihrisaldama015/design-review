import { useState } from "react";
import { Globe, Link2, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { Alert } from "components/alert";
import { Button } from "components/button";
import { Card } from "components/card";
import { Field } from "components/field";
import { Input } from "components/input";
import { Textarea } from "components/textarea";
import { api } from "app/api";
import { FieldHelp, SectionTitle, TabIntro } from "app/ui";

/** The settings of a project: its name, the links reviewers use, and the addresses allowed to talk to the service. */
export function Settings({ project, isAdmin, onSaved }) {
  const [form, setForm] = useState({
    name: project.name,
    figmaFileKey: project.figmaFileKey || "",
    storybookUrl: project.storybookUrl || "",
    reviewUrl: project.reviewUrl || "",
    origins: project.allowedOrigins.join("\n"),
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    setSaved(false);
    setForm({ ...form, [k]: e.target.value });
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { origins, ...rest } = form;
      await api("PATCH", `/projects/${project.key}`, {
        ...rest,
        allowedOrigins: origins.split("\n").map((o) => o.trim()).filter(Boolean),
      });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <TabIntro icon={<SettingsIcon size={24} />} title="How this project is named, linked and allowed to connect">
        <p>Only the name is required. The two things worth setting early are the <strong>review page link</strong> (so reviewers can open the page where they decide) and the <strong>allowed origins</strong> (without them the review page cannot talk to this service).</p>
      </TabIntro>
      {error && <Alert status="danger" kind="outlined">{error}</Alert>}
      {saved && <Alert status="success" kind="outlined">Saved.</Alert>}

      <section className="flex flex-col gap-4">
        <SectionTitle icon={<SettingsIcon size={20} />} title="About this project" />
        <Card>
          <div className="flex max-w-xl flex-col gap-4">
            <Field label="Name" required hint="Shown in the project list and on the review page.">
              <Input value={form.name} onChange={set("name")} readOnly={!isAdmin} />
            </Field>
            <p className="text-caption typo-regular-text-sm">The key <code>{project.key}</code> cannot be changed: tokens and the sync tool use it.</p>
          </div>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle icon={<Link2 size={20} />} title="Links" description="Where reviewers and the sync tool find the design and the app. All are optional." />
        <Card>
          <div className="flex max-w-xl flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Field label="Review page URL" hint="The page of your app where reviewers decide.">
                <Input value={form.reviewUrl} onChange={set("reviewUrl")} readOnly={!isAdmin} placeholder="https://app.example.com/review" />
              </Field>
              <FieldHelp>
                <p>It is the address of your app plus <code>/review</code>. Reviewers get an <strong>Open the review page</strong> button with it.</p>
                <p>Open the review page of your app in the browser and copy the address from the address bar. On your own computer it is usually <code>http://localhost:5002/review</code>.</p>
              </FieldHelp>
            </div>
            <div className="flex flex-col gap-2">
              <Field label="Figma file key" hint="The part of the Figma address after /design/.">
                <Input value={form.figmaFileKey} onChange={set("figmaFileKey")} readOnly={!isAdmin} placeholder="AbC123xyz" />
              </Field>
              <FieldHelp>
                <p>In Figma, open the design system file and press <strong>Share → Copy link</strong>. The link looks like <code>https://www.figma.com/design/AbC123xyz/Design-system?node-id=…</code>.</p>
                <p>The key is <code>AbC123xyz</code>: what is between <code>/design/</code> and the next <code>/</code>. The sync tool already sends the key with each review, so this is a reference for people.</p>
              </FieldHelp>
            </div>
            <div className="flex flex-col gap-2">
              <Field label="Storybook URL" hint="Where the design system's Storybook is deployed.">
                <Input value={form.storybookUrl} onChange={set("storybookUrl")} readOnly={!isAdmin} placeholder="https://storybook.example.com" />
              </Field>
              <FieldHelp>
                <p>Open the deployed Storybook in the browser and copy the address up to the end of the host, without <code>/?path=…</code>. If it is hosted on Vercel, it is the project's domain.</p>
                <p>Reviews link to the component's page there, so a reviewer can try the component.</p>
              </FieldHelp>
            </div>
          </div>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle icon={<ShieldCheck size={20} />} title="Allowed origins" description="The addresses the review page runs on. The service refuses pages anywhere else." />
        <Card>
          <div className="flex max-w-xl flex-col gap-2">
            <Field label="Origins" hint="One per line: http or https, the host, and the port if there is one. No path.">
              <Textarea value={form.origins} onChange={set("origins")} readOnly={!isAdmin} rows={4} placeholder={"https://app.example.com\nhttp://localhost:5002"} />
            </Field>
            <FieldHelp title="What is an origin, and which ones do I add?">
              <p>An origin is the start of a page's address, up to the first single slash: <code>https://app.example.com</code> or <code>http://localhost:5002</code>.</p>
              <p>Add every place people open the review page from: production, staging, and your own computer. <code>http</code> and <code>https</code>, and different ports, count as different origins.</p>
              <p>Copy it from the browser's address bar and delete everything after the host. A trailing <code>/review</code> or a final <code>/</code> is not accepted.</p>
              <p>If a reviewer sees that the page cannot reach the service, a missing origin is the first thing to check.</p>
            </FieldHelp>
          </div>
        </Card>
      </section>

      {isAdmin && (
        <div className="flex items-center gap-3">
          <Button type="submit" status="primary" prefixIcon={<Globe />} loading={busy} disabled={!form.name.trim()}>Save settings</Button>
        </div>
      )}
    </form>
  );
}
