"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAcademicRecommendationsAction,
  discoverNewRecommendationsAction,
  ThesisCoreData,
  LiteratureRecommendation,
} from "../actions";
import { LayoutDashboard, Sparkles } from "lucide-react";
import Link from "next/link";

// Modular Subcomponents
import { DashboardLoading } from "./dashboard-loading";
import { ThesisConstitution } from "./thesis-constitution";
import { RecommendationGrid } from "./recommendation-grid";
import { PdfUploadDrawer } from "./pdf-upload-drawer";

interface DashboardClientProps {
  initialThesisData: ThesisCoreData | null;
}

export default function DashboardClient({
  initialThesisData,
}: DashboardClientProps) {
  const router = useRouter();
  const thesisData = initialThesisData;
  const [recs, setRecs] = useState<LiteratureRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [error, setError] = useState("");
  const [recsError, setRecsError] = useState("");
  const [selectedRec, setSelectedRec] =
    useState<LiteratureRecommendation | null>(null);

  // Load recommendations from Neon PostgreSQL cache or fetch fresh ones
  const fetchRecommendations = async (
    core: ThesisCoreData | null,
    forceRefresh = false,
    boxId?: number,
  ) => {
    try {
      setIsLoadingRecs(true);
      setRecsError("");

      if (!core) {
        setRecs([]);
        setRecsError(
          "Tavsiye üretilebilmesi için öncelikle Tez Anayasası'nı oluşturmalısınız.",
        );
        return;
      }

      const recsRes = forceRefresh
        ? await discoverNewRecommendationsAction(
            core.title,
            core.researchQuestion,
            core.argument,
            core.methodology,
            boxId,
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

        // 2. Load recommendations if thesis data exists
        if (initialThesisData) {
          await fetchRecommendations(initialThesisData);
        } else {
          setRecs([]);
          setRecsError(
            "Tavsiye üretilebilmesi için öncelikle Tez Anayasası'nı oluşturmalısınız.",
          );
        }

        setIsLoading(false);
      } catch (err) {
        console.error("Dashboard error:", err);
        setError("Tez Karargahı yüklenirken kritik bir hata oluştu.");
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, [router, initialThesisData]);

  // If loading or an error occurs, show full-screen message
  if (isLoading || error) {
    return (
      <DashboardLoading
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
      {thesisData ? (
        <ThesisConstitution thesisData={thesisData} />
      ) : (
        <div className="w-full border border-border bg-card p-6 rounded-lg shadow-xl relative overflow-hidden mb-8">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Sparkles className="size-5 text-primary animate-pulse" />
                <span>Tez Anayasası Bulunamadı</span>
              </h2>
              <p className="text-sm text-muted-foreground font-sans max-w-2xl leading-relaxed">
                Fabricca&apos;nın akıllı RAG danışmanı, literatür tavsiyeleri ve
                yapay zeka entegrasyon özelliklerinden tam verim alabilmek için
                öncelikle Tez Anayasası&apos;nı oluşturmalısınız. Prof. Dr.
                Verita ile 4 adımlı sohbet mülakatına hemen başlayın.
              </p>
            </div>
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 hover:opacity-90 transition-all shadow-md shrink-0 cursor-pointer"
            >
              Tez Anayasası Oluştur
            </Link>
          </div>
        </div>
      )}

      {/* LİTERATÜR TAVSİYELERİ */}
      <RecommendationGrid
        recs={recs}
        boxes={thesisData?.boxes || []}
        isLoadingRecs={isLoadingRecs}
        recsError={recsError}
        onRefresh={(boxId) =>
          thesisData && fetchRecommendations(thesisData, true, boxId)
        }
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
