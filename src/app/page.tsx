import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getExpectedHash } from "@/lib/auth";
import { getThesisCoreAction } from "@/app/dashboard/actions";
import DashboardClient from "@/app/dashboard/_components/dashboard-client";

export default async function Home() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("academialab_session")?.value;
  const password = process.env.APP_PASSWORD;

  // Easy developer onboarding if APP_PASSWORD is not configured yet
  if (!password) {
    return <DashboardClient initialThesisData={null} />;
  }

  const expectedHash = await getExpectedHash(password);

  if (sessionCookie === expectedHash) {
    let initialThesisData = null;
    let isThesisCoreEmpty = true;
    try {
      const coreRes = await getThesisCoreAction();
      if (coreRes.success && coreRes.data) {
        isThesisCoreEmpty = false;
        initialThesisData = coreRes.data;
      }
    } catch (error) {
      console.error("Failed to query thesisCore in root page:", error);
      isThesisCoreEmpty = true;
    }

    if (isThesisCoreEmpty) {
      redirect("/onboarding");
    } else {
      return <DashboardClient initialThesisData={initialThesisData} />;
    }
  }

  redirect("/login");
}
