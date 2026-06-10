"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const [isPending, startTransition] = useTransition();

  const [calismaBasligi, setCalismaBasligi] = useState("");
  const [arastirmaSorusu, setArastirmaSorusu] = useState("");
  const [temelIddia, setTemelIddia] = useState("");
  const [metodoloji, setMetodoloji] = useState("");
  const [kuramsalCerceve, setKuramsalCerceve] = useState("");
  const [tarihselMekansalSinirlar, setTarihselMekansalSinirlar] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    startTransition(async () => {
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
        return;
      }

      toast.success("Tez matrisi başarıyla zenginleştirildi.");
      router.push("/onboarding/enrichment");
    });
  };

  return (
    <Card className="w-full pt-10 border-border bg-card">
      <CardContent>
        <form
          onSubmit={handleSubmit}
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
              required
              className="h-[120px] overflow-y-auto resize-none leading-relaxed bg-input border-border text-foreground"
            />
          </div>

          <div className="space-y-2">
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
              required
              className="h-[120px] overflow-y-auto resize-none leading-relaxed bg-input border-border text-foreground"
            />
          </div>

          <div className="space-y-2">
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
              required
              className="h-[120px] overflow-y-auto resize-none leading-relaxed bg-input border-border text-foreground"
            />
          </div>

          <div className="space-y-2">
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
              required
              className="h-[120px] overflow-y-auto resize-none leading-relaxed bg-input border-border text-foreground"
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
              placeholder="Çalışmanızın kapsadığı tarih aralığı ve mekânsal sınırlar"
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
