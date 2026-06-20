"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { getErrorDisplay } from "@/lib/error-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import type { LoadingStep } from "@/lib/store/onboarding-store";
import { enrichThesisMatrixAction, saveEnrichedMatrixAction } from "../actions";
import { fetchThesisMatrix } from "../../_lib/fetch-actions";

export function MatrixForm() {
  const router = useRouter();

  const [studyTitle, setStudyTitle] = useState("");
  const [researchQuestion, setResearchQuestion] = useState("");
  const [theoreticalFramework, setTheoreticalFramework] = useState("");
  const [methodology, setMethodology] = useState("");
  const [researchScope, setResearchScope] = useState("");
  const [mainClaim, setMainClaim] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const showLoading = useOnboardingStore((s) => s.showLoading);
  const hideLoading = useOnboardingStore((s) => s.hideLoading);
  const updateLoadingStep = useOnboardingStore((s) => s.updateLoadingStep);
  const isLoading = useOnboardingStore((s) => s.isLoading);

  useEffect(() => {
    let cancelled = false;
    fetchThesisMatrix()
      .then((matrix) => {
        if (cancelled) return;
        if (matrix) {
          setStudyTitle(matrix.studyTitle);
          setResearchQuestion(matrix.researchQuestion);
          setTheoreticalFramework(matrix.theoreticalFramework);
          setMethodology(matrix.methodology);
          setResearchScope(matrix.researchScope);
          setMainClaim(matrix.mainClaim);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoading(false);
        const display = getErrorDisplay(err);
        toast.error(`${display.title}: ${display.description}`);
      });
    return () => {
      cancelled = true;
      hideLoading();
    };
  }, [hideLoading]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);

    const steps: LoadingStep[] = [
      {
        text: "Yapay zeka asistanı kavramsal ve kuramsal altyapıyı zenginleştiriyor...",
        status: "active",
      },
      {
        text: "Zenginleştirilmiş akademik matris veri tabanına işleniyor...",
        status: "idle",
      },
    ];

    showLoading(
      "Tez Matrisi Zenginleştiriliyor",
      "Yapay zeka asistanınız tez anayasanızı analiz ederek akademik bir yapıya dönüştürüyor.",
      steps,
    );

    try {
      const enrichResult = await enrichThesisMatrixAction({
        studyTitle,
        researchQuestion,
        theoreticalFramework,
        methodology,
        researchScope,
        mainClaim,
      });

      if ("error" in enrichResult) {
        hideLoading();
        toast.error(enrichResult.error);
        setIsPending(false);
        return;
      }

      updateLoadingStep(0, "completed");
      updateLoadingStep(1, "active");

      const saveResult = await saveEnrichedMatrixAction(enrichResult.data);

      if ("error" in saveResult) {
        hideLoading();
        toast.error(saveResult.error);
        setIsPending(false);
        return;
      }

      updateLoadingStep(1, "completed");

      // Tez bilgileri değiştiği için ileriki adımlardaki tüm state kalıntılarını
      // temizle — böylece eski kutu/literatür/rapor verileri asla hortlamaz.
      const store = useOnboardingStore.getState();
      store.setBoxes(null);
      store.setLiteraturePool([]);
      store.setReportData(null);

      toast.success("Tez matrisi başarıyla zenginleştirildi.");
      hideLoading();
      router.push("/onboarding/enrichment");
    } catch {
      hideLoading();
      toast.error("Bir hata oluştu.");
    } finally {
      setIsPending(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full pt-6">
        <CardContent>
          <div className="flex items-center justify-center min-h-[30vh]">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full pt-6">
      <CardContent>
        <form onSubmit={handleSubmit} className="w-full space-y-6">
          <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label
                htmlFor="calismaBasligi"
                className="block font-semibold text-foreground"
              >
                Çalışma Başlığı
              </Label>
              <Textarea
                id="calismaBasligi"
                placeholder="Tezinizin veya araştırmanızın mevcut/geçici başlığı."
                value={studyTitle}
                onChange={(e) => setStudyTitle(e.target.value)}
                required
                className="textarea-academic"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="arastirmaSorusu"
                className="block font-semibold text-foreground"
              >
                Odak Sorular (Ana ve Alt Sorular)
              </Label>
              <Textarea
                id="arastirmaSorusu"
                placeholder="Araştırdığınız temel 'Neden' ve 'Nasıl' soruları. Birden fazla soru varsa lütfen her birini yeni bir satıra maddeleyerek (Soru 1, Soru 2 şeklinde) yazın. Yapay zeka her soru için ayrı bir inceleme alanı açacaktır."
                value={researchQuestion}
                onChange={(e) => setResearchQuestion(e.target.value)}
                required
                className="textarea-academic"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="kavramsalCerceve"
                className="block font-semibold text-foreground"
              >
                Teorik Altyapı, Kavramlar ve Yazarlar
              </Label>
              <Textarea
                id="kavramsalCerceve"
                placeholder="Çalışmada kullanacağınız temel teoriler, okullar veya kurucu yazarlar (Örn: Foucault'nun Söylem Analizi, Bourdieu'nün Alan Teorisi). Birden fazla teorik yaklaşım varsa aralarına virgül koyarak veya maddeleyerek yazın."
                value={theoreticalFramework}
                onChange={(e) => setTheoreticalFramework(e.target.value)}
                required
                className="textarea-academic"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="metodoloji"
                className="block font-semibold text-foreground"
              >
                Veri Toplama ve Analiz Yöntemi
              </Label>
              <Textarea
                id="metodoloji"
                placeholder="Veriyi nasıl toplayacağınız ve analiz edeceğiniz (Örn: Yarı yapılandırılmış mülakat, içerik analizi, anket, arşiv taraması). Eğer karma yöntem kullanıyorsanız her bir yöntemi ayrı bir madde olarak belirtin."
                value={methodology}
                onChange={(e) => setMethodology(e.target.value)}
                required
                className="textarea-academic"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="arastirmaKapsami"
                className="block font-semibold text-foreground"
              >
                Araştırma Sınırları (Zaman, Mekân, Aktör)
              </Label>
              <Textarea
                id="arastirmaKapsami"
                placeholder="Araştırmanın ampirik sınırları. Zaman (Örn: 1990-2005), Mekân (Örn: Doğu Avrupa, İstanbul) ve odaklanılan Aktörleri/Kurumları net bir şekilde sınırlandırarak yazın."
                value={researchScope}
                onChange={(e) => setResearchScope(e.target.value)}
                required
                className="textarea-academic"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="temelIddia"
                className="block font-semibold text-foreground"
              >
                Merkez Savı (Tezin Ana İddiası)
              </Label>
              <Textarea
                id="temelIddia"
                placeholder="Tezinizin tüm bu çalışmalar sonunda kanıtlamayı, savunmayı veya literatüre katkı olarak sunmayı hedeflediği o tek cümlelik ana fikir / hipotez."
                value={mainClaim}
                onChange={(e) => setMainClaim(e.target.value)}
                required
                className="textarea-academic"
              />
            </div>
          </div>

          <div className="md:col-span-full">
            <Button
              type="submit"
              className="btn-academic-hero w-full"
              disabled={isPending || isLoading}
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Zenginleştiriliyor...
                </span>
              ) : (
                "Tez Anayasasını Zenginleştir"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
