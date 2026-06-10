import { redirect } from "next/navigation";
import { getProfile } from "@/proxy";
import { MatrixForm } from "./_components/matrix-form";

/**
 * Onboarding sürecinin 1. adımı: Tez Matrisi Formu (Server Component).
 * Kullanıcıyı yetkilendirme durumuna göre korur ve formu gösterir.
 */
export default async function OnboardingMatrixPage() {
  const profile = await getProfile();

  if (profile.onboarding_step !== "thesis_matrix") {
    redirect("/onboarding");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center space-y-8">
        <div className="flex flex-col items-center space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Tez Anayasası / Tez Matrisi
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Çalışmanızın temel yapı taşlarını tanımlayarak akademik altyapınızı
            oluşturun.
          </p>
        </div>

        <MatrixForm />
      </div>
    </main>
  );
}
