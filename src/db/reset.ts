import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function reset() {
  console.log("🗑️  Dropping all tables...");

  const { db } = await import("./index");

  // Drop tables in reverse dependency order
  await db.execute(`DROP TABLE IF EXISTS tasks CASCADE`);
  await db.execute(`DROP TABLE IF EXISTS library_resources CASCADE`);
  await db.execute(`DROP TABLE IF EXISTS thesis_boxes CASCADE`);
  await db.execute(`DROP TABLE IF EXISTS originality_reports CASCADE`);
  await db.execute(`DROP TABLE IF EXISTS thesis_matrices CASCADE`);
  await db.execute(`DROP TABLE IF EXISTS users CASCADE`);

  // Drop enums
  await db.execute(`DROP TYPE IF EXISTS task_status CASCADE`);
  await db.execute(`DROP TYPE IF EXISTS task_priority CASCADE`);
  await db.execute(`DROP TYPE IF EXISTS box_type_enum CASCADE`);

  console.log("✅ All tables dropped. Ready for drizzle-kit push.");
}

reset().catch((err) => {
  console.error("❌ Reset failed:", err);
  process.exit(1);
});
