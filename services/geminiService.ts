import { GoogleGenAI, Type } from "@google/genai";
import { QuizPost, Category } from "../types.ts";
import { SYSTEM_INSTRUCTIONS } from "../constants.tsx";

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

    const jsonStr = response.text || "[]";
    const data = JSON.parse(jsonStr);
    
    return data.map((item: any, index: number) => ({
      ...item,
      id: `${Date.now()}-${index}`
    }));
  } catch (error) {
    console.error("Error fetching quiz posts:", error);
    throw error;
  }
}

export async function generateCustomEnigma(userRequest: string): Promise<QuizPost> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate 1 viral enigma based on this request: "${userRequest}". 
      Ensure it follows the "Question | Viral Hook" format and all branding rules.`,
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

    const data = JSON.parse(response.text || "{}");
    return {
      ...data,
      id: `custom-${Date.now()}`
    };
  } catch (error) {
    console.error("Custom generation failed:", error);
    throw error;
  }
}

export async function generatePostImage(post: QuizPost): Promise<string> {
  try {
    const aiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await aiInstance.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `Create a high-quality, professional social media background graphic for a riddle/quiz app called "Daily Quiz and Riddles". 
            Topic: ${post.category}. 
            Vibe: ${post.style_hint}. 
            The image should be abstract, atmospheric, and have space for text in the center. 
            Avoid including text in the image itself. 
            Keywords: ${post.visual_text}.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        },
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image part found in response");
  } catch (error) {
    console.error("Image generation failed:", error);
    throw error;
  }
}

export const Prompts = {
  getToday: () => "Generate 5 random, highly viral, engagement-bait posts. Ensure at least 2 are Literal Math (BODMAS/Fractions/Algebra) that people often argue about. Cover 5 different categories.",
  getCategory: (category: Category) => `Generate 10 viral posts specifically for the '${category}' category. Include "90% fail" style hooks and varying difficulty. If Logic/Math, focus on literal math problems.`,
  refresh: () => "I didn't like those. Generate 5 new viral ones, but make them even more focused on Literal Math (BODMAS, fractions, indices) and Psychology paradoxes."
};