import { redirect } from "next/navigation";
import { getProfile } from "@/proxy";
import { CompleteButton } from "./_components/complete-button";
import { CheckCircle2, ShieldCheck, Compass } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Onboarding sürecinin final adımı: Bitiş İstasyonu (Server Component).
 * Kullanıcıyı yetkilendirme durumuna göre korur ve başarı ekranını gösterir.
 */
export default async function OnboardingCompletePage() {
  const profile = await getProfile();

  if (profile.onboarding_step !== "originality_report_completed") {
    redirect("/onboarding");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center space-y-8 text-center max-w-2xl mx-auto">
        <div className="p-4 bg-card text-primary rounded-full border border-primary">
          <CheckCircle2 className="w-12 h-12 animate-pulse" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Tebrikler, Hazırsınız!
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Tez matrisiniz yapılandırıldı ve akademik risk/maddi doğrulama
            analizi başarıyla tamamlandı. Artık dijital tez asistanınızı
            kullanmaya başlayabilirsiniz.
          </p>
        </div>

        <Card className="w-full bg-card border-border text-left leading-relaxed">
          <CardContent className="p-6 space-y-6">
            <div className="flex gap-4 items-start">
              <div className="mt-1 p-2 bg-muted rounded-lg border border-border text-primary">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">
                  Tez Anayasası ve Matrisi
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Çalışmanızın temel iddiaları ve akademik metodolojisi dijital
                  çalışma ortamınıza aktarıldı.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="mt-1 p-2 bg-muted rounded-lg border border-border text-primary">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">
                  Literatür ve Risk Matrisi
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Çakışma analizleri, maddi doğrulama briefing notları ve size
                  özel üretilen stratejik yol haritası kaydedildi.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <CompleteButton />
      </div>
    </main>
  );
}
