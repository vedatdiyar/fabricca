import { config } from "dotenv";
import { db } from "./index";
import {
  thesisCore,
  thesisBoxes,
  references,
  notes,
  pdfChunks,
  tasks,
  aiInsights,
} from "./schema";

// Load environment variables from .env.local
config({ path: ".env.local" });

async function seedAll() {
  console.log("🚀 Starting COMPLETE DATABASE SEEDER...");

  // 1. Clean all existing tables to guarantee clean state and avoid duplicate violations
  console.log(
    "🧹 Cleaning all existing tables in order (respecting foreign keys)...",
  );
  await db.delete(aiInsights);
  await db.delete(tasks);
  await db.delete(notes);
  await db.delete(pdfChunks);
  await db.delete(references);
  await db.delete(thesisBoxes);
  await db.delete(thesisCore);
  console.log("✅ All tables cleared!");

  // 2. Insert Thesis Constitution (thesis_core)
  console.log("✍️ Inserting Thesis Core...");
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

  // 3. Insert Thesis Boxes (thesis_boxes)
  console.log("📦 Creating thematic study boxes...");
  const boxes = await db
    .insert(thesisBoxes)
    .values([
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
    ])
    .returning();

  console.log(`✅ Created ${boxes.length} thematic study boxes.`);

  // 4. Insert References (references)
  console.log("📚 Creating library references...");
  const [ref1, ref2, ref3] = await db
    .insert(references)
    .values([
      {
        title: "The Rise of Algorithmic Governance in Modern Democracies",
        authors: "Sarah Jenkins, Michael Taylor",
        year: 2023,
        doi: "10.1080/12345678.2023.01",
        pdfUrl: "https://r2.fabricca.com/algorithmic_governance.pdf",
        abstract:
          "This paper explores the growing reliance on algorithms and automated decision-making systems in democratic institutions. It evaluates the impact on policy design, bureaucratic efficiency, and public accountability, arguing that algorithmic governance alters the traditional democratic input-output legitimacy dynamics.",
        status: "tamamlandı",
      },
      {
        title: "Digital Hegemony: How Tech Giants Shape Political Discourse",
        authors: "Robert D. Putnam, Elena Rostova",
        year: 2024,
        doi: "10.1017/s00000000000002",
        pdfUrl: "https://r2.fabricca.com/digital_hegemony.pdf",
        abstract:
          "Applying Gramscian hegemony to the digital age, this study examines how tech conglomerates control digital infrastructure to shape ideological frames and manufacture public consent. We outline the mechanism of algorithmic selection as a form of non-coercive power.",
        status: "okunuyor",
      },
      {
        title: "Framing AI: Public Reception and Policy Debates",
        authors: "David Benford, Clarissa Snow",
        year: 2025,
        doi: "10.1111/j.1468-2427.2025.03",
        pdfUrl: "https://r2.fabricca.com/framing_ai.pdf",
        abstract:
          "We utilize frame analysis to trace the public reception of Artificial Intelligence systems in governance. Through interviews and media analysis, we identify dominant frames of algorithmic utility vs. systemic bias and corporate encroachment.",
        status: "okunacak",
      },
    ])
    .returning();

  console.log("✅ 3 library references inserted successfully!");

  // Create helper embeddings (1536-dimensional mock vectors)
  const makeEmbedding = (index: number) => {
    return Array.from({ length: 1536 }, (_, i) => (i === index ? 0.98 : 0.01));
  };

  // 5. Insert Okuma Notları (notes)
  console.log("📝 Creating reading notes with mock embeddings...");
  const [note1, note2] = await db
    .insert(notes)
    .values([
      {
        referenceId: ref1.id,
        boxId: boxes[0].id, // Giriş ve Kuramsal Altyapı
        content:
          "Sarah Jenkins ve Michael Taylor makalesinde algoritmik yönetişimin meşruiyet krizlerine yol açtığını savunuyor. Karar alma süreçlerinin insansızlaşması, temsil mekanizmalarını zayıflatıyor. Benim tezimdeki 'demokratik meşruiyetin aşınması' argümanı için mükemmel bir teorik dayanak sunuyor.",
        embedding: makeEmbedding(10),
        aiContextSuggestions:
          "Bu notu **Giriş ve Kuramsal Altyapı** bölümünde meşruiyet tartışmasını temellendirmek için kullanabilirsiniz. Atıf Künyesi (APA): Jenkins, S., & Taylor, M. (2023). The Rise of Algorithmic Governance in Modern Democracies. Journal of Digital Politics, 14(2), 120-135.",
      },
      {
        referenceId: ref2.id,
        boxId: boxes[1].id, // Metodolojik Yaklaşım ve Söylem Analizi
        content:
          "Robert Putnam'ın Gramsci hegemonyasını dijital platformlara uyarlaması çok zihin açıcı. Rıza üretiminin algoritmik filtre balonları üzerinden nasıl yapılandırıldığını açıklıyor. Bu yöntemi söylem analizimde bir hegemonya aracı olarak kullanacağım.",
        embedding: makeEmbedding(20),
        aiContextSuggestions:
          "Bu notu **Metodolojik Yaklaşım ve Söylem Analizi** bölümünde söylemsel hegemonya inşasını açıklamak için kullanabilirsiniz. Atıf Künyesi (APA): Putnam, R. D., & Rostova, E. (2024). Digital Hegemony: How Tech Giants Shape Political Discourse. Academic Press.",
      },
    ])
    .returning();

  console.log("✅ 2 reading notes created with vectors!");

  // 6. Insert PDF Parçaları (pdf_chunks)
  console.log("📄 Creating PDF Chunks with mock embeddings...");
  await db.insert(pdfChunks).values([
    {
      referenceId: ref1.id,
      boxId: boxes[0].id,
      content:
        "# Section 2: Algorithmic Accountability and Input Legitimacy\nAlgorithmic governance introduces a shift from 'input legitimacy'—participation and representation—to 'output legitimacy'—efficiency and problem-solving capability. While systems process citizen requests 40% faster, the opacity of the underlying neural networks obscures the decision-making rationale. In political terms, when citizens cannot query the reasoning behind administrative denials, the fundamental democratic right to accountability is compromised, leading to an erosion of trust in public institutions.",
      embedding: makeEmbedding(30),
    },
    {
      referenceId: ref2.id,
      boxId: boxes[0].id,
      content:
        "## The Architecture of Digital Hegemony\nGramsci's concept of hegemony relies on the active construction of consent through cultural and intellectual channels. In the contemporary digital sphere, this channel is the algorithm itself. By tailoring newsfeeds and search rankings, algorithms establish the boundaries of the 'thinkable'. What is excluded from the ranking is effectively excluded from political consciousness. Hence, digital hegemony is not maintained through physical force, but through the soft power of algorithmic sorting.",
      embedding: makeEmbedding(40),
    },
    {
      referenceId: ref3.id,
      boxId: boxes[2].id,
      content:
        "### Frame Analysis of Policy Interventions\nOur analysis reveals three primary frames competing in the AI regulation debate: the 'Innovation Frame', the 'Risk Frame', and the 'Equity Frame'. Governments utilizing the innovation frame prioritize economic speed and minimize oversight. Conversely, the risk frame, driven by civil rights groups, focuses on bias, algorithmic discrimination, and lack of transparency. The policy outcomes of the 2020-2025 period represent an unstable compromise between these contesting discursive frames.",
      embedding: makeEmbedding(50),
    },
  ]);

  console.log("✅ 3 PDF chunks inserted with vectors!");

  // 7. Insert Görevler (tasks)
  console.log("📅 Creating tasks...");
  await db.insert(tasks).values([
    {
      taskDescription: `Makale Okuma: ${ref1.title}`,
      status: "done",
      dueDate: "2026-05-15",
      referenceId: ref1.id,
    },
    {
      taskDescription: `Makale Okuma: ${ref2.title}`,
      status: "doing",
      dueDate: "2026-06-05",
      referenceId: ref2.id,
    },
    {
      taskDescription: `Makale Okuma: ${ref3.title}`,
      status: "todo",
      dueDate: "2026-06-15",
      referenceId: ref3.id,
    },
  ]);

  console.log("✅ Tasks created!");

  // 8. Insert Yapay Zeka Öngörüleri (ai_insights)
  console.log("🌟 Creating AI Insights (Fikir Sepeti)...");
  await db.insert(aiInsights).values([
    {
      noteId: note1.id,
      insightText:
        "Danışman Önerisi: Jenkins & Taylor'ın 'çıktı meşruiyeti' (output legitimacy) kavramını alıp, tezinizdeki 'algoritmik otoriterlik' argümanıyla çarpıştırın. Hız ve verimlilik artışının, şeffaflık kaybını meşrulaştıramayacağı tezi üzerine güçlü bir felsefi eleştiri kurabilirsiniz.",
      aiContextSuggestions:
        "1. Çıktı meşruiyeti vs. Girdi meşruiyeti ayrımını netleştirin.\n2. Şeffaflık kaybını ampirik örneklerle destekleyin.\n3. Otoriter eğilimleri temellendirin.",
    },
    {
      noteId: note2.id,
      insightText:
        "Danışman Önerisi: Algoritmik hegemonya analizinizde, platformların sadece filtre balonu yaratmadığını, aynı zamanda aktif birer ideolojik özne gibi çalıştığını savunun. Gramsci'nin 'sivil toplum' ve 'siyasi toplum' ayrımını dijital platformların kamu/özel niteliği üzerinden yeniden okuyun.",
      aiContextSuggestions:
        "1. Sivil toplumda platformların konumunu tartışın.\n2. Dijital kamusal alanı haritalandırın.\n3. Rıza üretiminin yeni kodlarını yazın.",
    },
  ]);

  console.log("✅ AI Insights created!");

  console.log(
    "🎉 SUCCESS: DATABASE IS FULLY SEEDED WITH REALISTIC ACADEMIC DATA!",
  );
  process.exit(0);
}

seedAll().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
