import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import { Pool } from "@neondatabase/serverless";

/**
 * Creates a complete snapshot of all public tables and their row contents in Neon PostgreSQL.
 * Exports both a structured JSON file and a restorative SQL script.
 */
async function backupDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not defined in .env.local");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_");
  const backupDir = path.resolve(process.cwd(), "backups");

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log("🔍 Scanning database tables in public schema...");

  const tablesResult = await pool.query<{ table_name: string }>(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const tables = tablesResult.rows.map((r) => r.table_name);
  console.log(`📋 Found ${tables.length} tables:`, tables.join(", "));

  const dbSnapshot: Record<string, unknown[]> = {};
  const sqlStatements: string[] = [
    `-- Fabricca Neon PostgreSQL Backup`,
    `-- Generated: ${new Date().toISOString()}`,
    `-- Total Tables: ${tables.length}`,
    ``,
  ];

  for (const tableName of tables) {
    console.log(`  -> Exporting table: ${tableName}`);
    const rowsResult = await pool.query(`SELECT * FROM "${tableName}"`);
    dbSnapshot[tableName] = rowsResult.rows;
    console.log(`     ✓ Extracted ${rowsResult.rows.length} rows.`);

    if (rowsResult.rows.length > 0) {
      sqlStatements.push(`-- Table: ${tableName}`);
      for (const row of rowsResult.rows) {
        const columns = Object.keys(row)
          .map((c) => `"${c}"`)
          .join(", ");
        const values = Object.values(row)
          .map((v) => {
            if (v === null || v === undefined) return "NULL";
            if (typeof v === "number" || typeof v === "boolean")
              return String(v);
            if (typeof v === "object") {
              return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
            }
            return `'${String(v).replace(/'/g, "''")}'`;
          })
          .join(", ");

        sqlStatements.push(
          `INSERT INTO "${tableName}" (${columns}) VALUES (${values}) ON CONFLICT DO NOTHING;`,
        );
      }
      sqlStatements.push("");
    }
  }

  const jsonPath = path.join(backupDir, `db_backup_${timestamp}.json`);
  const sqlPath = path.join(backupDir, `db_backup_${timestamp}.sql`);

  fs.writeFileSync(jsonPath, JSON.stringify(dbSnapshot, null, 2), "utf-8");
  fs.writeFileSync(sqlPath, sqlStatements.join("\n"), "utf-8");

  console.log(`\n🎉 Database backup successfully created!`);
  console.log(`📁 JSON snapshot: ${jsonPath}`);
  console.log(`📁 SQL restore script: ${sqlPath}`);

  await pool.end();
}

backupDatabase().catch((err) => {
  console.error("❌ Database backup failed:", err);
  process.exit(1);
});
