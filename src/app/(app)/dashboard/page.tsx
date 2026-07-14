import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { reopenOnboardingAction } from "@/app/(app)/actions";
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
        childIdToParentId={childIdToParentId}
      />
    </div>
  );
}
