import React from "react";
import { Compass, ScanEye, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { GapAnalysisStructured } from "@/app/(onboarding)/onboarding/positioning/_services/validation";

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
 * Renders the 3 fixed jury synthesis sections inside an elegant, unified editorial container.
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

  const sections = [
    {
      step: "01",
      title: "Mevcut Literatürün Haritalandırılması",
      icon: Compass,
      content: data.literatureMapping,
      accentClass: "text-info",
    },
    {
      step: "02",
      title: "Literatürdeki Boşluk",
      icon: ScanEye,
      content: data.academicGap,
      accentClass: "text-warning",
    },
    {
      step: "03",
      title: "Çalışmanın Özgün Katkısı",
      icon: Sparkles,
      content: data.originalContribution,
      accentClass: "text-success",
    },
  ];

  return (
    <div className={`w-full ${className}`}>
      <Card className="rounded-md border border-border bg-card divide-y divide-border/40">
        {sections.map((sec) => {
          const Icon = sec.icon;
          return (
            <div key={sec.step} className="p-4 sm:p-5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 ${sec.accentClass}`} />
                  <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground">
                    {sec.title}
                  </h3>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground/50">
                  {sec.step}
                </span>
              </div>
              <div className="text-xs leading-relaxed text-muted-foreground space-y-1.5 font-sans pl-5.5">
                {sec.content.split("\n\n").map((para) => (
                  <p key={paragraphKey(para)} className="text-muted-foreground leading-relaxed">
                    {parseInlineMarkdown(para)}
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
