import { config } from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { db } from "./index";
import { references, pdfChunks } from "./schema";

config({ path: ".env.local" });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing");

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

interface ReferenceInput {
  title: string;
  authors: string;
  year: number;
  doi: string;
  abstract: string;
  chunks: string[];
}

const referencesData: ReferenceInput[] = [
  // ── GROUP A: 3 highly similar references (algorithmic governance cluster) ──
  {
    title: "Algorithmic Governance and Transparency in Public Administration",
    authors: "James Whitaker, Claudia Müller",
    year: 2024,
    doi: "10.1016/j.gpub.2024.01.001",
    abstract:
      "This study investigates how algorithmic decision-making systems reshape transparency mechanisms in public administration. Through a comparative analysis of e-governance platforms in the EU and North America, we argue that while AI systems increase administrative efficiency, they simultaneously create opacity in bureaucratic decision-making that undermines traditional accountability structures.",
    chunks: [
      "Algorithmic governance represents a paradigm shift in how public administrators process information and render decisions. Municipal governments increasingly deploy machine learning models to allocate resources, determine eligibility for social services, and even predict criminal recidivism. Our investigation reveals that while these systems process applications 3.5 times faster than human-led units, the explainability deficit is profound: citizens rarely receive intelligible justifications for automated denials. This creates a fundamental tension between the Weberian ideal of rational-legal bureaucracy and the opaque calculations of neural networks. We term this phenomenon 'algorithmic opacity'—the systematic inability of external oversight bodies to reconstruct the chain of reasoning behind administrative determinations. The implications for democratic legitimacy are severe, as the right to explanation—long considered a cornerstone of procedural justice—is effectively nullified when decisions emerge from black-box models.",
      "Transparency mechanisms in algorithmic governance face a trilemma: they must simultaneously satisfy operational efficiency, privacy protection, and public accountability. Our case studies of three European smart city initiatives demonstrate that when these values conflict, accountability is systematically deprioritized. In Barcelona's automated traffic enforcement system, citizens challenged over 12,000 citations in 2023, yet fewer than 3% received meaningful human review. The platform's justification engine produced template responses that referenced general legal statutes rather than the specific reasoning behind each citation. This pattern of 'performative transparency'—where systems create the appearance of openness while actively obscuring their operational logic—constitutes a fundamental challenge to administrative law. We argue that without mandatory algorithmic audit requirements and citizen-facing explanation interfaces, the promise of algorithmic efficiency will continue to erode the substantive accountability that legitimizes state authority.",
      "The findings of this research have direct implications for democratic theory. If legitimacy in modern states is increasingly derived from citizens' ability to understand and contest bureaucratic decisions, then algorithmic opacity represents not merely a technical failure but a constitutional crisis. Drawing on Habermas's theory of communicative action, we contend that automated decision-making disrupts the intersubjective validation processes through which administrative decisions acquire normative force. When citizens cannot query the rationale behind a government decision—cannot engage in what Habermas terms 'discursive will-formation'—they are reduced from democratic participants to mere objects of algorithmic administration. This transformation, we conclude, portends a new form of 'algorithmic despotism' in which efficiency gains are purchased at the cost of the communicative rationality that underpins democratic governance.",
    ],
  },
  {
    title:
      "Algorithmic Authoritarianism: Democratic Legitimacy in the Age of AI",
    authors: "Wei Chen, Sarah Bennington, Omar Hassan",
    year: 2024,
    doi: "10.1080/13569775.2024.02",
    abstract:
      "This article examines the concept of algorithmic authoritarianism as a distinct political phenomenon emerging from the integration of AI into state decision-making. We develop a theoretical framework that positions algorithmic systems as mechanisms for circumventing traditional democratic checks and balances, concentrating power in executive and technical institutions at the expense of legislative oversight and public participation.",
    chunks: [
      "Algorithmic authoritarianism differs qualitatively from traditional forms of authoritarian governance. While classical authoritarianism relies on overt coercion and suppression of dissent, algorithmic authoritarianism operates through the quiet erosion of democratic procedures by technical means. When welfare eligibility algorithms replace legislatively-defined criteria, or when predictive policing systems bypass judicial oversight, the substance of democratic decision-making is transferred from deliberative bodies to technical systems designed and controlled by executive agencies. Our analysis of fourteen cases across four continents reveals a consistent pattern: AI systems are deployed in contexts where they enhance administrative capacity while simultaneously insulating decision-makers from the procedural constraints that characterize democratic governance. This 'authoritarian efficiency' dynamic—the strategic deployment of algorithmic opacity to concentrate executive power—represents a novel threat to liberal democratic institutions that existing checks-and-balances frameworks are poorly equipped to address.",
      "The legitimation crisis of algorithmic governance emerges at the intersection of technical necessity and democratic norms. Drawing on Offe's crisis theory, we identify three structural contradictions: first, the contradiction between algorithmic speed and deliberative thoroughness; second, between system-wide optimization and individual procedural rights; and third, between the proprietary nature of commercial AI systems and the public's right to know. Our empirical data from automated public housing allocation in Amsterdam reveals that tenants whose applications were processed by AI systems received decisions 67% faster but were 42% less likely to receive adequate explanations for denials. More troublingly, appeal success rates dropped by 28% compared to human-processed cases, suggesting that algorithmic systems construct a technocratic barrier to contestation. These findings support our central thesis: that algorithmic governance, as currently implemented, systematically privileges output legitimacy (efficiency, speed, optimization) over input legitimacy (participation, deliberation, accountability) in ways that fundamentally restructure the relationship between citizens and the state.",
      "We propose that existing democratic theory must be extended to account for what we term the 'algorithmic mediation of political authority.' When administrative decisions are increasingly made by systems whose internal operations are inaccessible to both citizens and their elected representatives, the chain of democratic delegation—from voter to legislator to bureaucrat to decision—is broken at its most critical juncture. Drawing on the work of Claude Lefort on the 'empty place of power,' we argue that algorithmic systems threaten to fill this empty place with a technocratic logic that is unaccountable to democratic will-formation. The danger is not that algorithms will make mistakes, but that they will systematically restructure the conditions under which political authority can be questioned, challenged, and held accountable. This restructuring, we contend, constitutes a quiet but profound transformation of democratic governance—one that existing regulatory frameworks are entirely inadequate to control.",
    ],
  },
  {
    title: "AI, Accountability, and the Future of Bureaucratic Decision-Making",
    authors: "Michael Torres, Elena Volkov",
    year: 2025,
    doi: "10.1111/padm.12983",
    abstract:
      "This paper provides a comprehensive analysis of accountability mechanisms in AI-augmented bureaucratic systems. We evaluate existing frameworks for algorithmic accountability and propose a novel 'nested accountability' model that integrates technical auditing, administrative review, and democratic oversight. Our findings indicate that current accountability mechanisms are fragmented and insufficient to ensure legitimate governance.",
    chunks: [
      "The integration of artificial intelligence into bureaucratic decision-making presents an unprecedented challenge to traditional accountability frameworks. In Westminster-style parliamentary systems, ministerial responsibility presupposes that elected officials can understand, explain, and ultimately be held responsible for decisions made by their departments. When those decisions are increasingly generated by AI models whose outputs are probabilistic rather than deterministic—whose logic is distributed across thousands of weighted parameters rather than encoded in transparent rules—the very possibility of meaningful accountability is called into question. Our empirical research maps the accountability chain in twelve government agencies across the UK, Canada, and Australia, finding that in every case, the introduction of AI decision-support tools created what we term 'accountability gaps': zones of decision-making where no human actor could reasonably explain or take responsibility for the outcome produced. These gaps represent not merely practical challenges but structural transformations in the nature of bureaucratic responsibility.",
      "Existing algorithmic accountability mechanisms fall into three categories, each with distinct limitations. Technical auditing, while promising, struggles to address what we call the 'shifting ground problem': AI systems are continuously updated through machine learning, meaning that a system audited in January may operate fundamentally differently by June. Administrative review mechanisms, such as ombudsman investigations, lack the technical expertise to interrogate complex AI systems effectively. Democratic oversight mechanisms, including parliamentary committees, move too slowly to address the rapid deployment cycles of AI technologies. Our proposed alternative—a 'nested accountability' framework—integrates all three levels through a structured escalation protocol. Continuous automated monitoring (technical tier) triggers mandatory reporting requirements to administrative oversight bodies when defined thresholds are breached (administrative tier), which in turn generates obligations for executive response to legislative committees (democratic tier). This nested architecture ensures that no decision exists outside some form of accountability chain, even as the specific mechanisms vary according to the nature and impact of the algorithmic determination.",
      "The implications of our research extend beyond administrative practice to the foundations of democratic theory. If accountability is, as Schedler argues, the 'linchpin' connecting citizens to their governing institutions, then the systematic erosion of accountability through algorithmic opacity threatens to demobilize democratic engagement altogether. Survey data from our study indicates that 73% of citizens who received AI-mediated bureaucratic decisions reported lower trust in government institutions, regardless of whether the outcome was favorable. This 'procedural disaffection'—alienation not from policy outcomes but from the perceived illegitimacy of the decision-making process itself—represents a profound challenge to democratic stability. We argue that restoring accountability in algorithmic governance is not merely a technical challenge but a precondition for maintaining the social contract between citizens and the administrative state. Without robust, multi-layered accountability mechanisms capable of adapting to the distinctive characteristics of AI systems, democratic governance risks becoming an empty procedural shell whose substantive authority has quietly migrated to unaccountable technical systems.",
    ],
  },
  // ── GROUP B: thesis-related but different topic (Gramscian discourse analysis) ──
  {
    title:
      "Gramscian Hegemony and Critical Discourse Analysis in Social Sciences",
    authors: "Marta Lombardi, Pierre Dubois",
    year: 2023,
    doi: "10.1177/09579265221148041",
    abstract:
      "This methodological paper synthesizes Gramscian hegemony theory with Critical Discourse Analysis (CDA) to provide a robust analytical framework for examining how political power is maintained through discursive practices. We demonstrate how hegemonic projects are constructed, contested, and naturalized through language in institutional and media settings.",
    chunks: [
      "The marriage of Gramscian hegemony theory with Critical Discourse Analysis offers social scientists a powerful toolkit for examining how power operates through language in contemporary societies. Gramsci's concept of hegemony—the process by which a dominant group secures the consent of subordinate groups through cultural and ideological leadership rather than coercion—provides the macro-theoretical foundation for understanding how power structures are maintained. CDA, particularly as developed by Fairclough and Wodak, supplies the micro-analytical apparatus for tracing how hegemonic projects are discursively constructed in specific texts and interactions. Our integrated framework operates at three levels: the textual level (analysis of specific linguistic features), the discursive level (analysis of genre chains and intertextuality), and the social level (analysis of how discourses relate to broader power structures). This tripartite model enables researchers to connect granular linguistic choices to large-scale political outcomes without reducing either to the other.",
      "A key innovation of our framework is the concept of 'hegemonic articulation'—the discursive process through which disparate social demands are linked together into a coherent political project. Drawing on Laclau and Mouffe's post-Marxist extension of Gramsci, we argue that hegemonic projects succeed not simply through the imposition of dominant ideas but through the active construction of equivalential chains that connect various social struggles and demands. Our analysis of European populist discourse between 2015 and 2022 demonstrates how right-wing parties successfully articulated grievances about immigration, EU bureaucracy, and cultural change into a unified hegemonic project by constructing nodal points—privileged signifiers like 'sovereignty' and 'the people'—that organized and condensed otherwise fragmented social demands. This articulation process is not merely rhetorical but hegemonic in the strict Gramscian sense: it reorganizes the common-sense understanding of political reality, making certain claims appear natural and inevitable while rendering others unthinkable.",
      "The methodological implications of integrating Gramsci with CDA extend beyond political communication studies to any research concerned with how power is discursively maintained. Our framework is particularly suited to analyzing what we term 'neoliberal common sense'—the Gramscian concepto that market-based rationality has become so deeply naturalized that alternatives appear unrealistic or utopian. Through detailed analysis of policy documents, media coverage, and institutional procedures, we demonstrate how neoliberal hegemony operates not through overt ideological assertion but through the construction of a 'common-sense' horizon within which certain policy options (deregulation, privatization, austerity) appear as technical necessities rather than political choices. The critical task of a Gramscian CDA, we argue, is to denaturalize this common sense by revealing its historical contingency and political constructedness. This denaturalization opens space for what Gramsci called 'counter-hegemonic' projects—alternative articulations that contest the prevailing common sense and construct different political possibilities. Our framework thus serves not merely as an analytical tool but as a contribution to the democratic project of expanding the horizons of political imagination.",
    ],
  },
  // ── GROUP C: completely unrelated (sustainable agriculture) ──
  {
    title:
      "Climate-Resilient Agriculture: Policy Frameworks for Sustainable Farming",
    authors: "Robert Hanson, Aisha Patel, Kenji Tanaka",
    year: 2024,
    doi: "10.1016/j.jenvman.2024.120345",
    abstract:
      "This paper examines policy frameworks for promoting climate-resilient agricultural practices in semi-arid regions. Through field studies in sub-Saharan Africa and South Asia, we evaluate the effectiveness of different policy instruments—including subsidies, extension services, and irrigation infrastructure—in supporting smallholder farmers' adaptation to increasing climate variability.",
    chunks: [
      "Climate-resilient agriculture has emerged as a critical policy priority in regions facing increasing climate variability and extreme weather events. Our five-year field study across twelve sites in Kenya, Ethiopia, and Rajasthan examines the effectiveness of three distinct policy approaches: market-based instruments (subsidies and insurance programs), knowledge-transfer mechanisms (extension services and farmer field schools), and infrastructure investments (small-scale irrigation and water harvesting). Preliminary findings suggest that no single policy instrument is sufficient; rather, the most effective interventions combine elements of all three approaches in context-specific configurations. In Ethiopian highlands, investments in farmer field schools coupled with micro-insurance programs reduced crop failure rates by 34% compared to subsidy-only approaches. These findings underscore the importance of integrated policy design that addresses not only the technical dimensions of agricultural adaptation but also the institutional and knowledge-based barriers that smallholder farmers face in adopting new practices.",
      "Soil health management represents a cornerstone of climate-resilient agriculture, yet policy frameworks often neglect the complex socio-ecological dynamics that determine farmers' adoption of soil conservation practices. Our research documents how traditional knowledge systems, when integrated with modern agronomic science, produce more resilient agricultural systems. In Rajasthan, farmers who combined indigenous water-harvesting techniques with drought-resistant crop varieties achieved 28% higher yields during the severe 2023 drought compared to those relying solely on modern inputs. This finding challenges the technology-transfer model that has dominated agricultural development policy since the Green Revolution. We argue for a 'co-innovation' approach in which scientific researchers and farming communities collaboratively develop adaptation strategies that build on local knowledge while incorporating relevant scientific advances. Such participatory approaches produce not only more effective technical solutions but also greater farmer ownership and sustained adoption of resilient practices.",
      "The political economy of climate-resilient agriculture reveals significant power asymmetries that policy frameworks must address. Land tenure insecurity, particularly among women farmers who constitute the majority of agricultural laborers in sub-Saharan Africa, systematically undermines investment in long-term soil conservation and water management. Our policy simulations demonstrate that interventions combining tenure regularization with climate adaptation support generate substantially better outcomes—in terms of both food security and environmental sustainability—than either intervention alone. Furthermore, the increasing corporatization of agricultural input markets raises concerns about smallholder farmers' access to appropriate technologies. When climate-resilient seeds and precision agriculture tools are controlled by multinational corporations, the benefits of technological innovation may bypass the farmers who need them most. Effective policy frameworks must therefore address not only the agronomic and ecological dimensions of climate adaptation but also the structural inequities that condition smallholder farmers' access to land, inputs, knowledge, and markets. Agriculture remains not merely a technical sector but a deeply political arena where questions of justice, power, and distribution are inescapable.",
    ],
  },
];

async function embedText(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: "models/gemini-embedding-2",
    contents: [{ role: "user", parts: [{ text }] }],
    config: { outputDimensionality: 1536 },
  });
  const values = response.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error("Empty embedding response");
  }
  return values;
}

async function seedTestData() {
  console.log("🧪 Starting TEST DATA SEEDER...\n");

  for (let refIdx = 0; refIdx < referencesData.length; refIdx++) {
    const ref = referencesData[refIdx];
    const groupLabel =
      refIdx < 3
        ? "GROUP A (similar cluster)"
        : refIdx === 3
          ? "GROUP B (thesis-related, different topic)"
          : "GROUP C (completely unrelated)";

    console.log(`[${refIdx + 1}/${referencesData.length}] ${groupLabel}`);
    console.log(`  ➤ ${ref.title}`);

    // Insert reference
    const [newRef] = await db
      .insert(references)
      .values({
        title: ref.title,
        authors: ref.authors,
        year: ref.year,
        doi: ref.doi,
        pdfUrl: `https://r2.fabricca.com/test-${refIdx + 1}.pdf`,
        abstract: ref.abstract,
      })
      .returning();
    console.log(`  ✅ Reference inserted with ID: ${newRef.id}`);

    // Embed and insert chunks
    const chunkValues = [];
    for (let cIdx = 0; cIdx < ref.chunks.length; cIdx++) {
      const content = ref.chunks[cIdx];
      console.log(`    ⏳ Embedding chunk ${cIdx + 1}/${ref.chunks.length}...`);
      const embedding = await embedText(content);
      chunkValues.push({
        referenceId: newRef.id,
        content,
        embedding,
      });
    }

    await db.insert(pdfChunks).values(chunkValues);
    console.log(`  ✅ ${chunkValues.length} chunks inserted with embeddings\n`);
  }

  console.log("🎉 SUCCESS: Test data seeded with real Gemini embeddings!");
  process.exit(0);
}

seedTestData().catch((err) => {
  console.error("❌ Seed test data failed:", err);
  process.exit(1);
});
