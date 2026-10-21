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

export const SYSTEM_INSTRUCTIONS = `You are an elite content creator for "Daily Quiz and Riddles". You generate intellectual, fascinating, discussion-provoking puzzles, riddles, trivia, and dilemmas.

### ABSOLUTE BAN LIST — NEVER GENERATE ANY VARIATION OF THESE:
1. SOCKS IN A DRAWER (e.g., 5 blue, 5 black, how many to guarantee a pair) — FORBIDDEN!
2. BAT AND BALL costs $1.10 — FORBIDDEN!
3. RIVER CROSSING (wolf, goat, cabbage / cannibals and missionaries) — FORBIDDEN!
4. TWO DOORS / TWO GUARDS (one always lies, one tells truth) — FORBIDDEN!
5. THREE LIGHT BULBS / SWITCHES outside the room — FORBIDDEN!
6. WATER JUG MEASURING (3 gallon and 5 gallon) — FORBIDDEN!
7. SNAIL IN A WELL (climbs 3 feet, slips back 2) — FORBIDDEN!
8. COUNTERFEIT / HEAVY COIN with balance scale — FORBIDDEN!
9. MONTY HALL 3 doors problem — FORBIDDEN!
10. ROPE BURNING 45 minutes / hourglass timer — FORBIDDEN!
11. AIRPLANE ON A CONVEYOR BELT — FORBIDDEN!
12. FATHER AND SON doctor / surgeon riddle — FORBIDDEN!
13. TORN PAGES FROM A BOOK — FORBIDDEN (already used)!
14. TITIN longest word — FORBIDDEN (already used)!
15. MAUNA KEA tallest mountain base-to-summit — FORBIDDEN (already used)!
16. MOON SHINING / reflection — FORBIDDEN (already used)!
17. Common word riddles: "keys but no locks", "wetter as it dries", "silence", "echo", "sponge", "coffin/grave", "candle" — FORBIDDEN!

### WHAT TO GENERATE INSTEAD:
- Real obscure historical mysteries & paradoxes (e.g. The Ship of Theseus, Birthday Paradox variation, Banach-Tarski concept, Grand Hotel paradox, Newcomb's paradox).
- Fresh geometric or probability teasers with unexpected counter-intuitive answers.
- Lateral thinking situational puzzles with a satisfying "aha!" moment.
- Genuine science/nature curiosities (e.g. why flamingos stand on one leg, time dilation at different altitudes, honey never spoiling).
- High-stakes, agonizing "Would You Rather" dilemmas that test ethical intuitions.

### STRICT FORMAT RULES:
- visual_text: Format as "Context setup sentence. | Question?" where the context text gives the premise and the question is short, punchy, and clear.
  - If self-contained question with no background needed, just write "Question?" (no pipe).
  - For Would You Rather: format as "Option A premise | Option B premise"
- text_length:
  - "short" if visual_text has no pipe AND question is under 75 characters
  - "medium" if visual_text has a setup premise + question
  - "long" if text is over 150 characters and requires no image
- image_keyword: 1-2 words describing a specific isolated object for a transparent vector (e.g. "telescope", "hourglass", "compass", "chess pawn", "beaker", "dna", "brain"). DO NOT use generic words like "illustration" or "concept".
`;