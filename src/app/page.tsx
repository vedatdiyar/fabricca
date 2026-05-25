import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getExpectedHash } from "@/lib/auth";
import { db } from "@/db";
import { thesisCore } from "@/db/schema";

export default async function Home() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("academialab_session")?.value;
  const password = process.env.APP_PASSWORD;

  // Easy developer onboarding if APP_PASSWORD is not configured yet
  if (!password) {
    redirect("/dashboard");
  }

  const expectedHash = await getExpectedHash(password);

  if (sessionCookie === expectedHash) {
    // Query Neon PostgreSQL to see if thesis_core table is empty.
    let isThesisCoreEmpty = true;
    try {
      const coreEntries = await db.select().from(thesisCore).limit(1);
      isThesisCoreEmpty = coreEntries.length === 0;
    } catch (error) {
      console.error("Failed to query thesisCore in root page:", error);
      // Fallback to true if there's an error so the user can onboarding
      isThesisCoreEmpty = true;
    }

    if (isThesisCoreEmpty) {
      redirect("/onboarding");
    } else {
      redirect("/dashboard");
    }
  }

  redirect("/login");
}
