import type { PendingToolCall } from "./types";

export interface ComparisonRow {
  fieldLabel: string;
  oldValue: string;
  newValue: string;
  isWarning?: boolean;
}

const translateBoxType = (type?: unknown) => {
  switch (type) {
    case "SUBJECT_PROBLEM":
      return "Konu ve Problem";
    case "THEORETICAL_FRAMEWORK":
      return "Kuramsal Çerçeve";
    case "PRIMARY_MATERIAL":
      return "Birincil Materyal";
    case "METHODOLOGY":
      return "Yöntem";
    case "RELATED_THESES":
      return "İlgili Tezler";
    default:
      return String(type || "—");
  }
};

const translateTaskStatus = (status?: unknown) => {
  switch (status) {
    case "TODO":
      return "Yapılacak";
    case "IN_PROGRESS":
      return "Devam Ediyor";
    case "DONE":
      return "Tamamlandı";
    default:
      return String(status || "—");
  }
};

/**
 * Maps function tool call parameters and optional previous state into a structured list of Old vs New state rows.
 *
 * @param toolCall - The pending tool call containing parameters and optional previous state.
 * @returns The list of comparison rows.
 */
export function getComparisonRows(toolCall: PendingToolCall): ComparisonRow[] {
  const { name, args, previousState } = toolCall;
  const rows: ComparisonRow[] = [];

  switch (name) {
    case "createBox": {
      rows.push({
        fieldLabel: "Kutu Başlığı",
        oldValue: "(Yok - Yeni Öğe)",
        newValue: (args.title as string) || "—",
      });
      if (args.boxType) {
        rows.push({
          fieldLabel: "Kutu Kategorisi",
          oldValue: "—",
          newValue: translateBoxType(args.boxType),
        });
      }
      if (args.description) {
        rows.push({
          fieldLabel: "Açıklama",
          oldValue: "—",
          newValue: args.description as string,
        });
      }
      break;
    }

    case "updateBox": {
      rows.push({
        fieldLabel: "Kutu ID",
        oldValue: `#${args.boxId}`,
        newValue: `#${args.boxId}`,
      });
      if (args.title !== undefined) {
        rows.push({
          fieldLabel: "Kutu Başlığı",
          oldValue:
            (previousState?.title as string) ||
            "(Değiştirilmedi / Mevcut Başlık)",
          newValue: (args.title as string) || "—",
        });
      }
      if (args.description !== undefined) {
        rows.push({
          fieldLabel: "Kutu Açıklaması",
          oldValue:
            (previousState?.description as string) ||
            "(Henüz Açıklama Eklenmemiş / Boş)",
          newValue: (args.description as string) || "—",
        });
      }
      break;
    }

    case "deleteBox": {
      rows.push({
        fieldLabel: `Kutu #${args.boxId}`,
        oldValue: (previousState?.title as string) || `Kutu #${args.boxId}`,
        newValue: "Veritabanından Kalıcı Olarak Silinecek ⚠️",
        isWarning: true,
      });
      break;
    }

    case "updateThesisMatrix": {
      if (args.subjectProblem !== undefined) {
        rows.push({
          fieldLabel: "Konu ve Problem",
          oldValue:
            (previousState?.subjectProblem as string) ||
            "(Henüz Girilmemiş / Boş)",
          newValue: (args.subjectProblem as string) || "(Temizlenecek)",
        });
      }
      if (args.theoreticalFramework !== undefined) {
        rows.push({
          fieldLabel: "Kuramsal Çerçeve",
          oldValue:
            (previousState?.theoreticalFramework as string) ||
            "(Henüz Girilmemiş / Boş)",
          newValue: (args.theoreticalFramework as string) || "(Temizlenecek)",
        });
      }
      if (args.primaryMaterial !== undefined) {
        rows.push({
          fieldLabel: "Birincil Materyal",
          oldValue:
            (previousState?.primaryMaterial as string) ||
            "(Henüz Girilmemiş / Boş)",
          newValue: (args.primaryMaterial as string) || "(Temizlenecek)",
        });
      }
      if (args.methodology !== undefined) {
        rows.push({
          fieldLabel: "Yöntem & Metodoloji",
          oldValue:
            (previousState?.methodology as string) ||
            "(Henüz Girilmemiş / Boş)",
          newValue: (args.methodology as string) || "(Temizlenecek)",
        });
      }
      break;
    }

    case "createTask": {
      rows.push({
        fieldLabel: "Görev Başlığı",
        oldValue: "(Yok - Yeni Görev)",
        newValue: (args.title as string) || "—",
      });
      if (args.status) {
        rows.push({
          fieldLabel: "Kanban Durumu",
          oldValue: "—",
          newValue: translateTaskStatus(args.status),
        });
      }
      break;
    }

    case "updateTaskStatus": {
      rows.push({
        fieldLabel: `Görev #${args.taskId}`,
        oldValue: translateTaskStatus(previousState?.status) || "Mevcut Durum",
        newValue: translateTaskStatus(args.status),
      });
      break;
    }

    case "addNote": {
      rows.push({
        fieldLabel: "Kaynak ID & Sayfa",
        oldValue: "—",
        newValue: `Kaynak #${args.sourceId} ${args.pageNumber ? `(s. ${args.pageNumber})` : ""}`,
      });
      if (args.content) {
        rows.push({
          fieldLabel: "Not / Alıntı İçeriği",
          oldValue: "(Yok - Yeni Not)",
          newValue: args.content as string,
        });
      }
      break;
    }

    case "deleteSource": {
      rows.push({
        fieldLabel: `Kaynak #${args.sourceId}`,
        oldValue:
          (previousState?.title as string) || `Kaynak #${args.sourceId}`,
        newValue: "Kütüphaneden Silinecek ⚠️",
        isWarning: true,
      });
      break;
    }

    case "deleteNote": {
      rows.push({
        fieldLabel: `Not #${args.noteId}`,
        oldValue: (previousState?.content as string) || `Not #${args.noteId}`,
        newValue: "Not Silinecek ⚠️",
        isWarning: true,
      });
      break;
    }

    default: {
      for (const [key, value] of Object.entries(args)) {
        rows.push({
          fieldLabel: key,
          oldValue: String(previousState?.[key] ?? "Mevcut Değer"),
          newValue:
            typeof value === "object" ? JSON.stringify(value) : String(value),
        });
      }
    }
  }

  return rows;
}

/**
 * Returns a Turkish human-readable category badge label for a tool name.
 *
 * @param name - The function tool name.
 * @returns The Turkish category label.
 */
export function getToolCategoryLabel(name: string): string {
  switch (name) {
    case "updateThesisMatrix":
      return "Tez Matrisi Güncellemesi";
    case "createBox":
    case "updateBox":
    case "deleteBox":
      return "Kutu Yönetim İşlemi";
    case "updateSource":
    case "deleteSource":
      return "Kütüphane Kaynak İşlemi";
    case "addNote":
    case "deleteNote":
      return "Not ve Alıntı İşlemi";
    case "createTask":
    case "updateTaskStatus":
      return "Kanban Görev İşlemi";
    default:
      return "Veritabanı Değişiklik İsteği";
  }
}
