import { redirect } from "next/navigation";
import { getProfile } from "@/proxy";
import { CompleteButton } from "./_components/complete-button";
import {
  CheckCircle2,
  ShieldCheck,
  Compass,
  Brain,
  Cpu,
  MapPin,
  Archive,
  Tag,
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
import { db } from "@/db";
import { thesisMatrices, thesisBoxes } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

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

/**
 * Onboarding sürecinin final adımı: Bitiş ve Konu Kutuları Onayı (Server Component).
 * Kullanıcının oluşturulan kutularını (boxes) veritabanından çeker ve detaylı olarak onaya sunar.
 */
export default async function OnboardingCompletePage() {
  const profile = await getProfile();

  if (profile.onboarding_step !== "originality_report_completed") {
    redirect("/onboarding");
  }

  // Kullanıcının matrisini ve oluşturulan kutuları veri tabanından sorgula
  const [matrix] = await db
    .select()
    .from(thesisMatrices)
    .where(eq(thesisMatrices.userId, profile.id));

  let boxesList = matrix
    ? await db
        .select()
        .from(thesisBoxes)
        .where(eq(thesisBoxes.thesisMatrixId, matrix.id))
    : [];

  // Auto-heal: Eğer tekrarlı ebeveyn kutuları varsa, fazlalıkları veri tabanından temizle
  if (matrix && boxesList.length > 0) {
    const tempParentBoxes = boxesList.filter((b) => b.parentId === null);
    const seenCategories = new Set<string>();
    const parentIdsToDelete: number[] = [];

    for (const p of tempParentBoxes) {
      if (!seenCategories.has(p.category)) {
        seenCategories.add(p.category);
      } else {
        parentIdsToDelete.push(p.id);
      }
    }

    if (parentIdsToDelete.length > 0) {
      await db
        .delete(thesisBoxes)
        .where(inArray(thesisBoxes.id, parentIdsToDelete));

      // Veri tabanından temiz veri setini tekrar çek
      boxesList = await db
        .select()
        .from(thesisBoxes)
        .where(eq(thesisBoxes.thesisMatrixId, matrix.id));
    }
  }

  // Ebeveyn kutuları ve alt kutuları ayır
  const parentBoxes = boxesList.filter((b) => b.parentId === null);
  const childBoxes = boxesList.filter((b) => b.parentId !== null);

  // Alt kutuları ebeveyn ID'lerine göre haritala
  const childBoxesByParentId = new Map<number, typeof childBoxes>();
  for (const child of childBoxes) {
    if (child.parentId) {
      const existing = childBoxesByParentId.get(child.parentId) || [];
      existing.push(child);
      childBoxesByParentId.set(child.parentId, existing);
    }
  }

  return (
    <main className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
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
            const subBoxes = childBoxesByParentId.get(parent.id) || [];

            return (
              <div key={parent.id} className="space-y-4">
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
                    subBoxes.map((box) => (
                      <Card
                        key={box.id}
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
            Kutuları onayladığınızda, çalışma yapınız kalıcı olarak
            kütüphanenize ve kartoteks sisteminize işlenecek ve akademik veri
            tabanlarında otomatik literatür tarama adımı başlatılacaktır.
          </p>
          <CompleteButton />
        </div>
      </div>
    </main>
  );
}
