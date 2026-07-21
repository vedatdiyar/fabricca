import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function queryAllDetails() {
  const { db } = await import("../src/db");
  const { originalityReports } = await import("../src/db/schema");

  const reports = await db.select().from(originalityReports);

  reports.forEach((r, idx) => {
    console.log(`\n### REPORT ${idx + 1} ###`);
    console.log(`Title: ${r.title}`);
    console.log(`Author: ${r.author}`);
    console.log(`University: ${r.university}`);
    console.log(`Year: ${r.year}`);
    console.log(`Department: ${r.department}`);
    console.log(`Thesis Type: ${r.thesisType}`);
    console.log(`Is Relevant: ${r.isRelevant}`);
    console.log(`Originality Status: ${r.originalityStatus}`);
    console.log(`Is Eliminated: ${r.isEliminated}`);
    console.log(`Relevance Explanation: ${r.relevanceExplanation}`);
    console.log(
      `Abstract: ${r.abstract ? r.abstract.substring(0, 300) + "..." : "N/A"}`,
    );
    console.log("----------------------------------------");
  });
}

queryAllDetails()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
