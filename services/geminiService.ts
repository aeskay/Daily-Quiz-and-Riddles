import { GoogleGenAI, Type } from "@google/genai";
import { QuizPost, Category } from "../types";
import { SYSTEM_INSTRUCTIONS } from "../constants";

export async function fetchQuizPosts(prompt: string): Promise<QuizPost[]> {
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
  return JSON.parse(response.text || "[]").map((item: any, index: number) => ({ ...item, id: `${Date.now()}-${index}` }));
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
  return { ...JSON.parse(response.text || "{}"), id: `custom-${Date.now()}` };
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
  getToday: () => "Generate 5 random, viral, engagement-bait posts. Focus on Literal Math (BODMAS).",
  getCategory: (category: Category) => `Generate 10 viral posts for '${category}'.`,
  refresh: () => "Generate 5 new viral ones focusing on Literal Math and Psychology paradoxes."
};