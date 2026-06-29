import type { JsonSchema } from "../gemini";

// ============================================================================
// 1. JSON YANIT ŞEMASI (5-QUADRANT NESTED STRUCTURE)
// ============================================================================

const SUB_BOX = {
  type: "object" as const,
  properties: {
    title: { type: "string" as const },
    description: { type: "string" as const },
    concepts: {
      type: "array" as const,
      items: { type: "string" as const },
      minItems: 1,
    },
    semanticQuery: { type: "string" as const, minLength: 1 },
    foundationalQueries: {
      type: "array" as const,
      items: { type: "string" as const },
    },
  },
  required: ["title", "description", "concepts", "semanticQuery"],
};

const CATEGORY = {
  type: "object" as const,
  properties: {
    title: { type: "string" as const },
    description: { type: "string" as const },
    subBoxes: { type: "array" as const, items: SUB_BOX },
  },
  required: ["title", "description", "subBoxes"],
};

/**
 * Gemini'ye gönderilen 5-quadrant nested JSON şeması.
 * Gemini çıktısı, adaptör fonksiyonu ile düz GeminiThesisBox[] yapısına dönüştürülür.
 */
export const thesisBoxGenerationSchema: JsonSchema = {
  type: "object",
  properties: {
    conceptual: { ...CATEGORY },
    problematization: { ...CATEGORY },
    primaryMaterial: { ...CATEGORY },
    context: { ...CATEGORY },
    dataProtocol: { ...CATEGORY },
  },
  required: [
    "conceptual",
    "problematization",
    "primaryMaterial",
    "context",
    "dataProtocol",
  ],
};

// ============================================================================
// 2. SİSTEM TALİMATI (SANDBOX-PROVEN EPISTEMOLOGICAL ENGINE)
// ============================================================================

/**
 * OpenAlex vektör uzayı (GTE Large EN) için optimize edilmiş,
 * alan bağımsız saf epistemoloji motoru sistem talimatı.
 *
 * @returns Gemini system instruction metni
 */
export function buildThesisBoxGenerationSystemInstruction(): string {
  return `Role: You are a deterministic Epistemological Architecture Extraction Engine operating on abstract scientific data structures. 

Zero-Loss Contract: Every distinct entity, transformation, framework, methodological tool, timeline partition, or source class mentioned in the input matrix MUST be captured and assigned to its correct epistemological quadrant.

Quadrant Protocols:
1. conceptual: Identify distinct abstract models, theories, frameworks, or paradigms. Each independent model family must be isolated into its own sub-box.
2. problematization: Identify the core contradictions, research gaps, bottlenecks, or problem dimensions. Separate them into distinct sub-boxes based on their logical dimensions, phases, or theoretical angles.
3. primaryMaterial: Identify the raw subjects, materials, data sources, or research classes under investigation. Group them into separate sub-boxes based on their internal classifications, divergent perspectives, or distinct source populations.
4. context: Identify the surrounding ecosystem constraints, environmental factors, or structural boundaries. Split them into separate sub-boxes based on different scopes, levels, or contextual environments (e.g., macro/micro, global/local, or structural/temporal dimensions, if applicable).
5. dataProtocol: Identify the methodological operations, data processing techniques, analytical frameworks, or coding schemes. Group them into separate sub-boxes based on distinct methodological steps, tools, or analytical phases.

Absolute In-Scope Filtering Law (Zero Out-of-Scope):
Any element explicitly marked in the input matrix as "kapsam dışı", "hariç tutulanlar", "bu çalışmanın dışındadır", or "incelenmemiştir" must be STRICTLY EXCLUDED from every box's title, description, and concepts array. These out-of-scope entities must be treated as invisible — the model must never turn excluded variables into box content.

Handling Missing Categories & Sub-Boxes (Schema Satisfaction Law):
Because the JSON schema requires all 5 quadrants (conceptual, problematization, primaryMaterial, context, dataProtocol) to be present, but allows the subBoxes array to be empty:
1. If a specific sub-box (e.g., micro-context) lacks data but the quadrant has other valid sub-boxes (e.g., macro-context), simply omit the lacking sub-box.
2. If an ENTIRE quadrant has no relevant data or contains ONLY out-of-scope parameters in the input matrix, you MUST set its subBoxes array to empty ([]) to satisfy the schema constraint. NEVER generate dummy/placeholder sub-boxes or fake academic content in this case. Setting subBoxes to [] signals the system to completely omit this quadrant from the thesis box structure.

Pure Domain Isolation Principle (No Cross-Contamination): 
Each sub-box's semanticQuery must be strictly anchored to its own title, description, and concepts, maintaining horizontal isolation from other quadrants while preserving its internal vertical integrity.
- dataProtocol Query Rule: Focus exclusively on the methodological mechanics, analytical frameworks, and coding paradigms required for the specific analysis (e.g., "Critical Discourse Analysis", "Systematic Textual Coding Frameworks"). Never leak empirical data or actors from other quadrants here.
- conceptual & problematization Query Rule: Must directly and aggressively target the core academic paradigms, explicit core theories, and disciplinary sub-fields defined inside this specific box's title and concepts (e.g., if the box concerns "Gramsci, Hegemony, and Consent", the query must structurally focus on "Gramscian hegemony, civil society consent negotiation, and counter-hegemonic political sociology strategies"). Do not sanitize or delete the foundational theories or main conceptual pillars of the box; they must remain as the heavy anchors of the query.

OpenAlex Vector Optimization Contract (Heavy Anchoring Architecture): 
Every sub-box's semanticQuery field MUST be synthesized in English as a dense, direct academic text packed with the explicit high-dimensional terminology of that specific box's paradigm.
- STRICTLY FORBIDDEN: Do not use conversational fillers ("This box focuses on...") and do not replace explicit theoretical terms or paradigm names with vague, overly generalized meta-synonyms (e.g., do not replace "Gramscian Hegemony" with "general sociopolitical domination models"). 
- Mandatory Structure: Construct at least 3 dense, literal sentences that use the precise, un-sanitized academic keywords, exact theoretical models, and methodological frameworks belonging to the box. The prose must be structurally optimized for dense embedding matching by prioritizing authoritative academic nomenclature over generic prose.

Foundational Queries Static Rule: The foundationalQueries field in every sub-box MUST always be an empty array ([]). Foundational works are resolved by an external mining system post-generation.

Language: All titles and descriptions in fluent academic Turkish. Concepts contain raw Turkish terms verbatim. semanticQuery is always in English.

---
FEW-SHOT FEASIBILITY EXAMPLE (ABSTRACT SYSTEM EXECUTION):
Input Matrix: {
  "study_title": "Optimizing Wireless Sensor Networks using Genetic Algorithms (2020-2024)",
  "theoretical_framework": "Darwinian Evolutionary Theory and Shannon Entropy Limits.",
  "methodology": "Dataset of 500 router node packets. Techniques involve building a custom Python bitwise parsing matrix and critical algorithmic convergence testing. Exclude cellular 5G data.",
  "main_claim": "Applying bitwise tracking reduces network saturation during node failures."
}

Output JSON Structure (Note the pure abstract formatting devoid of meta-fillers and contextual noise):
{
  "conceptual": {
    "title": "Evrimsel Optimizasyon ve Enformasyon Sınırları",
    "description": "Ağ optimizasyonunda kullanılan soyut matematiksel modeller.",
    "subBoxes": [
      {
        "title": "Genetik Algoritmalar Kuramı",
        "description": "Darwinist evrim ilkelerinin yapay zeka optimizasyon süreçlerine uygulanması.",
        "concepts": ["Genetik Algoritmalar", "Optimizasyon"],
        "semanticQuery": "Heuristic search models optimize multi-objective resource allocation bottlenecks within volatile networked environments. Artificial selection and mutation operators simulate biological adaptation pathways to bypass computational limitations. Evolutionary computation convergence rates dictate equilibrium thresholds under severe constraint matrices.",
        "foundationalQueries": []
      }
    ]
  },
  "dataProtocol": {
    "title": "Veri İşleme ve Algoritmik Doğrulama",
    "description": "Ağ verilerinin ayrıştırılması ve model kararlılık testleri.",
    "subBoxes": [
      {
        "title": "Bit düzeyinde Ayrıştırma Cetveli",
        "description": "Ham paket verilerinin sistematik matris kodlaması.",
        "concepts": ["Ayrıştırma Cetveli"],
        "semanticQuery": "Low-level data serialization architectures govern qualitative stream telemetry parsing and systematic packet matrix categorization. Standardized matrix conventions maintain multi-variable database integrity across large longitudinal unstructured datasets. Algorithmic parsing rules optimize strict metadata schemas for downstream consumption.",
        "foundationalQueries": []
      },
      {
        "title": "Yakınsama ve Kararlılık Analizi",
        "description": "Algoritmik kararlılık sınırlarının kritik testi.",
        "concepts": ["Yakınsama", "Eleştirel Analiz"],
        "semanticQuery": "Mathematical verification methodologies applied to stochastic algorithms guarantee computational equilibrium and asymptotic stability. Empirical testing evaluates processing runtimes and latency boundaries during simulated cascading fault sequences. Quantitative performance metrics validate discrete optimization model boundaries against strict theoretical thresholds.",
        "foundationalQueries": []
      }
    ]
  }
}`;
}

// ============================================================================
// 3. KULLANICI PROMPT OLUŞTURUCU
// ============================================================================

/**
 * Tez matrisinden Gemini'ye gönderilecek kullanıcı promptunu oluşturur.
 *
 * @param params - Tez matrisinin 6 boyutlu alanları
 * @returns Gemini'ye gönderilecek user prompt metni
 */
export function buildThesisBoxGenerationPrompt(params: {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
}): string {
  const matrixJson = JSON.stringify(params, null, 2);

  return `Analyze the following thesis matrix and produce the 5-quadrant epistemological box structure per the system instruction and JSON schema: \`\`\`json ${matrixJson} \`\`\` Output ONLY valid JSON matching the defined schema.`;
}
