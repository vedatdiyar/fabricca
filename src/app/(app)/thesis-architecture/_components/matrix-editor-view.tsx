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
  Pencil,
  X,
} from "lucide-react";

interface MatrixEditorViewProps {
  initialMatrix: Matrix;
}

interface MatrixCardDef {
  key:
    | "subjectProblem"
    | "theoreticalFramework"
    | "primaryMaterial"
    | "methodology";
  title: string;
  description: string;
  placeholder: string;
  icon: React.ReactNode;
}

const MATRIX_CARDS: MatrixCardDef[] = [
  {
    key: "subjectProblem",
    title: "1. Araştırma Problemi, Aktörler ve Odak",
    description:
      "Tezin ana problemi, hipotezi ve odaklandığı temel aktör/kurumlar",
    placeholder:
      "Tezin araştırma problemini ve odaklandığı temel aktörleri yazın...",
    icon: <Target className="h-5 w-5" />,
  },
  {
    key: "theoreticalFramework",
    title: "2. Teorik ve Kavramsal Çerçeve",
    description:
      "Çalışmayı ele aldığınız teorik mercek, model ve ana kavramlar",
    placeholder: "Çalışmanın teorik merceğini ve kavramsal modelini yazın...",
    icon: <Compass className="h-5 w-5" />,
  },
  {
    key: "primaryMaterial",
    title: "3. Birincil Malzeme ve Veri Kaynakları",
    description:
      "İnceleyeceğiniz ampirik belgeler, arşivler, metinler ve veriler",
    placeholder:
      "Birincil kaynakları, arşiv metinlerini ve ampirik malzemeleri yazın...",
    icon: <BookOpen className="h-5 w-5" />,
  },
  {
    key: "methodology",
    title: "4. Metodoloji ve Kodlama Yöntemi",
    description:
      "Verileri analiz etme biçiminiz, kodlama tipolojiniz ve araştırma tasarımınız",
    placeholder:
      "Nitel/söylemsel analiz yönteminizi ve kodlama tipolojinizi yazın...",
    icon: <Microscope className="h-5 w-5" />,
  },
];

export function MatrixEditorView({ initialMatrix }: MatrixEditorViewProps) {
  const [values, setValues] = useState({
    subjectProblem: initialMatrix.subjectProblem ?? "",
    theoreticalFramework: initialMatrix.theoreticalFramework ?? "",
    primaryMaterial: initialMatrix.primaryMaterial ?? "",
    methodology: initialMatrix.methodology ?? "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const resetToInitial = () => {
    setValues({
      subjectProblem: initialMatrix.subjectProblem ?? "",
      theoreticalFramework: initialMatrix.theoreticalFramework ?? "",
      primaryMaterial: initialMatrix.primaryMaterial ?? "",
      methodology: initialMatrix.methodology ?? "",
    });
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const res = await updateMatrixAction(values);
    setIsSaving(false);

    if (res.success) {
      toast.success("Tez matrisi başarıyla güncellendi.");
      setIsEditing(false);
    } else {
      toast.error(res.error ?? "Matris güncellenemedi.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-4 md:flex-row md:items-center">
        <div>
          <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Yaşayan Tez Matrisi
          </h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Tez araştırmanız ve okumalarınız ilerledikçe 4 temel sütundaki
            hipotez, teori, malzeme ve yönteminizi güncelleyin.
          </p>
        </div>
        {isEditing ? (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={resetToInitial}
              disabled={isSaving}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              <span>İptal</span>
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{isSaving ? "Kaydediliyor..." : "Matrisi Kaydet"}</span>
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={() => setIsEditing(true)}
            className="shrink-0 gap-2"
          >
            <Pencil className="h-4 w-4" />
            <span>Düzenle</span>
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {MATRIX_CARDS.map((card) => {
          const value = values[card.key];

          return (
            <Card
              key={card.key}
              className="flex flex-col h-full border-border bg-card transition-colors hover:border-border"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary border border-primary/20">
                    {card.icon}
                  </div>
                  <div>
                    <CardTitle className="font-serif text-base font-semibold text-foreground">
                      {card.title}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      {card.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between pt-1">
                {isEditing ? (
                  <Textarea
                    value={value}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        [card.key]: e.target.value,
                      }))
                    }
                    rows={6}
                    className="textarea-academic min-h-[160px] w-full text-sm leading-relaxed"
                    placeholder={card.placeholder}
                  />
                ) : value.trim() ? (
                  <div className="flex-1 rounded-md border border-border/40 bg-muted/20 p-4 font-sans text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                    {value}
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border/40 bg-muted/10 p-6 text-center text-xs italic text-muted-foreground">
                    Henüz bu alana veri girilmemiş. &quot;Düzenle&quot; butonuna
                    basarak metninizi ekleyebilirsiniz.
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
