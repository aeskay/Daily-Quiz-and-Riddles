
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
  timestamp: number;
  status: 'active' | 'archived';
}

export enum ViewMode {
  Today = 'TODAY',
  Browse = 'BROWSE',
  Generate = 'GENERATE',
  Archive = 'ARCHIVE'
}