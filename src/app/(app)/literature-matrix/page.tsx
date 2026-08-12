import { Metadata } from "next";
import { connection } from "next/server";
import { getLiteratureMatrixData } from "./actions";
import { LiteratureMatrixContainer } from "./_components/literature-matrix-container";

export const instant = false;

export const metadata: Metadata = {
  title: "Literatür Matrisi | Fabricca",
  description:
    "Akademik kaynaklarınızı ve 5 boyutlu eser analizlerinizi Notion esnekliğinde karşılaştırmalı matriste yönetin.",
};

/**
 * Server page component for the Literature Matrix workspace route (/literature-matrix).
 *
 * @returns The page markup containing header title and matrix container.
 */
export default async function LiteratureMatrixPage() {
  await connection();

  const result = await getLiteratureMatrixData();

  const initialRows = result.success && result.data ? result.data.rows : [];
  const initialBoxes = result.success && result.data ? result.data.boxes : [];

  return (
    <div className="space-y-6">
      {/* Page Header Area */}
      <div className="flex flex-col gap-1 pb-4 border-b border-border">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
          Literatür Matrisi
        </h1>
        <p className="text-xs text-muted-foreground">
          Tez kütüphanenizdeki tüm eserlerin 5 boyutlu analizlerini (Araştırma Sorusu,
          Teorik Çerçeve, Metodoloji, Temel Argüman, Literatür Boşluğu) Notion esnekliğinde
          karşılaştırın ve hücre içi tıklama ile anında düzenleyin.
        </p>
      </div>

      {/* Main Workspace Container */}
      <LiteratureMatrixContainer
        initialRows={initialRows}
        initialBoxes={initialBoxes}
      />
    </div>
  );
}
