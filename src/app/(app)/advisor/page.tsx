import { Suspense } from "react";
import { redirect } from "next/navigation";
import AdvisorLoading from "./loading";

interface AdvisorPageProps {
  searchParams: Promise<{ session?: string }>;
}

async function AdvisorRedirectContent({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}): Promise<null> {
  const params = await searchParams;
  if (params.session) {
    redirect(
      `/advisor/draft-review?session=${encodeURIComponent(params.session)}`,
    );
  }
  redirect("/advisor/draft-review");
  return null;
}

/**
 * Advisor root page — redirects to the default "Taslak İnceleme" workspace.
 *
 * @param root0 - Page props.
 * @param root0.searchParams - Route query parameters.
 * @returns Nothing, redirects immediately.
 */
export default function AdvisorPage({ searchParams }: AdvisorPageProps) {
  return (
    <Suspense fallback={<AdvisorLoading />}>
      <AdvisorRedirectContent searchParams={searchParams} />
    </Suspense>
  );
}


