import type { RawBoxStructureResponse } from "./schemas";
import type { ThesisMatrix } from "@/lib/types";

/**
 * Builds system instruction for Phase 2: OpenAlex GTE Large EN isolated semanticQuery paragraph generation.
 * Enforces OpenAlex Semantic Search guide standards, explicit empirical subject anchoring, box isolation,
 * and LLM_INTEGRATION.md compliance with multi-disciplinary few-shot examples.
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

## 2. Özne ve Aktör Çapalaması Zorunluluğu (Explicit Entity Anchoring)
- OpenAlex GTE Large EN vektör modeli jenerik ve soyut söylemler karşısında küresel jenerik makaleler döndürür. Bu nedenle sorgular jenerik kalmamalıdır.
- \`PROBLEMATIZATION\`, \`CONTEXT\`, \`DATA_PROTOCOL\` ve alan bazlı kutularda sorgu paragrafı; alt kutu konusunun yanı sıra tez matrisindeki **spesifik ampirik özneleri, aktörleri, parti geleneklerini, örgüt/kurum isimlerini, coğrafyayı ve tarihsel dönemi** (örn: \`HEP, DEP, HADEP, PKK, 1990s Turkey\` veya \`CD8+ T cells, scRNA-seq, Glioblastoma, Seurat v5\`) KESİNLİKLE İngilizce karşılıklarıyla içermelidir.

## 3. Kadran Bazlı Sorgu Standartları
1. **CONCEPTUAL Kadranı:** Kuramsal mekanizmaları, soyut kavramları, teorik gelenekleri ve düşünür yaklaşımını tanımlamalıdır. İlgili teorik literatürle doğrudan eşleşecek 1-2 kelimelik nokta atışı terimleri de kapsamalıdır.
2. **PROBLEMATIZATION Kadranı:** Tezin ampirik sorununu, çatışma gerilimini, stratejik ikiliklerini ve spesifik ampirik aktör/kurum çapalarını (örn: \`pro-Kurdish party politics, HEP, HADEP, parliamentary participation vs. armed insurgency\`) kusursuz bir İngilizce akademik paragrafa dönüştürmelidir.
3. **CONTEXT Kadranı:** Tarihsel dönemi, coğrafi parametreleri, dönemsel krizleri ve konjonktürel olguları spesifik tarihsel ve mekânsal çapalarla tanımlamalıdır.
4. **DATA_PROTOCOL Kadranı:** İlgili kutunun yöntem yaklaşımını, veri analiz tekniklerini ve araçlarını (örn: \`critical discourse analysis of party manifestos\` veya \`Seurat v5 spatial transcriptomics integration\`) tanımlamalıdır.
5. **PRIMARY_MATERIAL Kadranı:** Her zaman boş string (\`""\`) olarak bırakılmalıdır.

## 4. Metin ve Biçimlendirme Standartları
- Metinler etiket veya kelime listesi değil; grant aim / paper abstract üslubunda akıcı, zengin ve gramer açısından kusursuz 2-4 cümlelik (300-1000 karakter) İngilizce akademik paragraflar olmalıdır.

# Girdi Bağlamı ve Veri

Model, kullanıcının Tez Matrisini ve Faz 1'de üretilen 5 kadranlı Konu Kutusu Hiyerarşisini inceleyecektir.

# İşlem Adımları (Chain of Thought)

1. **Alt Kutuyu Ayrıştırma:** Her alt kutunun başlığını, açıklamasını ve kavramlarını inceleyip bağımsız arama hedefini belirleyin.
2. **Özne ve Kavram Çapalarını Toplama:** Tez matrisindeki spesifik ampirik aktörleri, dönemi ve terminolojiyi tespit edin.
3. **OpenAlex GTE Paragrafı Yazımı:** 300-1000 karakterlik zengin, özne-çapalı ve kutu-izole İngilizce paragrafı hazırlayın.

# Çıktı Biçimi

Çıktı, sağlanan JSON şemasına harfiyen uyan saf JSON nesnesidir.

# Örnekler

## Örnek 1: Siyaset Bilimi / Sosyal Bilimler

### Alt Kutu Girdisi
- **Kadran:** PROBLEMATIZATION
- **Alt Kutu Başlığı:** Siyasi Çatışmada Çift Kulvarlılık ve Eşzamanlılık
- **Aktörler ve Dönem:** HEP, DEP, HADEP, PKK, 1991-1999 Türkiye
- **Alt Kutu Açıklaması:** Yasal parti siyaseti ile silahlı mücadelenin eşzamanlı yürütülmesinden doğan stratejik ve kurumsal gerilimlerin analizi.

### Beklenen semanticQuery Çıktısı
\`\`\`json
{
  "semanticQuery": "Empirical investigation of legal pro-Kurdish political parties in 1990s Turkey, focusing on HEP (People's Labor Party), DEP, HADEP, and the PKK armed conflict under state of emergency (OHAL). The analysis problematizes the strategic simultaneity where legal parliamentary participation and non-state armed struggle coexisted as complementary tactics, analyzing party closures, electoral constraints, and contentious political mobilization."
}
\`\`\`

## Örnek 2: Biyoinformatik / Fen Bilimleri

### Alt Kutu Girdisi
- **Kadran:** DATA_PROTOCOL
- **Alt Kutu Başlığı:** Tek-Hücre ve Mekânsal Omik Entegrasyon Metodolojisi
- **Aktörler ve Araçlar:** CD8+ T cells, scRNA-seq, Visium Spatial Transcriptomics, Seurat v5
- **Alt Kutu Açıklaması:** Seurat v5 ile scRNA-seq ve Visium mekânsal veri kümelerinin hizalanması ve harbelleşme analizi.

### Beklenen semanticQuery Çıktısı
\`\`\`json
{
  "semanticQuery": "Integrated bioinformatics methodology for combining single-cell RNA sequencing (scRNA-seq) with spatially resolved transcriptomics (Visium) using Seurat v5 to map CD8+ T-cell exhaustion in solid tumors. The computational protocol details data normalization, cross-modality anchor identification, and spatial cell-type deconvolution to reconstruct tumor microenvironment signaling architecture."
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

Lütfen yukarıdaki her kadran ve alt kutu için 300-1000 karakterlik, özne-çapalı ve kutu-izole İngilizce akademik OpenAlex GTE vektör arama paragraflarını (\`semanticQuery\`) üreterek belirtilen JSON şemasını doldurun.`;
}
