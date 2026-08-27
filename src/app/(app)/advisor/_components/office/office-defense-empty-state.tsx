import { Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { JuryCritique } from "../../_services/pipeline/types";

interface OfficeDefenseEmptyStateProps {
  activeCritique: JuryCritique | null;
  onStartDefense: (critique?: JuryCritique) => void;
}

/**
 * Empty state view shown before starting the live defense session with the thesis advisor.
 */
export function OfficeDefenseEmptyState({
  activeCritique,
  onStartDefense,
}: OfficeDefenseEmptyStateProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
      <div className="size-10 rounded-md bg-primary/10 text-primary mb-3 border border-primary/20 flex items-center justify-center">
        <Swords className="size-5" />
      </div>
      <h4 className="font-serif text-sm font-semibold tracking-tight text-foreground mb-1">
        Danışmanın Kapısını Çalın
      </h4>
      <p className="text-xs text-muted-foreground leading-relaxed mb-4">
        Sol paneldeki kenar notlarını ve jüri şerhlerini inceledikten sonra
        savunma oturumunu başlatın. Danışmanınız en kritik itiraz noktasını
        masaya getirecektir.
      </p>
      <Button
        onClick={() => onStartDefense(activeCritique || undefined)}
        className="h-8 text-xs px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium gap-1.5 cursor-pointer"
      >
        <Swords className="size-3.5" />
        <span>Savunmaya Başla (Müzakereyi Aç)</span>
      </Button>
    </div>
  );
}
