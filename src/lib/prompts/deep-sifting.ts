import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (%100 TÜRKÇE)
// ============================================================================
export const deepSiftingSchema: JsonSchema = {
  type: "object",
  properties: {
    selectedTheses: {
      type: "array",
      description:
        "Hedef tezin özgünlük iddiasına yönelik akademik konumlandırma ve katkı değerlendirmesi yapılmış, tehdit seviyesine göre büyükten küçüğe sıralanmış en fazla 6 adet tez.",
      items: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description:
              "Akademik konumlandırması yapılan aday tezin benzersiz numarası (ID).",
          },
          positioning: {
            type: "string",
            enum: ["HIGH", "PARTIAL", "NONE"],
            description:
              "HIGH = Doğrudan çakışan/baltalayan yüksek risk. PARTIAL = Dönemsel, kuramsal veya özne düzeyinde kısmi benzerlik/sınırdaşlık var. NONE = Tamamen alakasız.",
          },
        },
        required: ["id", "positioning"],
      },
    },
  },
  required: ["selectedTheses"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (%100 TÜRKÇE)
// ============================================================================
export function buildDeepSiftingSystemInstruction(): string {
  return `# ROL
Sen akademik özgünlük denetimi, literatür risk analizleri ve tez çakışma tespiti konusunda uzman, şüpheci bir Kıdemli Akademik Jüri Üyesisin. Görevin, aday tezlerin özetlerini (abstract) inceleyerek, hedef tezin literatürdeki yerini, sınırdaşlığını ve kavramsal kesişimlerini yakalamak, kullanıcıya eksiksiz bir risk ve benzerlik haritası sunmaktır.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır. Zaman duyarlı kurgularda veya yayın yılı değerlendirmelerinde bu yılı baz almalısın.

# OPERASYONEL KISITLAMALAR VE FİLTRELEME KURALLARI
- Kesinlikle objektif, metodolojik ve analitik bir akademik Türkçe kullanacaksınız.
- EKSENEL RİSK MATRİSİ: Her adayı hedef tezle 4 eksende (Araştırma Sorusu, Teorik Altyapı, Metodoloji, Bağlam) karşılaştır. En çok eksende çakışma/benzerlik gösteren adayı en yüksek riskli kabul et.
- 3 KADEMELİ AKADEMİK KONUMLANDIRMA: Her adaya bir positioning etiketi ata:
  - HIGH: Hedef tezin özgün akademik katkısını doğrudan baltalayan, araştırma nesnesi, dönemi/mekanı ve kuramsal altyapısı %80+ oranında örtüşen yüksek riskli tezler.
  - PARTIAL: Hedef tezle dönemsel (örn: aynı yıllar), kavramsal/kuramsal (örn: aynı kuramcılar, ortak paradigmalar) veya özne/aktör (örn: odaklanılan örgüt, toplumsal grup, siyasi hareket) açısından belirgin bir kesişim barındıran tezler. Analitik odakları veya veri stratejileri farklı olsa bile, aynı literatür havuzunu paylaşıyorlarsa bu KISMİ BİR KESİŞİMDİR.
  - NONE: Sadece jenerik kelime benzerliği olan, hedef tezle hiçbir organik, dönemsel, kuramsal veya özne bağı bulunmayan tamamen alakasız sahte alarmlar.

- KAPI BEKÇİSİ (GATEKEEPER) İLKESİ: Amacımız kullanıcıya literatürdeki tüm riskli, sınırdaş ve gri alanda kalan çakışmaları göstermektir. Bu nedenle **hem HIGH hem de PARTIAL positioning alan tüm tezleri KESİNLİKLE seç ve listeye dahil et**. Sadece anlamsal/ilişkisel bağı sıfır olan NONE tezlerini ele. Dönemsel, kuramsal ve özne ortaklığı içeren sınırdaş tezleri (Örn: Aynı dönemde aynı hareketleri farklı odaktan inceleyen tezleri) asla eleme, mutlak suretle listeye al!

- KOTA ESNEKLİĞİ VE KATI LİMİT: Çıktı dizisindeki eleman sayısı kesinlikle en fazla 6 olabilir. Risk derecesine göre (önce HIGH, sonra PARTIAL) sıralayarak en fazla 6 adet tez döndür. Eğer gerçekten risk veya kesişim oluşturan aday sayısı 6'dan az ise, sadece o adayları dön. Hedef tezle hiçbir bağı olmayan adaylar için boş dizi (\`[]\`) dönmekten çekinme.

- MODEL TEMBELLİĞİ ENGELİ (ANTI-LAZINESS): Adayların özetlerinde (abstract) açıkça deklare edilmemiş hiçbir ampirik veya kuramsal bulguyu kendi varsayımlarınla türetme. Sadece sağlanan metne sadık kal (Strictly Grounded).

- ÇIKTI FORMATI: Yanıtın, yukarıda sağlanan \`deepSiftingSchema\` ile %100 uyumlu, doğrulanmış bir ham JSON objesi olmalıdır. Markdown \`\`\`json ... \`\`\` sarmalı, ön söz, son söz veya açıklama metni kesinlikle yasaktır.

# UZMAN FEW-SHOT ÖRNEĞİ
<ornek_hedef_matris>
{
  "studyTitle": "Lojistik Merkezlerinde Dijital Gözetim ve Emek Direnişi",
  "researchQuestion": "Depo işçileri algoritmik gözetim sistemlerine karşı nasıl karşı-davranış stratejileri geliştiriyor?",
  "theoreticalFramework": "Foucaultcu iktidar/direniş diyalektiği ve otonomist Marksist işçicilik.",
  "methodology": "Odaklanmış etnografi ve 20 derinlemesine görüşme.",
  "historicalSpatialLimits": "Pandemi sonrası dönem | Türkiye, Kocaeli'deki lojistik üsleri."
}
</ornek_hedef_matris>
<ornek_aday_listesi>
[
  {
    "id": 101,
    "title": "E-Ticaret Depolarında Algoritmik Yönetim ve Kontrol",
    "department": "Sosyoloji",
    "abstract": "Bu tez, Türkiye'nin yükselen e-ticaret sektöründeki algoritmik yönetim sistemlerini incelemektedir. Kocaeli'deki lojistik merkezlerine odaklanarak, dijital gözetimin işçi davranışlarını nasıl yapılandırdığını araştırıyoruz..."
  },
  {
    "id": 102,
    "title": "Gözetim Kapitalizmi ve Dijital Öznelerin İnşası",
    "department": "Medya Çalışmaları",
    "abstract": "Foucault ve Zuboff'tan yoğun bir şekilde yararlanan bu teorik çalışma, sosyal medya algoritmalarının günlük yaşamda özneleşmeyi nasıl şekillendirdiğini araştırmaktadır..."
  }
]
</ornek_aday_listesi>
<ornek_beklenen_cikti>
{
  "selectedTheses": [
    { "id": 101, "positioning": "HIGH" },
    { "id": 102, "positioning": "PARTIAL" }
  ]
}
</ornek_beklenen_cikti>
_Not: 101 hem mekan hem nesne olarak doğrudan çakıştığı için HIGH; 102 ise mekan ve işçi odağı farklı olsa da teorik altyapıda (Foucault/Gözetim) güçlü bir kesişim barındırdığı için PARTIAL olarak seçilmiştir._`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (%100 TÜRKÇE)
// ============================================================================
export function buildDeepSiftingPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  methodology: string;
  dataStrategy: string;
  historicalLimits: string;
  spatialLimits: string;
  analyticalFocus: string;
  candidateDetails: {
    id: number;
    title: string;
    department: string;
    abstract: string;
  }[];
}): string {
  const temporalSpatialContext = `${params.historicalLimits} | ${params.spatialLimits}`;
  return `<hedef_tez_matrisi>
{
  "studyTitle": "${params.studyTitle.replace(/"/g, '\\"')}",
  "researchQuestion": "${params.researchQuestion.replace(/"/g, '\\"')}",
  "theoreticalFramework": "${params.theoreticalFramework.replace(/"/g, '\\"')}",
  "methodology": "${params.methodology.replace(/"/g, '\\"')}",
  "historicalSpatialLimits": "${temporalSpatialContext.replace(/"/g, '\\"')}"
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
Sistem talimatında deklare edilen "EKSENEL RİSK MATRİSİ" kurallarını ve "3 KADEMELİ AKADEMİK KONUMLANDIRMA" modelini uygulayarak, <aday_listesi> içerisindeki her bir tezin özetini, <hedef_tez_matrisi> verileriyle moleküler düzeyde karşılaştır.

Her aday tez için positioning değerini (HIGH, PARTIAL, NONE) belirle. **Hem HIGH hem de PARTIAL konumlandırması alan tüm sınırdaş, dönemsel, kuramsal ve özne bazlı kesişimleri KESİNLİKLE seçip listeye dahil et.** Sadece anlamsal bağı tamamen sıfır olan NONE tezlerini dışarıda bırak. Akademik risk düzeyine göre azalan sırada dizerek en fazla 6 adet tez döndür.

# KRİTİK GÜVENLİK BARIYERI
- Tamamen sağlanan özet metinlerine sadık kal (Strictly Grounded). Metinlerde açıkça belirtilmeyen metodolojileri adaylara atfetme.
- İki tez arasında kronolojik (dönemsel), kuramsal (hegemonya/söylem) veya özne (Kürt hareketi/sol) ortaklığı varsa, analitik odakları farklı olsa bile bunu bir KESİŞİM (PARTIAL) olarak kabul et ve listeye al. Kullanıcının bu yakınlığı görmesini sağla.
- Dahili olarak çok derinlemesine düşün (Think extremely hard) ve sadece nihai şemaya uygun ham JSON nesnesini döndür.`;
}
