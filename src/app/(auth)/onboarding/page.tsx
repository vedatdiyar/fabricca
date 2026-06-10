"use client";

import { useState, startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sparkles,
  ShieldCheck,
  BookOpen,
  ExternalLink,
  FileText,
  Award,
  GitCompare,
  Compass,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  submitThesisMatrixAction,
  checkOnboardingStatus,
  getStoredEnhancedDataAction,
  confirmEnhancedThesisAction,
  startOriginalityAnalysisAction,
  getStoredOriginalityReportAction,
  completeOnboardingAction,
} from "./actions";
import type { EnhancedThesisData } from "./actions";

type PageStep =
  | "loading"
  | "unauthorized"
  | "form"
  | "originality_report_start"
  | "originality_report_running"
  | "originality_report_completed";

interface OriginalityReportData {
  tavilyResults: {
    items: {
      fact: string;
      result: string;
      sourceUrl: string;
    }[];
    briefingNote: string;
  };
  tezaraResults: {
    originalityBadge: "YÜKSEK" | "ORTA" | "DÜŞÜK";
    overlapTable: {
      id: number;
      title: string;
      author: string;
      university: string;
      year: number;
      thesisType: string;
      department: string;
      axes: {
        subject: "ÇAKIŞIYOR" | "KISMEN ÇAKIŞIYOR" | "FARKLI";
        theory: "ÇAKIŞIYOR" | "KISMEN ÇAKIŞIYOR" | "FARKLI";
        methodology: "ÇAKIŞIYOR" | "KISMEN ÇAKIŞIYOR" | "FARKLI";
        context: "ÇAKIŞIYOR" | "KISMEN ÇAKIŞIYOR" | "FARKLI";
      };
      originalityLevel: "YÜKSEK" | "ORTA" | "DÜŞÜK";
    }[];
    strategicRecommendations: string;
  };
}

/**
 * Onboarding sürecinin ana sayfası.
 * Sırasıyla:
 * 1. Ham Tez Matrisi Girişi
 * 2. Gemini ile Akademik Zenginleştirme & Düzenleme
 * 3. Orijinallik Analizi Başlatma Ekranı
 * 4. Analiz Süreci Yükleme Ekranı
 * 5. Detaylı Özgünlük & Maddi Doğrulama Raporu
 * aşamalarını yönetir.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [pageStep, setPageStep] = useState<PageStep>("loading");
  const [isPending, setIsPending] = useState(false);
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [enhancedData, setEnhancedData] = useState<EnhancedThesisData | null>(
    null,
  );
  const [reportData, setReportData] = useState<OriginalityReportData | null>(
    null,
  );

  // Tez Matrisi Form Alanları
  const [calismaBasligi, setCalismaBasligi] = useState("");
  const [arastirmaSorusu, setArastirmaSorusu] = useState("");
  const [temelIddia, setTemelIddia] = useState("");
  const [metodoloji, setMetodoloji] = useState("");
  const [kuramsalCerceve, setKuramsalCerceve] = useState("");
  const [tarihselMekansalSinirlar, setTarihselMekansalSinirlar] = useState("");

  /**
   * Sayfa yüklendiğinde kullanıcının onboarding adımını kontrol eder
   * ve sayfayı uygun adıma konumlandırır.
   */
  useEffect(() => {
    startTransition(async () => {
      const status = await checkOnboardingStatus();

      if ("error" in status) {
        toast.error(status.error);
        setPageStep("unauthorized");
        return;
      }

      if (status.onboardingStep === "completed") {
        router.push("/dashboard");
        return;
      }

      if (status.onboardingStep === "thesis_matrix_enhanced") {
        const storedResult = await getStoredEnhancedDataAction();

        if (storedResult.success && storedResult.data) {
          const data = storedResult.data;
          setCalismaBasligi(data.akademikCalismaBasligi ?? "");
          setArastirmaSorusu(data.literaturluArastirmaSorusu ?? "");
          setTemelIddia(data.olgunlastirilmisTezSavi ?? "");
          setMetodoloji(data.akademikMetodolojiTasarimi ?? "");
          setKuramsalCerceve(data.kavramsalVeKuramsalAltyapi ?? "");
          setTarihselMekansalSinirlar(data.tarihselMekansalSinirlar ?? "");
          setEnhancedData(data);
          setIsEnhanced(true);
        } else {
          toast.error(
            storedResult.error || "Zenginleştirilmiş veri yüklenemedi.",
          );
        }
        setPageStep("form");
        return;
      }

      if (status.onboardingStep === "originality_report") {
        setPageStep("originality_report_start");
        return;
      }

      if (status.onboardingStep === "originality_report_completed") {
        const reportRes = await getStoredOriginalityReportAction();
        if (reportRes.success && reportRes.data) {
          setReportData(reportRes.data as OriginalityReportData);
          setPageStep("originality_report_completed");
        } else {
          toast.error("Rapor verileri yüklenemedi. Yeniden başlatın.");
          setPageStep("originality_report_start");
        }
        return;
      }

      setPageStep("form");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Ham tez matrisi formunu sunucuya göndererek zenginleştirir.
   */
  function handleSubmit() {
    setIsPending(true);

    startTransition(async () => {
      const sessionRes = await checkOnboardingStatus();

      if ("error" in sessionRes) {
        toast.error(sessionRes.error);
        setIsPending(false);
        return;
      }

      if (sessionRes.onboardingStep === "completed") {
        router.push("/dashboard");
        return;
      }

      const result = await submitThesisMatrixAction({
        calismaBasligi,
        arastirmaSorusu,
        temelIddia,
        metodoloji,
        kuramsalCerceve,
        tarihselMekansalSinirlar,
      });

      if (result.error) {
        toast.error(result.error);
        setIsPending(false);
        return;
      }

      toast.success("Tez matrisi başarıyla zenginleştirildi.");

      if (result.success && result.data) {
        const data = result.data;
        setCalismaBasligi(data.akademikCalismaBasligi ?? "");
        setArastirmaSorusu(data.literaturluArastirmaSorusu ?? "");
        setTemelIddia(data.olgunlastirilmisTezSavi ?? "");
        setMetodoloji(data.akademikMetodolojiTasarimi ?? "");
        setKuramsalCerceve(data.kavramsalVeKuramsalAltyapi ?? "");
        setTarihselMekansalSinirlar(data.tarihselMekansalSinirlar ?? "");
        setEnhancedData(data);
        setIsEnhanced(true);
      }

      setIsPending(false);
    });
  }

  /**
   * Zenginleştirilmiş ve düzenlenen tez matrisini onaylar.
   * Onay sonrası Orijinallik Analizi başlatma adımına geçer.
   */
  function handleConfirm() {
    if (!enhancedData) return;

    setIsPending(true);
    startTransition(async () => {
      const editedData: EnhancedThesisData = {
        akademikCalismaBasligi: calismaBasligi,
        literaturluArastirmaSorusu: arastirmaSorusu,
        olgunlastirilmisTezSavi: temelIddia,
        kavramsalVeKuramsalAltyapi: kuramsalCerceve,
        akademikMetodolojiTasarimi: metodoloji,
        tarihselMekansalSinirlar: tarihselMekansalSinirlar,
      };

      const result = await confirmEnhancedThesisAction(editedData);

      if (result.error) {
        toast.error(result.error);
        setIsPending(false);
        return;
      }

      toast.success("Tez matrisiniz kaydedildi. Özgünlük analizine geçiliyor.");
      setIsPending(false);
      setPageStep("originality_report_start");
    });
  }

  /**
   * Orijinallik ve Maddi Doğrulama analizi asenkron motorlarını tetikler.
   */
  function handleStartAnalysis() {
    setPageStep("originality_report_running");
    setIsPending(true);

    startTransition(async () => {
      const res = await startOriginalityAnalysisAction();

      if (res.error) {
        toast.error(res.error);
        setPageStep("originality_report_start");
        setIsPending(false);
        return;
      }

      toast.success("Özgünlük analizi başarıyla tamamlandı.");

      const reportRes = await getStoredOriginalityReportAction();
      if (reportRes.success && reportRes.data) {
        setReportData(reportRes.data as OriginalityReportData);
        setPageStep("originality_report_completed");
      } else {
        toast.error("Rapor verileri yüklenirken bir sorun oluştu.");
        setPageStep("originality_report_start");
      }
      setIsPending(false);
    });
  }

  /**
   * Onboarding sürecini tamamlar ve dashboard'a yönlendirir.
   */
  function handleCompleteOnboarding() {
    setIsPending(true);
    startTransition(async () => {
      const res = await completeOnboardingAction();
      if (res.error) {
        toast.error(res.error);
        setIsPending(false);
        return;
      }

      toast.success("Onboarding tamamlandı, yönlendiriliyorsunuz.");
      router.push("/dashboard");
    });
  }

  /**
   * Form submit olayını yakalayarak ilgili moda göre dallandırır.
   */
  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isEnhanced) {
      handleConfirm();
    } else {
      handleSubmit();
    }
  }

  // 1. Loading Görünümü
  if (pageStep === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">
            Oturum kontrol ediliyor...
          </p>
        </div>
      </main>
    );
  }

  // 2. Yetkisiz Erişim Görünümü
  if (pageStep === "unauthorized") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Card className="max-w-sm border-border bg-card">
          <CardContent className="p-6 text-center space-y-4">
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <div className="space-y-1">
              <h3 className="font-semibold text-lg text-foreground">
                Yetkisiz Erişim
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Bu sayfayı görüntüleme izniniz bulunmamaktadır. Lütfen tekrar
                giriş yapın.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  // 3. Analiz Hazırlık Başlangıç Görünümü
  if (pageStep === "originality_report_start") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center space-y-8 text-center max-w-2xl mx-auto">
          <div className="p-4 bg-muted rounded-full border border-border">
            <Sparkles className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Özgünlük ve Maddi Doğrulama Analizi
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              Tez matrisiniz başarıyla yapılandırıldı. Son adım olarak
              çalışmanızın akademik özgünlüğünü ve maddi tutarlılığını test
              edeceğiz.
            </p>
          </div>

          <Card className="w-full bg-card border-border text-left leading-relaxed">
            <CardContent className="p-6 space-y-6">
              <div className="flex gap-4 items-start">
                <div className="mt-1 p-2 bg-muted rounded-lg border border-border">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">
                    Tavily ile Maddi Doğrulama
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Çalışmanızdaki tarihsel iddialar, olgusal ifadeler ve
                    kavramlar internet üzerindeki güvenilir kaynaklar taranarak
                    maddi olarak doğrulanacaktır.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="mt-1 p-2 bg-muted rounded-lg border border-border">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">
                    Tezara ile Çapraz Literatür Taraması
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Tezara veri tabanında İngilizce akademik çapraz aramalar
                    koşturularak tezler taranacak, çalışmanızla çakışan tezler 4
                    eksende (Konu, Teori, Metodoloji, Bağlam)
                    karşılaştırılacaktır.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleStartAnalysis}
            className="w-full py-6 text-base font-semibold"
            disabled={isPending}
          >
            {isPending
              ? "Analiz Başlatılıyor..."
              : "Analiz Motorlarını Çalıştır"}
          </Button>
        </div>
      </main>
    );
  }

  // 4. Analiz Koşma Süreci Görünümü
  if (pageStep === "originality_report_running") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center justify-center space-y-8 max-w-md mx-auto text-center">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <Sparkles className="w-6 h-6 text-primary absolute animate-pulse" />
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              Özgünlük Motorları Çalışıyor
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Yapay zeka asistanınız tez matrisinizi inceliyor, veri tabanlarını
              tarıyor ve rapor hazırlıyor. Bu işlem 15-30 saniye sürebilir.
            </p>
          </div>

          <div className="w-full bg-muted border border-border rounded-lg p-5 text-left space-y-4">
            <div className="flex items-center gap-3 text-sm text-foreground">
              <div className="w-2.5 h-2.5 rounded-full bg-primary animate-ping"></div>
              <span className="font-medium">
                Sorgu ve doğrulama parametreleri üretiliyor...
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded-full bg-border"></div>
              <span>Tavily ve Tezara paralel motorları koşturuluyor...</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded-full bg-border"></div>
              <span>Karşılaştırmalı literatür matrisi yapılandırılıyor...</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded-full bg-border"></div>
              <span>Nihai özgünlük skoru ve tavsiyeler hazırlanıyor...</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // 5. Analiz Sonuç Raporu Görünümü
  if (pageStep === "originality_report_completed") {
    if (!reportData) return null;
    const { tavilyResults, tezaraResults } = reportData;

    let badgeColor =
      "bg-emerald-950 text-emerald-400 border border-emerald-800";
    if (tezaraResults.originalityBadge === "ORTA") {
      badgeColor = "bg-amber-950 text-amber-400 border border-amber-800";
    } else if (tezaraResults.originalityBadge === "DÜŞÜK") {
      badgeColor = "bg-red-950 text-red-400 border border-red-800";
    }

    return (
      <main className="min-h-screen bg-background py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-10">
          {/* Header */}
          <div className="space-y-2 text-center sm:text-left">
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex flex-col sm:flex-row sm:items-center gap-2">
              <span>Akademik Özgünlük & Maddi Doğrulama Raporu</span>
            </h1>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Çalışmanızın internet üzerindeki maddi doğruluğu ile Tezara veri
              tabanındaki literatür konumu.
            </p>
          </div>

          {/* Badge & Overall status */}
          <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-card border border-border rounded-xl gap-4">
            <div className="space-y-1 text-center md:text-left">
              <h3 className="text-lg font-semibold text-foreground">
                Genel Akademik Özgünlük Derecesi
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Asistanınızın literatür çakışmaları ve kuramsal yaklaşımlar
                üzerindeki nihai değerlendirmesi.
              </p>
            </div>
            <div
              className={`flex items-center gap-2 px-6 py-3 rounded-full text-base font-bold tracking-wider ${badgeColor}`}
            >
              <Award className="w-5 h-5 animate-pulse" />
              <span>{tezaraResults.originalityBadge} ÖZGÜNLÜK</span>
            </div>
          </div>

          {/* Section A: Tavily Fact Checking */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Maddi Doğrulama ve Bilgi Güvencesi (Tavily)
              </CardTitle>
              <CardDescription className="text-xs">
                Tez matrisindeki olgusal iddialar ve tarihsel verilerin arama
                motoru sonuçlarıyla doğrulanması.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-muted border border-border rounded-lg leading-relaxed text-sm text-muted-foreground whitespace-pre-line">
                <span className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Doğrulama Özeti ve Analiz Notu
                </span>
                {tavilyResults.briefingNote}
              </div>

              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted border-b border-border">
                      <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase min-w-[200px]">
                        Sorgulanan İfade / Olay
                      </th>
                      <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[180px]">
                        Doğrulama Sonucu
                      </th>
                      <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[120px]">
                        Kaynak
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tavilyResults.items?.map((item, idx) => {
                      let tagClass =
                        "bg-emerald-950 text-emerald-400 border border-emerald-800";
                      if (item.result.toLowerCase().includes("kısmen")) {
                        tagClass =
                          "bg-amber-950 text-amber-400 border border-amber-800";
                      } else if (
                        item.result.toLowerCase().includes("doğrulanamadı") ||
                        item.result.toLowerCase().includes("dikkat")
                      ) {
                        tagClass =
                          "bg-red-950 text-red-400 border border-red-800";
                      }

                      return (
                        <tr
                          key={idx}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="p-3 text-sm font-medium text-foreground leading-relaxed">
                            {item.fact}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${tagClass}`}
                            >
                              {item.result}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {item.sourceUrl ? (
                              <a
                                href={item.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:text-emerald-400 transition-colors font-medium text-xs"
                              >
                                Git <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                -
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Section B: Tezara Cross Literature comparison */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                <GitCompare className="w-5 h-5 text-primary" />
                Literatür Çakışma ve Karşılaştırma Matrisi (4 Eksen)
              </CardTitle>
              <CardDescription className="text-xs">
                Benzer akademik çalışmaların konu, kuramsal çerçeve, metodoloji
                ve bağlam eksenlerinde incelenmesi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted border-b border-border">
                      <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase min-w-[240px]">
                        Karşılaştırılan Tez Bilgileri
                      </th>
                      <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[100px]">
                        Konu
                      </th>
                      <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[100px]">
                        Teori
                      </th>
                      <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[100px]">
                        Metodoloji
                      </th>
                      <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[100px]">
                        Bağlam
                      </th>
                      <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[110px]">
                        Özgünlük
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tezaraResults.overlapTable?.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-8 text-center text-muted-foreground leading-relaxed text-sm"
                        >
                          Doğrudan çakışan veya yakın ilişki kuran herhangi bir
                          tez tespit edilmemiştir.
                        </td>
                      </tr>
                    ) : (
                      tezaraResults.overlapTable?.map((item, idx) => {
                        const getAxisBadge = (val: string) => {
                          if (val === "ÇAKIŞIYOR")
                            return "bg-red-950 text-red-400 border border-red-800";
                          if (val === "KISMEN ÇAKIŞIYOR")
                            return "bg-amber-950 text-amber-400 border border-amber-800";
                          return "bg-emerald-950 text-emerald-400 border border-emerald-800"; // FARKLI
                        };

                        const getLevelBadge = (val: string) => {
                          if (val === "DÜŞÜK")
                            return "bg-red-950 text-red-400 border border-red-800";
                          if (val === "ORTA")
                            return "bg-amber-950 text-amber-400 border border-amber-800";
                          return "bg-emerald-950 text-emerald-400 border border-emerald-800"; // YÜKSEK
                        };

                        return (
                          <tr
                            key={idx}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <td className="p-3 space-y-1">
                              <div className="font-semibold text-foreground text-sm leading-relaxed">
                                {item.title}
                              </div>
                              <div className="text-xs text-muted-foreground leading-relaxed">
                                {item.author} • {item.university} ({item.year})
                              </div>
                              <div className="text-[11px] text-muted-foreground font-mono">
                                {item.thesisType} • {item.department}
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${getAxisBadge(item.axes.subject)}`}
                              >
                                {item.axes.subject}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${getAxisBadge(item.axes.theory)}`}
                              >
                                {item.axes.theory}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${getAxisBadge(item.axes.methodology)}`}
                              >
                                {item.axes.methodology}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${getAxisBadge(item.axes.context)}`}
                              >
                                {item.axes.context}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${getLevelBadge(item.originalityLevel)}`}
                              >
                                {item.originalityLevel}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Strategic Recommendations */}
          <div className="p-6 bg-card border border-border rounded-xl space-y-3 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Compass className="w-5 h-5 text-primary" />
              Yol Haritası ve Akademik Tavsiyeler
            </h3>
            <div className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line bg-muted p-4 border border-border rounded-lg">
              {tezaraResults.strategicRecommendations}
            </div>
          </div>

          {/* Confirm & Complete */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleCompleteOnboarding}
              disabled={isPending}
              className="px-8 py-6 text-base font-semibold"
            >
              {isPending ? "Tamamlanıyor..." : "Süreci Tamamla ve Panel'e Geç"}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // 6. Ham Tez Giriş ve Olgunlaştırma Formu Görünümü
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center space-y-8">
        <div className="flex flex-col items-center space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Tez Anayasası / Tez Matrisi
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isEnhanced
              ? "Ham tez fikirleriniz akademik dile tercüme edildi. Düzenleyip onaylayabilirsiniz."
              : "Çalışmanızın temel yapı taşlarını tanımlayarak akademik altyapınızı oluşturun."}
          </p>
        </div>

        <Card className="w-full pt-10 border-border bg-card">
          <CardContent>
            <form
              onSubmit={handleFormSubmit}
              className="grid w-full grid-cols-1 gap-6 md:grid-cols-2"
            >
              <div className="space-y-2">
                <Label
                  htmlFor="calismaBasligi"
                  className="mb-4 block text-sm font-semibold text-foreground"
                >
                  Çalışma Başlığı
                </Label>
                <Textarea
                  id="calismaBasligi"
                  placeholder="Tez veya çalışma başlığınız"
                  value={calismaBasligi}
                  onChange={(e) => setCalismaBasligi(e.target.value)}
                  required={!isEnhanced}
                  className="h-[120px] overflow-y-auto resize-none leading-relaxed bg-input border-border scrollbar-theme text-foreground"
                />
              </div>

              <div className="space-y-2 md:col-start-1">
                <Label
                  htmlFor="arastirmaSorusu"
                  className="mb-4 block text-sm font-semibold text-foreground"
                >
                  Araştırma Sorusu
                </Label>
                <Textarea
                  id="arastirmaSorusu"
                  placeholder="Çalışmanızın temel araştırma sorusu"
                  value={arastirmaSorusu}
                  onChange={(e) => setArastirmaSorusu(e.target.value)}
                  required={!isEnhanced}
                  className="h-[120px] overflow-y-auto resize-none leading-relaxed bg-input border-border scrollbar-theme text-foreground"
                />
              </div>

              <div className="space-y-2 md:row-start-3 md:col-start-1">
                <Label
                  htmlFor="temelIddia"
                  className="mb-4 block text-sm font-semibold text-foreground"
                >
                  Temel İddia
                </Label>
                <Textarea
                  id="temelIddia"
                  placeholder="Çalışmanızın savunduğu temel iddia"
                  value={temelIddia}
                  onChange={(e) => setTemelIddia(e.target.value)}
                  required={!isEnhanced}
                  className="h-[120px] overflow-y-auto resize-none leading-relaxed bg-input border-border scrollbar-theme text-foreground"
                />
              </div>

              <div className="space-y-2 md:row-start-1 md:col-start-2">
                <Label
                  htmlFor="metodoloji"
                  className="mb-4 block text-sm font-semibold text-foreground"
                >
                  Metodoloji
                </Label>
                <Textarea
                  id="metodoloji"
                  placeholder="Kullanılan araştırma yöntem ve teknikleri"
                  value={metodoloji}
                  onChange={(e) => setMetodoloji(e.target.value)}
                  required={!isEnhanced}
                  className="h-[120px] overflow-y-auto resize-none leading-relaxed bg-input border-border scrollbar-theme text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="kuramsalCerceve"
                  className="mb-4 block text-sm font-semibold text-foreground"
                >
                  Kuramsal Çerçeve
                </Label>
                <Textarea
                  id="kuramsalCerceve"
                  placeholder="Çalışmanızın dayandığı kuramsal temel"
                  value={kuramsalCerceve}
                  onChange={(e) => setKuramsalCerceve(e.target.value)}
                  required={!isEnhanced}
                  className="h-[120px] overflow-y-auto resize-none leading-relaxed bg-input border-border scrollbar-theme text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="tarihselMekansalSinirlar"
                  className="mb-4 block text-sm font-semibold text-foreground"
                >
                  Tarihsel / Mekânsal Sınırlar
                </Label>
                <Textarea
                  id="tarihselMekansalSinirlar"
                  placeholder="Çalışmanızın kapsadığı tarih aralığı ve mekânsal sınırlar"
                  value={tarihselMekansalSinirlar}
                  onChange={(e) => setTarihselMekansalSinirlar(e.target.value)}
                  required={!isEnhanced}
                  className="h-[120px] overflow-y-auto resize-none leading-relaxed bg-input border-border scrollbar-theme text-foreground"
                />
              </div>

              <div className="md:col-span-full">
                <Button
                  type="submit"
                  className="w-full font-semibold py-6"
                  disabled={isPending}
                >
                  {isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isEnhanced ? "Onaylanıyor..." : "Zenginleştiriliyor..."}
                    </span>
                  ) : isEnhanced ? (
                    "Onayla ve İlerle"
                  ) : (
                    "Tez Anayasasını Zenginleştir"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
