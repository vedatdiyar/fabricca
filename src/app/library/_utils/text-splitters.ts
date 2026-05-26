import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export interface HeaderMetadata {
  header_1: string;
  header_2: string;
  header_3: string;
  [key: string]: string;
}

/**
 * Custom Markdown Header Splitter to group document content hierarchically
 * based on headers (#, ##, ###) and preserve metadata context,
 * replicating LangChain's MarkdownHeaderTextSplitter behavior in JS/TS.
 */
export function splitMarkdownByHeaders(
  markdown: string,
): Array<{ pageContent: string; metadata: HeaderMetadata }> {
  const lines = markdown.split("\n");
  const sections: Array<{ pageContent: string; metadata: HeaderMetadata }> = [];

  let currentHeader1 = "";
  let currentHeader2 = "";
  let currentHeader3 = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const h1Match = line.match(/^#\s+(.+)$/);
    const h2Match = line.match(/^##\s+(.+)$/);
    const h3Match = line.match(/^###\s+(.+)$/);

    if (h1Match || h2Match || h3Match) {
      if (currentContent.length > 0) {
        sections.push({
          pageContent: currentContent.join("\n").trim(),
          metadata: {
            header_1: currentHeader1,
            header_2: currentHeader2,
            header_3: currentHeader3,
          },
        });
        currentContent = [];
      }

      if (h1Match) {
        currentHeader1 = h1Match[1].trim();
        currentHeader2 = "";
        currentHeader3 = "";
      } else if (h2Match) {
        currentHeader2 = h2Match[1].trim();
        currentHeader3 = "";
      } else if (h3Match) {
        currentHeader3 = h3Match[1].trim();
      }
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0) {
    sections.push({
      pageContent: currentContent.join("\n").trim(),
      metadata: {
        header_1: currentHeader1,
        header_2: currentHeader2,
        header_3: currentHeader3,
      },
    });
  }

  if (sections.length === 0) {
    sections.push({
      pageContent: markdown.trim(),
      metadata: { header_1: "", header_2: "", header_3: "" },
    });
  }

  return sections;
}

/**
 * Splits a full markdown string first by headers, and then recursively using
 * LangChain's character text splitter with standard constraints (1000 size, 200 overlap).
 */
export async function splitMarkdownIntoChunks(
  markdown: string,
): Promise<Array<{ pageContent: string; metadata: HeaderMetadata }>> {
  const headerDividedDocs = splitMarkdownByHeaders(markdown);
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const results = await textSplitter.splitDocuments(headerDividedDocs);
  // Ensure returning structured type
  return results as unknown as Array<{
    pageContent: string;
    metadata: HeaderMetadata;
  }>;
}
