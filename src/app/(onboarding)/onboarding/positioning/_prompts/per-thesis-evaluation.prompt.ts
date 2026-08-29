import type { PositioningMatrixInput } from "../_services/validation";
import type { SiftedThesis } from "../_services/sifting";

/** Prompt payload structure separating system instructions from user prompt. */
export interface PerThesisEvaluationPromptPayload {
  systemInstruction: string;
  userPrompt: string;
}

/**
 * Builds the XML/Markdown hybrid prompt payload for batch per-source evaluation across
 * YÖK theses, global articles, book chapters, and field publications.
 *
 * @param matrix - The 3-field thesis matrix.
 * @param candidateTheses - The batch of candidate literature items to evaluate.
 * @returns Structured prompt payload.
 */
export function buildPerThesisEvaluationPromptPayload(
  matrix: PositioningMatrixInput,
  candidateTheses: SiftedThesis[],
): PerThesisEvaluationPromptPayload {
  const systemInstruction = `<role>
Kıdemli akademik hakem, tez izleme komitesi üyesi ve araştırma metodoloğu.
</role>

<instructions>
# Görev ve Temel İlke
Verilen tez konusunu, kuramsal çerçevesini ve yöntemini baz alarak, aday kaynakları (Tezler, Makaleler, Kitaplar, Raporlar) akademik ilişki ve çakışma riski açısından değerlendir.

# İlgililik Ölçütü:
Aday kaynak; araştırmacının (1) somut ampirik konusuna/aktörlerine, (2) kuramsal modeline/paradigmasına veya (3) yöntemsel desenine doğrudan temas ediyorsa 'isRelevant: true' kabul edilir. Tamamen alakasız bir disiplin veya konu dışı genel metinler 'isRelevant: false' olarak elenmelidir.

# Değerlendirme Ölçütleri:
1. **isRelevant:** Araştırmacının problemine, kuramına veya yöntemine somut bir katkı sunuyor mu?
2. **isDirectOverlap:**
   - Ulusal tez ve dergi makalelerinde: Kullanıcının konusunu, aynı sahada, aynı dönemde ve aynı yöntemle birebir çalışıp araştırmacıya özgün bir boşluk bırakmamış mıdır? (Evet ise true, aksi halde false).
   - Küresel literatürde: Kullanıcının araştırma tasarımını tamamen tüketmiş birebir bir muadil midir?
3. **publicationType:** Kaynağın türü: 'Tez' | 'Makale' | 'Kitap' | 'Kitap Bölümü' | 'Rapor'.
4. **strategicRole:**
   - **FOUNDATIONAL_WORK (Öncül Kuramsal / Temel Çalışma):** Kuramsal modeli, temel kavramları veya tarihsel hattı kuran öncü referans.
   - **METHODOLOGICAL_BENCHMARK (Yöntem ve Model Referansı):** Benzer yöntemi veya saha desenini kullanan metodolojik rehber.
   - **SPECIFIC_FOCUS (Kısmi / Komşu Olgusal Odak):** Konunun spesifik bir alt boyutunu veya yakın vakayı inceleyen çalışma.
   - **ALTERNATIVE_PERSPECTIVE (Karşıt / Farklı Yaklaşım):** Zıt bulgular veya alternatif bir kuramsal açıklama sunan tartışma kaynağı.
5. **contributionAreas:** Kaynağın temas ettiği 1-2 adet kısa akademik odak etiketi.
6. **literaturePosition:** Kaynağın literatürdeki yerini ve neyi incelediğini özetleyen 1 net cümle.
7. **strategicUtility:** Araştırmacının tezinde bu kaynağı nasıl konumlandıracağına dair 1-2 cümlelik rehber not.

# Sınırlamalar
- Yalnızca <context> içinde verilen adayların metin ve özetlerine dayanın.
- Her adayın 'externalThesisId' değerini birebir koruyun.
</instructions>`;

  const thesisItems = candidateTheses
    .map((t, idx) => {
      return `[Kaynak #${idx + 1}]
ID: "${t.id}"
Başlık: ${t.title}
Yazar: ${t.author || "Bilinmiyor"} (${t.year || "N/A"})
Tür/Kanal: ${t.thesisType || "Makale/Tez"}
Kurum/Yayıncı: ${t.university || "N/A"}
Özet: ${(t.abstract || "").slice(0, 1000)}`;
    })
    .join("\n\n---\n\n");

  const userPrompt = `<context>
[Kullanıcı Tez Tasarımı]:
Araştırma Problemi: ${matrix.subjectProblem}
Kuramsal Çerçeve: ${matrix.theoreticalFramework || "Belirtilmemiş"}
Yöntem ve Saha: ${matrix.methodology || "Belirtilmemiş"}

[Değerlendirilecek Aday Kaynaklar]:
${thesisItems}
</context>

<task>
Yukarıdaki aday kaynakları inceleyerek her biri için JSON formatında değerlendirme üret.
</task>`;

  return { systemInstruction, userPrompt };
}
