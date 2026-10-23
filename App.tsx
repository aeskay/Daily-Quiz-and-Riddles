import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Flame, Menu, X, AlertCircle, TrendingUp, 
  Sparkles, Share2, PlusCircle, Send, Loader2, LayoutGrid, Trash2, 
  Archive, ArchiveRestore, Plus, Download, Upload, Database, Check,
  Settings as SettingsIcon, Image as ImageIcon, LogIn, LogOut, User as UserIcon,
  Clock, Globe
} from 'lucide-react';
import { QuizPost, Category, ViewMode } from './types';
import { fetchQuizPosts, Prompts, generateCustomEnigma } from './services/geminiService';
import { fetchRealHumanContent } from './services/humanTriviaService';
import { CATEGORIES_CONFIG } from './constants';
import ThemeWrapper from './components/ThemeWrapper';
import PostModal from './components/PostModal';
import SettingsModal from './components/SettingsModal';
import { doc, setDoc } from 'firebase/firestore';
import { auth, firestore, loginWithGoogle, logoutUser, onAuthStateChanged, User } from './services/firebase';
import { 
  subscribeToUserPosts, 
  saveUserPosts, 
  deleteUserPost, 
  updateUserPost,
  clearAllUserPosts
} from './services/firestoreService';
import * as db from './services/dbService';
import { 
  getLocalSocialConfig, 
  getQueuedScheduleInfo, 
  formatPostedDate, 
  unqueuePost, 
  realignQueuedPosts 
} from './services/socialService';
import { dispatchPostDirectly, parseWyr, stripHookFromQuestion } from './services/socialDirectService';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [allPosts, setAllPosts] = useState<QuizPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Today);
  const [queueSubTab, setQueueSubTab] = useState<'queued' | 'posted'>('queued');
  const [socialConfig, setSocialConfig] = useState(getLocalSocialConfig());
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<QuizPost | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGeneratingCustom, setIsGeneratingCustom] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mobile/PWA Back Navigation & Double-Back Exit
  const [showExitToast, setShowExitToast] = useState(false);
  const lastBackPressRef = useRef<number>(0);
  const selectedPostRef = useRef(selectedPost);
  const isSettingsOpenRef = useRef(isSettingsOpen);
  const isSidebarOpenRef = useRef(isSidebarOpen);
  const viewModeRef = useRef(viewMode);
  const selectedCategoryRef = useRef(selectedCategory);

  selectedPostRef.current = selectedPost;
  isSettingsOpenRef.current = isSettingsOpen;
  isSidebarOpenRef.current = isSidebarOpen;
  viewModeRef.current = viewMode;
  selectedCategoryRef.current = selectedCategory;

  // Auto-hide the double-back exit toast after 2 seconds
  useEffect(() => {
    if (showExitToast) {
      const timer = setTimeout(() => setShowExitToast(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showExitToast]);

  // Mobile/PWA Back Button navigation handling
  useEffect(() => {
    // Set initial baseline history state
    window.history.replaceState({ app: 'dqr', step: 1 }, '');
    window.history.pushState({ app: 'dqr', step: 2 }, '');

    const handlePopState = () => {
      // 1. If PostModal is open, close it
      if (selectedPostRef.current) {
        setSelectedPost(null);
        window.history.pushState({ app: 'dqr', step: 2 }, '');
        return;
      }

      // 2. If SettingsModal is open, close it
      if (isSettingsOpenRef.current) {
        setIsSettingsOpen(false);
        window.history.pushState({ app: 'dqr', step: 2 }, '');
        return;
      }

      // 3. If mobile sidebar drawer is open, close it
      if (isSidebarOpenRef.current) {
        setIsSidebarOpen(false);
        window.history.pushState({ app: 'dqr', step: 2 }, '');
        return;
      }

      // 4. If in another view (Queue, Archive, Generate) or category filter active, return to feeds
      if (viewModeRef.current !== ViewMode.Today || selectedCategoryRef.current !== null) {
        setViewMode(ViewMode.Today);
        setSelectedCategory(null);
        setQueueSubTab('queued');
        window.history.pushState({ app: 'dqr', step: 2 }, '');
        return;
      }

      // 5. Already on main Feed: Double-back to exit mechanism
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        // Second back press within 2s: allow app to exit
        window.history.back();
      } else {
        lastBackPressRef.current = now;
        setShowExitToast(true);
        window.history.pushState({ app: 'dqr', step: 2 }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 1. Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (user) {
        try {
          await setDoc(doc(firestore, "users", user.uid), {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            lastLogin: Date.now(),
          }, { merge: true });
        } catch (e) {
          console.warn("User root sync warning:", e);
        }
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // 2. Real-time Cloud Firestore synchronization when user is logged in
  useEffect(() => {
    if (!currentUser) {
      setAllPosts([]);
      return;
    }

    setLoading(true);
    const unsubscribePosts = subscribeToUserPosts(
      currentUser.uid,
      (cloudPosts) => {
        setAllPosts(cloudPosts);
        setLoading(false);
      },
      (err) => {
        console.error("Firestore error:", err);
        setError("Cloud sync failed. Make sure your Firestore rules are published.");
        setLoading(false);
      }
    );

    return () => unsubscribePosts();
  }, [currentUser]);

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
    return similarity >= 0.55;
  };

  // Show auto-fading success messages
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Refresh social config when settings closes
  useEffect(() => {
    if (!isSettingsOpen) {
      setSocialConfig(getLocalSocialConfig());
    }
  }, [isSettingsOpen]);

  const handleSignIn = async () => {
    setError(null);
    try {
      await loginWithGoogle();
      setSuccessMsg("Signed in successfully. Syncing your posts...");
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err?.message || "Google sign-in failed.");
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutUser();
      setSuccessMsg("Signed out.");
    } catch (err: any) {
      setError("Sign out failed.");
    }
  };

  const handleLoadMore = async (mode: 'human' | 'ai' = 'human') => {
    if (!currentUser) {
      setError("Please sign in with Google to generate and save posts to your account.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let newPosts: QuizPost[] = [];

      if (mode === 'human') {
        newPosts = await fetchRealHumanContent(selectedCategory, 8);
      } else {
        const recentTitles = allPosts
          .slice(-30)
          .map(p => p.visual_text.split('|')[0].trim())
          .filter(Boolean);

        const prompt = selectedCategory
          ? Prompts.getCategory(selectedCategory, recentTitles)
          : Prompts.refresh(recentTitles);

        newPosts = await fetchQuizPosts(prompt);
      }

      // Semantic deduplication
      const uniquePosts = newPosts.filter(newP => {
        const isDupe = allPosts.some(existing => arePuzzlesSimilar(existing.visual_text, newP.visual_text));
        return !isDupe;
      });

      const postsToSave: QuizPost[] = uniquePosts.map(p => ({ 
        ...p, 
        timestamp: Date.now(), 
        status: 'active' as const,
        userId: currentUser.uid,
      }));

      if (postsToSave.length > 0) {
        await saveUserPosts(currentUser.uid, postsToSave);
        setSuccessMsg(
          mode === 'human'
            ? `Added ${postsToSave.length} authentic human questions from online trivia & community riddles!`
            : `Generated ${postsToSave.length} viral social media posts!`
        );
      } else {
        setSuccessMsg("Filtered repeats. Generating fresh topics...");
      }
    } catch (err: any) {
      console.error("Content fetch failure:", err);
      setError(err?.message || 'Failed to retrieve posts. Check settings.');
    } finally {
      setLoading(false);
    }
  };

  const deletePost = async (id: string) => {
    if (!currentUser) return;
    try {
      await deleteUserPost(currentUser.uid, id);
      setSuccessMsg("Post deleted.");
    } catch (err) {
      setError("Failed to delete post from cloud.");
    }
  };

  const toggleArchive = async (post: QuizPost) => {
    if (!currentUser) return;
    const updatedPost: QuizPost = { 
      ...post, 
      status: post.status === 'active' ? 'archived' : 'active' 
    };
    try {
      await updateUserPost(currentUser.uid, updatedPost);
      setSuccessMsg(updatedPost.status === 'archived' ? 'Post archived.' : 'Post restored to feed.');
    } catch (err) {
      setError("Failed to update post status.");
    }
  };

  const handleUnqueue = async (post: QuizPost) => {
    if (!currentUser) return;
    try {
      const updated = await unqueuePost(currentUser.uid, post);
      setAllPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
      setSuccessMsg("Removed post from autopost queue.");
    } catch (err: any) {
      setError("Failed to remove post from queue: " + (err?.message || err));
    }
  };

  const [isRealigning, setIsRealigning] = useState(false);
  const hasQueueCollision = useMemo(() => {
    const queued = allPosts.filter(p => p.scheduleStatus === 'queued' && p.scheduledTime);
    const times = new Set<string>();
    for (const p of queued) {
      const t = new Date(p.scheduledTime!).getTime();
      const slotKey = Math.round(t / (15 * 60 * 1000));
      if (times.has(String(slotKey))) return true;
      times.add(String(slotKey));
    }
    return false;
  }, [allPosts]);

  const handleRealignQueue = async () => {
    if (!currentUser) return;
    setIsRealigning(true);
    try {
      const queued = allPosts.filter(p => p.scheduleStatus === 'queued');
      const updated = await realignQueuedPosts(currentUser.uid, socialConfig.scheduleTimes, queued);
      setSuccessMsg("Autopost queue re-aligned with unique schedule times!");
    } catch (err: any) {
      setError("Failed to re-align queue: " + (err?.message || err));
    } finally {
      setIsRealigning(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = JSON.stringify(allPosts, null, 2);
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
    if (!file || !currentUser) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content) as QuizPost[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const withUser = parsed.map(p => ({ ...p, userId: currentUser.uid }));
          await saveUserPosts(currentUser.uid, withUser);
          setSuccessMsg(`Imported ${parsed.length} posts to your cloud account.`);
        }
      } catch (err) {
        setError("Invalid backup file.");
      }
    };
    reader.readAsText(file);
  };

  const handleWipeAllPosts = async () => {
    if (!currentUser) return;
    const confirmed = window.confirm(
      "Are you sure you want to delete ALL posts from Cloud Firestore and local storage? This will clear out old/broken posts so you can start fresh."
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await clearAllUserPosts(currentUser.uid);
      await db.clearAllLocalPosts();
      setAllPosts([]);
      setSuccessMsg("All posts wiped from Cloud Firestore and local storage. Click 'GENERATE NEW' to create fresh posts!");
    } catch (err: any) {
      console.error("Wipe failed:", err);
      setError("Failed to wipe posts: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const filteredPosts = useMemo(() => {
    let base = allPosts;
    if (viewMode === ViewMode.Archive) {
      base = allPosts.filter(p => p.status === 'archived');
    } else if (viewMode === ViewMode.Queue) {
      if (queueSubTab === 'queued') {
        base = allPosts.filter(p => p.scheduleStatus === 'queued');
        // Sort queued posts chronologically by when they are scheduled to post
        return [...base].sort((a, b) => {
          const timeA = a.scheduledTime ? new Date(a.scheduledTime).getTime() : (a.timestamp || 0);
          const timeB = b.scheduledTime ? new Date(b.scheduledTime).getTime() : (b.timestamp || 0);
          return timeA - timeB;
        });
      } else {
        base = allPosts.filter(p => p.scheduleStatus === 'posted');
        // Sort posted posts with most recently posted first
        return [...base].sort((a, b) => (b.postedAt || b.timestamp || 0) - (a.postedAt || a.timestamp || 0));
      }
    } else {
      base = allPosts.filter(p => p.status === 'active');
    }

    if (selectedCategory && viewMode !== ViewMode.Archive && viewMode !== ViewMode.Queue) {
      return base.filter(p => p.category === selectedCategory);
    }
    return base.sort((a, b) => b.timestamp - a.timestamp);
  }, [allPosts, viewMode, selectedCategory, queueSubTab]);

  const stats = useMemo(() => ({
    active: allPosts.filter(p => p.status === 'active').length,
    archived: allPosts.filter(p => p.status === 'archived').length,
    queued: allPosts.filter(p => p.scheduleStatus === 'queued').length,
    posted: allPosts.filter(p => p.scheduleStatus === 'posted').length,
  }), [allPosts]);

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    setViewMode(ViewMode.Browse);
    setIsSidebarOpen(false);
  };

  const handleCustomGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;
    if (!currentUser) {
      setError("Please sign in with Google to create custom posts.");
      return;
    }
    setIsGeneratingCustom(true);
    setError(null);
    try {
      const post = await generateCustomEnigma(customPrompt);
      const postWithMeta: QuizPost = { 
        ...post, 
        timestamp: Date.now(), 
        status: 'active',
        userId: currentUser.uid,
      };
      await saveUserPosts(currentUser.uid, [postWithMeta]);
      setSelectedPost(postWithMeta);
      setCustomPrompt('');
      setViewMode(ViewMode.Today);
      setSuccessMsg("Custom post generated and saved to your cloud.");
    } catch (err: any) {
      setError(err?.message || 'Generation failed. Check your API key in Settings.');
    } finally {
      setIsGeneratingCustom(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#050505] overflow-x-hidden font-sans">
      <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json" />

      {/* Mobile Header Bar */}
      <div className="md:hidden flex items-center justify-between px-3.5 py-3 border-b border-zinc-800 sticky top-0 bg-[#09090b] z-40">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="px-2 py-0.5 bg-[#0477CF] text-white rounded font-black text-xs tracking-tighter shrink-0">DQ&R</div>
          <h1 className="text-sm font-bold font-heading text-white truncate max-w-[170px] sm:max-w-xs">
            {viewMode === ViewMode.Archive 
              ? "Archive" 
              : viewMode === ViewMode.Queue 
              ? (queueSubTab === 'queued' ? "Queue: In Queue" : "Queue: Posted") 
              : viewMode === ViewMode.Generate 
              ? "Custom Lab" 
              : (selectedCategory || "Viral Feed")}
          </h1>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {currentUser ? (
            <button onClick={handleSignOut} className="p-1.5 text-zinc-400 hover:text-white rounded-lg text-xs flex items-center gap-1" title="Sign Out">
              <LogOut size={16} />
            </button>
          ) : (
            <button onClick={handleSignIn} className="px-2.5 py-1 bg-[#0477CF] text-white rounded-lg text-xs font-bold flex items-center gap-1">
              <LogIn size={13} /> Sign In
            </button>
          )}
          <button onClick={() => setIsSettingsOpen(true)} className="p-1.5 text-zinc-400 hover:text-white" title="Settings"><SettingsIcon size={18} /></button>
          <button onClick={() => setIsSidebarOpen(true)} className="p-1.5 text-zinc-400 hover:text-white" title="Menu"><Menu size={22} /></button>
        </div>
      </div>

      {/* Sidebar */}
      <aside 
        className={`fixed top-0 left-0 bottom-0 z-50 w-full md:w-80 h-screen md:h-auto md:relative flex flex-col bg-[#09090b] border-r border-zinc-800 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-zinc-900 shrink-0 md:hidden">
           <div className="flex items-center gap-2">
            <div className="px-2 py-1 bg-[#0477CF] text-white rounded font-black text-xs">DQ&R</div>
            <span className="text-white font-bold tracking-widest text-[10px]">MENU</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-zinc-500 hover:text-white"><X size={22} /></button>
        </div>

        <div className="hidden md:flex items-center justify-between p-6 lg:p-7 border-b border-zinc-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-[#0477CF] text-white rounded-lg font-black text-xl tracking-tighter">DQ&R</div>
            <h1 className="text-lg lg:text-xl font-black font-heading tracking-tight leading-tight text-white">Daily Quiz <br/><span className="text-zinc-500 font-light">& Riddles</span></h1>
          </div>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
            title="API Settings"
          >
            <SettingsIcon size={19} />
          </button>
        </div>

        {/* User Account Bar */}
        <div className="p-3.5 sm:p-4 border-b border-zinc-900 bg-zinc-950/60">
          {currentUser ? (
            <div className="flex items-center justify-between gap-3 bg-zinc-900/80 p-2.5 sm:p-3 rounded-2xl border border-zinc-800">
              <div className="flex items-center gap-2.5 overflow-hidden">
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="" className="w-8 h-8 rounded-full border border-zinc-700 object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#0477CF]/20 text-[#0477CF] flex items-center justify-center font-bold text-xs shrink-0">
                    <UserIcon size={15} />
                  </div>
                )}
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs font-bold text-white truncate">{currentUser.displayName || 'Creator'}</span>
                  <span className="text-[10px] text-zinc-400 truncate">{currentUser.email}</span>
                </div>
              </div>
              <button 
                onClick={handleSignOut} 
                className="p-2 text-zinc-400 hover:text-red-400 rounded-xl hover:bg-zinc-800 transition-colors shrink-0"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              className="w-full py-2.5 sm:py-3 px-4 bg-[#0477CF] hover:bg-blue-600 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
            >
              <LogIn size={15} /> Sign In with Google
            </button>
          )}
        </div>

        {/* Scrolling Menu */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 overscroll-contain scroll-smooth">
          <div className="space-y-1">
            <h2 className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2.5 flex items-center gap-2"><Sparkles size={12} /> ENGINE</h2>
            <button onClick={() => { setViewMode(ViewMode.Today); setSelectedCategory(null); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl font-medium transition-all ${viewMode === ViewMode.Today && !selectedCategory ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <div className="flex items-center gap-3"><Flame size={18} /> Feed</div>
              <span className="text-[10px] font-bold opacity-50">{stats.active}</span>
            </button>
            <button onClick={() => { setViewMode(ViewMode.Queue); setSelectedCategory(null); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl font-medium transition-all ${viewMode === ViewMode.Queue ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <div className="flex items-center gap-3"><Clock size={18} /> Autopost Queue</div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">{stats.queued}</span>
            </button>
            <button onClick={() => { setViewMode(ViewMode.Archive); setSelectedCategory(null); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl font-medium transition-all ${viewMode === ViewMode.Archive ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <div className="flex items-center gap-3"><Archive size={18} /> Archive</div>
              <span className="text-[10px] font-bold opacity-50">{stats.archived}</span>
            </button>
            <button onClick={() => { setViewMode(ViewMode.Generate); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl font-medium transition-all ${viewMode === ViewMode.Generate ? 'bg-[#0477CF] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><PlusCircle size={18} /> Create Custom</button>
          </div>

          <div className="space-y-1">
            <h2 className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2.5 flex items-center gap-2"><LayoutGrid size={12} /> CATEGORIES</h2>
            {CATEGORIES_CONFIG.map((cat) => (
              <button key={cat.name} onClick={() => handleCategorySelect(cat.name as Category)} className={`w-full flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl font-medium transition-all ${selectedCategory === cat.name && viewMode !== ViewMode.Archive && viewMode !== ViewMode.Queue ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                <div className="flex items-center gap-3"><span className={cat.color}>{cat.icon}</span>{cat.name}</div>
              </button>
            ))}
          </div>

          <div className="pt-5 border-t border-zinc-900 space-y-1">
            <h2 className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2.5 flex items-center gap-2"><Database size={12} /> CLOUD & DATA</h2>
            <button onClick={() => setIsSettingsOpen(true)} className="w-full flex items-center gap-3 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl text-zinc-500 hover:text-zinc-300 transition-all font-medium text-xs sm:text-sm"><SettingsIcon size={17} /> API & Keys Settings</button>
            <button onClick={handleExport} className="w-full flex items-center gap-3 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl text-zinc-500 hover:text-zinc-300 transition-all font-medium text-xs sm:text-sm"><Download size={17} /> Backup Database JSON</button>
            <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl text-zinc-500 hover:text-zinc-300 transition-all font-medium text-xs sm:text-sm"><Upload size={17} /> Restore from File</button>
            {currentUser && (
              <button 
                onClick={handleWipeAllPosts} 
                className="w-full flex items-center gap-3 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all font-medium text-xs mt-2"
                title="Wipe all posts from Firestore and local device storage"
              >
                <Trash2 size={17} /> Wipe All Posts (Reset)
              </button>
            )}
          </div>

          <div className="h-20" aria-hidden="true" />
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-6 md:px-10 md:py-8 bg-[#050505]/90 backdrop-blur-xl border-b border-zinc-900/60 static md:sticky md:top-0 z-30">
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-heading tracking-tight text-white uppercase">
              {viewMode === ViewMode.Generate ? "Custom Lab" : (viewMode === ViewMode.Archive ? "Archive" : (viewMode === ViewMode.Queue ? "Autopost Queue" : (selectedCategory || "Quiz Feed")))}
            </h2>

            <p className="text-zinc-400 text-xs sm:text-sm mt-0.5">
              {viewMode === ViewMode.Queue 
                ? "Manage upcoming scheduled posts and view publication history"
                : viewMode === ViewMode.Archive 
                ? "Saved and archived posts collection"
                : viewMode === ViewMode.Generate 
                ? "AI-powered custom riddle and quiz generator"
                : (selectedCategory ? `${selectedCategory} questions & riddles` : "Curated trivia & viral riddles ready to share")}
            </p>
          </div>

          {/* Autopost Queue Tabs vs Feed Content Buttons */}
          {viewMode === ViewMode.Queue ? (
            <div className="flex items-center gap-1.5 bg-zinc-900/90 p-1.5 rounded-2xl border border-zinc-800 self-stretch sm:self-auto">
              <button
                type="button"
                onClick={() => setQueueSubTab('queued')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  queueSubTab === 'queued'
                    ? 'bg-[#0477CF] text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Clock size={15} />
                <span>In Queue</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  queueSubTab === 'queued' ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {stats.queued}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setQueueSubTab('posted')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  queueSubTab === 'posted'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Check size={15} />
                <span>Posted</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  queueSubTab === 'posted' ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {stats.posted}
                </span>
              </button>
            </div>
          ) : (
            viewMode !== ViewMode.Generate && viewMode !== ViewMode.Archive && (
              <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                <button 
                  onClick={() => handleLoadMore('human')} 
                  disabled={loading} 
                  className="flex-1 sm:flex-none px-3.5 py-2 sm:px-4 sm:py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl sm:rounded-2xl flex items-center justify-center gap-1.5 sm:gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-md font-bold text-xs sm:text-sm tracking-wide"
                  title="Fetch real human-written questions from online trivia & community riddles"
                >
                  {loading ? <Loader2 className="animate-spin" size={15} /> : <Globe size={15} />}
                  <span>REAL HUMAN QUESTIONS</span>
                </button>

                <button 
                  onClick={() => handleLoadMore('ai')} 
                  disabled={loading} 
                  className="flex-1 sm:flex-none px-3.5 py-2 sm:px-4 sm:py-2.5 bg-[#0477CF] hover:bg-blue-600 text-white rounded-xl sm:rounded-2xl flex items-center justify-center gap-1.5 sm:gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-md font-bold text-xs sm:text-sm tracking-wide"
                  title="Generate viral social media posts using high-engagement audience-tested prompts"
                >
                  {loading ? <Loader2 className="animate-spin" size={15} /> : <Sparkles size={15} />}
                  <span>VIRAL AI GENERATOR</span>
                </button>
              </div>
            )
          )}
        </header>

        <div className="flex-1 p-4 sm:p-6 md:p-10 bg-zinc-950">
          <div className="max-w-7xl mx-auto">
            {/* Notification Area */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 sm:p-5 rounded-2xl flex items-center justify-between text-red-400 mb-6 sm:mb-8 animate-in slide-in-from-top gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <AlertCircle size={20} className="shrink-0" />
                  <p className="font-medium text-xs sm:text-sm truncate">{error}</p>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(true)} 
                  className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl text-xs font-bold shrink-0 transition-colors"
                >
                  Configure Key
                </button>
              </div>
            )}
            {successMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 sm:p-5 rounded-2xl flex items-center gap-3 text-emerald-400 mb-6 sm:mb-8 animate-in slide-in-from-top">
                <Check size={18} className="shrink-0" />
                <p className="font-medium text-xs sm:text-sm">{successMsg}</p>
              </div>
            )}

            {/* Unauthenticated Banner */}
            {!currentUser && !authLoading && (
              <div className="bg-gradient-to-r from-blue-900/30 via-zinc-900 to-zinc-900 border border-[#0477CF]/30 p-5 sm:p-7 rounded-3xl mb-6 sm:mb-8 flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-1">Save & Sync Posts</h3>
                  <p className="text-zinc-400 text-xs">
                    Sign in with Google to backup your posts and access them across all your devices.
                  </p>
                </div>
                <button
                  onClick={handleSignIn}
                  className="w-full md:w-auto px-5 py-3 bg-[#0477CF] hover:bg-blue-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2.5 transition-all active:scale-95 shrink-0 shadow-lg text-xs sm:text-sm"
                >
                  <LogIn size={16} /> Sign In with Google
                </button>
              </div>
            )}
            
            {viewMode === ViewMode.Generate ? (
              <div className="max-w-2xl mx-auto space-y-8 py-6 sm:py-10">
                <div className="text-center space-y-2 sm:space-y-3">
                   <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 bg-[#0477CF]/10 rounded-3xl flex items-center justify-center text-[#0477CF] mb-3"><PlusCircle size={28} /></div>
                   <h3 className="text-2xl sm:text-3xl font-black text-white font-heading">Custom Post Creator</h3>
                   <p className="text-zinc-400 text-xs sm:text-sm">Specify a topic, riddle idea, or trivia question. It will be generated and saved to your cloud account.</p>
                </div>
                <form onSubmit={handleCustomGenerate} className="space-y-4">
                   <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="e.g. A viral order-of-operations math quiz, a clever riddle about a candle, or a fun chocolate trivia question..." className="w-full h-36 sm:h-40 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 text-white focus:ring-2 focus:ring-[#0477CF] outline-none resize-none text-sm sm:text-base shadow-inner" />
                   <button disabled={isGeneratingCustom || !customPrompt.trim()} className="w-full bg-[#0477CF] hover:bg-blue-600 disabled:opacity-50 text-white font-black py-3.5 sm:py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 uppercase tracking-widest text-xs sm:text-sm shadow-lg">{isGeneratingCustom ? <Loader2 className="animate-spin" size={17} /> : <Send size={16} />} GENERATE & DESIGN</button>
                </form>
              </div>
            ) : (
              <div className="pb-32 sm:pb-40">
                {viewMode === ViewMode.Queue && queueSubTab === 'queued' && hasQueueCollision && (
                  <div className="w-full mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-amber-300 gap-3 shadow-lg">
                    <div className="flex items-center gap-2.5">
                      <Clock size={18} className="text-amber-400 shrink-0" />
                      <div>
                        <span className="font-bold block text-sm text-amber-200">Schedule Collision Detected</span>
                        <span className="text-zinc-300 text-xs">Two or more posts are currently queued for the exact same time slot.</span>
                      </div>
                    </div>
                    <button
                      onClick={handleRealignQueue}
                      disabled={isRealigning}
                      className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs rounded-xl transition-all shadow active:scale-95 disabled:opacity-50 shrink-0"
                    >
                      {isRealigning ? 'Re-aligning Slots...' : 'Fix & Re-align Slots'}
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                  {filteredPosts.map((post, postIndex) => {
                    let context: string | null = null;
                    let question = '';

                    if (post.category === 'Would you rather') {
                      const { optionA, optionB } = parseWyr(post.visual_text || '');
                      context = optionA ? `Option A: ${optionA}` : null;
                      question = optionB ? `Option B: ${optionB}` : optionA;
                    } else {
                      const { cleanQuestion } = stripHookFromQuestion(post.visual_text || '');
                      const parts = (cleanQuestion || post.visual_text || '').split('|').map(s => s.trim());
                      context = parts.length > 1 ? parts[0] : null;
                      question = parts.length > 1 ? parts.slice(1).join(' | ') : parts[0];
                    }

                    return (
                      <div key={post.id} className="group relative">
                        <ThemeWrapper styleHint={post.style_hint} onClick={() => setSelectedPost(post)}>
                          <div className="h-full flex flex-col justify-between min-h-[16rem]">
                            <div>
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-black uppercase tracking-wider text-[#0F4C81] px-2.5 py-1 bg-blue-50 rounded-lg border border-blue-100">
                                    {post.category}
                                  </span>
                                  {post.source === 'human_web' && (
                                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                      <Globe size={10} /> Real Human
                                    </span>
                                  )}
                                  {post.source === 'community' && (
                                    <span className="text-[9px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                      <UserIcon size={10} /> Real Human
                                    </span>
                                  )}
                                  {post.source === 'ai' && (
                                    <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                      <Sparkles size={10} /> Viral AI
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {post.scheduleStatus === 'queued' && (
                                    <span className="text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                      <Clock size={10} /> QUEUED
                                    </span>
                                  )}
                                  {post.scheduleStatus === 'posted' && (
                                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                      <Check size={10} /> POSTED
                                    </span>
                                  )}
                                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                    {post.text_length || (parts.length > 1 ? 'medium' : 'short')}
                                  </span>
                                </div>
                              </div>

                              {/* Scheduled or Posted Date/Time Details */}
                              {post.scheduleStatus === 'queued' && (
                                <div className="mb-3 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs text-amber-300">
                                  <div className="flex items-center gap-1.5 font-bold truncate">
                                    <Clock size={13} className="text-amber-400 shrink-0" />
                                    <span className="truncate">
                                      Scheduled: {getQueuedScheduleInfo(post, postIndex, socialConfig.scheduleTimes).label}
                                    </span>
                                  </div>
                                  {viewMode === ViewMode.Queue && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUnqueue(post);
                                      }}
                                      className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-zinc-800 hover:bg-red-500/20 text-zinc-300 hover:text-red-400 transition-colors ml-2 shrink-0"
                                      title="Remove from queue"
                                    >
                                      Unqueue
                                    </button>
                                  )}
                                </div>
                              )}

                              {post.scheduleStatus === 'posted' && (
                                <div className="mb-3 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs text-emerald-300">
                                  <div className="flex items-center gap-1.5 font-bold truncate">
                                    <Check size={13} className="text-emerald-400 shrink-0" />
                                    <span className="truncate">
                                      Posted: {formatPostedDate(post.postedAt || post.timestamp)}
                                    </span>
                                  </div>
                                  {post.postedPlatforms && post.postedPlatforms.length > 0 && (
                                    <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded ml-2 shrink-0 truncate max-w-[110px]">
                                      {post.postedPlatforms.join(' • ')}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Preview of Formatted Card or Selected Graphic */}
                              {post.renderedImageUrl ? (
                                <div className="relative mb-3.5 rounded-xl overflow-hidden aspect-square border border-zinc-200/80 shadow-sm bg-zinc-50 group-hover:shadow-md transition-all">
                                  <img 
                                    src={post.renderedImageUrl} 
                                    alt="Formatted Card" 
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" 
                                    loading="lazy"
                                  />
                                  <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-md text-[9px] font-bold text-white tracking-wider uppercase flex items-center gap-1 shadow-sm">
                                    <Check size={10} className="text-emerald-400" /> READY IMAGE CARD
                                  </div>
                                </div>
                              ) : post.imageUrl ? (
                                <div className="relative mb-3.5 rounded-xl overflow-hidden h-32 sm:h-36 bg-zinc-50 border border-zinc-100 flex items-center justify-center p-3">
                                  <img 
                                    src={post.imageUrl} 
                                    alt="Selected Illustration" 
                                    className="max-h-full max-w-full object-contain" 
                                    loading="lazy"
                                  />
                                  <div className="absolute bottom-1.5 right-2 bg-white/90 backdrop-blur-xs px-1.5 py-0.5 rounded text-[8px] font-bold text-zinc-500 uppercase tracking-wider border border-zinc-200/50">
                                    Graphic Attached
                                  </div>
                                </div>
                              ) : null}

                              <div className="space-y-1.5">
                                {context && (
                                  <p className="text-xs sm:text-sm font-semibold text-[#0F4C81] line-clamp-3">
                                    {context}
                                  </p>
                                )}
                                <h3 className="text-base sm:text-lg font-bold font-heading text-[#D92D46] leading-snug line-clamp-2">
                                  {question}
                                </h3>
                              </div>
                            </div>

                            <div className="pt-3.5 flex items-center justify-between border-t border-zinc-100 mt-4">
                              <span className="text-[10px] font-black tracking-wider text-[#0477CF] uppercase flex items-center gap-1.5">
                                <ImageIcon size={13} /> {post.renderedImageUrl ? "View / Edit Card" : "Design & Export"}
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
                  viewMode === ViewMode.Queue ? (
                    queueSubTab === 'queued' ? (
                      <div className="text-center py-16 sm:py-24 px-4 bg-zinc-900/30 rounded-3xl border border-zinc-800 border-dashed mt-4 max-w-xl mx-auto">
                        <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-400 mx-auto mb-3">
                          <Clock size={28} />
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-white mb-2">No Posts in Queue</h3>
                        <p className="text-zinc-400 text-xs sm:text-sm max-w-md mx-auto mb-6">
                          Open any post card in your Feed and tap &quot;Queue for Autopost&quot; to schedule it for automated posting across your social media channels.
                        </p>
                        <button 
                          onClick={() => setViewMode(ViewMode.Today)} 
                          className="bg-[#0477CF] hover:bg-blue-600 px-5 py-2.5 rounded-xl text-white font-bold transition-all text-xs sm:text-sm shadow-md"
                        >
                          Browse Feed to Queue Posts
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-16 sm:py-24 px-4 bg-zinc-900/30 rounded-3xl border border-zinc-800 border-dashed mt-4 max-w-xl mx-auto">
                        <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto mb-3">
                          <Check size={28} />
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-white mb-2">No Published Posts Yet</h3>
                        <p className="text-zinc-400 text-xs sm:text-sm max-w-md mx-auto mb-6">
                          Posts published automatically by the background autopilot or manually via &quot;Post Now&quot; will appear here with publish timestamps and platform receipts.
                        </p>
                        <button 
                          onClick={() => setQueueSubTab('queued')} 
                          className="bg-zinc-800 hover:bg-zinc-700 px-5 py-2.5 rounded-xl text-white font-bold transition-all text-xs sm:text-sm"
                        >
                          View Scheduled Queue
                        </button>
                      </div>
                    )
                  ) : (
                    currentUser && (
                      <div className="text-center py-20 sm:py-28 px-4 bg-zinc-900/30 rounded-3xl border border-zinc-800 border-dashed mt-4 max-w-xl mx-auto">
                        <Database className="mx-auto text-zinc-700 mb-4" size={44} />
                        <h3 className="text-lg sm:text-xl font-bold text-zinc-400">No Posts in Cloud Database</h3>
                        <p className="text-zinc-500 text-xs sm:text-sm mt-1 mb-6">Click Generate New to create your first batch of synced posts.</p>
                        <button onClick={() => handleLoadMore('human')} className="bg-[#0477CF] hover:bg-blue-600 px-5 py-2.5 rounded-xl text-white font-bold transition-all text-xs sm:text-sm">Generate Initial Posts</button>
                      </div>
                    )
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <PostModal 
        post={selectedPost} 
        allPosts={allPosts}
        onClose={() => setSelectedPost(null)} 
        onPostUpdated={(updated) => {
          setSelectedPost(updated);
          setAllPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
        }}
      />
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        userId={currentUser?.uid}
      />

      {isSidebarOpen && <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />}

      {/* Mobile/PWA Exit Confirmation Toast */}
      {showExitToast && (
        <div 
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-zinc-900/95 border border-zinc-700/80 text-white px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs sm:text-sm font-bold animate-in fade-in slide-in-from-bottom-4 duration-200 pointer-events-none"
        >
          <span className="w-2 h-2 rounded-full bg-[#0477CF] animate-ping" />
          <span>Press back again to exit</span>
        </div>
      )}
    </div>
  );
};

export default App;
