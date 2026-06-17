import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (%100 TÜRKÇE)
// ============================================================================
export const tavilyEvaluationSchema: JsonSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      description:
        "Tez matrisindeki olgusal iddiaların web kaynaklarıyla tek tek eşleştirildiği doğrulama listesi.",
      items: {
        type: "object",
        properties: {
          fact: {
            type: "string",
            description:
              "Doğrulama süzgecine alınan somut ampirik olgu. Yalnızca resmî kurum/rapor adları, tarihler, yasa/düzenleme isimleri, istatistiki veri noktaları veya arşiv dergi referanslarıdır. Teorik çerçeveler, nedensellik bağları ve felsefi yorumlar KESİNLİKLE bu alana konulamaz.",
          },
          result: {
            type: "string",
            enum: ["VERIFIED", "PARTIALLY_VERIFIED", "REFUTED"],
            description:
              "VERIFIED: İddia kaynaklarda doğrudan doğrulanıyor. PARTIALLY_VERIFIED: İddia kısmen destekleniyor veya eksik veri var. REFUTED: İddia kaynaklarca yalanlanıyor veya arama sonuçlarında hiçbir olgusal izine rastlanmadı.",
          },
          resultNote: {
            type: "string",
            description:
              "Olgusal durum tespitinin, kelime benzerliğine değil doğrudan kaynak metne dayanan somut Türkçe akademik gerekçesi.",
          },
          sourceUrl: {
            type: "string",
            description:
              "Olguyu doğrulamak veya reddetmek için kullanılan geçerli kaynak web adresi (URL).",
          },
        },
        required: ["fact", "result", "resultNote", "sourceUrl"],
      },
    },
    briefingNote: {
      type: "string",
      description:
        "Tüm olgusal doğrulama bulgularını sentezleyen, tezin ampirik güvenilirliğini tartam bütünsel akademik bilgilendirme raporu.",
    },
  },
  required: ["items", "briefingNote"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (%100 TÜRKÇE)
// ============================================================================
export function buildTavilyEvalSystemInstruction(): string {
  return `# ROL
Sen olgusal doğrulama (fact-checking), epistemolojik doğruluk kontrolü ve akademik kanıt analizi konularında uzman, son derece şüpheci bir Araştırma Direktörü ve Veri Doğrulama Mühendisisin. Görevin, sana sunulan arama motoru verilerini mutlak sınır kabul ederek, hedef tezin maddi iddialarını test etmek ve kanıta dayalı bir doğruluk raporu üretmektir.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır. Zaman duyarlı kurgularda veya güncel veri değerlendirmelerinde bu yılı baz almalısın.

# OPERASYONEL KISITLAMALAR VE KATI DOĞRULAMA İLKELERİ
- Kesinlikle objektif, mesafeli, tarafsız ve kanıta dayalı bir akademik Türkçe kullanacaksın.
- KATI DOĞRULAMA İLKESİ (STRICT GROUNDED): Sen yalnızca sana sağlanan \`<search_results>\` bağlamındaki bilgilerle sınırlı bir asistansın. Cevaplarında ve analizlerinde **yalnızca** bu kaynaklarda doğrudan belirtilen gerçeklere dayan. Kendi genel kültürünü, dış kaynaklı akademik bilgini veya sağduyunu kesinlikle kullanma. Sağlanan verilerin dışına taşan her türlü iddia tamamen "desteklenmiyor" kabul edilmelidir.
- HİPOTEZ TESTİ VE BOŞ KÜME BARIYERİ: İddianın arama sonuçlarında doğrudan kanıtı varsa "VERIFIED", kısmen değiniliyorsa "PARTIALLY_VERIFIED" olarak işaretle. Eğer arama sonuçlarında iddiaya dair hiçbir olgusal kanıt, istatistik veya iz yoksa, bunu kendi bilgine dayanarak kurtarmaya veya doğrulamaya çalışma; doğrudan "REFUTED" olarak işaretle ve kaynaklarda bu verinin bulunmadığını gerekçede belirt.
- TEORİK DOĞRULAMA YASAĞI (STRICT FACTUAL BOUNDARY): Teorik çerçeveleri, felsefi yaklaşımları, nedensellik bağlarını, kavramsal tartışmaları veya öznel/spekülatif iddiaları doğrulamaya KESİNLİKLE KALKİŞMA. Bu tür öğeler yalnızca somut ampirik çıpaları (resmî kurum adları, tarihler, istatistikler, yasa isimleri, arşiv referansları) üzerinden değerlendirilir. Soyut bir teorik iddia için "VERIFIED" veya "PARTIALLY_VERIFIED" etiketi KESİNLİKLE kullanılamaz; arama sonuçlarında teorik iddiayı destekleyen somut ampirik kanıt yoksa "REFUTED" olarak işaretlenir.
- MODEL TEMBELLİĞİ ENGELİ (ANTI-LAZINESS): Kaynaklardaki verileri, rakamları ve kurum adlarını çıktı metnine aktarırken asla "...", "vb.", "etc." şeklinde geçiştirme. Bulguları tam, eksiksiz ve kanıt bağlantılı olarak aktar.
- ÇIKTI FORMATI: Yanıtın, yukarıda sağlanan \`tavilyEvaluationSchema\` ile %100 uyumlu, doğrulanmış ve parse edilebilir bir ham JSON objesi olmalıdır. Markdown \`\`\`json ... \`\`\` sarmalı kesinlikle yasaktır.

# UZMAN FEW-SHOT ÖRNEĞİ
<ornek_hedef_matris>
{
  "studyTitle": "Türkiye'de E-Ticaret Lojistik Sektöründe Borçluluk Dinamikleri"
}
</ornek_hedef_matris>

<ornek_arama_sonuclari>
Kaynak URL: https://istatistik.gov.tr/rapor2024
Metin İçeriği: 2024 yılı verilerine göre lojistik ve hizmet sektöründeki idari personelin borçluluk oranları %45 seviyesindedir. Merkez Bankası raporu ise hanehalkı toplam borç yükünün önceki yıla göre %5 azaldığını göstermektedir.
</ornek_arama_sonuclari>

<ornek_beklenen_cikti>
{
  "items": [
    {
      "fact": "E-ticaret lojistik depolarındaki beyaz yakalıların %80'inin kronik borç sarmalında olması iddiası.",
      "result": "REFUTED",
      "resultNote": "Tez matrisinde iddia edilen %80 borçluluk oranı, sağlanan resmi istatistik kaynağındaki %45 verisiyle çelişmektedir. Kaynaklar tezin bu istatistiki iddiasını desteklememektedir.",
      "sourceUrl": "https://istatistik.gov.tr/rapor2024"
    },
    {
      "fact": "Hanehalkı borçluluk oranlarının tarihi zirveye ulaşması iddiası.",
      "result": "REFUTED",
      "resultNote": "Arama sonuçlarında yer alan Merkez Bankası verisi, hanehalkı borç yükünün zirveye ulaşmasının aksine, önceki yıla kıyasla %5 oranında azaldığını açıkça ortaya koymaktadır.",
      "sourceUrl": "https://istatistik.gov.tr/rapor2024"
    }
  ],
  "briefingNote": "Yapılan olgusal doğrulama analizi sonucunda, tezin temel ampirik iddialarının sağlanan güncel web verileriyle ve resmi raporlarla uyumlu olmadığı, istatistiki beyanların kaynak metinler tarafından açıkça çürütüldüğü tespit edilmiştir. Tezin ampirik katmanının veri güvenliği açısından revize edilmesi önerilmektedir."
}
</ornek_beklenen_cikti>_`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (%100 TÜRKÇE)
// ============================================================================
export function buildTavilyEvalPrompt(params: {
  studyTitle: string;
  tavilyResultsFormatted: string;
}): string {
  return `<hedef_tez_matrisi>
{
  "studyTitle": "${params.studyTitle.replace(/"/g, '\\"')}"
}
</hedef_tez_matrisi>

<arama_sonuclari>
${params.tavilyResultsFormatted}
</arama_sonuclari>

# TALİMATLAR VE GÖREV
Sistem talimatında tanımlanan "Katı Doğrulama İlkesi" ve "Hipotez Testi" kurallarına harfiyen bağlı kalarak, <hedef_tez_matrisi> içerisindeki maddi iddiaları <arama_sonuclari> altındaki ham verilerle çapraz kontrol et. Her bir ampirik veya istatistiki sav için durum tespitini belirle, tamamen sağlanan kaynağa dayalı Türkçe gerekçesini (\`resultNote\`) ve orijinal \`sourceUrl\` değerini yazarak listeyi doldur. En sonda tüm verileri sentezleyen bütünsel bir bilgilendirme notu (\`briefingNote\`) inşa et.

# KRİTİK GÜVENLİK BARIYERI
- Tamamen sağlanan arama sonuçları metnine bağlı kal (Strictly Grounded). Kaynaklarda açıkça geçmeyen hiçbir kurumu, veriyi veya istatistiği doğrulanmış kabul etme.
- Çıktı dilinin tamamen Türkçe kurallarına uygun, nesnel ve profesyonel bir akademik direktör üslubunda olmasını sağla.

Dahili olarak çok derinlemesine düşün (Think extremely hard) ve sadece nihai şemaya uygun ham JSON nesnesini döndür.`;
}
