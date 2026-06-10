"use client";

import { useState, startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  submitThesisMatrixAction,
  checkOnboardingStatus,
  getStoredEnhancedDataAction,
  confirmEnhancedThesisAction,
} from "./actions";
import type { EnhancedThesisData } from "./actions";

type PageStep = "loading" | "unauthorized" | "form" | "enhanced";

/**
 * Tez Matrisi sayfası.
 * Step 1: Kullanıcının ham verilerini girdiği form.
 * Step 2: Gemini ile akademik olarak olgunlaştırılmış tez matrisi görünümü.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [pageStep, setPageStep] = useState<PageStep>("loading");
  const [isPending, setIsPending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [enhancedData, setEnhancedData] = useState<EnhancedThesisData | null>(
    null,
  );

  const [calismaBasligi, setCalismaBasligi] = useState("");
  const [arastirmaSorusu, setArastirmaSorusu] = useState("");
  const [temelIddia, setTemelIddia] = useState("");
  const [metodoloji, setMetodoloji] = useState("");
  const [kuramsalCerceve, setKuramsalCerceve] = useState("");
  const [tarihselMekansalSinirlar, setTarihselMekansalSinirlar] = useState("");

  useEffect(() => {
    if (enhancedData) {
      setCalismaBasligi(enhancedData.akademikCalismaBasligi ?? "");
      setArastirmaSorusu(enhancedData.literaturluArastirmaSorusu ?? "");
      setTemelIddia(enhancedData.olgunlastirilmisTezSavi ?? "");
      setMetodoloji(enhancedData.akademikMetodolojiTasarimi ?? "");
      setKuramsalCerceve(enhancedData.kavramsalVeKuramsalAltyapi ?? "");
      setTarihselMekansalSinirlar(enhancedData.tarihselMekansalSinirlar ?? "");
    }
  }, [enhancedData]);

  /**
   * Sayfa ilk yüklendiğinde onboarding durumunu kontrol eder
   * ve hangi adımda olunduğuna göre yönlendirme/state kararı verir.
   */
  useEffect(() => {
    console.log("[page] Initial checkEffect çalıştı");
    startTransition(async () => {
      const status = await checkOnboardingStatus();
      console.log("[page] checkOnboardingStatus sonucu:", JSON.stringify(status));

      if ("error" in status) {
        toast.error(status.error);
        setPageStep("unauthorized");
        return;
      }

      if (status.onboardingCompleted) {
        router.push("/dashboard");
        return;
      }

      if (status.currentStep === "thesis_matrix_enhanced") {
        console.log("[page] enhanced adımına geçiliyor");
        setPageStep("enhanced");
        setIsGenerating(true);

        const storedResult = await getStoredEnhancedDataAction();
        console.log("[page] getStoredEnhancedDataAction sonucu:", JSON.stringify(storedResult).slice(0, 500));

        if (storedResult.success) {
          setEnhancedData(storedResult.data);
        } else {
          toast.error(storedResult.error);
        }
        setIsGenerating(false);
        return;
      }

      console.log("[page] form adımına geçiliyor");
      setPageStep("form");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Form gönderimini yönetir.
   * submitThesisMatrixAction, DB yazma ve Gemini çağrısını tek bir
   * sunucu aksiyonunda sıralı olarak yürütür. Başarılı yanıtta
   * doğrudan dönen enhancedData state'e yazılır ve enhanced adımına geçilir.
   *
   * @param e - Form submit olayı
   */
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    console.log("[page] handleSubmit çağrıldı");
    setIsPending(true);

    startTransition(async () => {
      const sessionRes = await checkOnboardingStatus();
      console.log("[page] handleSubmit - checkOnboardingStatus:", JSON.stringify(sessionRes));

      if ("error" in sessionRes) {
        toast.error(sessionRes.error);
        setIsPending(false);
        return;
      }

      if (sessionRes.onboardingCompleted) {
        toast.info("Tez matrisiniz zaten oluşturulmuş.");
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
      console.log("[page] submitThesisMatrixAction sonucu:", JSON.stringify(result));

      if (result.error) {
        toast.error(result.error);
        setIsPending(false);
        return;
      }

      toast.success("Tez matrisi başarıyla kaydedildi ve zenginleştiriliyor.");

      if (result.success && result.data) {
        setEnhancedData(result.data);
      }

      console.log("[page] setPageStep enhanced'a geçiyor");
      setPageStep("enhanced");
    });
  }

  /**
   * Kullanıcının onayladığı akademik verileri DB'ye yazar
   * ve "originality_report" adımına geçer.
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

      toast.success(
        "Tez matrisiniz akademik olarak olgunlaştırıldı ve kaydedildi.",
      );
      router.refresh();
    });
  }

  if (pageStep === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Kontrol ediliyor...</p>
      </main>
    );
  }

  if (pageStep === "unauthorized") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">
          Bu sayfaya erişim yetkiniz bulunmamaktadır.
        </p>
      </main>
    );
  }

  if (pageStep === "form") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center space-y-8">
          <div className="flex flex-col items-center space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Tez Anayasası / Tez Matrisi
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Çalışmanızın temel yapı taşlarını tanımlayarak akademik
              altyapınızı oluşturun.
            </p>
          </div>

          <Card className="w-full pt-10">
            <CardContent>
              <form
                onSubmit={handleSubmit}
                className="grid w-full grid-cols-1 gap-6 md:grid-cols-2"
              >
                <div className="space-y-2">
                  <Label htmlFor="calismaBasligi" className="mb-4 block">
                    Çalışma Başlığı
                  </Label>
                  <Textarea
                    id="calismaBasligi"
                    placeholder="Tez veya çalışma başlığınız"
                    value={calismaBasligi}
                    onChange={(e) => setCalismaBasligi(e.target.value)}
                    required
                    className="h-[120px] overflow-y-auto resize-none leading-relaxed scrollbar-theme"
                  />
                </div>

                <div className="space-y-2 md:col-start-1">
                  <Label htmlFor="arastirmaSorusu" className="mb-4 block">
                    Araştırma Sorusu
                  </Label>
                  <Textarea
                    id="arastirmaSorusu"
                    placeholder="Çalışmanızın temel araştırma sorusu"
                    value={arastirmaSorusu}
                    onChange={(e) => setArastirmaSorusu(e.target.value)}
                    required
                    className="h-[120px] overflow-y-auto resize-none leading-relaxed scrollbar-theme"
                  />
                </div>

                <div className="space-y-2 md:row-start-3 md:col-start-1">
                  <Label htmlFor="temelIddia" className="mb-4 block">
                    Temel İddia
                  </Label>
                  <Textarea
                    id="temelIddia"
                    placeholder="Çalışmanızın savunduğu temel iddia"
                    value={temelIddia}
                    onChange={(e) => setTemelIddia(e.target.value)}
                    required
                    className="h-[120px] overflow-y-auto resize-none leading-relaxed scrollbar-theme"
                  />
                </div>

                <div className="space-y-2 md:row-start-1 md:col-start-2">
                  <Label htmlFor="metodoloji" className="mb-4 block">
                    Metodoloji
                  </Label>
                  <Textarea
                    id="metodoloji"
                    placeholder="Kullanılan araştırma yöntem ve teknikleri"
                    value={metodoloji}
                    onChange={(e) => setMetodoloji(e.target.value)}
                    required
                    className="h-[120px] overflow-y-auto resize-none leading-relaxed scrollbar-theme"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kuramsalCerceve" className="mb-4 block">
                    Kuramsal Çerçeve
                  </Label>
                  <Textarea
                    id="kuramsalCerceve"
                    placeholder="Çalışmanızın dayandığı kuramsal temel"
                    value={kuramsalCerceve}
                    onChange={(e) => setKuramsalCerceve(e.target.value)}
                    required
                    className="h-[120px] overflow-y-auto resize-none leading-relaxed scrollbar-theme"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="tarihselMekansalSinirlar"
                    className="mb-4 block"
                  >
                    Tarihsel / Mekânsal Sınırlar
                  </Label>
                  <Textarea
                    id="tarihselMekansalSinirlar"
                    placeholder="Çalışmanızın kapsadığı tarih aralığı ve mekânsal sınırlar"
                    value={tarihselMekansalSinirlar}
                    onChange={(e) => setTarihselMekansalSinirlar(e.target.value)}
                    required
                    className="h-[120px] overflow-y-auto resize-none leading-relaxed scrollbar-theme"
                  />
                </div>

                <div className="md:col-span-full">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isPending}
                  >
                    {isPending
                      ? "Kaydediliyor..."
                      : "Tez Anayasasını Zenginleştir"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center space-y-8">
        <div className="flex flex-col items-center space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Akademik Olgunlaştırma Sonucu
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Ham tez fikirleriniz, teorik kavramsallaştırma ile akademik dile
            tercüme edildi. Lütfen inceleyin ve onaylayın.
          </p>
        </div>

        {isGenerating ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-20">
            <div className="text-base text-muted-foreground">
              Akademik olgunlaştırma yapılıyor...
            </div>
          </div>
        ) : enhancedData ? (
          <>
            <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">
                  Akademik Çalışma Başlığı
                </Label>
                <Textarea
                  value={calismaBasligi}
                  onChange={(e) => setCalismaBasligi(e.target.value)}
                  className="h-[140px] overflow-y-auto resize-none leading-relaxed scrollbar-theme"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">
                  Literatürlü Araştırma Sorusu
                </Label>
                <Textarea
                  value={arastirmaSorusu}
                  onChange={(e) => setArastirmaSorusu(e.target.value)}
                  className="h-[140px] overflow-y-auto resize-none leading-relaxed scrollbar-theme"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">
                  Olgunlaştırılmış Tez Savı
                </Label>
                <Textarea
                  value={temelIddia}
                  onChange={(e) => setTemelIddia(e.target.value)}
                  className="h-[140px] overflow-y-auto resize-none leading-relaxed scrollbar-theme"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">
                  Akademik Metodoloji Tasarımı
                </Label>
                <Textarea
                  value={metodoloji}
                  onChange={(e) => setMetodoloji(e.target.value)}
                  className="h-[140px] overflow-y-auto resize-none leading-relaxed scrollbar-theme"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">
                  Kavramsal ve Kuramsal Altyapı
                </Label>
                <Textarea
                  value={kuramsalCerceve}
                  onChange={(e) => setKuramsalCerceve(e.target.value)}
                  className="h-[140px] overflow-y-auto resize-none leading-relaxed scrollbar-theme"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">
                  Tarihsel / Mekânsal Sınırlar
                </Label>
                <Textarea
                  value={tarihselMekansalSinirlar}
                  onChange={(e) => setTarihselMekansalSinirlar(e.target.value)}
                  className="h-[140px] overflow-y-auto resize-none leading-relaxed scrollbar-theme"
                />
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? "Kaydediliyor..." : "Onayla ve İlerle"}
            </Button>
          </>
        ) : null}
      </div>
    </main>
  );
}
