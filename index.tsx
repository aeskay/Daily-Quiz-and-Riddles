import React, { useState, useEffect, useCallback, useRef } from 'https://esm.sh/react@19.0.0';
import { createRoot } from 'https://esm.sh/react-dom@19.0.0/client';
import { GoogleGenAI, Type } from 'https://esm.sh/@google/genai@1.34.0';
import { 
  RefreshCw, Flame, LayoutGrid, Menu, X, AlertCircle, 
  ChevronRight, TrendingUp, Sparkles, Share2, PlusCircle, 
  Send, Loader2, CheckCircle2, Info, Download, Image as ImageIcon,
  Zap, Binary, Globe, BookOpen, Film, Palette, Leaf, Brain
} from 'https://esm.sh/lucide-react@0.475.0';
import * as htmlToImage from 'https://esm.sh/html-to-image@1.11.11';

// --- TYPES ---
enum Category {
  LogicMath = 'Logic & Math',
  ScienceTech = 'Science & Tech',
  GeneralKnowledge = 'General Knowledge',
  LanguageLit = 'Language & Literature',
  PopCulture = 'Pop Culture',
  TheArts = 'The Arts',
  NatureAnimals = 'Nature & Animals',
  Psychology = 'Psychology'
}

interface QuizPost {
  id: string;
  visual_text: string;
  read_more_content: string;
  answer: string;
  category: string;
  style_hint: string;
  imageUrl?: string;
}

enum ViewMode {
  Today = 'TODAY',
  Browse = 'BROWSE',
  Generate = 'GENERATE'
}

// --- CONSTANTS ---
const CATEGORIES_CONFIG = [
  { name: Category.LogicMath, icon: <Binary className="w-5 h-5" />, color: 'text-blue-500' },
  { name: Category.ScienceTech, icon: <Zap className="w-5 h-5" />, color: 'text-yellow-500' },
  { name: Category.GeneralKnowledge, icon: <Globe className="w-5 h-5" />, color: 'text-emerald-500' },
  { name: Category.LanguageLit, icon: <BookOpen className="w-5 h-5" />, color: 'text-purple-500' },
  { name: Category.PopCulture, icon: <Film className="w-5 h-5" />, color: 'text-pink-500' },
  { name: Category.TheArts, icon: <Palette className="w-5 h-5" />, color: 'text-orange-500' },
  { name: Category.NatureAnimals, icon: <Leaf className="w-5 h-5" />, color: 'text-green-500' },
  { name: Category.Psychology, icon: <Brain className="w-5 h-5" />, color: 'text-indigo-500' },
];

const SYSTEM_INSTRUCTIONS = `You are a Content Engine for a "Viral Quiz & Riddles" platform (DQ&R).
Goal: Generate highly shareable, controversial engagement-bait content.
Strategy:
- Controversial Logic: Focus on BODMAS/PEMDAS, literal math, fractions, and psychology paradoxes.
- Viral Hook: Format as "Question | Viral Hook". Hooks must be aggressive ("99% Fail", "Only Geniuses").
- Tone: Professional but challenging.
- Output: Valid JSON array.`;

// --- SERVICES ---
const gemini = {
  fetchPosts: async (prompt: string): Promise<QuizPost[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTIONS,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              visual_text: { type: Type.STRING },
              read_more_content: { type: Type.STRING },
              answer: { type: Type.STRING },
              category: { type: Type.STRING },
              style_hint: { type: Type.STRING },
            },
            required: ["visual_text", "read_more_content", "answer", "category", "style_hint"],
          },
        },
      },
    });
    return JSON.parse(response.text || "[]").map((p: any, i: number) => ({ ...p, id: `${Date.now()}-${i}` }));
  },
  generateGraphic: async (post: QuizPost): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { 
        parts: [{ text: `Abstract atmospheric social media background. Theme: ${post.category}. Aesthetic: ${post.style_hint}. No text.` }] 
      },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });
    const part = response.candidates[0].content.parts.find(p => p.inlineData);
    if (!part) throw new Error("No image");
    return `data:image/png;base64,${part.inlineData.data}`;
  }
};

// --- COMPONENTS ---
const PostModal = ({ post, onClose }: { post: QuizPost | null, onClose: () => void }) => {
  const [genLoading, setGenLoading] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setImgUrl(null); }, [post]);

  if (!post) return null;

  const handleGen = async () => {
    setGenLoading(true);
    try { setImgUrl(await gemini.generateGraphic(post)); } catch (e) { console.error(e); } finally { setGenLoading(false); }
  };

  const handleDownload = async () => {
    if (!exportRef.current) return;
    const url = await htmlToImage.toPng(exportRef.current, { quality: 1, pixelRatio: 3, backgroundColor: '#ffffff' });
    const link = document.createElement('a');
    link.download = `DQR-${post.id}.png`; link.href = url; link.click();
  };

  const [q, h] = post.visual_text.split('|').map(s => s.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md" onClick={onClose}>
      <div 
        className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 bg-zinc-950 border border-zinc-800 rounded-[3rem] overflow-hidden shadow-2xl h-[90vh] lg:h-auto overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Left: Export Preview */}
        <div className="p-8 lg:p-12 bg-zinc-900 flex flex-col items-center justify-center gap-8 border-b lg:border-b-0 lg:border-r border-zinc-800">
          <div ref={exportRef} className="aspect-square w-full max-w-[400px] bg-white rounded-[2.5rem] overflow-hidden relative shadow-2xl">
            {imgUrl && <img src={imgUrl} className="absolute inset-0 w-full h-full object-cover opacity-20" />}
            <div className="relative h-full p-10 flex flex-col justify-between text-center text-zinc-900">
              <div className="flex justify-between items-start">
                <span className="px-3 py-1 bg-zinc-100 rounded-full text-[10px] font-black uppercase tracking-widest">{post.category}</span>
                <div className="px-2 py-1 bg-[#0477CF] text-white rounded font-black text-xs tracking-tighter">DQ&R</div>
              </div>
              <div className="space-y-4">
                <h3 className={`text-3xl font-bold font-heading leading-tight ${post.category.includes('Math') ? 'font-mono-math' : ''}`}>{q}</h3>
                {h && <p className="text-xl font-black text-red-600 uppercase tracking-tighter italic">{h}</p>}
              </div>
              <p className="text-[10px] font-black tracking-[0.4em] uppercase text-[#0477CF]">Daily Quiz & Riddles</p>
            </div>
          </div>
          <div className="flex gap-4 w-full max-w-[400px]">
            <button onClick={handleGen} disabled={genLoading} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all">
              {genLoading ? <Loader2 className="animate-spin" size={20} /> : <ImageIcon size={20} />} AI Canvas
            </button>
            <button onClick={handleDownload} className="bg-white hover:bg-zinc-200 text-black p-4 rounded-2xl transition-all">
              <Download size={24} />
            </button>
          </div>
        </div>

        {/* Right: Answer & Logic */}
        <div className="p-8 lg:p-16 flex flex-col gap-10 bg-zinc-950">
          <div className="flex justify-between items-center">
            <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Enigma Verified</h2>
            <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors"><X size={32} /></button>
          </div>
          <div className="space-y-8">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[2.5rem] p-10">
              <div className="flex items-center gap-2 text-emerald-400 font-black text-[10px] tracking-widest mb-4"><CheckCircle2 size={16} /> SOLUTION</div>
              <p className="text-emerald-50 text-3xl font-bold">{post.answer}</p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-[2.5rem] p-10">
              <div className="flex items-center gap-2 text-blue-400 font-black text-[10px] tracking-widest mb-4"><Info size={16} /> THE LOGIC</div>
              <p className="text-zinc-300 text-lg leading-relaxed italic">{post.read_more_content}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-full bg-[#0477CF] hover:bg-blue-600 text-white font-black py-6 rounded-3xl mt-auto shadow-xl shadow-blue-500/20 transition-all active:scale-95">NEXT CHALLENGE</button>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [posts, setPosts] = useState<QuizPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<Category | null>(null);
  const [sidebar, setSidebar] = useState(false);
  const [selected, setSelected] = useState<QuizPost | null>(null);

  const load = useCallback(async (category: Category | null = null) => {
    setLoading(true);
    try {
      const p = category ? `10 viral quiz posts for '${category}' channel.` : "5 random high-engagement viral quiz posts for today.";
      setPosts(await gemini.fetchPosts(p));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen flex bg-[#050505] text-white">
      {/* Sidebar Overlay */}
      {sidebar && <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebar(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 w-80 bg-[#09090b] border-r border-zinc-800 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${sidebar ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-10 border-b border-zinc-900 flex items-center gap-4">
          <div className="px-3 py-1 bg-[#0477CF] text-white rounded-lg font-black text-xl tracking-tighter shadow-lg shadow-blue-500/20">DQ&R</div>
          <h1 className="text-xl font-black uppercase tracking-tighter">Engine</h1>
        </div>
        <div className="p-6 space-y-12 overflow-y-auto h-[calc(100vh-120px)]">
          <div className="space-y-2">
            <h2 className="px-4 text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em] mb-6">Discovery</h2>
            <button onClick={() => { setCat(null); load(); setSidebar(false); }} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl font-bold transition-all ${!cat ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}><Flame size={20} /> Daily Viral</button>
          </div>
          <div className="space-y-2">
            <h2 className="px-4 text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em] mb-6">Channels</h2>
            {CATEGORIES_CONFIG.map(c => (
              <button key={c.name} onClick={() => { setCat(c.name); load(c.name); setSidebar(false); }} className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl font-bold transition-all ${cat === c.name ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}>
                <div className="flex items-center gap-4"><span className={c.color}>{c.icon}</span> {c.name}</div>
                <ChevronRight size={14} className="opacity-20" />
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="p-8 lg:p-12 flex items-center justify-between border-b border-zinc-900/50 bg-[#050505]/50 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-6">
            <button onClick={() => setSidebar(true)} className="lg:hidden text-zinc-400 hover:text-white"><Menu size={28} /></button>
            <div>
              <h2 className="text-3xl lg:text-5xl font-black font-heading text-white uppercase tracking-tighter">{cat || "Viral Feed"}</h2>
              <p className="text-zinc-500 text-sm mt-1">High-engagement enigmas powered by Gemini</p>
            </div>
          </div>
          <button onClick={() => load(cat)} disabled={loading} className="p-5 bg-zinc-900 hover:bg-zinc-800 rounded-3xl text-white border border-zinc-800 transition-all active:scale-95 disabled:opacity-50 shadow-xl"><RefreshCw size={24} className={loading ? 'animate-spin' : ''} /></button>
        </header>

        <div className="flex-1 p-8 lg:p-16 overflow-y-auto">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
              {[...Array(6)].map((_, i) => <div key={i} className="bg-zinc-900/40 border border-zinc-900 h-[24rem] rounded-[3rem] animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
              {posts.map(p => {
                const [q, h] = p.visual_text.split('|').map(s => s.trim());
                return (
                  <div 
                    key={p.id} 
                    onClick={() => setSelected(p)}
                    className="relative overflow-hidden rounded-[2.5rem] border border-zinc-200 bg-white p-10 cursor-pointer transition-all duration-500 hover:scale-[1.03] hover:-translate-y-2 shadow-sm hover:shadow-2xl group min-h-[22rem] flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-10">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 px-4 py-2 bg-zinc-50 border border-zinc-100 rounded-full">{p.category}</span>
                        <TrendingUp size={18} className="text-[#0477CF]" />
                      </div>
                      <div className="space-y-6">
                        <h3 className={`text-2xl lg:text-3xl font-bold font-heading text-zinc-900 leading-[1.15] tracking-tight group-hover:scale-[1.01] transition-transform duration-300 ${p.category.includes('Math') ? 'font-mono-math' : ''}`}>{q}</h3>
                        {h && <p className="text-lg font-bold text-red-600 leading-tight italic">{h}</p>}
                      </div>
                    </div>
                    <div className="pt-10 border-t border-zinc-100 flex justify-between items-center">
                      <span className="text-[10px] font-black tracking-[0.4em] text-[#0477CF] uppercase">Tap to reveal</span>
                      <Share2 size={20} className="text-zinc-300 group-hover:text-[#0477CF] transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <PostModal post={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);