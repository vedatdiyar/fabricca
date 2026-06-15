"use client";

import { useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { toast } from "sonner";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  BookOpen,
  ShieldCheck,
  Brain,
  Cpu,
  MapPin,
  Archive,
  CheckCircle2,
  Library,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { processLiteratureReviewAction, confirmLiteratureAction } from "../actions";
import { LiteratureArticleCard } from "./literature-article-card";
import type { GeminiThesisBox, LiteraturePoolEntry } from "@/lib/types";

const categoryMeta: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; bgClass: string; textClass: string }
> = {
  intro: {
    label: "Giriş ve Temel İddia",
    icon: ShieldCheck,
    bgClass: "bg-emerald-500/10 border border-emerald-500/20",
    textClass: "text-emerald-400",
  },
  theory: {
    label: "Teorik Zemin",
    icon: Brain,
    bgClass: "bg-blue-500/10 border border-blue-500/20",
    textClass: "text-blue-400",
  },
  methodology: {
    label: "Yöntem Literatürü",
    icon: Cpu,
    bgClass: "bg-amber-500/10 border border-amber-500/20",
    textClass: "text-amber-400",
  },
  context: {
    label: "Tarihsel ve Mekânsal Bağlam",
    icon: MapPin,
    bgClass: "bg-violet-500/10 border border-violet-500/20",
    textClass: "text-violet-400",
  },
  primary_source: {
    label: "Birincil Özneler ve Arşivler",
    icon: Archive,
    bgClass: "bg-rose-500/10 border border-rose-500/20",
    textClass: "text-rose-400",
  },
};

const parentBoxes = [
  { category: "intro", title: "Giriş ve Temel İddia", description: "Tezin temel iddiaları ve giriş çerçevesi." },
  { category: "theory", title: "Teorik Zemin", description: "Kuramsal çerçeve ve teorik altyapı kutuları." },
  { category: "methodology", title: "Yöntem Literatürü", description: "Metodoloji ve araştırma yöntemi kutuları." },
  { category: "context", title: "Tarihsel ve Mekânsal Bağlam", description: "Tarihsel sınırlar ve coğrafi/mekânsal bağlam kutuları." },
  { category: "primary_source", title: "Birincil Özneler ve Arşivler", description: "İncelenen birincil özneler, arşivler ve belgeler." },
];

function SubBoxQuery({ subBox }: { subBox: GeminiThesisBox }) {
  const setLiteraturePool = useOnboardingStore((s) => s.setLiteraturePool);

  const query = useQuery({
    queryKey: ["literature-pool", subBox.title],
    queryFn: async () => {
      const result = await processLiteratureReviewAction({
        title: subBox.title,
        description: subBox.description,
        theorists: subBox.theorists,
        concepts: subBox.concepts,
        queries: subBox.queries,
      });
      if (result.error || !result.data) {
        throw new Error(result.error ?? "Literatür taraması başarısız oldu.");
      }
      return result.data;
    },
    staleTime: Infinity,
    enabled: !!subBox.title,
    retry: 1,
  });

  useEffect(() => {
    if (query.data) {
      const entry: LiteraturePoolEntry = {
        subBoxTitle: subBox.title,
        starterPack: query.data.starterPack,
        reservedPool: query.data.reservedPool,
      };
      setLiteraturePool(entry);
    }
  }, [query.data, subBox.title, setLiteraturePool]);

  if (query.isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-5 w-3/4 rounded bg-border" />
        <div className="h-24 w-full rounded-lg bg-border/60" />
        <div className="h-24 w-full rounded-lg bg-border/60" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="p-6 text-center border border-destructive/30 rounded-lg bg-destructive/5">
        <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
        <p className="text-sm text-destructive font-medium mb-1">
          Tarama hatası
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          {query.error instanceof Error ? query.error.message : "Bilinmeyen bir hata oluştu."}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
          className="gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Yeniden Dene
        </Button>
      </div>
    );
  }

  const starterPack = query.data?.starterPack ?? [];
  const reservedPool = query.data?.reservedPool ?? [];

  if (starterPack.length === 0) {
    return (
      <div className="p-6 text-center border border-dashed border-border rounded-lg bg-card/20">
        <p className="text-sm text-muted-foreground">
          Bu kutu için uygun literatür bulunamadı.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        {starterPack.map((article, idx) => (
          <LiteratureArticleCard key={idx} article={article} />
        ))}
      </div>
      {reservedPool.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 border border-border/30">
          <Library className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{reservedPool.length}</span> ek kaynak daha önerildi. İhtiyaç duyduğunuzda kütüphanenizde {reservedPool.length > 1 ? "hazır bekliyor olacaklar." : "hazır bekliyor olacak."}
          </p>
        </div>
      )}
    </div>
  );
}

export function LiteratureReviewContent() {
  const router = useRouter();
  const boxes = useOnboardingStore((s) => s.boxes);
  const literatureStatus = useOnboardingStore((s) => s.literatureStatus);
  const literaturePool = useOnboardingStore((s) => s.literaturePool);
  const setLiteratureStatus = useOnboardingStore((s) => s.setLiteratureStatus);

  const confirmMutation = useMutation({
    mutationFn: confirmLiteratureAction,
    onMutate: () => {
      setLiteratureStatus("loading");
    },
    onSuccess: (res) => {
      if ("error" in res && res.error) {
        setLiteratureStatus("error");
        toast.error(res.error);
        return;
      }
      setLiteratureStatus("success");
      toast.success("Tebrikler! Onboarding süreciniz tamamlandı. Ana sayfaya yönlendiriliyorsunuz.");
      router.push("/dashboard");
    },
    onError: (err) => {
      setLiteratureStatus("error");
      toast.error(err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.");
    },
  });

  const subBoxes = boxes ?? [];

  const groupedBoxes = useMemo(() => {
    return parentBoxes.map((parent) => ({
      ...parent,
      subBoxes: subBoxes.filter((b) => b.category === parent.category),
    }));
  }, [subBoxes]);

  const anyQueryLoading = literatureStatus === "loading";

  const allProcessed = useMemo(() => {
    if (!literaturePool) return false;
    return subBoxes.every((box) =>
      literaturePool.some((entry) => entry.subBoxTitle === box.title),
    );
  }, [subBoxes, literaturePool]);

  const handleFinalize = () => {
    if (!literaturePool || literaturePool.length === 0) {
      toast.error("Henüz işlenmiş literatür verisi bulunamadı. Lütfen tüm kutuların taranmasını bekleyin.");
      return;
    }
    const pool = literaturePool;
    confirmMutation.mutate({ literaturePool: pool });
  };

  if (subBoxes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-md">
          <div className="p-4 bg-muted/50 rounded-full inline-flex mx-auto">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          </div>
          <p className="text-muted-foreground text-sm">
            Konu kutuları yükleniyor...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-24">
      {/* Başlık ve Durum */}
      <div className="flex flex-col items-center text-center space-y-4 max-w-2xl mx-auto">
        <div className="p-4 bg-primary/10 border border-primary/20 rounded-full">
          <BookOpen className="w-12 h-12 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Literatür Taraması
          </h1>
          <p className="text-muted-foreground leading-relaxed text-sm">
            Konu kutularınız başarıyla oluşturuldu. Şimdi her bir alt kutu için
            akademik veri tabanları taranıyor ve yapay zeka destekli analiz ile
            en uygun kaynaklar seçiliyor. Her kutunun altında 5 temel makale
            ve 15 yedek kaynak listelenecektir.
          </p>
        </div>
      </div>

      {/* Kutu Bazında Literatür Listesi */}
      <div className="space-y-10">
        {groupedBoxes.map((parent) => {
          const meta = categoryMeta[parent.category] ?? {
            label: parent.title,
            icon: BookOpen,
            bgClass: "bg-muted border border-border",
            textClass: "text-foreground",
          };
          const IconComponent = meta.icon;

          if (parent.subBoxes.length === 0) return null;

          return (
            <div key={parent.category} className="space-y-4">
              {/* Kategori Başlığı */}
              <div className="flex items-center gap-3 pb-2 border-b border-border">
                <div className={`p-2 rounded-lg ${meta.bgClass}`}>
                  <IconComponent className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {meta.label}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {parent.description}
                  </p>
                </div>
              </div>

              {/* Alt Kutular */}
              <div className="grid grid-cols-1 gap-6">
                {parent.subBoxes.map((subBox, idx) => (
                  <div
                    key={idx}
                    className="border border-border rounded-xl bg-card p-5 space-y-4"
                  >
                    {/* Alt Kutu Başlığı */}
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-6 rounded-full bg-primary/60" />
                      <h3 className="text-base font-semibold text-foreground">
                        {subBox.title}
                      </h3>
                    </div>
                    {subBox.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed -mt-2 ml-3.5">
                        {subBox.description}
                      </p>
                    )}

                    {/* Sorgu İçeriği */}
                    <SubBoxQuery subBox={subBox} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky Final Buton */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="hidden sm:block text-sm text-muted-foreground">
            {allProcessed ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                Tüm kutular tarandı. Kaynakları onaylayarak onboarding sürecini tamamlayın.
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                Kaynaklar taranıyor, lütfen bekleyin...
              </span>
            )}
          </div>
          <Button
            onClick={handleFinalize}
            disabled={!allProcessed || anyQueryLoading}
            className="btn-academic-hero w-full sm:w-auto ml-auto"
          >
            {anyQueryLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Kaydediliyor...
              </span>
            ) : (
              "Onaylıyorum ve Teze Başla"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
