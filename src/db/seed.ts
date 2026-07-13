import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { hash } from "bcrypt-ts";

async function seed() {
  console.log("🌱 Seeding database started...");

  const { db } = await import("./index");
  const { users } = await import("./schema");

  const user1Password = process.env.SEED_USER1_PASSWORD;
  const user2Password = process.env.SEED_USER2_PASSWORD;

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
        email: "vedatdiyarcelikkeser@gmail.com",
        password: password1,
        name: "Vedat Diyar Çelikkeser",
      },
      {
        email: "tubaahncr@gmail.com",
        password: password2,
        name: "Tuğba Hançer",
      },
    ])
    .onConflictDoNothing({ target: users.email });

  console.log("✅ Seeding completed. Users inserted.");
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
