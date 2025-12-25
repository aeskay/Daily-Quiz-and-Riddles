
export enum Category {
  LogicMath = 'Logic & Math',
  ScienceTech = 'Science & Tech',
  GeneralKnowledge = 'General Knowledge',
  LanguageLit = 'Language & Literature',
  PopCulture = 'Pop Culture',
  TheArts = 'The Arts',
  NatureAnimals = 'Nature & Animals',
  Psychology = 'Psychology',
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
}

export enum ViewMode {
  Today = 'TODAY',
  Browse = 'BROWSE',
  Generate = 'GENERATE'
}
