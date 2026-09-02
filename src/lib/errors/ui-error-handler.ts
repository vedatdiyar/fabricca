"use client";

import { toast } from "sonner";
import type { ActionErrorResult } from "./handle-error";

/**
 * Formats an ISO timestamp to local HH:mm (Turkish locale).
 *
 * @param iso - ISO-8601 string (e.g. Pacific midnight in UTC).
 * @returns Formatted time like "10:00" or null when invalid.
 */
function formatLocalTime(iso: string): string | null {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

/**
 * Central Sonner helper that turns an enriched ActionErrorResult into a
 * user-facing, quota-aware toast.
 *
 * - Plain string input → `toast.error(string)`
 * - `quotaType === "RPM"` → "Geçici Yoğunluk" + seconds derived from retryAfterMs
 * - `quotaType === "RPD"` → "Günlük Limit Doldu" + formatted resetsAt (HH:mm)
 * - All other cases → `toast.error(result.error || fallback)`
 *
 * Uses Sonner's rich API `toast.error(title, { description })` to create
 * visual hierarchy.
 *
 * @param result - The action result or plain string error.
 * @param defaultFallback - Optional fallback when result.error is empty.
 */
export function handleActionErrorToast(
  result: ActionErrorResult | string,
  defaultFallback?: string,
): void {
  if (typeof result === "string") {
    toast.error(result || defaultFallback || "Beklenmeyen bir hata oluştu.");
    return;
  }

  // RPM: per-minute / transient rate limit
  if (result.quotaType === "RPM") {
    const seconds =
      result.retryAfterMs !== undefined
        ? Math.max(1, Math.ceil(result.retryAfterMs / 1000))
        : 60;
    toast.error("Geçici Yoğunluk", {
      description: `Sistem şu anda yoğun. Lütfen ${seconds} saniye sonra tekrar deneyin.`,
    });
    return;
  }

  // RPD: daily free-tier quota exhausted
  if (result.quotaType === "RPD") {
    const formatted = result.resetsAt ? formatLocalTime(result.resetsAt) : null;
    if (formatted) {
      toast.error("Günlük Limit Doldu", {
        description: `Bugünkü ücretsiz yapay zeka kotanız dolmuştur. Kotanız ${formatted} saatinde yenilenecektir.`,
      });
    } else {
      toast.error("Günlük Limit Doldu", {
        description:
          "Bugünkü ücretsiz yapay zeka kotanız dolmuştur. Kota Pasifik saatiyle gece yarısı sıfırlanacaktır.",
      });
    }
    return;
  }

  // CONCURRENCY: treat like transient RPM with generic retry hint
  if (result.quotaType === "CONCURRENCY") {
    toast.error("Geçici Yoğunluk", {
      description:
        "Sistem eşzamanlı istek limitine ulaştı. Lütfen birkaç saniye sonra tekrar deneyin.",
    });
    return;
  }

  // Fallback: generic error
  toast.error(
    result.error || defaultFallback || "Beklenmeyen bir hata oluştu.",
  );
}
