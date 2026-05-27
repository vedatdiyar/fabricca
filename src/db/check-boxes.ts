import { config } from "dotenv";
import { db } from "./index";
import { thesisCore, thesisBoxes, notes } from "./schema";

config({ path: ".env.local" });

async function checkDb() {
  console.log("🔍 Checking database tables...");

  const cores = await db.select().from(thesisCore);
  console.log(`📌 thesis_core has ${cores.length} records:`, cores);

  const boxes = await db.select().from(thesisBoxes);
  console.log(`📌 thesis_boxes has ${boxes.length} records:`, boxes);

  const allNotes = await db.select().from(notes).limit(5);
  console.log(`📌 notes sample has ${allNotes.length} records:`, allNotes);

  process.exit(0);
}

checkDb().catch((err) => {
  console.error("❌ Error checking DB:", err);
  process.exit(1);
});
