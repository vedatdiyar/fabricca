import { hash } from "bcrypt-ts";
import { db } from "./index";
import { users } from "./schema";

async function seed() {
  console.log("🌱 Seed başlatılıyor...");

  const password1 = await hash("Vedat*1682", 10);
  const password2 = await hash("Giresun2828", 10);

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
        name: "Tuğba Ahncr",
      },
    ])
    .onConflictDoNothing({ target: users.email });

  console.log("✅ Seed tamamlandı. Kullanıcılar eklendi.");
}

seed().catch((err) => {
  console.error("❌ Seed hatası:", err);
  process.exit(1);
});
