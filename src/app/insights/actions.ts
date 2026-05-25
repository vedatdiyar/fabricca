"use server";

import { db } from "@/db";
import { aiInsights, thesisCore } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

export interface InsightItem {
  id: number;
  noteId: number | null;
  insightText: string;
  aiContextSuggestions: string | null;
  createdAt: Date | null;
}

export interface InsightsResult {
  success: boolean;
  insights?: InsightItem[];
  error?: string;
}

/**
 * Server Action to fetch all insights from the database ordered by creation date descending
 */
export async function getInsightsAction(): Promise<InsightsResult> {
  try {
    const allInsights = await db
      .select()
      .from(aiInsights)
      .orderBy(desc(aiInsights.createdAt));

    return {
      success: true,
      insights: allInsights,
    };
  } catch (error: any) {
    console.error("getInsightsAction Error:", error);
    return {
      success: false,
      error: error.message || "Fikir sepeti listelenirken bir hata oluştu.",
    };
  }
}

/**
 * Server Action to create a new insight (idea)
 */
export async function createInsightAction(
  insightText: string,
  noteId?: number,
): Promise<{ success: boolean; insightId?: number; error?: string }> {
  try {
    if (!insightText || !insightText.trim()) {
      return { success: false, error: "Fikir içeriği boş olamaz." };
    }

    const [newInsight] = await db
      .insert(aiInsights)
      .values({
        insightText: insightText.trim(),
        noteId: noteId || null,
      })
      .returning();

    return {
      success: true,
      insightId: newInsight.id,
    };
  } catch (error: any) {
    console.error("createInsightAction Error:", error);
    return {
      success: false,
      error: error.message || "Fikir kaydedilirken bir hata oluştu.",
    };
  }
}

/**
 * Server Action to delete an insight
 */
export async function deleteInsightAction(
  insightId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.delete(aiInsights).where(eq(aiInsights.id, insightId));

    return {
      success: true,
    };
  } catch (error: any) {
    console.error("deleteInsightAction Error:", error);
    return {
      success: false,
      error: error.message || "Fikir silinirken bir hata oluştu.",
    };
  }
}

/**
 * Server Action to sharpen a raw idea using Gemini 3.1 Flash Lite
 * tailored to the active Thesis Core parameters.
 */
export async function sharpenInsightAction(
  insightId: number,
): Promise<{ success: boolean; suggestions?: string; error?: string }> {
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return {
        success: false,
        error:
          "Gemini API anahtarı bulunamadı (.env.local içindeki GEMINI_API_KEY).",
      };
    }

    // 1. Fetch the insight from database
    const [insight] = await db
      .select()
      .from(aiInsights)
      .where(eq(aiInsights.id, insightId))
      .limit(1);

    if (!insight) {
      return { success: false, error: "Böyle bir fikir bulunamadı." };
    }

    // 2. Fetch active Thesis Core (Thesis constitution)
    const [core] = await db.select().from(thesisCore).limit(1);

    let thesisContext = "";
    if (core) {
      thesisContext =
        `TEZ ANAYASASI:\n` +
        `- Başlık: ${core.title}\n` +
        `- Araştırma Sorusu: ${core.researchQuestion}\n` +
        `- Ana Argüman: ${core.argument}\n` +
        `- Metodoloji: ${core.methodology}\n\n`;
    } else {
      thesisContext =
        "TEZ ANAYASASI: Henüz kurulmadı (Genel akademik kurgu üzerinden keskinleştirin).\n\n";
    }

    // 3. Setup Gemini client
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const systemPrompt =
      "Sen Siyaset Bilimi, Politik Sosyoloji ve Uluslararası İlişkiler alanlarında uzman, son derece seçkin ve analitik düşünen bir Akademik Tez Danışmanısın. " +
      "Kullanıcının tez yazarken aklına gelen ham fikirleri, hipotezleri veya yapısal notları okuyup bunları tezin anayasasıyla (Başlık, Araştırma Sorusu, Argüman, Yöntem) ilişkilendirerek keskinleştirirsin.\n\n" +
      "Senden isteğimiz, kullanıcının ham fikrini okuyup, bu fikrin tezin ana argümanına nasıl entegre edilebileceğine, hangi teorik/kavramsal araçlarla desteklenebileceğine veya yöntemsel olarak nasıl işlenebileceğine dair TAM 3 MADDELİK, çok kısa, vurucu ve doğrudan uygulanabilir bir akademik içgörü (insight) kümesi üretmendir.\n\n" +
      "KURALLAR:\n" +
      "1. Kesinlikle tam 3 madde döndür. Her maddeyi markdown biçiminde (- veya * kullanarak) listele.\n" +
      "2. Her bir madde yüksek teorik derinliğe sahip olmalı fakat aynı zamanda pratik yazım adımları önermelidir.\n" +
      "3. Asla giriş, selamlama, özet veya sonuç cümleleri yazma. Doğrudan listelenmiş 3 maddeyi döndür.\n" +
      "4. Türkçe yaz ve son derece net, kararlı, yapıcı bir akademik üslup kullan.\n" +
      "5. Yanıtını KESİNLİKLE aralarında boşluk olan, net ve birbirinden bağımsız 3 adet Markdown maddesi (`* ` veya `- ` kullanarak) şeklinde döndür.";

    const prompt =
      `${thesisContext}` +
      `KULLANICININ HAM FİKRİ:\n` +
      `"${insight.insightText}"\n\n` +
      `Lütfen yukarıdaki kurallara ve tez anayasasına sadık kalarak, bu ham fikri keskinleştiren 3 maddelik vurucu akademik içgörüleri üret.`;

    // 4. Call Gemini 3.1 Flash Lite
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 1,
      },
    });

    const responseText = response.text;
    if (!responseText || !responseText.trim()) {
      return {
        success: false,
        error: "Yapay zeka motorundan boş bir yanıt döndü.",
      };
    }

    const suggestions = responseText.trim();

    // 5. Save output to database
    await db
      .update(aiInsights)
      .set({ aiContextSuggestions: suggestions })
      .where(eq(aiInsights.id, insightId));

    return {
      success: true,
      suggestions,
    };
  } catch (error: any) {
    console.error("sharpenInsightAction Error:", error);
    return {
      success: false,
      error: error.message || "Fikir keskinleştirilirken bir hata oluştu.",
    };
  }
}
