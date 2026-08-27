import { Suspense } from "react";
import { AssistantWorkspace } from "../_components/assistant/assistant-workspace";
import AdvisorLoading from "../loading";

interface AssistantChatPageProps {
  searchParams: Promise<{ session?: string }>;
}

async function AssistantChatContent({
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
    <AssistantWorkspace key={sessionId ?? "new"} initialSessionId={sessionId} />
  );
}

/**
 * Thesis Assistant page — "Tez Asistanı Serbest Danışma Odası".
 * Provides conversational academic guidance with dynamic RAG context retrieval,
 * structured literature citations, and persistent topic session history.
 *
 * @param root0 - Page props.
 * @param root0.searchParams - Route query parameters holding the active session id.
 * @returns The Assistant workspace layout and client component.
 */
export default function AssistantChatPage({
  searchParams,
}: AssistantChatPageProps) {
  return (
    <Suspense fallback={<AdvisorLoading />}>
      <AssistantChatContent searchParams={searchParams} />
    </Suspense>
  );
}
