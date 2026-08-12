"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BookOpen,
  FileSpreadsheet,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { InlineEditableCell } from "./inline-editable-cell";
import type {
  MatrixSourceRow,
  CritiqueFieldKey,
  MatrixColumnVisibility,
  MatrixSortField,
  MatrixSortDirection,
} from "../types";

export interface ColumnDef {
  key: string;
  label: string;
  sortable?: boolean;
}

export const MATRIX_COLUMNS: ColumnDef[] = [
  { key: "title", label: "Kaynak & Künye", sortable: true },
  { key: "boxTitle", label: "Tema / Kutu", sortable: true },
  { key: "researchQuestion", label: "Araştırma Sorusu" },
  { key: "theoreticalFramework", label: "Teorik / Kavramsal Çerçeve" },
  { key: "methodology", label: "Metodoloji" },
  { key: "mainArgument", label: "Temel Argüman" },
  { key: "literatureGap", label: "Literatür Boşluğu" },
];

interface LiteratureMatrixTableProps {
  rows: MatrixSourceRow[];
  columnVisibility: MatrixColumnVisibility;
  sortField: MatrixSortField;
  sortDirection: MatrixSortDirection;
  onSortChange: (field: MatrixSortField) => void;
  onSaveCritiqueField: (
    sourceId: number,
    field: CritiqueFieldKey,
    newValue: string,
  ) => Promise<void>;
}

/**
 * Renders the Notion-style interactive literature matrix data grid with inline editable cells.
 *
 * @param root0 - Component props.
 * @param root0.rows - Filtered and sorted source rows to display.
 * @param root0.columnVisibility - Map of column key to visibility boolean.
 * @param root0.sortField - Currently active sort field.
 * @param root0.sortDirection - Current sort direction (asc/desc).
 * @param root0.onSortChange - Callback invoked when a header is clicked to sort.
 * @param root0.onSaveCritiqueField - Callback to persist critique cell edits.
 * @param root0.onToggleReadStatus - Callback to toggle source read state.
 * @param root0.onSaveComparisonNote - Callback to persist custom comparison notes.
 * @returns The matrix table markup.
 */
export function LiteratureMatrixTable({
  rows,
  columnVisibility,
  sortField,
  sortDirection,
  onSortChange,
  onSaveCritiqueField,
}: LiteratureMatrixTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center bg-card">
        <FileSpreadsheet className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <h3 className="font-serif text-lg font-medium text-foreground">
          Eşleşen Kaynak Bulunamadı
        </h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          Arama terimlerinizi veya filtreleri değiştirerek veya kütüphanenize yeni
          kaynaklar ekleyerek matrisi genişletebilirsiniz.
        </p>
      </div>
    );
  }

  const renderSortIcon = (field: MatrixSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 text-primary" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 text-primary" />
    );
  };

  const isColVisible = (colKey: string) => columnVisibility[colKey] !== false;

  return (
    <div className="relative w-full overflow-x-auto rounded-lg border border-border bg-card shadow-xs scrollbar-thin scrollbar-thumb-border">
      <table className="w-full text-left border-collapse min-w-[1950px]">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {/* Sticky Header for Source Title */}
            {isColVisible("title") && (
              <th
                onClick={() => onSortChange("title")}
                className="sticky left-0 z-20 cursor-pointer bg-muted/95 backdrop-blur-md p-3.5 min-w-[300px] max-w-[340px] transition-colors hover:text-foreground border-r border-border/60 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)] text-left"
              >
                <div className="flex items-center justify-start gap-1">
                  <span>Kaynak & Künye</span>
                  {renderSortIcon("title")}
                </div>
              </th>
            )}

            {isColVisible("boxTitle") && (
              <th
                onClick={() => onSortChange("boxTitle")}
                className="cursor-pointer p-3.5 min-w-[210px] transition-colors hover:text-foreground text-left"
              >
                <div className="flex items-center justify-start gap-1">
                  <span>Tema / Kutu</span>
                  {renderSortIcon("boxTitle")}
                </div>
              </th>
            )}



            {isColVisible("researchQuestion") && (
              <th className="p-3.5 min-w-[270px] text-left">Araştırma Sorusu</th>
            )}

            {isColVisible("theoreticalFramework") && (
              <th className="p-3.5 min-w-[270px] text-left">Teorik Çerçeve</th>
            )}

            {isColVisible("methodology") && (
              <th className="p-3.5 min-w-[250px] text-left">Metodoloji</th>
            )}

            {isColVisible("mainArgument") && (
              <th className="p-3.5 min-w-[270px] text-left">Temel Argüman</th>
            )}

            {isColVisible("literatureGap") && (
              <th className="p-3.5 min-w-[270px] text-left">Literatür Boşluğu</th>
            )}


          </tr>
        </thead>

        <tbody className="divide-y divide-border text-sm font-sans">
          {rows.map((row) => (
            <tr
              key={row.id}
              className="group transition-colors hover:bg-muted/30"
            >
              {/* Sticky Column: Title & Citation metadata */}
              {isColVisible("title") && (
                <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/90 p-3.5 align-middle text-left min-w-[300px] max-w-[340px] border-r border-border/60 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                  <div className="flex flex-col items-start justify-center text-left space-y-1.5">
                    <div className="flex items-start justify-between gap-1.5 w-full text-left">
                      <span className="font-semibold text-foreground text-sm line-clamp-2 leading-snug text-left">
                        {row.title}
                      </span>
                      {row.doi && (
                        <a
                          href={`https://doi.org/${row.doi}`}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 text-muted-foreground hover:text-primary pt-0.5"
                          title="DOI Bağlantısı"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-x-1.5 text-left">
                      {row.authors && row.authors.length > 0 && (
                        <span>{row.authors.slice(0, 2).join(", ")}</span>
                      )}
                      {row.publicationYear && (
                        <span className="font-mono">({row.publicationYear})</span>
                      )}
                    </div>
                    <div className="pt-1 flex justify-start">
                      <Link
                        href={`/library?resourceId=${row.id}`}
                        className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                      >
                        <BookOpen className="h-3 w-3" />
                        <span>Kütüphanede Aç</span>
                      </Link>
                    </div>
                  </div>
                </td>
              )}

              {/* Box/Theme Badge */}
              {isColVisible("boxTitle") && (
                <td className="p-3.5 align-middle text-left">
                  {row.boxTitle ? (
                    <Badge
                      variant="outline"
                      className="text-xs font-medium border-primary/20 bg-primary/5 text-primary max-w-[200px] whitespace-normal text-left py-1 px-2.5 leading-normal inline-block"
                    >
                      {row.boxTitle}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </td>
              )}



              {/* 5 Critique Fields (Modal Editable) */}
              {isColVisible("researchQuestion") && (
                <td className="p-2 align-middle">
                  <InlineEditableCell
                    title="Araştırma Sorusu"
                    sourceTitle={row.title}
                    value={row.critique?.researchQuestion ?? null}
                    placeholder="Araştırma sorusu ekleyin..."
                    onSave={(val) =>
                      onSaveCritiqueField(row.id, "researchQuestion", val)
                    }
                  />
                </td>
              )}

              {isColVisible("theoreticalFramework") && (
                <td className="p-2 align-middle">
                  <InlineEditableCell
                    title="Teorik Çerçeve"
                    sourceTitle={row.title}
                    value={row.critique?.theoreticalFramework ?? null}
                    placeholder="Teorik çerçeve ekleyin..."
                    onSave={(val) =>
                      onSaveCritiqueField(row.id, "theoreticalFramework", val)
                    }
                  />
                </td>
              )}

              {isColVisible("methodology") && (
                <td className="p-2 align-middle">
                  <InlineEditableCell
                    title="Metodoloji"
                    sourceTitle={row.title}
                    value={row.critique?.methodology ?? null}
                    placeholder="Metodoloji ekleyin..."
                    onSave={(val) =>
                      onSaveCritiqueField(row.id, "methodology", val)
                    }
                  />
                </td>
              )}

              {isColVisible("mainArgument") && (
                <td className="p-2 align-middle">
                  <InlineEditableCell
                    title="Temel Argüman"
                    sourceTitle={row.title}
                    value={row.critique?.mainArgument ?? null}
                    placeholder="Temel argüman ekleyin..."
                    onSave={(val) =>
                      onSaveCritiqueField(row.id, "mainArgument", val)
                    }
                  />
                </td>
              )}

              {isColVisible("literatureGap") && (
                <td className="p-2 align-middle">
                  <InlineEditableCell
                    title="Literatür Boşluğu"
                    sourceTitle={row.title}
                    value={row.critique?.literatureGap ?? null}
                    placeholder="Literatür boşluğu ekleyin..."
                    onSave={(val) =>
                      onSaveCritiqueField(row.id, "literatureGap", val)
                    }
                  />
                </td>
              )}


            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
