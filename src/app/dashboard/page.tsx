"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getThesisCoreAction,
  getAcademicRecommendationsAction,
  discoverNewRecommendationsAction,
  ThesisCoreData,
  LiteratureRecommendation,
} from "./actions";
import {
  getTasksAction,
  updateTaskStatusAction,
  TaskItem,
} from "@/app/tasks/actions";
import { LayoutDashboard } from "lucide-react";

// Modular Subcomponents
import { DashboardLoading } from "./_components/dashboard-loading";
import { ThesisConstitution } from "./_components/thesis-constitution";
import { TaskPanel } from "./_components/task-panel";
import { RecommendationGrid } from "./_components/recommendation-grid";
import { PdfUploadDrawer } from "./_components/pdf-upload-drawer";

export default function DashboardPage() {
  const router = useRouter();
  const [thesisData, setThesisData] = useState<ThesisCoreData | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [recs, setRecs] = useState<LiteratureRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRecs, setIsLoadingRecs] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState("");
  const [recsError, setRecsError] = useState("");
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
  const [selectedRec, setSelectedRec] =
    useState<LiteratureRecommendation | null>(null);

  // Load recommendations from Neon PostgreSQL cache or fetch fresh ones
  const fetchRecommendations = async (
    core: ThesisCoreData,
    forceRefresh = false,
  ) => {
    try {
      setIsLoadingRecs(true);
      setRecsError("");

      const recsRes = forceRefresh
        ? await discoverNewRecommendationsAction(
            core.title,
            core.researchQuestion,
            core.argument,
            core.methodology,
          )
        : await getAcademicRecommendationsAction(
            core.title,
            core.researchQuestion,
            core.argument,
            core.methodology,
          );

      if (recsRes.success && recsRes.recommendations) {
        setRecs(recsRes.recommendations);
      } else {
        setRecsError(recsRes.error || "Tavsiyeler yüklenirken hata oluştu.");
      }
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
      setRecsError("API_CONNECTION_FAILURE");
    } finally {
      setIsLoadingRecs(false);
    }
  };

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setIsLoading(true);
        setError("");

        // 1. Fetch thesis core parameters
        const thesisRes = await getThesisCoreAction();

        if (!thesisRes.success) {
          setError(thesisRes.error || "Tez verileri yüklenemedi.");
          setIsLoading(false);
          return;
        }

        if (!thesisRes.data) {
          // If no thesis setup found, trigger the fallback redirection after a brief preview
          setRedirecting(true);
          setIsLoading(false);
          setTimeout(() => {
            router.push("/onboarding");
          }, 2000);
          return;
        }

        setThesisData(thesisRes.data);
        setIsLoading(false);

        // 2. Fetch active tasks
        const tasksRes = await getTasksAction();
        if (tasksRes.success && tasksRes.tasks) {
          setTasks(tasksRes.tasks);
        }

        // 3. Fetch academic literature recommendations using our cache-aware function
        await fetchRecommendations(thesisRes.data, false);
      } catch (err) {
        console.error("Dashboard error:", err);
        setError("Tez Karargahı yüklenirken kritik bir hata oluştu.");
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, [router]);

  // Handle rapid inline task status transition
  const handleUpdateStatus = async (
    taskId: number,
    newStatus: "todo" | "doing" | "done",
  ) => {
    try {
      setUpdatingTaskId(taskId);
      // Optimistic UI state update
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
      );

      const res = await updateTaskStatusAction(taskId, newStatus);
      if (!res.success) {
        // Revert to database state if sync fails
        const tasksRes = await getTasksAction();
        if (tasksRes.success && tasksRes.tasks) {
          setTasks(tasksRes.tasks);
        }
      }
    } catch (err) {
      console.error("Task status update error:", err);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // If redirecting, loading, or an error occurs, show full-screen message
  if (redirecting || isLoading || error) {
    return (
      <DashboardLoading
        redirecting={redirecting}
        isLoading={isLoading}
        error={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground p-6 md:p-10 pb-24 md:pb-10 overflow-y-auto">
      {/* Header */}
      <header className="border-b border-border pb-6 mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <LayoutDashboard className="size-6 text-primary" />
            <span>Tez Karargahı</span>
          </h1>
          <p className="text-sm text-muted-foreground font-sans">
            Tez sürecinizi organize edin, anayasanızı takip edin ve akıllı
            önerilerle literatürünüzü geliştirin
          </p>
        </div>
      </header>

      {/* TEZ ANAYASASI */}
      {thesisData && <ThesisConstitution thesisData={thesisData} />}

      {/* AKTİF GÖREVLER */}
      <TaskPanel
        tasks={tasks}
        updatingTaskId={updatingTaskId}
        onUpdateStatus={handleUpdateStatus}
      />

      {/* LİTERATÜR TAVSİYELERİ */}
      <RecommendationGrid
        recs={recs}
        isLoadingRecs={isLoadingRecs}
        recsError={recsError}
        onRefresh={() => thesisData && fetchRecommendations(thesisData, true)}
        onSelectRec={setSelectedRec}
      />

      {/* PDF YÜKLEME PANELİ */}
      <PdfUploadDrawer
        selectedRec={selectedRec}
        onClose={() => setSelectedRec(null)}
      />
    </div>
  );
}
