import { hash } from "bcrypt-ts";
import { db } from "./index";
import { users } from "./schema";

const SALT_ROUNDS = 10;

/**
 * Seed işlemi için kullanıcı listesi.
 * Şifreler hashlenmeden burada düz metin olarak tutulur,
 * aşağıdaki fonksiyon içinde hashlenerek veri tabanına yazılır.
 */
const RAW_USERS = [
  {
    email: "vedatdiyarcelikkeser@gmail.com",
    password: "Vedat*1682",
    name: "Vedat Diyar",
  },
  {
    email: "tubaahncr@gmail.com",
    password: "giresun2828",
    name: "Tuğba",
  },
] as const;

/**
 * Tanımlı kullanıcıları veri tabanına ekler.
 * Şifreler önce bcrypt-ts ile hashlenir, ardından insert edilir.
 * E-posta benzersiz olduğu için tekrar çalıştırılırsa conflict'e düşer;
 * bu durum hatayı yutar ve devam eder.
 */
async function seed() {
  console.log("Seed başlıyor...");

  for (const raw of RAW_USERS) {
    try {
      const hashedPassword = await hash(raw.password, SALT_ROUNDS);
      await db.insert(users).values({
        email: raw.email,
        password: hashedPassword,
        name: raw.name,
      });
      console.log("  Eklendi:", raw.email);
    } catch (error) {
      if (error instanceof Error && error.message.includes("unique")) {
        console.log("  Zaten var (atlanıyor):", raw.email);
      } else {
        console.error("  Hata:", raw.email, error);
      }
    }
  }

  console.log("Seed tamamlandı.");
}

seed();
