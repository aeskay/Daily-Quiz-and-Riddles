
export enum Category {
  LogicMath = 'Logic & Math',
  ScienceTech = 'Science & Tech',
  GeneralKnowledge = 'General Knowledge',
  LanguageLit = 'Language & Literature',
  Riddles = 'Riddles',
  NatureAnimals = 'Nature & Animals',
  Psychology = 'Psychology',
  WouldYouRather = 'Would you rather',
  All = 'All'
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
  postError?: string;
  source?: 'ai' | 'human_web' | 'community';
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
  Queue = 'QUEUE'
}