import React from "react";
import { Compass, ScanEye, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { GapAnalysisStructured } from "../_lib/validation";

interface PositioningMarkdownRendererProps {
  content: GapAnalysisStructured | string | unknown;
  className?: string;
}

/**
 * Parses inline markdown formatting (bold, italic, inline code).
 */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={idx} className="italic text-foreground/90">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={idx}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-primary"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

/**
 * Normalizes input payload into a structured GapAnalysisStructured object.
 * Supports structured objects, JSON strings, and legacy markdown strings.
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

  // Direct structured object
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

  // String payload (JSON or legacy Markdown)
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
      } catch {
        // Fallback to legacy markdown parsing below
      }
    }

    // Legacy Markdown parser for older database entries
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
 * Pure, structured renderer for the 3 fixed Academic Jury Synthesis sections.
 * Directly renders cards with designated icons without fuzzy matching or regex.
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
      <Card className="p-6 space-y-3 border-border shadow-sm bg-card hover:border-border/80 transition-colors">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Compass className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
          <h3 className="font-serif text-base font-bold text-foreground">
            Mevcut Literatürün Haritalandırılması
          </h3>
        </div>
        <div className="text-sm leading-relaxed text-foreground/90 space-y-2 pt-1">
          {data.literatureMapping.split("\n\n").map((para, idx) => (
            <p key={idx}>{parseInlineMarkdown(para)}</p>
          ))}
        </div>
      </Card>

      {/* 2. Literatürdeki Boşluk */}
      <Card className="p-6 space-y-3 border-border shadow-sm bg-card hover:border-border/80 transition-colors">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <ScanEye className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <h3 className="font-serif text-base font-bold text-foreground">
            Literatürdeki Boşluk
          </h3>
        </div>
        <div className="text-sm leading-relaxed text-foreground/90 space-y-2 pt-1">
          {data.academicGap.split("\n\n").map((para, idx) => (
            <p key={idx}>{parseInlineMarkdown(para)}</p>
          ))}
        </div>
      </Card>

      {/* 3. Çalışmanın Özgün Katkısı */}
      <Card className="p-6 space-y-3 border-border shadow-sm bg-card hover:border-border/80 transition-colors">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <h3 className="font-serif text-base font-bold text-foreground">
            Çalışmanın Özgün Katkısı
          </h3>
        </div>
        <div className="text-sm leading-relaxed text-foreground/90 space-y-2 pt-1">
          {data.originalContribution.split("\n\n").map((para, idx) => (
            <p key={idx}>{parseInlineMarkdown(para)}</p>
          ))}
        </div>
      </Card>
    </div>
  );
}
