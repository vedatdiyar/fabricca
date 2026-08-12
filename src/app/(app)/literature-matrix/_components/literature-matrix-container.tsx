"use client";

import React, { useState, useMemo } from "react";
import { LiteratureMatrixStats } from "./literature-matrix-stats";
import { LiteratureMatrixToolbar } from "./literature-matrix-toolbar";
import {
  LiteratureMatrixTable,
  MATRIX_COLUMNS,
} from "./literature-matrix-table";
import {
  updateMatrixCritiqueAction,
  updateMatrixSourceAction,
} from "../actions";
import type {
  MatrixSourceRow,
  CritiqueFieldKey,
  MatrixColumnVisibility,
  MatrixSortField,
  MatrixSortDirection,
  MatrixFilterConfig,
  MatrixStats,
} from "../types";

interface LiteratureMatrixContainerProps {
  initialRows: MatrixSourceRow[];
  initialBoxes: Array<{ id: number; title: string }>;
}

/**
 * Main client container managing interactive state, filtering, sorting, inline cell edits, and CSV exports.
 *
 * @param root0 - Component props.
 * @param root0.initialRows - Initial matrix source rows fetched from server.
 * @param root0.initialBoxes - Initial user topic boxes for filtering.
 * @returns The container markup.
 */
export function LiteratureMatrixContainer({
  initialRows,
  initialBoxes,
}: LiteratureMatrixContainerProps) {
  const [rows, setRows] = useState<MatrixSourceRow[]>(initialRows);
  const [boxes] = useState(initialBoxes);

  const [filters, setFilters] = useState<MatrixFilterConfig>({
    searchTerm: "",
    boxId: "all",
    readStatus: "all",
  });

  const [sortConfig, setSortConfig] = useState<{
    field: MatrixSortField;
    direction: MatrixSortDirection;
  }>({
    field: "title",
    direction: "asc",
  });

  const [columnVisibility, setColumnVisibility] =
    useState<MatrixColumnVisibility>({
      title: true,
      boxTitle: true,
      researchQuestion: true,
      theoreticalFramework: true,
      methodology: true,
      mainArgument: true,
      literatureGap: true,
    });

  // Calculate summary metrics
  const stats = useMemo<MatrixStats>(() => {
    const totalSources = rows.length;
    const readSources = rows.filter((r) => r.isRead).length;
    const completedCritiques = rows.filter(
      (r) =>
        r.critique &&
        (r.critique.researchQuestion ||
          r.critique.theoreticalFramework ||
          r.critique.methodology ||
          r.critique.mainArgument ||
          r.critique.literatureGap),
    ).length;
    const uniqueBoxes = new Set(rows.map((r) => r.boxId)).size;

    return {
      totalSources,
      readSources,
      completedCritiques,
      uniqueBoxes,
    };
  }, [rows]);

  // Handle header click sorting
  const handleSortChange = (field: MatrixSortField) => {
    setSortConfig((prev) => ({
      field,
      direction:
        prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Filter and sort matrix rows
  const processedRows = useMemo(() => {
    return rows
      .filter((row) => {
        // Search term check across title, authors, doi, critique texts
        if (filters.searchTerm.trim() !== "") {
          const term = filters.searchTerm.toLowerCase();
          const matchTitle = row.title.toLowerCase().includes(term);
          const matchAuthors =
            row.authors?.some((a) => a.toLowerCase().includes(term)) ?? false;
          const matchCritique =
            (row.critique?.researchQuestion?.toLowerCase().includes(term) ??
              false) ||
            (row.critique?.theoreticalFramework?.toLowerCase().includes(term) ??
              false) ||
            (row.critique?.methodology?.toLowerCase().includes(term) ??
              false) ||
            (row.critique?.mainArgument?.toLowerCase().includes(term) ??
              false) ||
            (row.critique?.literatureGap?.toLowerCase().includes(term) ??
              false);

          if (!matchTitle && !matchAuthors && !matchCritique) {
            return false;
          }
        }

        // Box filter
        if (filters.boxId !== "all" && row.boxId !== filters.boxId) {
          return false;
        }

        // Read status filter
        if (filters.readStatus === "read" && !row.isRead) return false;
        if (filters.readStatus === "unread" && row.isRead) return false;

        return true;
      })
      .sort((a, b) => {
        const { field, direction } = sortConfig;
        const factor = direction === "asc" ? 1 : -1;

        if (field === "title") {
          return a.title.localeCompare(b.title, "tr") * factor;
        }
        if (field === "publicationYear") {
          return ((a.publicationYear ?? 0) - (b.publicationYear ?? 0)) * factor;
        }
        if (field === "boxTitle") {
          return (
            (a.boxTitle ?? "").localeCompare(b.boxTitle ?? "", "tr") * factor
          );
        }
        return 0;
      });
  }, [rows, filters, sortConfig]);

  // Cell edit handler for critique fields
  const handleSaveCritiqueField = async (
    sourceId: number,
    field: CritiqueFieldKey,
    newValue: string,
  ) => {
    const res = await updateMatrixCritiqueAction(sourceId, field, newValue);
    if (res.success && res.data) {
      setRows((prev) =>
        prev.map((row) =>
          row.id === sourceId
            ? {
                ...row,
                critique: {
                  ...row.critique,
                  id: res.data.id,
                  researchQuestion: res.data.researchQuestion,
                  theoreticalFramework: res.data.theoreticalFramework,
                  methodology: res.data.methodology,
                  mainArgument: res.data.mainArgument,
                  literatureGap: res.data.literatureGap,
                },
              }
            : row,
        ),
      );
    }
  };

  // Toggle source read status
  const handleToggleReadStatus = async (
    sourceId: number,
    currentStatus: boolean,
  ) => {
    const nextStatus = !currentStatus;
    // Optimistic UI update
    setRows((prev) =>
      prev.map((r) => (r.id === sourceId ? { ...r, isRead: nextStatus } : r)),
    );

    const res = await updateMatrixSourceAction(sourceId, {
      isRead: nextStatus,
    });
    if (!res.success) {
      // Revert on failure
      setRows((prev) =>
        prev.map((r) =>
          r.id === sourceId ? { ...r, isRead: currentStatus } : r,
        ),
      );
    }
  };

  // Cell edit handler for comparison note
  const handleSaveComparisonNote = async (
    sourceId: number,
    newValue: string,
  ) => {
    const res = await updateMatrixSourceAction(sourceId, {
      comparisonNote: newValue,
    });
    if (res.success) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === sourceId ? { ...r, comparisonNote: newValue } : r,
        ),
      );
    }
  };

  // CSV Export with UTF-8 BOM
  const handleExportCSV = () => {
    const headers = [
      "Kaynak Başlığı",
      "Yazarlar",
      "Yıl",
      "Tema / Kutu",
      "Araştırma Sorusu",
      "Teorik Çerçeve",
      "Metodoloji",
      "Temel Argüman",
      "Literatür Boşluğu",
    ];

    const csvRows = processedRows.map((row) => [
      `"${(row.title || "").replace(/"/g, '""')}"`,
      `"${(row.authors?.join(", ") || "").replace(/"/g, '""')}"`,
      row.publicationYear ?? "",
      `"${(row.boxTitle || "").replace(/"/g, '""')}"`,
      `"${(row.critique?.researchQuestion || "").replace(/"/g, '""')}"`,
      `"${(row.critique?.theoreticalFramework || "").replace(/"/g, '""')}"`,
      `"${(row.critique?.methodology || "").replace(/"/g, '""')}"`,
      `"${(row.critique?.mainArgument || "").replace(/"/g, '""')}"`,
      `"${(row.critique?.literatureGap || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(";"), ...csvRows.map((r) => r.join(";"))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `literatur_matrisi_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetFilters = () => {
    setFilters({
      searchTerm: "",
      boxId: "all",
      readStatus: "all",
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <LiteratureMatrixStats stats={stats} />

      {/* Toolbar & Filters */}
      <LiteratureMatrixToolbar
        filters={filters}
        onFilterChange={setFilters}
        availableBoxes={boxes}
        columnVisibility={columnVisibility}
        allColumns={MATRIX_COLUMNS}
        onColumnVisibilityChange={setColumnVisibility}
        onExportCSV={handleExportCSV}
        onResetFilters={handleResetFilters}
      />

      {/* Data Table */}
      <LiteratureMatrixTable
        rows={processedRows}
        columnVisibility={columnVisibility}
        sortField={sortConfig.field}
        sortDirection={sortConfig.direction}
        onSortChange={handleSortChange}
        onSaveCritiqueField={handleSaveCritiqueField}
      />
    </div>
  );
}
