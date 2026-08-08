export const instant = false;

import { AdvisorChat } from "./_components/advisor-chat";

interface AdvisorPageProps {
  searchParams: Promise<{ session?: string }>;
}

/**
 * Advisor room page — provides an interactive AI Academic Advisor chat interface driven by Hybrid RAG & Cohere Rerank.
 *
 * @param root0 - Page props.
 * @param root0.searchParams - Route query parameters holding the active session id.
 * @returns The advisor page layout and chat client component.
 */
export default async function AdvisorPage({ searchParams }: AdvisorPageProps) {
  const params = await searchParams;
  const rawSession = params.session;
  const sessionId =
    rawSession !== undefined && /^\d+$/.test(rawSession)
      ? Number(rawSession)
      : undefined;

  return <AdvisorChat initialSessionId={sessionId} />;
}
