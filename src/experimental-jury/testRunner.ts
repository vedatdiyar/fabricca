import { config } from "dotenv";
config({ path: ".env.local" });

import { GoogleGenAI } from "@google/genai";
import { JuryEngine } from "./juryEngine";
import type { JuryRawData } from "./juryEngine";
import {
  JURY_SYSTEM_INSTRUCTION,
  JURY_RESPONSE_SCHEMA,
  buildJuryPrompt,
} from "./promptTemplate";
import type { JuryVerdict } from "./types";

// ============================================================================
// TIPLER
// ============================================================================
interface CandidateThesis {
  id: number;
  title: string;
  author: string;
  university: string;
  year: number;
  thesisType: string;
  department: string;
  abstract: string;
}

interface ThesisSnapshot {
  id: number;
  year: number;
  title: string;
  actor: boolean;
  layer: boolean;
  theory: boolean;
  secTheory: boolean;
  spatial: boolean;
  temporal: boolean;
  MC: boolean;
  verdict: JuryVerdict;
}

// ============================================================================
// KULLANICININ GERÇEK TEZ MATRİSİ
// ============================================================================
const USER_MATRIX = {
  studyTitle:
    "1991-1999 Yılları Arasında Türkiye'de Kürt Siyaseti ve Sosyalist Kesim: İttifaklar, Ayrışmalar ve Siyasal Dönüşüm",
  researchQuestion:
    "1991-1999 döneminde Türkiye'de Kürt siyasal hareketi ile sosyalist kesim arasındaki ittifak ve ayrışma dinamikleri nelerdir? Bu dönemdeki siyasal dönüşüm, her iki hareketin strateji, söylem ve örgütsel yapılarını nasıl etkilemiştir?",
  theoreticalFramework:
    "Toplumsal hareket teorileri, siyasal fırsat yapıları teorisi, etnik çatışma teorileri, Gramsci'ci hegemonya ve ittifak analizi.",
  methodology:
    "Tarihsel nitel vaka analizi, birincil kaynak taraması (süreli yayınlar, parti belgeleri, bildiriler), yarı yapılandırılmış mülakat.",
  researchScope:
    "1991-1999 Türkiye; DEP, HEP, ÖZDEP, HADEP çizgisi ve Sosyalist Parti, SİP, EMEP, ÖDP ile Özgür Ülke, Gündem, Kurtuluş Sosyalist Dergi yayınları.",
  mainClaim:
    "1991-1999 dönemi Kürt siyaseti ile sosyalist kesim arasındaki ittifaklar, taktiksel ve dönemsel olmaktan öteye geçememiş; 28 Şubat süreci ve PKK'nın artan belirleyiciliği bu ittifakları derinleştirmek yerine ayrışmayı keskinleştirmiştir.",
};

// ============================================================================
// ADAY TEZLER
// ============================================================================
const CANDIDATES: CandidateThesis[] = [
  {
    id: 1,
    title:
      "1990'lı Yıllarda Türkiye'de Kürt Siyasal Hareketi ve Sol Partilerle İlişkisi",
    author: "Kadriye Okudan",
    university: "Ankara Üniversitesi",
    year: 2020,
    thesisType: "Yüksek Lisans",
    department: "Kamu Yönetimi ve Siyaset Bilimi",
    abstract:
      "Bu çalışma, 1990'lı yıllarda Türkiye'de Kürt siyasal hareketinin gelişimini ve dönemin sol partileriyle kurduğu ilişkileri incelemektedir. DEP, HEP, ÖZDEP ve HADEP çizgisinin sosyalist partilerle (SİP, EMEP, ÖDP) ittifak ve rekabet dinamikleri, dönemin siyasal fırsat yapıları çerçevesinde analiz edilmiştir. Çalışmada partilerin yayın organları ve seçim bildirgeleri taranmış, dönemin aktif siyasetçileriyle mülakatlar yapılmıştır.",
  },
  {
    id: 2,
    title:
      "Türkiye'de 1990'lı Yıllarda Sosyalist Hareketin Bölünmeleri ve Kimlik Siyaseti",
    author: "Onur Alp Yılmaz",
    university: "İstanbul Üniversitesi",
    year: 2021,
    thesisType: "Doktora",
    department: "Sosyoloji",
    abstract:
      "Bu tez, 1990'lı yıllarda Türkiye sosyalist hareketindeki bölünmeleri kimlik siyaseti bağlamında ele almaktadır. Soğuk Savaş sonrası dönemde sosyalist partilerin Kürt sorunu, İslamcılık ve Avrupa Birliği süreci karşısında aldıkları pozisyonların örgütsel bölünmelere nasıl yol açtığı incelenmiştir. Çalışma, Kürt hareketiyle ittifak arayışlarının sosyalist partilerde yarattığı iç gerilimlere odaklanmaktadır.",
  },
  {
    id: 3,
    title:
      "Kürt Kadın Hareketinin Tarihsel Gelişimi: 1990-2000 Dönemi",
    author: "Atike Zeynep Kılıç",
    university: "Hacettepe Üniversitesi",
    year: 2019,
    thesisType: "Yüksek Lisans",
    department: "Kadın Çalışmaları",
    abstract:
      "Bu araştırma, 1990-2000 yılları arasında Kürt kadın hareketinin ortaya çıkışını ve gelişimini tarihsel bir perspektifle analiz etmektedir. Kürt siyasal hareketi içinde kadın örgütlenmelerinin doğuşu, feminist bilincin gelişimi ve sol kadın hareketiyle kesişmeler ele alınmıştır. Dönemin Kürt kadın dergileri ve sözlü tarih çalışmaları temel kaynaklar olarak kullanılmıştır.",
  },
  {
    id: 4,
    title:
      "Türkiye'de Siyasal İslam'ın Yükselişi ve 28 Şubat Süreci: Toplumsal ve Siyasal Dönüşüm",
    author: "Erkan Karabay",
    university: "Marmara Üniversitesi",
    year: 2022,
    thesisType: "Doktora",
    department: "Siyaset Bilimi ve Uluslararası İlişkiler",
    abstract:
      "Bu çalışma, 28 Şubat 1997 askeri müdahalesi sonrası Türkiye'de siyasal İslam'ın geçirdiği dönüşümü incelemektedir. Post-modern darbe olarak adlandırılan sürecin, Refah Partisi'nin kapatılması ve Milli Görüş hareketinin bölünmesi üzerindeki etkileri analiz edilmiştir. Çalışma ağırlıklı olarak İslamcı aktörlere ve sürecin merkez sağ siyasete etkilerine odaklanmaktadır.",
  },
  {
    id: 5,
    title:
      "Zorunlu Göç ve Kentleşme: 1990'ların Kürt Göçmenleri Üzerine Bir Araştırma",
    author: "Yusuf Çevik",
    university: "Dicle Üniversitesi",
    year: 2020,
    thesisType: "Yüksek Lisans",
    department: "Sosyoloji",
    abstract:
      "Bu tez, 1990'lı yıllarda Doğu ve Güneydoğu Anadolu Bölgesi'nden zorunlu göçle Diyarbakır, Mersin ve İstanbul'a yerleşen Kürt kökenli göçmenlerin kentleşme deneyimlerini incelemektedir. Göçün sosyo-ekonomik boyutları, kentsel yoksulluk ve göçmenlerin kente uyum süreçleri, saha araştırması ve derinlemesine mülakatlarla analiz edilmiştir.",
  },
  {
    id: 6,
    title:
      "Soğuk Savaş Sonrası Dönemde Türkiye Solunda İdeolojik Dönüşüm (1989-2002)",
    author: "Mekin Mustafa Kemal Ökem",
    university: "Ankara Üniversitesi",
    year: 2021,
    thesisType: "Doktora",
    department: "Siyaset Bilimi",
    abstract:
      "Bu çalışma, SSCB'nin dağılmasından AK Parti'nin iktidara gelişine kadar geçen dönemde Türkiye solundaki ideolojik dönüşümü kapsamlı bir şekilde analiz etmektedir. Sosyalist partilerin Kürt sorunu, Avrupa Birliği, laiklik ve demokrasi kavramlarına yaklaşımlarındaki değişim, parti programları ve lider söylemleri üzerinden incelenmiştir.",
  },
  {
    id: 7,
    title:
      "Türkiye'de Kürt Kimliğinin Siyasallaşma Süreci ve 1990'lar",
    author: "Atakan Hatipoğlu",
    university: "Boğaziçi Üniversitesi",
    year: 2022,
    thesisType: "Yüksek Lisans",
    department: "Siyaset Bilimi",
    abstract:
      "Bu tez, Kürt kimliğinin Türkiye'de siyasallaşma sürecini 1990'lı yıllar odağında incelemektedir. Kimlik siyasetinin ortaya çıkışı, Kürt siyasal hareketinin kurumsallaşma çabaları ve devletin güvenlik politikaları arasındaki etkileşim analiz edilmiştir. Çalışmada dönemin siyasi partileri, sivil toplum kuruluşları ve yayın organları temel kaynaklar olarak kullanılmış, söylem analizi yöntemi uygulanmıştır.",
  },
  {
    id: 8,
    title:
      "2000'li Yıllarda Türkiye'de Tarım Politikaları ve Kırsal Dönüşüm",
    author: "Osman Şahin",
    university: "Ege Üniversitesi",
    year: 2023,
    thesisType: "Doktora",
    department: "Tarım Ekonomisi",
    abstract:
      "Bu araştırma, 2000'li yıllarda Türkiye'de uygulanan tarım politikalarının kırsal alanlardaki dönüşüme etkilerini incelemektedir. AB uyum sürecinde tarım reformları, destekleme politikaları ve kırsal kalkınma projelerinin tarımsal üretim ve kırsal nüfus üzerindeki etkileri kantitatif yöntemlerle analiz edilmiştir.",
  },
];

// ============================================================================
// YARDIMCI FONKSİYONLAR
// ============================================================================
function verdictLabel(v: JuryVerdict): string {
  const m: Record<JuryVerdict, string> = {
    RISK: "RİSK",
    LITERATURE_GAP: "LİTERATÜR BOŞLUĞU",
    EMPIRICAL_FUEL: "AMPİRİK YAKIT",
    NOISE: "NOISE",
  };
  return m[v];
}

function tick(v: boolean): string {
  return v ? "✓" : "·";
}

function snip(s: string, max = 65): string {
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

// ============================================================================
// ANA TEST ÇALIŞTIRICISI
// ============================================================================
async function run(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error(
      "HATA: GEMINI_API_KEY tanımlı değil. .env.local dosyasını kontrol edin.",
    );
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });
  const ITERATIONS = 3;
  const snapshots: ThesisSnapshot[][][] = []; // [iteration][thesisIndex]

  console.log(
    "=== EPİSTEMOLOJİK AKADEMİK JÜRİ MOTORU — 3'LÜ STRES TESTİ ===\n",
  );
  console.log(`Hedef Tez: ${USER_MATRIX.studyTitle}`);
  console.log(`Aday: ${CANDIDATES.length} tez | Iterasyon: ${ITERATIONS} | temperature: 1 | seed: 42\n`);

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const iterSnap: ThesisSnapshot[] = [];

    for (let i = 0; i < CANDIDATES.length; i++) {
      const c = CANDIDATES[i];
      const prompt = buildJuryPrompt(USER_MATRIX, c);

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: JURY_SYSTEM_INSTRUCTION,
          temperature: 1.0,
          seed: 42,
          responseMimeType: "application/json",
          responseJsonSchema: JURY_RESPONSE_SCHEMA,
        },
      });

      const parsed: JuryRawData = JSON.parse(response.text!);
      const verdict = JuryEngine.classify(parsed);

      iterSnap.push({
        id: c.id,
        year: c.year,
        title: c.title,
        actor: parsed.subject_has_same_primary_actor,
        layer: parsed.subject_has_secondary_layer,
        theory: parsed.theory_has_same_primary_framework,
        secTheory: parsed.theory_has_secondary_framework,
        spatial: parsed.context_spatial_match,
        temporal: parsed.context_temporal_covers,
        MC: parsed.mainClaimMatched,
        verdict,
      });
    }

    snapshots.push(iterSnap);
    console.log(`İterasyon ${iter + 1} tamamlandı...`);
  }

  // ==========================================================================
  // DETERMİNİZM KARŞILAŞTIRMASI
  // ==========================================================================
  console.log("\n" + "═".repeat(80));

  let anyDiff = false;
  const diffRows: {
    id: number;
    author: string;
    field: string;
    vals: string[];
  }[] = [];

  for (let t = 0; t < CANDIDATES.length; t++) {
    const base = snapshots[0][t];

    for (let iter = 1; iter < ITERATIONS; iter++) {
      const cur = snapshots[iter][t];

      const fields: [keyof ThesisSnapshot, string][] = [
        ["actor", "Aktör"],
        ["layer", "EkKat"],
        ["theory", "Kuram"],
        ["secTheory", "EkKur"],
        ["spatial", "Mekan"],
        ["temporal", "Zaman"],
        ["MC", "MC"],
        ["verdict", "KARAR"],
      ];

      for (const [key, label] of fields) {
        if (base[key] !== cur[key]) {
          anyDiff = true;
          const vals = Array.from({ length: ITERATIONS }, (_, k) =>
            String(snapshots[k][t][key]),
          );
          diffRows.push({
            id: base.id,
            author: CANDIDATES[t].author,
            field: label,
            vals,
          });
        }
      }
    }
  }

  if (!anyDiff) {
    console.log(`
DETERMİNİZM DOĞRULAMASI: BAŞARILI (%100 Tutarlılık)
temperature: 1 ayarında 3 ardışık testte de 8/8 tezin Boolean matrisleri
ve nihai kararları milimetrik olarak aynı kalmıştır.
`);
  } else {
    console.log(`
DETERMİNİZM DOĞRULAMASI: BAŞARISIZ (Sapma Tespit Edildi)
`);
    console.log("SAPMA TABLOSU:");
    console.log(
      "  ID │ Yazar                     │ Alan      │ İter-1 │ İter-2 │ İter-3",
    );
    console.log(
      "─────┼───────────────────────────┼───────────┼────────┼────────┼────────",
    );
    for (const d of diffRows) {
      console.log(
        `  ${String(d.id).padEnd(2)} │ ${d.author.padEnd(25)} │ ${d.field.padEnd(9)} │ ${String(d.vals[0]).padEnd(6)} │ ${String(d.vals[1]).padEnd(6)} │ ${String(d.vals[2]).padEnd(6)}`,
      );
    }
    console.log();
  }

  // ==========================================================================
  // ÖZET TABLO (İlk iterasyondan)
  // ==========================================================================
  console.log("═".repeat(80));
  console.log("NİHAİ JÜRİ KARARLARI (İlk Iterasyon Referansı)");
  console.log("═".repeat(80));

  const hdr = `  ID │ YIL │ Aktör│ EkKat│ Kuram│ EkKur│ Mekan│ Zaman│ MC │ KARAR`;
  const sep = `─────┼─────┼──────┼──────┼──────┼──────┼──────┼──────┼────┼──────────────────────────────────────────────────────────────────────────────────────────`;
  console.log(hdr);
  console.log(sep);

  const order = { RISK: 0, LITERATURE_GAP: 1, EMPIRICAL_FUEL: 2, NOISE: 3 };
  const refSorted = [...snapshots[0]].sort(
    (a, b) => (order[a.verdict] ?? 99) - (order[b.verdict] ?? 99),
  );

  for (const r of refSorted) {
    const shortTitle =
      r.title.length > 70 ? r.title.slice(0, 67) + "..." : r.title;
    console.log(
      `  ${String(r.id).padEnd(2)} │ ${r.year} │  ${tick(r.actor)}   │  ${tick(r.layer)}   │  ${tick(r.theory)}   │  ${tick(r.secTheory)}   │  ${tick(r.spatial)}   │  ${tick(r.temporal)}   │  ${tick(r.MC)}  │ ${verdictLabel(r.verdict).padEnd(19)}│ ${shortTitle}`,
    );
  }
  console.log("═".repeat(80));

  const counts = { RISK: 0, LITERATURE_GAP: 0, EMPIRICAL_FUEL: 0, NOISE: 0 };
  for (const r of snapshots[0]) counts[r.verdict]++;
  console.log(`\nRİSK: ${counts.RISK} | LİTERATÜR BOŞLUĞU: ${counts.LITERATURE_GAP} | AMPİRİK YAKIT: ${counts.EMPIRICAL_FUEL} | NOISE: ${counts.NOISE}`);
  console.log();

  process.exit(anyDiff ? 1 : 0);
}

run();
