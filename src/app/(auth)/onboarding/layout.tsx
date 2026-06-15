import { OnboardingStepper } from "./_components/onboarding-stepper";

/**
 * Onboarding sürecinin tüm sayfalarını saran layout.
 * Sol tarafta dikey adım navigasyon sidebar'ını (stepper) sabitler
 * ve sağ tarafta sayfa içeriğini gösterir.
 * min-h-screen ve bg-background burada sağlanır,
 * böylece her sayfa kendi içerik div'inde bu sınıfları tekrar tanımlamaz.
 */
export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen bg-background">
      <OnboardingStepper />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
