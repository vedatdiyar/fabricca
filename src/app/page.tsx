import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCachedExpectedHash } from "@/lib/auth-cache";
import { getThesisCoreAction } from "@/app/dashboard/actions";
import DashboardClient from "@/app/dashboard/_components/dashboard-client";

const THESIS_STATE_HEADER = "x-thesis-state";

export default async function Home() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("academialab_session")?.value;
  const password = process.env.APP_PASSWORD;

  // Easy developer onboarding if APP_PASSWORD is not configured yet
  if (!password) {
    return <DashboardClient initialThesisData={null} />;
  }

  const expectedHash = await getCachedExpectedHash(password);

  if (sessionCookie === expectedHash) {
    // Onboarding state comes from the proxy's `x-thesis-state` header —
    // no second DB round-trip needed here.
    const headerStore = await headers();
    const thesisState = headerStore.get(THESIS_STATE_HEADER) ?? "unknown";
    const isThesisCoreEmpty = thesisState !== "present";

    if (isThesisCoreEmpty) {
      // If the proxy couldn't reach the DB, we still send the user to
      // /onboarding. The page there is safe to render even when the DB
      // recovers mid-request; the proxy will re-check on the next hop.
      redirect("/onboarding");
    }

    // Onboarding is complete: fetch the rich thesis data (boxes, note
    // counts) for the dashboard. This is the only remaining DB call on
    // this page, and the single-flight pattern in `src/db/index.ts`
    // collapses it with any concurrent calls.
    const coreRes = await getThesisCoreAction();
    const initialThesisData = coreRes.success ? coreRes.data ?? null : null;
    return <DashboardClient initialThesisData={initialThesisData} />;
  }

  redirect("/login");
}
