"use server";

import { db } from "@/db";
import { thesisCore } from "@/db/schema";
import { GoogleGenAI } from "@google/genai";

export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

export interface OnboardingResponse {
  success: boolean;
  message?: string;
  structuredData?: {
    title: string;
    researchQuestion: string;
    argument: string;
    methodology: string;
  } | null;
  error?: string;
}

/**
 * Server Action to call Gemini 3.1 Flash Lite and get the next question or the final synthesis.
 */
export async function getProfessorOnboardingResponseAction(
  chatHistory: ChatMessage[],
  currentStep: number,
  userResponse: string,
): Promise<OnboardingResponse> {
  try {
    if (!userResponse || !userResponse.trim()) {
      return { success: false, error: "Cevap boş olamaz." };
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return {
        success: false,
        error:
          "Gemini API anahtarı bulunamadı (.env.local içindeki GEMINI_API_KEY).",
      };
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const systemInstruction = `Sen Fabricca projesinin Siyaset Bilimi ve Politik Sosyoloji alanında uzman, kıdemli ve son derece bilge Tez Danışmanısın (Prof. Dr. Tez Danışmanı).
Görevin, yüksek lisans öğrencisine tezinin temel direklerini (Tez Anayasası / Thesis Core) belirlemesinde yol göstermektir.
Mülakat tam olarak 4 adımdan oluşuyor:
1. Tez Başlığı ve Genel Konu (Örn: Post-2001 Türkiye finansallaşması)
2. Ana Araştırma Sorusu (Research Question)
3. Temel Teorik Çatı ve Odak Teorisyenler (Örn: Marx, Foucault, Biopolitika, Mülksüzleştirme)
4. Tezin İncelediği Tarihsel/Ampirik Dönem Sınırları

Kullanıcı şu anda ${currentStep}. adımı cevapladı. Verdiği cevap: "${userResponse.trim()}"

Kullanıcının bu cevabını analiz et. Son derece yapıcı, saygın, entelektüel derinliği olan bir akademik üslup kullan (örneğin 'Sevgili meslektaşım', 'Bu kavramsal tercih çalışmana derinlik katacaktır' vb.).

Yanıtını kesinlikle aşağıdaki JSON formatında vermelisin:
{
  "message": "Kullanıcının cevabına dair 1-2 cümlelik akademik yorum ve ardından sıradaki soruya geçiş cümlesi...",
  "structuredData": null
}

Eğer mülakatın son adımıysa (${currentStep} === 4 ise), kullanıcının son cevabını da alarak tüm mülakat geçmişini sentezleyip 'structuredData' alanını doldurmalısın. Bu alandaki başlık (title), soru (researchQuestion), argüman (argument) ve yöntem/dönem sınırları (methodology) kısımlarını öğrencinin girdilerini zenginleştirerek, daha akademik, rafine ve profesyonel bir dile kavuşturarak doldur. Son adımdaki JSON yapısı tam olarak şöyle olmalıdır:
{
  "message": "Harika bir mülakatın sonu tebriği ve tez anayasasının hazır olduğunu bildiren açıklama...",
  "structuredData": {
    "title": "Sentezlenmiş ve akademik olarak yapılandırılmış resmi tez başlığı",
    "researchQuestion": "Akademik derinliği olan net, soru işaretiyle biten araştırma sorusu",
    "argument": "Teorik çatı, odak teorisyenler ve temel kavramsal argüman",
    "methodology": "Ampirik alan, seçilen tarihsel dönem sınırları ve bilimsel yöntem"
  }
}

Unutma: Yanıtın her zaman geçerli bir JSON olmalı ve \`responseMimeType: "application/json"\` ayarlarına uygun olarak dönmelidir.`;

    const contents = [
      ...chatHistory.map((item) => ({
        role: item.role,
        parts: [{ text: item.content }],
      })),
      {
        role: "user" as const,
        parts: [
          { text: `Adım ${currentStep} cevabım: ${userResponse.trim()}` },
        ],
      },
    ];

    const genAIResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.4,
        responseMimeType: "application/json",
      },
    });

    const responseText = genAIResponse.text;
    if (!responseText) {
      return {
        success: false,
        error: "Yapay zeka motorundan boş bir yanıt döndü.",
      };
    }

    const parsed: {
      message: string;
      structuredData?: {
        title: string;
        researchQuestion: string;
        argument: string;
        methodology: string;
      } | null;
    } = JSON.parse(responseText);

    return {
      success: true,
      message: parsed.message,
      structuredData: parsed.structuredData || null,
    };
  } catch (error: any) {
    console.error("getProfessorOnboardingResponseAction Error:", error);
    return {
      success: false,
      error: error.message || "Yapay zekadan cevap alınırken hata oluştu.",
    };
  }
}

/**
 * Server Action to finalize and save the structured "Tez Anayasası" (Thesis Core) into Neon PostgreSQL via Drizzle ORM.
 */
export async function saveThesisCoreAction(data: {
  title: string;
  researchQuestion: string;
  argument: string;
  methodology: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (
      !data.title ||
      !data.researchQuestion ||
      !data.argument ||
      !data.methodology
    ) {
      return {
        success: false,
        error: "Tez anayasasının tüm alanları doldurulmalıdır.",
      };
    }

    // Insert into Neon PostgreSQL
    await db.insert(thesisCore).values({
      title: data.title.trim(),
      researchQuestion: data.researchQuestion.trim(),
      argument: data.argument.trim(),
      methodology: data.methodology.trim(),
    });

    return { success: true };
  } catch (error: any) {
    console.error("saveThesisCoreAction Error:", error);
    return {
      success: false,
      error: error.message || "Tez anayasası kaydedilirken hata oluştu.",
    };
  }
}
