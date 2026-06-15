"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices, originalityReports, thesisBoxes } from "@/db/schema";
import { getSession } from "@/proxy";
import type { EnhancedThesisData } from "@/lib/types";

export async function fetchThesisMatrix() {
  const session = await getSession();
  if (!session) return null;
  const [matrix] = await db
    .select()
    .from(thesisMatrices)
    .where(eq(thesisMatrices.userId, session.userId));
  return matrix ?? null;
}

export async function fetchOriginalityReport() {
  const session = await getSession();
  if (!session) return null;
  const [report] = await db
    .select()
    .from(originalityReports)
    .where(eq(originalityReports.userId, session.userId));
  return report ?? null;
}

export async function fetchBoxes() {
  const matrix = await fetchThesisMatrix();
  if (!matrix) return [];
  return db
    .select()
    .from(thesisBoxes)
    .where(eq(thesisBoxes.thesisMatrixId, matrix.id));
}


