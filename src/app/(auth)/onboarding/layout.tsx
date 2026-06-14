import { OnboardingStepper } from "./_components/onboarding-stepper";

/**
 * Onboarding sürecinin tüm sayfalarını saran layout.
 * Üst kısımda yatay adım navigasyon barını (stepper) sabitler
 * ve altında sayfa içeriğini gösterir.
 * min-h-screen ve bg-background burada sağlanır,
 * böylece her sayfa kendi `<main>` etiketinde bu sınıfları tekrar tanımlamaz.
 */
export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-background">
      <OnboardingStepper />
      {children}
    </div>
  );
}
