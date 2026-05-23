import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import type { QueryClient } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import {
  QUERY_CACHE_STORAGE_KEY,
  makeQueryClient,
  shouldDehydrateQuery,
} from '@/lib/query-client'

export interface RouterContext {
  queryClient: QueryClient
}

export function getRouter() {
  // One QueryClient per `getRouter()` call. On the server that means one per
  // request (no cross-request leakage); on the browser there's only one call
  // at hydration, so we naturally get a single shared client.
  const queryClient = makeQueryClient()

  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    context: { queryClient } satisfies RouterContext,
    defaultNotFoundComponent: () => (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Not found</h1>
      </div>
    ),
  })

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
    dehydrateOptions: { shouldDehydrateQuery },
  })

  // Browser-only: wire localStorage persistence for the home + single queries.
  // SSR runs in Node where `window` is undefined, so we guard the import
  // call site too (the persister module reaches for `window.localStorage`).
  if (typeof window !== 'undefined') {
    void bootstrapPersister(queryClient)
  }

  return router
}

async function bootstrapPersister(queryClient: QueryClient) {
  const [{ persistQueryClient }, { createSyncStoragePersister }] = await Promise.all([
    import('@tanstack/react-query-persist-client'),
    import('@tanstack/query-sync-storage-persister'),
  ])

  const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key: QUERY_CACHE_STORAGE_KEY,
  })

  persistQueryClient({
    queryClient,
    persister,
    // Persister TTL. Long enough to cover the longest persisted staleTime
    // (single = 1h) so reloads still hit cached data; short enough that we
    // don't ship truly ancient payloads back to the user.
    maxAge: 24 * 60 * 60 * 1000, // 24h
    dehydrateOptions: { shouldDehydrateQuery },
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
