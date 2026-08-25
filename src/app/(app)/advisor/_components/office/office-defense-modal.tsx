"use client";

import { Swords, GraduationCap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { OfficeDefenseChat, type DefenseMessage } from "../office-defense-chat";
import type {
  JuryCritique,
  OfficeReviewReport,
} from "../../_services/pipeline/types";

interface OfficeDefenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outlineId?: number;
  activeOutlineTitle: string;
  report?: OfficeReviewReport;
  activeCritique: JuryCritique | null;
  defenseMessages: DefenseMessage[];
  hasStartedDefense: boolean;
  isStreamingDefense: boolean;
  onStartDefense: (critique?: JuryCritique) => Promise<void>;
  onSendMessage: (text: string) => Promise<void>;
}

/**
 * Modal dialog for live Socratic defense and negotiation with the thesis advisor.
 * Provides a focused, full-height dialogue environment while keeping background draft notes intact.
 *
 * @param props - Component props.
 * @returns Rendered Defense Modal markup.
 */
export function OfficeDefenseModal({
  open,
  onOpenChange,
  outlineId,
  activeOutlineTitle,
  report,
  activeCritique,
  defenseMessages,
  hasStartedDefense,
  isStreamingDefense,
  onStartDefense,
  onSendMessage,
}: OfficeDefenseModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] p-0 flex flex-col gap-0 overflow-hidden border border-border bg-card rounded-lg shadow-2xl">
        {/* Modal Header */}
        <DialogHeader className="p-4 border-b border-border bg-card shrink-0 flex-row items-center justify-between space-y-0 pr-12">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
              <GraduationCap className="size-4" />
            </div>
            <div>
              <DialogTitle className="font-serif text-base font-semibold tracking-tight text-foreground">
                Danışmanla Canlı Müzakere Masası
              </DialogTitle>
              <DialogDescription className="text-xs font-medium text-muted-foreground mt-0.5">
                {activeOutlineTitle ? (
                  <span>
                    <span className="font-semibold text-foreground">
                      {activeOutlineTitle}
                    </span>
                    <span className="mx-1.5 opacity-40">•</span>
                    <span>
                      {hasStartedDefense
                        ? "Şerhleri ve savunma argümanlarınızı yüz yüze müzakere edin."
                        : "Oturumu başlatarak danışmanınızla müzakere edin."}
                    </span>
                  </span>
                ) : hasStartedDefense ? (
                  "Danışman hocanızla şerhleri ve savunma argümanlarınızı yüz yüze müzakere edin."
                ) : (
                  "Oturumu başlatarak danışmanınızla müzakere edin."
                )}
              </DialogDescription>
            </div>
          </div>

          {activeCritique && (
            <Badge
              variant="outline"
              className="text-xs px-2 py-0.5 rounded-md bg-warning/10 text-warning border-warning/20 font-medium max-w-[240px] truncate hidden md:inline-flex items-center gap-1.5 shrink-0"
            >
              <Swords className="size-3.5 shrink-0" />
              <span className="truncate">Odak: {activeCritique.title}</span>
            </Badge>
          )}
        </DialogHeader>

        {/* Modal Body: Live Chat */}
        <div className="flex-1 min-h-0 bg-background">
          <OfficeDefenseChat
            outlineId={outlineId}
            outlineTitle={activeOutlineTitle}
            report={report}
            messages={defenseMessages}
            isStreaming={isStreamingDefense}
            hasStartedDefense={hasStartedDefense}
            activeCritique={activeCritique}
            onSendMessage={onSendMessage}
            onStartDefense={onStartDefense}
            hideHeader={true}
            className="border-0 rounded-none shadow-none bg-transparent"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
