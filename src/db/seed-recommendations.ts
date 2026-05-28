import { config } from "dotenv";
import { db } from "./index";
import { thesisCore, thesisBoxes } from "./schema";
import { eq } from "drizzle-orm";
import { LiteratureRecommendation } from "../app/dashboard/actions";

// Load environment variables from .env.local
config({ path: ".env.local" });

async function seedRecommendations() {
  console.log("🚀 Starting database mock recommendations seeder...");

  // 1. Fetch existing thesis core
  const cores = await db.select().from(thesisCore).limit(1);
  if (cores.length === 0) {
    console.error(
      "❌ No Thesis Core found! Please run the complete seeder first using: npx tsx src/db/seed-all.ts",
    );
    process.exit(1);
  }
  const core = cores[0];
  console.log(`📌 Found Thesis Core: "${core.title}" (ID: ${core.id})`);

  // 2. Fetch existing boxes for this thesis core
  const boxes = await db
    .select()
    .from(thesisBoxes)
    .where(eq(thesisBoxes.thesisCoreId, core.id))
    .orderBy(thesisBoxes.order);

  if (boxes.length === 0) {
    console.error(
      "❌ No Thesis Boxes found! Please run the complete seeder first using: npx tsx src/db/seed-all.ts",
    );
    process.exit(1);
  }
  console.log(`📌 Found ${boxes.length} thematic boxes in the database.`);

  // Map boxes by name or index for our mock data
  const boxGiris =
    boxes.find((b) => b.name.includes("Giriş") || b.order === 0) || boxes[0];
  const boxMetodoloji =
    boxes.find((b) => b.name.includes("Metodolojik") || b.order === 1) ||
    boxes[1] ||
    boxes[0];
  const boxAmpirik =
    boxes.find((b) => b.name.includes("Ampirik") || b.order === 2) ||
    boxes[2] ||
    boxes[0];

  console.log(`Mapping mock recommendations:`);
  console.log(`- Box 0 (Giriş): "${boxGiris.name}" (ID: ${boxGiris.id})`);
  console.log(
    `- Box 1 (Metodoloji): "${boxMetodoloji.name}" (ID: ${boxMetodoloji.id})`,
  );
  console.log(`- Box 2 (Ampirik): "${boxAmpirik.name}" (ID: ${boxAmpirik.id})`);

  // 3. Define high-quality academic mock recommendations
  const mockRecs: LiteratureRecommendation[] = [
    // Giriş ve Kuramsal Altyapı
    {
      paperId: "rec_giris_1",
      title:
        "Democracy in the Age of Artificial Intelligence: Challenges to Legitimacy and Representation",
      authors: "Helga Nowotny, Marcus Du Sautoy",
      year: "2023",
      relevance:
        "Bu çalışma, yapay zeka entegrasyonunun klasik temsil teorileri ve demokratik meşruiyet mekanizmaları üzerindeki bozucu etkilerini teorik düzeyde ele almaktadır. Tezinizin Giriş bölümünde algoritmik sistemlerin meşruiyet krizini kuramsallaştırırken temel bir referans olacaktır.",
      url: "https://doi.org/10.1007/s43681-023-00245-1",
      citationCount: 142,
      source: "Semantic Scholar",
      lang: "EN",
      boxId: boxGiris.id,
      boxName: boxGiris.name,
    },
    {
      paperId: "rec_giris_2",
      title:
        "Dijital Hegemonya ve Algoritmik Söylem İnşası: Sosyal Medyada Kamu Rızasının İmal Edilmesi",
      authors: "Ahmet Erdem, Zeynep Kaya",
      year: "2024",
      relevance:
        "Gramsci'nin hegemonya kavramını dijital altyapılara ve algoritmik filtreleme mekanizmalarına uygulayan bu yerel çalışma, platform kapitalizminin rıza üretimini nasıl dönüştürdüğünü analiz eder. Tezinizin dijital hegemonya alt başlığındaki Türkçe literatür eksikliğini kapatacaktır.",
      url: "https://dergipark.org.tr/tr/pub/sbd/issue/82012/1429012",
      citationCount: 18,
      source: "OpenAlex",
      lang: "TR",
      boxId: boxGiris.id,
      boxName: boxGiris.name,
    },
    {
      paperId: "rec_giris_3",
      title:
        "Algorithmic Hegemony: Technology, Governance, and the Politics of the Unthinkable",
      authors: "Nick Couldry, Ulises A. Mejias",
      year: "2022",
      relevance:
        "Yazarlar dijital gözetim ve veri sömürgeciliği bağlamında algoritmaların hegemonik gücünü kuramsallaştırmaktadır. Karar almanın insansızlaşmasının sivil itaatsizlik ve rıza inşası üzerindeki etkilerini tartışmak için kritik önemdedir.",
      url: "https://doi.org/10.1177/02632764211029014",
      citationCount: 312,
      source: "Semantic Scholar",
      lang: "EN",
      boxId: boxGiris.id,
      boxName: boxGiris.name,
    },

    // Metodolojik Yaklaşım ve Söylem Analizi
    {
      paperId: "rec_metodoloji_1",
      title:
        "Reframing the Frame: Snow and Benford's Framing Theory in the Digital Era",
      authors: "Robert D. Benford, Pamela E. Oliver",
      year: "2023",
      relevance:
        "Çerçeveleme teorisinin sosyal medya ve yapay zeka odaklı haber akışlarında nasıl yeniden üretildiğini gösteren bu metodolojik rehber, söylemsel veri setinizi analiz ederken kullanacağınız kodlama kategorilerini (framing codes) belirlemede yol gösterecektir.",
      url: "https://doi.org/10.1111/j.1468-2427.2023.01254.x",
      citationCount: 89,
      source: "Semantic Scholar",
      lang: "EN",
      boxId: boxMetodoloji.id,
      boxName: boxMetodoloji.name,
    },
    {
      paperId: "rec_metodoloji_2",
      title:
        "Niteliksel Sosyal Araştırmalarda Söylem Analizi ve Dijital Metin Madenciliği Entegrasyonu",
      authors: "Mehmet Yılmaz, Selin Demir",
      year: "2024",
      relevance:
        "Politik söylemlerin nitel olarak çözümlenmesinde Snow & Benford çerçeveleme analizinin adımlarını ve dijital söylem çalışmalarında karşılaşılan metodolojik engelleri ele alan bir yöntem makalesidir.",
      url: "https://dergipark.org.tr/tr/pub/tsd/issue/83015/1435211",
      citationCount: 12,
      source: "OpenAlex",
      lang: "TR",
      boxId: boxMetodoloji.id,
      boxName: boxMetodoloji.name,
    },

    // Ampirik Dönem: 2020-2025 Algoritmik Yönetişim
    {
      paperId: "rec_ampirik_1",
      title:
        "Algorithmic Governance in Action: Case Studies of Automated Public Decision-Making (2020-2025)",
      authors: "Virginia Eubanks, Frank Pasquale",
      year: "2025",
      relevance:
        "2020-2025 yılları arasında kamu bürokrasisinde kullanılan yapay zeka sistemlerinin somut vaka analizlerini sunmaktadır. Kamu politikalarının belirlenmesinde şeffaflık eksikliği ve meşruiyet krizinin pratik sonuçlarını göstermesi açısından ampirik bölümünüzün omurgasını oluşturacaktır.",
      url: "https://doi.org/10.1093/oso/9780197650124.001.0001",
      citationCount: 205,
      source: "Semantic Scholar",
      lang: "EN",
      boxId: boxAmpirik.id,
      boxName: boxAmpirik.name,
    },
    {
      paperId: "rec_ampirik_2",
      title:
        "Kamu Yönetiminde Algoritmik Otoriterlik: Şeffaflık, Denetlenebilirlik ve Vatandaş Hakları",
      authors: "Canan Özdemir",
      year: "2024",
      relevance:
        "Yerel yönetimlerde ve kamu kurumlarında karar alma mekanizmalarına entegre edilen yapay zeka modellerinin denetlenebilirlik açıklarını ve bunun demokratik meşruiyet üzerindeki risklerini hukuki ve siyasi açıdan inceleyen kritik bir ampirik çalışmadır.",
      url: "https://dergipark.org.tr/tr/pub/akademik/issue/84022/1458902",
      citationCount: 7,
      source: "OpenAlex",
      lang: "TR",
      boxId: boxAmpirik.id,
      boxName: boxAmpirik.name,
    },
  ];

  // 4. Update the academicRecommendations field in the database
  console.log("✍️ Saving recommendations JSON array to database...");
  await db
    .update(thesisCore)
    .set({ academicRecommendations: JSON.stringify(mockRecs) })
    .where(eq(thesisCore.id, core.id));

  console.log("✅ Database updated successfully!");
  console.log("🎉 Seeding mock recommendations complete!");
  process.exit(0);
}

seedRecommendations().catch((err) => {
  console.error("❌ Seeding mock recommendations failed:", err);
  process.exit(1);
});
