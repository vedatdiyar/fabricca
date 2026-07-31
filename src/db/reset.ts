import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function reset() {
  console.log("🗑️  Dropping all tables...");

  const { db } = await import("./index");

  // Drop tables in reverse dependency order
  await db.execute(`DROP TABLE IF EXISTS tasks CASCADE`);
  await db.execute(`DROP TABLE IF EXISTS notes CASCADE`);
  await db.execute(`DROP TABLE IF EXISTS chunks CASCADE`);
  await db.execute(`DROP TABLE IF EXISTS sources CASCADE`);
  await db.execute(`DROP TABLE IF EXISTS boxes CASCADE`);
  await db.execute(`DROP TABLE IF EXISTS positioning CASCADE`);
  await db.execute(`DROP TABLE IF EXISTS matrices CASCADE`);
  await db.execute(`DROP TABLE IF EXISTS users CASCADE`);

  // Drop enums
  await db.execute(`DROP TYPE IF EXISTS task_status CASCADE`);
  await db.execute(`DROP TYPE IF EXISTS task_priority CASCADE`);
  await db.execute(`DROP TYPE IF EXISTS box_type_enum CASCADE`);
  await db.execute(`DROP TYPE IF EXISTS positioning_global_status CASCADE`);

  console.log("✅ All tables dropped. Ready for drizzle-kit push.");
}

reset().catch((err) => {
  console.error("❌ Reset failed:", err);
  process.exit(1);
});
