import { Swords } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
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
    <EmptyState
      icon={Swords}
      title="Danışmanın Kapısını Çalın"
      description="Sol paneldeki kenar notlarını ve jüri şerhlerini inceledikten sonra savunma oturumunu başlatın. Danışmanınız en kritik itiraz noktasını masaya getirecektir."
      layout="centered"
      className="h-full max-w-sm mx-auto"
      iconWrapperClassName="size-10 rounded-md bg-primary/10 text-primary mb-3 border border-primary/20"
      iconClassName="size-5"
      titleClassName="font-serif text-sm font-semibold tracking-tight text-foreground mb-1"
      descriptionClassName="text-xs text-muted-foreground leading-relaxed mb-4 max-w-sm"
      actions={[
        {
          label: "Savunmaya Başla (Müzakereyi Aç)",
          onClick: () => onStartDefense(activeCritique || undefined),
          icon: Swords,
        },
      ]}
    />
  );
}
