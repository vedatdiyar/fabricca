/**
 * Generates a human-readable Turkish explanation string for pending mutation tool calls.
 *
 * @param name - The function name.
 * @param args - The argument record.
 * @returns The formatted Turkish description for the UI card.
 */
export function formatToolExplanation(
  name: string,
  args: Record<string, unknown>,
): string {
  switch (name) {
    case "updateThesisMatrix":
      return "Tez matrisi alanlarınız güncellenecek.";
    case "createBox":
      return `"${(args.title as string) || "Yeni Kutu"}" başlıklı yeni bir tez kutusu eklenecek.`;
    case "updateBox":
      return `Kutu #${args.boxId} bilgileri güncellenecek.`;
    case "deleteBox":
      return `Kutu #${args.boxId} veritabanından silinecek.`;
    case "updateSource":
      return `Kaynak #${args.sourceId} bilgileri güncellenecek.`;
    case "deleteSource":
      return `Kaynak #${args.sourceId} kütüphanenizden silinecek.`;
    case "addNote":
      return `Kaynak #${args.sourceId} için s. ${args.pageNumber || ""} numaralı yeni bir not/alıntı kaydedilecek.`;
    case "deleteNote":
      return `Not #${args.noteId} silinecek.`;
    case "createTask":
      return `"${(args.title as string) || "Yeni Görev"}" başlıklı çalışma görevi Kanban panosuna eklenecek.`;
    case "updateTaskStatus":
      return `Görev #${args.taskId} durumu "${args.status}" olarak güncellenecek.`;
    case "createOutlineSection":
      return `"${(args.title as string) || "Yeni Bölüm"}" başlıklı tez bölümü planına eklenecek.`;
    case "updateOutlineSection":
      return `Bölüm #${args.outlineId} başlığı ve kapsamı güncellenecek.`;
    case "pinAnnotationToOutline":
      return `Alıntı #${args.annotationId} tez bölümü #${args.outlineId} üzerine kanıt olarak iğnelenecek.`;
    case "unpinAnnotationFromOutline":
      return `Alıntı #${args.annotationId} tez bölümü #${args.outlineId} üzerinden kaldırılacak.`;
    case "linkSourceToOutline":
      return `Kaynak #${args.sourceId} tez bölümü #${args.outlineId} ile ilişkilendirilecek.`;
    case "unlinkSourceFromOutline":
      return `Kaynak #${args.sourceId} tez bölümü #${args.outlineId} bağlantısı kaldırılacak.`;
    default:
      return `${name} veritabanı değişikliği gerçekleştirilecek.`;
  }
}
