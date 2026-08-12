"use client";

import { useState } from "react";
import { Matrix } from "@/db/schema";
import { updateMatrixAction } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Target,
  Compass,
  BookOpen,
  Microscope,
  Save,
  RefreshCw,
} from "lucide-react";

interface MatrixEditorViewProps {
  initialMatrix: Matrix;
}

export function MatrixEditorView({ initialMatrix }: MatrixEditorViewProps) {
  const [subjectProblem, setSubjectProblem] = useState(
    initialMatrix.subjectProblem ?? "",
  );
  const [theoreticalFramework, setTheoreticalFramework] = useState(
    initialMatrix.theoreticalFramework ?? "",
  );
  const [primaryMaterial, setPrimaryMaterial] = useState(
    initialMatrix.primaryMaterial ?? "",
  );
  const [methodology, setMethodology] = useState(
    initialMatrix.methodology ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    const res = await updateMatrixAction({
      subjectProblem,
      theoreticalFramework,
      primaryMaterial,
      methodology,
    });
    setIsSaving(false);

    if (res.success) {
      toast.success("Tez matrisi başarıyla güncellendi.");
    } else {
      toast.error(res.error ?? "Matris güncellenemedi.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="font-sans text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Yaşayan Tez Matrisi
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tez araştırmanız ve okumalarınız ilerledikçe 4 temel sütundaki
            hipotez, teori, malzeme ve yönteminizi güncelleyin.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="gap-2 shadow-sm"
        >
          {isSaving ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span>{isSaving ? "Kaydediliyor..." : "Matrisi Kaydet"}</span>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Section 1: Subject Problem */}
        <Card className="border-border/60 shadow-sm transition-all hover:border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  1. Araştırma Problemi, Aktörler ve Odak
                </CardTitle>
                <CardDescription className="text-xs">
                  Tezin ana problemi, hipotezi ve odaklandığı temel
                  aktör/kurumlar
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={subjectProblem}
              onChange={(e) => setSubjectProblem(e.target.value)}
              rows={6}
              className="resize-y text-sm leading-relaxed"
              placeholder="Tezin araştırma problemini ve odaklandığı temel aktörleri yazın..."
            />
          </CardContent>
        </Card>

        {/* Section 2: Theoretical Framework */}
        <Card className="border-border/60 shadow-sm transition-all hover:border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  2. Teorik ve Kavramsal Çerçeve
                </CardTitle>
                <CardDescription className="text-xs">
                  Çalışmayı ele aldığınız teorik mercek, model ve ana kavramlar
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={theoreticalFramework}
              onChange={(e) => setTheoreticalFramework(e.target.value)}
              rows={6}
              className="resize-y text-sm leading-relaxed"
              placeholder="Çalışmanın teorik merceğini ve kavramsal modelini yazın..."
            />
          </CardContent>
        </Card>

        {/* Section 3: Primary Material */}
        <Card className="border-border/60 shadow-sm transition-all hover:border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  3. Birincil Malzeme ve Veri Kaynakları
                </CardTitle>
                <CardDescription className="text-xs">
                  İnceleyeceğiniz ampirik belgeler, arşivler, metinler ve
                  veriler
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={primaryMaterial}
              onChange={(e) => setPrimaryMaterial(e.target.value)}
              rows={6}
              className="resize-y text-sm leading-relaxed"
              placeholder="Birincil kaynakları, arşiv metinlerini ve ampirik malzemeleri yazın..."
            />
          </CardContent>
        </Card>

        {/* Section 4: Methodology */}
        <Card className="border-border/60 shadow-sm transition-all hover:border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Microscope className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  4. Metodoloji ve Kodlama Yöntemi
                </CardTitle>
                <CardDescription className="text-xs">
                  Verileri analiz etme biçiminiz, kodlama tipolojiniz ve
                  araştırma tasarımınız
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={methodology}
              onChange={(e) => setMethodology(e.target.value)}
              rows={6}
              className="resize-y text-sm leading-relaxed"
              placeholder="Nitel/söylemsel analiz yönteminizi ve kodlama tipolojinizi yazın..."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
