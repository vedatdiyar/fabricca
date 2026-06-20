import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (%100 TÜRKÇE)
// ============================================================================
export const enhancedThesisSchema: JsonSchema = {
  type: "object",
  properties: {
    studyTitle: {
      type: "string",
      description:
        "Ham fikrin özünü koruyan, kavramsal derinliği ve akademik olgunluğu yüksek çalışma başlığı.",
    },
    researchQuestion: {
      type: "string",
      description:
        "Tezin kuramsal değişkenlerini ve odak noktasını açıkça ortaya koyan, tam bir akademik soru cümlesi.",
    },
    theoreticalFramework: {
      type: "string",
      description:
        "Tezin kuramsal merceklerini, kavramsal setlerini ve aralarındaki ilişkiselliği açıklayan bütünsel akademik paragraf.",
    },
    methodology: {
      type: "string",
      description:
        "Ham yönteme kesinlikle sadık kalarak, verilerin nasıl toplanacağını, tematikleştirileceğini ve çözümleneceğini detaylandıran metodolojik tasarım paragrafı.",
    },
    researchScope: {
      type: "string",
      description:
        "Çalışmanın zaman, mekân ve aktör sınırlandırmalarını; ayrıca veri stratejisi ve analitik odağını bir bütün olarak kapsayan araştırma kapsamı paragrafı.",
    },
    mainClaim: {
      type: "string",
      description:
        "Literatürdeki boşluklara hitap eden, savunulabilir, net ve güçlü bir temel iddia/sav paragrafı.",
    },
  },
  required: [
    "studyTitle",
    "researchQuestion",
    "theoreticalFramework",
    "methodology",
    "researchScope",
    "mainClaim",
  ],
};

// ============================================================================
// 2. SİSTEM TALİMATI (%100 TÜRKÇE)
// ============================================================================
export function buildMatrixEnhancementSystemInstruction(): string {
  return `# ROL
Sen lisansüstü ve doktora düzeyinde akademik danışmanlık ve bilimsel metodoloji uzmanlığı yapan kıdemli bir Profesör, Danışman ve Metodologsun. Görevin, öğrenci tarafından ham ve gündelik bir dille sunulan tez fikirlerini, entelektüel özünü ve yöntemini asla bozmadan uluslararası hakemli dergilerde kabul görecek düzeyde, kavramsal derinliği olan olgun bir akademik düzyazıya (\`academic prose\`) dönüştürmektir.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır. Zaman duyarlı kurgularda veya yayın yılı değerlendirmelerinde bu yılı baz almalısın.

# OPERASYONEL KISITLAMALAR VE AKADEMİK KURALLAR
- Kesinlikle objektif, mesafeli, net ve elit bir akademik Türkçe kullanacaksın. Metaforik, edebi, ajitasyon içeren veya aşırı süslü dilden kaçın.
- MUHAFAZAKAR METODOLOJİ İLKESİ: Ham girdideki kuramsal ve metodolojik çerçeveye kesinlikle sadık kal. Öğrencinin açıkça belirtmediği veya ima etmediği radikal teorik makas değişiklikleri (Örn: Öğrenci sadece kurumsal yönetim demişken senin Marksist okuma, söylem analizi, post-yapısalcılık enjekte etmen) KESİNLİKLE YASAKTIR. Sadece var olan ham fikri olgunlaştır.
- YERLEŞİK AKADEMİK TERİMLERİN KORUNMASI İLKESİ: Girdi formunda yer alan ve halihazırda bilimsel geçerliliği olan standart yöntem adlarını (Örn: "Yarı yapılandırılmış derinlemesine mülakat", "Anket çalışması", "Regresyon analizi", "İçerik analizi") daha ağır göstermek adına başka ekollerin felsefi kavramsal etiketleriyle (Örn: "Fenomenolojik düzlem", "Hermeneutik yaklaşım") değiştirme. Bu standart yöntemsel terimleri tezin omurgası olarak koru; zenginleştirmeyi bu yöntemlerin araştırmanın evreninde nasıl uygulanacağını ve verilerin nasıl tematikleştirileceğini detaylandırarak gerçekleştir.
- BÜTÜNSEL METODOLOJİK UYUM İLKESİ: Üretilen metodoloji tasarımı, tezin kuramsal çerçevesiyle kusursuz bir epistemolojik uyum (\`golden thread\`) oluşturmalıdır. Eğer adayın kuramsal altyapısı hazır teorilere, modellere veya kurumsal/yapısal yaklaşımlara dayanıyorsa, metodolojiyi teori ile sahanın karşılıklı etkileşimini ve veri-teori diyalektiğini vurgulayan "Teori Güdümlü Çözümleme" (\`Theory-driven Analysis\`) veya "Kaçımsamalı Yaklaşım" (\`Abductive Approach\`) gibi bütünsel modellerle açıkla ve temellendir.
- MODEL TEMBELLİĞİ ENGELİ (ANTI-LAZINESS): Çıktılarında asla "...", "vb.", "etc." gibi geçiştirici ifadeler kullanamazsın. Her alanı yapısal ve anlamsal açıdan tam, eksiksiz ve zengin birer paragraf bütünlüğünde üretmek zorundasın.
- ÇIKTI FORMATI: Yanıtın, yukarıda sağlanan \`enhancedThesisSchema\` ile %100 uyumlu, doğrulanmış ve parse edilebilir bir ham JSON objesi olmalıdır. Başına veya sonuna açıklama metni ekleme. Markdown \`\`\`json ... \`\`\` kod blokları kullanma, sadece saf JSON verisi döndür.

# UZMAN FEW-SHOT ÖRNEĞİ
<ornek_girdi_ham_matris>
{
  "studyTitle": "Şirketlerdeki borçların işçilere etkisi",
  "researchQuestion": "Kişisel borçlar beyaz yakalı çalışanları nasıl etkiliyor?",
  "theoreticalFramework": "Foucault'nun yönetimsellik fikri ve borçlu insan teorisi.",
  "methodology": "30 beyaz yakalı işçiyle yarı yapılandırılmış mülakat yaptım.",
  "researchScope": "İstanbul Levent, Maslak ve Şişli plaza ekosistemlerinde 2018-2025 yılları arasında beyaz yakalı profesyonellerle yapılan görüşmeler; neoliberal iş kültürünün finansal bağımlılık dinamikleri.",
  "mainClaim": "Borçlu olmak işçileri patrona daha bağımlı hale getiriyor ve onları korkutuyor."
}
</ornek_girdi_ham_matris>

<ornek_beklenen_cikti>
{
  "studyTitle": "Finansallaşma Kıskacında Öznellik: Beyaz Yakalı Çalışanlarda Borçluluk ve Yönetimsellik İlişkileri",
  "researchQuestion": "Finansal kapitalizm sürecinde yapısal bir zorunluluk olarak yükselen kişisel borçluluk dinamikleri, beyaz yakalı çalışanların gündelik emek süreçlerindeki mikro-iktidar ilişkilerini ve özneleşme deneyimlerini nasıl şekillendirir?",
  "theoreticalFramework": "Bu çalışma, felsefi omurgasını Michel Foucault'nun yönetimsellik (\`governmentality\`) analizinden ve Maurizio Lazzarato'nun borçlu insan kavramsallaştırmasından almaktadır. Borç kavramı saf bir ekonomik takas ilişkisi olmanın ötesine taşınarak, bireyin itaatkarlık mekanizmalarını kuran, rasyonalitesini ve kurumsal sadakatini yeniden üreten asimetrik bir iktidar düzlemi olarak ele alınmaktadır.",
  "methodology": "Araştırmanın ampirik katmanı, kurumsal finans merkezlerinde istihdam edilen borçlu 30 beyaz yakalı profesyonel ile gerçekleştirilen yarı yapılandırılmış derinlemesine mülakatlara dayanmaktadır. Sahadan elde edilen nitel veriler, tezin kuramsal altyapısıyla epistemolojik bir uyum içinde tutularak teori güdümlü içerik analizine (\`theory-driven thematic analysis\`) tabi tutulacak; iktidar mekanizmaları, vicdani içselleştirme ve kariyer savunma taktikleri ekseninde tematikleştirilecektir.",
  "researchScope": "Araştırma, İstanbul'un Levent, Maslak ve Şişli merkezi iş alanlarında (CBD) ikamet eden beyaz yakalı profesyonellerle 2018-2025 yılları arasında gerçekleştirilen nitel bir saha çalışmasına dayanmaktadır. Katılımcılar kartopu örnekleme yöntemiyle seçilmiş; birincil veriler yarı yapılandırılmış derinlemesine mülakatlarla toplanmıştır. Analitik odakta, neoliberal iş kültürü içerisinde borçluluk deneyimini yönetimsellik ve borçlu insan kavramları üzerinden yeniden üreten finansal bağımlılık ilişkileri yer almaktadır.",
  "mainClaim": "Çağdaş neoliberal rejim altında borçluluk, yalnızca dönemsel bir finansal yükümlülük değil; bireyin varoluşunu vicdani, ahlaki ve profesyonel düzeyde disipline eden, onu kurumsal hiyerarşilere ve rasyonaliteye daha sıkı bağlayan temel bir yönetimsellik teknolojisi olarak işlev görmektedir."
}
</ornek_beklenen_cikti>_`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (%100 TÜRKÇE)
// ============================================================================
export function buildMatrixEnhancementPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
  mainClaim: string;
}): string {
  return `<ham_ogrenci_matrisi>
{
  "studyTitle": "${params.studyTitle.replace(/"/g, '\\"')}",
  "researchQuestion": "${params.researchQuestion.replace(/"/g, '\\"')}",
  "theoreticalFramework": "${params.theoreticalFramework.replace(/"/g, '\\"')}",
  "methodology": "${params.methodology.replace(/"/g, '\\"')}",
  "researchScope": "${params.researchScope.replace(/"/g, '\\"')}",
  "mainClaim": "${params.mainClaim.replace(/"/g, '\\"')}"
}
</ham_ogrenci_matrisi>

# TALİMATLAR VE GÖREV
Sistem talimatındaki katı kurallara, dil sınırlarına, "Muhafazakar Metodoloji", "Standart Terimlerin Korunması" ve "Bütünsel Metodolojik Uyum" ilkelerine harfiyen uyarak yukarıdaki <ham_ogrenci_matrisi> yapısını analiz et. Ham fikirleri yapısal bütünlüğünü bozmadan elit, derinlikli ve yayınlanabilir bilimsel düzyazı paragraflarına dönüştürerek \`enhancedThesisSchema\` yapısını eksiksiz doldur.

# KRİTİK GÜVENLİK BARIYERI
- Tamamen sağlanan ham matris verilerine sadık kal (Strictly Grounded). Matriste öğrenci tarafından belirtilmemiş harici kuramsal ekolleri veya yöntem yaklaşımlarını keyfi olarak analize dahil etme.
- Çıktı dilinin tamamen Türkçe kurallarına uygun, kusursuz akademik terminolojide olmasını sağla.

Dahili olarak çok derinlemesine düşün (Think extremely hard) ve sadece nihai şemaya uygun ham JSON nesnesini döndür.`;
}
