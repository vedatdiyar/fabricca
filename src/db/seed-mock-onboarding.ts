import { config } from "dotenv";
import { db } from "./index";
import { thesisCore, thesisBoxes } from "./schema";

// Load environment variables from .env.local
config({ path: ".env.local" });

async function seedMockOnboarding() {
  console.log("🚀 Starting mock onboarding seeder...");

  // Clean existing thesis cores (cascade deletes old boxes if any)
  console.log("🧹 Cleaning up old thesis core data...");
  await db.delete(thesisCore);

  // Insert mock thesis core
  console.log("✍️ Inserting mock Thesis Constitution (Thesis Core)...");
  const [newThesis] = await db
    .insert(thesisCore)
    .values({
      title: "Siyaset Biliminde Yapay Zeka ve Algoritmik Yönetim",
      researchQuestion:
        "Yapay zeka teknolojilerinin karar alma süreçlerine entegrasyonu, klasik demokratik meşruiyet teorilerini ve temsil mekanizmalarını nasıl dönüştürmektedir?",
      argument:
        "Yapay zeka, bürokratik karar almayı hızlandırmakla birlikte, şeffaflık ve denetlenebilirlik eksikliği nedeniyle demokratik meşruiyeti zedeleyici bir algoritmik otoriterlik riski barındırmaktadır.",
      methodology:
        "Gramscian Hegemonya teorisi ve Snow & Benford'un Çerçeveleme Teorisi bağlamında niteliksel söylem analizi.",
      academicRecommendations:
        "Yapay zeka ve siyaset teorisi, dijital demokrasi, algoritmik yönetim, Gramsci hegemonyası, çerçeveleme analizi.",
    })
    .returning();

  console.log("✅ Thesis Core inserted with ID:", newThesis.id);

  // Insert mock thesis boxes
  console.log("📦 Creating default thematic study boxes...");
  const boxesData = [
    {
      thesisCoreId: newThesis.id,
      name: "Giriş ve Kuramsal Altyapı",
      description:
        "Teorik çatı, Gramsci hegemonyası ve Snow & Benford çerçeveleme kuramı ile dijital meşruiyet ilişkisi.",
      order: 0,
    },
    {
      thesisCoreId: newThesis.id,
      name: "Metodolojik Yaklaşım ve Söylem Analizi",
      description:
        "Nitel söylemsel analiz yöntemleri, veri setinin sınırları ve geçerlilik kriterleri.",
      order: 1,
    },
    {
      thesisCoreId: newThesis.id,
      name: "Ampirik Dönem: 2020-2025 Algoritmik Yönetişim",
      description:
        "Seçili vaka analizleri ve algoritmik karar alma mekanizmalarının somut pratikleri.",
      order: 2,
    },
  ];

  await db.insert(thesisBoxes).values(boxesData);
  console.log("✅ Thematic study boxes created successfully!");

  console.log("🎉 Seeding complete! You can now bypass onboarding.");
  process.exit(0);
}

seedMockOnboarding().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
