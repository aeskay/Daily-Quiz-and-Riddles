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
    caption_hook:      { type: Type.STRING },
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
    source: 'ai',
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
    return `Generate 8 viral, fast-scrolling TikTok & Reels style quiz and riddle posts.
ZERO school homework or exam questions (NEVER Ohm's law, NEVER physics formulas, NEVER gold foil experiments, NEVER dry textbook history).
Focus on: brain-glitch trick questions (e.g. "If you pass the person in 2nd place..."), viral math disputes (e.g. "5 + 5 × 5 - 5 = ?"), mind-blowing "did you know" wonders (pink hippo milk, Mars blue sunsets, Sudan having more pyramids than Egypt), and clever wordplay riddles.
Mix categories: at least one Logic & Math, one true Riddle, one fun General Knowledge, one Science & Tech wonder, and one polarizing Would You Rather dilemma. [Seed: ${seed}]${avoidClause}`;
  },

  getCategory: (category: Category, recentTitles: string[] = []) => {
    const avoidClause = recentTitles.length > 0
      ? `\n\nALREADY GENERATED — do NOT repeat or rephrase these:\n${recentTitles.map(t => `- ${t}`).join('\n')}`
      : '';
    const seed = Math.floor(Math.random() * 1000000);

    let categoryGuidance = 'Ensure questions are addictive, fast-paced, and spark massive comment debates.';
    if (category === Category.Riddles) {
      categoryGuidance = 'MANDATORY: Every post MUST be an authentic riddle or brain-glitch trick question (e.g. "If you overtake 2nd place...", "What do cows drink?"). Absolutely NO physics, chemistry, or textbook definitions!';
    } else if (category === Category.GeneralKnowledge) {
      categoryGuidance = 'MANDATORY: Mind-blowing viral trivia that makes people say "NO WAY!" (e.g. ketchup sold as medicine, Sudan having more pyramids than Egypt, chocolate records). ZERO high school history exams or dry dates!';
    } else if (category === Category.LogicMath) {
      categoryGuidance = 'MANDATORY: Viral order-of-operation traps (e.g. 5 + 5 × 5 - 5), 3 pills every 30 mins, clock math, bat & ball cost, rapid counting traps. Absolutely NO calculus, formulas, or academic math proofs!';
    } else if (category === Category.ScienceTech) {
      categoryGuidance = 'MANDATORY: Mind-blowing physical wonders (why Mars sunsets are blue, pink hippo milk, why fingers wrinkle in water, koala fingerprints). ZERO Ohm\'s law, ZERO formulas, ZERO high school physics exams!';
    } else if (category === Category.NatureAnimals) {
      categoryGuidance = 'MANDATORY: Bizarre, unbelievable animal habits (wombats cubic poop, hummingbirds flying backwards, sea otter fur density).';
    } else if (category === Category.LanguageLit) {
      categoryGuidance = 'MANDATORY: Fast reflex word challenges (name 3 fruits without the letter E in 5 seconds, 15-letter isograms, bookkeeper double letters).';
    } else if (category === Category.WouldYouRather) {
      categoryGuidance = 'MANDATORY: Highly polarizing, hilarious, or agonizing lifestyle dilemmas that start heated comment wars.';
    }

    return `Generate 8 viral TikTok-ready posts for the "${category}" category.
${categoryGuidance}
Every post must be engineered for high social media engagement, stopping scrollers in under 3 seconds. [Seed: ${seed}]${avoidClause}`;
  },
};