import React from "react";
import { Compass, ScanEye, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GapAnalysisStructured } from "@/features/positioning/validation";

interface PositioningMarkdownRendererProps {
  content: GapAnalysisStructured | string | unknown;
  className?: string;
}

/**
 * Parses inline markdown formatting (bold, italic, inline code).
 *
 * @param text - The raw text to parse.
 * @returns The parsed React nodes with applied formatting.
 */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong
          key={`strong-${idx}-${part}`}
          className="font-semibold text-foreground"
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={`em-${idx}-${part}`} className="italic text-foreground">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={`code-${idx}-${part}`}
          className="rounded bg-muted px-2 py-1 font-mono text-xs text-primary"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

/**
 * Normalizes structured, JSON, or legacy markdown payloads into GapAnalysisStructured.
 *
 * @param content - The raw content payload to normalize.
 * @returns The normalized structured gap analysis data.
 */
function normalizeGapAnalysis(
  content: GapAnalysisStructured | string | unknown,
): GapAnalysisStructured {
  if (!content) {
    return {
      literatureMapping: "",
      academicGap: "",
      originalContribution: "",
    };
  }

  if (
    typeof content === "object" &&
    content !== null &&
    ("literatureMapping" in content ||
      "academicGap" in content ||
      "originalContribution" in content)
  ) {
    const obj = content as Record<string, unknown>;
    return {
      literatureMapping: String(obj.literatureMapping ?? ""),
      academicGap: String(obj.academicGap ?? ""),
      originalContribution: String(obj.originalContribution ?? ""),
    };
  }

  if (typeof content === "string") {
    const trimmed = content.trim();
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "object" && parsed !== null) {
          return {
            literatureMapping: String(parsed.literatureMapping ?? ""),
            academicGap: String(parsed.academicGap ?? ""),
            originalContribution: String(parsed.originalContribution ?? ""),
          };
        }
      } catch {}
    }

    return parseLegacyMarkdown(trimmed);
  }

  return {
    literatureMapping: String(content),
    academicGap: "",
    originalContribution: "",
  };
}

/**
 * Legacy parser for un-migrated database records saved in Markdown format.
 *
 * @param markdown - The legacy markdown content to parse.
 * @returns The parsed structured gap analysis data.
 */
function parseLegacyMarkdown(markdown: string): GapAnalysisStructured {
  const result: GapAnalysisStructured = {
    literatureMapping: "",
    academicGap: "",
    originalContribution: "",
  };

  const sections = markdown.split(/##\s+/);
  for (const sec of sections) {
    const lines = sec.trim().split("\n");
    const heading = lines[0]?.toLowerCase() ?? "";
    const body = lines.slice(1).join("\n").trim();

    if (
      heading.includes("harita") ||
      heading.includes("literatürün") ||
      heading.includes("mevcut")
    ) {
      result.literatureMapping = body || lines.join("\n").trim();
    } else if (
      heading.includes("boşluk") ||
      heading.includes("eksik") ||
      heading.includes("gap")
    ) {
      result.academicGap = body;
    } else if (
      heading.includes("özgün") ||
      heading.includes("katkı") ||
      heading.includes("değer")
    ) {
      result.originalContribution = body;
    } else if (!result.literatureMapping && body) {
      result.literatureMapping = sec.trim();
    }
  }

  return result;
}

/**
 * Derives a stable key for a rendered paragraph from its leading text.
 *
 * @param paragraph - The paragraph content.
 * @returns A deterministic content-based key.
 */
function paragraphKey(paragraph: string): string {
  const head = paragraph.trim().replace(/\s+/g, " ").slice(0, 48).toLowerCase();
  return head.length > 0 ? head : "empty-paragraph";
}

/**
 * Renders the 3 fixed jury synthesis sections as cards with designated icons.
 *
 * @param root0 - The component props.
 * @param root0.content - The gap analysis content to render.
 * @param root0.className - Optional extra CSS class for the wrapper.
 * @returns The rendered synthesis section cards or null.
 */
export function PositioningMarkdownRenderer({
  content,
  className = "",
}: PositioningMarkdownRendererProps) {
  if (!content) return null;

  const data = normalizeGapAnalysis(content);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 1. Mevcut Literatürün Haritalandırılması */}
      <Card className="rounded-md border border-border bg-card hover:border-border/60 transition-colors">
        <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-3 flex flex-row items-center justify-between gap-3 border-b border-border/40 space-y-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-info/10 text-info border border-info/20 shrink-0">
              <Compass className="h-4 w-4" />
            </div>
            <CardTitle className="font-serif text-lg font-semibold tracking-tight text-foreground">
              Mevcut Literatürün Haritalandırılması
            </CardTitle>
          </div>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground shrink-0 hidden sm:inline-block">
            Literatür Analizi
          </span>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-4 text-sm leading-relaxed text-foreground space-y-3 font-sans">
          {data.literatureMapping.split("\n\n").map((para) => (
            <p key={paragraphKey(para)}>{parseInlineMarkdown(para)}</p>
          ))}
        </CardContent>
      </Card>

      {/* 2. Literatürdeki Boşluk */}
      <Card className="rounded-md border border-border bg-card hover:border-border/60 transition-colors">
        <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-3 flex flex-row items-center justify-between gap-3 border-b border-border/40 space-y-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-warning/10 text-warning border border-warning/20 shrink-0">
              <ScanEye className="h-4 w-4" />
            </div>
            <CardTitle className="font-serif text-lg font-semibold tracking-tight text-foreground">
              Literatürdeki Boşluk
            </CardTitle>
          </div>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground shrink-0 hidden sm:inline-block">
            Akademik Boşluk
          </span>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-4 text-sm leading-relaxed text-foreground space-y-3 font-sans">
          {data.academicGap.split("\n\n").map((para) => (
            <p key={paragraphKey(para)}>{parseInlineMarkdown(para)}</p>
          ))}
        </CardContent>
      </Card>

      {/* 3. Çalışmanın Özgün Katkısı */}
      <Card className="rounded-md border border-border bg-card hover:border-border/60 transition-colors">
        <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-3 flex flex-row items-center justify-between gap-3 border-b border-border/40 space-y-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-success/10 text-success border border-success/20 shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <CardTitle className="font-serif text-lg font-semibold tracking-tight text-foreground">
              Çalışmanın Özgün Katkısı
            </CardTitle>
          </div>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground shrink-0 hidden sm:inline-block">
            Özgün Değer
          </span>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-4 text-sm leading-relaxed text-foreground space-y-3 font-sans">
          {data.originalContribution.split("\n\n").map((para) => (
            <p key={paragraphKey(para)}>{parseInlineMarkdown(para)}</p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
