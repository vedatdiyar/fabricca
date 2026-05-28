"use client";

import React, { useEffect, useReducer } from "react";
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

interface DashboardState {
  recs: LiteratureRecommendation[];
  isLoading: boolean;
  isLoadingRecs: boolean;
  error: string;
  recsError: string;
  selectedRec: LiteratureRecommendation | null;
}

const initialState: DashboardState = {
  recs: [],
  isLoading: true,
  isLoadingRecs: false,
  error: "",
  recsError: "",
  selectedRec: null,
};

type DashboardAction =
  | { type: "FETCH_START" }
  | {
      type: "FETCH_SUCCESS";
      payload: {
        recs: LiteratureRecommendation[];
        recsError: string;
      };
    }
  | { type: "FETCH_FAILURE"; payload: string }
  | { type: "FETCH_RECS_START" }
  | {
      type: "FETCH_RECS_SUCCESS";
      payload: {
        recs: LiteratureRecommendation[];
        recsError: string;
      };
    }
  | { type: "SET_SELECTED_REC"; payload: LiteratureRecommendation | null };

function dashboardReducer(
  state: DashboardState,
  action: DashboardAction,
): DashboardState {
  switch (action.type) {
    case "FETCH_START":
      return {
        ...state,
        isLoading: true,
        error: "",
      };
    case "FETCH_SUCCESS":
      return {
        ...state,
        isLoading: false,
        recs: action.payload.recs,
        recsError: action.payload.recsError,
        error: "",
      };
    case "FETCH_FAILURE":
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };
    case "FETCH_RECS_START":
      return {
        ...state,
        isLoadingRecs: true,
        recsError: "",
      };
    case "FETCH_RECS_SUCCESS":
      return {
        ...state,
        isLoadingRecs: false,
        recs: action.payload.recs,
        recsError: action.payload.recsError,
      };
    case "SET_SELECTED_REC":
      return {
        ...state,
        selectedRec: action.payload,
      };
    default:
      return state;
  }
}

export default function DashboardClient({
  initialThesisData,
}: DashboardClientProps) {
  const router = useRouter();
  const thesisData = initialThesisData;

  const [state, dispatch] = useReducer(dashboardReducer, initialState);

  const { recs, isLoading, isLoadingRecs, error, recsError, selectedRec } =
    state;

  // Load recommendations from Neon PostgreSQL cache or fetch fresh ones
  const fetchRecommendations = async (
    core: ThesisCoreData | null,
    forceRefresh = false,
    boxId?: number,
  ) => {
    try {
      dispatch({ type: "FETCH_RECS_START" });

      if (!core) {
        dispatch({
          type: "FETCH_RECS_SUCCESS",
          payload: {
            recs: [],
            recsError:
              "Tavsiye üretilebilmesi için öncelikle Tez Anayasası'nı oluşturmalısınız.",
          },
        });
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
        dispatch({
          type: "FETCH_RECS_SUCCESS",
          payload: {
            recs: recsRes.recommendations,
            recsError: "",
          },
        });
      } else {
        dispatch({
          type: "FETCH_RECS_SUCCESS",
          payload: {
            recs: [],
            recsError: recsRes.error || "Tavsiyeler yüklenirken hata oluştu.",
          },
        });
      }
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
      dispatch({
        type: "FETCH_RECS_SUCCESS",
        payload: {
          recs: [],
          recsError: "API_CONNECTION_FAILURE",
        },
      });
    }
  };

  useEffect(() => {
    async function loadDashboardData() {
      try {
        dispatch({ type: "FETCH_START" });

        // 2. Load recommendations if thesis data exists
        if (initialThesisData) {
          const recsRes = await getAcademicRecommendationsAction(
            initialThesisData.title,
            initialThesisData.researchQuestion,
            initialThesisData.argument,
            initialThesisData.methodology,
          );

          if (recsRes.success && recsRes.recommendations) {
            dispatch({
              type: "FETCH_SUCCESS",
              payload: {
                recs: recsRes.recommendations,
                recsError: "",
              },
            });
          } else {
            dispatch({
              type: "FETCH_SUCCESS",
              payload: {
                recs: [],
                recsError:
                  recsRes.error || "Tavsiyeler yüklenirken hata oluştu.",
              },
            });
          }
        } else {
          dispatch({
            type: "FETCH_SUCCESS",
            payload: {
              recs: [],
              recsError:
                "Tavsiye üretilebilmesi için öncelikle Tez Anayasası'nı oluşturmalısınız.",
            },
          });
        }
      } catch (err) {
        console.error("Dashboard error:", err);
        dispatch({
          type: "FETCH_FAILURE",
          payload: "Tez Karargahı yüklenirken kritik bir hata oluştu.",
        });
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
        onSelectRec={(rec) =>
          dispatch({ type: "SET_SELECTED_REC", payload: rec })
        }
      />

      {/* PDF YÜKLEME PANELİ */}
      <PdfUploadDrawer
        selectedRec={selectedRec}
        onClose={() => dispatch({ type: "SET_SELECTED_REC", payload: null })}
      />
    </div>
  );
}
