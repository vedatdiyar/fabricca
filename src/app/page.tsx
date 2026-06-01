import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getThesisCoreAction } from "@/app/dashboard/actions";
import DashboardClient from "@/app/dashboard/_components/dashboard-client";

const AUTH_HEADER = "x-auth-authenticated";
const THESIS_STATE_HEADER = "x-thesis-state";

export default async function Home() {
  const headerStore = await headers();
  const isAuthenticated = headerStore.get(AUTH_HEADER) === "true";

  // Developer onboarding without password
  if (!process.env.APP_PASSWORD) {
    return <DashboardClient initialThesisData={null} />;
  }

  if (!isAuthenticated) {
    redirect("/login");
  }

  // Thesis state is pre-computed by proxy.ts
  const thesisState = headerStore.get(THESIS_STATE_HEADER) ?? "unknown";

  if (thesisState !== "present") {
    redirect("/onboarding");
  }

  const coreRes = await getThesisCoreAction();
  const initialThesisData = coreRes.success ? coreRes.data ?? null : null;
  return <DashboardClient initialThesisData={initialThesisData} />;
}
