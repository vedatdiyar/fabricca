import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getUsersMatrixAndBoxesWithResources } from "./_services/box-service";
import { getTasksAction } from "./task-actions";
import { getTimelineMetricsAction } from "./timeline-actions";
import { DashboardContent } from "./_components/dashboard-content";
import { Card } from "@/components/ui/card";

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

  const [boxResult, tasksResult, timelineResult] = await Promise.all([
    getUsersMatrixAndBoxesWithResources(session.userId),
    getTasksAction(),
    getTimelineMetricsAction(),
  ]);

  if ("error" in boxResult) {
    return (
      <Card className="flex flex-col items-center justify-center rounded-md border border-dashed border-border/40 p-8 text-center">
        <p className="font-serif text-sm font-semibold tracking-tight text-foreground">
          Tez matrisi henüz oluşturulmadı
        </p>
        <p className="mt-1 font-sans text-xs text-muted-foreground">
          Henüz bir tez matrisi oluşturulmamış. Lütfen onboarding adımlarını
          tamamlayın.
        </p>
      </Card>
    );
  }

  const {
    parentBoxes: dbBoxes,
    resources: dbResources,
    childIdToParentId,
    allBoxRows,
  } = boxResult.data;
  const dbTasks = tasksResult.success ? (tasksResult.data ?? []) : [];
  const dbTimeline = timelineResult.success
    ? (timelineResult.data ?? null)
    : null;

  return (
    <div className="w-full space-y-6">
      <DashboardContent
        initialBoxes={dbBoxes}
        initialResources={dbResources}
        initialTasks={dbTasks}
        childIdToParentId={childIdToParentId}
        allBoxRows={allBoxRows}
        initialTimelineMetrics={dbTimeline}
      />
    </div>
  );
}
