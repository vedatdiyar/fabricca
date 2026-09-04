/**
 * Language detector service using ELD (Efficient Language Detector - large database).
 * Uses lazy dynamic import to guarantee seamless resolution across Next.js ESM, CJS, and tsx environments.
 */
let eldInstance: {
  detect: (text: string) => { language: string; isReliable: () => boolean };
} | null = null;

/**
 * Pre-warms and initializes the ELD large database instance.
 */
export async function initLanguageDetector(): Promise<void> {
  if (!eldInstance) {
    const mod = await import("eld/large");
    eldInstance = mod.eld;
  }
}

/**
 * Detects the ISO 639-1 language code of the provided text.
 * Returns null if detector is uninitialized or language is undetermined.
 *
 * @param text - Text to analyze.
 * @returns Two-letter language code (e.g. "en", "tr", "es", "de") or null.
 */
export function detectLanguage(text: string): string | null {
  if (!eldInstance || !text) return null;
  try {
    const res = eldInstance.detect(text);
    return res?.language || null;
  } catch {
    return null;
  }
}
