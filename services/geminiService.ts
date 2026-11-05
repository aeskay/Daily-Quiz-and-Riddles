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
async function generateWithModelFallback(ai: GoogleGenAI, contents: any, systemInstruction: string, schema: any): Promise<any> {
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
Ensure the visual_text is clean and punchy, caption_hook is a viral 1-sentence teaser, answer reveals the twist, read_more_content explains the logic, and category is one of: Riddles, Puzzles, Brain Teasers, Quiz, Find the Mistake, Misconceptions, Would you rather, Fun Facts, Blogs.`;

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
 * Analyzes an uploaded riddle/puzzle/math image with Gemini Multimodal Vision,
 * extracts the challenge, solves for the answer, generates the logic, and formats as a QuizPost.
 */
export async function analyzeAndSolveEnigmaImage(
  base64Data: string,
  mimeType: string,
  userNotes?: string
): Promise<QuizPost> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Missing Gemini API Key. Click 'Settings' in the sidebar to add your key.");
  }

  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const cleanMime = mimeType || 'image/jpeg';

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey });
    const userPrompt = `You are an expert viral puzzle and riddle analyst for "Daily Quiz and Riddles" (quizandriddles.com).
The user uploaded an image containing a puzzle, riddle, math problem, traffic intersection scenario, brain teaser, or quiz question.
${userNotes ? `Additional user notes: "${userNotes}"\n` : ''}

Carefully inspect and analyze the image:
1. Transcribe the puzzle, riddle, or question text into 'visual_text'. If there is setup context and a question, separate with pipe: "Context sentence | Question text?".
2. Solve the challenge with 100% precision! Provide the clear, accurate answer in 'answer'.
3. In 'read_more_content', provide the step-by-step logic, mathematical proof, right-of-way rule, or clever riddle explanation explaining WHY the answer is correct (this will be used directly in the WordPress reveal article).
4. Craft a punchy, 1-sentence viral social media caption hook in 'caption_hook' (e.g. "Only 5% know the right of way order here!", "Can you spot the fatal flaw in the alibi?", "Viral math trap — what is your answer?").
5. Choose the best category: "Riddles", "Puzzles", "Brain Teasers", "Quiz", "Find the Mistake", "Misconceptions", "Controversial", "Fun Facts", or "Blogs".
6. Provide a concise 1-2 word keyword describing the core subject in 'image_keyword'.
7. Set 'text_length' to 'medium'.`;

    const contents = [
      {
        inlineData: {
          mimeType: cleanMime,
          data: cleanBase64,
        },
      },
      userPrompt,
    ];

    const response = await generateWithModelFallback(
      ai,
      contents,
      SYSTEM_INSTRUCTIONS,
      POST_SCHEMA
    );

    const parsed = JSON.parse(response.text || "{}");
    const post = assignId(parsed, 0);
    post.layout = 'image-only'; // Default to Image Only for uploaded image puzzles
    return post;
  });
}

/**
 * Lightweight helper to suggest a viral 1-sentence caption hook for an uploaded image.
 */
export async function generateCaptionForImage(
  base64Data: string,
  mimeType: string
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return "Can you solve this puzzle? Drop your answer in the comments! 👇";

  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const cleanMime = mimeType || 'image/jpeg';

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { inlineData: { mimeType: cleanMime, data: cleanBase64 } },
        "Write a single, short, viral 1-sentence social media hook/caption for this puzzle image. Do not reveal the answer. Output only the plain sentence without quotation marks."
      ]
    });
    return response.text?.trim().replace(/^["']|["']$/g, '') || "Can you solve this puzzle? Drop your answer below! 👇";
  } catch (e) {
    return "Can you solve this puzzle? Drop your answer below! 👇";
  }
}

/**
 * Crafts a long-form, SEO-optimized HTML article for WordPress (quizandriddles.com)
 * matching the site's exact article format:
 * - <h2>Riddle:</h2> (or Question / Puzzle)
 * - <h2>Answer:</h2>
 * - <h2>Explanation:</h2> with hook, step-by-step breakdown list, and engaging conclusion.
 */
export async function generateArticleForPost(
  post: QuizPost,
  relatedPosts?: QuizPost[]
): Promise<string> {
  if (post.isDirectImage) {
    throw new Error("Cannot generate an article for an image-only post.");
  }
  if (!post.answer || !post.answer.trim()) {
    throw new Error("Cannot generate an article: Post answer is missing. Please provide the question and correct answer before generating an article.");
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Missing Gemini API Key. Click 'Settings' in the sidebar to add your key.");
  }

  const sectionLabel = post.category === 'Riddles' ? 'Riddle' :
                       post.category === 'Puzzles' ? 'Puzzle' :
                       post.category === 'Brain Teasers' ? 'Brain Teaser' :
                       post.category === 'Find the Mistake' ? 'Challenge' : 'Question';

  // Build internal links if related published posts are provided
  let interlinkingInstructions = '';
  if (relatedPosts && relatedPosts.length > 0) {
    const validLinks = relatedPosts
      .filter(p => p.id !== post.id && p.wpPostUrl)
      .slice(0, 3)
      .map(p => {
        let cleanTitle = p.visual_text || p.category;
        if (cleanTitle.includes('|')) cleanTitle = cleanTitle.split('|')[0].trim();
        return `<li><a href="${p.wpPostUrl}" style="color: #0477CF; font-weight: 600; text-decoration: underline;">${cleanTitle}</a></li>`;
      });

    if (validLinks.length > 0) {
      interlinkingInstructions = `
### MANDATORY INTERNAL INTERLINKING SECTION:
At the very end of the article (before the schema script), include this exact HTML block:
<div class="dqr-related-posts" style="margin-top: 36px; padding: 20px; background: #F1F5F9; border-radius: 12px; border: 1px solid #E2E8F0;">
  <h3 style="margin-top: 0; color: #0F172A; font-size: 1.1rem; font-weight: 700;">🔥 Can You Solve These Next?</h3>
  <ul style="padding-left: 20px; margin-bottom: 0;">
    ${validLinks.join('\n    ')}
  </ul>
</div>`;
    }
  }

  const systemPrompt = `You are the chief content creator and SEO specialist for "Daily Quiz and Riddles" (quizandriddles.com).
Your task is to write a captivating, engaging, SEO-rich blog article adhering strictly to our interactive reveal format for high dwell time and Google ranking.

### ARTICLE STYLE REQUIREMENTS (MANDATORY FORMAT):
You must output clean semantic HTML (no markdown code blocks, just raw HTML) adhering strictly to this structure:

<h2>${sectionLabel}:</h2>
<p style="font-size: 1.15rem; line-height: 1.6; margin-bottom: 24px;">[The exact riddle or question clearly formatted]</p>

<details class="dqr-reveal-box" style="margin: 28px 0; border: 2px dashed #0477CF; border-radius: 16px; background-color: #F8FAFC; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
  <summary style="font-weight: 700; font-size: 1.1rem; color: #0477CF; padding: 18px 24px; cursor: pointer; user-select: none; background: #EFF6FF; border-bottom: 1px solid #DBEAFE; list-style: none;">
    💡 Click to Reveal Answer & Step-by-Step Explanation
  </summary>
  <div style="padding: 24px;">
    <h2 style="color: #0F172A; margin-top: 0;">Answer:</h2>
    <p style="font-size: 1.25rem; font-weight: 700; color: #16A34A; background: #DCFCE7; padding: 12px 18px; border-radius: 8px; border-left: 4px solid #16A34A; display: inline-block;"><strong>[The exact answer in bold]</strong></p>
    
    <h2 style="color: #0F172A; margin-top: 24px;">Explanation:</h2>
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
  </div>
</details>
${interlinkingInstructions}

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "QAPage",
  "mainEntity": {
    "@type": "Question",
    "name": "[Clean Question Title without special markup]",
    "text": "[The exact riddle or question text]",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "[The exact answer with brief solution summary]"
    }
  }
}
</script>

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
Mix categories across: Riddles, Puzzles, Brain Teasers, Quiz, Find the Mistake, Misconceptions, Would you rather, and Fun Facts. [Seed: ${seed}]${avoidClause}`;
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
    } else if (category === Category.WouldYouRather || (category as any) === 'Would you rather' || (category as any) === 'Controversial') {
      categoryGuidance = 'MANDATORY: Impossible, highly polarizing "Would You Rather" dilemmas that start heated debates. visual_text MUST be: "Option A text | Option B text" (e.g. "Only be able to whisper | Only be able to shout"). NEVER put "Would you rather" in visual_text! category MUST be "Would you rather".';
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
