"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * TanStack Query global provider wrapper that configures defaultOptions with
 * refetchOnWindowFocus: false and retry: 1 to handle temporary network disconnects
 * or API failures gracefully.
 *
 * @param root0 - Provider props.
 * @param root0.children - The React tree that consumes the query client.
 * @returns The query client provider markup.
 */
export default function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
