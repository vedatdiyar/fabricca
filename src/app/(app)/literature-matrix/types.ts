/** 5-dimensional critique structure stored per resource. */
export interface MatrixCritiqueData {
  id?: number;
  researchQuestion: string | null;
  theoreticalFramework: string | null;
  methodology: string | null;
  mainArgument: string | null;
  literatureGap: string | null;
}

/** Complete matrix row data joining a source, its box title, citation count, and critique. */
export interface MatrixSourceRow {
  id: number;
  title: string;
  authors: string[] | null;
  publicationYear: number | null;
  publisher: string | null;
  doi: string | null;
  thesisType: string | null;
  isRead: boolean;
  pdfStatus: string;
  comparisonNote: string | null;
  boxId: number;
  boxTitle: string | null;
  boxType: string | null;
  annotationCount: number;
  critique: MatrixCritiqueData | null;
}

/** Keys corresponding to editable critique fields in the DB. */
export type CritiqueFieldKey =
  | "researchQuestion"
  | "theoreticalFramework"
  | "methodology"
  | "mainArgument"
  | "literatureGap";

/** Keys corresponding to direct source field updates. */
export type EditableSourceFieldKey = "comparisonNote" | "isRead";

/** Column visibility state map for the matrix grid. */
export type MatrixColumnVisibility = Record<string, boolean>;

/** Available fields for sorting matrix rows. */
export type MatrixSortField = "title" | "publicationYear" | "boxTitle";

/** Direction of table sorting. */
export type MatrixSortDirection = "asc" | "desc";

/** Filter options for matrix grid. */
export interface MatrixFilterConfig {
  searchTerm: string;
  boxId: number | "all";
  readStatus: "all" | "read" | "unread";
}

/** Summary statistics for matrix header. */
export interface MatrixStats {
  totalSources: number;
  readSources: number;
  completedCritiques: number;
  uniqueBoxes: number;
}
