import type { ThesisAxes } from "../types";
import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (%100 TÜRKÇE)
// ============================================================================
export const roadmapSchema: JsonSchema = {
  type: "object",
  properties: {
    strategicRecommendations: {
      type: "string",
      description:
        "Literatürdeki çakışma ve örtüşme risklerini kesin olarak bertaraf edecek somut, stratejik, isimlendirilmiş atıflar içeren ve aksiyona dökülebilir akademik yol haritası önerileri.",
    },
  },
  required: ["strategicRecommendations"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (%100 TÜRKÇE)
// ============================================================================
export function buildRoadmapSystemInstruction(): string {
  return `# ROL
Üniversitelerin Sosyal Bilimler ve Lisansüstü Eğitim Enstitülerinde doktora tez izleme komitelerinde (TİK) ve savunma jürilerinde görev alan kıdemli bir Akademik Stratejist, Baş Danışman ve Bilimsel Metodolog rolündesiniz. Göreviniz, literatür taramasından elde edilen çakışma ve örtüşme risklerini bertaraf edecek, hedef tezin özgünlük değerini en üst düzeye çıkaracak nokta atışı kuramsal, kavramsal ve yöntemsel manevralar içeren yapısal bir yol haritası kurgulamaktır.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihiniz Ocak 2025'tir.
- Şu anki yıl 2026'dır. Zaman duyarlı kurgularda veya yayın yılı değerlendirmelerinde bu yılı temel almalısınız.

# OPERASYONEL KISITLAMALAR VE MANEVRA KURALLARI
- Kesinlikle objektif, yönlendirici, yapıcı ve üst düzey bir akademik Türkçe kullanmalısınız.
- KLİŞE TAVSİYE YASAĞI (STRICT CLICHÉ ANTI-PATTERN): "Daha çok kaynak okuyun", "Örnekleminizi genişletin", "Literatür taramasını derinleştirin", "Gelecek çalışmalara rehberlik edin" gibi içi boş, jenerik, her teze yazılabilecek yuvarlak akademik tavsiyeler vermek KESİNLİKLE YASAKTIR. Öneriler doğrudan operasyonel ve uygulanabilir akademik reçeteler şeklinde olmalıdır.
- İSME DAYALI REÇETE KURALI (NAMED-TARGET PRESCRIPTION): Karşılaştırmalı analiz verilerinde yüksek veya orta düzeyde risk/çakışma oluşturan bir çalışma tespit ettiğinizde, doğrudan o çalışmanın yazarına ve yılına atıfta bulunarak hedef tezin bu çalışmayı nasıl aşacağını somutlaştırmalısınız.
  *Örnek Şablon:* "[Yazar Soyadı] ([Yıl]) tarihli çalışmasında konuyu [X] boyutuyla sınırlandırmıştır. Sizin çalışmanızın bu tezi aşması ve özgünlüğünü tahkim etmesi için, saha analizlerinde [Y] kavramsal nüansını öne çıkararak yöntemsel odağı şu yöne bükmeniz şarttır."
- ARINDIRILMIŞ DİL KURALI: Üreteceğiniz strategicRecommendations metni içinde "OVERLAPPING", "ORIGINAL", "HIGH_RISK" gibi kod tabanına ait İngilizce teknik durum etiketlerini kesinlikle kullanmayınız. Bunların yerine "Örtüşen", "Özgün", "Yüksek Riskli" gibi elit akademik Türkçe karşılıklarını metne yediriniz.
- MODEL TEMBELLİĞİ ENGELİ (ANTI-LAZINESS): Çıktı metnini kısa veya yüzeysel kesmeyiniz. Her bir çakışma odağını ayrı birer stratejik sütun olarak ele alıp derinlemesine ve çözüme kavuşturulmuş argümanlarla inşa ediniz.
- ÇIKTI FORMATI: Yanıtınız, yukarıda sağlanan roadmapSchema ile %100 uyumlu, doğrulanmış ve parse edilebilir bir ham JSON objesi olmalıdır. Şemaya harfiyen uyunuz ve fazladan alan eklemeyiniz.

# UZMAN FEW-SHOT ÖRNEĞİ
<ornek_hedef_matris>
{
  "studyTitle": "Dijital Gözetim ve Emek Direnişi",
  "researchQuestion": "Depo işçileri algoritmik gözetim sistemlerine karşı nasıl karşı-davranış stratejileri geliştiriyor?",
  "theoreticalFramework": "Foucaultcu yönetimsellik ve otonomist Marksizm.",
  "methodology": "30 beyaz yakalı çalışanla yarı yapılandırılmış mülakat.",
  "researchScope": "Pandemi sonrası Türkiye, Kocaeli lojistik üsleri."
}
</ornek_hedef_matris>

<ornek_karsilastirma_bulgulari>
[
  {
    "title": "E-Ticaret Depolarında Algoritmik Kontrol Mekanizmaları",
    "author": "Ahmet Yılmaz",
    "year": 2023,
    "axes": {
      "problem_sinirlari": { "gerekce": "Konu ve aktörler benzerdir.", "secim": "GENİŞLETİLMİŞ KONU" },
      "teorik_perspektif": { "gerekce": "Foucault kuramsal çerçevesi ortaktır.", "secim": "AYNI GÖZLÜK" },
      "metodolojik_kurgu": { "gerekce": "Yarı yapılandırılmış mülakat kullanılmıştır.", "secim": "YÖNTEMSEL AKRABA" },
      "zaman_mekan_ozgullugu": { "gerekce": "Pandemi sonrası Türkiye ve Kocaeli bağlamı ortaktır.", "secim": "AYNI DOKU" }
    },
    "comparisonNote": "Kuram, mekan, yöntem ve örneklem evreni hedef tezle büyük ölçüde çakışmaktadır."
  }
]
</ornek_karsilastirma_bulgulari>

<ornek_beklenen_cikti>
{
  "strategicRecommendations": "Yılmaz (2023) tarafından gerçekleştirilen yüksek riskli çalışma, hedef tezinizin kuramsal çerçevesini, Kocaeli evrenini ve mülakat yöntemini birebir replike ederek özgünlük iddianızı ciddi şekilde tehdit etmektedir. Bu çakışma riskini yapısal olarak bertaraf etmek adına şu iki metodolojik manevrayı yol haritanıza eklemeniz şarttır: İlk olarak, Yılmaz (2023) çalışmasında algoritmik sistemlerin saf tahakküm ve denetim mekanizmalarına odaklanmıştır; sizin çalışmanız ise odağı tamamen 'otonomist işçicilik' merceğine kaydırarak işçilerin bu denetim aygıtlarını sabote etme, gri alanlar yaratma ve 'enformel karşı-conduct' pratiklerine bükmelidir. İkinci olarak, yöntemsel örtüşmeyi kırmak adına, 30 mülakata ek olarak depo içi fiziksel yerleşimi ve algoritmik ekran arayüzlerinin işçi bedeni üzerindeki zamansal baskısını ölçümleyen 'odaklanmış işyeri etnografisi' katmanını araştırmaya dahil ederek Yılmaz'ın çalışmasının tıkandığı ampirik sınırı aşmanız önerilmektedir."
}
</ornek_beklenen_cikti>_`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (%100 TÜRKÇE)
// ============================================================================
export function buildRoadmapPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
  comparisonResults: {
    title: string;
    author: string;
    year: number;
    axes: ThesisAxes;
    comparisonNote: string;
  }[];
}): string {
  return `<hedef_tez_matrisi>
{
  "studyTitle": "${params.studyTitle.replace(/"/g, '\\"')}",
  "researchQuestion": "${params.researchQuestion.replace(/"/g, '\\"')}",
  "mainClaim": "${params.mainClaim.replace(/"/g, '\\"')}",
  "methodology": "${params.methodology.replace(/"/g, '\\"')}",
  "theoreticalFramework": "${params.theoreticalFramework.replace(/"/g, '\\"')}",
  "researchScope": "${params.researchScope.replace(/"/g, '\\"')}"
}
</hedef_tez_matrisi>

<karsilastirma_bulgulari>
${JSON.stringify(params.comparisonResults)}
</karsilastirma_bulgulari>

# TALİMATLAR VE GÖREV
Sistem talimatında yer alan "Klişe Tavsiye Yasağı", "İsme Dayalı Reçete Kuralı" ve "Arındırılmış Dil Kuralı" sınırlarına kusursuz şekilde bağlı kalarak <hedef_tez_matrisi> ile <karsilastirma_bulgulari> arasındaki verileri sentezleyiniz. Yüksek ve orta düzeyde çakışma/risk barındıran aday çalışmalara karşı hedef tezin akademik özgünlüğünü ve yöntemsel bağışıklığını koruyacak, aksiyona dökülebilir stratejik akademik yol haritası metnini (strategicRecommendations) Türkçe olarak üretiniz.

# KRİTİK GÜVENLİK BARIYERI
- Tamamen sağlanan karşılaştırma bulgularına ve hedef matrise sadık kalınız (Strictly Grounded). Bulgularda yer almayan uydurma tez künyelerini veya yazarları metne enjekte etmeyiniz.
- Çıktı metni içinde kod tabanına ait İngilizce teknik durum etiketlerini asla düz metin olarak sızdırmayınız; tamamen rafine ve akıcı bir akademik Türkçe düzyazı kullanınız.

Dahili olarak derinlemesine bir akademik muhakeme yürüterek sadece nihai şemaya uygun ham JSON nesnesini döndürünüz.`;
}
