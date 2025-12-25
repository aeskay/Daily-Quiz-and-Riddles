import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  RefreshCw, Flame, LayoutGrid, Menu, X, AlertCircle, 
  ChevronRight, TrendingUp, Sparkles, Share2, PlusCircle, 
  Send, Loader2, CheckCircle2, Info, Download, Image as ImageIcon,
  Zap, Binary, Globe, BookOpen, Film, Palette, Leaf, Brain
} from 'lucide-react';
import * as htmlToImage from 'html-to-image';

// --- TYPES ---
enum Category {
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
  { name: Category.LogicMath, icon: <Binary className="w-5 h-5" />, color: 'text-blue-600' },
  { name: Category.ScienceTech, icon: <Zap className="w-5 h-5" />, color: 'text-yellow-600' },
  { name: Category.GeneralKnowledge, icon: <Globe className="w-5 h-5" />, color: 'text-emerald-600' },
  { name: Category.LanguageLit, icon: <BookOpen className="w-5 h-5" />, color: 'text-purple-600' },
  { name: Category.PopCulture, icon: <Film className="w-5 h-5" />, color: 'text-pink-600' },
  { name: Category.TheArts, icon: <Palette className="w-5 h-5" />, color: 'text-orange-600' },
  { name: Category.NatureAnimals, icon: <Leaf className="w-5 h-5" />, color: 'text-green-600' },
  { name: Category.Psychology, icon: <Brain className="w-5 h-5" />, color: 'text-indigo-600' },
];

const SYSTEM_INSTRUCTIONS = `You are a Content Engine for a "Viral Quiz & Riddles" platform. Your task is to generate high-engagement, shareable content in a structured JSON format.

Engagement Strategy:
- Focus on "Controversial" logic: Challenges where 99% of people argue about the answer (e.g., BODMAS order of operations).
- Viral Hook Style: Use phrasing like "90% Fail this Math challenge" or "Only geniuses see the pattern".
- Literal Math Focus: Include fractions, BODMAS/PEMDAS, indices, percentages, and algebraic shortcuts.
- No corny riddles. Use "Aha!" moments and lateral thinking.

Categories Available: 
Logic & Math, Science & Tech, General Knowledge, Language & Literature, Pop Culture, The Arts, Nature & Animals, Psychology.

Output Requirements: Each response must be a JSON object containing:
- visual_text: Format this as "Question | Viral Hook". Example: "6 ÷ 2(1 + 2) = ? | 90% Fail this Math challenge!".
- read_more_content: A 2-3 sentence deep-dive or context. Explain WHY people get it wrong.
- answer: The clear, concise solution with a brief step-by-step logic.
- category: The specific category it falls under.
- style_hint: A 2-word aesthetic for image generation (e.g., 'Cyberpunk Neon', 'Minimalist Slate').`;

// --- SERVICES ---
const gemini = {
  fetchPosts: async (prompt: string): Promise<QuizPost[]> => {
    const ai = new GoogleGenAI({ apiKey: (window as any).process.env.API_KEY });
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

    const data = JSON.parse(response.text || "[]");
    return data.map((item: any, index: number) => ({ ...item, id: `${Date.now()}-${index}` }));
  },

  generateCustom: async (userRequest: string): Promise<QuizPost> => {
    const ai = new GoogleGenAI({ apiKey: (window as any).process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate 1 viral enigma based on: "${userRequest}"`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTIONS,
        responseMimeType: "application/json",
        responseSchema: {
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
    });
    return { ...JSON.parse(response.text || "{}"), id: `custom-${Date.now()}` };
  },

  generateImage: async (post: QuizPost): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: (window as any).process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `Abstract atmospheric background for ${post.category}. Style: ${post.style_hint}. Dark and professional.` }] },
      config: { imageConfig: { aspectRatio: "1:1" } },
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image");
  }
};

// --- COMPONENTS ---
const ThemeWrapper = ({ children, onClick }: { children: React.ReactNode, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-8 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 shadow-sm hover:shadow-xl group"
  >
    {children}
  </div>
);

const PostModal = ({ post, onClose }: { post: QuizPost | null, onClose: () => void }) => {
  const [generatingImage, setGeneratingImage] = useState(false);
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalImageUrl(post?.imageUrl || null); }, [post]);
  if (!post) return null;

  const handleGen = async () => {
    setGeneratingImage(true);
    try { setLocalImageUrl(await gemini.generateImage(post)); } catch (e) { console.error(e); } finally { setGeneratingImage(false); }
  };

  const handleDownload = async () => {
    if (!exportRef.current) return;
    const dataUrl = await htmlToImage.toPng(exportRef.current, { quality: 1.0, pixelRatio: 3, backgroundColor: '#ffffff' });
    const link = document.createElement('a');
    link.download = `DQR-${post.id}.png`; link.href = dataUrl; link.click();
  };

  const [question, hook] = post.visual_text.split('|').map(s => s.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 bg-zinc-950 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl h-[90vh] md:h-auto overflow-y-auto">
        <div className="p-8 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center justify-center">
          <div ref={exportRef} className="aspect-square w-full max-w-[360px] bg-white rounded-3xl overflow-hidden relative border border-zinc-200 shadow-2xl">
            {localImageUrl && <img src={localImageUrl} className="absolute inset-0 w-full h-full object-cover opacity-20" />}
            <div className="relative h-full p-8 flex flex-col justify-between text-zinc-900">
              <div className="flex justify-between items-start">
                <span className="px-3 py-1 bg-zinc-100 rounded-full text-[9px] font-black uppercase border border-zinc-200">{post.category}</span>
                <div className="px-2 py-1 bg-[#0477CF] text-white rounded font-black text-xs">DQ&R</div>
              </div>
              <div className="text-center space-y-4">
                <h3 className={`text-2xl font-bold font-heading text-black ${post.category.includes('Math') ? 'font-mono-math' : ''}`}>{question}</h3>
                {hook && <p className="text-lg font-bold text-red-600">{hook}</p>}
              </div>
              <div className="text-center"><p className="text-[10px] font-black tracking-widest uppercase text-[#0477CF]">Daily Quiz and Riddles</p></div>
            </div>
          </div>
          <div className="mt-6 flex gap-3 w-full max-w-[360px]">
            <button onClick={handleGen} disabled={generatingImage} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
              {generatingImage ? <Loader2 className="animate-spin" size={18} /> : <ImageIcon size={18} />} Graphics
            </button>
            <button onClick={handleDownload} className="bg-white hover:bg-zinc-200 text-black font-bold p-3 rounded-xl"><Download size={20} /></button>
          </div>
        </div>
        <div className="p-8 md:p-12 flex flex-col gap-8 bg-zinc-950">
          <div className="flex justify-between items-center"><h2 className="text-sm font-black text-zinc-500 uppercase">Enigma Details</h2><button onClick={onClose} className="p-2 text-zinc-500 hover:text-white"><X size={24} /></button></div>
          <div className="space-y-6">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6">
              <div className="flex items-center gap-2 text-emerald-400 font-black text-[10px] mb-4"><CheckCircle2 size={16} /> SOLUTION</div>
              <p className="text-emerald-50 text-xl font-bold">{post.answer}</p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-3xl p-6">
              <div className="flex items-center gap-2 text-blue-400 font-black text-[10px] mb-4"><Info size={16} /> THE LOGIC</div>
              <p className="text-zinc-300 leading-relaxed italic">{post.read_more_content}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-full bg-[#0477CF] hover:bg-blue-600 text-white font-bold py-5 rounded-2xl">DONE</button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---
const App = () => {
  const [posts, setPosts] = useState<QuizPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Today);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<QuizPost | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGeneratingCustom, setIsGeneratingCustom] = useState(false);

  const loadPosts = useCallback(async (mode: ViewMode, category: Category | null = null) => {
    if (mode === ViewMode.Generate) return;
    setLoading(true); setError(null);
    try {
      const prompt = category ? `Generate 10 viral posts for '${category}'` : "Generate 5 random viral engagement-bait posts.";
      setPosts(await gemini.fetchPosts(prompt));
    } catch (err) { setError('Failed to connect to engine.'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadPosts(ViewMode.Today); }, [loadPosts]);

  const handleCustom = async (e: React.FormEvent) => {
    e.preventDefault(); if (!customPrompt.trim()) return;
    setIsGeneratingCustom(true);
    try { const post = await gemini.generateCustom(customPrompt); setPosts([post, ...posts]); setSelectedPost(post); setCustomPrompt(''); }
    catch (e) { setError('Generation failed.'); } finally { setIsGeneratingCustom(false); }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#050505]">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800 bg-[#09090b] z-40">
        <div className="flex items-center gap-2"><div className="px-2 py-1 bg-[#0477CF] text-white rounded font-black text-xs">DQ&R</div><h1 className="text-lg font-bold text-white">DQ&R</h1></div>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-zinc-400"><Menu /></button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed inset-0 z-50 md:relative md:flex md:w-80 flex-col bg-[#09090b] border-r border-zinc-800 transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="hidden md:flex items-center gap-3 p-8 border-b border-zinc-900"><div className="px-3 py-1 bg-[#0477CF] text-white rounded-lg font-black text-xl">DQ&R</div><h1 className="text-xl font-black text-white">Daily Quiz <span className="text-zinc-500 font-light">& Riddles</span></h1></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-8">
          <div className="space-y-1">
            <h2 className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">ENGINE</h2>
            <button onClick={() => { setViewMode(ViewMode.Today); setSelectedCategory(null); loadPosts(ViewMode.Today); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium ${viewMode === ViewMode.Today && !selectedCategory ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-900'}`}><Flame size={20} /> Viral Daily</button>
            <button onClick={() => { setViewMode(ViewMode.Generate); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium ${viewMode === ViewMode.Generate ? 'bg-[#0477CF] text-white' : 'text-zinc-500 hover:bg-zinc-900'}`}><PlusCircle size={20} /> Create Custom</button>
          </div>
          <div className="space-y-1">
            <h2 className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">CHANNELS</h2>
            {CATEGORIES_CONFIG.map((cat) => (
              <button key={cat.name} onClick={() => { setSelectedCategory(cat.name); setViewMode(ViewMode.Browse); loadPosts(ViewMode.Browse, cat.name); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium ${selectedCategory === cat.name ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-900'}`}>
                <div className="flex items-center gap-3"><span className={cat.color}>{cat.icon}</span>{cat.name}</div><ChevronRight size={14} />
              </button>
            ))}
          </div>
        </div>
        {isSidebarOpen && <button onClick={() => setIsSidebarOpen(false)} className="md:hidden absolute top-4 right-4 text-zinc-500"><X /></button>}
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-h-screen">
        <header className="flex items-center justify-between p-6 md:p-10 border-b border-zinc-900/50">
          <div><h2 className="text-3xl md:text-4xl font-black font-heading text-white uppercase">{viewMode === ViewMode.Generate ? "Custom Lab" : (selectedCategory || "Viral Feed")}</h2><p className="text-zinc-500 text-sm">Optimized for high social engagement</p></div>
          {viewMode !== ViewMode.Generate && <button onClick={() => loadPosts(viewMode, selectedCategory)} disabled={loading} className="p-4 bg-zinc-900 text-white rounded-2xl border border-zinc-800"><RefreshCw size={24} className={loading ? 'animate-spin' : ''} /></button>}
        </header>
        <div className="flex-1 p-6 md:p-12 bg-zinc-950">
          {viewMode === ViewMode.Generate ? (
            <div className="max-w-2xl mx-auto space-y-12 py-10">
              <div className="text-center space-y-4"><div className="mx-auto w-16 h-16 bg-[#0477CF]/10 rounded-3xl flex items-center justify-center text-[#0477CF]"><PlusCircle size={32} /></div><h3 className="text-3xl font-black text-white">The AI Creator</h3><p className="text-zinc-500">Describe your enigma theme or math type.</p></div>
              <form onSubmit={handleCustom} className="space-y-4">
                <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="e.g. A tricky BODMAS problem..." className="w-full h-40 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-white outline-none resize-none text-lg" />
                <button disabled={isGeneratingCustom || !customPrompt.trim()} className="w-full bg-[#0477CF] text-white font-black py-5 rounded-3xl flex items-center justify-center gap-3">{isGeneratingCustom ? <Loader2 className="animate-spin" /> : <Send />} GENERATE</button>
              </form>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {loading ? [...Array(6)].map((_, i) => <div key={i} className="bg-zinc-900/50 rounded-[2rem] h-[22rem] animate-pulse" />) :
                posts.map((post) => {
                  const [q, h] = post.visual_text.split('|').map(s => s.trim());
                  return (
                    <ThemeWrapper key={post.id} onClick={() => setSelectedPost(post)}>
                      <div className="h-full flex flex-col justify-between min-h-[18rem]">
                        <div>
                          <div className="flex justify-between mb-8"><span className="text-[10px] font-black uppercase text-zinc-400 px-3 py-1 bg-zinc-100 rounded-full">{post.category}</span><TrendingUp size={14} className="text-[#0477CF]" /></div>
                          <div className="space-y-4"><h3 className={`text-2xl font-bold font-heading text-zinc-900 ${post.category.includes('Math') ? 'font-mono-math' : ''}`}>{q}</h3>{h && <p className="text-lg font-bold text-red-600">{h}</p>}</div>
                        </div>
                        <div className="pt-8 flex justify-between border-t border-zinc-100"><span className="text-[10px] font-black text-[#0477CF]">TAP TO REVEAL</span><Share2 size={16} className="text-[#0477CF] opacity-50" /></div>
                      </div>
                    </ThemeWrapper>
                  );
                })}
            </div>
          )}
        </div>
      </main>
      <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);