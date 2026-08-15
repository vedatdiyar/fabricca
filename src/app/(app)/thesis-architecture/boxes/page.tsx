export const instant = false;

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { matrices, boxes } from "@/db/schema";
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
        <div className="flex w-full flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
              Konu Kutuları ve Araştırma Temaları
            </h1>
            <p className="font-sans text-sm text-muted-foreground mt-1">
              Tezinizin araştırma eksenlerini gruplandıran tematik bilgi ve
              kaynak havuzları.
            </p>
          </div>
        </div>

        <Card className="flex flex-col items-center justify-center rounded-md border border-dashed border-border/40 p-8 text-center bg-card">
          <p className="font-serif text-base font-medium tracking-tight text-foreground">
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
      {/* Page Header */}
      <div className="flex w-full flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
            Konu Kutuları ve Araştırma Temaları
          </h1>
          <p className="font-sans text-sm text-muted-foreground mt-1">
            Tezinizin araştırma eksenlerini gruplandıran tematik bilgi, kavram
            ve literatür havuzları.
          </p>
        </div>
      </div>

      {/* Main Box Manager View */}
      <BoxManagerView boxesList={userBoxes} />
    </div>
  );
}
