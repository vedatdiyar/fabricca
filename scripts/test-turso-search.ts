import { searchTezara } from "../src/features/tezara";

async function main() {
  console.log("Testing Turso Vector Search via searchTezara...");
  const query = "yapay zeka ve telif hakları";
  const start = performance.now();

  const results = await searchTezara(query, undefined, { limit: 5 });
  const duration = Math.round(performance.now() - start);

  console.log(`\nSearch finished in ${duration}ms. Results count: ${results.length}\n`);

  for (let i = 0; i < results.length; i++) {
    const t = results[i];
    console.log(`--- Result #${i + 1} ---`);
    console.log(`ID: ${t.id}`);
    console.log(`Title: ${t.title}`);
    console.log(`Author: ${t.author}`);
    console.log(`Year: ${t.year}`);
    console.log(`University: ${t.university}`);
    console.log(`Type: ${t.thesisType}`);
    console.log(`Language: ${t.language}`);
    console.log(`Abstract: ${t.abstract.slice(0, 150)}...`);
    console.log(`PDF URL: ${t.yokPdfUrl || "N/A"}\n`);
  }
}

main().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
