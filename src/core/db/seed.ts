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
  const user1Username = process.env.SEED_USER1_USERNAME || "vedatdiyar";
  const user2Username = process.env.SEED_USER2_USERNAME || "tubaahncr";
  const user1Name = process.env.SEED_USER1_NAME || "Vedat Diyar";
  const user2Name = process.env.SEED_USER2_NAME || "Tuğba Ahıskalı";

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
        username: user1Username,
        password: password1,
        name: user1Name,
      },
      {
        username: user2Username,
        password: password2,
        name: user2Name,
      },
    ])
    .onConflictDoNothing({ target: users.username });

  console.log("✅ Seeding completed. Users inserted.");
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
