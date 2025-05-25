import 'server-only'; // <-- ensure this file cannot be imported from the client
import { createTRPCOptionsProxy, TRPCQueryOptions } from '@trpc/tanstack-react-query';
import { cache } from 'react';
import { makeQueryClient } from './query-client';
import { createTRPCClient, httpLink } from '@trpc/client';
import { AppRouter } from '@server/trpc/trpc.router';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

// IMPORTANT: Create a stable getter for the query client that
//            will return the same client during the same request.

export const getQueryClient = cache(makeQueryClient);

function getBaseUrl() {
  // Use VERCEL_URL if available, otherwise fallback to localhost
  const vercelUrl = process.env.VERCEL_URL1;
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }
  return 'http://localhost:3001';
}

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: createTRPCClient({
    links: [httpLink({ url: `${getBaseUrl()}/trpc` })],
  }),
  queryClient: getQueryClient,
});

export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}
export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
  queryOptions: T,
) {
  const queryClient = getQueryClient();
  if (queryOptions.queryKey[1]?.type === 'infinite') {
    void queryClient.prefetchInfiniteQuery(queryOptions as any);
  } else {
    void queryClient.prefetchQuery(queryOptions);
  }
}
