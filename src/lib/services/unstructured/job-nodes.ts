/** A single workflow node in the Unstructured job DAG. */
export interface UnstructuredJobNode {
  name: string;
  type: string;
  subtype: string;
  settings?: Record<string, unknown>;
}

/**
 * Builds a Partitioner node using the Auto strategy, routing each page to Fast, High Res, or VLM at runtime.
 *
 * @param provider - VLM provider used when Auto routes a page to VLM.
 * @param model - VLM model used when Auto routes a page to VLM.
 * @returns The partition job node definition.
 */
export function partitionAutoNode(
  provider = "vertexai",
  model = "gemini-2.5-flash",
): UnstructuredJobNode {
  return {
    name: "Partitioner",
    type: "partition",
    subtype: "vlm",
    settings: {
      is_dynamic: true,
      allow_fast: true,
      provider,
      model,
    },
  };
}

/**
 * Builds a Partitioner node forcing the VLM strategy for every page.
 *
 * @param provider - VLM provider.
 * @param model - VLM model.
 * @returns The partition job node definition.
 */
export function partitionVlmNode(
  provider = "vertexai",
  model = "gemini-2.5-flash",
): UnstructuredJobNode {
  return {
    name: "Partitioner",
    type: "partition",
    subtype: "vlm",
    settings: {
      is_dynamic: false,
      allow_fast: false,
      provider,
      model,
    },
  };
}

/**
 * Serializes job nodes into the request_data JSON string expected by the Create Job endpoint.
 *
 * @param nodes - Ordered DAG nodes (Partitioner -> Chunker -> Embedder).
 * @returns The request_data string for the job body.
 */
export function buildRequestData(nodes: UnstructuredJobNode[]): string {
  return JSON.stringify({ job_nodes: nodes });
}
