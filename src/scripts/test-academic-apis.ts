/**
 * Akademik API Test Scripti
 * Open Library + Semantic Scholar API'lerini gerçek siyaset bilimi eserleriyle test eder.
 *
 * Çalıştır: npx tsx src/scripts/test-academic-apis.ts
 */

// ===========================================================================
// TEST CASES — Gerçek siyaset bilimi klasikleri (kitap + makale)
// ===========================================================================
const TEST_CASES = [
  // Kitaplar (monografi)
  { title: "Hegemony and Socialist Strategy", author: "Laclau", type: "book" },
  { title: "The Prison Notebooks", author: "Gramsci", type: "book" },
  { title: "Discipline and Punish", author: "Foucault", type: "book" },
  // Makale (Semantic Scholar için)
  {
    title: "Framing: Toward Clarification of a Fractured Paradigm",
    author: "Entman",
    type: "article",
  },
  // Uydurma (reddedilmeli)
  {
    title: "Siyaset Biliminde Hegemonyanin Analitik Temelleri",
    author: "Vedat Diyar",
    type: "book",
  },
];

// ===========================================================================
// OPEN LIBRARY API
// ===========================================================================
async function testOpenLibrary(title: string, author: string) {
  const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=3&fields=title,author_name,publisher,first_publish_year,isbn,key,number_of_pages_median,edition_count`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Fabricca Academic Tool (test@fabricca.app)",
    },
  });

  if (!res.ok) {
    return { found: false, source: "OpenLibrary", error: `HTTP ${res.status}` };
  }

  const data = (await res.json()) as {
    numFound: number;
    docs: {
      title?: string;
      author_name?: string[];
      publisher?: string[];
      first_publish_year?: number;
      isbn?: string[];
      key?: string;
      number_of_pages_median?: number;
      edition_count?: number;
    }[];
  };

  if (data.numFound === 0 || !data.docs?.length) {
    return { found: false, source: "OpenLibrary", numFound: 0 };
  }

  const top = data.docs[0];
  return {
    found: true,
    source: "OpenLibrary",
    numFound: data.numFound,
    title: top.title,
    author: top.author_name?.join(", "),
    publisher: top.publisher?.[0],
    year: top.first_publish_year,
    isbn: top.isbn?.[0],
    editionCount: top.edition_count,
    pages: top.number_of_pages_median,
    olKey: top.key,
  };
}

// ===========================================================================
// SEMANTIC SCHOLAR API
// ===========================================================================
async function testSemanticScholar(title: string, author: string) {
  const query = `${title} ${author}`.trim();
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=3&fields=title,authors,year,venue,publicationTypes,externalIds,citationCount`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Fabricca Academic Tool",
    },
  });

  if (!res.ok) {
    return {
      found: false,
      source: "SemanticScholar",
      error: `HTTP ${res.status}`,
    };
  }

  const data = (await res.json()) as {
    total: number;
    data: {
      paperId?: string;
      title?: string;
      authors?: { name: string }[];
      year?: number;
      venue?: string;
      publicationTypes?: string[];
      externalIds?: { DOI?: string; ISBN?: string };
      citationCount?: number;
    }[];
  };

  if (!data.data?.length) {
    return { found: false, source: "SemanticScholar", total: data.total ?? 0 };
  }

  const top = data.data[0];
  return {
    found: true,
    source: "SemanticScholar",
    total: data.total,
    title: top.title,
    authors: top.authors?.map((a) => a.name).join(", "),
    year: top.year,
    venue: top.venue,
    publicationTypes: top.publicationTypes,
    doi: top.externalIds?.DOI,
    isbn: top.externalIds?.ISBN,
    citationCount: top.citationCount,
  };
}

// ===========================================================================
// MAIN
// ===========================================================================
async function main() {
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("  📚 AKADEMİK API TEST — Open Library + Semantic Scholar");
  console.log(
    "═══════════════════════════════════════════════════════════════\n",
  );

  for (const tc of TEST_CASES) {
    console.log(
      `\n▶ TEST: "${tc.title}" — ${tc.author} [beklenen tür: ${tc.type}]`,
    );
    console.log(
      "─────────────────────────────────────────────────────────────",
    );

    // Paralel sorgula
    const [olResult, ssResult] = await Promise.all([
      testOpenLibrary(tc.title, tc.author),
      testSemanticScholar(tc.title, tc.author),
    ]);

    console.log("📖 Open Library:");
    console.log(JSON.stringify(olResult, null, 2));

    console.log("\n🔬 Semantic Scholar:");
    console.log(JSON.stringify(ssResult, null, 2));

    // 1 saniye bekle (rate limit: 1 req/s)
    await new Promise((r) => setTimeout(r, 1100));
  }

  console.log(
    "\n═══════════════════════════════════════════════════════════════",
  );
  console.log("  ✅ TEST TAMAMLANDI");
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
}

main().catch(console.error);
