"use client";

import React, { useState } from "react";
import {
  Search,
  Layers,
  FlaskConical,
  Target,
  Sparkles,
  Save,
  BookMarked,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LibraryResourceCritique } from "../../_lib/types";
import type { CritiqueFormInput } from "../../_hooks/use-resource-critique";

interface CritiqueSectionProps {
  critique?: LibraryResourceCritique;
  onSaveCritique: (input: CritiqueFormInput) => void | Promise<void>;
}

const CRITIQUE_FIELDS = [
  {
    key: "researchQuestion",
    icon: Search,
    number: 1,
    label: "Araştırma Sorusu",
    question: "Bu çalışma neyi çözmeye veya anlamaya çalışıyor?",
  },
  {
    key: "theoreticalFramework",
    icon: Layers,
    number: 2,
    label: "Teorik ve Kavramsal Çerçeve",
    question: "Hangi teoriye, kavramlara veya anahtar terimlere dayanıyor?",
  },
  {
    key: "methodology",
    icon: FlaskConical,
    number: 3,
    label: "Metodoloji",
    question: "Hangi yöntem kullanılmış?",
  },
  {
    key: "mainArgument",
    icon: Target,
    number: 4,
    label: "Temel Argüman",
    question: "Yazarın ulaştığı ana sonuç ve savunduğu temel tez?",
  },
  {
    key: "literatureGap",
    icon: Sparkles,
    number: 5,
    label: "Literatür Boşluğu",
    question:
      "Yazar nerede eksik kalmış veya gelecekte ne yapılması gerektiğini söylemiş?",
  },
] as const;

type CritiqueFieldKey = (typeof CRITIQUE_FIELDS)[number]["key"];

/**
 * Maps an optional saved critique into the form's field values.
 *
 * @param critique - The saved analysis for the current resource, when present.
 * @returns The 5 field values, defaulting to empty strings.
 */
function toFieldValues(
  critique?: LibraryResourceCritique,
): Record<CritiqueFieldKey, string> {
  return {
    researchQuestion: critique?.researchQuestion ?? "",
    theoreticalFramework: critique?.theoreticalFramework ?? "",
    methodology: critique?.methodology ?? "",
    mainArgument: critique?.mainArgument ?? "",
    literatureGap: critique?.literatureGap ?? "",
  };
}

/**
 * Article analysis (Eser Analizi) form with 5 guiding academic fields.
 *
 * @param root0 - Component props.
 * @param root0.critique - The saved analysis for the currently selected resource, when present.
 * @param root0.onSaveCritique - Callback invoked with the 5 field values when the form is saved.
 * @returns The critique form markup.
 */
export function CritiqueSection({
  critique,
  onSaveCritique,
}: CritiqueSectionProps) {
  const [values, setValues] = useState<Record<CritiqueFieldKey, string>>(() =>
    toFieldValues(critique),
  );
  const [prevCritique, setPrevCritique] = useState(critique);

  if (critique !== prevCritique) {
    setPrevCritique(critique);
    setValues(toFieldValues(critique));
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    void onSaveCritique({
      researchQuestion: values.researchQuestion.trim(),
      theoreticalFramework: values.theoreticalFramework.trim(),
      methodology: values.methodology.trim(),
      mainArgument: values.mainArgument.trim(),
      literatureGap: values.literatureGap.trim(),
    });
  };

  return (
    <Card className="border border-border bg-background">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-primary" />
            <h3 className="font-serif text-lg font-medium tracking-tight text-foreground">
              Eser Analizi
            </h3>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {CRITIQUE_FIELDS.map((field) => {
            const Icon = field.icon;
            return (
              <div key={field.key} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded border border-border/40 bg-muted text-[10px] font-semibold text-muted-foreground">
                    {field.number}
                  </span>
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  <Label className="text-xs text-foreground font-medium">
                    {field.label}
                  </Label>
                </div>
                <Textarea
                  value={values[field.key]}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  placeholder={field.question}
                  rows={3}
                  className="textarea-academic text-sm resize-none"
                />
              </div>
            );
          })}

          <div className="flex items-center justify-end gap-3 pt-1 border-t border-border/40">
            <Button
              type="submit"
              variant="default"
              size="sm"
              className="gap-2 font-medium"
            >
              <Save className="h-4 w-4" /> Analizi Kaydet
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
