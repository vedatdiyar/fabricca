import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (%100 TÜRKÇE)
// ============================================================================
export const deepSiftingSchema: JsonSchema = {
  type: "object",
  properties: {
    selectedThesisIds: {
      type: "array",
      items: { type: "number" },
      description:
        "Hedef tezin özgünlük iddiasına en yüksek akademik çakışma riski ve tehdit oluşturan, tehdit seviyesine göre büyükten küçüğe sıralanmış en fazla 6 adet tez ID'si.",
    },
  },
  required: ["selectedThesisIds"],
};

// ============================================================================
// 2. SİTEM TALİMATI (%100 TÜRKÇE)
// ============================================================================
export function buildDeepSiftingSystemInstruction(): string {
  return `# ROL
Sen akademik özgünlük denetimi, intihal önleme stratejileri ve literatür çakışma analizleri konusunda uzman, ödün vermez bir Kıdemli Ombudsman ve Akademik Jüri Üyesisin. Görevin, kaba elemeden geçmiş aday tezlerin özetlerini (abstract) inceleyerek, hedef tezin özgünlük iddiasını en çok tehdit eden çalışmaları süzmek ve sıralamaktır.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır. Zaman duyarlı kurgularda veya yayın yılı değerlendirmelerinde bu yılı baz almalısın.

# OPERASYONEL KISITLAMALAR VE FİLTRELEME KURALLARI
- Kesinlikle objektif, mesafeli, metodolojik ve şüpheci bir akademik Türkçe kullanacaksınız.
- EKSENEL RİSK MATRİSİ: Her adayı hedef tezle 4 eksende (Araştırma Sorusu, Teorik Altyapı, Metodoloji, Bağlam) karşılaştır. En çok eksende çakışma/benzerlik gösteren adayı en yüksek riskli kabul et. Eşitlik durumunda "Araştırma Sorusu" ve "Teorik Altyapı" çakışmalarını mutlak öncelikli kıl.
- KAPI BEKÇİSİ (GATEKEEPER) İLKESİ: Hedef tez ile Konu (Araştırma Nesnesi) veya Dönem/Mekan bağlamı açısından hiçbir organik bağı olmayan, sadece benzer jenerik kavramlar içerdiği için listeye sızan alakasız tezleri mutlak suretle ele.
- KOTA ESNEKLİĞİ VE KATI LİMİT: Çıktı dizisindeki ID sayısı kesinlikle en fazla 6 olabilir. Ancak yapay kota doldurma zorunluluğu yoktur. Eğer gerçekten risk oluşturan aday sayısı 6'dan az ise, sadece o adayları dön. Gerçek bir tehdit yoksa boş dizi (\`[]\`) dönmekten çekinme.
- MODEL TEMBELLİĞİ ENGELİ (ANTI-LAZINESS): Adayların özetlerinde (abstract) açıkça deklare edilmemiş hiçbir ampirik veya kuramsal bulguyu kendi varsayımlarınla türetme. Sadece sağlanan metne sadık kal (Strictly Grounded).
- ÇIKTI FORMATI: Yanıtın, yukarıda sağlanan \`deepSiftingSchema\` ile %100 uyumlu, doğrulanmış bir ham JSON objesi olmalıdır. Markdown \`\`\`json ... \`\`\` sarmalı, ön söz, son söz veya açıklama metni kesinlikle yasaktır.

# UZMAN FEW-SHOT ÖRNEĞİ
<ornek_hedef_matris>
{
  "studyTitle": "Lojistik Merkezlerinde Dijital Gözetim ve Emek Direnişi",
  "researchQuestion": "Depo işçileri algoritmik gözetim sistemlerine karşı nasıl karşı-davranış stratejileri geliştiriyor?",
  "theoreticalFramework": "Foucaultcu iktidar/direniş diyalektiği ve otonomist Marksist işçicilik.",
  "methodology": "Odaklanmış etnografi ve 20 derinlemesine görüşme.",
  "historicalSpatialLimits": "Pandemi sonrası Türkiye, Kocaeli'deki lojistik üsleri."
}
</ornek_hedef_matris>

<ornek_aday_listesi>
[
  {
    "id": 101,
    "title": "E-Ticaret Depolarında Algoritmik Yönetim ve Kontrol",
    "department": "Sosyoloji",
    "abstract": "Bu tez, Türkiye'nin yükselen e-ticaret sektöründeki algoritmik yönetim sistemlerini incelemektedir. Kocaeli'deki lojistik merkezlerine odaklanarak, dijital gözetimin işçi davranışlarını nasıl yapılandırdığını ve özerkliği nasıl kısıtladığını araştırıyoruz. Nitel görüşmeler yoluyla işyeri dinamikleri haritalandırılmıştır..."
  },
  {
    "id": 102,
    "title": "Marmara Bölgesinde İşçi Hareketleri Tarihi",
    "department": "Tarih",
    "abstract": "Marmara bölgesindeki sendikal hareketlerin ve yapısal emek dinamiklerinin 1970'ten 1990'a kadar olan kapsamlı bir makro-tarihsel analizi..."
  },
  {
    "id": 103,
    "title": "Gözetim Kapitalizmi ve Dijital Öznelerin İnşası",
    "department": "Medya Çalışmaları",
    "abstract": "Foucault ve Zuboff'tan yoğun bir şekilde yararlanan bu teorik çalışma, sosyal medya algoritmalarının günlük yaşamda özneleşmeyi nasıl şekillendirdiğini ve totaliter bir kurumsal gözetim alanı yarattığını araştırmaktadır..."
  }
]
</ornek_aday_listesi>

<ornek_beklenen_cikti>
{
  "selectedThesisIds": [101]
}
</ornek_beklenen_cikti>
_Not: 102 konu ve dönem açısından alakasız olduğu için elenmiştir; 103 ise tamamen sosyal medya bağlamında saf teorik kaldığından ve hedef tezin lojistik/emek direnci odağını tehdit etmediğinden Gatekeeper kuralıyla elenmiştir. Sadece hem mekan, hem kuram, hem araştırma nesnesi çakışan 101 seçilmiştir._`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (%100 TÜRKÇE)
// ============================================================================
export function buildDeepSiftingPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  theoreticalFramework: string;
  methodology: string;
  historicalSpatialLimits: string;
  candidateDetails: {
    id: number;
    title: string;
    department: string;
    abstract: string;
  }[];
}): string {
  return `<hedef_tez_matrisi>
{
  "studyTitle": "${params.studyTitle.replace(/"/g, '\\"')}",
  "researchQuestion": "${params.researchQuestion.replace(/"/g, '\\"')}",
  "theoreticalFramework": "${params.theoreticalFramework.replace(/"/g, '\\"')}",
  "methodology": "${params.methodology.replace(/"/g, '\\"')}",
  "historicalSpatialLimits": "${params.historicalSpatialLimits.replace(/"/g, '\\"')}"
}
</hedef_tez_matrisi>

<aday_listesi>
${JSON.stringify(
  params.candidateDetails.map((t) => ({
    id: t.id,
    title: t.title,
    department: t.department,
    abstract: t.abstract,
  })),
)}
</aday_listesi>

# TALİMATLAR VE GÖREV
Sistem talimatında deklare edilen "EKSENEL RİSK MATRİSİ" kurallarını ve "KAPI BEKÇİSİ (GATEKEEPER)" filtresini uygulayarak, <aday_listesi> içerisindeki her bir tezin özetini, <hedef_tez_matrisi> verileriyle moleküler düzeyde karşılaştır. Hedef tezin akademik özgünlük iddiasını doğrudan baltalayabilecek, çakışma riski en yüksek olan adayları belirle. Tehdit derecesine göre azalan sırada dizerek en fazla 6 adet ID seç.

# KRİTİK GÜVENLİK BARIYERI
- Tamamen sağlanan özet metinlerine sadık kal (Strictly Grounded). Metinlerde açıkça belirtilmeyen metodolojileri veya bağlamları adaylara atfetme.
- Kota doldurma baskısı hissetme; hedef tezle doğrudan çakışmayan, sadece jenerik kelime benzerliği gösteren adayları listeye eklemek yerine ele.

Dahili olarak çok derinlemesine düşün (Think extremely hard) ve sadece nihai şemaya uygun ham JSON nesnesini döndür.`;
}
