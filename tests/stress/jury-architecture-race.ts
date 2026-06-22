import { config } from "dotenv";
config({ path: ".env.local" });

import { GoogleGenAI, type ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL = "gemini-3.1-flash-lite";

// ============================================================================
// Ham Veri Matrisi
// ============================================================================
const HEDEF_TEZ = {
  studyTitle:
    "Söylemsel Dönüşüm ve Hegemonik Kırılmalar: 1991-1999 Döneminde Kürt Siyasi Hareketi ile Türkiye Sosyalist Solu Arasındaki İlişkisel Dinamikler",
  researchQuestion:
    "1991-1999 döneminde Kürt siyasi hareketi ile Türkiye sosyalist solu arasındaki söylemsel ve hegemonik ilişkisel dinamikler nasıl bir dönüşüm geçirmiştir?",
  mainClaim:
    "Kürt siyasi hareketi ile Türkiye sosyalist solu arasındaki ilişki, karşılıklı söylemsel inşa ve hegemonik kırılmalar üzerinden şekillenmiş, bu iki aktör arasındaki diyalektik etkileşim her iki hareketin de söylemsel stratejilerini dönüştürmüştür.",
  theoreticalFramework:
    "Laclau ve Mouffe'un hegemonya ve söylem kuramı, Gramsci'nin hegemonya kavramı, ilişkisel diyalektik yaklaşım.",
  methodology:
    "Eleştirel söylem analizi, tarihsel-karşılaştırmalı yöntem, arşiv taraması ve söylemsel-tarihsel yaklaşım (Wodak).",
  researchScope:
    "1991-1999 dönemi, Türkiye, Kürt siyasi hareketi (HEP, DEP, HADEP) ve Türkiye sosyalist solu (ÖDP, SİP, EMEP, bağımsız sol gruplar).",
};

const ADEY_TEZ = {
  id: 1,
  title: "1990-2014 dönemi Kürt siyasal hareketinin söyleminin dönüşümü",
  author: "Kadriye Okudan",
  university: "Ankara Üniversitesi",
  year: 2017,
  thesisType: "Doktora",
  department: "Kamu Yönetimi ve Siyaset Bilimi",
  abstract:
    "Bu çalışmanın konusu 1990-2014 döneminde HEP'in kurulmasıyla başlayıp bugün Halkların Demokratik Partisi ile devam eden yasal Kürt siyasal hareketi geleneğinin söylemindeki dönüşümdür. Laclau ve Mouffe'un hegemonya ve söylem kuramına dayanarak Kürt siyasal hareketinin söylemi iki bölümde incelenmiştir. Yasal Kürt siyasal hareketini temsil eden ilk parti olan HEP'in kurulduğu 1990 yılından Abdullah Öcalan'ın yakalandığı 1999 yılına kadar olan dönem birinci dönemi, 1999'dan günümüze kadar olan dönem de ikinci dönemi oluşturmaktadır.",
};

const USER_PROMPT = `<hedef_tez_matrisi>
${JSON.stringify(HEDEF_TEZ, null, 2)}
</hedef_tez_matrisi>

<aday_tez_listesi>
[${JSON.stringify(ADEY_TEZ, null, 2)}]
</aday_tez_listesi>

Yukarıdaki hedef tez ile aday tezi karşılaştır ve istenen formatta JSON çıktısı üret.`;

// ============================================================================
// PROMPT 1: Sert Kutucuk / Enum Modeli
// ============================================================================
const PROMPT_1_SYSTEM = `Sen, üniversitelerin enstitülerinde "Tez Savunma Jürisi" ve "Araştırma Boşluğu Analisti" olarak görev yapan bir Profesörsün. Görevin, sana verilen hedef tez ile aday tezi karşılaştırmak ve şu 4 net akademik süzgeç üzerinden her eksen için "BIREBIR", "KAPSAYAN", "TEGET" veya "ALAKASIZ" etiketlerinden en uygun olanını seçmektir:
- subject_overlap: Araştırma soruları ve savunulan temel iddialar anlamsal olarak çakışıyorsa "BIREBIR", kısmen benzerlik varsa veya aday çalışma genişlik olarak hedefi içeriyorsa "KAPSAYAN", sadece çeperden değiyorsa "TEGET", tamamen farklıysa "ALAKASIZ".
- methodology_overlap: Kaynak matrisleri veya analiz yöntemleri birbirinin replikası ise "BIREBIR", kısmen benzerlik varsa "KAPSAYAN", çeperden temas varsa "TEGET", farklıysa "ALAKASIZ".
- theory_overlap: Üzerine inşa edildikleri temel kuramsal çerçeve aynıysa "BIREBIR", kısmen ortaksa "KAPSAYAN", sadece kavram referansı düzeyindeyse "TEGET", farklıysa "ALAKASIZ".
- context_overlap: Örneklem evreninin veya dönemsel kapsamının, aday çalışmanın kapsamı tarafından bütünüyle yutulması durumunda "BIREBIR", kısmi bağlamsal kesişme varsa "KAPSAYAN", zayıf temas varsa "TEGET", farklıysa "ALAKASIZ".

[Kısıtlar]: 
1. Eğer hedef tez, kuramsal omurgasını iki veya daha fazla bağımsız değişken/aktör arasındaki ilişkisel diyalektik veya etkileşim (A <-> B) üzerine inşa etmişse; aday çalışma aynı teorik kavramları veya yöntem adını kullansa bile, eğer aday çalışma bu bileşenlerden yalnızca birini tek taraflı veya içsel olarak (A veya B) inceliyorsa, theory_overlap ve methodology_overlap eksenleri ASLA BIREBIR veya KAPSAYAN seçilemez, doğrudan TEGET seviyesine kilitlenmelidir.
2. Aday tezin dönemsel takviminin hedef tezi takvimsal olarak yutması, context_overlap'ı yükseltse bile, eğer aday çalışma hedef tezin ampirik ilişkisel aktörlerini içeriksel olarak derinlemesine analiz etmiyorsa, subject_overlap doğrudan TEGET seviyesinde tutulmalıdır.

ÇIKTI FORMATI: Yanıtın sadece şu JSON yapısında olmalıdır:
{
  "subject_overlap": "BIREBIR" | "KAPSAYAN" | "TEGET" | "ALAKASIZ",
  "methodology_overlap": "BIREBIR" | "KAPSAYAN" | "TEGET" | "ALAKASIZ",
  "theory_overlap": "BIREBIR" | "KAPSAYAN" | "TEGET" | "ALAKASIZ",
  "context_overlap": "BIREBIR" | "KAPSAYAN" | "TEGET" | "ALAKASIZ",
  "academic_reasoning": "Türkçe gerekçe."
}`;

const SCHEMA_1 = {
  type: "object" as const,
  properties: {
    subject_overlap: {
      type: "string",
      enum: ["BIREBIR", "KAPSAYAN", "TEGET", "ALAKASIZ"],
    },
    methodology_overlap: {
      type: "string",
      enum: ["BIREBIR", "KAPSAYAN", "TEGET", "ALAKASIZ"],
    },
    theory_overlap: {
      type: "string",
      enum: ["BIREBIR", "KAPSAYAN", "TEGET", "ALAKASIZ"],
    },
    context_overlap: {
      type: "string",
      enum: ["BIREBIR", "KAPSAYAN", "TEGET", "ALAKASIZ"],
    },
    academic_reasoning: { type: "string" },
  },
  required: [
    "subject_overlap",
    "methodology_overlap",
    "theory_overlap",
    "context_overlap",
    "academic_reasoning",
  ],
};

// ============================================================================
// PROMPT 2: Sürekli Spektrum (0-100) Modeli
// ============================================================================
const PROMPT_2_SYSTEM = `Sen, üniversitelerin enstitülerinde "Tez Savunma Jürisi" ve "Araştırma Boşluğu Analisti" olarak görev yapan bir Profesörsün. Görevin, sana verilen hedef tez ile aday tezi karşılaştırmak ve her bir eksen için aday tezin hedef tezle olan anlamsal yakınlığını, çakışma ve benzerlik oranını 0 (Tamamen Özgün/Alakasız) ile 100 (Tam Çakışma/Replika) arasında doğrudan bir indeks puanı (tam sayı) vererek konumlandırmaktır.

[Boyutsal Notlandırma Kılavuzu]:
- [85 - 100] (Kritik Çakışma): Araştırma nesneleri, yöntemler veya kuramlar içeriksel olarak neredeyse ikizdir; hedef tezin özgün katkısını doğrudan baltalar veya gasp eder.
- [50 - 84] (Kapsayıcı ve Geniş Alan): Çalışmalar arasında güçlü bir şemsiye ilişkisi vardır; aday çalışma hedefin alanını içerik veya bağlam olarak yutar veya ciddi oranda ortaklık taşır.
- [15 - 49] (Teğetsel ve Çeperden Alan): Doğrudan bir çakışma yoktur. Çalışmalar sadece dolaylı olarak birbirine referans verir, yan aktörleri ortaklaşır, literatür kökenleri ortaktır ancak bağımsız yürürler.
- [0 - 14] (Özgün ve Alakasız): Anlamsal bağ sıfıra yakındır; sadece tesadüfi kelime benzerliği mevcuttur.

[Kısıtlar]:
1. Eğer hedef tez, kuramsal omurgasını iki veya daha fazla bağımsız değişken/aktör arasındaki ilişkisel diyalektik veya etkileşim (A <-> B) üzerine inşa etmişse; aday çalışma aynı teorik kavramları veya yöntem adını kullansa bile, eğer aday çalışma bu bileşenlerden yalnızca birini tek taraflı veya içsel olarak (A veya B) inceliyorsa, ilgili eksenlerin puanı KESİNLİKLE 50 puan barajını aşamaz, doğrudan [15 - 49] teğetsel alan bandında tutulmalıdır.
2. Aday tezin dönemsel takviminin hedef tezi takvimsal olarak yutması, bağlam endeksini yükseltse bile, eğer aday çalışma hedef tezin ampirik ilişkisel aktörlerini içeriksel olarak derinlemesine analiz etmiyorsa, subject_index puanı kesinlikle 50 puan barajını aşamaz, [15 - 49] bandına kilitlenmelidir.

ÇIKTI FORMATI: Yanıtın sadece şu JSON yapısında olmalıdır:
{
  "subject_index": number, 
  "methodology_index": number, 
  "theory_index": number, 
  "context_index": number, 
  "academic_reasoning": "Türkçe gerekçe."
}`;

const SCHEMA_2 = {
  type: "object" as const,
  properties: {
    subject_index: {
      type: "number",
      description: "0 ile 100 arasında tam sayı",
    },
    methodology_index: {
      type: "number",
      description: "0 ile 100 arasında tam sayı",
    },
    theory_index: {
      type: "number",
      description: "0 ile 100 arasında tam sayı",
    },
    context_index: {
      type: "number",
      description: "0 ile 100 arasında tam sayı",
    },
    academic_reasoning: { type: "string" },
  },
  required: [
    "subject_index",
    "methodology_index",
    "theory_index",
    "context_index",
    "academic_reasoning",
  ],
};

// ============================================================================
// Yardımcı: Gemini çağrısı (503 retry ile)
// ============================================================================
const MAX_RETRIES = 5;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callGemini(
  systemInstruction: string,
  prompt: string,
  schema: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction,
          temperature: 1.0,
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          thinkingConfig: { thinkingLevel: "high" as ThinkingLevel },
        },
      });
      const text = response.text;
      if (!text) throw new Error("Boş yanıt");
      let cleaned = text.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/, "")
          .replace(/```$/, "")
          .trim();
      }
      return JSON.parse(cleaned) as Record<string, unknown>;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const is503 =
        msg.includes("503") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("high demand") ||
        msg.includes("500") ||
        msg.includes("INTERNAL");
      if (is503 && attempt < MAX_RETRIES) {
        const delay = Math.min(
          2000 * Math.pow(2, attempt - 1) + Math.random() * 1000,
          30000,
        );
        process.stdout.write(
          `(retry ${attempt}/${MAX_RETRIES - 1} ${Math.round(delay)}ms) `,
        );
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exhausted");
}

// ============================================================================
// Analiz fonksiyonları
// ============================================================================
const ENUM_ORDER = ["ALAKASIZ", "TEGET", "KAPSAYAN", "BIREBIR"];
const ENUM_FIELDS = [
  "subject_overlap",
  "methodology_overlap",
  "theory_overlap",
  "context_overlap",
];

function enumToScore(val: string): number {
  return ENUM_ORDER.indexOf(val);
}

function analyzeEnumStability(
  results: Record<string, unknown>[],
): { label: string; values: string[] }[] {
  return ENUM_FIELDS.map((field) => ({
    label: field,
    values: results.map((r) => (r[field] as string) ?? "???"),
  }));
}

function analyzeSpectrumStability(
  results: Record<string, unknown>[],
): { label: string; values: number[]; mean: number; maxDev: number }[] {
  const fields = [
    "subject_index",
    "methodology_index",
    "theory_index",
    "context_index",
  ];
  return fields.map((field) => {
    const values = results.map((r) => Number(r[field]) || 0);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const maxDev = Math.max(...values.map((v) => Math.abs(v - mean)));
    return {
      label: field,
      values,
      mean: Math.round(mean * 10) / 10,
      maxDev: Math.round(maxDev),
    };
  });
}

function hasEnumJump(results: Record<string, unknown>[]): boolean {
  for (const field of ENUM_FIELDS) {
    const vals = results.map((r) => enumToScore(r[field] as string));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    if (max - min >= 3) return true; // BIREBIR -> ALAKASIZ jump
  }
  return false;
}

// ============================================================================
// ANA
// ============================================================================
async function main() {
  console.log(
    "======================================================================",
  );
  console.log("       JÜRİ MİMARİSİ CANLI YARIŞMA RAPORU (10 DÖNGÜ)");
  console.log(
    "======================================================================\n",
  );

  // --- MİMARİ 1: Enum ---
  console.log("▓ MİMARİ 1: SERT KUTUCUK (ENUM) MODELİ");
  console.log(
    "----------------------------------------------------------------------",
  );

  const enumResults: Record<string, unknown>[] = [];
  for (let i = 1; i <= 10; i++) {
    process.stdout.write(`  Döngü #${i} çağrılıyor... `);
    const start = performance.now();
    try {
      const result = await callGemini(PROMPT_1_SYSTEM, USER_PROMPT, SCHEMA_1);
      const ms = Math.round(performance.now() - start);
      enumResults.push(result);
      const s = result.subject_overlap as string;
      const t = result.theory_overlap as string;
      const m = result.methodology_overlap as string;
      const c = result.context_overlap as string;
      console.log(
        `✓ ${ms}ms\n  { subject: "${s}", theory: "${t}", methodology: "${m}", context: "${c}" }`,
      );
    } catch (err) {
      console.log(
        `✗ HATA: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const enumJump = hasEnumJump(enumResults);
  const enumStability = analyzeEnumStability(enumResults);
  console.log(
    `\n  ➔ SAPMA DURUMU: ${enumJump ? "Kırılma Yaşandı! Etiket kayması global skoru radikal etkiledi." : "Beton Gibi Kararlı! Tüm döngüler aynı etiketleri korudu."}`,
  );
  console.log(
    `  Detay: ${enumStability.map((f) => `${f.label}: [${f.values.join(", ")}]`).join(" | ")}`,
  );

  console.log("");

  // --- MİMARİ 2: Spectrum ---
  console.log("▓ MİMARİ 2: SÜREKLİ SPEKTRUM (0-100) MODELİ");
  console.log(
    "----------------------------------------------------------------------",
  );

  const spectrumResults: Record<string, unknown>[] = [];
  for (let i = 1; i <= 10; i++) {
    process.stdout.write(`  Döngü #${i} çağrılıyor... `);
    const start = performance.now();
    try {
      const result = await callGemini(PROMPT_2_SYSTEM, USER_PROMPT, SCHEMA_2);
      const ms = Math.round(performance.now() - start);
      spectrumResults.push(result);
      const s = result.subject_index;
      const t = result.theory_index;
      const m = result.methodology_index;
      const c = result.context_index;
      console.log(
        `✓ ${ms}ms\n  { subject: ${s}, theory: ${t}, methodology: ${m}, context: ${c} }`,
      );
    } catch (err) {
      console.log(
        `✗ HATA: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const specStability = analyzeSpectrumStability(spectrumResults);
  const maxOverallDev = Math.max(...specStability.map((f) => f.maxDev));
  console.log(
    `\n  ➔ SAPMA DURUMU: ${maxOverallDev <= 10 ? "Beton Gibi Kararlı! Sayısal dalgalanma minimum düzeyde kaldı." : "Dalgalanma Tespit Edildi! Sayısal farklar yüksek."}`,
  );
  console.log(`  Maksimum sapma: ±${maxOverallDev} puan`);
  console.log(
    `  Detay: ${specStability.map((f) => `${f.label}: [${f.values.join(", ")}] → ortalama ${f.mean}, ±${f.maxDev}`).join(" | ")}`,
  );

  console.log("");

  // --- ÖZET KARŞILAŞTIRMA ---
  console.log("▓ ÖZET KARŞILAŞTIRMA");
  console.log(
    "----------------------------------------------------------------------",
  );

  const enumVariance = enumStability.map((f) => {
    const scores = f.values.map((v) => enumToScore(v));
    return Math.max(...scores) - Math.min(...scores);
  });
  const spectrumVariance = specStability.map((f) => f.maxDev);

  console.log(
    `  Enum eksenel sapma:       ${enumVariance.join(", ")} (kademe)`,
  );
  console.log(
    `  Spektrum eksenel sapma:   ${spectrumVariance.join(", ")} (puan)`,
  );
  console.log(
    `  ➔ KAZANAN: ${maxOverallDev <= 10 && !enumJump ? "BERABERE (her iki mimari de kararlı)" : !enumJump && maxOverallDev > 10 ? "MİMARİ 1 (Enum) — Spectrum'da yüksek sayısal dalgalanma var" : enumJump && maxOverallDev <= 10 ? "MİMARİ 2 (Spektrum) — Enum'da etiket kayması var" : "BELİRSİZ — Her iki mimaride de tutarsızlık mevcut"}`,
  );

  console.log(
    "\n======================================================================",
  );
}

main().catch((err) => {
  console.error("\n✗ KRİTİK HATA:", err);
  process.exit(1);
});
