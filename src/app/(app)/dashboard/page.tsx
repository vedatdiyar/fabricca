import { eq, asc, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import {
  thesisMatrices,
  thesisBoxes,
  libraryResources,
  tasks,
} from "@/db/schema";
import { getSession } from "@/session";
import { Button } from "@/components/ui/button";
import { reopenOnboardingAction } from "@/app/(app)/actions";
import { DashboardContent } from "./_components/dashboard-content";

/**
 * Dashboard (Genel Özet) sayfası.
 * Sunucu tarafında veri tabanından konu kutularını ve makaleleri çekip
 * etkileşimli DashboardContent bileşenine aktarır.
 */
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // 1. Kullanıcının tez matrisini çek
  const [matrix] = await db
    .select()
    .from(thesisMatrices)
    .where(eq(thesisMatrices.userId, session.userId));

  if (!matrix) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">
          Henüz bir tez matrisi oluşturulmamış. Lütfen onboarding adımlarını
          tamamlayın.
        </p>
      </div>
    );
  }

  // 2. Tüm flat satırları (master + sub) çek, parentId ile ayrıştır
  const allBoxRows = await db
    .select()
    .from(thesisBoxes)
    .where(eq(thesisBoxes.thesisMatrixId, matrix.id))
    .orderBy(asc(thesisBoxes.id));

  // Yalnızca ana kutuları frontend'e yolla
  const dbBoxes = allBoxRows.filter((b) => b.parentId === null);

  // Sub-box ID → master ID haritası (resource remap için)
  const childIdToParentId = new Map<number, number>();
  for (const row of allBoxRows) {
    if (row.parentId !== null) {
      childIdToParentId.set(row.id, row.parentId);
    }
  }

  let dbResources: (typeof libraryResources.$inferSelect)[] = [];

  if (allBoxRows.length > 0) {
    const allBoxIds = allBoxRows.map((b) => b.id);

    // 3. Tüm kutulardaki (master + sub) kaynakları çek
    const rawResources = await db
      .select()
      .from(libraryResources)
      .where(inArray(libraryResources.thesisBoxId, allBoxIds));

    // Sub-box'a bağlı kaynakların thesisBoxId'sini parent master ID'ye yönlendir
    dbResources = rawResources.map((r) => ({
      ...r,
      thesisBoxId: childIdToParentId.get(r.thesisBoxId) ?? r.thesisBoxId,
    }));
  }

  // 4. Kullanıcının kayıtlı görevlerini thesisBoxes ile JOIN yaparak çek (dinamik kutu başlığı)
  const dbTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      thesisBoxId: tasks.thesisBoxId,
      boxTitle: thesisBoxes.title,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .leftJoin(thesisBoxes, eq(tasks.thesisBoxId, thesisBoxes.id))
    .where(eq(tasks.userId, session.userId))
    .orderBy(tasks.createdAt);

  return (
    <div className="w-full space-y-8">
      {/* Page Header */}
      <div className="flex w-full flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
            Genel Özet
          </h1>
          <p className="font-sans text-sm text-muted-foreground mt-1">
            Akademik araştırma sürecinizi, konu kutularınızı ve güncel
            hedeflerinizi tek bir panelden yönetin.
          </p>
        </div>
        <form action={reopenOnboardingAction}>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="gap-2 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            Onboarding&rsquo;e Dön
          </Button>
        </form>
      </div>

      {/* Main dashboard content (interactive) */}
      <DashboardContent
        initialBoxes={dbBoxes}
        initialResources={dbResources}
        initialTasks={dbTasks}
      />
    </div>
  );
}
