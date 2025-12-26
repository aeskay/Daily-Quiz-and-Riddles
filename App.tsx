import React, { useState, useEffect, useCallback } from 'react';
import { 
  RefreshCw, Flame, Menu, X, AlertCircle, ChevronRight, TrendingUp, 
  Sparkles, Share2, PlusCircle, Send, Loader2, LayoutGrid
} from 'lucide-react';
import { QuizPost, Category, ViewMode } from './types';
import { fetchQuizPosts, Prompts, generateCustomEnigma } from './services/geminiService';
import { CATEGORIES_CONFIG } from './constants';
import ThemeWrapper from './components/ThemeWrapper';
import PostModal from './components/PostModal';

const App: React.FC = () => {
  const [posts, setPosts] = useState<QuizPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Today);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<QuizPost | null>(null);
  
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGeneratingCustom, setIsGeneratingCustom] = useState(false);

  const loadPosts = useCallback(async (mode: ViewMode, category: Category | null = null, isRefresh = false) => {
    if (mode === ViewMode.Generate) return;
    setLoading(true);
    setError(null);
    try {
      let prompt = '';
      
      // Context-aware prompt selection
      if (category) {
        prompt = Prompts.getCategory(category, isRefresh);
      } else if (mode === ViewMode.Today) {
        prompt = isRefresh ? Prompts.refresh() : Prompts.getToday();
      } else {
        prompt = Prompts.getToday();
      }

      const newPosts = await fetchQuizPosts(prompt);
      setPosts(newPosts);
    } catch (err) {
      console.error("Engine failure:", err);
      setError('Failed to ignite the engine. The AI might be busy or the connection was interrupted.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts(ViewMode.Today);
  }, [loadPosts]);

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    setViewMode(ViewMode.Browse);
    loadPosts(ViewMode.Browse, category);
    setIsSidebarOpen(false);
  };

  const handleRefresh = () => {
    loadPosts(viewMode, selectedCategory, true);
  };

  const handleCustomGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;

    setIsGeneratingCustom(true);
    setError(null);
    try {
      const post = await generateCustomEnigma(customPrompt);
      setPosts([post, ...posts]);
      setSelectedPost(post);
      setCustomPrompt('');
    } catch (err) {
      setError('Custom generation failed. Try a different description.');
    } finally {
      setIsGeneratingCustom(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#050505] overflow-x-hidden font-sans">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800 sticky top-0 bg-[#09090b] z-40">
        <div className="flex items-center gap-2">
          <div className="px-2 py-1 bg-[#0477CF] text-white rounded font-black text-xs tracking-tighter shadow-lg shadow-blue-500/20">DQ&R</div>
          <h1 className="text-lg font-bold font-heading text-white">DQ&R</h1>
        </div>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-zinc-400 hover:text-white"><Menu /></button>
      </div>

      <aside className={`fixed inset-0 z-50 md:relative md:flex md:w-80 flex-col bg-[#09090b] border-r border-zinc-800 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="md:hidden flex items-center justify-between p-6 border-b border-zinc-900">
           <div className="flex items-center gap-2">
            <div className="px-2 py-1 bg-[#0477CF] text-white rounded font-black text-xs tracking-tighter">DQ&R</div>
            <span className="text-white font-bold uppercase tracking-widest text-[10px]">MENU</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-zinc-500 hover:text-white transition-colors"><X size={24} /></button>
        </div>

        <div className="hidden md:flex items-center gap-3 p-8 border-b border-zinc-900">
          <div className="px-3 py-1 bg-[#0477CF] text-white rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 font-black text-xl tracking-tighter">DQ&R</div>
          <h1 className="text-xl font-black font-heading tracking-tight leading-tight text-white">Daily Quiz <br/><span className="text-zinc-500 font-light">& Riddles</span></h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8">
          <div className="space-y-1">
            <h2 className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Sparkles size={12} /> ENGINE</h2>
            <button onClick={() => { setViewMode(ViewMode.Today); setSelectedCategory(null); loadPosts(ViewMode.Today); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${viewMode === ViewMode.Today && !selectedCategory ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}><Flame size={20} /> Viral Daily</button>
            <button onClick={() => { setViewMode(ViewMode.Generate); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${viewMode === ViewMode.Generate ? 'bg-[#0477CF] text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}><PlusCircle size={20} /> Create Custom</button>
          </div>
          <div className="space-y-1">
            <h2 className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2"><LayoutGrid size={12} /> CHANNELS</h2>
            {CATEGORIES_CONFIG.map((cat) => (
              <button key={cat.name} onClick={() => handleCategorySelect(cat.name as Category)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all ${selectedCategory === cat.name ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}>
                <div className="flex items-center gap-3"><span className={cat.color}>{cat.icon}</span>{cat.name}</div>
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="flex items-center justify-between p-6 md:p-10 bg-[#050505]/80 backdrop-blur-xl border-b border-zinc-900/50">
          <div>
            <h2 className="text-3xl md:text-4xl font-black font-heading tracking-tight text-white uppercase">{viewMode === ViewMode.Generate ? "Custom Lab" : (selectedCategory || "Viral Feed")}</h2>
            <p className="text-zinc-500 text-sm mt-1">{viewMode === ViewMode.Generate ? "Design your own viral engagement hooks" : "Optimized for high social engagement"}</p>
          </div>
          {viewMode !== ViewMode.Generate && (
            <button onClick={handleRefresh} disabled={loading} className="p-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl border border-zinc-800 transition-all active:scale-95 disabled:opacity-50 shadow-xl group"><RefreshCw size={24} className={`${loading ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} /></button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-12 bg-zinc-950">
          <div className="max-w-7xl mx-auto">
            {error && <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl flex items-center gap-4 text-red-400 mb-8"><AlertCircle size={24} /><p className="font-medium">{error}</p></div>}
            
            {viewMode === ViewMode.Generate ? (
              <div className="max-w-2xl mx-auto space-y-12 py-10">
                <div className="text-center space-y-4">
                   <div className="mx-auto w-16 h-16 bg-[#0477CF]/10 rounded-3xl flex items-center justify-center text-[#0477CF] mb-4"><PlusCircle size={32} /></div>
                   <h3 className="text-3xl font-black text-white font-heading">The AI Creator</h3>
                   <p className="text-zinc-500">Describe what you want to generate. Be specific about the theme, difficulty, or math type.</p>
                </div>
                <form onSubmit={handleCustomGenerate} className="space-y-4">
                   <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="e.g. A tricky BODMAS problem involving negative numbers..." className="w-full h-40 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-white placeholder-zinc-700 focus:ring-2 focus:ring-[#0477CF] outline-none resize-none text-lg" />
                   <button disabled={isGeneratingCustom || !customPrompt.trim()} className="w-full bg-[#0477CF] hover:bg-blue-600 disabled:opacity-50 text-white font-black py-5 rounded-3xl flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95">{isGeneratingCustom ? <><Loader2 className="animate-spin" size={24} /><span>IGNITING...</span></> : <><Send size={24} /><span>GENERATE</span></>}</button>
                </form>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {loading ? [...Array(6)].map((_, i) => <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] h-[28rem] animate-pulse" />) : 
                posts.map((post) => {
                  const [question, hook] = post.visual_text.split('|').map(s => s.trim());
                  return (
                    <ThemeWrapper key={post.id} styleHint={post.style_hint} onClick={() => setSelectedPost(post)}>
                      <div className="h-full flex flex-col justify-between min-h-[22rem]">
                        <div>
                          <div className="flex justify-between items-start mb-8"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 px-3 py-1 bg-zinc-100 rounded-full border border-zinc-200">{post.category}</span><TrendingUp size={14} className="text-[#0477CF]" /></div>
                          <div className="space-y-4">
                            <h3 className={`text-2xl md:text-3xl font-bold font-heading leading-[1.2] text-zinc-900 ${post.category.includes('Math') ? 'font-mono-math' : ''}`}>{question}</h3>
                            {hook && <p className="text-base font-bold text-red-600">{hook}</p>}
                          </div>
                        </div>
                        <div className="pt-8 flex items-center justify-between border-t border-zinc-100"><span className="text-[10px] font-black tracking-widest text-[#0477CF]">TAP TO REVEAL</span><Share2 size={16} className="text-[#0477CF] opacity-50" /></div>
                      </div>
                    </ThemeWrapper>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />}
    </div>
  );
};

export default App;