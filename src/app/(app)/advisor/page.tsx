import { AdvisorOfficeWorkspace } from "./_components/advisor-office-workspace";

interface AdvisorPageProps {
  searchParams: Promise<{ session?: string }>;
}

/**
 * Advisor page — "Danışmanın Çalışma Odası" (Office Hours & Taslak Denetim Masası).
 * Transforms the advisor into a dedicated academic office where students submit Word drafts,
 * receive 3-part margin notes (citation audit, non-destructive diff, jury critiques),
 * and negotiate/defend their arguments live with the Socratic advisor.
 *
 * @param root0 - Page props.
 * @param root0.searchParams - Route query parameters holding the active session id.
 * @returns The Advisor Office workspace layout and client component.
 */
export default async function AdvisorPage({ searchParams }: AdvisorPageProps) {
  const params = await searchParams;
  const rawSession = params.session;
  const sessionId =
    rawSession !== undefined && /^\d+$/.test(rawSession)
      ? Number(rawSession)
      : undefined;

  return <AdvisorOfficeWorkspace initialSessionId={sessionId} />;
}
