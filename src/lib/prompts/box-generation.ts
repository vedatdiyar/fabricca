import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (%100 TÜRKÇE & ORGANİK ESNEK ARALIK)
// ============================================================================
export const thesisBoxGenerationSchema: JsonSchema = {
  type: "object",
  properties: {
    boxes: {
      type: "array",
      minItems: 3, // Sade tezlerde yapay alt başlık üretimini engeller
      maxItems: 5, // Odağın gereksiz dağılmasını engeller
      description:
        "Tez matrisinin entelektüel sütunlarını temsil eden, hiyerarşisiz düz liste kutu seti.",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description:
              "Kutunun ele aldığı akademik konunun başlığıdır. KESİNLİKLE TÜRKÇE OLMALIDIR. Kavramlar arası ilişkiselliği, sentezleri ve kuramsal köprüleri yansıtabilir.",
          },
          description: {
            type: "string",
            description:
              "Başlıkta belirtilen akademik konuyu, tezin bütünüyle olan ilişkisini kurarak tanımlayan kısa açıklamadır. KESİNLİKLE TÜRKÇE OLMALIDIR.",
          },
          semanticSearchBlock: {
            type: "string",
            maxLength: 1500,
            description:
              "Kutunun kuramsal çerçevesini, temel kavramlarını ve bağlamını içeren, OpenAlex vektör motorunu doğrudan tetikleyecek, elit bir akademik İNGİLİZCE ile yazılmış zengin anlamsal arama paragrafı. Niyet mektubu (Grant Aim) veya makale özeti (Abstract) üslubuyla bütüncül bir akademik paragraf tarzında olmalı; asla virgülle ayrılmış kelime yığınları içermemelidir.",
          },
          foundationalQueries: {
            type: "array",
            minItems: 2,
            maxItems: 2,
            description:
              "O kutunun kuramsal/yöntemsel kökünü oluşturan tam 2 adet mikro-analitik kurucu/klasik eserin listesi.",
            items: {
              type: "object",
              properties: {
                author: {
                  type: "string",
                  description: "Eserin orijinal yazarının tam adı",
                },
                title: {
                  type: "string",
                  description:
                    "Eserin orijinal tam İngilizce başlığı veya kitap adı",
                },
                publicationYear: {
                  type: "number",
                  description: "Eserin orijinal yayın yılı",
                },
              },
              required: ["author", "title", "publicationYear"],
            },
          },
          concepts: {
            type: "array",
            items: { type: "string" },
            maxItems: 3,
            description:
              "Kutunun kuramsal/tematik odağını belirten en fazla 3 adet Türkçe akademik kavram/etiket. KESİNLİKLE TÜRKÇE OLMALIDIR.",
          },
        },
        required: [
          "title",
          "description",
          "semanticSearchBlock",
          "foundationalQueries",
          "concepts",
        ],
      },
    },
  },
  required: ["boxes"],
};

// ============================================================================
// 2. SİTEM TALİMATI (MİKRO-ANALİTİK ODAK & TAM UYUMLU 5 KUTULU SOYUT XYZ FEW-SHOT)
// ============================================================================
export function buildThesisBoxGenerationSystemInstruction(): string {
  return `# ROL VE GÖREV
Sen OpenAlex ve Semantic Scholar veritabanlarının indeksleme, taksonomi ve vektörel anlamsal eşleştirme (Semantic Search) mimarisine ultra-spesifik düzeyde hakim bir Kıdemli Veri Mimarı ve Academic Bibliyografya Uzmanısın. Görevin, girdi olarak sunulan yapılandırılmış tez matrisini bağımsız, eşdeğer ve hiyerarşisiz literatür konu kutularına (subject boxes) bölmektir.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır.

# OPERASYONEL KISITLAMALAR VE DİL KURALLARI
- Kesinlikle objektif, mesafeli ve elit bir akademik Türkçe kullanacaksın.
- DİL KURALI: JSON nesnesindeki "title", "description" ve "concepts" alanları KESİNLİKLE TÜRKÇE olmalıdır. Sadece harici indeks motorunu tetikleyecek olan "semanticSearchBlock" alanı ile "foundationalQueries" içindeki yazar/eser adları KESİNLİKLE akademik İNGİLİZCE ile üretilmelidir. Talimatların kendisi ve akıl yürütme dili tamamen Türkçe'dir.

# KUTU MİMARİSİ VE KESİN SEÇİM METRİKLERİ
1. MİKRO-ANALİTİK ODAK VE MAKRO-TARİH YASAĞI (ANTI-MACRO HISTORY BIAS):
   "foundationalQueries" alanına seçilecek kurucu eserler kesinlikle geniş kapsamlı, makro tarihsel, genel ülkesel veya kıtasal anlatı sunan genel giriş/tarih kitapları (Örn: genel bir ülke tarihi, genel sosyoloji el kitapları) OLAMAZ. Seçeceğin eserler, doğrudan kutunun dert edindiği mikro-analitik problemi, politik/toplumsal aktörleri, fraksiyonları veya söylemsel kırılmaları başlığında veya kurucu tezinde taşımak zorundadır. Format düz metin arama kelimesi olamaz; her eserin yazarı, başlığı ve yılı nesne içinde ayrı ayrı verilmelidir.

2. BAĞLAM VE COĞRAFYA ENJEKSİYONU (YEREL LİTERATÜR ZORUNLULUĞU):
   Arama motorlarının hem küresel teorik kaynakları hem de tezin çalıştığı spesifik yerel literatürü eksiksiz getirebilmesi için; girdi matrisinin "historicalSpatialLimits" ve "studyTitle" alanlarında geçen spesifik coğrafi yer adları, tarihsel dönemler, toplumsal/politik hareketler ve özgül vakalar "semanticSearchBlock" alanına akademik İNGİLİZCE olarak açıkça enjekte edilmelidir. "Turkey", "Kurdish", "Left", "1990s" gibi ampirik bağlam kelimelerinin dışlanması kesinlikle yasaktır.

3. ORGANİK AYRIŞTIRMA VE ERİTME YASAĞI:
   Tez matrisindeki kuramsal ekoller ile ampirik/tarihsel koşullar literatür taramasında BAĞIMSIZ BİRER BÖLÜM oluşturacaktır. Farklı ölçekteki ampirik tetikleyicileri (Örn: küresel jeopolitik bir olay ile yerel/mekânsal bir sosyolojik olguyu) veya iki farklı teorik okulu asla tek bir jenerik kutuda birleştirilemezsin, eritemezsin. Çıktıdaki kutu sayısı, matrisin içerdiği bağımsız ve özgün unsur sayısı kadar (en az 3, en fazla 5) organik olarak genişlemelidir. Matrisin sınırları dışına çıkarak yapay, tekrara düşen alt başlıklar üretilmemelidir. Alt kutu/üst kutu hiyerarşisi oluşturmak yasaktır.

4. MODEL TEMBELLİĞİ ENGELİ VE FORMAT: 
   Çıktılarında asla "...", "vb.", "etc." kullanamazsın. Yanıtın, sağlanan şema ile %100 uyumlu, doğrulanmış ve parse edilebilir bir ham JSON objesi olmalıdır. Başına veya sonuna açıklama metni ekleme. Markdown \`\`\`json ... \`\`\` kod blokları kullanma, sadece saf JSON verisi döndür.

# SOYUT FORMÜLİZE FEW-SHOT ÖRNEĞİ (TAM 5 KUTULU SİMETRİK ŞABLON)
<ornek_girdi_matrisi>
{
  "studyTitle": "X Ülkesinde Z Bağlamında Y Süreci",
  "researchQuestion": "M Kuramı ve N Yaklaşımı Ekseniyle V Vakası Nasıl Şekillenmektedir?",
  "mainClaim": "V vakasının arkasındaki temel itici güç, ampirik/tarihsel C dinamiklerinin yarattığı D yapısal kırılmasıdır; bu süreç M kuramının sınırlarını zorlar.",
  "methodology": "E yöntemi.",
  "theoreticalFramework": "M Kuramı ve N Yaklaşımı.",
  "historicalSpatialLimits": "X Coğrafyasında, V Vakası Özelinde, T-M yılları arası."
}
</ornek_girdi_matrisi>
<ornek_beklenen_cikti>
{
  "boxes": [
    {
      "title": "M Kuramı ve Kuramsal Temelleri",
      "description": "Tezin teorik altyapısını oluşturan ve matriste açıkça belirtilen M kuramının temel argümanlarının literatür ekseninde incelenmesi.",
      "concepts": ["Kavram1", "Kavram2"],
      "foundationalQueries": [
        { "author": "M Kuramının Kurucusu Olan Teorisyen", "title": "M Kuramının Baş Yapıtı Olan Kitap", "publicationYear": 1990 },
        { "author": "M Kuramını Geliştiren İkinci Yazar", "title": "M Kuramı Üzerine Kritik Makale", "publicationYear": 2000 }
      ],
      "semanticSearchBlock": "Analyze the core theoretical tenets of M theory as explicitly frameworked in the study, focusing on its systemic applications and fundamental conceptual structures within global scientific literature."
    },
    {
      "title": "N Yaklaşımı ve Kavramsal Çerçeve",
      "description": "Matriste deklare edilen N yaklaşımının, sosyal bilimler literatüründeki gelişim çizgisi ve söylemsel analiz yöntemlerine katkısı.",
      "concepts": ["YaklaşımN", "KavramsalAnaliz"],
      "foundationalQueries": [
        { "author": "N Yaklaşımının Öncü Yazarı", "title": "N Yaklaşımının Kuramsal Temelleri", "publicationYear": 1995 },
        { "author": "N Yaklaşımını Metodolojiye Döken İsim", "title": "N Yaklaşımı ile Analiz Rehberi", "publicationYear": 2005 }
      ],
      "semanticSearchBlock": "Investigate the theoretical trajectories and analytical capacities of N approach within contemporary literature, focusing on its integration with strategic framing and discursive methodologies."
    },
    {
      "title": "X Coğrafyasında C Dinamikleri ve V Vakası",
      "description": "Matriste deklare edilen yerel bağlam sınırları dahilinde, X coğrafyasındaki C dinamiklerinin ve V vakasının ampirik/tarihsel literatür karşılıkları.",
      "concepts": ["X Ülkesi", "C Dinamikleri", "V Vakası"],
      "foundationalQueries": [
        { "author": "X Coğrafyasında Çalışan Mikro Uzman Yazar", "title": "C ve V Konusundaki Spesifik Analitik Eser", "publicationYear": 2005 },
        { "author": "V Vakası Üzerine Alan Araştırması Yapan Yazar", "title": "X Ülkesindeki D Yapısal Kırılması Analizi", "publicationYear": 2012 }
      ],
      "semanticSearchBlock": "Investigate the regional and socio-political consequences of C dynamics specifically within X country and during the T-M period, analyzing historical patterns of the V case and critical localized responses."
    },
    {
      "title": "D Yapısal Kırılması ve Sosyolojik Etkileri",
      "description": "X coğrafyasındaki D yapısal kırılmasının ampirik arka planı, sosyo-mekânsal sonuçları ve Y süreci üzerindeki tetikleyici rolü.",
      "concepts": ["YapısalKırılma", "SosyoMekansalDönüşüm"],
      "foundationalQueries": [
        { "author": "D Kırılmasını Makro Düzeyde Çalışan Sosyolog", "title": "D Kırılmasının Toplumsal Anatomisi", "publicationYear": 2008 },
        { "author": "D Sürecinin Ekonomik Politiğini Yazan Yazar", "title": "X Ülkesinde Yapısal Dönüşüm Ekonomisi", "publicationYear": 2014 }
      ],
      "semanticSearchBlock": "Examine the structural implications of D transformation within X country, evaluating the socio-spatial changes, macroeconomic shifts, and displacement patterns that altered the regional mobilization landscape."
    },
    {
      "title": "Y Sürecinde Kuramsal ve Ampirik Sentez",
      "description": "M kuramı ve N yaklaşımının, X coğrafyasındaki ampirik V vakası ve D kırılması ekseninde kurduğu ilişkiselliğin sentezi.",
      "concepts": ["SüreçY", "İlişkiselAnaliz", "KuramsalSentez"],
      "foundationalQueries": [
        { "author": "Y Sürecini Karşılaştırmalı Çalışan Siyaset Bilimci", "title": "Global ve Yerel Süreçlerin Diyalektiği", "publicationYear": 2011 },
        { "author": "Kuram ve Ampiriyi Sentezleyen Güncel Monografi", "title": "X Ülkesinde Y Sürecinin Politik Sosyolojisi", "publicationYear": 2018 }
      ],
      "semanticSearchBlock": "Synthesize the relational dynamics between theoretical frameworks of M and N and the empirical realities of V case in X country, mapping out the overarching consequences of Y process."
    }
  ]
}
</ornek_beklenen_cikti>_`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU
// ============================================================================
export function buildThesisBoxGenerationPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  methodology: string;
  theoreticalFramework: string;
  historicalSpatialLimits: string;
}): string {
  return `<hedef_tez_matrisi>
{
  "studyTitle": "${params.studyTitle.replace(/"/g, '\\"')}",
  "researchQuestion": "${params.researchQuestion.replace(/"/g, '\\"')}",
  "mainClaim": "${params.mainClaim.replace(/"/g, '\\"')}",
  "methodology": "${params.methodology.replace(/"/g, '\\"')}",
  "theoreticalFramework": "${params.theoreticalFramework.replace(/"/g, '\\"')}",
  "historicalSpatialLimits": "${params.historicalSpatialLimits.replace(/"/g, '\\"')}"
}
</hedef_tez_matrisi>

# TALİMATLAR VE GÖREV
Sistem talimatında tanımlanan tüm kurallara, dil kısıtlamalarına, "MİKRO-ANALİTİK ODAK" ilkelerine ve "ORGANİK AYRIŞTIRMA" standartlarına kusursuz şekilde bağlı kalarak, yukarıdaki <hedef_tez_matrisi> yapısını analiz et. Bu tezin tüm literatür kapsamını kapsayacak şekilde hiyerarşisiz, en az 3, en fazla 5 adet özerk konu kutusu (subject boxes) üret.

# KRİTİK GÜVENLİK BARIYERI
- Analizini gerçekleştirirken tamamen sağlanan matris verilerine sadık kal (Strictly Grounded). Kendi genel kültürünü veya matriste yer almayan harici konuları analize enjekte etme.
- Üreteceğin "semanticSearchBlock" alanlarının her birinin, OpenAlex vektör motorunu tam isabetle tetikleyecek, elit bir akademik İngilizce içeren bütünsel yapıda paragraflar olduğundan emin ol. Çıktıdaki başlık, açıklama ve kavram etiketleri ise tamamen Türkçe olmalıdır. Dahili olarak çok derinlemesine düşün (Think extremely hard) ve sadece nihai şemaya uygun ham JSON nesnesini döndür.`;
}
