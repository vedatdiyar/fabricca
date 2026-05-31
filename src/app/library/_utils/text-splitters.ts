
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
 * Splits a single text string into chunks recursively using hierarchical separators
 * (double newlines, single newlines, spaces, and individual characters) while
 * respecting the specified chunkSize and chunkOverlap.
 */
export async function splitTextToChunks(
  text: string,
  chunkSize = 1000,
  chunkOverlap = 200,
): Promise<string[]> {
  if (chunkOverlap >= chunkSize) {
    throw new Error("chunkOverlap cannot be greater than or equal to chunkSize");
  }

  const separators = ["\n\n", "\n", " ", ""];

  // Step 1: Tokenize/split the text recursively to extract a flat list of alternating content and separator tokens
  function tokenize(currentText: string, separatorIndex: number): Array<{ text: string; isSeparator: boolean }> {
    if (currentText.length <= chunkSize || separatorIndex >= separators.length) {
      return [{ text: currentText, isSeparator: false }];
    }

    const separator = separators[separatorIndex];
    const parts = currentText.split(separator);
    const tokens: Array<{ text: string; isSeparator: boolean }> = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part) {
        if (part.length <= chunkSize) {
          tokens.push({ text: part, isSeparator: false });
        } else {
          tokens.push(...tokenize(part, separatorIndex + 1));
        }
      }
      if (i < parts.length - 1) {
        tokens.push({ text: separator, isSeparator: true });
      }
    }

    return tokens;
  }

  const tokens = tokenize(text, 0);

  // Step 2: Merge the flat tokens sequentially into chunks, respecting chunkSize and chunkOverlap
  const chunks: string[] = [];
  let currentChunk = "";

  for (const token of tokens) {
    if (token.isSeparator) {
      if (currentChunk) {
        currentChunk += token.text;
      }
    } else {
      if (!currentChunk) {
        currentChunk = token.text;
      } else {
        const prospectiveLength = currentChunk.length + token.text.length;
        if (prospectiveLength <= chunkSize) {
          currentChunk += token.text;
        } else {
          chunks.push(currentChunk.trim());

          let overlapText = "";
          if (chunkOverlap > 0) {
            overlapText = currentChunk.slice(-chunkOverlap).trimStart();
          }

          currentChunk = overlapText + token.text;
          if (currentChunk.length > chunkSize) {
            currentChunk = token.text;
          }
        }
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter((c) => c.length > 0);
}

/**
 * Splits a full markdown string first by headers, and then recursively using
 * our custom vanilla text splitter with standard constraints (1000 size, 200 overlap).
 */
export async function splitMarkdownIntoChunks(
  markdown: string,
): Promise<Array<{ pageContent: string; metadata: HeaderMetadata }>> {
  const headerDividedDocs = splitMarkdownByHeaders(markdown);
  const finalChunks: Array<{ pageContent: string; metadata: HeaderMetadata }> = [];

  for (const doc of headerDividedDocs) {
    const textChunks = await splitTextToChunks(doc.pageContent, 1000, 200);
    for (const chunk of textChunks) {
      finalChunks.push({
        pageContent: chunk,
        metadata: { ...doc.metadata },
      });
    }
  }

  return finalChunks;
}

