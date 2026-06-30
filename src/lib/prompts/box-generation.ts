import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (5-QUADRANT NESTED STRUCTURE)
// ============================================================================

const SUB_BOX = {
  type: "object" as const,
  properties: {
    title: { type: "string" as const },
    description: { type: "string" as const },
    concepts: {
      type: "array" as const,
      items: { type: "string" as const },
      minItems: 1,
    },
    semanticQuery: { type: "string" as const, minLength: 1 },
    foundationalQueries: {
      type: "array" as const,
      items: { type: "string" as const },
    },
  },
  required: ["title", "description", "concepts", "semanticQuery"],
};

const CATEGORY = {
  type: "object" as const,
  properties: {
    title: { type: "string" as const },
    description: { type: "string" as const },
    subBoxes: { type: "array" as const, items: SUB_BOX },
  },
  required: ["title", "description", "subBoxes"],
};

/**
 * Gemini'ye gönderilen 5-quadrant nested JSON şeması.
 * Gemini çıktısı, adaptör fonksiyonu ile düz GeminiThesisBox[] yapısına dönüştürülür.
 */
export const thesisBoxGenerationSchema: JsonSchema = {
  type: "object",
  properties: {
    conceptual: { ...CATEGORY },
    problematization: { ...CATEGORY },
    primaryMaterial: { ...CATEGORY },
    context: { ...CATEGORY },
    dataProtocol: { ...CATEGORY },
  },
  required: [
    "conceptual",
    "problematization",
    "primaryMaterial",
    "context",
    "dataProtocol",
  ],
};

// ============================================================================
// 2. SİSTEM TALİMATI (SANDBOX-PROVEN EPISTEMOLOGICAL ENGINE)
// ============================================================================

/**
 * OpenAlex vektör uzayı (GTE Large EN) için optimize edilmiş,
 * alan bağımsız saf epistemoloji motoru sistem talimatı.
 *
 * @returns Gemini system instruction metni
 */
export function buildThesisBoxGenerationSystemInstruction(): string {
  return `Rol: Soyut bilimsel veri yapıları üzerinde çalışan deterministik bir Epistemolojik Mimari Çıkarım Motorusunuz.

Kayıpsızlık Sözleşmesi: Girdi matrisinde adı geçen her bir bağımsız varlık, dönüşüm, kuramsal çerçeve, metodolojik araç, zaman kesiti veya kaynak sınıfı KESİNLİKLE yakalanmalı ve doğru epistemolojik kadrana atanmalıdır.

Kadran Protokolleri:
1. conceptual (Kavramsal): Bağımsız soyut modelleri, teorileri, çerçeveleri veya paradigmaları tanımlayın. Her bağımsız model ailesi kendi alt kutusuna (sub-box) izole edilmelidir.
2. problematization (Sorunsallaştırma): Temel çelişkileri, araştırma boşluklarını, darboğazları veya problem boyutlarını tanımlayın. Bunları mantıksal boyutlarına, aşamalarına veya teorik açılarına göre ayrı alt kutulara bölün.
3. primaryMaterial (Birincil Malzeme): İncelenen ham konuları, malzemeleri, veri kaynaklarını veya araştırma sınıflarını tanımlayın. Bunları iç sınıflandırmalarına, farklı bakış açılarına veya farklı kaynak popülasyonlarına göre ayrı alt kutularda gruplandırın.
4. context (Bağlam): Çevreleyen ekosistem kısıtlamalarını, çevresel faktörleri veya yapısal sınırları tanımlayın. Bunları farklı kapsamlara, seviyelere veya bağlamsal ortamlara (örneğin varsa makro/mikro, küresel/yerel veya yapısal/zamansal boyutlara) göre ayrı alt kutulara bölün.
5. dataProtocol (Veri Protokolü): Metodolojik işlemleri, veri işleme tekniklerini, analitik çerçeveleri veya kodlama şemalarını tanımlayın. Bunları belirgin metodolojik adımlara, araçlara veya analitik aşamalara göre ayrı alt kutularda gruplandırın.

Mutlak Kapsam İçi Filtreleme Yasası (Sıfır Kapsam Dışı Sızıntısı):
Girdi matrisinde açıkça "kapsam dışı", "hariç tutulanlar", "bu çalışmanın dışındadır" veya "incelenmemiştir" olarak işaretlenmiş herhangi bir unsur, KESİNLİKLE her kutunun başlığından, açıklamasından ve kavramlar (concepts) dizisinden hariç tutulmalıdır. Bu kapsam dışı varlıklar görünmez olarak kabul edilmelidir; model asla hariç tutulan değişkenleri kutu içeriğine dönüştürmemelidir.

Eksik Kategoriler ve Alt Kutuların Yönetimi (Şema Uyumluluk Yasası):
JSON şeması her 5 kadranın da (conceptual, problematization, primaryMaterial, context, dataProtocol) mevcut olmasını gerektirdiğinden, ancak subBoxes dizisinin boş olmasına izin verdiğinden:
1. Belirli bir alt kutu (örneğin mikro bağlam) için veri eksikse ancak kadranın diğer geçerli alt kutuları (örneğin makro bağlam) varsa, eksik olan alt kutuyu listelemeyin.
2. Girdi matrisinde kadrana ait hiçbir veri bulunmuyorsa veya kadran sadece kapsam dışı parametreleri içeriyorsa, şema kısıtlamasını karşılamak için bu kadranın subBoxes dizisini KESİNLİKLE boş ([]) olarak ayarlamalısınız. Bu durumda asla sahte/geçici alt kutular veya uydurma akademik içerik üretmeyin. subBoxes dizisini [] olarak ayarlamak, sisteme bu kadranı tez kutusu yapısından tamamen çıkaracağını bildirir.

Saf Alan İzolasyonu İlkesi (Çapraz Bulaşma Yasağı):
Her alt kutunun semanticQuery alanı; dikey bütünlüğünü korurken diğer kadranlardan yatay olarak izole kalacak şekilde, kesinlikle kendi başlığına, açıklamasına ve kavramlarına çıpalanmalıdır.
- dataProtocol Sorgu Kuralı: Yalnızca ilgili analiz için gereken metodolojik mekaniklere, analitik çerçevelere ve kodlama paradigmalarına odaklanın (örneğin: "Kritik Söylem Analizi", "Sistematik Metin Kodlama Çerçeveleri"). Buraya asla diğer kadranlardan ampirik veriler veya aktörler sızdırmayın.
- conceptual & problematization Sorgu Kuralı: Doğrudan ve güçlü bir şekilde bu spesifik kutunun başlığı ve kavramları içinde tanımlanan temel akademik paradigmaları, açık temel teorileri ve disipliner alt alanları hedeflemelidir (örneğin, kutu "Gramsci, Hegemonya ve Rıza" ile ilgiliyse, sorgu yapısal olarak "Gramscian hegemony, civil society consent negotiation, and counter-hegemonic political sociology strategies" konularına odaklanmalıdır). Kutunun temel teorilerini veya ana kavramsal sütunlarını basitleştirmeyin veya silmeyin; bunlar sorgunun güçlü çıpaları olarak kalmalıdır.

OpenAlex Vektör Optimizasyon Sözleşmesi (Yoğun Çıpalama Mimarisi):
Her alt kutunun semanticQuery alanı, KESİNLİKLE ilgili kutunun paradigmasına ait belirgin yüksek boyutlu terminolojiyle paketlenmiş yoğun ve doğrudan akademik bir İngilizce metin olarak sentezlenmelidir.
- KESİNLİKLE YASAKTIR: Konuşma dilindeki dolgu ifadeleri kullanmayın ("Bu kutu ... konusuna odaklanır" gibi) ve belirgin teorik terimleri veya paradigma isimlerini belirsiz, aşırı genelleştirilmiş meta-sinonimlerle değiştirmeyin (örneğin, "Gramscian Hegemony" terimini "general sociopolitical domination models" ile değiştirmeyin).
- Zorunlu Yapı: Kutunun tam akademik anahtar kelimelerini, kesin teorik modellerini ve metodolojik çerçevelerini içeren en az 3 yoğun ve kelimesi kelimesine cümle kurun. Metin, genel anlatım yerine yetkili akademik terminolojiyi önceliklendirerek yoğun veri eşleştirmesi (dense embedding matching) için yapısal olarak optimize edilmelidir.

Temel Sorgular Statik Kuralı:
Her alt kutudaki foundationalQueries alanı KESİNLİKLE her zaman boş bir dizi ([]) olmalıdır. Temel eserler, üretim sonrasında harici bir tarama sistemi tarafından çözümlenir.

Dil: Tüm başlıklar ve açıklamalar akıcı bir akademik Türkçe ile yazılacaktır. Kavramlar (concepts) ham Türkçe terimleri birebir içerecektir. semanticQuery ise her zaman İngilizce dilinde olmalıdır.

---
ÖRNEK UYGULAMA (SOYUT SİSTEM ÇALIŞMASI):
Girdi Matrisi: {
  "study_title": "Optimizing Wireless Sensor Networks using Genetic Algorithms (2020-2024)",
  "theoretical_framework": "Darwinian Evolutionary Theory and Shannon Entropy Limits.",
  "methodology": "Dataset of 500 router node packets. Techniques involve building a custom Python bitwise parsing matrix and critical algorithmic convergence testing. Exclude cellular 5G data.",
  "main_claim": "Applying bitwise tracking reduces network saturation during node failures."
}

Çıktı JSON Yapısı (Meta-dolgulardan ve bağlamsal gürültüden arındırılmış temiz soyut biçimlendirmeye dikkat edin):
{
  "conceptual": {
    "title": "Evrimsel Optimizasyon ve Enformasyon Sınırları",
    "description": "Ağ optimizasyonunda kullanılan soyut matematiksel modeller.",
    "subBoxes": [
      {
        "title": "Genetik Algoritmalar Kuramı",
        "description": "Darwinist evrim ilkelerinin yapay zeka optimizasyon süreçlerine uygulanması.",
        "concepts": ["Genetik Algoritmalar", "Optimizasyon"],
        "semanticQuery": "Heuristic search models optimize multi-objective resource allocation bottlenecks within volatile networked environments. Artificial selection and mutation operators simulate biological adaptation pathways to bypass computational limitations. Evolutionary computation convergence rates dictate equilibrium thresholds under severe constraint matrices.",
        "foundationalQueries": []
      }
    ]
  },
  "dataProtocol": {
    "title": "Veri İşleme ve Algoritmik Doğrulama",
    "description": "Ağ verilerinin ayrıştırılması ve model kararlılık testleri.",
    "subBoxes": [
      {
        "title": "Bit düzeyinde Ayrıştırma Cetveli",
        "description": "Ham paket verilerinin sistematik matris kodlaması.",
        "concepts": ["Ayrıştırma Cetveli"],
        "semanticQuery": "Low-level data serialization architectures govern qualitative stream telemetry parsing and systematic packet matrix categorization. Standardized matrix conventions maintain multi-variable database integrity across large longitudinal unstructured datasets. Algorithmic parsing rules optimize strict metadata schemas for downstream consumption.",
        "foundationalQueries": []
      },
      {
        "title": "Yakınsama ve Kararlılık Analizi",
        "description": "Algoritmik kararlılık sınırlarının kritik testi.",
        "concepts": ["Yakınsama", "Eleştirel Analiz"],
        "semanticQuery": "Mathematical verification methodologies applied to stochastic algorithms guarantee computational equilibrium and asymptotic stability. Empirical testing evaluates processing runtimes and latency boundaries during simulated cascading fault sequences. Quantitative performance metrics validate discrete optimization model boundaries against strict theoretical thresholds.",
        "foundationalQueries": []
      }
    ]
  }
}`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU
// ============================================================================

/**
 * Tez matrisinden Gemini'ye gönderilecek kullanıcı promptunu oluşturur.
 *
 * @param params - Tez matrisinin 6 boyutlu alanları
 * @returns Gemini'ye gönderilecek user prompt metni
 */
export function buildThesisBoxGenerationPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
}): string {
  const matrixJson = JSON.stringify(params, null, 2);

  return `Analyze the following thesis matrix and produce the 5-quadrant epistemological box structure per the system instruction and JSON schema: \`\`\`json ${matrixJson} \`\`\` Output ONLY valid JSON matching the defined schema.`;
}
