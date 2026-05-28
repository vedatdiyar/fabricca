"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { GraduationCap, Loader2, Check, X, Send } from "lucide-react";
import { PendingFunctionCall } from "../_hooks/use-advisor";

export interface ApprovalCardProps {
  pendingFunctionCall: PendingFunctionCall | null;
  isPending: boolean;
  handleApproveUpdate: () => void;
  handleRejectUpdate: (feedbackText?: string) => void;
}

export function ApprovalCard({
  pendingFunctionCall,
  isPending,
  handleApproveUpdate,
  handleRejectUpdate,
}: ApprovalCardProps) {
  const [showFeedbackInput, setShowFeedbackInput] = React.useState(false);
  const [rejectionFeedback, setRejectionFeedback] = React.useState("");

  const [prevPendingCall, setPrevPendingCall] =
    React.useState(pendingFunctionCall);
  if (pendingFunctionCall !== prevPendingCall) {
    setPrevPendingCall(pendingFunctionCall);
    if (!pendingFunctionCall) {
      setShowFeedbackInput(false);
      setRejectionFeedback("");
    }
  }

  if (!pendingFunctionCall) return null;

  return (
    <div className="max-w-4xl mx-auto my-6 p-5 border border-primary/20 bg-muted/60 rounded-xl shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300 relative overflow-hidden select-text">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0 shadow">
          <GraduationCap className="size-5" />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-sm font-black text-foreground tracking-tight font-sans">
              {pendingFunctionCall.name === "update_thesis_core_framework"
                ? "📋 Danışman Kararı Doğrultusunda Asistan Taslak Önerisi"
                : "📋 Danışman Kararı Doğrultusunda Asistan Kutu Taslağı"}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-sans">
              {pendingFunctionCall.name === "update_thesis_core_framework" ? (
                <>
                  *Danışmanınızla vardığınız mutabakat doğrultusunda,
                  asistanınız &apos;Metodoloji &amp; Tarihsel Kapsam&apos; alanı
                  için veritabanı taslağını hazırladı. Onayınız bekleniyor.*
                </>
              ) : (
                <>
                  *Danışmanınızın yönlendirmesi doğrultusunda, asistanınız
                  ilgili tez kutusunun (Bölüm İçeriği: Kutu ID{" "}
                  {pendingFunctionCall.args.boxId}) içeriğini revize etti.
                  Onayınız bekleniyor.*
                </>
              )}
            </p>
          </div>

          {/* Markdown Preview of the proposed update */}
          <div className="p-4 bg-background border border-border rounded-lg text-sm leading-relaxed text-foreground select-text max-h-72 overflow-y-auto font-sans shadow-inner">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }: React.ComponentPropsWithoutRef<"p">) => (
                  <p className="text-xs leading-relaxed text-foreground mb-2 last:mb-0">
                    {children}
                  </p>
                ),
                ul: ({ children }: React.ComponentPropsWithoutRef<"ul">) => (
                  <ul className="list-disc pl-4 text-xs my-1 space-y-1">
                    {children}
                  </ul>
                ),
                li: ({ children }: React.ComponentPropsWithoutRef<"li">) => (
                  <li className="text-xs">{children}</li>
                ),
              }}
            >
              {pendingFunctionCall.name === "update_thesis_core_framework"
                ? pendingFunctionCall.args.updatedMethodology || ""
                : pendingFunctionCall.args.updatedContent || ""}
            </ReactMarkdown>
          </div>

          {/* Action Buttons & Rejection Feedback Flow */}
          {!showFeedbackInput ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleApproveUpdate}
                disabled={isPending}
                className="bg-primary hover:bg-primary/95 text-primary-foreground border border-primary px-4 py-2 rounded-lg text-xs font-black transition flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5 stroke-[3]" />
                )}
                <span className="font-medium">
                  Değişikliği Onayla ve Kutuyu Güncel Tut
                </span>
              </button>

              <button
                onClick={() => setShowFeedbackInput(true)}
                disabled={isPending}
                className="bg-card hover:bg-muted border border-border text-foreground px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm hover:border-muted-foreground/30 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="size-3.5 stroke-[2.5]" />
                <span className="font-medium">Vazgeç / Reddet</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-4 border-t border-border animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="text-[11px] text-muted-foreground block font-sans font-semibold">
                Hocaya neden reddettiğinizi bildirmek ister misiniz? (Öneriyi
                şekillendirmek için eleştirilerinizi yazabilirsiniz):
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={rejectionFeedback}
                  onChange={(e) => setRejectionFeedback(e.target.value)}
                  placeholder="Eleştiriniz veya gerekçeniz (boş bırakabilirsiniz)..."
                  disabled={isPending}
                  aria-label="Hocaya iletilecek reddetme gerekçesi"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleRejectUpdate(rejectionFeedback);
                    }
                  }}
                  className="flex-1 bg-background border border-border rounded-lg text-xs px-3 py-2 text-foreground focus:outline-none focus:border-primary disabled:opacity-50 font-sans"
                />
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleRejectUpdate(rejectionFeedback)}
                    disabled={isPending}
                    className="bg-primary hover:bg-primary/95 text-primary-foreground border border-primary px-4 py-2 rounded-lg text-xs font-black transition flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Send className="size-3" />
                    )}
                    <span className="font-medium">
                      Gerekçeyi Gönder ve Yeni Öneri İste
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setShowFeedbackInput(false);
                      setRejectionFeedback("");
                    }}
                    disabled={isPending}
                    className="bg-card border border-border hover:bg-muted text-foreground px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Geri
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
