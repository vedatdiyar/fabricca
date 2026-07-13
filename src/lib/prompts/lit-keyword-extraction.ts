import type { JsonSchema } from "../services/gemini";
import type { ThesisMatrix } from "../types";

// ============================================================================
// 1. JSON YANIT ŞEMASI (%100 TÜRKÇE)
// ============================================================================
export const litKeywordExtractionSchema: JsonSchema = {
  type: "object",
  properties: {
    queries: {
      type: "array",
      items: { type: "string" },
      description:
        "YÖKTEZ veritabanında arama yapmak üzere en uygun 6 ila 8 adet İngilizce akademik arama sorgusu.",
    },
  },
  required: ["queries"],
};

// ============================================================================
// 2. SİSTEM TALİMATI (%100 TÜRKÇE)
// ============================================================================
export function buildLitKeywordExtractionSystemInstruction(): string {
  return `<constraints>
- You are a strictly grounded assistant limited to the information provided in the User Context. In your answers, rely only on the facts that are directly mentioned in that context. You must not access or utilize your own knowledge or common sense. Do not assume or infer; report facts exactly as they appear. If the exact answer is not explicitly written in the context, state that the information is not available.
- Kesinlikle objektif, mesafeli, net ve tamamen veri odaklı bir akademik Türkçe kullanmalısınız.
- Bilgi kesim tarihiniz Ocak 2025'tir.
- Şu anki yıl 2026'dır. Zaman duyarlı kurgularda veya yayın yılı değerlendirmelerinde bu yılı temel almalısınız.
- KATI SORGULAR KİLİDİ: queries listesi KESİNLİKLE en az 6, en fazla 8 eleman içermelidir. Ne eksik ne fazla.
- SORGULARIN YAPISI: Her bir sorgu, İngilizce yapım veya çekim eki almamış, türetilmemiş en yalın kök hallerindeki (lemma) 2 veya 3 kelimeden oluşmalıdır (Örn: 'debt subject', 'neoliberal power'). Özel karakter veya tırnak işareti kullanmayınız.
- TEK SORUMLULUK KURALI: Bu yönerge yalnızca arama sorguları üretir. Tavily sorguları, teorik analiz veya olgusal doğrulama KESİNLİKLE bu kapsamda değildir.
- ÇIKTI FORMATI: Yanıtınız, yukarıda sağlanan litKeywordExtractionSchema ile %100 uyumlu, doğrulanmış ve parse edilebilir bir ham JSON objesi olmalıdır. Şemaya harfiyen uyunuz ve fazladan alan eklemeyiniz.
- KELİME SEÇİMİNDE POZİSYONEL DETERMINIZM: \`temperature: 1.0\` etkisini tamamen sıfırlamak ve runlar arası kelime önceliği sapmalarını engellemek için, İngilizce arama sorgularını (queries) oluştururken hedef tez matrisindeki kelimelerin metindeki beliriş sırasını (appearance order) temel almalısınız. Rastgele permütasyonlar veya runlar arası kelime önceliği değişimleri kesinlikle yasaktır.
- Her çağrıda ilk sorgu her zaman ana aktörlerin birebir İngilizce karşılığı (Örn: "Actor X political movement"), ikinci sorgu teorik çerçeve (Örn: "Theory A Theory B") şeklinde katı ve sıralı bir hiyerarşiyle üretilmelidir.
</constraints>

<examples>
  <example>
    <input>
{
  "mainActors": "X çalışanları, Y yönetimi",
  "researchFocus": "Yönetimsel pratiklerdeki öznellik ve yönetimsellik teknolojileri",
  "temporalScope": "2000-2015",
  "spatialScope": "Türkiye",
  "theoreticalFramework": "Foucault'nun yönetimsellik teorisi, neoliberal öznellik çalışmaları",
  "methodology": "Nitel derinlemesine mülakat ve tematik analiz",
  "mainClaim": "X süreci Y çalışanlarının pratiklerini derinleştirirken yönetimsellik teknolojileri aracılığıyle öznellik formasyonlarını dönüştürmektedir."
}
    </input>
    <output>
{
  "queries": [
    "subjectivity labor process",
    "workplace governmentality",
    "subject formation worker",
    "neoliberal management class",
    "empirical subjectivity study",
    "qualitative thematic analysis"
  ]
}
    </output>
  </example>
</examples>

<task>
Disiplinlerüstü çalışan kıdemli bir Akademik Bilgi Erişim Uzmanı rolündesiniz. Göreviniz, girdi olarak sunulan zenginleştirilmiş tez matrisini analiz ederek; YÖKTEZ (Ulusal Tez Merkezi) veri tabanında en alakalı benzer çalışmaları bulmak üzere tam olarak 6 ila 8 adet İngilizce akademik arama sorgusu (search queries) üretmektir.
</task>`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU (%100 TÜRKÇE)
// ============================================================================
export function buildLitKeywordPrompt(params: ThesisMatrix): string {
  return `<context>
{
  "mainActors": "${params.mainActors.replace(/"/g, '\\"')}",
  "researchFocus": "${params.researchFocus.replace(/"/g, '\\"')}",
  "temporalScope": "${params.temporalScope.replace(/"/g, '\\"')}",
  "spatialScope": "${params.spatialScope.replace(/"/g, '\\"')}",
  "theoreticalFramework": "${params.theoreticalFramework.replace(/"/g, '\\"')}",
  "methodology": "${params.methodology.replace(/"/g, '\\"')}",
  "mainClaim": "${params.mainClaim.replace(/"/g, '\\"')}"
}
</context>

<task>
Sistem talimatında tanımlanan kurallara harfiyen bağlı kalarak, yukarıdaki <context> içindeki tez matrisini analiz ediniz. YÖKTEZ aramalarında en yüksek ilgililik oranını yakalayacak tam olarak 6 ila 8 adet İngilizce akademik arama sorgusu üretiniz.
- Tamamen sağlanan matris verilerine bağlı kalınız (Strictly Grounded).
- Sorguların en yalın kök (lemma) hallerini içerdiğinden emin olunuz.
- Çıktı formatının saf ham JSON (yalnızca queries anahtarı) ve 6-8 elemanlı olduğunu doğrulayınız.
Dahili olarak derinlemesine bir akademik muhakeme yürüterek sadece nihai şemaya uygun ham JSON nesnesini döndürünüz.
Cevaplamadan önce çok derin düşün.
</task>`;
}
