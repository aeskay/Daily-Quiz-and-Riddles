import { GoogleGenAI, Type } from "@google/genai";
import { QuizPost, Category } from "../types";
import { SYSTEM_INSTRUCTIONS } from "../constants";

/**
 * Robustly extracts JSON from potentially messy AI output.
 * It finds the actual JSON boundaries instead of just stripping backticks.
 */
function sanitizeJsonResponse(text: string): string {
  if (!text) return "[]";
  
  // Find first [ or { and last ] or }
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

export async function fetchQuizPosts(prompt: string): Promise<QuizPost[]> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTIONS,
        responseMimeType: "application/json",
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

    const rawText = response.text || "[]";
    const sanitizedText = sanitizeJsonResponse(rawText);
    
    try {
      const parsed = JSON.parse(sanitizedText);
      return parsed.map((item: any, index: number) => ({
        ...item,
        id: `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`
      }));
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, "Text was:", sanitizedText);
      throw new Error("The engine returned an unreadable response. Try refreshing.");
    }
  } catch (error) {
    console.error("Gemini fetch error:", error);
    throw error;
  }
}

export async function generateCustomEnigma(userRequest: string): Promise<QuizPost> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate 1 viral enigma based on this request: "${userRequest}".`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTIONS,
      responseMimeType: "application/json",
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