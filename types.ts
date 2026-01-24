
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
  visual_text: string;
  read_more_content: string;
  answer: string;
  category: string;
  style_hint: string;
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