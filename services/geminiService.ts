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
    const prompt = `Create a custom, high-engagement viral quiz or riddle post based on this request: "${userRequest}". 
Ensure the visual_text is clean and punchy, caption_hook is a viral 1-sentence teaser, answer reveals the twist, read_more_content explains the logic, and category is one of: Riddles, Puzzles, Brain Teasers, Quiz, Find the Mistake, Misconceptions, Controversial, Fun Facts, Blogs.`;

    const response = await generateWithModelFallback(
      ai,
      prompt,
      SYSTEM_INSTRUCTIONS,
      POST_SCHEMA
    );

    const parsed = JSON.parse(response.text || "{}");
    return assignId(parsed, 0);
  });
}

/**
 * Crafts a long-form, SEO-optimized HTML article for WordPress (quizandriddles.com)
 * matching the site's exact article format:
 * - <h2>Riddle:</h2> (or Question / Puzzle)
 * - <h2>Answer:</h2>
 * - <h2>Explanation:</h2> with hook, step-by-step breakdown list, and engaging conclusion.
 */
export async function generateArticleForPost(post: QuizPost): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Missing Gemini API Key. Click 'Settings' in the sidebar to add your key.");
  }

  const sectionLabel = post.category === 'Riddles' ? 'Riddle' :
                       post.category === 'Puzzles' ? 'Puzzle' :
                       post.category === 'Brain Teasers' ? 'Brain Teaser' :
                       post.category === 'Find the Mistake' ? 'Challenge' : 'Question';

  const systemPrompt = `You are the chief content creator for "Daily Quiz and Riddles" (quizandriddles.com).
Your task is to write a captivating, engaging, SEO-rich blog article for a given riddle or puzzle.

### ARTICLE STYLE REQUIREMENTS (MANDATORY FORMAT):
You must output clean semantic HTML (no markdown code blocks, just raw HTML) adhering strictly to this structure:

<h2>${sectionLabel}:</h2>
<p>[The exact riddle or question clearly formatted]</p>

<h2>Answer:</h2>
<p><strong>[The exact answer in bold]</strong></p>

<h2>Explanation:</h2>
<p>[Engaging intro naming the concept or riddle type (e.g. "This riddle is called Look and Say Sequence"), welcoming readers, and hooking their curiosity]</p>

<p>To crack this sequence, we need to carefully observe the pattern that governs its progression...</p>

<p>Let's break it down step by step:</p>
<ul>
  <li><strong>[Step/Term 1]:</strong> [Clear explanation]</li>
  <li><strong>[Step/Term 2]:</strong> [Clear explanation]</li>
  <li><strong>[Step/Term 3]:</strong> [Clear explanation]</li>
  [Add enough bullet points to completely and thoroughly walk through the solution]
</ul>

<p>Now, what comes next in this intriguing sequence? Applying the pattern, we find: <strong>[Answer]</strong></p>

<p>[Engaging concluding takeaway celebrating the reader's observation and encouraging them to share with friends and family.]</p>

Ensure the explanation is 100% mathematically, logically, or factually accurate.`;

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Write an article for this ${post.category}:
Question / Riddle: "${post.visual_text}"
Answer: "${post.answer}"
Context / Hook: "${post.read_more_content || ''}"`,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    let html = response.text || '';
    html = html.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();
    return html;
  });
}

export async function generateEnigmaImage(prompt: string): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Missing Gemini API Key. Click 'Settings' in the sidebar to add your key.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'imagen-3.0-generate-002',
      contents: `Vector style minimalist graphic illustration of: ${prompt}. Flat design, clean lines, high contrast icon aesthetic, vibrant modern colors on solid plain background, zero noise, zero text, zero watermark, centered composition.`,
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
    return `Generate 8 viral, fast-scrolling TikTok & blog-ready quiz and riddle posts.
ZERO school homework or exam questions (NEVER Ohm's law, NEVER physics formulas, NEVER gold foil experiments, NEVER dry textbook history).
Focus on: brain-glitch trick questions (e.g. "If you pass the person in 2nd place..."), viral math disputes (e.g. "5 + 5 × 5 - 5 = ?"), number sequence puzzles (e.g. Look and Say), mind-blowing "did you know" wonders (pink hippo milk, Mars blue sunsets), and clever wordplay riddles.
Mix categories across: Riddles, Puzzles, Brain Teasers, Quiz, Find the Mistake, Misconceptions, Controversial, and Fun Facts. [Seed: ${seed}]${avoidClause}`;
  },

  getCategory: (category: Category, recentTitles: string[] = []) => {
    const avoidClause = recentTitles.length > 0
      ? `\n\nALREADY GENERATED — do NOT repeat or rephrase these:\n${recentTitles.map(t => `- ${t}`).join('\n')}`
      : '';
    const seed = Math.floor(Math.random() * 1000000);

    let categoryGuidance = 'Ensure questions are addictive, fast-paced, and spark massive comment debates.';
    if (category === Category.Riddles) {
      categoryGuidance = 'MANDATORY: Every post MUST be an authentic riddle or brain-glitch trick question (e.g. "If you overtake 2nd place...", "What do cows drink?"). Absolutely NO physics, chemistry, or textbook definitions!';
    } else if (category === Category.Puzzles) {
      categoryGuidance = 'MANDATORY: Number sequences, order-of-operation disputes (e.g. 5 + 5 × 5 - 5), math logic, clock math, bat & ball cost, rapid counting traps. Absolutely NO calculus or academic textbook proofs!';
    } else if (category === Category.BrainTeasers) {
      categoryGuidance = 'MANDATORY: Lateral thinking, fast reflex traps, logic twist questions where the intuitive answer is wrong.';
    } else if (category === Category.Quiz) {
      categoryGuidance = 'MANDATORY: Mind-blowing viral trivia that makes people say "NO WAY!" (e.g. ketchup sold as medicine, Sudan having more pyramids than Egypt). ZERO dry dates or textbook exams!';
    } else if (category === Category.FindTheMistake) {
      categoryGuidance = 'MANDATORY: Subtle error spotting in sentences, math equations, or situations (e.g. repeated words like "in the the", arithmetic misdirection).';
    } else if (category === Category.Misconceptions) {
      categoryGuidance = 'MANDATORY: Psychology and everyday human myths debunked (e.g. goldfish memory, 10% brain myth, bulls hating red).';
    } else if (category === Category.Controversial) {
      categoryGuidance = 'MANDATORY: Would You Rather lifestyle dilemmas or polarizing debate questions that start heated comment wars.';
    } else if (category === Category.FunFacts) {
      categoryGuidance = 'MANDATORY: Bizarre, unbelievable animal and world facts (wombats cubic poop, hummingbirds flying backwards, sea otter fur density).';
    } else if (category === Category.Blogs) {
      categoryGuidance = 'MANDATORY: Deep-dive sequence breakdown or captivating historical riddle story.';
    }

    return `Generate 8 viral posts for the "${category}" category.
${categoryGuidance}
Every post must be engineered for high audience engagement and sharing. [Seed: ${seed}]${avoidClause}`;
  },
};
