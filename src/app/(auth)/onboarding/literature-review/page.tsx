import { redirect } from "next/navigation";
import { getProfile } from "@/proxy";
import { BookOpen } from "lucide-react";

/**
 * Literature Review placeholder page (Server Component).
 *
 * This step comes after the subject boxes are confirmed and persisted.
 * The full literature review AI flow will be implemented here in a future phase.
 * For now, it shows a placeholder message while keeping the user's onboarding
 * data intact in the Zustand store.
 */
export default async function LiteratureReviewPage() {
  const profile = await getProfile();

  if (profile.onboarding_completed) {
    redirect("/dashboard");
  }

  return (
    <main className="flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-foreground">
          Literatür Taraması
        </h1>

        <p className="text-muted-foreground leading-relaxed">
          Konu kutularınız başarıyla kaydedildi. Literatür tarama adımı
          şu anda geliştirme aşamasındadır ve yakında kullanıma
          sunulacaktır.
        </p>

        <div className="border border-border/20 rounded-lg bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">
            Bu adım tamamlandığında, onboarding süreciniz sona erecek
            ve panele yönlendirileceksiniz.
          </p>
        </div>
      </div>
    </main>
  );
}
