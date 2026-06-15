"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitThesisMatrixAction } from "../actions";
import { fetchThesisMatrix } from "../../lib/fetch-actions";

export function MatrixForm() {
  const router = useRouter();

  const [studyTitle, setStudyTitle] = useState("");
  const [researchQuestion, setResearchQuestion] = useState("");
  const [mainClaim, setMainClaim] = useState("");
  const [methodology, setMethodology] = useState("");
  const [theoreticalFramework, setTheoreticalFramework] = useState("");
  const [historicalSpatialLimits, setHistoricalSpatialLimits] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchThesisMatrix().then((matrix) => {
      if (matrix) {
        setStudyTitle(matrix.studyTitle);
        setResearchQuestion(matrix.researchQuestion);
        setMainClaim(matrix.mainClaim);
        setMethodology(matrix.methodology);
        setTheoreticalFramework(matrix.theoreticalFramework);
        setHistoricalSpatialLimits(matrix.historicalSpatialLimits);
      }
      setLoading(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    try {
      const result = await submitThesisMatrixAction({
        studyTitle,
        researchQuestion,
        mainClaim,
        methodology,
        theoreticalFramework,
        historicalSpatialLimits,
      });
      if (result.success) {
        toast.success("Tez matrisi başarıyla zenginleştirildi.");
        router.push("/onboarding/enrichment");
      } else {
        toast.error(result.error || "Zenginleştirme sırasında bir hata oluştu.");
      }
    } catch {
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
        <form onSubmit={handleSubmit} className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="calismaBasligi" className="mb-4 block font-semibold text-foreground">
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
            <Label htmlFor="arastirmaSorusu" className="mb-4 block font-semibold text-foreground">
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
            <Label htmlFor="temelIddia" className="mb-4 block font-semibold text-foreground">
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
            <Label htmlFor="metodoloji" className="mb-4 block font-semibold text-foreground">
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
            <Label htmlFor="kuramsalCerceve" className="mb-4 block font-semibold text-foreground">
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
            <Label htmlFor="tarihselMekansalSinirlar" className="mb-4 block font-semibold text-foreground">
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
            <Button type="submit" className="btn-academic-hero w-full" disabled={isPending}>
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
