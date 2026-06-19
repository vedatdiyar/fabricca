import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (EVRENSEL TİPOLOJİ & ÖZ-DENETİM KİLİTLİ - 5-7 KUTU GARANTİLİ)
// ============================================================================
export const thesisBoxGenerationSchema: JsonSchema = {
  type: "object",
  properties: {
    boxes: {
      type: "array",
      minItems: 5,
      maxItems: 7,
      description:
        "Tezin entelektüel, metodolojik ve analitik omurgasını oluşturan, gereksiz odak dağılmasını engellemek için EN AZ 5, EN FAZLA 7 adet olacak şekilde kesin olarak sınırlandırılmış modüler, bağımsız ve kendi kendini denetlemiş kutu seti.",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description:
              "Kutunun ele aldığı akademik konunun veya yöntemin başlığıdır. KESİNLİKLE TÜRKÇE OLMALIDIR. (Örn: 'Gramsciyen Hegemonya Kuramı' veya 'Nitel Mülakat ve Saha Metodolojisi')",
          },
          boxType: {
            type: "string",
            enum: [
              "Kuram",
              "Literatür",
              "Bağlam",
              "Yöntem",
              "Veri",
              "Analiz",
              "Katkı",
              "Ampirik",
              "Arşiv",
            ],
            description:
              "Kutunun işlevsel 9'lu box tipolojisindeki tam karşılığı (Kuram, Literatür, Bağlam, Yöntem, Veri, Analiz, Katkı, Ampirik, Arşiv).",
          },
          description: {
            type: "string",
            description:
              "Başlıkta belirtilen akademik konuyu veya yöntemi, tezin bütünüyle olan ilişkisini kurarak tanımlayan kısa açıklamadır. KESİNLİKLE TÜRKÇE OLMALIDIR.",
          },
          semanticSearchBlock: {
            type: "string",
            maxLength: 2000,
            description:
              "OpenAlex GTE-Large vektör motorunu maksimum başarıyla tetikleyecek, en az 3-4 cümleden oluşan, yoğun, elit, akademik İngilizce literatür özeti/paragrafı (narrative abstract). Asla virgülle ayrılmış kelime çuvalı formatında olmamalıdır. Doğrudan teorik ekolü, yöntemsel/epistemolojik tartışmayı veya ampirik bağlamı akan bir anlatı halinde ifade eder.",
          },
          foundationalQueries: {
            type: "array",
            minItems: 2,
            maxItems: 2,
            description:
              "O kutunun kuramsal, yöntemsel veya ampirik kökünü oluşturan tam 2 adet mikro-analitik kurucu/klasik eserin listesi.",
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
          selfCorrectionJustification: {
            type: "string",
            description:
              "Seçilen 2 eserin tezin Zaman (historicalLimits), Mekan (spatialLimits) ve Aktör (analyticalFocus) kısıtlarına olan ampirik uyumluluk denetimi ve öz-eleştirel akademik savunmasıdır. KESİNLİKLE TÜRKÇE OLMALIDIR.",
          },
          concepts: {
            type: "array",
            items: {
              type: "string",
            },
            maxItems: 3,
            description:
              "Kutunun kuramsal, yöntemsel veya tematik odağını belirten en fazla 3 adet Türkçe akademik kavram/etiket. KESİNLİKLE TÜRKÇE OLMALIDIR.",
          },
        },
        required: [
          "title",
          "boxType",
          "description",
          "semanticSearchBlock",
          "foundationalQueries",
          "selfCorrectionJustification",
          "concepts",
        ],
      },
    },
  },
  required: ["boxes"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (ÖZ-DENETİMLİ SIZDIRMAZ AKADEMİK MOTOR AYARI)
// ============================================================================
export function buildThesisBoxGenerationSystemInstruction(): string {
  return `# ROL VE GÖREV
Sen OpenAlex ve Semantic Scholar veritabanlarının indeksleme, taksonomi ve vektörel anlamsal eşleştirme (Semantic Search) mimarisine ultra-spesifik düzeyde hakim bir Kıdemli Veri Mimarı ve Akademik Bibliyografya Uzmanısın. Görevin, girdi olarak sunulan yapılandırılmış 9 boyutlu tez matrisini girdiler, süreçler ve çıktılar ekseninde **9'lu Box Tipolojisi** (Kuram, Literatür, Bağlam, Yöntem, Veri, Analiz, Katkı, Ampirik, Arşiv) mantığıyla bağımsız, hiyerarşisiz literatür ve süreç kutularına (subject/methodology boxes) bölmektir.

# BİLGİ VE ZAMAN KISITLAMALARI
- Bilgi kesim tarihin Ocak 2025'tir.
- Şu anki yıl 2026'dır.

# OPERASYONEL KISITLAMALAR VE DİL KURALLARI
- Kesinlikle objektif, mesafeli ve elit bir akademik Türkçe kullanacaksın.
- DİL VE KÜRESEL ENDEKS KURALI: JSON nesnesindeki "title", "description", "concepts" ve "selfCorrectionJustification" alanları KESİNLİKLE TÜRKÇE olmalıdır. Harici tarama motorunu (OpenAlex) tetikleyecek olan "semanticSearchBlock" ve "foundationalQueries" alanları ise KESİNLİKLE akademik İNGİLİZCE ile üretilmelidir.

# KUTU MİMARİSİ VE KESİN SEÇİM METRİKLERİ
1. 9'LU BOX TİPOLOJİSİ ENTEGRASYONU: Girdideki verileri şu 9 işlevsel tipe göre analiz et ve dağıt: [Kuram, Literatür, Bağlam, Yöntem, Veri, Analiz, Katkı, Ampirik, Arşiv]. Her kutunun "boxType" alanı bu tiplerden biri olmak zorundadır. Model, tezin sadece konusunu değil; yöntemsel, lojistik ve analitik literatür altyapısını da bağımsız birer kutu olarak inşa etmelidir.
2. AKADEMİK KONSOLİDASYON VE KUTU SINIRI (KATI KURAL): Üretilecek toplam kutu sayısı **EN AZ 5, EN FAZLA 7** olmak zorundadır. Tezi gereksiz yere atomize edip yazım sürecini parçalama (fragmentation) tuzağına düşme! Eğer girdide 7'den fazla bağımsız bileşen, kuram veya aşama varsa, birbirine yakın olan temaları veya yöntem-veri ilişkilerini aynı kutu altında mantıksal olarak KONSOLİDE ET, birleştir. Yazım aşamasında operasyonel odak sağlamak için bu sınır kesindir.
3. SÜREÇ VE YÖNTEM LİTERATÜRÜ AYARI: Yöntem ve Veri kutuları için "foundationalQueries" alanına KESİNLİKLE uydurma (halüsinasyon) eserler, birincil kaynak isimleri, ham arşiv adları veya ana eserin çevirmenleri/editörleri (Örn: Gramsci'nin yanına çevirmeni Quintin Hoare'u eklemek) bağımsız yazar olarak yazılamaz. Her zaman uluslararası literatürde meşruiyeti olan iki farklı yöntembilimsel/arşivsel kurucu akademik yazar yerleştirilmelidir.
4. SEMANTİK BLOCK DİYETİ — NARRATIVE ABSTRACT ZORUNLULUĞU (ANTI-KEYWORD-BAG RULE): "semanticSearchBlock" alanı en az 3-4 cümlelik akan paragraf (narrative abstract) formatında, doğal akademik İngilizce cümleleriyle üretilmelidir. Asla jenerik niyet kalıpları kullanma.
5. OPENALEX %100 GERÇEK İNGİLİZCE LİTERATÜR YASASI (HALÜSİNASYON VE TÜRKÇE YASAK): "foundationalQueries" alanına yazılacak kurucu eserlerin tamamı küresel akademik indekslerde (OpenAlex, Scopus) taranabilir, KESİNLİKLE İNGİLİZCE dilinde basılmış GERÇEK kitap veya hakemli dergi makaleleri olmak zorundadır. Türkçe basılmış yerel kitaplar veya bunların uydurma İngilizce çevirileri KESİNLİKLE YASAKTIR.
   - ÖZELLİKLE "Bağlam", "Analiz" ve "Katkı" kutularında yerel konular (Örn: Türkiye Solu, Kürt Hareketi) işlenirken; yerel dildeki kitaplar yerine, bu ampirik alanı uluslararası literatüre taşımış uzmanların (Örn: Hamit Bozarslan, Mesut Yeğen, Cengiz Gunes, Nicole Watts, Martin van Bruinessen, Kemal Kirisci, Feroz Ahmad vb.) uluslararası indeksli GERÇEK İngilizce kitap ve makaleleri getirilmelidir. Başlık veya yazar KESİNLİKLE uydurulamaz.
   - Bu kutularda ampirik bağlamı aşan genel makro-teorisyenler (Örn: Benedict Anderson, Charles Tilly, Sidney Tarrow, Donatella della Porta, Doug McAdam) kurucu eser olarak kullanılamaz.
6. AKADEMİK ÖZ-DENETİM VE GEREKÇELENDİRME (MUTLAK EMİR): "foundationalQueries" alanına seçtiğin her bir eseri, tezin girdilerinde deklare edilen "historicalLimits" (Zaman), "spatialLimits" (Mekan) ve "analyticalFocus" (Aktörler) kısıtlarına göre denetleyeceksin.
   - Seçtiğin eser tezin kronolojik dönemiyle veya coğrafyasıyla doğrudan örtüşmüyorsa (Örn: 1991 tezi için 1971 tarihli Gramsci kitabı veya 1985 tarihli Mouffe eseri seçmek), bunun akademik gerekçesini, yarattığı ampirik açığı/riski ve buna rağmen neden kaçınılmaz bir kurucu kaynak olarak seçildiğini "selfCorrectionJustification" alanında elit bir dille itiraf edip savunacaksın.
   - Eğer eserin tezin bağlamıyla kronolojik ve mekansal bağı %100 kusursuzsa (Örn: 1991-1999 bağlamı için 2012 tarihli Cengiz Güneş eseri seçmek), bu alan uyumun analitik gücünü ve OpenAlex taramasındaki nokta atışı meşruiyetini doğrulamalıdır.
7. MODEL TEMBELLİĞİ ENGELİ VE FORMAT: Çıktılarında asla "...", "vb.", "etc." kullanamazsın. Yanıtın, sağlanan şema ile %100 uyumlu ham JSON objesi olmalıdır. Markdown \`\`\`json ... \`\`\` kod blokları kullanma, sadece saf JSON verisi döndür.

# 5-7 KUTU SINIRINA UYGUN FEW-SHOT ÖRNEĞİ
<ornek_girdi_matrisi>
{
  "studyTitle": "X Ülkesinde Z Bağlamında Y Süreci",
  "researchQuestion": "M Kuramı Ekseninde N Yöntemiyle V Vakası Nasıl Şekillenmektedir?",
  "mainClaim": "V vakasının arkasındaki temel itici güç, ampirik/tarihsel C dinamikleridir.",
  "theoreticalFramework": "M Kuramı ve Alt Okulları",
  "methodology": "N Metodolojisi",
  "dataStrategy": "Birincil arşiv belgeleri ve ikincil literatür taraması",
  "historicalLimits": "1991-1999 arası dönem",
  "spatialLimits": "X Coğrafyası",
  "analyticalFocus": "Devlet kurumları, siyasi aktörler ve muhalif hareketler"
}
</ornek_girdi_matrisi>
<ornek_beklenen_cikti>
{
  "boxes": [
    {
      "title": "M Kuramı ve Kuramsal Temelleri",
      "boxType": "Kuram",
      "description": "Tezin teorik altyapısını oluşturan M kuramının temel argümanlarının incelenmesi.",
      "concepts": ["M Kuramı", "Söylemsel Alan"],
      "foundationalQueries": [
        {
          "author": "Teorisyen A",
          "title": "The Core Philosophy of M Theory",
          "publicationYear": 1990
        },
        {
          "author": "Teorisyen B",
          "title": "Rethinking M Framework in Political Theory",
          "publicationYear": 1985
        }
      ],
      "selfCorrectionJustification": "Seçilen kurucu eserlerin yayın yılları (1990 ve 1985), tezin odaklandığı 1991-1999 ampirik dönem kısıtının kronolojik olarak gerisindedir. Ancak V vakasının arkasındaki ontolojik kırılmaları ve söylemsel alanı teorik olarak inşa edebilmek adına, bu post-klasik yapısalcı kuramın ana metinlerine başvurulması kuramsal bir zorunluluktur.",
      "semanticSearchBlock": "M theory provides a structural paradigm that redefines core conceptual constraints within contemporary political ontology. Its theoretical apparatus foregrounds the dialectical relationship between hegemonic formations and counter-hegemonic struggles in late capitalist societies. This framework has been systematically applied across comparative institutional analysis to explain how structural power asymmetries are reproduced."
    },
    {
      "title": "X Coğrafyasında V Vakası ve Yapısal Koşullar",
      "boxType": "Bağlam",
      "description": "1991-1999 kesitinde X coğrafyasındaki C dinamiklerinin ampirik analizi.",
      "concepts": ["X Coğrafyası", "C Dinamikleri", "V Vakası"],
      "foundationalQueries": [
        {
          "author": "Uzman X",
          "title": "Socio-Political Transformations in X Country: 1990s Realignments",
          "publicationYear": 2005
        },
        {
          "author": "Uzman Y",
          "title": "The Trajectory of V Case: From Protest to Institutionalization",
          "publicationYear": 2012
        }
      ],
      "selfCorrectionJustification": "Seçilen kaynaklar tezin 1991-1999 ampirik zaman sınırından sonra basılmış olsalar da, doğrudan X coğrafyasındaki 1990'lar dönüşümünü and V vakasını geriye dönük (retrospective) saha araştırmalarıyla inceleyen en meşru uluslararası endeksli İngilizce monografilerdir. OpenAlex taramasında tam isabet sağlayacak ampirik uyuma sahiptir.",
      "semanticSearchBlock": "The socio-political landscape of X country during the 1990s period was profoundly shaped by the intersection of local C dynamics and broader regional realignments. The V case exemplifies how structural economic transformations interacted with grassroots mobilization to produce distinct patterns of political contestation. Empirical studies of this period reveal that localized responses to central state policies were mediated by existing networks of patronage."
    }
  ]
}
</ornek_beklenen_cikti>`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (9 BOYUTLU GİRDİ MOTORU)
// ============================================================================
export function buildThesisBoxGenerationPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  methodology: string;
  dataStrategy: string;
  historicalLimits: string;
  spatialLimits: string;
  analyticalFocus: string;
}): string {
  return `<hedef_tez_matrisi>
{
  "studyTitle": "${params.studyTitle.replace(/"/g, '\\"')}",
  "researchQuestion": "${params.researchQuestion.replace(/"/g, '\\"')}",
  "mainClaim": "${params.mainClaim.replace(/"/g, '\\"')}",
  "theoreticalFramework": "${params.theoreticalFramework.replace(/"/g, '\\"')}",
  "methodology": "${params.methodology.replace(/"/g, '\\"')}",
  "dataStrategy": "${params.dataStrategy.replace(/"/g, '\\"')}",
  "historicalLimits": "${params.historicalLimits.replace(/"/g, '\\"')}",
  "spatialLimits": "${params.spatialLimits.replace(/"/g, '\\"')}",
  "analyticalFocus": "${params.analyticalFocus.replace(/"/g, '\\"')}"
}
</hedef_tez_matrisi>

# TALİMATLAR VE GÖREV
Sistem talimatında tanımlanan tüm kurallara, dil kısıtlamalarına, **9'lu Box Tipolojisi** ilkelerine ve özellikle **Akademik Konsolidasyon (5-7 Kutu Sınırı)** standartlarına kusursuz şekilde bağlı kalarak, yukarıdaki 9 boyutlu <hedef_tez_matrisi> yapısını analiz et. 

Üretilecek toplam kutu sayısı **kesinlikle en az 5, en fazla 7 olmak zorundadır.** Tezi parçalara ayırıp odağı bozacak şekilde 8 veya 9 kutu üretme. İlişkili bileşenleri, teorileri veya veri katmanlarını tek bir kutuda akıllıca konsolide et.

Çıktıdaki başlık, açıklama, kavram etiketleri ve özellikle seçtiğin kaynakların zaman/mekan/aktör uyumunu hesaba çektiğin "selfCorrectionJustification" alanı tamamen Türkçe olmalıdır. "foundationalQueries" alanındaki eserlerin tamamı OpenAlex'te %100 taranabilir gerçek, fiziksel olarak basılmış İngilizce literatür olmak zorundadır. Dahili olarak çok derinlemesine düşün ve sadece nihai şemaya uygun ham JSON nesnesini döndür.`;
}
