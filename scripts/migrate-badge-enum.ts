import { Pool } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const result = await pool.query(
      `UPDATE originality_reports
       SET originality_status = 'RELATED_THESIS'
       WHERE originality_status = 'POTENTIAL_OVERLAP'`,
    );

    console.log(
      `✅ Updated ${result.rowCount} record(s) from POTENTIAL_OVERLAP to RELATED_THESIS`,
    );
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
