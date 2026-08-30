import React from "react";
import { Compass, ScanEye, Sparkles } from "lucide-react";
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
 * Renders the 3 fixed jury synthesis sections inside an elegant, structured 3-dimensional layout.
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
      subtitle: "Literatür Haritası",
      icon: Compass,
      content: data.literatureMapping,
      isHighlight: false,
    },
    {
      step: "02",
      title: "Literatürdeki Boşluk",
      subtitle: "Akademik Boşluk",
      icon: ScanEye,
      content: data.academicGap,
      isHighlight: false,
    },
    {
      step: "03",
      title: "Çalışmanın Özgün Katkısı",
      subtitle: "Özgün Katkı",
      icon: Sparkles,
      content: data.originalContribution,
      isHighlight: true,
    },
  ];

  return (
    <div className={`w-full space-y-3 ${className}`}>
      {sections.map((sec) => {
        const Icon = sec.icon;
        return (
          <div
            key={sec.step}
            className={`p-4 rounded-md border transition-colors duration-200 space-y-2 ${
              sec.isHighlight
                ? "border-primary/20 bg-primary/10"
                : "border-border bg-card hover:border-primary/20"
            }`}
          >
            {/* Header: Step Badge + Icon + Title + Role Tag */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-medium px-2 py-0.5 rounded-md border border-primary/20 bg-primary/10 text-primary shrink-0">
                  {sec.step}
                </span>
                <Icon className="size-3.5 text-primary shrink-0" />
                <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground">
                  {sec.title}
                </h3>
              </div>
              <span className="font-sans text-xs font-medium text-secondary-foreground bg-secondary px-2 py-0.5 rounded-md border border-border shrink-0">
                {sec.subtitle}
              </span>
            </div>

            {/* Content Paragraphs */}
            <div className="text-sm font-normal leading-relaxed text-foreground space-y-1.5 font-sans">
              {sec.content.split("\n\n").map((para) => (
                <p
                  key={paragraphKey(para)}
                  className="text-foreground leading-relaxed"
                >
                  {parseInlineMarkdown(para)}
                </p>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
