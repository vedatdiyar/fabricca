export const instant = false;

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { matrices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { MatrixEditorView } from "../_components/matrix-editor-view";
import { Card } from "@/components/ui/card";

export default async function ThesisMatrixPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const userMatrix = await db.query.matrices.findFirst({
    where: eq(matrices.userId, session.userId),
  });

  if (!userMatrix) {
    return (
      <Card className="flex flex-col items-center justify-center rounded-md border border-dashed border-border/40 p-8 text-center">
        <p className="font-sans text-lg font-medium tracking-tight text-foreground">
          Tez matrisi henüz oluşturulmadı
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Lütfen onboarding adımlarını tamamlayın.
        </p>
      </Card>
    );
  }

  return <MatrixEditorView initialMatrix={userMatrix} />;
}
