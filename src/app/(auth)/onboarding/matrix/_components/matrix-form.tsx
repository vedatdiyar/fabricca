"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitThesisMatrixAction } from "../actions";

/**
 * Tez Matrisi doldurma formu (Client Component).
 * Kullanıcının akademik çalışmasının temel parametrelerini girmesini sağlar.
 */
export function MatrixForm() {
  const router = useRouter();
  const setStatus = useOnboardingStore((state) => state.setStatus);
  const statusMatrix = useOnboardingStore((state) => state.status.matrix);
  const formData = useOnboardingStore((state) => state.formData);
  const updateFormData = useOnboardingStore((state) => state.updateFormData);
  const updateEnrichedData = useOnboardingStore(
    (state) => state.updateEnrichedData,
  );

  const [studyTitle, setStudyTitle] = useState(formData?.studyTitle || "");
  const [researchQuestion, setResearchQuestion] = useState(
    formData?.researchQuestion || "",
  );
  const [mainClaim, setMainClaim] = useState(formData?.mainClaim || "");
  const [methodology, setMethodology] = useState(formData?.methodology || "");
  const [theoreticalFramework, setTheoreticalFramework] = useState(
    formData?.theoreticalFramework || "",
  );
  const [historicalSpatialLimits, setHistoricalSpatialLimits] = useState(
    formData?.historicalSpatialLimits || "",
  );

  const mutation = useMutation({
    mutationFn: submitThesisMatrixAction,
    onMutate: () => {
      setStatus("matrix", "loading");
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        setStatus("matrix", "success");
        // Sıfırlama Kalkanını tetiklemek için önce form verisini, sonra zenginleştirilmiş veriyi store'a yazıyoruz
        updateFormData({
          studyTitle: variables.studyTitle,
          researchQuestion: variables.researchQuestion,
          mainClaim: variables.mainClaim,
          methodology: variables.methodology,
          theoreticalFramework: variables.theoreticalFramework,
          historicalSpatialLimits: variables.historicalSpatialLimits,
        });
        updateEnrichedData(result.data);
        toast.success("Tez matrisi başarıyla zenginleştirildi.");
        router.push("/onboarding/enrichment");
      } else {
        setStatus("matrix", "error");
        toast.error(
          result.error || "Zenginleştirme sırasında bir hata oluştu.",
        );
      }
    },
    onError: (err) => {
      setStatus("matrix", "error");
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu.");
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    mutation.mutate({
      studyTitle,
      researchQuestion,
      mainClaim,
      methodology,
      theoreticalFramework,
      historicalSpatialLimits,
    });
  };

  const isPending = statusMatrix === "loading";

  return (
    <Card className="w-full pt-6">
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="grid w-full grid-cols-1 gap-6 md:grid-cols-2"
        >
          <div className="space-y-2">
            <Label
              htmlFor="calismaBasligi"
              className="mb-4 block font-semibold text-foreground"
            >
              Çalışma Başlığı
            </Label>
            <Textarea
              id="calismaBasligi"
              placeholder="Tez veya çalışma başlığınız"
              value={studyTitle}
              onChange={(e) => setStudyTitle(e.target.value)}
              required
              className="textarea-academic"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="arastirmaSorusu"
              className="mb-4 block font-semibold text-foreground"
            >
              Araştırma Sorusu
            </Label>
            <Textarea
              id="arastirmaSorusu"
              placeholder="Çalışmanızın temel araştırma sorusu"
              value={researchQuestion}
              onChange={(e) => setResearchQuestion(e.target.value)}
              required
              className="textarea-academic"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="temelIddia"
              className="mb-4 block font-semibold text-foreground"
            >
              Temel İddia
            </Label>
            <Textarea
              id="temelIddia"
              placeholder="Çalışmanızın savunduğu temel iddia"
              value={mainClaim}
              onChange={(e) => setMainClaim(e.target.value)}
              required
              className="textarea-academic"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="metodoloji"
              className="mb-4 block font-semibold text-foreground"
            >
              Metodoloji
            </Label>
            <Textarea
              id="metodoloji"
              placeholder="Kullanılan araştırma yöntem ve teknikleri"
              value={methodology}
              onChange={(e) => setMethodology(e.target.value)}
              required
              className="textarea-academic"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="kuramsalCerceve"
              className="mb-4 block font-semibold text-foreground"
            >
              Kuramsal Çerçeve
            </Label>
            <Textarea
              id="kuramsalCerceve"
              placeholder="Çalışmanızın dayandığı kuramsal temel"
              value={theoreticalFramework}
              onChange={(e) => setTheoreticalFramework(e.target.value)}
              required
              className="textarea-academic"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="tarihselMekansalSinirlar"
              className="mb-4 block font-semibold text-foreground"
            >
              Tarihsel / Mekânsal Sınırlar
            </Label>
            <Textarea
              id="tarihselMekansalSinirlar"
              placeholder="Çalışmanızın kapsadığı tarih aralığı ve mekânsal sınırırlar"
              value={historicalSpatialLimits}
              onChange={(e) => setHistoricalSpatialLimits(e.target.value)}
              required
              className="textarea-academic"
            />
          </div>

          <div className="md:col-span-full">
            <Button
              type="submit"
              className="btn-academic-hero w-full"
              disabled={isPending}
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
