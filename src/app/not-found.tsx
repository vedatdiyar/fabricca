import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Root not-found page shown for unmatched routes.
 *
 * @returns The Turkish 404 fallback with a link back to the home page.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-serif text-2xl font-semibold tracking-tight text-foreground">
        Sayfa bulunamadı
      </p>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        Aradığın sayfa taşınmış ya da hiç var olmamış olabilir. Ana sayfadan
        devam edebilirsin.
      </p>
      <Link href="/">
        <Button>Ana Sayfaya Dön</Button>
      </Link>
    </div>
  );
}
