import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Flame, Menu, X, AlertCircle, TrendingUp, 
  Sparkles, Share2, PlusCircle, Send, Loader2, LayoutGrid, Trash2, 
  Archive, ArchiveRestore, Plus, Download, Upload, Database, Check,
  Settings as SettingsIcon, Image as ImageIcon
} from 'lucide-react';
import { QuizPost, Category, ViewMode } from './types';
import { fetchQuizPosts, Prompts, generateCustomEnigma } from './services/geminiService';
import { CATEGORIES_CONFIG } from './constants';
import ThemeWrapper from './components/ThemeWrapper';
import PostModal from './components/PostModal';
import SettingsModal from './components/SettingsModal';
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGeneratingCustom, setIsGeneratingCustom] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Semantic similarity checker to prevent rephrased identical puzzles
  const arePuzzlesSimilar = (text1: string, text2: string): boolean => {
    const stopWords = new Set([
      'you', 'have', 'imagine', 'suppose', 'there', 'are', 'in', 'a', 'an', 'the', 
      'is', 'it', 'its', 'to', 'and', 'of', 'for', 'with', 'that', 'this', 'how', 
      'many', 'what', 'which', 'who', 'why', 'can', 'will', 'would', 'do', 'does', 
      'did', 'completely', 'dark', 'identical', 'consider', 'say', 'one', 'two'
    ]);
    const getKeywords = (txt: string) => new Set(
      txt.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w))
    );
    const k1 = getKeywords(text1);
    const k2 = getKeywords(text2);
    if (k1.size === 0 || k2.size === 0) return false;
    let matches = 0;
    for (const w of k1) {
      if (k2.has(w)) matches++;
    }
    const similarity = matches / Math.min(k1.size, k2.size);
    return similarity >= 0.55; // 55% keyword overlap = duplicate riddle
  };

  // Initial DB Load with Auto-Deduplication
  useEffect(() => {
    const loadFromDB = async () => {
      try {
        const stored = await db.getAllPosts();
        
        // Clean out any duplicates sitting in the user's database
        const uniqueStored: QuizPost[] = [];
        const duplicateIdsToDelete: string[] = [];

        for (const post of stored) {
          const isDupe = uniqueStored.some(existing => arePuzzlesSimilar(existing.visual_text, post.visual_text));
          if (isDupe) {
            duplicateIdsToDelete.push(post.id);
          } else {
            uniqueStored.push(post);
          }
        }

        // Delete duplicates from IndexedDB
        for (const id of duplicateIdsToDelete) {
          await db.deletePostFromDB(id);
        }

        setAllPosts(uniqueStored);
        if (uniqueStored.length === 0) {
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
      const timer = setTimeout(() => setSuccessMsg(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  const handleLoadMore = async () => {
    setLoading(true);
    setError(null);
    try {
      // Build a list of recent titles and topics to forbid in the prompt
      const recentTitles = allPosts
        .slice(-30)
        .map(p => p.visual_text.split('|')[0].trim())
        .filter(Boolean);

      const prompt = selectedCategory
        ? Prompts.getCategory(selectedCategory, recentTitles)
        : Prompts.refresh(recentTitles);

      const newPosts = await fetchQuizPosts(prompt);

      // Semantic deduplication: reject if similar to ANY existing post
      const uniquePosts = newPosts.filter(newP => {
        const isDupe = allPosts.some(existing => arePuzzlesSimilar(existing.visual_text, newP.visual_text));
        return !isDupe;
      });

      const postsToSave = uniquePosts.map(p => ({ ...p, timestamp: Date.now(), status: 'active' as const }));

      if (postsToSave.length > 0) {
        await db.savePosts(postsToSave);
        setAllPosts(prev => [...prev, ...postsToSave]);
        setSuccessMsg(`Generated ${postsToSave.length} new unique posts (filtered repeats).`);
      } else {
        setSuccessMsg("Filtered repeats. Generating fresh topics...");
      }
    } catch (err: any) {
      console.error("Engine failure:", err);
      setError(err?.message || 'Generation failed. Check API key in Settings.');
    } finally {
      setLoading(false);
    }
  };

  const deletePost = async (id: string) => {
    try {
      await db.deletePostFromDB(id);
      setAllPosts(prev => prev.filter(p => p.id !== id));
      setSuccessMsg("Post deleted.");
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
      setSuccessMsg(updatedPost.status === 'archived' ? 'Post archived.' : 'Post restored to feed.');
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
      setSuccessMsg("Custom post generated successfully.");
    } catch (err: any) {
      setError(err?.message || 'Generation failed. Check your API key in Settings.');
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
        <div className="flex items-center gap-1">
          <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-zinc-400 hover:text-white"><SettingsIcon size={20} /></button>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-zinc-400 hover:text-white"><Menu size={22} /></button>
        </div>
      </div>

      <aside 
        className={`fixed top-0 left-0 bottom-0 z-50 w-full md:w-80 h-screen md:h-auto md:relative flex flex-col bg-[#09090b] border-r border-zinc-800 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="flex items-center justify-between p-6 border-b border-zinc-900 shrink-0 md:hidden">
           <div className="flex items-center gap-2">
            <div className="px-2 py-1 bg-[#0477CF] text-white rounded font-black text-xs">DQ&R</div>
            <span className="text-white font-bold tracking-widest text-[10px]">MENU</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-zinc-500 hover:text-white"><X size={24} /></button>
        </div>

        <div className="hidden md:flex items-center justify-between p-8 border-b border-zinc-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-[#0477CF] text-white rounded-lg font-black text-xl tracking-tighter">DQ&R</div>
            <h1 className="text-xl font-black font-heading tracking-tight leading-tight text-white">Daily Quiz <br/><span className="text-zinc-500 font-light">& Riddles</span></h1>
          </div>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
            title="API Settings"
          >
            <SettingsIcon size={19} />
          </button>
        </div>

        {/* Scrolling Menu */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-7 overscroll-contain scroll-smooth">
          <div className="space-y-1">
            <h2 className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Sparkles size={12} /> ENGINE</h2>
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
            <h2 className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2"><LayoutGrid size={12} /> CATEGORIES</h2>
            {CATEGORIES_CONFIG.map((cat) => (
              <button key={cat.name} onClick={() => handleCategorySelect(cat.name as Category)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all ${selectedCategory === cat.name && viewMode !== ViewMode.Archive ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                <div className="flex items-center gap-3"><span className={cat.color}>{cat.icon}</span>{cat.name}</div>
              </button>
            ))}
          </div>

          <div className="pt-6 border-t border-zinc-900 space-y-1">
            <h2 className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Database size={12} /> SYSTEM</h2>
            <button onClick={() => setIsSettingsOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:text-zinc-300 transition-all font-medium"><SettingsIcon size={18} /> API & Keys Settings</button>
            <button onClick={handleExport} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:text-zinc-300 transition-all font-medium"><Download size={18} /> Backup Database</button>
            <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:text-zinc-300 transition-all font-medium"><Upload size={18} /> Restore Database</button>
          </div>
          
          <div className="h-24" aria-hidden="true" />
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen">
        <header className="flex items-center justify-between p-6 md:p-10 bg-[#050505]/80 backdrop-blur-xl border-b border-zinc-900/50 sticky top-0 z-30">
          <div>
            <h2 className="text-3xl md:text-4xl font-black font-heading tracking-tight text-white uppercase">
              {viewMode === ViewMode.Generate ? "Custom Lab" : (viewMode === ViewMode.Archive ? "Archive" : (selectedCategory || "Quiz Feed"))}
            </h2>
            <p className="text-zinc-500 text-sm mt-1">
              {viewMode === ViewMode.Archive ? "Manage your archived posts" : "Generate, preview & export social media posts"}
            </p>
          </div>
          {viewMode !== ViewMode.Generate && viewMode !== ViewMode.Archive && (
            <button onClick={handleLoadMore} disabled={loading} className="px-6 py-3 bg-[#0477CF] hover:bg-blue-600 text-white rounded-2xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-xl font-bold">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
              GENERATE NEW
            </button>
          )}
        </header>

        <div className="flex-1 p-6 md:p-12 bg-zinc-950">
          <div className="max-w-7xl mx-auto">
            {/* Notification Area */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-2xl flex items-center justify-between text-red-400 mb-8 animate-in slide-in-from-top gap-4">
                <div className="flex items-center gap-3">
                  <AlertCircle size={22} className="shrink-0" />
                  <p className="font-medium text-sm">{error}</p>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(true)} 
                  className="px-3.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl text-xs font-bold shrink-0 transition-colors"
                >
                  Configure Key
                </button>
              </div>
            )}
            {successMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl flex items-center gap-3 text-emerald-400 mb-8 animate-in slide-in-from-top">
                <Check size={20} />
                <p className="font-medium text-sm">{successMsg}</p>
              </div>
            )}
            
            {viewMode === ViewMode.Generate ? (
              <div className="max-w-2xl mx-auto space-y-10 py-10">
                <div className="text-center space-y-3">
                   <div className="mx-auto w-16 h-16 bg-[#0477CF]/10 rounded-3xl flex items-center justify-center text-[#0477CF] mb-4"><PlusCircle size={32} /></div>
                   <h3 className="text-3xl font-black text-white font-heading">Custom Post Creator</h3>
                   <p className="text-zinc-500 text-sm">Specify a topic, riddle idea, or trivia question. It will be generated and saved.</p>
                </div>
                <form onSubmit={handleCustomGenerate} className="space-y-4">
                   <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="e.g. A riddle about torn book pages and math logic..." className="w-full h-40 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-white focus:ring-2 focus:ring-[#0477CF] outline-none resize-none text-base shadow-inner" />
                   <button disabled={isGeneratingCustom || !customPrompt.trim()} className="w-full bg-[#0477CF] hover:bg-blue-600 disabled:opacity-50 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 uppercase tracking-widest text-sm shadow-lg">{isGeneratingCustom ? <Loader2 className="animate-spin" /> : <Send size={18} />} GENERATE & DESIGN</button>
                </form>
              </div>
            ) : (
              <div className="pb-40">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredPosts.map((post) => {
                    const parts = post.visual_text.split('|').map(s => s.trim());
                    const context = parts.length > 1 ? parts[0] : null;
                    const question = parts.length > 1 ? parts[1] : parts[0];

                    return (
                      <div key={post.id} className="group relative">
                        <ThemeWrapper styleHint={post.style_hint} onClick={() => setSelectedPost(post)}>
                          <div className="h-full flex flex-col justify-between min-h-[16rem]">
                            <div>
                              <div className="flex justify-between items-start mb-4">
                                <span className="text-[10px] font-black uppercase tracking-wider text-[#0F4C81] px-2.5 py-1 bg-blue-50 rounded-lg border border-blue-100">
                                  {post.category}
                                </span>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                  {post.text_length || (parts.length > 1 ? 'medium' : 'short')}
                                </span>
                              </div>
                              <div className="space-y-2">
                                {context && (
                                  <p className="text-sm font-semibold text-[#0F4C81] line-clamp-3">
                                    {context}
                                  </p>
                                )}
                                <h3 className="text-lg font-bold font-heading text-[#D92D46] leading-snug line-clamp-2">
                                  {question}
                                </h3>
                              </div>
                            </div>

                            <div className="pt-4 flex items-center justify-between border-t border-zinc-100 mt-4">
                              <span className="text-[10px] font-black tracking-wider text-[#0477CF] uppercase flex items-center gap-1.5">
                                <ImageIcon size={13} /> Design & Export
                              </span>
                              <Share2 size={14} className="text-[#0477CF] opacity-40 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        </ThemeWrapper>

                        <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); toggleArchive(post); }} className={`p-2 rounded-xl shadow-lg text-white transition-all ${post.status === 'archived' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-zinc-800 hover:bg-zinc-700'}`} title={post.status === 'archived' ? 'Unarchive' : 'Archive'}>
                            {post.status === 'archived' ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deletePost(post.id); }} className="p-2 bg-red-500/80 hover:bg-red-600 text-white rounded-xl shadow-lg transition-all" title="Delete"><Trash2 size={15} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredPosts.length === 0 && !loading && (
                   <div className="text-center py-28 bg-zinc-900/30 rounded-3xl border border-zinc-800 border-dashed mt-6">
                      <Database className="mx-auto text-zinc-700 mb-4" size={48} />
                      <h3 className="text-xl font-bold text-zinc-400">Database Empty</h3>
                      <p className="text-zinc-500 text-sm mt-1 mb-6">No posts found in this section.</p>
                      <button onClick={handleLoadMore} className="bg-[#0477CF] hover:bg-blue-600 px-6 py-3 rounded-2xl text-white font-bold transition-all text-sm">Generate Initial Posts</button>
                   </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      {isSidebarOpen && <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />}
    </div>
  );
};

export default App;