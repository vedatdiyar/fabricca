import { eq, asc, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  thesisMatrices,
  thesisBoxes,
  libraryResources,
  tasks,
} from "@/db/schema";
import { getSession } from "@/session";
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

  // 2. Tez matrisine bağlı konu kutularını çek
  const dbBoxes = await db
    .select()
    .from(thesisBoxes)
    .where(eq(thesisBoxes.thesisMatrixId, matrix.id))
    .orderBy(asc(thesisBoxes.id));

  let dbResources: (typeof libraryResources.$inferSelect)[] = [];

  if (dbBoxes.length > 0) {
    const boxIds = dbBoxes.map((b) => b.id);

    // 3. Konu kutularına ait kütüphane kaynaklarını (makaleleri) çek
    dbResources = await db
      .select()
      .from(libraryResources)
      .where(inArray(libraryResources.thesisBoxId, boxIds));
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
