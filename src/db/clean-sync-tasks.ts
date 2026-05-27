import { config } from "dotenv";
import { db } from "./index";
import { tasks, references } from "./schema";

// Load env variables
config({ path: ".env.local" });

async function syncTasks() {
  console.log("🚀 Starting Tasks Synchronization with References...");

  // 1. Fetch all references
  const allReferences = await db.select().from(references);
  console.log(`Found ${allReferences.length} references in library.`);

  // 2. Fetch all tasks to check for duplicates
  const allTasks = await db.select().from(tasks);
  const taskDescriptions = new Set(allTasks.map((t) => t.taskDescription));

  let addedCount = 0;

  // 3. For each reference, check if a corresponding reading task exists
  for (const ref of allReferences) {
    const expectedDescription = `Makale Okuma: ${ref.title}`;
    if (!taskDescriptions.has(expectedDescription)) {
      console.log(`Creating missing task for reference: "${ref.title}"`);
      await db.insert(tasks).values({
        taskDescription: expectedDescription,
        status: "todo",
      });
      addedCount++;
    }
  }

  console.log(
    `✅ Synchronization completed! Added ${addedCount} missing tasks.`,
  );
}

syncTasks().catch((e) => {
  console.error("❌ Sync failed with error:", e);
  process.exit(1);
});
