import { eq, asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { thesisMatrices, thesisBoxes } from "@/db/schema";
import { getSession } from "@/proxy";
import { LibraryContent } from "./library-content";

export default async function LibraryPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [matrix] = await db
    .select()
    .from(thesisMatrices)
    .where(eq(thesisMatrices.userId, session.userId));

  if (!matrix) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">
          Henüz bir tez matrisi oluşturulmamış.
        </p>
      </div>
    );
  }

  const boxes = await db
    .select()
    .from(thesisBoxes)
    .where(eq(thesisBoxes.thesisMatrixId, matrix.id))
    .orderBy(asc(thesisBoxes.id));

  return <LibraryContent boxes={boxes} />;
}
