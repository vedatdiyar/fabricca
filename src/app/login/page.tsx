"use client";

import React, { useState, useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "./actions";
import { Eye, EyeOff, Lock, Loader2, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const router = useRouter();

  // Redirect on success
  useEffect(() => {
    if (state?.success) {
      router.push("/dashboard");
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="flex min-h-screen flex-col justify-center items-center bg-background text-foreground p-4 relative overflow-hidden select-none">
      {/* Sleek premium background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808006_1px,transparent_1px),linear-gradient(to_bottom,#80808006_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-40" />

      {/* Decorative background light orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-card rounded-full blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md border border-border bg-card backdrop-blur-xl p-8 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden group">
        {/* Subtle top edge glow on card */}
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="space-y-6 relative z-10">
          {/* Header */}
          <div className="text-center space-y-2">
            <span className="text-[9px] font-sans tracking-widest uppercase text-muted-foreground bg-muted border border-border px-2.5 py-0.5 rounded-full">
              SİYASET BİLİMİ PORTALI
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground font-sans mt-2">
              Fabricca
            </h1>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Tez Stratejisi ve RAG Karargahı erişimi için anahtar şifrenizi
              girin.
            </p>
          </div>

          {/* Form */}
          <form action={formAction} className="space-y-4 pt-2">
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground block"
              >
                Erişim Şifresi
              </label>

              <div className="relative">
                {/* Left Lock Icon */}
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <Lock className="size-4" />
                </div>

                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  required
                  disabled={isPending || state?.success}
                  aria-label="Erişim Şifresi"
                  className="w-full bg-background border border-border focus:border-ring text-foreground rounded-lg py-2.5 pl-9 pr-10 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground transition text-sm font-sans"
                />

                {/* Right Visibility Toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-muted-foreground transition"
                  disabled={isPending || state?.success}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {state?.error && !state.success && (
              <div className="border border-destructive text-destructive px-3 py-2.5 rounded-lg text-xs text-center border-l-2 border-l-destructive transition duration-150 font-sans animate-fade-in">
                {state.error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isPending || state?.success}
              className="w-full h-10 inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary active:translate-y-px transition-all select-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {isPending || state?.success ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin text-primary-foreground" />
                  Doğrulanıyor...
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  Giriş Yap
                  <ArrowRight className="size-4 text-primary-foreground group-hover:translate-x-0.5 transition" />
                </span>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="text-[10px] text-muted-foreground text-center border-t border-border pt-4 font-sans uppercase tracking-wider">
            &copy; 2026 Fabricca. Tüm Hakları Saklıdır.
          </div>
        </div>
      </div>
    </div>
  );
}
