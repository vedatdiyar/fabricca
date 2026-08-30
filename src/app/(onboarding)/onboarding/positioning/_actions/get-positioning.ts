"use server";

import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { positioning, matrices, type Positioning } from "@/core/db/schema";
import { getSession } from "@/lib/session";

/**
 * Kullanıcının mevcut tez matrisine bağlı konumlandırma kaydını döner.
 *
 * @returns Konumlandırma kaydı veya null.
 */
export async function getPositioningAction(): Promise<Positioning | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }

  try {
    const [matrix] = await db
      .select({ id: matrices.id })
      .from(matrices)
      .where(eq(matrices.userId, session.userId));

    if (!matrix) {
      return null;
    }

    const [record] = await db
      .select()
      .from(positioning)
      .where(eq(positioning.matrixId, matrix.id));

    return record ?? null;
  } catch {
    return null;
  }
}
