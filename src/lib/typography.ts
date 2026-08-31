/**
 * Hafif tipografi token haritası — UI_RULES.md §1 beş katmanlı sistemin tek kaynağı.
 * Component değil, string map. `cn(typography.h1, className)` ile kullanılır.
 * `globals.css` @layer base ile senkron tutulmalı.
 */
export const typography = {
  /** Primary Title — h1 — 20px serif */
  h1: "font-serif text-xl font-semibold tracking-tight text-foreground",
  /** Section Title — h2 — 16px serif */
  h2: "font-serif text-base font-semibold tracking-tight text-foreground",
  /** Card Title — h3 — 14px serif */
  h3: "font-serif text-sm font-semibold tracking-tight text-foreground",
  /** Body — p — 14px sans */
  body: "font-sans text-sm font-normal leading-relaxed text-foreground",
  /** Body muted — açıklama paragrafları */
  bodyMuted: "font-sans text-sm font-normal leading-relaxed text-muted-foreground",
  /** UI & Meta — label/badge/button — 12px sans */
  meta: "font-sans text-xs font-medium text-muted-foreground",
  /** UI & Meta foreground — koyu meta */
  metaForeground: "font-sans text-xs font-medium text-foreground",
  /** Mono — sayaç/metrik/kod — 12px mono */
  mono: "font-mono text-xs font-semibold tracking-tight text-foreground",
  /** Label — form etiketi — 12px sans tracking-tight */
  label: "font-sans text-xs font-medium tracking-tight text-foreground",
} as const;

export type TypographyVariant = keyof typeof typography;
