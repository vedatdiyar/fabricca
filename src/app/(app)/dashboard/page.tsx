export const instant = false;

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getUsersMatrixAndBoxesWithResources } from "@/app/(app)/_services/box-service";
import { getTasksAction } from "./actions";
import { DashboardContent } from "./_components/dashboard-content";

/**
 * Renders the dashboard overview page with topic boxes, reading lists, and the Kanban board.
 *
 * @returns The rendered dashboard page.
 */
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [boxResult, tasksResult] = await Promise.all([
    getUsersMatrixAndBoxesWithResources(session.userId),
    getTasksAction(),
  ]);

  if ("error" in boxResult) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border/40 bg-card p-8 text-center">
        <p className="font-serif text-lg font-medium tracking-tight text-foreground">
          Tez matrisi henüz oluşturulmadı
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Henüz bir tez matrisi oluşturulmamış. Lütfen onboarding adımlarını
          tamamlayın.
        </p>
      </div>
    );
  }

  const {
    parentBoxes: dbBoxes,
    resources: dbResources,
    childIdToParentId,
    allBoxRows,
  } = boxResult.data;
  const dbTasks = tasksResult.success ? (tasksResult.data ?? []) : [];

  return (
    <div className="w-full space-y-8">
      <DashboardContent
        initialBoxes={dbBoxes}
        initialResources={dbResources}
        initialTasks={dbTasks}
        childIdToParentId={childIdToParentId}
        allBoxRows={allBoxRows}
      />
    </div>
  );
}
