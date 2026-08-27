import { Suspense } from "react";
import { AdvisorOfficeWorkspace } from "../_components/advisor-office-workspace";
import AdvisorLoading from "../loading";

interface DraftReviewPageProps {
  searchParams: Promise<{ session?: string }>;
}

async function DraftReviewContent({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const params = await searchParams;
  const rawSession = params.session;
  const sessionId =
    rawSession !== undefined && /^\d+$/.test(rawSession)
      ? Number(rawSession)
      : undefined;

  return (
    <AdvisorOfficeWorkspace
      key={sessionId ?? "new"}
      initialSessionId={sessionId}
    />
  );
}

/**
 * Draft Review page — "Taslak İnceleme ve Canlı Müzakere Masası".
 * Provides structured 3-part margin notes (citation audit, non-destructive diff, jury critiques)
 * and live Socratic defense negotiation.
 *
 * @param root0 - Page props.
 * @param root0.searchParams - Route query parameters holding the active session id.
 * @returns The Advisor Office workspace layout and client component.
 */
export default function DraftReviewPage({
  searchParams,
}: DraftReviewPageProps) {
  return (
    <Suspense fallback={<AdvisorLoading />}>
      <DraftReviewContent searchParams={searchParams} />
    </Suspense>
  );
}
