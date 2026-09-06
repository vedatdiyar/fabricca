"use client";

import { useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, User, ShieldAlert } from "lucide-react";

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
 * Login page with a username/password authentication form; redirects to /onboarding or /dashboard based on onboarding status.
 *
 * @returns The login page markup.
 */
export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);

  /**
   * Submits the credentials to the server and navigates to the correct destination on success.
   *
   * @param e - The form submission event.
   */
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsPending(true);

    startTransition(async () => {
      const result = await loginAction(username, password);

      if (result.error) {
        toast.error(result.error);
        setIsPending(false);
        return;
      }

      toast.success("Giriş başarılı, yönlendiriliyorsunuz...");

      const status = await checkOnboardingStatus();

      if (!status.success) {
        toast.error(status.error);
        setIsPending(false);
        return;
      }

      router.push(status.onboardingCompleted ? "/dashboard" : "/onboarding");
    });
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background p-4 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative mx-auto flex w-full max-w-md flex-col items-center space-y-6 z-10 px-4 sm:px-0">
        <div className="flex flex-row items-center gap-5 text-left justify-center w-full">
          <Image
            src="/logo.svg"
            alt="Fabricca"
            width={84}
            height={84}
            priority
            className="h-20 w-20 shrink-0"
          />
          <div className="space-y-1">
            <h1 className="font-logo text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              Fabricca
            </h1>
            <p className="text-sm sm:text-base font-normal leading-relaxed text-muted-foreground">
              Dijital Tez Asistanı
            </p>
          </div>
        </div>

        <Card className="w-full border-border/60 bg-card/85 shadow-xl backdrop-blur-sm">
          <CardHeader className="space-y-2 p-6 pb-2">
            <CardTitle className="font-serif text-lg sm:text-xl font-semibold tracking-tight text-foreground">
              Giriş Yap
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground leading-normal">
              Akademik çalışmanıza devam etmek için bilgilerinizi girin.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-3 space-y-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="username"
                  className="text-sm font-medium text-foreground/90 flex items-center gap-2"
                >
                  <User className="size-4 text-muted-foreground" />
                  Kullanıcı Adı
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Kullanıcı adınızı girin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className="h-10 text-sm px-3.5 bg-background/60 hover:bg-background/80 focus:bg-background text-foreground border-border/60 transition-all duration-200 focus-visible:border-primary/60 focus-visible:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-foreground/90 flex items-center gap-2"
                >
                  <Lock className="size-4 text-muted-foreground" />
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
                    className="h-10 text-sm px-3.5 bg-background/60 hover:bg-background/80 focus:bg-background text-foreground border-border/60 transition-all duration-200 pr-10 focus-visible:border-primary/60 focus-visible:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 p-1 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={
                      showPassword ? "Şifreyi gizle" : "Şifreyi göster"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full h-10 text-sm font-medium mt-2 transition-all duration-200 active:scale-95 shadow-sm shadow-primary/20 cursor-pointer"
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

            <div className="flex items-start gap-2.5 p-3.5 bg-muted/20 border border-border/50 rounded-lg text-xs leading-relaxed text-muted-foreground select-none">
              <ShieldAlert className="size-4 text-warning shrink-0 mt-0.5" />
              <span>
                <strong className="font-medium text-foreground/90">
                  Erişim Kısıtlaması:
                </strong>{" "}
                Bu platform dışarıdan kayda kapalıdır. Yalnızca yetkilendirilmiş
                akademisyenler giriş yapabilir.
              </span>
            </div>
          </CardContent>
        </Card>

        <span className="text-xs text-muted-foreground/75 select-none tracking-wide">
          Fabricca v1.0.0 • Kapalı Akademik Sistem
        </span>
      </div>
    </main>
  );
}
