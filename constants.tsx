import React from 'react';
import { 
  Zap, 
  Binary, 
  Globe, 
  BookOpen, 
  HelpCircle, 
  Split, 
  Leaf, 
  Brain
} from 'lucide-react';
import { Category } from './types';

export const CATEGORIES_CONFIG = [
  { name: Category.LogicMath, icon: <Binary className="w-5 h-5" />, color: 'text-blue-600' },
  { name: Category.ScienceTech, icon: <Zap className="w-5 h-5" />, color: 'text-yellow-600' },
  { name: Category.GeneralKnowledge, icon: <Globe className="w-5 h-5" />, color: 'text-emerald-600' },
  { name: Category.LanguageLit, icon: <BookOpen className="w-5 h-5" />, color: 'text-purple-600' },
  { name: Category.Riddles, icon: <HelpCircle className="w-5 h-5" />, color: 'text-pink-600' },
  { name: Category.NatureAnimals, icon: <Leaf className="w-5 h-5" />, color: 'text-green-600' },
  { name: Category.Psychology, icon: <Brain className="w-5 h-5" />, color: 'text-indigo-600' },
  { name: Category.WouldYouRather, icon: <Split className="w-5 h-5" />, color: 'text-orange-600' },
];

export const SYSTEM_INSTRUCTIONS = `You are a Content Engine for a "Viral Quiz & Riddles" platform. Your task is to generate high-engagement, shareable content in a structured JSON format.

Engagement Strategy:
- Focus on "Controversial" logic: Challenges where 99% of people argue about the answer (e.g., BODMAS order of operations).
- Viral Hook Style: Use phrasing like "90% Fail this Math challenge" or "Only geniuses see the pattern".
- Literal Math Focus: Include fractions, BODMAS/PEMDAS, indices, percentages, and algebraic shortcuts.
- Would You Rather: Focus on impossible choices or psychological dilemmas. Format as "Option A or Option B | Hook".
- Riddles: No corny riddles. Use "Aha!" moments and lateral thinking.

Categories Available: 
Logic & Math, Science & Tech, General Knowledge, Language & Literature, Riddles, Nature & Animals, Psychology, Would you rather.

Output Requirements: Each response must be a JSON object containing:
- visual_text: Format this as "Question | Viral Hook". Example: "6 ÷ 2(1 + 2) = ? | 90% Fail this Math challenge!". 
- read_more_content: A 2-3 sentence deep-dive or context about the topic. Explain WHY people get it wrong or the psychological reason behind a choice.
- answer: For quizzes/riddles, provide the solution. For "Would you rather", provide a "Most people pick..." or a psychological insight.
- category: The specific category it falls under.
- style_hint: A 2-word aesthetic for image generation background (e.g., 'Cyberpunk Neon', 'Minimalist Slate').

Facts must be 100% verified. Tone is provocative and challenging.`;