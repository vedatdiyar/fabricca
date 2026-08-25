import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/core/db";
import { matrices, boxes } from "@/core/db/schema";
import { eq } from "drizzle-orm";
import { BoxManagerView } from "../_components/box-manager";
import { Card } from "@/components/ui/card";

export default async function ThesisBoxesPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const userMatrix = await db.query.matrices.findFirst({
    where: eq(matrices.userId, session.userId),
  });

  if (!userMatrix) {
    return (
      <div className="w-full space-y-6">
        <Card className="flex flex-col items-center justify-center rounded-md border border-dashed border-border/40 p-8 text-center bg-card">
          <p className="font-serif text-sm font-semibold tracking-tight text-foreground">
            Tez matrisi henüz oluşturulmadı
          </p>
          <p className="mt-1 font-sans text-xs text-muted-foreground">
            Lütfen onboarding adımlarını tamamlayın.
          </p>
        </Card>
      </div>
    );
  }

  const userBoxes = await db.query.boxes.findMany({
    where: eq(boxes.matrixId, userMatrix.id),
    with: {
      sources: {
        columns: { id: true },
      },
      tasks: {
        columns: { id: true },
      },
    },
  });

  return (
    <div className="w-full space-y-6">
      {/* Main Box Manager View */}
      <BoxManagerView boxesList={userBoxes} />
    </div>
  );
}
