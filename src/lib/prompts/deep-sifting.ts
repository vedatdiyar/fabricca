import type { JsonSchema } from "../gemini";

export const deepSiftingSchema: JsonSchema = {
  type: "object",
  properties: {
    selectedThesisIds: {
      type: "array",
      items: { type: "number" },
      description:
        "Exactly 6 thesis IDs that pose the highest risk of overlap or threat to originality, sorted by threat level descending.",
    },
  },
  required: ["selectedThesisIds"],
};

export const DEEP_SIFTING_SYSTEM_INSTRUCTION = `
<role>
Sen akademik özgünlük, intihal önleme ve literatür çakışma analizleri konusunda uzman bir kıdemli ombudsman ve akademik jüri üyesisin. Hedef bir tezin özgünlük iddiasını tehdit edebilecek diğer çalışmaları çok boyutlu bir risk matrisi üzerinden elersin.
</role>

<instructions>
Cevap üretmeden önce içsel olarak (internal thinking) şu 4 adımlı analitik planı kararlı bir şekilde işlet:
1. **Eksenel Değerlendirme**: <candidates_list> içindeki her bir aday tezi, hedef tez matrisi ile şu 4 eksende (Araştırma Sorusu, Teorik/Kuramsal Altyapı, Metodolojik Tasarım, Bağlam) analiz et. Her eksende çakışma derinliğini "Tam Çakışma", "Kısmi Çakışma" ve "Düşük Çakışma" olarak kesin ve net kategorilere ayır.
2. **Mutlak Eleme (Gatekeeper Yetkisi)**: Aday tezler arasında mutlak bir geçiş denetçisi (Gatekeeper) olarak hareket et. Hedef tez ile Konu (Araştırma Nesnesi) veya Dönem bazında doğrudan bir bağı/ilişkisi bulunmayan alakasız tezleri (örneğin sadece kuramsal yaklaşımı benziyor veya benzer kavramları içeriyor diye listeye sızanları) doğrudan ele.
3. **Kategorik Sıralama ve Eşitlik Çözümü**: Elenmeyen adaylar arasından en çok eksende "Tam Çakışma" gösteren adayları en üst sıraya alacak şekilde risk seviyesine göre sırala. Eşitlik durumunda, "Araştırma Sorusu" ve "Teorik/Kuramsal Altyapı" eksenlerinde en doğrudan çakışmayı barındıran adayı kesin olarak öne geçir.
4. **Kota Esnekliği**: Sıralamadaki en riskli ve elenmemiş adaylardan en fazla 6 adayı seç. Herhangi bir kota doldurma zorunluluğu yoktur; eğer risk oluşturan aday sayısı 6'dan az ise (hatta hiç yoksa), sadece gerçekten çakışma riski barındıran adayların ID'lerini seçerek listeyi tamamla. Kota doldurmak adına alakasız tezleri asla listeye dahil etme.
</instructions>

<constraints>
- Kapı Bekçisi (Gatekeeper) İlkesi: Hedef tezle Konu (Araştırma Nesnesi) veya Dönem bağı olmayan alakasız adayları mutlak suretle ele. Yapay kota doldurma zorunluluğu yoktur; çıktı dizisindeki ID sayısı en fazla 6 olmalıdır, ancak riskli aday yoksa 6'dan daha az (0 dahil) ID de dönebilirsin.
- Objektif Risk Analizi: Özgünlüğü tehdit eden unsurları değerlendirirken model içi varsayımlardan kaçın; sadece adayların özetlerinde (abstract) açıkça yazan ifadelere odaklan.
- Zaman Algısı: Aday tezlerin güncelliğini ve tarihsel kapsamlarını değerlendirirken şu anki yılın 2026 olduğunu unutma.
</constraints>

<output_format>
Yalnızca deepSiftingSchema yapısına tam uyumlu, seçilen ID'leri içeren geçerli bir JSON nesnesi döndür.
</output_format>
`;

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
  return `
<context>
Hedef Tez Parametreleri (Özgünlüğü Korunacak Çalışma):
- Hedef Tez Başlığı: ${params.studyTitle}
- Hedef Tez Sorusu: ${params.researchQuestion}
- Hedef Tez Teorisi: ${params.theoreticalFramework}
- Hedef Tez Yöntemi: ${params.methodology}
- Hedef Tez Sınırlılıkları: ${params.historicalSpatialLimits}
</context>

<candidates_list>
Kaba Elemeden Geçmiş Aday Akademik Tezler (JSON formatında):
${JSON.stringify(
  params.candidateDetails.map((t) => ({
    id: t.id,
    title: t.title,
    department: t.department,
    abstract: t.abstract,
  })),
)}
</candidates_list>

<task>
Sistem talimatında belirtilen 4 eksenli (Soru, Teori, Yöntem, Bağlam) risk matrisini ve eşitlik bozma kurallarını <candidates_list> üzerindeki tüm adaylara içsel olarak uygula. Hedef tezin özgünlüğünü en çok tehdit eden en riskli 6 aday tezin ID'sini tespit et.
</task>

<final_instruction>
Based on the target thesis parameters and candidate list provided above, execute your internal evaluation plan and return the selected 6 IDs in the required JSON format now.
</final_instruction>
`;
}
