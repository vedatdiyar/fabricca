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
        required: ["type", "title", "doi", "authors"],
      },
    },
    reservedPool: {
      type: "array",
      description:
        "Potansiyel katkı sağlayabilecek yedek havuz — mevcut gerçek adaylarla doldurulur (en fazla 15).",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["PRIMARY", "SECONDARY"] },
          title: { type: "string" },
          abstract: { type: "string" },
          url: { type: "string" },
          doi: { type: "string" },
          publisher: { type: "string" },
          publicationYear: { type: "integer" },
          authors: { type: "array", items: { type: "string" } },
        },
        required: ["type", "title", "doi", "authors"],
      },
    },
  },
  required: ["starterPack", "reservedPool"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (%100 TÜRKÇE)
// ============================================================================
export function buildLiteratureJuryAnalysisSystemInstruction(): string {
  return `# ROL
Sen akademik literatür değerlendirmesi, kaynak taksonomisi ve bibliyografik hiyerarşi kurma konularında uzman, tavizsiz bir Profesör ve Kıdemli Akademik Jüri Üyesisin. Görevin, süzgeçten geçmiş makale adaylarını semantik ve epistemolojik olarak tartarak, en kurucu metinleri (en fazla 5) "starterPack" listesine, potansiyel yan katkı sunacak diğer makaleleri ise (en fazla 15) "reservedPool" listesine yerleştirmektir.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır. Zaman duyarlı kurgularda veya yayın yılı değerlendirmelerinde bu yılı baz almalısın.

# OPERASYONEL KISITLAMALAR VE FİLTRELEME KURALLARI
- Kesinlikle objektif, metodolojik, mesafeli ve elit bir akademik Türkçe kullanacaksın.
- AKADEMİK BARAJ PUANI VE KATI ELEME: Adayların \`siftingScore\` değerlerini amansız bir baraj filtresi olarak kullan. \`siftingScore\` değeri 85 ve üzerinde olan kurucu, doğrudan odağa hitap eden makaleleri önem sırasına göre "starterPack" listesine yerleştir. \`siftingScore\` değeri 75 ile 84 arasında olan ya da starterPack kotasına sığmayan kaliteli kaynakları "reservedPool" listesine al. \`siftingScore\` değeri 75'in altında olan tüm zayıf veya çeper makaleleri —kotaları doldurmak adına bile olsa— KESİNLİKLE listelere dahil etme, acımasızca dışarıda bırak.
- ESNEK KOTA KURALI (HALÜSİNASYON ENGELİ): \`starterPack\` en fazla 5, \`reservedPool\` en fazla 15 makale içerebilir. Eğer sifting aşamasından gelen kaliteli aday sayısı bu üst sınırları doldurmaya yetmiyorsa, listeleri sahte/uydurma verilerle KESİNLİKLE ŞİŞİRME. Sadece elindeki ham gerçek verileri dağıt; gerekirse kotaları eksik bırak. Hiç kaliteli aday yoksa listeler boş (\`[]\`) dönebilir.
- MODEL TEMBELLİĞİ ENGELİ (ANTI-LAZINESS): Çıktılarında asla "...", "vb.", "etc." gibi geçiştirici ifadeler kullanamazsın. Verilen orijinal makale bilgilerini (başlık, doi, yazarlar, özet vb.) eksiksiz ve mutlak bir sadakatle aktaracaksın.
- ÇIKTI FORMATI: Yanıtın, yukarıda sağlanan \`literatureJuryAnalysisSchema\` ile %100 uyumlu, doğrulanmış ve parse edilebilir bir ham JSON objesi olmalıdır. Markdown \`\`\`json ... \`\`\` sarmalı, ön söz veya açıklama metni kesinlikle yasaktır.

# UZMAN FEW-SHOT ÖRNEĞİ
<ornek_girdi_kutusu>
{
  "title": "Neoliberal Yönetimsellik ve Borç Ekonomisi",
  "description": "Borçlandırmanın bireyler üzerindeki mikro-iktidar ve özneleşme süreçlerinin incelenmesi."
}
</ornek_girdi_kutusu>

<ornek_adaylar>
[
  {
    "doi": "10.1080/neolib.112",
    "title": "Borcun Öznesi: Finansal Kapitalizmde Yönetimsellik",
    "abstract": "Bu çalışma Foucault'nun yönetimsellik analizi ile finansal borç yapılarını kesiştirerek bireysel özneleşme süreçlerini haritalandırmaktadır...",
    "authors": ["Ahmet Yılmaz", "Ayşe Demir"],
    "publicationYear": 2022,
    "publisher": "Akademik Yayıncılık",
    "siftingScore": 92
  },
  {
    "doi": "10.1016/j.soc.2019",
    "title": "Avrupa'da Bankacılık Düzenlemelerinin Kısa Tarihi",
    "abstract": "Avrupa Birliği bölgesindeki kurumsal bankacılık politikaları ve makro düzenleme parametrelerinin 1990-2010 yılları arasındaki genel bir incelemesi...",
    "authors": ["Mehmet Kaya"],
    "publicationYear": 2020,
    "publisher": "Ekin Yayınları",
    "siftingScore": 64
  }
]
</ornek_adaylar>

<ornek_beklenen_cikti>
{
  "starterPack": [
    {
      "type": "PRIMARY",
      "title": "Borcun Öznesi: Finansal Kapitalizmde Yönetimsellik",
      "abstract": "Bu çalışma Foucault'nun yönetimsellik analizi ile finansal borç yapılarını kesiştirerek bireysel özneleşme süreçlerini haritalandırmaktadır...",
      "url": "https://doi.org/10.1080/neolib.112",
      "doi": "10.1080/neolib.112",
      "publisher": "Akademik Yayıncılık",
      "publicationYear": 2022,
      "authors": ["Ahmet Yılmaz", "Ayşe Demir"]
    }
  ],
  "reservedPool": []
}
</ornek_beklenen_cikti>
_Not: 10.1016/j.soc.2019 doi'li makale siftingScore'u 64 olduğu ve barajın altında kaldığı için listeye dahil edilmemiş, sahte veri üretilmemiş, havuzlar esnek şekilde kapatılmıştır._`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (%100 TÜRKÇE)
// ============================================================================
export function buildLiteratureJuryAnalysisPrompt(
  box: { title: string; description: string },
  siftedCandidates: {
    doi: string;
    title: string;
    abstract: string;
    url?: string;
    publisher?: string;
    publicationYear?: number;
    authors: string[];
    siftingScore?: number;
  }[],
): string {
  return `<hedef_alt_kutu>
{
  "title": "${box.title.replace(/"/g, '\\"')}",
  "description": "${box.description.replace(/"/g, '\\"')}"
}
</hedef_alt_kutu>

<suzulen_adaylar>
${JSON.stringify(siftedCandidates)}
</suzulen_adaylar>

# TALİMATLAR VE GÖREV
Sistem talimatında belirtilen "AKADEMİK BARAJ PUANI" ve "ESNEK KOTA KURALI" yönergelerine harfiyen uyarak, <suzulen_adaylar> listesini analiz et. \`siftingScore\` barajlarına göre makaleleri ayıkla, hiyerarşik önem sırasına diz ve <hedef_alt_kutu> omurgasını besleyecek şekilde "starterPack" ve "reservedPool" dizilerine kusursuz bir bibliyografik sadakatle yerleştir.

# KRİTİK GÜVENLİK BARIYERI
- Tamamen sağlanan gerçek veri kümesine bağlı kal (Strictly Grounded). Listeleri şişirmek veya kotayı tamamlamak adına asla sahte makale, uydurma yazar veya uydurma DOI türetme.
- Orijinal aday verisindeki yazarlar, başlıklar ve özet metinleri üzerinde keyfi değişiklik veya kısaltma yapma. Yanıt dilinin tamamen Türkçe kurallarına uygun, temiz veri formatında olmasını sağla.

Dahili olarak çok derinlemesine düşün (Think extremely hard) ve sadece nihai şemaya uygun ham JSON nesnesini döndür.`;
}
