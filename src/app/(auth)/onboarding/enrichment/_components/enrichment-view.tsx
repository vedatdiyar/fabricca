"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { confirmEnhancedThesisAction } from "../actions";
import type { EnhancedThesisData } from "../actions";

interface EnrichmentViewProps {
  initialData: EnhancedThesisData;
}

/**
 * Zenginleştirilmiş Tez Matrisi İnceleme/Düzenleme Ekranı (Client Component).
 * Kullanıcının yapay zeka tarafından zenginleştirilmiş metinleri incelemesini
 * ve gerekirse düzenleyerek onaylamasını sağlar.
 */
export function EnrichmentView({ initialData }: EnrichmentViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [calismaBasligi, setCalismaBasligi] = useState(
    initialData.akademikCalismaBasligi,
  );
  const [arastirmaSorusu, setArastirmaSorusu] = useState(
    initialData.literaturluArastirmaSorusu,
  );
  const [temelIddia, setTemelIddia] = useState(
    initialData.olgunlastirilmisTezSavi,
  );
  const [metodoloji, setMetodoloji] = useState(
    initialData.akademikMetodolojiTasarimi,
  );
  const [kuramsalCerceve, setKuramsalCerceve] = useState(
    initialData.kavramsalVeKuramsalAltyapi,
  );
  const [tarihselMekansalSinirlar, setTarihselMekansalSinirlar] = useState(
    initialData.tarihselMekansalSinirlar,
  );

  const handleConfirm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    startTransition(async () => {
      const result = await confirmEnhancedThesisAction({
        akademikCalismaBasligi: calismaBasligi,
        literaturluArastirmaSorusu: arastirmaSorusu,
        olgunlastirilmisTezSavi: temelIddia,
        akademikMetodolojiTasarimi: metodoloji,
        kavramsalVeKuramsalAltyapi: kuramsalCerceve,
        tarihselMekansalSinirlar: tarihselMekansalSinirlar,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Tez matrisiniz kaydedildi. Risk analizine geçiliyor.");
      router.push("/onboarding/risk");
    });
  };

  return (
    <Card className="w-full pt-10 border-border bg-card">
      <CardContent>
        <form
          onSubmit={handleConfirm}
          className="grid w-full grid-cols-1 gap-6 md:grid-cols-2"
        >
          <div className="space-y-2">
            <Label
              htmlFor="calismaBasligi"
              className="mb-4 block text-sm font-semibold text-foreground"
            >
              Çalışma Başlığı (Akademik)
            </Label>
            <Textarea
              id="calismaBasligi"
              value={calismaBasligi}
              onChange={(e) => setCalismaBasligi(e.target.value)}
              required
              className="h-[120px] overflow-y-auto resize-none leading-relaxed bg-input border-border text-foreground"
            />
          </div>

          <div className="space-y-2 md:col-start-1">
            <Label
              htmlFor="arastirmaSorusu"
              className="mb-4 block text-sm font-semibold text-foreground"
            >
              Araştırma Sorusu (Literatürlü)
            </Label>
            <Textarea
              id="arastirmaSorusu"
              value={arastirmaSorusu}
              onChange={(e) => setArastirmaSorusu(e.target.value)}
              required
              className="h-[120px] overflow-y-auto resize-none leading-relaxed bg-input border-border text-foreground"
            />
          </div>

          <div className="space-y-2 md:row-start-3 md:col-start-1">
            <Label
              htmlFor="temelIddia"
              className="mb-4 block text-sm font-semibold text-foreground"
            >
              Temel İddia (Sav/Hipotez)
            </Label>
            <Textarea
              id="temelIddia"
              value={temelIddia}
              onChange={(e) => setTemelIddia(e.target.value)}
              required
              className="h-[120px] overflow-y-auto resize-none leading-relaxed bg-input border-border text-foreground"
            />
          </div>

          <div className="space-y-2 md:row-start-1 md:col-start-2">
            <Label
              htmlFor="metodoloji"
              className="mb-4 block text-sm font-semibold text-foreground"
            >
              Metodoloji Tasarımı (Akademik)
            </Label>
            <Textarea
              id="metodoloji"
              value={metodoloji}
              onChange={(e) => setMetodoloji(e.target.value)}
              required
              className="h-[120px] overflow-y-auto resize-none leading-relaxed bg-input border-border text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="kuramsalCerceve"
              className="mb-4 block text-sm font-semibold text-foreground"
            >
              Kavramsal ve Kuramsal Altyapı
            </Label>
            <Textarea
              id="kuramsalCerceve"
              value={kuramsalCerceve}
              onChange={(e) => setKuramsalCerceve(e.target.value)}
              required
              className="h-[120px] overflow-y-auto resize-none leading-relaxed bg-input border-border text-foreground"
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
              value={tarihselMekansalSinirlar}
              onChange={(e) => setTarihselMekansalSinirlar(e.target.value)}
              required
              className="h-[120px] overflow-y-auto resize-none leading-relaxed bg-input border-border text-foreground"
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
                  Kaydediliyor...
                </span>
              ) : (
                "Onayla ve İlerle"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
