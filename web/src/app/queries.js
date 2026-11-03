import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "app/api";

// Every read of the dashboard, with the key it is cached under. The keys nest (["project", key, ...]) so one call can refresh a whole
// project, and a mutation names exactly what it makes stale.
export const keys = {
  projects: ["projects"],
  project: (k) => ["project", k],
  overview: (k) => ["project", k, "overview"],
  reviews: (k) => ["project", k, "reviews"],
  history: (k) => ["project", k, "history"],
  members: (k) => ["project", k, "members"],
  tokens: (k) => ["project", k, "tokens"],
};

const minute = 60_000;
// How long each kind of data counts as fresh. Reviews and history change when a reviewer decides, on another page, and nothing here can
// tell the dashboard, so they go stale sooner. Tokens and members change only from this dashboard, and every change below invalidates them.
export const queries = {
  projects: () => ({ queryKey: keys.projects, queryFn: () => api("GET", "/projects"), staleTime: minute }),
  overview: (k) => ({ queryKey: keys.overview(k), queryFn: () => api("GET", `/projects/${k}/overview`), staleTime: minute }),
  reviews: (k) => ({ queryKey: keys.reviews(k), queryFn: () => api("GET", `/projects/${k}/reviews`), staleTime: 20_000 }),
  history: (k) => ({ queryKey: keys.history(k), queryFn: () => api("GET", `/projects/${k}/history`), staleTime: 20_000 }),
  members: (k) => ({ queryKey: keys.members(k), queryFn: () => api("GET", `/projects/${k}/members`), staleTime: 5 * minute }),
  tokens: (k) => ({ queryKey: keys.tokens(k), queryFn: () => api("GET", `/projects/${k}/tokens`), staleTime: 5 * minute }),
};

export const useProjects = () => useQuery(queries.projects());
export const useOverview = (k, enabled = true) => useQuery({ ...queries.overview(k), enabled });
export const useReviews = (k) => useQuery(queries.reviews(k));
export const useHistory = (k) => useQuery(queries.history(k));
export const useMembers = (k) => useQuery(queries.members(k));
export const useTokens = (k) => useQuery(queries.tokens(k));

/**
 * Starts loading what the tabs of a project need, in parallel and in the background, so that switching tabs shows data at once.
 * Nothing waits for it and a failure is ignored here: the tab that needs the data asks again and shows the error.
 */
export function prefetchProject(queryClient, key, isAdmin) {
  const wanted = [queries.reviews(key), queries.history(key), ...(isAdmin ? [queries.overview(key), queries.members(key), queries.tokens(key)] : [])];
  for (const q of wanted) queryClient.prefetchQuery(q).catch(() => {});
}

// Writes that make cached reads wrong. Each one invalidates what it changed (they refetch only if on screen, otherwise on the next visit).
function useWrite(fn, staleKeys) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data, vars) => Promise.all(staleKeys(vars, data).map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}

export const useCreateProject = () => useWrite((body) => api("POST", "/projects", body), () => [keys.projects]);
export const useSaveSettings = (k) => {
  const queryClient = useQueryClient();
  const write = useWrite((body) => api("PATCH", `/projects/${k}`, body), () => [keys.projects, keys.overview(k)]);
  // The saved project is shown at once, before the list is read again.
  return { ...write, mutateAsync: async (body) => { const saved = await write.mutateAsync(body); queryClient.setQueryData(keys.projects, (list) => list?.map((p) => (p.key === k ? { ...p, ...saved } : p))); return saved; } };
};
export const useCreateToken = (k) => useWrite((label) => api("POST", `/projects/${k}/tokens`, { label }), () => [keys.tokens(k), keys.overview(k)]);
export const useRevokeToken = (k) => useWrite((id) => api("DELETE", `/projects/${k}/tokens/${id}`), () => [keys.tokens(k), keys.overview(k)]);
export const useAddMember = (k) => useWrite((body) => api("POST", `/projects/${k}/members`, body), () => [keys.members(k), keys.overview(k)]);
export const useRemoveMember = (k) => useWrite((id) => api("DELETE", `/projects/${k}/members/${id}`), () => [keys.members(k), keys.overview(k)]);
