import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HelpCircle as QuestionIcon } from "lucide-react";

interface ClarificationQuestion {
  id: string;
  question: string;
  contextNote?: string;
}

interface ReportClarificationsProps {
  questions: ClarificationQuestion[];
  answers: Record<string, string>;
  onAnswerChange: (id: string, val: string) => void;
}

/**
 * Renders clarification questions for novel gap.
 *
 * @param props - Clarification props.
 * @returns Clarification markup.
 */
export function ReportClarifications({
  questions,
  answers,
  onAnswerChange,
}: ReportClarificationsProps) {
  if (questions.length === 0) return null;

  return (
    <Card className="p-5 border-border bg-card space-y-4">
      <div className="flex flex-col space-y-1">
        <div className="flex items-center gap-2">
          <QuestionIcon className="size-4 text-primary" />
          <h3 className="font-serif text-sm font-semibold text-foreground">
            Jüri Tasarım Değerlendirmesi ve Kritik Netleştirmeler
          </h3>
        </div>
        <p className="text-xs text-muted-foreground pl-6">
          Jüri, tez kurgunuzda tespit edilen kavramsal, kuramsal veya ampirik
          noktaları gidermek ve araştırma deseninizi pekiştirmek adına aşağıdaki
          hususları netleştirmenizi önermektedir:
        </p>
      </div>

      <div className="space-y-4 pl-6">
        {questions.map((q, idx) => (
          <div key={q.id || `q-${idx}`} className="space-y-1.5">
            <Label
              htmlFor={`q-${q.id}`}
              className="text-sm font-semibold text-foreground"
            >
              {idx + 1}. {q.question}
            </Label>
            {q.contextNote && (
              <p className="text-xs text-muted-foreground/85 italic">
                {q.contextNote}
              </p>
            )}
            <Input
              id={`q-${q.id}`}
              value={answers[q.id] || ""}
              onChange={(e) => onAnswerChange(q.id, e.target.value)}
              placeholder="Bu konudaki açıklamanızı, tercihinizi veya düzeltmenizi belirtin (opsiyonel)..."
              className="text-xs h-9 mt-1.5"
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
