import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (3 Kademeli Standart Yapı)
// ============================================================================
export const THESIS_AXES_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "number", description: "Karşı tezin ID numarası" },
    problem_sinirlari: {
      type: "object",
      properties: {
        gerekce: {
          type: "string",
          description: "Kısa gerekçe (1-2 cümle, maksimum 150 karakter)",
        },
        secim: {
          type: "string",
          enum: ["TAM_ORTÜŞME", "KISMI_ORTÜŞME", "ALAKASIZ"],
        },
      },
      required: ["gerekce", "secim"],
    },
    teorik_perspektif: {
      type: "object",
      properties: {
        gerekce: {
          type: "string",
          description: "Kısa gerekçe (1-2 cümle, maksimum 150 karakter)",
        },
        secim: {
          type: "string",
          enum: ["TAM_ORTÜŞME", "KISMI_ORTÜŞME", "ALAKASIZ"],
        },
      },
      required: ["gerekce", "secim"],
    },
    metodolojik_kurgu: {
      type: "object",
      properties: {
        gerekce: {
          type: "string",
          description: "Kısa gerekçe (1-2 cümle, maksimum 150 karakter)",
        },
        secim: {
          type: "string",
          enum: ["TAM_ORTÜŞME", "KISMI_ORTÜŞME", "ALAKASIZ"],
        },
      },
      required: ["gerekce", "secim"],
    },
    zaman_mekan_ozgullugu: {
      type: "object",
      properties: {
        gerekce: {
          type: "string",
          description: "Kısa gerekçe (1-2 cümle, maksimum 150 karakter)",
        },
        secim: {
          type: "string",
          enum: ["TAM_ORTÜŞME", "ALAKASIZ"],
        },
      },
      required: ["gerekce", "secim"],
    },
  },
  required: [
    "id",
    "problem_sinirlari",
    "teorik_perspektif",
    "metodolojik_kurgu",
    "zaman_mekan_ozgullugu",
  ],
};

export const geminiAnalysisSchema: JsonSchema = {
  type: "object",
  properties: {
    overlapTable: {
      type: "array",
      items: THESIS_AXES_SCHEMA,
    },
  },
  required: ["overlapTable"],
};

// ============================================================================
// 2. SİSTEM TALİMATI
// ============================================================================
export function buildAnalysisSystemInstruction(): string {
  return `Akademik tez analizleri gerçekleştiren uzman bir jüri üyesi rolündesiniz. Göreviniz, size sunulan "Hedef Tez" matrisi ile "Karşı Tez" özet metnini 4 temel eksende karşılaştırmak, aralarındaki konsept/akrabalık ilişkilerini tespit etmek ve her eksen için KESİNLİKLE yalnızca şu üç standart seçenekten birini belirlemektir: "TAM_ORTÜŞME", "KISMI_ORTÜŞME", "ALAKASIZ".

### ANALİZ YAKLAŞIMI:
Değerlendirme yaparken yüzeysel kelime benzerliklerine (kelime avcılığına) odaklanmayınız. Bunun yerine akademik konsept, felsefi okul/soy ağacı ve yöntem ailesi eşleştirmesi yapmaya odaklanınız. Karşı tezin özet metninde ilgili eksene dair herhangi bir bilgi veya ipucu bulunmuyorsa doğrudan "ALAKASIZ" seçeneğini seçiniz.

### EKSEN TANIMLARI VE SEÇİM REHBERİ:

#### 1. ARAŞTIRMA PROBLEMİNİN SINIRLARI (KONU):
Hedef tezin araştırma sorusu, konusu, ilişkili olduğu aktör ve değişken küme ağının, karşı tezin araştırma konusu ve sınırlarıyla karşılaştırılmasıdır.

- **TAM_ORTÜŞME**: İki tez de tamamen aynı odak noktasını, aynı aktör/değişken kombinasyonunu ve aynı ampirik araştırma nesnesini inceliyorsa seçilir.
- **KISMI_ORTÜŞME (Saf İzolasyon Kuralı)**: Karşı tez, hedef tezin ilişkisel ağındaki ana aktörlerden veya kurucu değişkenlerden en az birini, yanına hedef tezde bulunmayan başka hiçbir yabancı değişken veya odak eklemeden, saf ve izole halde kendi merkez araştırma nesnesi olarak ele alıyorsa seçilir. Kısmi örtüşme için ortak değişkenin saf halde incelenmesi şarttır. **[KATI KURAL]**: Hedef tez çok aktörlü/ilişkisel bir yapıdayken, karşı tezin bu aktörlerden sadece birini saf halde çalışması ve diğer aktörleri hiç anmaması KESİNLİKLE "ALAKASIZ" seçilme gerekçesi olamaz! Karşı tezde hedef tezin diğer aktörlerinin (Örn: sosyalist solun) eksik olması, o tezi alakasız yapmaz; aksine bu durum KISMI_ORTÜŞME'nin mutlak kanıtıdır.
- **ALAKASIZ (Yabancı Değişken Bariyeri)**: Karşı tez, hedef tezin ilişkisel ağındaki ortak bir aktörü veya değişkeni barındırsa dahi, yanına hedef tezde yer almayan tamamen farklı, yabancı bir değişken/odak ekleyerek araştırma nesnesini ve konusunu başkalaştırıyorsa seçilir. Ayrıca karşı tezin özetinde bu eksende değerlendirme yapılabilecek net bir bilgi yoksa da doğrudan bu seçenek işaretlenmelidir. Ortak bir kelimenin varlığı, yanında yabancı bir değişken varsa KISMI_ORTÜŞME için kesinlikle yeterli değildir.

#### 2. TEORİK PERSPEKTİF (TEORİ):
Tezlerin dayandığı teorik çerçeve, kavramsal zemin, kuramsal yaklaşımlar ve felsefi okulların karşılaştırılmasıdır. Kelime eşleşmelerine değil, kuramsal taşıyıcı kolonların bütününe odaklanınız.

- **TAM_ORTÜŞME (Çoklu Bileşen Tam Uyumu)**: İki tez de ana kuramsal çerçeve olarak aynı kuramcıları, kuramları veya modelleri açıkça ve eksiksiz kullanıyorsa seçilir. Hedef tez birden fazla kuramsal yaklaşımın harmanına (kombinasyonuna) dayanıyorsa, karşı tezin TAM_ORTÜŞME alabilmesi için bu kuramsal bileşenlerin tamamını içermesi şarttır; bileşenlerden biri bile eksikse bu seçenek kesinlikle işaretlenemez.
- **KISMI_ORTÜŞME (Kuramsal Soy Ağacı Kuralı)**: Kuramcı veya kuram isimleri birebir çakışmasa bile, iki kuram aynı entelektüel felsefi okuldan, ortak paradigmadan veya eleştirel yaklaşımdan besleniyorsa seçilir. Ayrıca hedef tezin çoklu kuramsal harmanındaki bileşenlerden en az biri karşı tezde açıkça yer alıyor ama diğer bileşenler eksik kalıyorsa da doğrudan bu seçenek işaretlenmelidir.
- **ALAKASIZ**: Teorik yaklaşımlar arasında hiçbir felsefi/tarihsel akrabalık veya soy ağacı bağı yoksa ya da karşı tezin özetinde teorik çerçeveye, kullanılan kuramlara/felsefi fona dair hiçbir bilgi/ipucu bulunmuyorsa doğrudan bu seçenek işaretlenmelidir.

#### 3. METODOLOJİK KURGU (YÖNTEM):
Tezlerin ampirik veri toplama araçları, veri işleme süreçleri ve analiz tekniklerinde kullandığı yöntem ailelerinin ve metodolojik kurgularının karşılaştırılmasıdır.

- **TAM_ORTÜŞME (Bütünsel Metot Uyumu)**: İki tezin hem ampirik veri toplama araçları (kaynak setleri, mülakat/anket tasarımları, arşiv dokümanları) hem de bu veriyi işleme ve çözümleme teknikleri (spesifik analiz modelleri, kodlama cetvelleri, nitel/nicel teknikler) ampirik tabanda tamamen aynı kurguya oturuyorsa seçilir. Metodolojik tasarımın hem toplama hem analiz ayağında tam bir özdeşlik şarttır.
- **KISMI_ORTÜŞME (Yöntem Ailesi Akrabalığı)**: Spesifik araştırma teknikleri veya veri toplama araçları birebir çakışmasa bile, iki çalışma da aynı geniş yöntem ailesine (örn: Nitel Metin/Söylem Analizleri, Nicel Regresyon/İstatistik Analizleri, Saha Anketleri, Etnografik Çalışmalar) aitse seçilir. Veri toplama aracı benzeşip analiz tekniği ayrışan veya tam tersi durumdaki tezler doğrudan bu seçenekle işaretlenmelidir.
- **ALAKASIZ (Tahmin Bariyeri)**: Karşı tezin metodolojik kurgusu, veri toplama aracı veya analiz yöntemi hedef tezin yöntemsel ailesiyle taban tabana zıtsa (örn: biri tamamen nicel ekonometrik modelleme iken diğerinin nitel söylem analizi olması) ya da karşı tezin yöntem detayları özet metninde hiç belirtilmemişse seçilir. Jürinin özet metinden yola çıkarak yöntemsel tahmin veya çıkarım yapması kesinlikle yasaktır; bilgi yoksa karar doğrudan bu seçenektir.

#### 4. ZAMAN-MEKAN ÖZGÜLLÜĞÜ (BAĞLAM):
İki tezin özet metinlerinde açıkça beyan edilen ampirik tarihsel dönemlerin (takvim yılları/yüzyıl) ve coğrafi/kurumsal sınırların karşılaştırılmasıdır. KESİNLİKLE kendi harici tarih veya dökümantasyon bilgini kullanmayınız; sadece iki tezin metninde yazan somut ifadelere odaklanınız. Bu eksen için "KISMI_ORTÜŞME" seçeneği tamamen kapatılmıştır; sadece "TAM_ORTÜŞME" veya "ALAKASIZ" seçilebilir.

- **TAM_ORTÜŞME**: Karşı tezin metninde yazan ampirik tarihsel periyot (takvim yılları) VE coğrafi kapsam, hedef tezin metnindeki dönemi ve coğrafyayı ya birebir karşılıyor ya da hedef tezin ampirik zaman dilimini ve coğrafi sınırlarını bir şemsiye gibi tamamen içine alıp (yutup) kapsıyorsa seçilir. Bu iki şartın (Zaman VE Mekan) eşzamanlı olarak hedef tezi yutması zorunludur.
- **[KAPSAMA KURALI]**: Eğer karşı tezin incelediği zaman aralığı (örnek: 1990-2014) hedef tezin zaman aralığını (örnek: 1991-1999) ya da karşı tezin coğrafi kapsamı (örnek: tüm Türkiye) hedef tezin coğrafi kapsamını (örnek: İstanbul) tamamen yutup kapsayıp içine alıyorsa, bu durum zaman/mekan açısından birebir veya daha geniş bir kapsama ilişkisidir (TAM_ORTÜŞME). Karşı tezin aralığının daha geniş olması sebebiyle çekinip "ALAKASIZ" seçilmemeli, KESİNLİKLE "TAM_ORTÜŞME" seçilmelidir. Sadece aralarında kronolojik kopukluk varsa (örnek: 1959-1984 ile 1991-1999) veya coğrafyalar tamamen farklıysa "ALAKASIZ" seçilmelidir.
- **KISMI_ORTÜŞME**: [BU SEÇENEK BU EKSEN İÇİN GEÇERSİZDİR VE ASLA SEÇİLEMEZ]
- **ALAKASIZ (Kronolojik Kopukluk ve Bilgi Yokluğu Bariyeri)**: Karşı tezin ampirik tarihsel periyodu (takvim yılları) ile hedef tezin dönemi arasında bütünsel bir kapsama ilişkisi yoksa veya araları kronolojik olarak kopuksa ya da iki tezin incelenen coğrafi alanları/ülkeleri tamamen farklıysa doğrudan bu seçenek işaretlenmelidir. Ayrıca karşı tezin özet metninde ampirik zamana (yıl/dönem) veya mekana dair hiçbir somut veri/yıl beyan edilmemişse, jürinin harici çıkarım yapması kesinlikle yasaktır; karar doğrudan bu seçenektir.

### 🧠 CONTEXT WARM-UP & KESİN KARAR SINIRLARI
- Bu analiz kurallı bir eşleştirme motorudur. İlk çağrı (Run A) ile ardışık çağrılar (Run B, Run C) arasında hiçbir felsefi yorum farkı veya karar oynaklığı gösterilemez.
- [KATI PROBLEM SINIRI KURALI]: Hedef tezin çift aktörlü yapısının (Aktör A ve Aktör B etkileşimi) sadece tek bir aktörünü (Sadece Aktör A veya Sadece Aktör B) odağa alan çalışmalar konu ekseninde ALAKASIZ DEĞİLDİR, kesinlikle KISMI_ORTÜŞME olarak seçilecektir. Kadriye Okudan tezi (#363401) bu kuralın doğrudan bir örneğidir ve bu mantıkla değerlendirilmelidir.

### 🚨 KARAR DETERMİNİZMİ (TEST KISITI)
- temperature: 1.0 etkisini sıfırlamak ve runlar arası karar oynaklığını engellemek için, her aday tezin 4 eksenini değerlendirirken KESİNLİKLE şu MEKANİK SIRAYI ve KURALLARI izleyin:
  1. **ZAMAN-MEKAN ÖZGÜLLÜĞÜ** en somut veri olduğu için İLK sırada değerlendirin. Önce karşı tez özetinde somut yıl/dönem veya coğrafya var mı kontrol edin. Yoksa → ALAKASIZ. Varsa → KAPSAMA KURALI'na göre TAM_ORTÜŞME/ALAKASIZ kararını verin.
  2. **ARAŞTIRMA PROBLEMİNİN SINIRLARI** ikinci sırada değerlendirin. Çift aktör varsa KISMI_ORTÜŞME kuralını uygulayın.
  3. **METODOLOJİK KURGU** üçüncü sırada değerlendirin. Önce özette yöntem bilgisi var mı kontrol edin.
  4. **TEORİK PERSPEKTİF** son sırada değerlendirin. Kuramcı/kuram adı geçiyor mu kontrol edin.
- Bu sıralama KESİNLİKLE her aday tez ve her run için birebir aynı işletilmelidir. Sıra atlamak veya değiştirmek yasaktır.
- Her eksende karar, önce somut veri kontrolü (var/yok), ardından kural sayfasındaki ilgili tanıma göre mekanik eşleştirme yapılarak verilmelidir. Konsept sezgisi veya yorum farkına izin verilmez.

### 📝 GEREKÇE (GEREKCE) FORMAT KISITLAMALARI
Jürinin ürettiği gerekce metinlerinin kelime/karakter esnekliğini (temperature kaynaklı varyasyonları) sıfırlamak için şu yapısal sınırları tavizsiz uygulayın:
1. **Uzunluk Sınırı:** Her bir eksen için yazılacak gerekce metni en fazla 2 cümle ve maksimum 150 karakter olacaktır. 150 karakterin aşılması kesinlikle yasaktır.
2. **Kalıp Şablon Şartı:** Serbest edebi yorum yapılmayacak, gerekçeler doğrudan şu analitik kalıplarla başlatılacaktır:
   - "Hedef tezde olmayan [Değişken] yabancı değişkeni konuyu başkalaştırmıştır."
   - "Karşı tez dönemi ([Yıllar]), hedef tezin [Yıllar] periyodunu tamamen kapsamaktadır."
   - "İki çalışma da [Kuram/Yöntem] ortak paydasını/ailesini paylaşmaktadır."`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU
// ============================================================================
export function buildAnalysisPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
  validDetails: {
    id: number;
    title: string;
    author: string;
    university: string;
    year: number;
    thesisType: string;
    department: string;
    abstract: string;
  }[];
}): string {
  const thesisList = params.validDetails.map((t) => ({
    id: t.id,
    title: t.title,
    author: t.author || "Belirtilmemiş",
    year: t.year || 0,
    thesisType: t.thesisType || "Belirtilmemiş",
    university: t.university || "Belirtilmemiş",
    department: t.department || "Belirtilmemiş",
    abstract: t.abstract || "Özet mevcut değil",
  }));

  return `Aşağıdaki hedef tez matrisini, aday tez listesindeki her bir tezle ayrı ayrı karşılaştır. Her aday tez için 4 eksende (problem_sinirlari, teorik_perspektif, metodolojik_kurgu, zaman_mekan_ozgullugu) değerlendirme yap.

<hedef_tez_matrisi>
Başlık: ${params.studyTitle}
Araştırma Sorusu: ${params.researchQuestion}
Teorik Çerçeve: ${params.theoreticalFramework}
Yöntem: ${params.methodology}
Kapsam: ${params.researchScope}
Temel İddia: ${params.mainClaim}
</hedef_tez_matrisi>

<aday_tez_listesi>
${JSON.stringify(thesisList, null, 2)}
</aday_tez_listesi>

Görev: Her aday tezi sistem talimatlarındaki konsept, aile ve ekol odaklı eşleştirme kurallarına göre titizlikle değerlendir. 

Yanıtını kesinlikle aşağıdaki JSON yapısında ver:
{
  "overlapTable": [
    {
      "id": <aday_tez_id>,
      "problem_sinirlari": {
        "gerekce": "Konsept ve aktör kümesi açısından karşılaştırma gerekçesi.",
        "secim": "TAM_ORTÜŞME | KISMI_ORTÜŞME | ALAKASIZ"
      },
      "teorik_perspektif": {
        "gerekce": "Kuramsal aile, ekol ve yaklaşım açısından yakınlık gerekçesi.",
        "secim": "TAM_ORTÜŞME | KISMI_ORTÜŞME | ALAKASIZ"
      },
      "metodolojik_kurgu": {
        "gerekce": "Yöntem ailesi ve veri doğası açısından benzerlik gerekçesi.",
        "secim": "TAM_ORTÜŞME | KISMI_ORTÜŞME | ALAKASIZ"
      },
      "zaman_mekan_ozgullugu": {
        "gerekce": "Tarihsel periyot, coğrafya ve sosyo-politik habitus kesişim gerekçesi.",
        "secim": "TAM_ORTÜŞME | ALAKASIZ"
      }
    }
  ]
}`;
}
