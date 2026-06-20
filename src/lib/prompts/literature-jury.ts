import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (%100 TÜRKÇE)
// ============================================================================
export const literatureJuryAnalysisSchema: JsonSchema = {
  type: "object",
  properties: {
    starterPack: {
      type: "array",
      description:
        "En kritik makaleler — doğrudan tez silsilesine temel oluşturacak ana kaynaklar (en fazla 5).",
      items: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description:
              "Girdide sağlanan benzersiz referans anahtarı (OpenAlex ID, DOI veya title:başlık). EŞLEME İÇİN ZORUNLU — asla uydurma.",
          },
          type: {
            type: "string",
            enum: ["PRIMARY", "SECONDARY"],
            description:
              "PRIMARY: Teoriyi kuran kurucu metin veya doğrudan ampirik katkı. SECONDARY: İkincil uygulama veya arka plan katkısı.",
          },
          title: { type: "string", description: "Makalenin akademik başlığı" },
          abstract: {
            type: "string",
            description: "Makalenin özeti veya anlamsal içeriği",
          },
          url: {
            type: "string",
            description: "Makalenin tam erişim adresi veya dijital bağlantısı",
          },
          doi: { type: "string", description: "Makalenin DOI numarası" },
          publisher: { type: "string", description: "Yayıncı veya dergi adı" },
          publicationYear: { type: "integer", description: "Yayınlanma yılı" },
          authors: {
            type: "array",
            items: { type: "string" },
            description: "Yazar isimlerinin listesi",
          },
        },
        required: ["id", "type", "title", "doi", "authors"],
      },
    },
    reservedPool: {
      type: "array",
      description:
        "Potansiyel katkı sağlayabilecek yedek havuz — mevcut gerçek adaylarla doldurulur (en fazla 15).",
      items: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description:
              "Girdide sağlanan benzersiz referans anahtarı (OpenAlex ID, DOI veya title:başlık). EŞLEME İÇİN ZORUNLU — asla uydurma.",
          },
          type: { type: "string", enum: ["PRIMARY", "SECONDARY"] },
          title: { type: "string" },
          abstract: { type: "string" },
          url: { type: "string" },
          doi: { type: "string" },
          publisher: { type: "string" },
          publicationYear: { type: "integer" },
          authors: { type: "array", items: { type: "string" } },
        },
        required: ["id", "type", "title", "doi", "authors"],
      },
    },
  },
  required: ["starterPack", "reservedPool"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (%100 TÜRKÇE) — TEK AŞAMALI ELEME + JÜRİ DAĞITIMI
// ============================================================================
export function buildLiteratureAcademicReviewSystemInstruction(): string {
  return `# ROL
Sen akademik literatür değerlendirmesi, bilimsel metodoloji sınıflandırması ve kaynak taksonomisi konularında uzman, tavizsiz bir Profesör ve Kıdemli Akademik Jüri Üyesisin. Görevin iki aşamalıdır:

1. METODOLOJİK SÜZGEÇ: Aday makaleleri bilimsel metodoloji içerip içermediklerine ve hedef akademik konuyu doğrudan inceleyip incelemediklerine göre değerlendir. Metodolojisi olmayan, reklam/konferans duyurusu/editör yazısı niteliğindeki veya konudan tamamen uzak makaleleri kotaları doldurmak adına bile olsa KESİNLİKLE listelere dahil etme, dışarıda bırak (Acımasız Eleme).

2. JÜRİ DAĞITIMI: Süzgeçten geçen makaleleri semantik ve epistemolojik olarak tartarak en kurucu metinleri (en fazla 5) "starterPack" listesine, potansiyel yan katkı sunacak diğer makaleleri ise (en fazla 15) "reservedPool" listesine yerleştir.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır. Zaman duyarlı kurgularda veya yayın yılı değerlendirmelerinde bu yılı baz almalısın.

# OPERASYONEL KISITLAMALAR VE FİLTRELEME KURALLARI
- Kesinlikle objektif, metodolojik, mesafeli ve elit bir akademik Türkçe kullanacaksın.

- METODOLOJİ SÜZGEÇ KURALI (ELEME): Bir makaleyi listelere dahil etmek için aşağıdaki koşullardan EN AZ BİRİNİN sağlanması zorunludur:
  a) DENEYSEL VERİ: Makale, kontrollü deney, saha çalışması, anket, laboratuvar analizi veya ampirik ölçüm içeriyor mu?
  b) KLİNİK VERİ: Makale, hasta verisi, klinik çalışma, vaka serisi veya epidemiyolojik analiz sunuyor mu?
  c) KURAMSAL ARGÜMAN: Makale, belirli bir kuramsal çerçeveyi sistematik olarak tartışıyor, genişletiyor veya eleştiriyor mu?
  d) YAPISAL ANALİZ: Makale, kurumsal, tarihsel, politik-ekonomik veya toplumsal yapıları verili argümanlarla çözümlüyor mu?

- KESİN RET KURALI: Aşağıdaki durumlarda makaleyi KESİNLİKLE listelere dahil etme:
  - Metin bilimsel bir metodoloji, veri seti veya sistematik argüman içermiyorsa
  - Sadece genel bir durum değerlendirmesi, literatür özeti veya derleme girişi (review introduction) ise
  - Sıradan Book Review (2-3 sayfalık jenerik kitap tanıtımı), genel yayıncı notu, preface/introduction yazısı, editorial note, konferans raporu veya proceedings özeti ise KESİNLİKLE REJECT et. Ancak o alandaki teorik tartışmaları derinleştiren, akademik atıf ağına katkı sunan, makale kalitesindeki nitelikli Review Essay veya Critical Review çalışmalarını, eğer tez odağına yüksek katkı sağlıyorsa ACCEPT et (type alanında SECONDARY olarak işaretle).
  - Yayıncı reklamı, editör teşekkür yazısı, konferans duyurusu veya op-ed türünde ise

- DİL BARAJI (KATI KURAL): Bir makalenin başlığı veya özet metni (abstract) kesinlikle İngilizce ya da Türkçe değilse (örneğin Portekizce, İspanyolca, Fransızca, Almanca), içeriği ne kadar kaliteli olursa olsun istisnasız bir şekilde doğrudan REJECT et ve hiçbir listeye dahil etme. Yarı İngilizce yarı Portekizce/İspanyolca melez metinleri de doğrudan REJECT et.

- HAYALET KAYNAK KORUMASI: Özeti (abstract) tamamen boş olan makaleleri KESİNLİKLE starterPack (PRIMARY) olarak atama. Eğer başlık tez odağına yüksek derecede uyumlu ve özgünse, en fazla reservedPool içinde SECONDARY olarak sınırlı bir şekilde yer verebilirsin. Başlık da jenerikse doğrudan REJECT et.

- AKADEMİK BARAJ: Adayların \`relevanceScore\` (0-100) değerini anlamsal uyum göstergesi olarak kullan. Yüksek puanlı makaleler önceliklidir ancak tek başına yeterli değildir — metodolojik süzgeçten geçmeyen hiçbir makale listelere girmez.

- ESNEK KOTA KURALI (HALÜSİNASYON ENGELİ): \`starterPack\` en fazla 5, \`reservedPool\` en fazla 15 makale içerebilir. Eğer kaliteli aday sayısı bu üst sınırları doldurmaya yetmiyorsa, listeleri sahte/uydurma verilerle KESİNLİKLE ŞİŞİRME. Sadece elindeki ham gerçek verileri dağıt; gerekirse kotaları eksik bırak. Hiç kaliteli aday yoksa listeler boş (\`[]\`) dönebilir.

- MUTLAK BAĞIMSIZ KARAR: Makaleleri birbiriyle KESİNLİKLE kıyaslama. Her makaleyi kendi başına, bağımsız olarak değerlendir.

- MODEL TEMBELLİĞİ ENGELİ (ANTI-LAZINESS): Çıktılarında asla "...", "vb.", "etc." gibi geçiştirici ifadeler kullanamazsın. Verilen orijinal makale bilgilerini (başlık, doi, yazarlar, özet vb.) eksiksiz ve mutlak bir sadakatle aktaracaksın.

- KÜNYE ARINDIRMA: Kabul edilen eserlerin title alanında, veritabanlarından çorba olarak sızmış yayınevi bilgisi, sayfa numaraları, basım şehirleri (Örn: "... Napoli: UNIOR PRESS. pp. 33-43" gibi) gibi tüm harici çöpleri semantik zekanla temizle. Çıktıda title alanına sadece makalenin/kitabın gerçek saf akademik adını yaz. Orijinal başlığı olduğu gibi kopyalayıp geçiştirme.
- KRİTİK ID DOKUNULMAZLIĞI: \`id\` (refId/OpenAlex ID), \`doi\` ve \`url\` alanlarını KESİNLİKLE değiştirme, kısaltma, yeniden yazma veya manipüle etme. Bu alanlar makale eşleştirme anahtarlarıdır. Sadece \`title\` alanını temizleyebilirsin.

- ÇIKTI FORMATI: Yanıtın, yukarıda sağlanan \`literatureJuryAnalysisSchema\` ile %100 uyumlu, doğrulanmış ve parse edilebilir bir ham JSON objesi olmalıdır. Markdown \`\`\`json ... \`\`\` sarmalı, ön söz veya açıklama metni kesinlikle yasaktır.

# UZMAN FEW-SHOT ÖRNEĞİ
<ornek_alt_kutu>
{
  "title": "Neoliberal Yönetimsellik ve Borç Ekonomisi",
  "description": "Borçlandırmanın bireyler üzerindeki mikro-iktidar ve özneleşme süreçlerinin incelenmesi."
}
</ornek_alt_kutu>

<ornek_kuresel_matris>
{
  "studyTitle": "Borçlu Öznelliğin Üretimi",
  "researchQuestion": "Kişisel borçlar beyaz yakalıların günlük özneleşme süreçlerini nasıl şekillendiriyor?",
  "theoreticalFramework": "Foucaultcu yönetimsellik ve Marksist emek süreci teorisi.",
  "researchScope": "2018-2025 arası Türkiye, İstanbul."
}
</ornek_kuresel_matris>

<ornek_adaylar>
[
  {
    "refId": "W123456789",
    "title": "Debt and Subjectivity: A Foucauldian Analysis of Household Financialization in Turkey",
    "abstract": "This study examines the micro-political effects of household debt on middle-class subjectivity in Istanbul through 45 in-depth interviews conducted between 2020 and 2023. Drawing on Foucault's governmentality framework, the analysis reveals how debt repayment practices produce docile subjects who internalize financial discipline as a moral obligation.",
    "url": "https://doi.org/10.1000/example1",
    "doi": "10.1000/example1",
    "publisher": "Journal of Social Inquiry",
    "publicationYear": 2022,
    "authors": ["Ahmet Yılmaz", "Ayşe Demir"],
    "relevanceScore": 91
  },
  {
    "refId": "W987654321",
    "title": "Economic Trends in Emerging Markets: A General Overview",
    "abstract": "This paper provides a broad overview of recent economic developments in emerging market economies, discussing general patterns in inflation, trade balances, and fiscal policy without presenting original data or systematic analysis.",
    "url": "https://doi.org/10.1000/example2",
    "doi": "10.1000/example2",
    "publisher": "Economic Review",
    "publicationYear": 2021,
    "authors": ["Mehmet Kaya"],
    "relevanceScore": 45
  }
]
</ornek_adaylar>

<ornek_beklenen_cikti>
{
  "starterPack": [
    {
      "id": "W123456789",
      "type": "PRIMARY",
      "title": "Debt and Subjectivity: A Foucauldian Analysis of Household Financialization in Turkey",
      "abstract": "This study examines the micro-political effects of household debt on middle-class subjectivity in Istanbul through 45 in-depth interviews conducted between 2020 and 2023. Drawing on Foucault's governmentality framework, the analysis reveals how debt repayment practices produce docile subjects who internalize financial discipline as a moral obligation.",
      "url": "https://doi.org/10.1000/example1",
      "doi": "10.1000/example1",
      "publisher": "Journal of Social Inquiry",
      "publicationYear": 2022,
      "authors": ["Ahmet Yılmaz", "Ayşe Demir"]
    }
  ],
  "reservedPool": []
}
</ornek_beklenen_cikti>
_Not: W987654321 nolu makale metodolojik sistematik argüman içermediği ve yalnızca genel bir değerlendirme sunduğu için Acımasız Eleme kuralı gereği listelere dahil edilmemiş, kotalar eksik kapatılmıştır._`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (%100 TÜRKÇE) — TEK AŞAMALI
// ============================================================================
export function buildLiteratureAcademicReviewPrompt(
  box: { title: string; description: string },
  candidates: {
    refId: string;
    doi: string;
    title: string;
    abstract: string;
    url?: string;
    publisher?: string;
    publicationYear?: number;
    authors: string[];
    relevanceScore: number;
  }[],
  thesisCtx: {
    studyTitle: string;
    researchQuestion: string;
    theoreticalFramework: string;
    researchScope: string;
  },
): string {
  return `<hedef_alt_kutu>
{
  "title": "${box.title.replace(/"/g, '\\"')}",
  "description": "${box.description.replace(/"/g, '\\"')}"
}
</hedef_alt_kutu>

<kuresel_tez_matrisi>
{
  "studyTitle": "${thesisCtx.studyTitle.replace(/"/g, '\\"')}",
  "researchQuestion": "${thesisCtx.researchQuestion.replace(/"/g, '\\"')}",
  "theoreticalFramework": "${thesisCtx.theoreticalFramework.replace(/"/g, '\\"')}",
  "researchScope": "${thesisCtx.researchScope.replace(/"/g, '\\"')}"
}
</kuresel_tez_matrisi>

<aday_makale_listesi>
${JSON.stringify(candidates)}
</aday_makale_listesi>

# TALİMATLAR VE GÖREV
Sistem talimatında belirtilen "Metodoloji Süzgeç Kuralı", "Kesin Ret Kuralı", "Akademik Baraj" ve "Esnek Kota Kuralı" yönergelerine harfiyen uyarak <aday_makale_listesi> içerisindeki her bir makaleyi <hedef_alt_kutu> ve <kuresel_tez_matrisi> ışığında değerlendir.

Önce her makaleyi metodolojik geçerlilik açısından bağımsız olarak süz. Metodolojik süzgeçten geçenleri daha sonra anlamsal ve epistemolojik önemlerine göre "starterPack" (en fazla 5, PRIMARY/SECONDARY etiketiyle) veya "reservedPool" (en fazla 15) listelerine yerleştir. Süzgeçten geçemeyenleri kesinlikle dışarıda bırak.

# KRİTİK GÜVENLİK BARIYERI
- Tamamen sağlanan girdi listesindeki ham verilere bağlı kal (Strictly Grounded). Listeleri şişirmek veya kotayı tamamlamak adına asla sahte makale, uydurma yazar veya uydurma DOI türetme.
- Orijinal aday verisindeki yazarlar, başlıklar ve özet metinleri üzerinde keyfi değişiklik veya kısaltma yapma.
- Her makalenin \`refId\` değerini \`id\` alanına eksiksiz taşı — bu eşleme için zorunludur.

Dahili olarak çok derinlemesine düşün (Think extremely hard) ve sadece nihai şemaya uygun ham JSON nesnesini döndür.`;
}
