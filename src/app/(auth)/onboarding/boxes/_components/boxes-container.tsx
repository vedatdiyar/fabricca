"use client";

import { useOnboardingStore } from "@/store/useOnboardingStore";
import { ConfirmBoxesButton } from "./confirm-boxes-button";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  ShieldCheck,
  Brain,
  Cpu,
  MapPin,
  Archive,
  BookOpen,
  BookMarked,
  UserRound,
  WholeWord,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const categoryMeta: Record<
  string,
  { label: string; icon: any; bgClass: string; textClass: string }
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
  {
    category: "intro",
    title: "Giriş ve Temel İddia",
    description: "Tezin temel iddiaları ve giriş çerçevesi.",
  },
  {
    category: "theory",
    title: "Teorik Zemin",
    description: "Kuramsal çerçeve ve teorik altyapı kutuları.",
  },
  {
    category: "methodology",
    title: "Yöntem Literatürü",
    description: "Metodoloji ve araştırma yöntemi kutuları.",
  },
  {
    category: "context",
    title: "Tarihsel ve Mekânsal Bağlam",
    description: "Tarihsel sınırlar ve coğrafi/mekânsal bağlam kutuları.",
  },
  {
    category: "primary_source",
    title: "Birincil Özneler ve Arşivler",
    description: "İncelenen birincil özneler, arşivler ve belgeler.",
  },
];

/**
 * Client-side container that renders the generated boxes stored in Zustand.
 * Groups child sub-boxes under the 5 static categories.
 */
export function BoxesContainer() {
  const boxes = useOnboardingStore((state) => state.boxes);

  if (!boxes) {
    redirect("/onboarding/risk");
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Başlık ve Durum */}
      <div className="flex flex-col items-center text-center space-y-4 max-w-2xl mx-auto">
        <div className="p-4 bg-primary/10 border border-primary/20 rounded-full">
          <CheckCircle2 className="w-12 h-12 text-primary animate-pulse" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Konu Kutuları Yapılandırıldı!
          </h1>
          <p className="text-muted-foreground leading-relaxed text-sm">
            Tez matrisinizin çözümlenmesi tamamlandı ve yapay zeka tarafından
            5 ana kategori altında çalışmanızın akademik konu kutuları
            (kartoteks yapısı) hazırlandı. Lütfen kutu içeriklerini inceleyip
            onaylayın.
          </p>
        </div>
      </div>

      {/* Kutuların Listesi */}
      <div className="space-y-8">
        {parentBoxes.map((parent) => {
          const meta = categoryMeta[parent.category] || {
            label: parent.title,
            icon: BookOpen,
            bgClass: "bg-muted border border-border",
            textClass: "text-foreground",
          };
          const IconComponent = meta.icon;
          const subBoxes = boxes.filter((b) => b.category === parent.category);

          return (
            <div key={parent.category} className="space-y-4">
              {/* Ana Kategori Başlığı */}
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

              {/* Alt Konu Kutuları */}
              <div className="grid grid-cols-1 gap-4">
                {subBoxes.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-border rounded-lg bg-card text-muted-foreground text-sm">
                    Bu kategoride alt konu kutusu üretilmemiştir.
                  </div>
                ) : (
                  subBoxes.map((box, idx) => (
                    <Card
                      key={idx}
                      className="bg-card/40 border border-border hover:border-primary/30 transition-all"
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-bold text-foreground">
                          {box.title}
                        </CardTitle>
                        {box.description && (
                          <CardDescription className="text-sm text-muted-foreground leading-relaxed">
                            {box.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Teorisyenler & Kavramlar */}
                        <div className="flex flex-wrap gap-4 text-sm">
                          {box.theorists && box.theorists.length > 0 && (
                            <div className="space-y-1">
                              <span className="font-semibold text-foreground block">
                                Teorisyenler:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {box.theorists.map((t, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium"
                                  >
                                    <UserRound className="w-3.5 h-3.5" />
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {box.concepts && box.concepts.length > 0 && (
                            <div className="space-y-1">
                              <span className="font-semibold text-foreground block">
                                Kavramlar:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {box.concepts.map((c, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium"
                                  >
                                    <WholeWord className="w-3.5 h-3.5" />
                                    {c}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Birincil ve İkincil Kaynaklar */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-sm">
                          {box.primaryLiterature &&
                            box.primaryLiterature.length > 0 && (
                              <div className="space-y-1.5 p-3 bg-muted/20 border border-border/40 rounded-lg">
                                <span className="font-semibold text-foreground flex items-center gap-1.5">
                                  <BookMarked className="w-4 h-4 text-primary" />
                                  Birincil Kaynaklar:
                                </span>
                                <ul className="text-muted-foreground list-inside list-disc space-y-1 text-xs leading-relaxed">
                                  {box.primaryLiterature.map((lit, i) => (
                                    <li key={i}>{lit}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                          {box.secondaryLiterature &&
                            box.secondaryLiterature.length > 0 && (
                              <div className="space-y-1.5 p-3 bg-muted/20 border border-border/40 rounded-lg">
                                <span className="font-semibold text-foreground flex items-center gap-1.5">
                                  <BookOpen className="w-4 h-4 text-primary" />
                                  İkincil Kaynaklar:
                                </span>
                                <ul className="text-muted-foreground list-inside list-disc space-y-1 text-xs leading-relaxed">
                                  {box.secondaryLiterature.map((lit, i) => (
                                    <li key={i}>{lit}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Onaylama Alanı */}
      <div className="pt-6 border-t border-border flex flex-col items-center justify-center space-y-4">
        <p className="text-sm text-muted-foreground text-center max-w-md leading-relaxed">
          Kutuları onayladığınızda, çalışma yapınız kalıcı olarak kütüphanenize
          ve kartoteks sisteminize işlenecek ve akademik veri tabanlarında
          otomatik literatür tarama adımı başlatılacaktır.
        </p>
        <ConfirmBoxesButton />
      </div>
    </div>
  );
}
