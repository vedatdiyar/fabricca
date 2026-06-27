import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL not found in .env.local");
  process.exit(1);
}

async function clearDownstream(): Promise<void> {
  const { db } = await import("@/db");
  const { originalityReports } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  const result = await db
    .delete(originalityReports)
    .where(eq(originalityReports.matrixId, 3));
  console.log("Cleared downstream state for Matrix ID=3:", result);
}

clearDownstream().catch(console.error);
