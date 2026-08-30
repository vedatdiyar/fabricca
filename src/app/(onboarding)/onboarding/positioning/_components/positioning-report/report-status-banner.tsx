import { CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import { AIBanner } from "@/components/shared/ai-banner";

interface ReportStatusBannerProps {
  globalStatus?: string;
}

/**
 * Renders global jury evaluation status banner.
 *
 * @param props - Banner props with global status.
 * @returns Status banner markup.
 */
export function ReportStatusBanner({ globalStatus }: ReportStatusBannerProps) {
  const isNovelGap = globalStatus === "NOVEL_GAP_IDENTIFIED";
  const isDirectOverlap = globalStatus === "DIRECT_OVERLAP";

  return (
    <AIBanner
      icon={
        isNovelGap ? CheckCircle2 : isDirectOverlap ? AlertTriangle : HelpCircle
      }
      variant={isNovelGap ? "success" : isDirectOverlap ? "warning" : "info"}
      title={
        isNovelGap
          ? "Özgün Katkı: Belirgin Bir Akademik Literatür Boşluğu Doğrulandı"
          : isDirectOverlap
            ? "Akademik Çakışma Engeli: Doğrudan Emsal Çalışma Tespit Edildi"
            : "Öncü Çalışma: Doğrudan Emsal Çalışmaya Rastlanmadı"
      }
      description={
        isNovelGap
          ? "4 kanallı literatür taraması tamamlanmış; araştırmanızın dönemsel, kuramsal ve yöntemsel odağının özgün bir literatür boşluğunu doldurduğu akademik jüri tarafından teyit edilmiştir."
          : isDirectOverlap
            ? "Taranan ulusal ve uluslararası tez veritabanlarında araştırma sorunsalınız, kuramsal omurganız veya yöntemsel deseninizle doğrudan örtüşen tamamlanmış çalışma(lar) tespit edilmiştir. Akademik özgünlük kuralı gereği, çalışmanız bu haliyle savunulamaz ve onaylanamaz. Lütfen aşağıdaki çakışma anatomisini inceleyerek taslağınızı yeniden düzenleyin."
            : "Taranan çok kanallı veri tabanında konunuzla doğrudan örtüşen bir çalışmaya rastlanmamıştır. Teziniz literatürde bakir bir alanda öncü bir araştırma niteliği taşımaktadır."
      }
    />
  );
}
