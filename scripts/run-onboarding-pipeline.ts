import { eq, and, ne, sql } from "drizzle-orm";
import { db } from "../src/core/db";
import {
  users,
  matrices,
  positioning,
  boxes as boxRows,
  outlines as outlineRows,
  sources as sourceRows,
} from "../src/core/db/schema";
import { createFlowId, Logger } from "../src/lib/logger";
import { FLASH_LITE_35, GEMINI_SEED } from "../src/lib/constants";
import { ThinkingLevel } from "@google/genai";
import { generateGeminiStructuredContent } from "../src/core/services/ai";

// Positioning imports
import { searchAndSiftTheses } from "../src/app/(onboarding)/onboarding/positioning/_services/sifting";
import { evaluateThesesInParallel } from "../src/app/(onboarding)/onboarding/positioning/_services/per-thesis-evaluation";
import { analyzePositioningJury } from "../src/app/(onboarding)/onboarding/positioning/_services/analysis";
import { savePositioningReportTransaction } from "../src/app/(onboarding)/onboarding/positioning/_services/decision-engine";
import { sanitizeAcademicDataBulk } from "../src/core/services/academic";

// Boxes imports
import { buildBoxStructurePromptPayload } from "../src/app/(onboarding)/onboarding/boxes/_prompts/box-structure.prompt";
import {
  boxStructureSchema,
  boxStructureJsonSchema,
  bulkSemanticQuerySchema,
  bulkSemanticQueryJsonSchema,
  type RawBoxStructureResponse,
  type BulkSemanticQueryResponse,
} from "../src/app/(onboarding)/onboarding/boxes/_services/schemas";
import { buildSemanticQueryPromptPayload } from "../src/app/(onboarding)/onboarding/boxes/_prompts/semantic-query.prompt";
import { structureToQuadrants } from "../src/app/(onboarding)/onboarding/boxes/_services/semantic-queries";
import { mapToProductionShape } from "../src/app/(onboarding)/onboarding/boxes/_services/box-mapper";

// Outline imports
import { buildOutlineGenerationPromptPayload } from "../src/app/(onboarding)/onboarding/outline/_prompts/outline-generation.prompt";
import {
  outlineGenerationSchema,
  outlineGenerationJsonSchema,
  type OutlineGenerationResponse,
} from "../src/app/(onboarding)/onboarding/outline/_services/schema";

// Literature review imports
import type { SubBoxInput } from "../src/app/(onboarding)/onboarding/literature-review/_services/literature-review-papers";
import { orchestrateBatchProcess } from "../src/app/(onboarding)/onboarding/literature-review/_services/batch-orchestrator";
import {
  persistSubBoxEntry,
  persistLiteraturePool,
} from "../src/app/(onboarding)/onboarding/literature-review/_services/pool-persistence";
import { persistRelatedTheses } from "../src/app/(onboarding)/onboarding/literature-review/_services/related-theses";

const USER_ID = 1;

const THESIS_INPUT = {
  subjectProblem:
    "Kürt Özgürlük Hareketi'nin (PKK ve HEP-DEP-HADEP hattı) 1991-1999 döneminde manevra savaşından mevzi savaşına yönelik söylemsel dönüşümünün, hangi yapısal koşullar altında anlamlı hale geldiği (neden) ve talep içeriğindeki niteliksel değişim yoluyla nasıl gerçekleştiği (nasıl) test edilmektedir. Hipotez, bu dönüşümün 1999'da başlayan ani bir kırılma değil, 1985'ten (ERNK'nin kuruluşu) itibaren kesintisiz süregelen bir sürecin 1991-1999 arası kuluçka evresi olduğudur. Mercek altındaki aktörler PKK ve HEP-DEP-HADEP hattıdır; bunlar birbirine bağlı ama ayrı inceleme nesneleri olarak ele alınır, aralarındaki ilişkinin niteliği araştırmanın bir bulgusu olarak değerlendirilir.",
  theoreticalFramework:
    "Temel çerçeve Gramsci'nin manevra savaşı, mevzi savaşı ve karşı-hegemonya kavram setidir; bu, çalışmanın açıklayıcı çerçevesini oluşturur. Buna ek olarak Snow ve Benford'un kolektif eylem çerçeveleme teorisi (tanısal, prognostik ve motivasyonel çerçeveleme; çerçeve dönüşümü kavramı) yöntemsel bir araç olarak kullanılır ve talep içeriğindeki değişimin metinlerde nasıl kodlanacağını somutlaştırır.",
  primaryMaterial:
    "Birincil kaynaklar PKK'nın yayın organı Serxwebûn'un 1991-1999 dönemi sayıları, Öcalan'ın savunma ve hapishane metinleri, HEP, DEP ve HADEP'in parti tüzük ve programları, kongre tutanakları, seçim beyannameleri ve parlamento konuşmaları ile dönem basınından (Özgür Gündem, Özgür Ülke ve benzeri) oluşmaktadır.",
  methodology:
    "Çalışma nitel tarihsel-söylemsel analize dayanır. Yöntemin merkezinde bir talep tipolojisi bulunur: bağımsız Kürdistan ve devrim talebi manevra savaşına içkin, anayasal statü, kültürel hak ve demokratik toplum talebi ise mevzi savaşına içkin olarak kodlanır; bu kodlama Snow ve Benford'un çerçeveleme kavramlarıyla yürütülür. İki kaynak grubu, silahlı/manevra kanadı ve yasal/mevzi kanadı, birbirinden bağımsız olarak kodlanır ve ardından karşılaştırılır. Amaç bir ağırlık oranı hesaplamak değil, 1991'den 1999'a talep içeriğinin yönünü ve niteliksel dönüşümünü izlemektir.",
};

async function main() {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  console.log("======================================================");
  console.log("🚀 STARTING REAL ONBOARDING PIPELINE EXECUTION");
  console.log(`👤 Target User ID: ${USER_ID}`);
  console.log("======================================================");

  // -----------------------------------------------------------------
  // 1. SAVE THESIS MATRIX
  // -----------------------------------------------------------------
  console.log("\n[1/6] 📝 Saving Thesis Matrix...");
  const [matrix] = await db
    .insert(matrices)
    .values({
      userId: USER_ID,
      subjectProblem: THESIS_INPUT.subjectProblem,
      theoreticalFramework: THESIS_INPUT.theoreticalFramework,
      primaryMaterial: THESIS_INPUT.primaryMaterial,
      methodology: THESIS_INPUT.methodology,
      updatedAt: sql`now()`,
    })
    .onConflictDoUpdate({
      target: matrices.userId,
      set: {
        subjectProblem: THESIS_INPUT.subjectProblem,
        theoreticalFramework: THESIS_INPUT.theoreticalFramework,
        primaryMaterial: THESIS_INPUT.primaryMaterial,
        methodology: THESIS_INPUT.methodology,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  console.log(`✅ Thesis Matrix saved with ID: ${matrix.id}`);

  // -----------------------------------------------------------------
  // 2. POSITIONING PIPELINE (Search, Sift, Jury Evaluation)
  // -----------------------------------------------------------------
  console.log(
    "\n[2/6] 🎯 Running Positioning Analysis (Tezara + Cohere + Gemini)...",
  );
  const positioningInput = {
    subjectProblem: THESIS_INPUT.subjectProblem,
    theoreticalFramework: THESIS_INPUT.theoreticalFramework,
    methodology: THESIS_INPUT.methodology,
  };

  console.log(
    "   - Sifting candidate theses from Tezara (Qdrant) & Cohere Rerank v4.0 Pro...",
  );
  const siftedTheses = await searchAndSiftTheses(positioningInput, log);
  console.log(`   - Retrieved ${siftedTheses.length} sifted candidate theses.`);

  console.log("   - Evaluating theses in parallel via Gemini Flash Lite...");
  const evaluatedTheses = await evaluateThesesInParallel(
    positioningInput,
    siftedTheses,
    log,
  );
  const relevantTheses = evaluatedTheses.filter(
    (ev) => ev.evaluation.isRelevant,
  );
  console.log(`   - Found ${relevantTheses.length} relevant candidate theses.`);

  console.log("   - Synthesizing Academic Jury Analysis...");
  const juryResult = await analyzePositioningJury(
    positioningInput,
    relevantTheses,
    log,
  );
  console.log(`   - Jury status: ${juryResult.globalStatus}`);
  console.log(
    `   - Recommended guiding theses count: ${juryResult.recommendedTheses.length}`,
  );

  if (juryResult.recommendedTheses.length > 0) {
    console.log("   - Sanitizing academic titles & authors...");
    const itemsToSanitize = juryResult.recommendedTheses.map((t) => ({
      title: t.title || "",
      author: t.author || "",
    }));
    const sanitized = await sanitizeAcademicDataBulk(itemsToSanitize, log);
    juryResult.recommendedTheses = juryResult.recommendedTheses.map(
      (t, idx) => ({
        ...t,
        title: sanitized[idx]?.title || t.title,
        author: sanitized[idx]?.author || t.author,
      }),
    );
  }

  console.log("   - Persisting positioning report to database...");
  await savePositioningReportTransaction(USER_ID, matrix.id, juryResult);
  console.log("✅ Positioning report persisted.");

  // -----------------------------------------------------------------
  // 3. TOPIC BOXES PIPELINE (Structure Generation + Semantic Queries)
  // -----------------------------------------------------------------
  console.log(
    "\n[3/6] 📦 Generating Academic Topic Boxes (Phase 1 & Phase 2)...",
  );
  const boxStructurePayload = buildBoxStructurePromptPayload({
    subjectProblem: matrix.subjectProblem,
    theoreticalFramework: matrix.theoreticalFramework,
    primaryMaterial: matrix.primaryMaterial ?? "",
    methodology: matrix.methodology,
  });

  const structure =
    await generateGeminiStructuredContent<RawBoxStructureResponse>(
      FLASH_LITE_35,
      boxStructurePayload.systemInstruction,
      boxStructurePayload.userPrompt,
      boxStructureJsonSchema,
      log,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        zodSchema: boxStructureSchema,
        seed: GEMINI_SEED,
        thesisMatrix: matrix,
        payloadStage: "box_structure_generation",
        quiet: true,
      },
    );

  console.log(
    "   - Generating English semantic search queries for sub-boxes...",
  );
  const subBoxEntries: {
    title: string;
    boxType: string;
    description: string;
    concepts?: string[];
  }[] = [];

  for (const key of [
    "subjectProblem",
    "theoreticalFramework",
    "methodology",
  ] as const) {
    const quadrant = structure[key];
    for (const sb of quadrant.subBoxes) {
      subBoxEntries.push({
        title: sb.title,
        boxType:
          key === "subjectProblem"
            ? "SUBJECT_PROBLEM"
            : key === "theoreticalFramework"
              ? "THEORETICAL_FRAMEWORK"
              : "METHODOLOGY",
        description: sb.description ?? "",
        concepts: sb.concepts ?? [],
      });
    }
  }

  const semanticPayload = buildSemanticQueryPromptPayload({
    matrix: {
      subjectProblem: matrix.subjectProblem,
      theoreticalFramework: matrix.theoreticalFramework,
      methodology: matrix.methodology,
    },
    subBoxes: subBoxEntries,
  });

  const queryResult =
    await generateGeminiStructuredContent<BulkSemanticQueryResponse>(
      FLASH_LITE_35,
      semanticPayload.systemInstruction,
      semanticPayload.userPrompt,
      bulkSemanticQueryJsonSchema,
      log,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        zodSchema: bulkSemanticQuerySchema,
        seed: GEMINI_SEED,
        payloadStage: "semantic_query_generation",
        quiet: true,
      },
    );

  const queriesMap = new Map<string, string>();
  for (const entry of queryResult.semanticQueries) {
    queriesMap.set(entry.subBoxTitle, entry.semanticQuery);
  }

  const quadrants = structureToQuadrants(structure);
  const productionBoxes = mapToProductionShape(quadrants);

  for (const b of productionBoxes) {
    if (b.parentId !== null && queriesMap.has(b.title)) {
      b.semanticQuery = queriesMap.get(b.title) ?? "";
    }
  }

  console.log(
    `   - Persisting ${productionBoxes.length} boxes into database...`,
  );
  await db.transaction(async (tx) => {
    await tx
      .delete(boxRows)
      .where(
        and(
          eq(boxRows.matrixId, matrix.id),
          ne(boxRows.boxType, "RELATED_THESES"),
        ),
      );

    const parentFlatIndices: number[] = [];
    for (let i = 0; i < productionBoxes.length; i++) {
      if (productionBoxes[i].parentId === null) {
        parentFlatIndices.push(i);
      }
    }

    const parentValues = parentFlatIndices.map((i) => ({
      matrixId: matrix.id,
      title: productionBoxes[i].title,
      boxType: productionBoxes[i].boxType,
      description: productionBoxes[i].description || "",
      parentId: null,
      semanticQuery: null,
      concepts: productionBoxes[i].concepts || [],
    }));

    let insertedParents: { id: number }[] = [];
    if (parentValues.length > 0) {
      insertedParents = await tx
        .insert(boxRows)
        .values(parentValues)
        .returning({ id: boxRows.id });
    }

    const dbParentIdMap = new Map<number, number>();
    for (let j = 0; j < parentFlatIndices.length; j++) {
      const dbId = insertedParents[j]?.id;
      if (dbId !== undefined) {
        dbParentIdMap.set(parentFlatIndices[j], dbId);
      }
    }

    const childValues: (typeof boxRows.$inferInsert)[] = [];
    for (let i = 0; i < productionBoxes.length; i++) {
      const box = productionBoxes[i];
      if (box.parentId === null) continue;
      const mappedParentId = dbParentIdMap.get(box.parentId) ?? null;
      childValues.push({
        matrixId: matrix.id,
        title: box.title,
        boxType: box.boxType,
        description: box.description || "",
        parentId: mappedParentId,
        semanticQuery: box.semanticQuery || "",
        concepts: box.concepts ?? [],
      });
    }

    if (childValues.length > 0) {
      await tx.insert(boxRows).values(childValues);
    }
  });

  await persistRelatedTheses(USER_ID);
  console.log("✅ Topic boxes persisted.");

  // -----------------------------------------------------------------
  // 4. THESIS OUTLINE GENERATION
  // -----------------------------------------------------------------
  console.log("\n[4/6] 📑 Generating Thesis Outline via Gemini Flash Lite...");
  const outlinePayload = buildOutlineGenerationPromptPayload({
    subjectProblem: matrix.subjectProblem,
    theoreticalFramework: matrix.theoreticalFramework,
    primaryMaterial: matrix.primaryMaterial,
    methodology: matrix.methodology,
  });

  const generatedOutline =
    await generateGeminiStructuredContent<OutlineGenerationResponse>(
      FLASH_LITE_35,
      outlinePayload.systemInstruction,
      outlinePayload.userPrompt,
      outlineGenerationJsonSchema,
      log,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        zodSchema: outlineGenerationSchema,
        seed: GEMINI_SEED,
        thesisMatrix: matrix,
        payloadStage: "outline_generation",
        quiet: true,
      },
    );

  console.log(
    `   - Generated ${generatedOutline.sections.length} main chapters.`,
  );
  console.log("   - Persisting outline hierarchy to database...");
  await db.transaction(async (tx) => {
    await tx.delete(outlineRows).where(eq(outlineRows.matrixId, matrix.id));

    const parentValues: (typeof outlineRows.$inferInsert)[] = [];
    for (const section of generatedOutline.sections) {
      parentValues.push({
        matrixId: matrix.id,
        parentId: null,
        title: section.title,
        description: section.description,
        sortOrder: section.sortOrder,
        academicField: generatedOutline.academicField,
      });
    }

    if (parentValues.length > 0) {
      const insertedParents = await tx
        .insert(outlineRows)
        .values(parentValues)
        .returning({ id: outlineRows.id });

      const dbParentIdMap = new Map<number, number>();
      for (let i = 0; i < generatedOutline.sections.length; i++) {
        const dbId = insertedParents[i]?.id;
        if (dbId !== undefined) {
          dbParentIdMap.set(i, dbId);
        }
      }

      const childValues: (typeof outlineRows.$inferInsert)[] = [];
      for (let i = 0; i < generatedOutline.sections.length; i++) {
        const section = generatedOutline.sections[i];
        if (!section.subSections || section.subSections.length === 0) continue;
        const mappedParentId = dbParentIdMap.get(i) ?? null;
        if (mappedParentId === null) continue;

        for (let j = 0; j < section.subSections.length; j++) {
          const sub = section.subSections[j];
          childValues.push({
            matrixId: matrix.id,
            parentId: mappedParentId,
            title: sub.title,
            description: sub.description,
            sortOrder: sub.sortOrder,
            academicField: null,
          });
        }
      }

      if (childValues.length > 0) {
        await tx.insert(outlineRows).values(childValues);
      }
    }
  });

  console.log("✅ Thesis outline persisted.");

  // -----------------------------------------------------------------
  // 5. LITERATURE REVIEW PIPELINE (OpenAlex + Jury + Selection)
  // -----------------------------------------------------------------
  console.log(
    "\n[5/6] 📚 Running Literature Review Pipeline (OpenAlex + Gemini Paper Jury)...",
  );

  // Load all freshly saved boxes from DB
  const rawDbBoxes = await db
    .select()
    .from(boxRows)
    .where(eq(boxRows.matrixId, matrix.id));

  const parentBoxes = rawDbBoxes.filter(
    (b) => b.parentId === null && b.boxType !== "RELATED_THESES",
  );
  const subBoxInputs: SubBoxInput[] = parentBoxes.map((pBox) => {
    const children = rawDbBoxes.filter((c) => c.parentId === pBox.id);
    return {
      id: pBox.id,
      title: pBox.title,
      description: pBox.description ?? undefined,
      boxType: pBox.boxType ?? undefined,
      subBoxes: children.map((c) => ({
        title: c.title,
        description: c.description ?? undefined,
        thesisBoxId: c.id,
        semanticQuery: c.semanticQuery ?? "",
      })),
    };
  });

  console.log(
    `   - Processing ${subBoxInputs.length} parent topic boxes through batch orchestrator...`,
  );
  const { poolEntries } = await orchestrateBatchProcess(
    subBoxInputs,
    log,
    matrix.subjectProblem,
    undefined,
    async (thesisBoxId, articles) => {
      await persistSubBoxEntry(thesisBoxId, articles);
    },
  );

  console.log("   - Persisting final literature pool...");
  await persistLiteraturePool(poolEntries);
  await persistRelatedTheses(USER_ID);
  console.log("✅ Literature review sources persisted.");

  // -----------------------------------------------------------------
  // 6. FINALIZE ONBOARDING
  // -----------------------------------------------------------------
  console.log("\n[6/6] 🏁 Finalizing Onboarding for User...");
  await db
    .update(users)
    .set({ onboardingCompleted: true })
    .where(eq(users.id, USER_ID));

  console.log("✅ onboardingCompleted set to true.");

  // -----------------------------------------------------------------
  // VERIFICATION SUMMARY
  // -----------------------------------------------------------------
  const finalUser = await db.select().from(users).where(eq(users.id, USER_ID));
  const finalPos = await db
    .select()
    .from(positioning)
    .where(eq(positioning.userId, USER_ID));
  const finalBoxes = await db
    .select()
    .from(boxRows)
    .where(eq(boxRows.matrixId, matrix.id));
  const finalOutlines = await db
    .select()
    .from(outlineRows)
    .where(eq(outlineRows.matrixId, matrix.id));
  const finalSources = await db
    .select()
    .from(sourceRows)
    .innerJoin(boxRows, eq(sourceRows.boxId, boxRows.id))
    .where(eq(boxRows.matrixId, matrix.id));

  console.log("\n======================================================");
  console.log("🎉 ONBOARDING PIPELINE COMPLETED SUCCESSFULLY!");
  console.log("======================================================");
  console.log(
    `👤 User Onboarding Status: ${finalUser[0]?.onboardingCompleted}`,
  );
  console.log(`🎯 Positioning Status: ${finalPos[0]?.globalStatus}`);
  console.log(`📦 Total Topic Boxes: ${finalBoxes.length}`);
  console.log(`📑 Total Outline Sections: ${finalOutlines.length}`);
  console.log(`📚 Total Academic Sources Harvested: ${finalSources.length}`);
  console.log("======================================================\n");
}

main().catch((err) => {
  console.error("❌ Onboarding pipeline failed:", err);
  process.exit(1);
});
