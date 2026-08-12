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
    <div className="w-full space-y-6">
      <LiteratureMatrixContainer
        initialRows={initialRows}
        initialBoxes={initialBoxes}
      />
    </div>
  );
}
