import { QueryClient } from "@tanstack/react-query";

/**
 * The cache of the dashboard. A screen that was opened before shows what it had at once; when that is older than its `staleTime`
 * it is refreshed in the background (the screen does not blink) and again when the window gets focus. A failed read is tried once
 * more, except a 4xx: asking again does not change the answer.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: true,
        retry: (count, err) => count < 1 && !(err?.status >= 400 && err?.status < 500),
      },
    },
  });
}
