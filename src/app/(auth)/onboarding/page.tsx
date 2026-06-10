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

type PageStep = "loading" | "unauthorized" | "form";

/**
 * Tez Matrisi sayfası.
 * Kullanıcının ham verilerini girdiği, Gemini ile akademik olarak
 * zenginleştirilen ve onaylayarak kaydettiği tek form görünümü.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [pageStep, setPageStep] = useState<PageStep>("loading");
  const [isPending, setIsPending] = useState(false);
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [enhancedData, setEnhancedData] = useState<EnhancedThesisData | null>(
    null,
  );

  const [calismaBasligi, setCalismaBasligi] = useState("");
  const [arastirmaSorusu, setArastirmaSorusu] = useState("");
  const [temelIddia, setTemelIddia] = useState("");
  const [metodoloji, setMetodoloji] = useState("");
  const [kuramsalCerceve, setKuramsalCerceve] = useState("");
  const [tarihselMekansalSinirlar, setTarihselMekansalSinirlar] = useState("");

  /**
   * Sayfa ilk yüklendiğinde onboarding durumunu kontrol eder
   * ve hangi adımda olunduğuna göre yönlendirme/state kararı verir.
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

        if (storedResult.success) {
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
          toast.error(storedResult.error);
        }

        setPageStep("form");
        return;
      }

      setPageStep("form");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Ham tez matrisi verilerini sunucuya gönderir, Gemini
   * zenginleştirmesi sonrası dönen verilerle formu günceller.
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

      if (result.error) {
        toast.error(result.error);
        setIsPending(false);
        return;
      }

      toast.success("Tez matrisi başarıyla kaydedildi ve zenginleştiriliyor.");

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

      toast.success("Tez matrisiniz akademik olarak onaylandı ve kaydedildi.");
      setIsPending(false);
      router.refresh();
    });
  }

  /**
   * Form submit olayını yönetir. `isEnhanced` durumuna göre
   * handleSubmit veya handleConfirm'i yönlendirir.
   *
   * @param e - Form submit olayı
   */
  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isEnhanced) {
      handleConfirm();
    } else {
      handleSubmit();
    }
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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
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

        <Card className="w-full pt-10">
          <CardContent>
            <form
              onSubmit={handleFormSubmit}
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
                  required={!isEnhanced}
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
                  required={!isEnhanced}
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
                  required={!isEnhanced}
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
                  required={!isEnhanced}
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
                  required={!isEnhanced}
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
                  required={!isEnhanced}
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
                    : isEnhanced
                      ? "Onayla ve İlerle"
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
