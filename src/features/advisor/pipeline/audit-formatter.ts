import type { AuditReport } from "./types";

/**
 * Renders the Turkish findings list of a Stage 1 audit report.
 *
 * @param audit - The Stage 1 audit report.
 * @returns The rendered bulleted findings list, or the audit summary when empty.
 */
export function formatAuditFindings(audit: AuditReport): string {
  if (audit.findings.length === 0) return audit.summary;

  const SEVERITY_LABELS: Record<string, string> = {
    CRITICAL: "Kritik",
    WARNING: "Uyarı",
    NOTE: "Not",
  };

  return audit.findings
    .map((finding) => {
      const label = SEVERITY_LABELS[finding.severity] ?? finding.severity;
      return `- **${label}:** ${finding.message}`;
    })
    .join("\n");
}

/**
 * Builds the warning text displayed to the user when critical audit issues halt the pipeline.
 *
 * @param findingsText - Formatted bulleted findings text.
 * @returns Formatted warning markdown.
 */
export function buildAuditHaltText(findingsText: string): string {
  return (
    "### Denetim Durduruldu — Kritik Bulgular\n\n" +
    "Taslak paragrafındaki kaynak atıflarında kritik uyumsuzluklar tespit edildi:\n\n" +
    findingsText +
    "\n\n> Devam etmeden önce bu bulguları gidermek için taslağınızı revize ederek yeniden gönderebilir veya onay vererek devam edebilirsiniz."
  );
}

export const FALLBACK_SOCRATIC_TEXT =
  "### Denetim Başarılı\n\n" +
  "Taslak paragrafınız kaynak ve alıntı doğruluğu açısından denetlendi; " +
  "kritik düzeyde bir tutarsızlık tespit edilmedi.\n\n" +
  "Şimdi tezinizin metodolojik çerçevesini ve teorik temellerini eleştirel bir şekilde değerlendirelim: " +
  "Bu taslağınızda kullandığınız kaynakları hangi ölçüte göre seçtiniz ve neden bu kaynakları diğer alternatiflerin üzerine tercih ettiniz?";
