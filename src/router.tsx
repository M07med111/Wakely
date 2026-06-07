import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { DefaultPending } from "@/components/default-pending";
import { routeTree } from "./routeTree.gen";

const basepath =
  import.meta.env.BASE_URL === "/" ? undefined : import.meta.env.BASE_URL.replace(/\/$/, "");

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    basepath,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: DefaultPending,
    defaultPendingMs: 200,
    defaultPendingMinMs: 300,
  });

  return router;
};
