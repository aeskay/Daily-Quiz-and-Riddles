import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  RefreshCw, Flame, Menu, X, AlertCircle, ChevronRight, TrendingUp, 
  Sparkles, Share2, PlusCircle, Send, Loader2, LayoutGrid, Trash2, 
  Archive, ArchiveRestore, Plus, Download, Upload, Database, Check
} from 'lucide-react';
import { QuizPost, Category, ViewMode } from './types';
import { fetchQuizPosts, Prompts, generateCustomEnigma } from './services/geminiService';
import { CATEGORIES_CONFIG } from './constants';
import ThemeWrapper from './components/ThemeWrapper';
import PostModal from './components/PostModal';
import * as db from './services/dbService';

const App: React.FC = () => {
  const [allPosts, setAllPosts] = useState<QuizPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Today);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<QuizPost | null>(null);
  
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGeneratingCustom, setIsGeneratingCustom] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial DB Load
  useEffect(() => {
    const loadFromDB = async () => {
      try {
        const stored = await db.getAllPosts();
        setAllPosts(stored);
        if (stored.length === 0) {
          handleLoadMore();
        }
      } catch (err) {
        console.error("DB Load Error", err);
      }
    };
    loadFromDB();
  }, []);

  // Show auto-fading success messages
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  const handleLoadMore = async () => {
    setLoading(true);
    setError(null);
    try {
      const prompt = selectedCategory 
        ? Prompts.getCategory(selectedCategory, true) 
        : Prompts.refresh();

      const newPosts = await fetchQuizPosts(prompt);
      const postsToSave: QuizPost[] = newPosts.map(p => ({ 
        ...p, 
        timestamp: Date.now(), 
        status: 'active' 
      }));
      
      await db.savePosts(postsToSave);
      setAllPosts(prev => [...prev, ...postsToSave]);
      setSuccessMsg(`Fetched ${postsToSave.length} new enigmas.`);
    } catch (err: any) {
      console.error("Engine failure:", err);
      setError(err?.message?.includes('429') 
        ? 'Rate limit hit. Using existing local database. Try again in a minute.' 
        : 'Engine stalled. Check connection.');
    } finally {
      setLoading(false);
    }
  };

  const deletePost = async (id: string) => {
    try {
      await db.deletePostFromDB(id);
      setAllPosts(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      setError("Failed to delete post from database.");
    }
  };

  const toggleArchive = async (post: QuizPost) => {
    const updatedPost: QuizPost = { 
      ...post, 
      status: post.status === 'active' ? 'archived' : 'active' 
    };
    try {
      await db.savePosts([updatedPost]);
      setAllPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));
    } catch (err) {
      setError("Failed to update post status.");
    }
  };

  const handleExport = async () => {
    try {
      const data = await db.exportDatabase();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `DQR-Backup-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      setSuccessMsg("Backup downloaded successfully.");
    } catch (err) {
      setError("Export failed.");
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        await db.importDatabase(content);
        const updated = await db.getAllPosts();
        setAllPosts(updated);
        setSuccessMsg("Database restored successfully.");
      } catch (err) {
        setError("Invalid backup file.");
      }
    };
    reader.readAsText(file);
  };

  const filteredPosts = useMemo(() => {
    let base = allPosts;
    if (viewMode === ViewMode.Archive) {
      base = allPosts.filter(p => p.status === 'archived');
    } else {
      base = allPosts.filter(p => p.status === 'active');
    }

    if (selectedCategory && viewMode !== ViewMode.Archive) {
      return base.filter(p => p.category === selectedCategory);
    }
    return base.sort((a, b) => b.timestamp - a.timestamp);
  }, [allPosts, viewMode, selectedCategory]);

  const stats = useMemo(() => ({
    active: allPosts.filter(p => p.status === 'active').length,
    archived: allPosts.filter(p => p.status === 'archived').length
  }), [allPosts]);

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    setViewMode(ViewMode.Browse);
    setIsSidebarOpen(false);
  };

  const handleCustomGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;
    setIsGeneratingCustom(true);
    setError(null);
    try {
      const post = await generateCustomEnigma(customPrompt);
      const postWithMeta: QuizPost = { ...post, timestamp: Date.now(), status: 'active' };
      await db.savePosts([postWithMeta]);
      setAllPosts(prev => [postWithMeta, ...prev]);
      setSelectedPost(postWithMeta);
      setCustomPrompt('');
      setViewMode(ViewMode.Today);
    } catch (err: any) {
      setError(err?.message?.includes('429') ? 'Rate limit hit.' : 'Generation failed.');
    } finally {
      setIsGeneratingCustom(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#050505] overflow-x-hidden font-sans">
      <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json" />

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800 sticky top-0 bg-[#09090b] z-40">
        <div className="flex items-center gap-2">
          <div className="px-2 py-1 bg-[#0477CF] text-white rounded font-black text-xs tracking-tighter">DQ&R</div>
          <h1 className="text-lg font-bold font-heading text-white">{viewMode === ViewMode.Archive ? "Archive" : (selectedCategory || "Viral Feed")}</h1>
        </div>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-zinc-400 hover:text-white"><Menu /></button>
      </div>

      <aside className={`fixed inset-0 z-50 h-screen md:h-auto overflow-hidden md:relative md:flex md:w-80 flex-col bg-[#09090b] border-r border-zinc-800 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex items-center justify-between p-6 border-b border-zinc-900 shrink-0 md:hidden">
           <div className="flex items-center gap-2">
            <div className="px-2 py-1 bg-[#0477CF] text-white rounded font-black text-xs">DQ&R</div>
            <span className="text-white font-bold tracking-widest text-[10px]">MENU</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-zinc-500 hover:text-white"><X size={24} /></button>
        </div>

        <div className="hidden md:flex items-center gap-3 p-8 border-b border-zinc-900 shrink-0">
          <div className="px-3 py-1 bg-[#0477CF] text-white rounded-lg font-black text-xl tracking-tighter">DQ&R</div>
          <h1 className="text-xl font-black font-heading tracking-tight leading-tight text-white">Daily Quiz <br/><span className="text-zinc-500 font-light">& Riddles</span></h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 overscroll-contain pb-20">
          <div className="space-y-1">
            <h2 className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Sparkles size={12} /> ENGINE</h2>
            <button onClick={() => { setViewMode(ViewMode.Today); setSelectedCategory(null); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all ${viewMode === ViewMode.Today && !selectedCategory ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <div className="flex items-center gap-3"><Flame size={20} /> Feed</div>
              <span className="text-[10px] font-bold opacity-50">{stats.active}</span>
            </button>
            <button onClick={() => { setViewMode(ViewMode.Archive); setSelectedCategory(null); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all ${viewMode === ViewMode.Archive ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <div className="flex items-center gap-3"><Archive size={20} /> Archive</div>
              <span className="text-[10px] font-bold opacity-50">{stats.archived}</span>
            </button>
            <button onClick={() => { setViewMode(ViewMode.Generate); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${viewMode === ViewMode.Generate ? 'bg-[#0477CF] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><PlusCircle size={20} /> Create Custom</button>
          </div>

          <div className="space-y-1">
            <h2 className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2"><LayoutGrid size={12} /> CHANNELS</h2>
            {CATEGORIES_CONFIG.map((cat) => (
              <button key={cat.name} onClick={() => handleCategorySelect(cat.name as Category)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all ${selectedCategory === cat.name && viewMode !== ViewMode.Archive ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                <div className="flex items-center gap-3"><span className={cat.color}>{cat.icon}</span>{cat.name}</div>
              </button>
            ))}
          </div>

          <div className="pt-8 border-t border-zinc-900 space-y-1 pb-10">
            <h2 className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Database size={12} /> DATABASE</h2>
            <button onClick={handleExport} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:text-zinc-300 transition-all font-medium"><Download size={18} /> Backup JSON</button>
            <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:text-zinc-300 transition-all font-medium"><Upload size={18} /> Restore from File</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen">
        <header className="flex items-center justify-between p-6 md:p-10 bg-[#050505]/80 backdrop-blur-xl border-b border-zinc-900/50 sticky top-0 z-30">
          <div>
            <h2 className="text-3xl md:text-4xl font-black font-heading tracking-tight text-white uppercase">
              {viewMode === ViewMode.Generate ? "Custom Lab" : (viewMode === ViewMode.Archive ? "Archive" : (selectedCategory || "Viral Feed"))}
            </h2>
            <p className="text-zinc-500 text-sm mt-1">
              {viewMode === ViewMode.Archive ? "Manage your history" : "AI-Powered engagement hooks"}
            </p>
          </div>
          {viewMode !== ViewMode.Generate && viewMode !== ViewMode.Archive && (
            <button onClick={handleLoadMore} disabled={loading} className="px-6 py-3 bg-[#0477CF] hover:bg-blue-600 text-white rounded-2xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-xl font-bold">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
              LOAD MORE
            </button>
          )}
        </header>

        <div className="flex-1 p-6 md:p-12 bg-zinc-950">
          <div className="max-w-7xl mx-auto">
            {/* Notification Area */}
            {error && <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl flex items-center gap-4 text-red-400 mb-8 animate-in slide-in-from-top"><AlertCircle size={24} /><p className="font-medium">{error}</p></div>}
            {successMsg && <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-2xl flex items-center gap-4 text-emerald-400 mb-8 animate-in slide-in-from-top"><Check size={24} /><p className="font-medium">{successMsg}</p></div>}
            
            {viewMode === ViewMode.Generate ? (
              <div className="max-w-2xl mx-auto space-y-12 py-10">
                <div className="text-center space-y-4">
                   <div className="mx-auto w-16 h-16 bg-[#0477CF]/10 rounded-3xl flex items-center justify-center text-[#0477CF] mb-4"><PlusCircle size={32} /></div>
                   <h3 className="text-3xl font-black text-white font-heading">The AI Creator</h3>
                   <p className="text-zinc-500">Specify exactly what you want to generate. It will be saved to your database.</p>
                </div>
                <form onSubmit={handleCustomGenerate} className="space-y-4">
                   <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="e.g. A riddle about the internet..." className="w-full h-40 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-white focus:ring-2 focus:ring-[#0477CF] outline-none resize-none text-lg shadow-inner" />
                   <button disabled={isGeneratingCustom || !customPrompt.trim()} className="w-full bg-[#0477CF] hover:bg-blue-600 disabled:opacity-50 text-white font-black py-5 rounded-3xl flex items-center justify-center gap-3 transition-all active:scale-95 uppercase tracking-widest">{isGeneratingCustom ? <Loader2 className="animate-spin" /> : <Send />} GENERATE & SAVE</button>
                </form>
              </div>
            ) : (
              <div className="pb-40">
                {/* 
                  Enhanced Grid Layout: 
                  - Increased gap-y-40 for major vertical breathing room between rows
                  - Explicit gap-x-12 for horizontal spacing 
                */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-40">
                  {filteredPosts.map((post) => {
                    const [question, hook] = post.visual_text.split('|').map(s => s.trim());
                    return (
                      <div key={post.id} className="group relative">
                        <ThemeWrapper styleHint={post.style_hint} onClick={() => setSelectedPost(post)}>
                          <div className="h-full flex flex-col justify-between min-h-[18rem]">
                            <div>
                              <div className="flex justify-between items-start mb-6">
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 px-2 py-1 bg-zinc-100 rounded-md border border-zinc-200">{post.category}</span>
                                <TrendingUp size={14} className="text-[#0477CF] opacity-30" />
                              </div>
                              <div className="space-y-2">
                                <h3 className={`text-xl font-bold font-heading leading-tight text-zinc-900 ${post.category.includes('Math') ? 'font-mono-math' : ''}`}>{question}</h3>
                                {hook && <p className="text-xs font-bold text-red-600 uppercase tracking-tighter">{hook}</p>}
                              </div>
                            </div>
                            <div className="pt-6 flex items-center justify-between border-t border-zinc-100">
                              <span className="text-[9px] font-black tracking-widest text-[#0477CF] uppercase">Review Case</span>
                              <Share2 size={14} className="text-[#0477CF] opacity-40" />
                            </div>
                          </div>
                        </ThemeWrapper>

                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); toggleArchive(post); }} className={`p-2 rounded-lg shadow-xl text-white transition-all ${post.status === 'archived' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-zinc-800 hover:bg-zinc-700'}`} title={post.status === 'archived' ? 'Unarchive' : 'Archive'}>
                            {post.status === 'archived' ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deletePost(post.id); }} className="p-2 bg-red-500/80 hover:bg-red-600 text-white rounded-lg shadow-xl transition-all" title="Delete"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredPosts.length === 0 && !loading && (
                   <div className="text-center py-32 bg-zinc-900/20 rounded-[3rem] border border-zinc-800 border-dashed mt-10">
                      <Database className="mx-auto text-zinc-800 mb-6" size={64} />
                      <h3 className="text-2xl font-bold text-zinc-500">Database Empty</h3>
                      <p className="text-zinc-600 mt-2 mb-8">No enigmas found in this section.</p>
                      <button onClick={handleLoadMore} className="bg-zinc-800 hover:bg-zinc-700 px-8 py-4 rounded-2xl text-white font-bold transition-all active:scale-95">Fetch Initial Content</button>
                   </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      {isSidebarOpen && <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />}
    </div>
  );
};

export default App;