import { useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, BookOpen, ExternalLink } from "lucide-react";
import { Alert } from "components/alert";
import { Button } from "components/button";
import { Tabs } from "components/tabs";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { getSession } from "app/api";
import { prefetchProject, useOverview, useProjects } from "app/queries";
import { LoadingRow, Updating } from "app/ui";
import { ReviewsTab } from "pages/ReviewsTab";
import { History } from "pages/project/History";
import { Members } from "pages/project/Members";
import { SetupChecklist } from "pages/project/SetupChecklist";
import { Settings } from "pages/project/Settings";
import { Tokens } from "pages/project/Tokens";

const figmaUrl = (key) => (key ? `https://www.figma.com/design/${encodeURIComponent(key)}` : null);

/** One project: its header and links, the setup checklist (admins), and the tabs. */
export default function ProjectDetail() {
  const { key } = useParams();
  const isAdmin = getSession().user.role === "admin";
  const queryClient = useQueryClient();
  const { data: projects, error, isLoading: loading } = useProjects();
  // The open tab lives in the address (?tab=members), so a refresh, a shared link and the Back button all keep it.
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const setTab = (value, { replace = false } = {}) => setParams((p) => { const next = new URLSearchParams(p); next.set("tab", value); return next; }, { replace });
  const project = projects?.find((p) => p.key === key);
  const known = Boolean(project);
  const overview = useOverview(key, isAdmin && known); // the checklist's counts: one cheap read, refreshed by the writes that change them
  // Opening a project starts loading every tab in the background, so switching tabs shows data at once instead of a wait.
  useEffect(() => { if (known) prefetchProject(queryClient, key, isAdmin); }, [known, key, isAdmin, queryClient]);
  const refreshing = useIsFetching({ queryKey: ["project", key] }) > 0; // something under this project is being read again, behind what is shown
  const tabs = [
    { value: "reviews", label: "Reviews", ...(project?.counts?.pending ? { count: project.counts.pending } : {}) },
    { value: "history", label: "History" },
    ...(isAdmin ? [{ value: "members", label: "Members" }, { value: "tokens", label: "Tokens & setup" }, { value: "settings", label: "Settings" }] : []),
  ];
  const active = tabs.some((t) => t.value === requested) ? requested : "reviews"; // an unknown tab, or one this person may not open, shows Reviews
  useEffect(() => { if (requested && requested !== active) setTab(active, { replace: true }); }, [requested, active]); // and the address is corrected without a history entry
  const links = project ? [
    project.reviewUrl && { href: project.reviewUrl, label: "Open the review page", primary: true },
    figmaUrl(project.figmaFileKey) && { href: figmaUrl(project.figmaFileKey), label: "Open in Figma" },
    project.storybookUrl && { href: project.storybookUrl, label: "Open Storybook", icon: <BookOpen /> },
  ].filter(Boolean) : [];

  return (
    <>
      <div>
        <Button as={Link} to="/projects" kind="text" size="sm" prefixIcon={<ArrowLeft />}>All projects</Button>
      </div>
      {loading && <LoadingRow text="Loading the project…" />}
      {error && <Alert status="danger" kind="outlined">{error.message}</Alert>}
      {!loading && !error && !project && <Alert status="warning" kind="outlined">No such project, or you were not added to it.</Alert>}
      {project && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="typo-semi-bold-text-lg">{project.name}</h1>
              <p className="text-caption typo-regular-text-sm">Project key <code>{project.key}</code></p>
            </div>
            {links.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Updating active={refreshing} />
                {links.map((l) => (
                  <Button key={l.label} as="a" href={l.href} target="_blank" rel="noreferrer" kind="outlined" size="sm" prefixIcon={l.icon} suffixIcon={<ExternalLink />}>{l.label}</Button>
                ))}
              </div>
            )}
          </div>
          {isAdmin && overview.data && <SetupChecklist project={project} overview={overview.data} onGo={setTab} />}
          <Tabs tabs={tabs} value={active} onChange={setTab} />
          {active === "reviews" && <ReviewsTab key={project.key} project={project} isAdmin={isAdmin} onGo={setTab} />}
          {active === "history" && <History project={project} />}
          {active === "members" && isAdmin && <Members project={project} />}
          {active === "tokens" && isAdmin && <Tokens project={project} reviewsCount={overview.data?.reviews ?? 0} onGo={setTab} />}
          {active === "settings" && isAdmin && <Settings key={project.key} project={project} isAdmin={isAdmin} />}
        </>
      )}
    </>
  );
}
