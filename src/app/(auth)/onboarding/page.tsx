"use client";

import { useState, startTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  submitThesisMatrixAction,
  checkOnboardingStatus,
  getEnhancedThesisMatrixAction,
  confirmEnhancedThesisAction,
} from "./actions";
import type { EnhancedThesisData } from "./actions";

type PageStep = "loading" | "unauthorized" | "form" | "enhanced";

const ENHANCED_FIELDS: {
  key: keyof EnhancedThesisData;
  label: string;
  description: string;
}[] = [
  {
    key: "akademikCalismaBasligi",
    label: "Akademik Çalışma Başlığı",
    description:
      "Ham başlığın bilimsel kavramsallaştırılmış ve teorik terimlerle yeniden ifade edilmiş hali.",
  },
  {
    key: "literaturluArastirmaSorusu",
    label: "Literatürlü Araştırma Sorusu",
    description:
      "Araştırma sorusunun teorik değişkenleri ve literatür bağlamını görünür kılan akademik formu.",
  },
  {
    key: "olgunlastirilmisTezSavi",
    label: "Olgunlaştırılmış Tez Savı",
    description:
      "Temel iddianın bilimsel bir hipoteze/sava dönüştürülmüş, teorik pozisyon almış hali.",
  },
  {
    key: "kavramsalVeKuramsalAltyapi",
    label: "Kavramsal ve Kuramsal Altyapı",
    description:
      "Çalışmanın dayandığı teorik mercekler (Foucault, Bourdieu vb.) ve diyaloga gireceği literatür bağlamı.",
  },
  {
    key: "akademikMetodolojiTasarimi",
    label: "Akademik Metodoloji Tasarımı",
    description:
      "Ham yöntem tanımının bilimsel araştırma deseni ve veri analiz yöntemleriyle zenginleştirilmiş hali.",
  },
];

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

  const generationFired = useRef(false);

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
        return;
      }

      console.log("[page] form adımına geçiliyor");
      setPageStep("form");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Gemini'den akademik olgunlaştırılmış tez matrisini alır.
   * Step 2'de bir kereye mahsus tetiklenir. Eğer matris bulunamazsa
   * kullanıcı form adımına geri döner.
   */
  useEffect(() => {
    console.log("[page] GenerationEffect çalıştı pageStep:", pageStep, "fired:", generationFired.current);

    if (pageStep !== "enhanced") return;
    if (generationFired.current) {
      console.log("[page] generation zaten tetiklenmiş, atlanıyor");
      return;
    }

    generationFired.current = true;
    setIsGenerating(true);
    console.log("[page] getEnhancedThesisMatrixAction çağrılıyor...");

    startTransition(async () => {
      const result = await getEnhancedThesisMatrixAction();
      console.log("[page] getEnhancedThesisMatrixAction sonucu:", JSON.stringify(result).slice(0, 500));

      if (!result.success) {
        toast.error(result.error);
        setIsGenerating(false);
        setPageStep("form");
        return;
      }

      setEnhancedData(result.data);
      setIsGenerating(false);
    });
  }, [pageStep]);

  /**
   * Form gönderimini yönetir.
   * Server action'ı startTransition ile güvenli şekilde tetikler,
   * sonucu toast bildirimi olarak gösterir.
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

      toast.success("Tez matrisi başarıyla kaydedildi.");
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
      const result = await confirmEnhancedThesisAction(enhancedData);

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
            <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2">
              {ENHANCED_FIELDS.map((field) => (
                <div
                  key={field.key}
                  className={
                    field.key === "kavramsalVeKuramsalAltyapi" ||
                    field.key === "akademikMetodolojiTasarimi"
                      ? "md:col-span-2"
                      : ""
                  }
                >
                  <Label className="mb-2 block text-sm font-semibold text-foreground">
                    {field.label}
                  </Label>
                  <p className="text-base leading-relaxed text-muted-foreground">
                    {enhancedData[field.key]}
                  </p>
                </div>
              ))}
            </div>

            <Button
              className="w-full max-w-md"
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? "Kaydediliyor..." : "Onayla ve İlerle"}
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-4 py-20">
            <p className="text-base text-destructive">
              Akademik olgunlaştırma sırasında bir hata oluştu. Lütfen sayfayı
              yenileyin.
            </p>
            <Button onClick={() => window.location.reload()}>
              Tekrar Dene
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
