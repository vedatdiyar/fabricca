import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getExpectedHash } from "@/lib/auth";
import { db } from "@/db";
import { thesisCore } from "@/db/schema";
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
    // Query Neon PostgreSQL to see if thesis_core table is empty.
    let initialThesisData = null;
    let isThesisCoreEmpty = true;
    try {
      const coreEntries = await db.select().from(thesisCore).limit(1);
      if (coreEntries.length > 0) {
        const core = coreEntries[0];
        isThesisCoreEmpty = false;
        initialThesisData = {
          title: core.title,
          researchQuestion: core.researchQuestion,
          argument: core.argument,
          methodology: core.methodology,
        };
      }
    } catch (error) {
      console.error("Failed to query thesisCore in root page:", error);
      // Fallback to true if there's an error so the user can onboarding
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
