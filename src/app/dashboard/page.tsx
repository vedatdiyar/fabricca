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
import {
  LayoutDashboard,
  GraduationCap,
  ListTodo,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Plus,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { format, parse } from "date-fns";

export default function DashboardPage() {
  const router = useRouter();
  const [thesisData, setThesisData] = useState<ThesisCoreData | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [recs, setRecs] = useState<LiteratureRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRecs, setIsLoadingRecs] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState("");
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);

  // Helper to format task due dates
  const formatTaskDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return format(parse(dateStr, "yyyy-MM-dd", new Date()), "dd/MM/yyyy");
    } catch (err) {
      return dateStr;
    }
  };

  // Load recommendations from Neon PostgreSQL cache or fetch fresh ones
  const fetchRecommendations = async (
    core: ThesisCoreData,
    forceRefresh = false,
  ) => {
    try {
      setIsLoadingRecs(true);

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
      }
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
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
      } catch (err: any) {
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

  // If redirecting due to lack of thesis constitution
  if (redirecting) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-6 bg-background">
        <div className="size-16 rounded-full border border-primary flex items-center justify-center bg-card shadow-xl">
          <GraduationCap className="size-8 text-primary animate-bounce" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground font-sans">
            Tez Kurulumu Algılanmadı
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto font-sans leading-relaxed">
            Fabricca Tez Karargahı'nı kullanabilmek için öncelikle Tez
            Anayasası'nı oluşturmalısınız. Sohbet mülakatına
            yönlendiriliyorsunuz...
          </p>
        </div>
        <div className="w-16 h-0.5 bg-primary animate-pulse" />
      </div>
    );
  }

  // Beautiful cyberloading state using custom CSS variables (no zinc/gray allowed)
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-background p-6">
        <div className="relative flex items-center justify-center">
          <div className="absolute size-16 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <div className="size-10 rounded-full bg-card border border-border flex items-center justify-center">
            <GraduationCap className="size-5 text-primary animate-pulse" />
          </div>
        </div>
        <p className="text-sm font-sans tracking-widest text-primary mt-6 animate-pulse uppercase">
          Tez Karargahı Yükleniyor...
        </p>
        <p className="text-xs font-sans text-muted-foreground mt-2">
          Veritabanı bağlantısı ve tez anayasası senkronize ediliyor
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-4 bg-background">
        <p className="text-sm text-destructive bg-card border border-destructive p-4 rounded-lg max-w-md">
          {error}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="text-xs font-semibold bg-primary text-primary-foreground px-4 py-2 rounded hover:opacity-90 transition cursor-pointer"
        >
          Yeniden Dene
        </button>
      </div>
    );
  }

  const activeTasks = tasks.filter(
    (t) => t.status === "todo" || t.status === "doing",
  );
  const completedTasks = tasks.filter((t) => t.status === "done");

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
        <span className="text-xs font-sans text-muted-foreground bg-card border border-border px-3 py-1.5 rounded w-fit">
          Siber-Akademik Merkez
        </span>
      </header>

      {/* TEZ ANAYASASI - Mobil Yatay Kaydırma */}
      <div className="lg:hidden space-y-2 mb-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-3">
          <GraduationCap className="size-4 text-primary" />
          <span>Tez Anayasası Özet</span>
        </h2>
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin">
          {thesisData && (
            <>
              <div className="min-w-[85vw] snap-center bg-card border border-border p-5 rounded-lg space-y-3 relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    Tez Başlığı
                  </h3>
                  <p className="text-sm font-bold text-foreground leading-snug line-clamp-2">
                    {thesisData.title}
                  </p>
                </div>
                <div className="text-[10px] text-muted-foreground pt-2 border-t border-border mt-2">
                  <strong className="text-foreground">Soru:</strong>{" "}
                  {thesisData.researchQuestion}
                </div>
              </div>

              <div className="min-w-[85vw] snap-center bg-card border border-border p-5 rounded-lg space-y-2 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Ana Argüman
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-5">
                  {thesisData.argument}
                </p>
              </div>

              <div className="min-w-[85vw] snap-center bg-card border border-border p-5 rounded-lg space-y-2 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Metodoloji & Yöntem
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-5">
                  {thesisData.methodology}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ÜST KATMAN: Tez Anayasası Bloğu (Masaüstü) */}
      {thesisData && (
        <div className="hidden lg:block w-full border border-border bg-card p-6 rounded-lg shadow-xl space-y-6 mb-8">
          <div className="pb-4 border-b border-border">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <GraduationCap className="size-5 text-primary" />
              <span>Tez Anayasası</span>
            </h2>
            <p className="text-xs text-muted-foreground font-sans mt-0.5">
              Tezin teorik çatısı — stratejik parametreler ve yön belirleyiciler
            </p>
          </div>
          <div className="space-y-4">
            <div className="bg-background border border-border rounded-lg p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary mb-2">
                Tez Başlığı
              </h3>
              <p className="text-sm font-bold text-foreground leading-snug">
                {thesisData.title}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-background border border-border rounded-lg p-5 relative overflow-hidden h-full flex flex-col justify-between">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    Araştırma Sorusu
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {thesisData.researchQuestion}
                  </p>
                </div>
              </div>
              <div className="bg-background border border-border rounded-lg p-5 relative overflow-hidden h-full flex flex-col justify-between">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    Ana Argüman
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {thesisData.argument}
                  </p>
                </div>
              </div>
              <div className="bg-background border border-border rounded-lg p-5 relative overflow-hidden h-full flex flex-col justify-between">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    Metodoloji & Dönem
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {thesisData.methodology}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KATMAN 2: Aktif Araştırma Planı ve Görevler (Tam Genişlik) */}
      <div className="w-full border border-border bg-card p-6 rounded-lg shadow-xl space-y-6 mb-8">
        <div className="flex flex-row items-center justify-between gap-4 w-full pb-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <ListTodo className="size-5 text-primary" />
              <span>Aktif Araştırma Planı ve Görevler</span>
            </h2>
            <p className="text-xs text-muted-foreground font-sans mt-0.5">
              Haftalık çalışma planınızdaki aktif hedefler ve yazım aşamaları
            </p>
          </div>
          <button
            onClick={() => router.push("/tasks")}
            className="text-xs font-semibold whitespace-nowrap bg-accent text-accent-foreground border border-border px-3.5 py-2 rounded hover:bg-background transition cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <Plus className="size-3.5 text-primary" />
            <span>Görev Ekle / Yönet</span>
          </button>
        </div>

        <div className="space-y-3">
          {activeTasks.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg py-10 text-center text-xs text-muted-foreground flex flex-col justify-center items-center gap-3">
              <ListTodo className="size-8 text-muted-foreground" />
              <div>
                <p className="font-semibold text-foreground">
                  Aktif Araştırma Görevi Bulunmuyor
                </p>
                <p className="text-[11px] mt-1">
                  Süreci ilerletmek için hemen bir araştırma hedefi veya makale
                  inceleme görevi ekleyin.
                </p>
              </div>
            </div>
          ) : (
            activeTasks.map((task) => (
              <div
                key={task.id}
                className="bg-background border border-border p-4 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-primary transition duration-150 relative overflow-hidden"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {task.dueDate && (
                      <div className="flex items-center gap-1 text-[9px] text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
                        <Calendar className="size-3 text-primary" />
                        <span>{formatTaskDate(task.dueDate)}</span>
                      </div>
                    )}
                    <span
                      className={`text-[9px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        task.status === "doing"
                          ? "bg-secondary text-primary border-primary animate-pulse"
                          : "bg-secondary text-muted-foreground border-border"
                      }`}
                    >
                      {task.status === "doing" ? "Çalışılıyor" : "Yapılacak"}
                    </span>
                  </div>
                  <p className="text-xs font-sans text-foreground whitespace-pre-wrap leading-relaxed">
                    {task.taskDescription}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {updatingTaskId === task.id ? (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  ) : (
                    <>
                      {task.status === "todo" && (
                        <button
                          onClick={() => handleUpdateStatus(task.id, "doing")}
                          className="flex items-center gap-1.5 text-[10px] font-semibold text-primary bg-accent hover:bg-background border border-border px-3 py-1.5 rounded transition duration-150 cursor-pointer"
                        >
                          <span>Başla</span>
                          <ArrowRight className="size-3" />
                        </button>
                      )}

                      {task.status === "doing" && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(task.id, "todo")}
                            className="text-[10px] font-semibold text-muted-foreground hover:text-foreground bg-accent border border-border px-2.5 py-1.5 rounded transition duration-150 cursor-pointer"
                            title="Geri Al"
                          >
                            <ArrowLeft className="size-3" />
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(task.id, "done")}
                            className="flex items-center gap-1.5 text-[10px] font-semibold text-primary bg-accent hover:bg-background border border-border px-3 py-1.5 rounded transition duration-150 cursor-pointer"
                          >
                            <span>Tamamla</span>
                            <CheckCircle2 className="size-3" />
                          </button>
                        </>
                      )}

                      {task.status === "done" && (
                        <button
                          onClick={() => handleUpdateStatus(task.id, "doing")}
                          className="text-[10px] font-semibold text-muted-foreground hover:text-foreground bg-accent border border-border px-2.5 py-1.5 rounded transition duration-150 cursor-pointer"
                          title="Geri Al"
                        >
                          <ArrowLeft className="size-3" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Tamamlanan görevler alt bölümü */}
        {completedTasks.length > 0 && (
          <div className="border-t border-border pt-4 space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="size-4 text-chart-5" />
              <span>Son Tamamlanan Araştırma Görevleri</span>
            </h3>
            {completedTasks.slice(0, 3).map((task) => (
              <div
                key={task.id}
                className="bg-background border border-border p-3.5 rounded-lg flex items-center justify-between gap-4"
              >
                <p className="text-xs font-sans text-muted-foreground line-clamp-1 line-through flex-1">
                  {task.taskDescription}
                </p>
                <button
                  onClick={() => handleUpdateStatus(task.id, "doing")}
                  className="text-[9px] font-bold text-primary bg-accent hover:bg-background border border-border px-2 py-1 rounded transition duration-150 cursor-pointer shrink-0"
                >
                  Geri Al
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KATMAN 3: Haftalık Yapay Zeka Kaynak ve Literatür Önerileri (Tam Genişlik) */}
      <div className="w-full border border-border bg-card p-6 rounded-lg shadow-xl space-y-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pb-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <span>Literatür Önerileri</span>
            </h2>
            <p className="text-xs text-muted-foreground font-sans mt-0.5">
              Tez Anayasanızdaki argüman ve araştırma sorusuna derinlik katacak
              yapay zeka tarafından önerilen temel akademik kaynaklar
            </p>
          </div>
          {thesisData && (
            <button
              disabled={isLoadingRecs}
              onClick={() => fetchRecommendations(thesisData, true)}
              className="text-xs font-semibold border border-primary text-primary bg-background hover:bg-primary hover:text-primary-foreground transition duration-150 rounded px-3.5 py-2 cursor-pointer flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50 shrink-0 whitespace-nowrap"
            >
              <Sparkles className="size-3.5" />
              <span>
                {isLoadingRecs ? "Taranıyor..." : "Literatürü Genişlet"}
              </span>
            </button>
          )}
        </div>

        {isLoadingRecs ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <Loader2 className="size-6 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground mt-3 font-sans">
              Tez anayasasına uygun akademik literatür taranıyor ve analiz
              ediliyor...
            </p>
          </div>
        ) : recs.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg py-8 text-center text-xs text-muted-foreground">
            Tavsiye üretilemedi. Lütfen tez bilgilerinizi onboarding sayfasından
            güncelleyin.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {recs.map((rec, i) => (
              <div
                key={i}
                className="bg-background border border-border p-5 rounded-lg flex flex-col justify-between space-y-4 hover:border-primary transition duration-150"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[9px] font-sans font-bold text-primary bg-secondary px-2 py-0.5 rounded border border-border shrink-0">
                      Öneri #{i + 1}
                    </span>
                    {typeof rec.citationCount === "number" &&
                      rec.citationCount > 0 && (
                        <span className="text-[9px] font-sans font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border shrink-0">
                          Atıf: {rec.citationCount.toLocaleString()}
                        </span>
                      )}
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-foreground mt-2 leading-relaxed">
                      {rec.title}
                    </h4>
                    <p className="text-[10px] text-muted-foreground font-sans">
                      {rec.authors} ({rec.year})
                    </p>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed font-sans border-t border-border pt-2.5">
                    {rec.relevance}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-2 shrink-0">
                  {rec.url && (
                    <a
                      href={rec.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Kaynağa Git</span>
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                  <button
                    onClick={() => router.push("/advisor")}
                    className="text-[10px] font-bold text-muted-foreground hover:text-primary hover:underline flex items-center gap-1 cursor-pointer group"
                  >
                    <span>Danışman Odasında Tartış</span>
                    <ChevronRight className="size-3 transition group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
