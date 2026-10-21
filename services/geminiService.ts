import { GoogleGenAI, Type } from "@google/genai";
import { QuizPost, Category } from "../types";
import { SYSTEM_INSTRUCTIONS } from "../constants";

export function getGeminiApiKey(): string {
  try {
    return localStorage.getItem('dqr_gemini_api_key') || process.env.API_KEY || '';
  } catch {
    return process.env.API_KEY || '';
  }
}

export function setGeminiApiKey(key: string): void {
  try {
    localStorage.setItem('dqr_gemini_api_key', key.trim());
  } catch (e) {
    console.error('Failed to save API key', e);
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function formatApiError(err: any): Error {
  const msg = err?.message || String(err);
  const status = err?.status || err?.code;

  if (msg.includes('prepayment') || msg.includes('depleted') || status === 402 || (status === 400 && msg.includes('billing'))) {
    return new Error("Gemini API credits depleted. Please click 'Settings' in the menu to add a fresh API key from Google AI Studio.");
  }
  if (status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
    return new Error("Rate limit reached. Please wait 30 seconds and try again.");
  }
  if (status === 400 || msg.includes('API_KEY_INVALID') || msg.includes('not valid')) {
    return new Error("Invalid API Key. Please update your key in Settings.");
  }
  if (status === 503) {
    return new Error("Gemini AI is currently experiencing high demand. Please try again in a few moments.");
  }
  return new Error(msg || "Generation failed. Please try again.");
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error?.message?.includes('429') || error?.status === 429;
      if (isRateLimit && i < retries - 1) {
        const delay = Math.pow(2, i) * 2000 + Math.random() * 1000;
        await sleep(delay);
        continue;
      }
      throw formatApiError(error);
    }
  }
  throw formatApiError(lastError);
}

/** Shared JSON schema for a single post */
const POST_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    visual_text:       { type: Type.STRING },
    read_more_content: { type: Type.STRING },
    answer:            { type: Type.STRING },
    category:          { type: Type.STRING },
    style_hint:        { type: Type.STRING },
    image_keyword:     { type: Type.STRING },
    text_length:       { type: Type.STRING, enum: ['short', 'medium', 'long'] },
  },
  required: ["visual_text", "read_more_content", "answer", "category", "style_hint", "image_keyword", "text_length"],
};

function assignId(item: any, index = 0): QuizPost {
  return {
    ...item,
    id: `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    status: 'active',
  };
}

/** Calls Gemini with primary gemini-2.5-flash and automatic fallback to gemini-3.8-flash */
async function generateWithModelFallback(ai: GoogleGenAI, contents: string, systemInstruction: string, schema: any): Promise<any> {
  const models = ['gemini-2.5-flash', 'gemini-3.8-flash'];
  let lastErr: any;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      });
      return response;
    } catch (err: any) {
      lastErr = err;
      const status = err?.status || err?.code;
      // If 503 (high demand) or 404, try the next model
      if (status === 503 || status === 404) {
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export async function fetchQuizPosts(prompt: string): Promise<QuizPost[]> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Missing Gemini API Key. Click 'Settings' in the sidebar to add your key.");
  }

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey });
    const response = await generateWithModelFallback(
      ai,
      prompt,
      SYSTEM_INSTRUCTIONS,
      {
        type: Type.ARRAY,
        items: POST_SCHEMA,
      }
    );

    const parsed = JSON.parse(response.text || "[]");
    return parsed.map((item: any, i: number) => assignId(item, i));
  });
}

export async function generateCustomEnigma(userRequest: string): Promise<QuizPost> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Missing Gemini API Key. Click 'Settings' in the sidebar to add your key.");
  }

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey });
    const response = await generateWithModelFallback(
      ai,
      `Generate exactly 1 high-quality quiz/riddle post based on this request: "${userRequest}". Make it unique, specific, and clear.`,
      SYSTEM_INSTRUCTIONS,
      POST_SCHEMA
    );

    return assignId(JSON.parse(response.text || "{}"));
  });
}

export async function generatePostImage(post: QuizPost): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Missing API Key for AI image generation.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: `Vector line illustration of "${post.image_keyword}". Isolated on a pure white background, minimal clipart style, no text.`,
      config: {
        // @ts-ignore
        responseModalities: ['IMAGE'],
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    if (part?.inlineData?.data) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image data returned");
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429') || msg.includes('404')) {
      throw new Error("Gemini Image generation requires a paid Google Cloud project. Use the Vector Search or Upload File buttons instead!");
    }
    throw err;
  }
}

export const Prompts = {
  refresh: (recentTitles: string[] = []) => {
    const avoidClause = recentTitles.length > 0
      ? `\n\nALREADY GENERATED — do NOT repeat or rephrase these:\n${recentTitles.map(t => `- ${t}`).join('\n')}`
      : '';
    const seed = Math.floor(Math.random() * 1000000);
    return `Generate 8 diverse quiz and riddle posts. Mix categories: include at least one Logic & Math, one Riddle, one General Knowledge, one Science & Tech, and one Would You Rather. Each must use a completely different topic and logic mechanism. [Seed: ${seed}]${avoidClause}`;
  },

  getCategory: (category: Category, recentTitles: string[] = []) => {
    const avoidClause = recentTitles.length > 0
      ? `\n\nALREADY GENERATED — do NOT repeat or rephrase these:\n${recentTitles.map(t => `- ${t}`).join('\n')}`
      : '';
    const seed = Math.floor(Math.random() * 1000000);
    return `Generate 8 posts for the "${category}" category. Each must cover a completely different topic — no two should feel similar. [Seed: ${seed}]${avoidClause}`;
  },
};