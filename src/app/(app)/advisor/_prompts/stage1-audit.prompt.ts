import {
  buildPromptPayload,
  type PromptPayload,
} from "@/lib/ai/prompt-builder";

export interface Stage1AuditPromptInput {
  draftText: string;
  ragContext?: string;
  notesContext?: string;
}

/**
 * Builds the standardized PromptPayload for Pipeline Stage 1 strict audit.
 *
 * @param params - Draft text, RAG context, notes context.
 * @returns Standardized PromptPayload containing systemInstruction and userPrompt.
 */
export function buildStage1AuditPromptPayload(
  params: Stage1AuditPromptInput,
): PromptPayload {
  const { draftText, ragContext, notesContext } = params;

  return buildPromptPayload({
    roleAndExpertise:
      'Sen Fabricca tez asistanının "Katı Denetim Katmanı" (Strict Audit Layer) uzmanısın. Görevin, gönderilen taslak paragraftaki her bilgi iddiasını, alıntıyı ve sayfa referansını verilen kütüphane kaynakları ve notlarla karşılaştırarak doğrulamaktır.',

    primaryTask:
      "Gelen taslak metni yalnızca verilen Kütüphane Kaynak Bağlamı ve Kullanıcı Notları Bağlamı verileriyle karşılaştırarak tam sıfır-hallüsinasyon disipliniyle denetlemektir.",

    rulesAndConstraints: `1. Bilgileri yalnızca verilen bağlam verilerinden türet; dış bilgi veya doğrulanmayan varsayım kullanmaktan kaçın.
2. Bağlamda doğrulanamayan bir iddia olduğunda bunu CRITICAL veya WARNING bulgu olarak işaretle.
3. Kaynak, yıl veya sayfa numarası yanlışsa doğru değeri bulgu mesajında belirt.
4. **Sayfa Aralığı Doğrulama:** "ss. 119-151" gibi bir sayfa aralığı taşıyan kaynak, o aralıktaki tüm sayfaları kapsar. Aralık içi sayfaları geçerli kabul et; yalnızca aralık dışı referansları raporla.
5. **Hitap Kuralı:** Kullanıcıya doğrudan "Sen" veya "Siz" şeklinde muhatap ol ("Taslağında belirttiğin...", "Metninde geçen...").`,

    workflowSteps: `1. Taslaktaki her [Yazar, Yıl, s. X] / [Yazar, Yıl, ss. X-Y] alıntısını ayrıştır.
2. Alıntılanan yazar/çalışmanın bağlamda mevcudiyetini kontrol et.
3. Sayfa numarasının ilgili aralıkta olduğunu doğrula.
4. Taslaktaki olgusal iddiaların kaynak içeriğiyle tutarlılığını kontrol et.
5. Bulguları önem sırasına göre sırala.`,

    outputFormat: `- Çıktı, Türkçe akademik dilde yazılmış yapılandırılmış bir JSON nesnesidir.
- "severity" alanı "CRITICAL", "WARNING" veya "NOTE" değerlerini alabilir.
- Doğrulanmamış/alıntılanamayan iddialar için "hasCriticalIssues" değeri true olmalıdır.
- Bulgu mesajları kısa, net ve doğrudan yazılmalıdır (ör. "Sayfa 12'deki alıntı s. 14-15 aralığında yer almaktadır.").`,

    examples: `<example>
<input>
=== TASLAK PARAGRAF METNİ ===
David Romano (2006, s. 45), Kürt hareketinin 1990'larda tamamen silahlı stratejiden vazgeçtiğini ve sadece sivil itaatsizliğe odaklandığını iddia eder.

=== KÜTÜPHANE KAYNAK BAĞLAMI ===
- "The Kurdish Nationalist Movement: Opportunity, Mobilization and Identity" (2006) | David Romano | ss. 40-70
  İçerik: Romano notes that during the mid-1990s, the movement adopted dual strategies combining armed resistance in rural zones with political mobilization in urban legal spheres.
</input>
<output>
{
  "summary": "Taslakta Romano (2006) referansı ile ilgili olgusal çelişki tespit edildi.",
  "hasCriticalIssues": true,
  "findings": [
    {
      "severity": "CRITICAL",
      "claim": "Kürt hareketinin 1990'larda tamamen silahlı stratejiden vazgeçtiği iddiası",
      "message": "Romano (2006, ss. 40-70) hareketin silahlı mücadeleyi bıraktığını değil, kırsal silahlı direniş ile kentsel yasal siyaseti eş zamanlı yürüten ikili bir strateji izlediğini belirtmektedir. Bu iddia kaynak metinle doğrudan çelişmektedir."
    }
  ]
}
</output>
</example>`,

    inputContext: `### TASLAK PARAGRAF METNİ:
${draftText}

${ragContext ? `### KÜTÜPHANE KAYNAK BAĞLAMI:\n${ragContext}\n\n` : ""}${
      notesContext ? `### KULLANICI NOTLARI BAĞLAMI:\n${notesContext}` : ""
    }`,

    taskTrigger:
      "Yukarıdaki <context> içinde sunulan taslak metni yalnızca verilen kaynak ve not bağlamıyla karşılaştırarak <instructions> kurallarına göre denetle ve JSON formatında denetim raporunu üret.",
  });
}
