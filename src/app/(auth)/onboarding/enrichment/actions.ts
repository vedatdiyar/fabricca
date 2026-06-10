"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices, users } from "@/db/schema";
import { getSession } from "@/proxy";
import { revalidatePath } from "next/cache";

export type EnhancedThesisData = {
  akademikCalismaBasligi: string;
  literaturluArastirmaSorusu: string;
  olgunlastirilmisTezSavi: string;
  kavramsalVeKuramsalAltyapi: string;
  akademikMetodolojiTasarimi: string;
  tarihselMekansalSinirlar: string;
};

export type OnboardingActionResult =
  | { success: true; error?: never }
  | { success?: never; error: string };

export type EnhancedThesisActionResult =
  | { success: true; data: EnhancedThesisData; error?: never }
  | { success?: never; error: string };

/**
 * Kullanıcının daha önce kaydedilmiş akademik olgunlaştırılmış tez matrisi
 * verilerini thesis_matrices tablosundan okur.
 *
 * @returns Başarılıysa { success: true, data: EnhancedThesisData },
 *          hatalıysa { error: string }
 */
export async function getStoredEnhancedDataAction(): Promise<EnhancedThesisActionResult> {
  try {
    const session = await getSession();

    if (!session) {
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const [matrix] = await db
      .select()
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, session.userId));

    if (!matrix) {
      return {
        error: "Henüz bir tez matrisi oluşturulmamış.",
      };
    }

    return {
      success: true,
      data: {
        akademikCalismaBasligi: matrix.calismaBasligi,
        literaturluArastirmaSorusu: matrix.arastirmaSorusu,
        olgunlastirilmisTezSavi: matrix.temelIddia,
        kavramsalVeKuramsalAltyapi: matrix.kuramsalCerceve,
        akademikMetodolojiTasarimi: matrix.metodoloji,
        tarihselMekansalSinirlar: matrix.tarihselMekansalSinirlar,
      },
    };
  } catch (error) {
    console.error("Tez matrisi okunurken hata:", error);
    return { error: "Tez matrisi okunurken bir hata oluştu." };
  }
}

/**
 * Kullanıcının onayladığı akademik olgunlaştırılmış tez matrisi verilerini
 * thesis_matrices tablosundaki mevcut 6 kolona yazar ve users tablosundaki
 * onboardingStep değerini "originality_report" olarak günceller.
 *
 * @param data - Onaylanmış EnhancedThesisData
 * @returns Başarılıysa { success: true }, hatalıysa { error: string }
 */
export async function confirmEnhancedThesisAction(
  data: EnhancedThesisData,
): Promise<OnboardingActionResult> {
  try {
    const session = await getSession();

    if (!session) {
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const userId = session.userId;

    await db
      .update(thesisMatrices)
      .set({
        calismaBasligi: data.akademikCalismaBasligi,
        arastirmaSorusu: data.literaturluArastirmaSorusu,
        temelIddia: data.olgunlastirilmisTezSavi,
        metodoloji: data.akademikMetodolojiTasarimi,
        kuramsalCerceve: data.kavramsalVeKuramsalAltyapi,
        tarihselMekansalSinirlar: data.tarihselMekansalSinirlar,
        updatedAt: new Date(),
      })
      .where(eq(thesisMatrices.userId, userId));

    await db
      .update(users)
      .set({ onboardingStep: "originality_report" })
      .where(eq(users.id, userId));

    revalidatePath("/onboarding");
    return { success: true };
  } catch (error) {
    console.error("Tez matrisi onaylanırken hata:", error);
    return { error: "Tez matrisi onaylanırken bir hata oluştu." };
  }
}
