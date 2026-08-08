import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

/**
 * Drops the entire public schema (CASCADE) and recreates it empty, removing all
 * application tables, enums, and indexes in a single deterministic operation.
 * This supersedes any table-by-table reset because it stays correct regardless
 * of how the schema evolves over time.
 *
 * @returns A promise that resolves when the reset operation finishes.
 */
async function reset() {
  console.log("🗑️  Dropping public schema (CASCADE)...");

  const { db } = await import("./index");

  await db.execute(`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(`CREATE SCHEMA public`);
  await db.execute(`CREATE EXTENSION IF NOT EXISTS vector`);

  console.log(
    "✅ Schema reset complete. Run `npm run db:push` then `npm run db:seed`.",
  );
}

reset().catch((err) => {
  console.error("❌ Reset failed:", err);
  process.exit(1);
});
