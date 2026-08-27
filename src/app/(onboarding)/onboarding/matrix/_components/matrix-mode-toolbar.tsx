import { GraduationCap, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MatrixModeToolbarProps {
  activeMode: "advisor" | "classic";
  onSelectMode: (mode: "advisor" | "classic") => void;
}

/**
 * Top toolbar switcher between Socratic Advisor and Classic Form modes.
 */
export function MatrixModeToolbar({
  activeMode,
  onSelectMode,
}: MatrixModeToolbarProps) {
  return (
    <div className="flex items-center justify-between p-1.5 rounded-lg bg-card border border-border">
      <div className="flex items-center space-x-1">
        <Button
          type="button"
          variant={activeMode === "advisor" ? "default" : "ghost"}
          size="sm"
          onClick={() => onSelectMode("advisor")}
          className={`h-7 text-xs px-2.5 rounded-md [&_svg]:size-3.5 ${
            activeMode === "advisor"
              ? "bg-primary text-primary-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <GraduationCap className="mr-1.5" />
          Danışman Eşliğinde (Sokratik)
        </Button>

        <Button
          type="button"
          variant={activeMode === "classic" ? "default" : "ghost"}
          size="sm"
          onClick={() => onSelectMode("classic")}
          className={`h-7 text-xs px-2.5 rounded-md [&_svg]:size-3.5 ${
            activeMode === "classic"
              ? "bg-primary text-primary-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="mr-1.5" />
          Klasik Doğrudan Form
        </Button>
      </div>
    </div>
  );
}
