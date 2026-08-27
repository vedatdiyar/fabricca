import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/core/db";
import { matrices } from "@/core/db/schema";
import { getSession } from "@/lib/session";
import { invalidateOnboardingStepCache } from "@/lib/cache-tags";

const revertSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["user", "model"]),
      content: z.string(),
    }),
  ),
  matrix: z.object({
    subjectProblem: z.string().optional().default(""),
    theoreticalFramework: z.string().optional().default(""),
    primaryMaterial: z.string().optional().nullable().default(""),
    methodology: z.string().optional().default(""),
  }),
});

/**
 * POST handler for rewinding the onboarding matrix chat (Gemini /rewind & ChatGPT branch pattern).
 * Truncates both the advisorMessages JSONB and the 4 matrix quadrants to the snapshot
 * at the selected message index, allowing the user to continue from that point.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum süreniz dolmuş." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek formatı." }, { status: 400 });
  }

  const parsed = revertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Eksik veya geçersiz parametreler." }, { status: 400 });
  }

  const { messages, matrix } = parsed.data;

  // Ensure welcome message is always present
  if (messages.length === 0) {
    return NextResponse.json({ error: "En az bir mesaj gerekli." }, { status: 400 });
  }

  const sanitizedMatrix = {
    subjectProblem: matrix.subjectProblem ?? "",
    theoreticalFramework: matrix.theoreticalFramework ?? "",
    primaryMaterial: matrix.primaryMaterial ?? "",
    methodology: matrix.methodology ?? "",
  };

  await db
    .insert(matrices)
    .values({
      userId: session.userId,
      subjectProblem: sanitizedMatrix.subjectProblem,
      theoreticalFramework: sanitizedMatrix.theoreticalFramework,
      primaryMaterial: sanitizedMatrix.primaryMaterial,
      methodology: sanitizedMatrix.methodology,
      advisorMessages: messages,
      updatedAt: sql`now()`,
    })
    .onConflictDoUpdate({
      target: matrices.userId,
      set: {
        subjectProblem: sanitizedMatrix.subjectProblem,
        theoreticalFramework: sanitizedMatrix.theoreticalFramework,
        primaryMaterial: sanitizedMatrix.primaryMaterial,
        methodology: sanitizedMatrix.methodology,
        advisorMessages: messages,
        updatedAt: sql`now()`,
      },
    });

  invalidateOnboardingStepCache("matrix");

  return NextResponse.json({ success: true });
}
