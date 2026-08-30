"use client";

import { CheckCircle2, Pencil, Eye, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIBanner } from "@/components/shared/ai-banner";

interface MatrixStudioHeaderProps {
  isAnyEditing: boolean;
  onToggleAllEdit: () => void;
}

/**
 * Renders MatrixStudio banner and global edit toggle.
 *
 * @param props - Header props.
 * @returns Header markup.
 */
export function MatrixStudioHeader({
  isAnyEditing,
  onToggleAllEdit,
}: MatrixStudioHeaderProps) {
  return (
    <>
      <AIBanner
        icon={CheckCircle2}
        title="Tez Matrisiniz Akademik Hassasiyetle Yapılandırıldı"
        description="Tez öneriniz, taranan literatür kanıtları ve odak tercihleriniz harmanlanarak aşağıdaki 4 temel kadran oluşturuldu. Kadranları önizleyebilir, düzenleme ikonuna tıklayarak geliştirebilir ve onaylayarak Konumlandırma adımına geçebilirsiniz."
      />

      <div className="flex items-center justify-between px-1">
        <div className="text-xs text-muted-foreground font-medium">
          {isAnyEditing ? (
            <span className="text-primary flex items-center gap-1.5">
              <Pencil className="size-3.5" />
              Kadranlar düzenleme modunda
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Eye className="size-3.5 text-muted-foreground" />
              Önizleme modu (Düzenlemek istediğiniz kutudaki kaleme tıklayın)
            </span>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onToggleAllEdit}
          className="h-7 text-xs px-2.5 rounded-md gap-1.5 text-muted-foreground hover:text-foreground"
        >
          {isAnyEditing ? (
            <>
              <Eye className="size-3.5 text-muted-foreground" />
              <span>Önizlemeye Dön</span>
            </>
          ) : (
            <>
              <Edit3 className="size-3.5 text-primary" />
              <span>Tümünü Düzenle</span>
            </>
          )}
        </Button>
      </div>
    </>
  );
}
