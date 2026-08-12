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
  RefreshCw,
  Pencil,
  Check,
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

  const [activeEditingKey, setActiveEditingKey] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const startCardEdit = (key: MatrixCardDef["key"]) => {
    setActiveEditingKey(key);
    setEditValues((prev) => ({ ...prev, [key]: values[key] }));
  };

  const cancelCardEdit = (key: MatrixCardDef["key"]) => {
    if (activeEditingKey === key) {
      setActiveEditingKey(null);
    }
  };

  const saveCardEdit = async (key: MatrixCardDef["key"]) => {
    const updatedValue = editValues[key] ?? values[key];
    const newValues = { ...values, [key]: updatedValue };

    setSavingKey(key);
    const res = await updateMatrixAction(newValues);
    setSavingKey(null);

    if (res.success) {
      setValues(newValues);
      setActiveEditingKey(null);
      toast.success("Kart başarıyla güncellendi.");
    } else {
      toast.error(res.error ?? "Güncellenemedi.");
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {MATRIX_CARDS.map((card) => {
          const value = values[card.key];
          const isCardEditing = activeEditingKey === card.key;
          const isSavingThis = savingKey === card.key;

          return (
            <Card
              key={card.key}
              className="flex flex-col h-full border-border bg-card transition-colors hover:border-border"
            >
              <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0 gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary border border-primary/20">
                    {card.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="font-serif text-base font-semibold text-foreground truncate">
                      {card.title}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground line-clamp-1">
                      {card.description}
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isCardEditing ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => cancelCardEdit(card.key)}
                        disabled={isSavingThis}
                        aria-label="İptal"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => saveCardEdit(card.key)}
                        disabled={isSavingThis}
                        aria-label="Kaydet"
                      >
                        {isSavingThis ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
                      onClick={() => startCardEdit(card.key)}
                      aria-label="Düzenle"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col justify-between pt-1">
                {isCardEditing ? (
                  <Textarea
                    value={editValues[card.key] ?? ""}
                    onChange={(e) =>
                      setEditValues((prev) => ({
                        ...prev,
                        [card.key]: e.target.value,
                      }))
                    }
                    className="flex-1 w-full min-h-[320px] rounded-md border border-primary/50 bg-background/50 p-4 font-sans text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary resize-none transition-all"
                    placeholder={card.placeholder}
                    autoFocus
                  />
                ) : value.trim() ? (
                  <div className="flex-1 rounded-md border border-border/40 bg-muted/20 p-4 font-sans text-sm leading-relaxed text-foreground whitespace-pre-wrap min-h-[320px]">
                    {value}
                  </div>
                ) : (
                  <div
                    onClick={() => startCardEdit(card.key)}
                    className="flex flex-1 cursor-pointer items-center justify-center rounded-md border border-dashed border-border/40 bg-muted/10 p-6 text-center text-xs italic text-muted-foreground hover:border-primary/40 hover:bg-muted/20 transition-colors min-h-[320px]"
                  >
                    Henüz bu alana veri girilmemiş. Sağ üstteki düzenleme ikonuna tıklayarak metninizi ekleyebilirsiniz.
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
