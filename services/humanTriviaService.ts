import { Category, QuizPost } from '../types';

/** Extracts a punchy 1-2 word vector illustration keyword from question and answer */
function extractKeyword(text: string, answer: string): string {
  const combined = `${text} ${answer}`.toLowerCase();
  const match = combined.match(/\b(runner|race|clock|match|fire|candle|train|egg|rooster|apple|sheep|bat|baseball|cat|mouse|money|dollar|calculator|abacus|chocolate|pyramid|egypt|ketchup|mustard|flag|nepal|banana|hippo|wombat|liver|mars|planet|pineapple|barrage|bubble|koala|elephant|eye|paper|moon|honey|bee|octopus|hummingbird|otter|flamingo|giraffe|bear|starfish|phone|brain|traffic|restaurant|globe|alien|car|monopoly|map|stamp|towel|hotel)\b/i);
  if (match) return match[1].toLowerCase();
  
  const cleanAns = answer.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const words = cleanAns.split(/\s+/);
  if (words.length <= 2 && cleanAns.length > 2 && !['yes', 'no', 'true', 'false', 'both', 'none'].includes(cleanAns)) {
    return cleanAns;
  }
  return words[0] || 'quiz';
}

/** ── TIKTOK & REELS VIRAL CONTENT VAULTS (Zero textbook homework, 100% viral engagement) ── */

const VIRAL_VAULTS: Record<Category, Array<Omit<QuizPost, 'id' | 'timestamp' | 'status'>>> = {
  [Category.LogicMath]: [
    {
      visual_text: "Don't answer too fast: | 5 + 5 × 5 - 5 = ?",
      answer: "25! (Multiplication first: 5 × 5 = 25, then 5 + 25 - 5 = 25).",
      read_more_content: "The answer is 25! Following order of operations (PEMDAS), you multiply before adding or subtracting. Most people rush and say 45 or 0! What did you get first?",
      category: Category.LogicMath,
      style_hint: "vibrant",
      image_keyword: "calculator",
      text_length: "medium",
      source: "community"
    },
    {
      visual_text: "Only 1 in 10 get this right without arguing: | 6 ÷ 2(1 + 2) = ?",
      answer: "9! (1+2=3, then 6÷2=3, then 3×3=9).",
      read_more_content: "It's 9! Parentheses first (1+2=3), then division and multiplication from left to right: 6÷2 = 3, then 3×3 = 9. This problem causes heated arguments across the internet!",
      category: Category.LogicMath,
      style_hint: "editorial",
      image_keyword: "abacus",
      text_length: "medium",
      source: "community"
    },
    {
      visual_text: "A bat and a baseball cost $1.10 in total. The bat costs $1.00 more than the ball. | How much does the ball cost?",
      answer: "5 cents ($0.05).",
      read_more_content: "5 cents! If the ball were 10 cents, the bat would cost $1.10, making the total $1.20! Bat ($1.05) + Ball ($0.05) = $1.10.",
      category: Category.LogicMath,
      style_hint: "minimal",
      image_keyword: "baseball bat",
      text_length: "medium",
      source: "community"
    },
    {
      visual_text: "A doctor gives you 3 pills and tells you to take one every 30 minutes. | How long do the pills last?",
      answer: "60 minutes (1 hour).",
      read_more_content: "Only 60 minutes! You take Pill 1 right now at 0:00, Pill 2 at 30 minutes, and Pill 3 at 60 minutes. Did you say 90 minutes?",
      category: Category.LogicMath,
      style_hint: "editorial",
      image_keyword: "clock",
      text_length: "medium",
      source: "community"
    },
    {
      visual_text: "If you have 10 apples and take away 4, how many apples do YOU have?",
      answer: "4 apples (You took them!).",
      read_more_content: "You have 4 apples! The question asks how many YOU have, not how many are left in the basket. A classic wording trap!",
      category: Category.LogicMath,
      style_hint: "vibrant",
      image_keyword: "apple",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "If 3 cats can catch 3 mice in 3 minutes, how many cats does it take to catch 100 mice in 100 minutes?",
      answer: "Just 3 cats.",
      read_more_content: "Still just 3 cats! If 3 cats catch 3 mice in 3 minutes, it means the 3 cats catch 1 mouse every single minute. In 100 minutes, they will catch 100 mice.",
      category: Category.LogicMath,
      style_hint: "minimal",
      image_keyword: "cat",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "Two fathers and two sons go fishing. Each catches a fish, yet only 3 fish are brought home. | How?",
      answer: "It was a grandfather, a father, and a grandson (3 people total).",
      read_more_content: "There were only 3 people on the boat! The grandfather is a father, the father is both a son and a father, and the youngest boy is a son.",
      category: Category.LogicMath,
      style_hint: "editorial",
      image_keyword: "fish",
      text_length: "medium",
      source: "community"
    },
    {
      visual_text: "Find the missing number in 5 seconds: | 2, 6, 12, 20, 30, ?",
      answer: "42 (Differences increase: +4, +6, +8, +10, +12).",
      read_more_content: "42! The gaps between numbers grow by 2 each time: 2 (+4) = 6, 6 (+6) = 12, 12 (+8) = 20, 20 (+10) = 30, and 30 (+12) = 42.",
      category: Category.LogicMath,
      style_hint: "vibrant",
      image_keyword: "calculator",
      text_length: "medium",
      source: "community"
    },
    {
      visual_text: "I add 5 to 9 and somehow end up with 2. The math is 100% correct. | How is this possible?",
      answer: "On a clock! (9 o'clock + 5 hours = 2 o'clock).",
      read_more_content: "Clock math! 9 AM plus 5 hours brings you right to 2 PM.",
      category: Category.LogicMath,
      style_hint: "minimal",
      image_keyword: "alarm clock",
      text_length: "medium",
      source: "community"
    },
    {
      visual_text: "What is the only number in the English language whose letters are in alphabetical order?",
      answer: "Forty (F - O - R - T - Y).",
      read_more_content: "Forty! The letters appear in exact alphabetical order. No other number from one to infinity has this property.",
      category: Category.LogicMath,
      style_hint: "editorial",
      image_keyword: "letter blocks",
      text_length: "short",
      source: "community"
    }
  ],

  [Category.Riddles]: [
    {
      visual_text: "Don't overthink this: If you're running a race and you pass the person in 2nd place, what place are you in?",
      answer: "2nd place! (You took their spot, not 1st!).",
      read_more_content: "2nd place! Almost everyone says 1st place in the comments. To be in 1st, you have to pass the leader!",
      category: Category.Riddles,
      style_hint: "vibrant",
      image_keyword: "runner race",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "Your brain is about to lie to you: Spell the word 'SHOP'. | What do you do when you see a green traffic light?",
      answer: "GO! (Most people accidentally say STOP!).",
      read_more_content: "GO! The brain primes with 'SHOP' -> 'STOP', tricking 90% of people into saying STOP at a green light!",
      category: Category.Riddles,
      style_hint: "vibrant",
      image_keyword: "traffic light",
      text_length: "medium",
      source: "community"
    },
    {
      visual_text: "Mary's mother had 4 children: April, May, June, and who? | What is the 4th child's name?",
      answer: "Mary!",
      read_more_content: "Mary! Re-read the first two words: 'Mary's mother'. Most people answer July!",
      category: Category.Riddles,
      style_hint: "editorial",
      image_keyword: "calendar",
      text_length: "medium",
      source: "community"
    },
    {
      visual_text: "A cowboy rides into town on Friday. He stays for three full days, then leaves on Friday. | How did he do it?",
      answer: "His horse's name was Friday.",
      read_more_content: "His horse was named Friday! The ultimate classic riddle that tricks you into checking your calendar.",
      category: Category.Riddles,
      style_hint: "minimal",
      image_keyword: "horse",
      text_length: "medium",
      source: "community"
    },
    {
      visual_text: "A man pushes his car to a hotel and immediately tells the owner he is bankrupt. | Why?",
      answer: "He was playing Monopoly.",
      read_more_content: "He was playing Monopoly! His game token was the car, and landing on an opponent's hotel wiped out his cash.",
      category: Category.Riddles,
      style_hint: "editorial",
      image_keyword: "hotel building",
      text_length: "medium",
      source: "community"
    },
    {
      visual_text: "What has 4 letters, sometimes has 9 letters, but never has 5 letters.",
      answer: "Read carefully: 'What' has 4 letters, 'sometimes' has 9, 'never' has 5!",
      read_more_content: "It's not a question, it's a statement! Count the letters: W-H-A-T (4), S-O-M-E-T-I-M-E-S (9), N-E-V-E-R (5).",
      category: Category.Riddles,
      style_hint: "midnight",
      image_keyword: "key",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "A rooster lays an egg right on the peak of a barn roof. | Which side does the egg roll down?",
      answer: "Roosters don't lay eggs!",
      read_more_content: "Roosters don't lay eggs — hens do! Did you try calculating the roof slope?",
      category: Category.Riddles,
      style_hint: "vibrant",
      image_keyword: "rooster",
      text_length: "medium",
      source: "community"
    },
    {
      visual_text: "You are in a freezing dark room with a candle, a wood stove, and a gas lamp. You only have ONE match. | What do you light first?",
      answer: "The match!",
      read_more_content: "The match! You can't light any of the heaters or candles until you strike the match first.",
      category: Category.Riddles,
      style_hint: "minimal",
      image_keyword: "match fire",
      text_length: "medium",
      source: "community"
    },
    {
      visual_text: "What can you hold in your left hand, but never in your right hand?",
      answer: "Your right elbow (or right hand)!",
      read_more_content: "Your right elbow! Physically impossible to grip your right elbow with your right hand.",
      category: Category.Riddles,
      style_hint: "editorial",
      image_keyword: "hand",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "What gets wetter and wetter the more it dries?",
      answer: "A towel.",
      read_more_content: "A towel! As it dries you off, it absorbs water and becomes wet.",
      category: Category.Riddles,
      style_hint: "minimal",
      image_keyword: "towel",
      text_length: "short",
      source: "community"
    }
  ],

  [Category.ScienceTech]: [
    {
      visual_text: "What color is the sunset on the surface of Mars?",
      answer: "Blue.",
      read_more_content: "Blue! Fine Martian dust scatters red light away from the sun, allowing blue light to penetrate through the thin atmosphere directly to the observer.",
      category: Category.ScienceTech,
      style_hint: "midnight",
      image_keyword: "planet mars",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "What common fruit is genetically 50% identical to human DNA?",
      answer: "The banana!",
      read_more_content: "Bananas! Roughly 50% of human genes share counterparts with banana DNA because all cellular life on Earth shares fundamental biological machinery.",
      category: Category.ScienceTech,
      style_hint: "vibrant",
      image_keyword: "banana",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "What animal produces milk that is bright neon pink?",
      answer: "The hippopotamus!",
      read_more_content: "Hippos! Their milk is mixed with their natural sunscreen sweat (hipposudoric acid), which turns the white milk a bright strawberry-pink color.",
      category: Category.ScienceTech,
      style_hint: "vibrant",
      image_keyword: "hippo",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "Which animal has cube-shaped poop to prevent it from rolling away?",
      answer: "The wombat!",
      read_more_content: "Wombats! Their intestines have alternating rigid and flexible grooves that shape feces into cubes so they can stack them on rocks to mark territory.",
      category: Category.ScienceTech,
      style_hint: "minimal",
      image_keyword: "cube block",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "What was Bubble Wrap originally invented to be sold as?",
      answer: "3D Textured Wallpaper!",
      read_more_content: "Wallpaper! In 1957, inventors sealed two shower curtains together with air bubbles intending to market it as trendy textured wallpaper before discovering its packaging superpower.",
      category: Category.ScienceTech,
      style_hint: "editorial",
      image_keyword: "bubble",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "What is the only human organ that can completely regrow itself from just 25% of its mass?",
      answer: "The liver.",
      read_more_content: "The liver! It has unique cellular regeneration capabilities. As little as 25% of a healthy liver can regrow into a full-sized functioning organ in weeks.",
      category: Category.ScienceTech,
      style_hint: "editorial",
      image_keyword: "human organ",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "Why do your fingers and toes get wrinkled after staying in the water?",
      answer: "An active evolutionary nerve reflex to give you tire-tread grip underwater!",
      read_more_content: "It's an active nerve reflex! Your nervous system constricts blood vessels to create tire-tread grooves for wet grip. People with nerve damage in their fingers don't wrinkle at all!",
      category: Category.ScienceTech,
      style_hint: "minimal",
      image_keyword: "water drops",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "What animal has fingerprints so identical to humans that they can fool FBI crime scene detectives?",
      answer: "Koalas!",
      read_more_content: "Koalas! Even under an electron microscope, koala fingerprints have loops, whorls, and ridges virtually indistinguishable from human prints.",
      category: Category.ScienceTech,
      style_hint: "vibrant",
      image_keyword: "fingerprint",
      text_length: "short",
      source: "community"
    }
  ],

  [Category.GeneralKnowledge]: [
    {
      visual_text: "Which country has more ancient pyramids than Egypt?",
      answer: "Sudan (Over 255 pyramids vs Egypt's 138).",
      read_more_content: "Sudan! Built by the rulers of the ancient Kingdom of Kush, Sudan has nearly double the number of pyramids that Egypt has, though they are steeper and narrower.",
      category: Category.GeneralKnowledge,
      style_hint: "editorial",
      image_keyword: "pyramid",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "What was ketchup originally sold and marketed as across America in the 1830s?",
      answer: "Medicine for indigestion and diarrhea!",
      read_more_content: "Medicine! In 1834, an Ohio physician claimed tomato ketchup cured digestive ailments and sold it in pill form before it became America's favorite condiment.",
      category: Category.GeneralKnowledge,
      style_hint: "vibrant",
      image_keyword: "ketchup bottle",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "Which country consumes the most chocolate per person in the entire world?",
      answer: "Switzerland (nearly 20 lbs / 8.8 kg per person every year).",
      read_more_content: "Switzerland! The Swiss eat more chocolate per capita than any nation on Earth, beating out Germany and Austria.",
      category: Category.GeneralKnowledge,
      style_hint: "editorial",
      image_keyword: "chocolate bar",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "What was the first commercial product in history to ever have a barcode scanned at checkout?",
      answer: "A 10-pack of Wrigley's Juicy Fruit chewing gum in 1974.",
      read_more_content: "Wrigley's chewing gum! Scanned at a Marsh Supermarket in Troy, Ohio on June 26, 1974, kicking off the modern barcode era.",
      category: Category.GeneralKnowledge,
      style_hint: "minimal",
      image_keyword: "barcode scanner",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "What is the only letter in the English alphabet that does not appear in any of the 50 US state names?",
      answer: "The letter Q.",
      read_more_content: "The letter Q! Every other letter from A to Z appears at least once — including Z (Arizona), X (Texas), and J (New Jersey).",
      category: Category.GeneralKnowledge,
      style_hint: "editorial",
      image_keyword: "usa map",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "Why is the number '57' famously embossed on the glass neck of Heinz ketchup bottles?",
      answer: "It marks the sweet spot to tap so the ketchup flows easily!",
      read_more_content: "It's the tap spot! Tapping firmly on the embossed '57' on the neck creates the ideal fluid vibration to release trapped ketchup smoothly.",
      category: Category.GeneralKnowledge,
      style_hint: "vibrant",
      image_keyword: "glass bottle",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "What fruit was so expensive in 18th-century Europe that people rented it just to carry to parties?",
      answer: "The pineapple!",
      read_more_content: "The pineapple! Costing the modern equivalent of thousands of dollars, wealthy aristocrats rented pineapples for the night just to show off as a status symbol.",
      category: Category.GeneralKnowledge,
      style_hint: "vibrant",
      image_keyword: "pineapple",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "What is the only national flag in the world that is not a four-sided rectangle?",
      answer: "The flag of Nepal.",
      read_more_content: "Nepal! Its unique flag is formed by two stacked triangular pennants representing the Himalayan mountains and its two main religions.",
      category: Category.GeneralKnowledge,
      style_hint: "minimal",
      image_keyword: "flag",
      text_length: "short",
      source: "community"
    }
  ],

  [Category.NatureAnimals]: [
    {
      visual_text: "Which bird is the only one in the world that can fly backwards and upside down?",
      answer: "The hummingbird.",
      read_more_content: "Hummingbirds! Their unique ball-and-socket wing joints rotate 180 degrees in a figure-eight pattern, allowing aerial acrobatics no other bird can pull off.",
      category: Category.NatureAnimals,
      style_hint: "vibrant",
      image_keyword: "hummingbird",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "Which mammal has the densest fur of any animal on Earth, with 1 million hairs per square inch?",
      answer: "The sea otter.",
      read_more_content: "Sea otters! Lacking blubber, they rely entirely on dense, waterproof fur to survive in freezing ocean water. Humans have around 100,000 hairs on their entire head!",
      category: Category.NatureAnimals,
      style_hint: "editorial",
      image_keyword: "sea otter",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "What animal has the highest blood pressure in the world to pump blood 6 feet straight up?",
      answer: "The giraffe.",
      read_more_content: "Giraffes! Their hearts are 2 feet long and weigh 25 pounds, generating blood pressure more than double a human's to fight gravity up their 6-foot necks.",
      category: Category.NatureAnimals,
      style_hint: "minimal",
      image_keyword: "giraffe",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "What color is a polar bear's skin underneath all that thick white fur?",
      answer: "Jet black.",
      read_more_content: "Jet black! Their black skin absorbs heat from the sun. Their fur isn't actually white either — it consists of clear, hollow tubes that reflect light!",
      category: Category.NatureAnimals,
      style_hint: "midnight",
      image_keyword: "polar bear",
      text_length: "short",
      source: "community"
    }
  ],

  [Category.LanguageLit]: [
    {
      visual_text: "Name 3 common fruits that do NOT have the letter 'E' in their name in 5 seconds!",
      answer: "Banana, Kiwi, Mango (also: Apricot, Fig, Plum).",
      read_more_content: "Banana, Kiwi, Mango! Did your brain freeze trying to avoid Apple, Grape, Orange, and Lemon?",
      category: Category.LanguageLit,
      style_hint: "vibrant",
      image_keyword: "fruit basket",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "What is the only common 15-letter English word that can be spelled without repeating a single letter?",
      answer: "Uncopyrightable.",
      read_more_content: "Uncopyrightable! All 15 letters are completely unique. Words with no repeating letters are called isograms.",
      category: Category.LanguageLit,
      style_hint: "editorial",
      image_keyword: "typewriter",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "What English word has three consecutive sets of double letters?",
      answer: "Bookkeeper (b-oo-kk-ee-p-e-r).",
      read_more_content: "Bookkeeper (and bookkeeping)! It is the only unhyphenated English word with three consecutive double letters.",
      category: Category.LanguageLit,
      style_hint: "minimal",
      image_keyword: "book",
      text_length: "short",
      source: "community"
    }
  ],

  [Category.Psychology]: [
    {
      visual_text: "Why do you suddenly feel your phone vibrating in your pocket even when nobody called?",
      answer: "Phantom Vibration Syndrome.",
      read_more_content: "Phantom Vibration Syndrome! Up to 90% of smartphone users experience it. The brain misinterprets slight muscle twitches or clothes shifting as phone notifications.",
      category: Category.Psychology,
      style_hint: "vibrant",
      image_keyword: "smartphone",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "What is the psychological term for seeing human faces in electrical outlets, cars, or burnt toast?",
      answer: "Pareidolia.",
      read_more_content: "Pareidolia! An evolutionary survival trait: our brains are hardwired to detect faces in milliseconds, even in inanimate objects.",
      category: Category.Psychology,
      style_hint: "editorial",
      image_keyword: "brain",
      text_length: "short",
      source: "community"
    }
  ],

  [Category.WouldYouRather]: [
    {
      visual_text: "Never have to wait in line or traffic ever again | Always eat for free at any restaurant in the world",
      answer: "Which one are you picking? Vote in the comments!",
      read_more_content: "Time vs Luxury: Getting thousands of wasted hours back in your life, or experiencing free world-class cuisine every single day?",
      category: Category.WouldYouRather,
      style_hint: "vibrant",
      image_keyword: "traffic light",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "Pause time for 10 minutes once a day | Rewind time by 10 seconds whenever you make a mistake",
      answer: "Pause or Rewind? Share your strategy below!",
      read_more_content: "Pausing gives you time to react, but rewinding lets you erase any awkward conversation, typo, or minor mistake instantly.",
      category: Category.WouldYouRather,
      style_hint: "midnight",
      image_keyword: "hourglass",
      text_length: "short",
      source: "community"
    },
    {
      visual_text: "Be able to speak every human language fluently | Be able to talk to all animals",
      answer: "Human languages or Animal communication? Vote below!",
      read_more_content: "Total global human connection vs unlocking the secret thoughts of pets and wild creatures.",
      category: Category.WouldYouRather,
      style_hint: "editorial",
      image_keyword: "globe",
      text_length: "short",
      source: "community"
    }
  ],

  [Category.All]: []
};

function assignPostId(post: Omit<QuizPost, 'id' | 'timestamp' | 'status'>, index = 0): QuizPost {
  return {
    ...post,
    id: `viral-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    status: 'active'
  };
}

/**
 * Universal viral content fetcher:
 * Pulls exclusively from tested TikTok, Instagram Reels, and YouTube Shorts style viral questions.
 * Completely eliminates 1990s pub quiz homework questions (Ohm's law, Beaufort scale, etc.)!
 */
export async function fetchRealHumanContent(category?: Category | null, count = 8): Promise<QuizPost[]> {
  let pool: Array<Omit<QuizPost, 'id' | 'timestamp' | 'status'>> = [];

  if (category && VIRAL_VAULTS[category] && VIRAL_VAULTS[category].length > 0) {
    pool = [...VIRAL_VAULTS[category]];
  } else {
    // Mixed across all categories
    pool = [
      ...VIRAL_VAULTS[Category.LogicMath],
      ...VIRAL_VAULTS[Category.Riddles],
      ...VIRAL_VAULTS[Category.ScienceTech],
      ...VIRAL_VAULTS[Category.GeneralKnowledge],
      ...VIRAL_VAULTS[Category.NatureAnimals],
      ...VIRAL_VAULTS[Category.LanguageLit],
      ...VIRAL_VAULTS[Category.Psychology],
      ...VIRAL_VAULTS[Category.WouldYouRather],
    ];
  }

  // Shuffle and pick
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, count);

  return selected.map((item, i) => assignPostId(item, i));
}
