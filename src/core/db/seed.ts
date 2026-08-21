import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { hash } from "bcrypt-ts";

/**
 * Seeds the database with the two authorized user accounts.
 *
 * @returns A promise that resolves when the seeding operation finishes.
 */
async function seed() {
  console.log("🌱 Seeding database started...");

  const { db } = await import("./index");
  const { users } = await import("./schema");

  const user1Password = process.env.SEED_USER1_PASSWORD;
  const user2Password = process.env.SEED_USER2_PASSWORD;
  // Email/name are also env-driven to avoid hardcoded PII; fallback to dummy format for local/dev
  const user1Email =
    process.env.SEED_USER1_EMAIL || "seed-user-1@fabricca.local";
  const user2Email =
    process.env.SEED_USER2_EMAIL || "seed-user-2@fabricca.local";
  const user1Name = process.env.SEED_USER1_NAME || "Seed User 1";
  const user2Name = process.env.SEED_USER2_NAME || "Seed User 2";

  if (!user1Password || !user2Password) {
    throw new Error(
      "SEED_USER1_PASSWORD and SEED_USER2_PASSWORD must be set in environment variables",
    );
  }

  const password1 = await hash(user1Password, 10);
  const password2 = await hash(user2Password, 10);

  await db
    .insert(users)
    .values([
      {
        email: user1Email,
        password: password1,
        name: user1Name,
      },
      {
        email: user2Email,
        password: password2,
        name: user2Name,
      },
    ])
    .onConflictDoNothing({ target: users.email });

  console.log("✅ Seeding completed. Users inserted.");
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
