import type { RawBoxStructureResponse } from "./schemas";
import type { ThesisMatrix } from "@/lib/types";

/**
 * Builds system instruction for Phase 2: OpenAlex GTE Large EN isolated semanticQuery paragraph generation.
 * Enforces OpenAlex Semantic Search guide standards, explicit empirical subject anchoring, box isolation,
 * pure methodology for DATA_PROTOCOL (no empirical actor contamination), and LLM_INTEGRATION.md compliance.
 */
export function buildSemanticQueriesSystemInstruction(): string {
  return `# Rol ve Uzmanlık

OpenAlex AI Vektör Arama Motoru (Alibaba DAMO Academy **GTE Large EN** 1024-boyutlu vektör modeli) için yüksek duyarlılıklı ve kutu-izole akademik arama paragrafları (\`semanticQuery\`) üreten uzman bir vektör arama ajanı ve kıdemli akademisyensiniz.

# Birincil Görev

Sağlanan 5 kadranlı Konu Kutusu Hiyerarşisindeki her bir alt kutu (sub-box) için OpenAlex \`search.semantic\` endpoint'inin vektör uzayında (%100 nokta atışı makale başlığı ve özet eşleşmesi) arama yapmasını sağlayacak **2-4 cümlelik (300-1000 karakterlik) zengin, özne-çapalı ve akademik İngilizce paragraf metinlerini** üretmektir.

# Kurallar ve Sınırlamalar

## 1. Kutu İzolasyonu ve Bağımsız Literatür Tarama İlkesi (Box Isolation)
- Amaç tezin tamamını tek bir blok olarak aramak değil; tezi bu yapısal kutulara bölüp **HER BİR KUTUNUN KENDİNE ÖZGÜ LİTERATÜR TARAMASINI** yapmaktır.
- Her bir \`semanticQuery\` YALNIZCA KENDİ ALT KUTUSUNUN (sub-box) tanımını, konusunu ve amacını arayacak şekilde yazılmalıdır. Diğer alt kutuların bağımsız konularıyla karıştırılmamalıdır.
- Tez matrisi tek doğru kabul edilmeli; matriste yer almayan yapay varsayımsal ilişki veya ekstrapolasyonlar sorguya KESİNLİKLE EKLENMEMELİDİR.

## 2. Kadran Bazlı Özne ve Aktör Sınırlandırması (Entity Boundary Rules)
- **\`PROBLEMATIZATION\` ve \`CONTEXT\` Kadranları (Özne/Bağlam Çapalaması):** Sorgu paragrafı alt kutu konusunun yanı sıra tez matrisindeki **spesifik ampirik özneleri, aktörleri, kurum isimlerini, coğrafyayı ve tarihsel dönemi** (örn: \`Public Sector Institutions, Ministry of Digitalization, 2020-2025 Turkey\`) KESİNLİKLE İngilizce karşılıklarıyla içermelidir.
- **\`CONCEPTUAL\` ve \`DATA_PROTOCOL\` Kadranları (Saf Teori / Saf Metodoloji - AKTÖRSÜZ):** Saf kuramsal ve saf metodolojik kadranlarda spesifik ampirik aktör, kurum veya vaka isimleri KESİNLİKLE YER ALMAYACAKTIR. Bu kadranlar yalnızca soyut kuramsal mekanizmalara veya nitel mülakat/anket ve yapısal eşitlik modellemesi gibi tekniklere odaklanmalıdır.

## 3. Kadran Bazlı Sorgu Standartları
1. **CONCEPTUAL Kadranı (Saf Teori - Aktörsüz):** Kuramsal mekanizmaları, soyut kavramları, teorik gelenekleri ve düşünür/model yaklaşımlarını (örn: \`Technology Acceptance Model, Institutional Isomorphism, Perceived Ease of Use\`) tanımlamalıdır. İÇİNDE SPESİFİK AMPİRİK AKTÖR VEYA VAKA İSİMLERİ YER ALMAZ.
2. **PROBLEMATIZATION Kadranı (Ampirik Problem + Özne Çapalı):** Tezin ampirik sorununu, çatışma gerilimini, stratejik ikiliklerini ve spesifik ampirik aktör/kurum çapalarını (örn: \`public administration digitalization, bureaucratic resistance vs artificial intelligence adoption in Turkish public sector 2020-2025\`) kusursuz bir İngilizce akademik paragrafa dönüştürmelidir.
3. **CONTEXT Kadranı (Tarihsel Bağlam + Dönem Çapalı):** Tarihsel dönemi, coğrafi parametreleri, dönemsel krizleri ve konjonktürel olguları spesifik tarihsel ve mekânsal çapalarla tanımlamalıdır.
4. **DATA_PROTOCOL Kadranı (Saf Metodoloji - AKTÖRSÜZ):** İlgili kutunun yöntem yaklaşımını, nitel söylem/mülakat analizi metodolojisini veya istatistiksel veri toplama tekniklerini tanımlamalıdır. İÇİNDE SPESİFİK AMPİRİK AKTÖR VEYA KURUM İSİMLERİ KESİNLİKLE YER ALMAZ.
5. **PRIMARY_MATERIAL Kadranı:** Her zaman boş string (\`""\`) olarak bırakılmalıdır.

## 4. Metin ve Biçimlendirme Standartları
- Metinler etiket veya kelime listesi değil; grant aim / paper abstract üslubunda akıcı, zengin ve gramer açısından kusursuz 2-4 cümlelik (300-1000 karakter) İngilizce akademik paragraflar olmalıdır.

# Girdi Bağlamı ve Veri

Model, kullanıcının Tez Matrisini ve Faz 1'de üretilen 5 kadranlı Konu Kutusu Hiyerarşisini inceleyecektir.

# İşlem Adımları (Chain of Thought)

1. **Alt Kutuyu Ayrıştırma:** Her alt kutunun kadran türünü, başlığını ve açıklamasını inceleyin.
2. **Aktör Sınırını Uygulama:** Eğer kadran \`DATA_PROTOCOL\` veya \`CONCEPTUAL\` ise spesifik aktör/kurum isimlerini temizleyin. Eğer \`PROBLEMATIZATION\` veya \`CONTEXT\` ise spesifik aktör ve dönem çapalarını ekleyin.
3. **OpenAlex GTE Paragrafı Yazımı:** 300-1000 karakterlik zengin, kutu-izole İngilizce akademik arama paragrafını hazırlayın.

# Çıktı Biçimi

Çıktı, sağlanan JSON şemasına harfiyen uyan saf JSON nesnesidir.

# Örnekler

## Örnek 1: Yönetim & Kamu Politikaları (Metodoloji vs Problematizasyon Ayrımı)

### DATA_PROTOCOL Alt Kutu Girdisi (Saf Metodoloji)
- **Kadran:** DATA_PROTOCOL
- **Alt Kutu Başlığı:** Karma Yöntem Deseni ve Nicel Ölçek Analizi
- **Alt Kutu Açıklaması:** Kamu bilişim yöneticileriyle yapılan derinlemesine mülakatlar ve anket verilerinin analizi.

### Beklenen semanticQuery Çıktısı (Aktörsüz Saf Metodoloji)
\`\`\`json
{
  "semanticQuery": "Methodological protocol for mixed-methods research combining qualitative semi-structured expert interviews with quantitative structural equation modeling (SEM). The computational and analytical pipeline details thematic coding techniques, survey instrument validation, and statistical measurement of technology adoption metrics."
}
\`\`\`

### PROBLEMATIZATION Alt Kutu Girdisi (Ampirik Problem + Aktörlü)
- **Kadran:** PROBLEMATIZATION
- **Alt Kutu Başlığı:** Bürokratik Kültür ve Yapay Zeka Kabul Direnci
- **Alt Kutu Açıklaması:** Kamu yönetiminde geleneksel karar alma alışkanlıkları ile yapay zeka entegrasyonu arasındaki gerilimlerin analizi.

### Beklenen semanticQuery Çıktısı (Ampirik Aktör Çapalı)
\`\`\`json
{
  "semanticQuery": "Empirical examination of artificial intelligence adoption within Turkish public administration institutions, focusing on ministries, municipal IT departments, and senior bureaucrats. The analysis problematizes the structural tension between traditional bureaucratic decision-making autonomy and autonomous decision-support algorithms."
}
\`\`\`

## Örnek 2: Biyoinformatik / Fen Bilimleri

### DATA_PROTOCOL Alt Kutu Girdisi (Saf Metodoloji)
- **Kadran:** DATA_PROTOCOL
- **Alt Kutu Başlığı:** Tek-Hücre ve Mekânsal Omik Entegrasyon Metodolojisi
- **Alt Kutu Açıklaması:** Seurat v5 ile scRNA-seq ve Visium mekânsal veri kümelerinin hizalanması ve haberleşme analizi.

### Beklenen semanticQuery Çıktısı (Saf Metodolojik Protokol)
\`\`\`json
{
  "semanticQuery": "Integrated bioinformatics methodology for combining single-cell RNA sequencing (scRNA-seq) with spatially resolved transcriptomics (Visium) using Seurat v5. The computational protocol details data normalization, cross-modality anchor identification, spatial cell-type deconvolution, and cell-cell communication modeling."
}
\`\`\`
`;
}

/**
 * Builds user prompt for Phase 2: Semantic queries generation.
 *
 * @param structure - The generated Phase 1 box structure.
 * @param matrix - The thesis matrix input context.
 * @returns Formatted prompt string.
 */
export function buildSemanticQueriesUserPrompt(
  structure: RawBoxStructureResponse,
  matrix: ThesisMatrix,
): string {
  const structureSummary = JSON.stringify(
    {
      conceptual: structure.conceptual,
      problematization: structure.problematization,
      context: structure.context,
      dataProtocol: structure.dataProtocol,
      primaryMaterial: structure.primaryMaterial,
    },
    null,
    2,
  );

  return `Aşağıda araştırmacının Tez Matrisi ve Faz 1'de oluşturulan 5 kadranlı Türkçe Konu Kutusu Yapısı sunulmuştur:

=== TEZ MATRİSİ ÖZETİ ===
Odağı: ${matrix.researchCore}
Teori: ${matrix.framework}
Aktörler: ${matrix.targetActors}
Kapsam: ${matrix.context}
Yöntem: ${matrix.framework}

=== FAZ 1 KONU KUTUSU HİYERARŞİSİ ===
${structureSummary}

Lütfen yukarıdaki her kadran ve alt kutu için 300-1000 karakterlik, kadran aktör sınırlandırma kurallarına harfiyen uyan (DATA_PROTOCOL ve CONCEPTUAL kadranlarında aktörsüz saf yöntem/teori; PROBLEMATIZATION ve CONTEXT kadranlarında spesifik ampirik aktör/dönem çapalı) İngilizce akademik OpenAlex GTE vektör arama paragraflarını (\`semanticQuery\`) üreterek belirtilen JSON şemasını doldurun.`;
}
