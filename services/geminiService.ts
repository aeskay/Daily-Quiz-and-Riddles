import { GoogleGenAI, Type } from "@google/genai";
import { QuizPost, Category } from "../types";
import { SYSTEM_INSTRUCTIONS } from "../constants";

/**
 * Robustly extracts JSON from potentially messy AI output.
 */
function sanitizeJsonResponse(text: string): string {
  if (!text) return "[]";
  const start = Math.min(
    text.indexOf('[') === -1 ? Infinity : text.indexOf('['),
    text.indexOf('{') === -1 ? Infinity : text.indexOf('{')
  );
  const end = Math.max(
    text.lastIndexOf(']'),
    text.lastIndexOf('}')
  );
  if (start !== Infinity && end !== -1 && end > start) {
    return text.substring(start, end + 1);
  }
  return text.replace(/```json\n?|```/g, "").trim();
}

/**
 * Simple delay for retries
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wrapper for API calls with exponential backoff retries
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error?.message?.includes('429') || error?.status === 429;
      const isServerErr = error?.message?.includes('500') || error?.status === 500;
      
      if (isRateLimit || isServerErr) {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
        console.warn(`Retry ${i + 1}/${retries} after ${delay}ms due to:`, error.message);
        await sleep(delay);
        continue;
      }
      throw error; // Don't retry for other errors (like safety or 400s)
    }
  }
  throw lastError;
}

export async function fetchQuizPosts(prompt: string): Promise<QuizPost[]> {
  const fetchTask = async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Upgraded for logic/math
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTIONS + "\nIMPORTANT: Return ONLY raw JSON. No markdown code blocks. No conversational text.",
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 2048 }, // Give the model space to solve the logic
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              visual_text: { type: Type.STRING },
              read_more_content: { type: Type.STRING },
              answer: { type: Type.STRING },
              category: { type: Type.STRING },
              style_hint: { type: Type.STRING },
            },
            required: ["visual_text", "read_more_content", "answer", "category", "style_hint"],
          },
        },
      },
    });

    const sanitizedText = sanitizeJsonResponse(response.text || "[]");
    const parsed = JSON.parse(sanitizedText);
    return parsed.map((item: any, index: number) => ({
      ...item,
      id: `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`
    }));
  };

  return withRetry(fetchTask);
}

export async function generateCustomEnigma(userRequest: string): Promise<QuizPost> {
  const generateTask = async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Generate 1 viral enigma based on this request: "${userRequest}".`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTIONS,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 1024 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            visual_text: { type: Type.STRING },
            read_more_content: { type: Type.STRING },
            answer: { type: Type.STRING },
            category: { type: Type.STRING },
            style_hint: { type: Type.STRING },
          },
          required: ["visual_text", "read_more_content", "answer", "category", "style_hint"],
        },
      },
    });
    
    const sanitizedText = sanitizeJsonResponse(response.text || "{}");
    return { ...JSON.parse(sanitizedText), id: `custom-${Date.now()}` };
  };

  return withRetry(generateTask);
}

export async function generatePostImage(post: QuizPost): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `Social media background graphic for a riddle app. Topic: ${post.category}. Vibe: ${post.style_hint}. Abstract, no text.` }] },
    config: { imageConfig: { aspectRatio: "1:1" } },
  });
  const part = response.candidates[0].content.parts.find(p => p.inlineData);
  if (!part?.inlineData) throw new Error("No image generated");
  return `data:image/png;base64,${part.inlineData.data}`;
}

export const Prompts = {
  getToday: () => "Generate 5 random, viral, engagement-bait posts. Focus on Literal Math (BODMAS) and logic paradoxes.",
  getCategory: (category: Category, isRefresh = false) => {
    const seed = Math.floor(Math.random() * 10000);
    return `Generate ${isRefresh ? '8' : '10'} viral posts for the '${category}' category. ${isRefresh ? 'Ensure these are completely unique and unheard of.' : ''} [Seed: ${seed}]`;
  },
  refresh: () => {
    const seed = Math.floor(Math.random() * 10000);
    return `Generate 5 new, completely unique viral challenges. Mix of Math, Logic, and Psychology paradoxes. Use fresh perspectives. [Seed: ${seed}]`;
  }
};