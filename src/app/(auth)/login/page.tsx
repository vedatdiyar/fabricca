"use client";

import { useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Mail, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, checkOnboardingStatus } from "./actions";

/**
 * Kullanıcı giriş sayfası.
 * E-posta ve şifre ile kimlik doğrulama formunu içerir.
 * Başarılı giriş durumunda onboarding durumuna göre
 * /onboarding veya /dashboard sayfasına yönlendirilir.
 *
 * @returns Giriş sayfası bileşeni
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

      router.push(status.onboardingCompleted ? "/dashboard" : "/onboarding");
    });
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background p-4 overflow-hidden">
      {/* Arka plan derinlik efekti (Ambient glow) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative mx-auto flex w-full max-w-sm flex-col items-center space-y-6 z-10">
        {/* Logo ve Başlık Bölümü */}
        <div className="flex flex-row items-center gap-6 text-left justify-center w-full">
          <Image
            src="/logo.svg"
            alt="Fabricca"
            width={80}
            height={80}
            priority
            className="h-20 w-20 shrink-0"
          />
          <div className="space-y-1">
            <h1 className="font-logo text-3xl font-semibold tracking-tight text-foreground">
              Fabricca
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground">
              Dijital Tez Asistanı
            </p>
          </div>
        </div>

        {/* Giriş Kartı */}
        <Card className="w-full border border-border/60 bg-card/85 backdrop-blur-md">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="font-serif text-xl font-semibold tracking-tight text-foreground">
              Giriş Yap
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Akademik çalışmanıza devam etmek için bilgilerinizi girin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"
                >
                  <Mail className="h-3.5 w-3.5" />
                  E-posta
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ornek@akademik.edu.tr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="bg-background/40 border-border/60 focus:bg-background/80 transition-all duration-200"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Şifre
                </Label>
                <div className="relative flex items-center">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="bg-background/40 border-border/60 focus:bg-background/80 transition-all duration-200 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    tabIndex={-1}
                    aria-label={
                      showPassword ? "Şifreyi gizle" : "Şifreyi göster"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full mt-2 transition-all duration-200 active:scale-[0.98]"
                disabled={isPending}
              >
                {isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4 text-primary-foreground"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Giriş yapılıyor...
                  </span>
                ) : (
                  "Giriş Yap"
                )}
              </Button>
            </form>

            {/* Erişim Kısıtlaması Bilgilendirmesi */}
            <div className="flex gap-2 p-3 bg-muted/10 border border-border/40 rounded-md text-xs text-muted-foreground leading-relaxed select-none">
              <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <span>
                <strong>Erişim Kısıtlaması:</strong> Bu platform dışarıdan kayda
                kapalıdır. Yalnızca yetkilendirilmiş akademisyenler giriş
                yapabilir.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Sayfa Alt Bilgisi */}
        <span className="text-[10px] text-muted-foreground select-none">
          Fabricca v1.0.0 • Kapalı Akademik Sistem
        </span>
      </div>
    </main>
  );
}
