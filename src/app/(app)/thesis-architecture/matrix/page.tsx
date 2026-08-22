import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/core/db";
import { matrices } from "@/core/db/schema";
import { eq } from "drizzle-orm";
import { MatrixEditorView } from "../_components/matrix-editor";
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
      <div className="w-full space-y-6">
        <div className="flex w-full flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
          <div>
            <h1 className="font-serif text-xl font-semibold tracking-tight text-foreground">
              Tez Matrisi ve Kuramsal Omurga
            </h1>
            <p className="font-sans text-sm text-muted-foreground mt-1">
              Tezinizin araştırma problemini, kuramsal çerçevesini, ampirik
              kaynaklarını ve metodolojisini yapılandıran 4 temel sütun.
            </p>
          </div>
        </div>

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

  return (
    <div className="w-full space-y-6">
      {/* Page Header */}
      <div className="flex w-full flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
        <div>
          <h1 className="font-serif text-xl font-semibold tracking-tight text-foreground">
            Tez Matrisi ve Kuramsal Omurga
          </h1>
          <p className="font-sans text-sm text-muted-foreground mt-1">
            Tezinizin araştırma problemini, kuramsal çerçevesini, ampirik
            kaynaklarını ve metodolojisini yapılandıran 4 temel sütun.
          </p>
        </div>
      </div>

      {/* Main Matrix Editor View */}
      <MatrixEditorView initialMatrix={userMatrix} />
    </div>
  );
}
