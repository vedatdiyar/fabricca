import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  /**
   * Kaplama alanına göre yükleme varyasyonu.
   * - `sm`: Kart içi veya küçük alan yüklemeleri (`min-h-[40vh]`).
   * - `lg`: Tam sayfa veya ana onboarding içerik yüklemeleri (`min-h-[60vh]`).
   */
  size?: "sm" | "lg";
  className?: string;
}

/**
 * Merkezi yükleme bileşeni. Tüm async loading süreçleri tek bir merkezi
 * `LoadingSpinner` bileşenine bağlanır. Elle `min-h-[Xvh]` spinner şablonu
 * yazmak yasaktır.
 *
 * @param props - Bileşen prop'ları.
 * @param props.size - Yükleme alanı varyasyonu (`sm` | `lg`).
 * @param props.className - Ek sarmalayıcı sınıfları.
 * @returns Merkezi yükleme ekranı markup'ı.
 */
export function LoadingSpinner({
  size = "lg",
  className,
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-center",
        size === "sm" ? "min-h-[40vh]" : "min-h-[60vh]",
        className,
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
