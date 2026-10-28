
export enum Category {
  Riddles = 'Riddles',
  Puzzles = 'Puzzles',
  BrainTeasers = 'Brain Teasers',
  Quiz = 'Quiz',
  FindTheMistake = 'Find the Mistake',
  Misconceptions = 'Misconceptions',
  Controversial = 'Controversial',
  FunFacts = 'Fun Facts',
  Blogs = 'Blogs',
  All = 'All'
}

/**
 * Normalizes any category string (including legacy ones like Logic & Math, Would you rather)
 * to our active WordPress-aligned Category enum.
 */
export function normalizeCategory(cat: string): Category {
  const c = (cat || '').trim().toLowerCase();
  if (c === 'riddles') return Category.Riddles;
  if (c === 'puzzles' || c === 'logic & math' || c === 'math' || c === 'logic') return Category.Puzzles;
  if (c === 'brain teasers' || c === 'brain teaser') return Category.BrainTeasers;
  if (c === 'find the mistake' || c === 'find mistake') return Category.FindTheMistake;
  if (c === 'misconceptions' || c === 'misconception' || c === 'psychology') return Category.Misconceptions;
  if (c === 'controversial' || c === 'would you rather' || c === 'wyr') return Category.Controversial;
  if (c === 'fun facts' || c === 'nature & animals' || c === 'animals' || c === 'nature') return Category.FunFacts;
  if (c === 'blogs' || c === 'blog') return Category.Blogs;
  if (c === 'quiz' || c === 'science & tech' || c === 'general knowledge' || c === 'language & literature') return Category.Quiz;
  return Category.Quiz;
}

export interface QuizPost {
  id: string;
  /** Short punchy viral teaser for social media caption (e.g. "Only 1% can solve this fast!") */
  caption_hook?: string;
  /** For normal posts: "Context text | Question text" or just "Question text"
   *  For Would You Rather: "Option A | Option B"
   */
  visual_text: string;
  read_more_content: string;
  answer: string;
  category: string;
  style_hint: string;
  /** A short 1-3 word search term for fetching a relevant vector image */
  image_keyword: string;
  /** 'short' = question only (≤80 chars), 'medium' = context + question, 'long' = text-heavy, no image */
  text_length: 'short' | 'medium' | 'long';
  /** Cached image URL once fetched */
  imageUrl?: string;
  /** Public Firebase Storage URL of the fully rendered 1000x1000 square card PNG */
  renderedImageUrl?: string;
  timestamp: number;
  status: 'active' | 'archived';
  /** Firebase Auth User ID who created this post */
  userId?: string;

  /** Autopost queue & publication state */
  scheduleStatus?: 'draft' | 'queued' | 'posted' | 'failed';
  scheduledTime?: string; // e.g. "09:00", "13:00", "18:00" or ISO string
  postedAt?: number;
  postedPlatforms?: string[];
  bufferPostIds?: string[];
  postError?: string;
  source?: 'ai' | 'human_web' | 'community';

  /** WordPress Website Article Integration */
  articleContent?: string;
  wpPostId?: number;
  wpPostUrl?: string;
  wpStatus?: 'draft' | 'publish' | 'future';
  wpPublishedAt?: number;
  wpTags?: string[];
  wpMetaDescription?: string;
  wpFocusKeyword?: string;
}

export interface WordPressConfig {
  siteUrl: string;
  username: string;
  applicationPassword: string;
  enabled: boolean;
  autoPublishWithQueue?: boolean;
}

export interface SocialConfig {
  twitter: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessSecret: string;
    enabled: boolean;
  };
  meta: {
    pageId: string;
    instagramAccountId: string;
    accessToken: string; // Long-Lived Page Access Token
    postToFacebook: boolean;
    postToInstagram: boolean;
  };
  tiktok: {
    accessToken: string;
    openId: string;
    enabled: boolean;
  };
  buffer?: {
    accessToken: string;
    channelId: string;
    enabled: boolean;
  };
  wordpress?: WordPressConfig;
  scheduleTimes: string[]; // e.g. ["09:00", "13:00", "18:00"]
  timezone: string; // e.g. "America/Chicago"
  autopostEnabled: boolean;
  imgbbApiKey?: string; // 100% free image hosting key from api.imgbb.com
}

export enum ViewMode {
  Today = 'TODAY',
  Browse = 'BROWSE',
  Generate = 'GENERATE',
  Archive = 'ARCHIVE',
  Queue = 'QUEUE',
  Articles = 'ARTICLES'
}
