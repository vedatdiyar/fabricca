import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getUsersMatrixAndBoxesWithResources } from "@/app/(app)/_services/box-service";
import { getTasksAction } from "./actions";
import { DashboardContent } from "./_components/dashboard-content";

/**
 * Dashboard overview page.
 * Fetches the thesis matrix, box hierarchy (with child→parent resource remap),
 * and user tasks in parallel, then renders the interactive DashboardContent.
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">
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
  } = boxResult.data;
  const dbTasks = tasksResult.success ? (tasksResult.data ?? []) : [];

  return (
    <div className="w-full space-y-8">
      <DashboardContent
        initialBoxes={dbBoxes}
        initialResources={dbResources}
        initialTasks={dbTasks}
        childIdToParentId={childIdToParentId}
      />
    </div>
  );
}
