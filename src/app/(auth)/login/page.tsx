"use client";

import { useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, checkOnboardingStatus } from "./actions";

/**
 * Kullanıcı giriş sayfası.
 * E-posta ve şifre ile kimlik doğrulama formunu içerir.
 * Başarılı giriş durumunda onboarding durumuna göre
 * /onboarding veya /dashboard sayfasına yönlendirilir.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);

  /**
   * Form gönderimini yönetir.
   * Server action'ı startTransition ile güvenli şekilde tetikler,
   * sonucu toast bildirimi olarak gösterir.
   * Başarılı giriş sonrası onboarding durumunu sorgulayarak
   * uygun sayfaya yönlendirme yapar.
   *
   * @param e - Form submit olayı
   */
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsPending(true);

    startTransition(async () => {
      const result = await loginAction(email, password);

      if (result.error) {
        toast.error(result.error);
        setIsPending(false);
        return;
      }

      toast.success("Giriş başarılı, yönlendiriliyorsunuz...");

      const status = await checkOnboardingStatus();

      if ("error" in status) {
        toast.error(status.error);
        setIsPending(false);
        return;
      }

      router.push(
        status.onboardingStep === "completed" ||
          status.onboardingStep === "originality_report_completed"
          ? "/dashboard"
          : "/onboarding",
      );
    });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center space-y-8">
        <div className="flex flex-col items-center space-y-3 text-center">
          <Image
            src="/logo.svg"
            alt="Fabricca"
            width={56}
            height={56}
            priority
            className="h-14 w-14"
          />
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Fabricca
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Dijital Tez Asistanı
            </p>
          </div>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle>Giriş Yap</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ornek@akademik.edu.tr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Şifre</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Giriş yapılıyor..." : "Giriş Yap"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
