export * from "./schemas";
export * from "./structure-prompt";
export * from "./semantic-queries-prompt";

import type {
  RawBoxStructureResponse,
  RawSemanticQueriesResponse,
} from "./schemas";
import type { RawQuadrants } from "@/app/(onboarding)/onboarding/_lib/box-mapper";

/**
 * Combines Phase 1 box structure and Phase 2 semantic queries into the unified
 * 5-quadrant RawQuadrants structure expected by mapToProductionShape adapter.
 * Sub-box level concepts are mapped directly to each sub-box object.
 *
 * @param structure - The 5-quadrant Turkish box structure generated in Phase 1.
 * @param queries - The quadrant-isolated OpenAlex English semantic queries generated in Phase 2.
 * @returns Unified RawQuadrants object.
 */
export function combineStructureAndQueries(
  structure: RawBoxStructureResponse,
  queries: RawSemanticQueriesResponse,
): RawQuadrants {
  const combineQuadrant = (quadKey: keyof RawSemanticQueriesResponse) => {
    const structQuad = structure[quadKey];
    const queryQuad = queries[quadKey];
    return {
      title: structQuad.title,
      description: structQuad.description,
      subBoxes: structQuad.subBoxes.map((sb, idx) => ({
        title: sb.title,
        description: sb.description,
        concepts: sb.concepts,
        semanticQuery: queryQuad?.subBoxes?.[idx]?.semanticQuery ?? "",
        foundationalQueries: [],
      })),
    };
  };

  return {
    conceptual: combineQuadrant("conceptual"),
    problematization: combineQuadrant("problematization"),
    context: combineQuadrant("context"),
    dataProtocol: combineQuadrant("dataProtocol"),
    primaryMaterial: combineQuadrant("primaryMaterial"),
  };
}
