import React, { useState, useRef, useEffect } from 'react';
import { 
  X, CheckCircle2, Info, Share2, Download, 
  Image as ImageIcon, Loader2, Upload, 
  Search, Edit3, ChevronRight, Clock, Send, Check, BookOpen, Globe, ExternalLink, Sparkles
} from 'lucide-react';
import { QuizPost } from '../types';
import { fetchVectorImage, fetchPixabayList } from '../services/imageService';
import { LOGO_DATA_URL } from '../services/logoData';
import { uploadRenderedCard } from '../services/storageService';
import { queuePostForAutopost, triggerPostNow, getLocalSocialConfig, getQueuedScheduleInfo, formatPostedDate, unqueuePost, reschedulePost, findNextAvailableSlotDate } from '../services/socialService';
import { dispatchPostDirectly, buildSocialCaption, parseWyr, stripHookFromQuestion } from '../services/socialDirectService';
import { updateUserPost } from '../services/firestoreService';
import * as htmlToImage from 'html-to-image';

interface PostModalProps {
  post: QuizPost | null;
  allPosts?: QuizPost[];
  onClose: () => void;
  onPostUpdated?: (updated: QuizPost) => void;
  onWriteArticle?: (post: QuizPost) => void;
}


type LayoutType = 'auto' | 'side' | 'center' | 'text-only' | 'wyr';

/** Official branding block scaled for 1000px canvas */
const CanvasBranding: React.FC = () => (
  <div style={{ position: 'absolute', bottom: '50px', right: '60px', display: 'flex', alignItems: 'center', gap: '14px', zIndex: 10 }} className="select-none">
    <img
      src={LOGO_DATA_URL}
      alt="Daily Quiz & Riddles Logo"
      style={{ width: '64px', height: '64px', objectFit: 'contain', flexShrink: 0 }}
    />
    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', minWidth: 'max-content', whiteSpace: 'nowrap' }}>
      <span 
        className="font-script" 
        style={{ 
          fontFamily: "'Dancing Script', cursive, sans-serif",
          fontSize: '30px', 
          color: '#0A4B78', 
          letterSpacing: '0.5px',
          whiteSpace: 'nowrap',
          lineHeight: '34px',
          display: 'block'
        }}
      >
        Daily Quiz and Riddles
      </span>
      <span 
        style={{ 
          fontSize: '18px', 
          color: '#0A4B78', 
          fontWeight: 700, 
          whiteSpace: 'nowrap',
          lineHeight: '22px',
          display: 'block',
          marginTop: '2px'
        }}
      >
        @quiz_riddles
      </span>
    </div>
  </div>
);

interface Canvas1000Props {
  contextText: string;
  questionText: string;
  imageUrl: string | null;
  resolvedLayout: 'side' | 'center' | 'text-only' | 'wyr';
}

const Canvas1000: React.FC<Canvas1000Props> = ({
  contextText,
  questionText,
  imageUrl,
  resolvedLayout
}) => {
  // Dynamic font sizing based on length to guarantee clean non-overflowing typography
  const contextLength = contextText.length;
  const contextFontSize = contextLength > 160 ? '34px' : contextLength > 100 ? '38px' : '44px';

  const questionLength = questionText.length;
  const questionFontSize = questionLength > 80 ? '42px' : questionLength > 50 ? '48px' : '54px';

  // ── Layout 1: Side by Side (Context Top, Image Left, Question Right) ─────────
  if (resolvedLayout === 'side') {
    return (
      <div style={{ width: '1000px', height: '1000px', padding: '75px 80px', position: 'relative', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }} className="bg-white select-none">
        {/* Full-width Context Header */}
        {contextText ? (
          <div style={{ width: '100%', marginBottom: '35px' }}>
            <p style={{ color: '#0F4C81', fontSize: contextFontSize, fontWeight: 700, lineHeight: 1.35, textAlign: 'left', margin: 0 }}>
              {contextText}
            </p>
          </div>
        ) : null}

        {/* Middle Two-Column Grid: Image Left, Question Right */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '60px', flex: 1, maxHeight: '520px', marginBottom: '80px' }}>
          {/* Left Column: Contained Vector Image */}
          <div style={{ width: '48%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="visual"
                crossOrigin="anonymous"
                style={{ maxHeight: '420px', maxWidth: '100%', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ width: '220px', height: '220px', borderRadius: '30px', backgroundColor: '#f8fafc', border: '2px dashed #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                <ImageIcon size={64} />
                <span style={{ fontSize: '18px', fontWeight: 700, marginTop: '10px' }}>Select an Image</span>
              </div>
            )}
          </div>

          {/* Right Column: Crimson Red Question */}
          <div style={{ width: '48%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <p style={{ color: '#D92D46', fontSize: questionFontSize, fontWeight: 700, lineHeight: 1.25, margin: 0 }}>
              {questionText}
            </p>
          </div>
        </div>

        {/* Pinned Branding */}
        <CanvasBranding />
      </div>
    );
  }

  // ── Layout 2: Center Image (Question Top, Centered Illustration Below) ───────
  if (resolvedLayout === 'center') {
    const headerText = contextText ? `${contextText} ${questionText}` : questionText;
    const headerFontSize = headerText.length > 90 ? '42px' : '50px';

    return (
      <div style={{ width: '1000px', height: '1000px', padding: '75px 80px', position: 'relative', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }} className="bg-white select-none">
        {/* Top Question */}
        <div style={{ width: '100%', textAlign: 'center', marginBottom: '25px' }}>
          <p style={{ color: '#0F4C81', fontSize: headerFontSize, fontWeight: 700, lineHeight: 1.3, margin: 0 }}>
            {headerText}
          </p>
        </div>

        {/* Centered Image */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: '540px', marginBottom: '80px' }}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="illustration"
              crossOrigin="anonymous"
              style={{ maxHeight: '480px', maxWidth: '85%', objectFit: 'contain' }}
            />
          ) : (
            <div style={{ width: '240px', height: '240px', borderRadius: '30px', backgroundColor: '#f8fafc', border: '2px dashed #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <ImageIcon size={64} />
              <span style={{ fontSize: '18px', fontWeight: 700, marginTop: '10px' }}>Select an Image</span>
            </div>
          )}
        </div>

        {/* Pinned Branding */}
        <CanvasBranding />
      </div>
    );
  }

  // ── Layout 3: Text Only (No Image) ───────────────────────────────────────────
  if (resolvedLayout === 'text-only') {
    return (
      <div style={{ width: '1000px', height: '1000px', padding: '80px 90px', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box' }} className="bg-white select-none">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '45px', textAlign: 'center', marginBottom: '100px' }}>
          {contextText ? (
            <p style={{ color: '#0F4C81', fontSize: contextFontSize, fontWeight: 700, lineHeight: 1.4, margin: 0 }}>
              {contextText}
            </p>
          ) : null}
          <p style={{ color: '#D92D46', fontSize: questionFontSize, fontWeight: 800, lineHeight: 1.3, margin: 0 }}>
            {questionText}
          </p>
        </div>

        {/* Pinned Branding */}
        <CanvasBranding />
      </div>
    );
  }

  // ── Layout 4: Would You Rather ───────────────────────────────────────────────
  const lenA = (contextText || '').length;
  const fontA = lenA > 110 ? '26px' : lenA > 70 ? '30px' : lenA > 40 ? '34px' : '38px';
  const lenB = (questionText || '').length;
  const fontB = lenB > 110 ? '26px' : lenB > 70 ? '30px' : lenB > 40 ? '34px' : '38px';

  return (
    <div style={{ width: '1000px', height: '1000px', padding: '80px', position: 'relative', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }} className="bg-white select-none">
      <h2 style={{ fontSize: '48px', fontWeight: 900, color: '#0B3C68', textAlign: 'center', marginBottom: '45px' }}>
        Would You Rather?
      </h2>

      <div style={{ display: 'flex', alignItems: 'stretch', gap: '30px', flex: 1, maxHeight: '480px', marginBottom: '80px' }}>
        <div style={{ flex: 1, backgroundColor: '#0F4C81', color: 'white', borderRadius: '36px', padding: '40px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <p style={{ fontSize: fontA, fontWeight: 700, lineHeight: 1.35, margin: 0 }}>
            {contextText || 'Option A'}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '26px', fontWeight: 900, color: '#94a3b8', padding: '10px' }}>OR</span>
        </div>
        <div style={{ flex: 1, backgroundColor: '#D92D46', color: 'white', borderRadius: '36px', padding: '40px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <p style={{ fontSize: fontB, fontWeight: 700, lineHeight: 1.35, margin: 0 }}>
            {questionText || 'Option B'}
          </p>
        </div>
      </div>

      <CanvasBranding />
    </div>
  );
};

// ── Main PostModal Component ───────────────────────────────────────────────────

const PostModal: React.FC<PostModalProps> = ({ post, allPosts, onClose, onPostUpdated, onWriteArticle }) => {
  const [selectedLayout, setSelectedLayout] = useState<LayoutType>('auto');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [vectorCandidates, setVectorCandidates] = useState<string[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isQueueing, setIsQueueing] = useState(false);
  const [queueSuccess, setQueueSuccess] = useState(false);
  const [isPostingNow, setIsPostingNow] = useState(false);
  const [postNowStatus, setPostNowStatus] = useState<string | null>(null);

  // Rescheduling states
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleInput, setRescheduleInput] = useState('');
  const [isRescheduling, setIsRescheduling] = useState(false);

  useEffect(() => {
    if (post?.scheduledTime) {
      const d = new Date(post.scheduledTime);
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, '0');
        const localStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        setRescheduleInput(localStr);
      }
    }
  }, [post?.scheduledTime]);

  // Compute the projected next available slot label if this post is queued
  const nextSlotLabel = React.useMemo(() => {
    if (!post || post.scheduleStatus === 'queued') return null;
    try {
      const social = getLocalSocialConfig();
      const occupied = (allPosts || [])
        .filter(p => p.scheduleStatus === 'queued' && p.scheduledTime)
        .map(p => p.scheduledTime as string);
      const slotDate = findNextAvailableSlotDate(social.scheduleTimes, occupied, post.id);
      return getQueuedScheduleInfo({ ...post, scheduledTime: slotDate.toISOString() }).label;
    } catch {
      return null;
    }
  }, [post?.id, post?.scheduleStatus, allPosts]);
  
  // Editable fields
  const [contextText, setContextText] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [customKeyword, setCustomKeyword] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const exportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewWrapperRef = useRef<HTMLDivElement>(null);
  const [previewSize, setPreviewSize] = useState(380);

  useEffect(() => {
    const updateSize = () => {
      if (previewWrapperRef.current) {
        const available = previewWrapperRef.current.clientWidth;
        if (available > 0) {
          const target = Math.min(380, Math.max(260, available - 16));
          setPreviewSize(target);
        }
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);


  // Helper to compile the current post state including edited text and selected image
  const getUpdatedPost = (renderedStorageUrl?: string): QuizPost => {
    if (!post) throw new Error("No post");
    const newVisualText = contextText.trim() ? `${contextText.trim()} | ${questionText.trim()}` : questionText.trim();
    return {
      ...post,
      visual_text: newVisualText || post.visual_text,
      imageUrl: imageUrl || post.imageUrl || '',
      renderedImageUrl: renderedStorageUrl || post.renderedImageUrl,
      image_keyword: customKeyword || post.image_keyword,
    };
  };

  const handleSelectVector = (url: string) => {
    setImageUrl(url);
    if (post?.userId) {
      const updated = { ...post, imageUrl: url };
      updateUserPost(post.userId, updated);
      onPostUpdated?.(updated);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl(null);
    setSelectedLayout('text-only');
    if (post?.userId) {
      const updated = { ...post, imageUrl: '' };
      updateUserPost(post.userId, updated);
      onPostUpdated?.(updated);
    }
  };

  const handleClose = () => {
    if (post?.userId) {
      const updated = getUpdatedPost();
      if (
        updated.imageUrl !== post.imageUrl ||
        updated.visual_text !== post.visual_text ||
        updated.image_keyword !== post.image_keyword
      ) {
        updateUserPost(post.userId, updated);
        onPostUpdated?.(updated);
      }
    }
    onClose();
  };

  // Sync state only when the active post ID changes
  useEffect(() => {
    if (!post) return;

    if (post.category === 'Would you rather') {
      const { optionA, optionB } = parseWyr(post.visual_text || '');
      setContextText(optionA);
      setQuestionText(optionB);
    } else {
      const { cleanQuestion } = stripHookFromQuestion(post.visual_text || '');
      const textToUse = cleanQuestion || post.visual_text || '';
      const parts = textToUse.split('|').map(s => s.trim());
      if (parts.length > 1) {
        setContextText(parts[0]);
        setQuestionText(parts.slice(1).join(' | '));
      } else {
        setContextText('');
        setQuestionText(parts[0] || '');
      }
    }

    const kw = post.image_keyword || post.category;
    setCustomKeyword(kw);
    setSelectedLayout('auto');
    setImageUrl(post.imageUrl || null);
    setVectorCandidates([]);

    // Auto-fetch top vectors ONLY if post doesn't already have an assigned image
    if (post.category !== 'Would you rather' && post.text_length !== 'long') {
      setImageLoading(true);
      fetchPixabayList(kw).then(list => {
        if (list.length > 0) {
          setVectorCandidates(list.slice(0, 5));
          if (!post.imageUrl) {
            const firstChoice = list[0];
            setImageUrl(firstChoice);
            if (post.userId) {
              const updated = { ...post, imageUrl: firstChoice };
              updateUserPost(post.userId, updated);
              onPostUpdated?.(updated);
            }
          }
        } else if (!post.imageUrl) {
          fetchVectorImage(kw).then(url => {
            if (url) {
              setImageUrl(url);
              if (post.userId) {
                const updated = { ...post, imageUrl: url };
                updateUserPost(post.userId, updated);
                onPostUpdated?.(updated);
              }
            }
          });
        }
      }).finally(() => setImageLoading(false));
    }
  }, [post?.id]);

  if (!post) return null;

  // Resolve layout
  const resolvedLayout: 'side' | 'center' | 'text-only' | 'wyr' = (() => {
    if (selectedLayout !== 'auto') {
      return selectedLayout === 'side' ? 'side'
        : selectedLayout === 'center' ? 'center'
        : selectedLayout === 'wyr' ? 'wyr' : 'text-only';
    }
    if (post.category === 'Would you rather') return 'wyr';
    if (!imageUrl && !imageLoading) return 'text-only';
    if (contextText && questionText) return 'side';
    return 'center';
  })();

  const handleSearchImage = async () => {
    if (!customKeyword.trim()) return;
    setImageLoading(true);
    try {
      const list = await fetchPixabayList(customKeyword.trim());
      if (list.length > 0) {
        setVectorCandidates(list.slice(0, 5));
        const newUrl = list[0];
        setImageUrl(newUrl);
        if (post?.userId) {
          const updated = { ...post, imageUrl: newUrl, image_keyword: customKeyword.trim() };
          updateUserPost(post.userId, updated);
          onPostUpdated?.(updated);
        }
      } else {
        const fallback = await fetchVectorImage(customKeyword.trim());
        if (fallback) {
          setImageUrl(fallback);
          setVectorCandidates([fallback]);
          if (post?.userId) {
            const updated = { ...post, imageUrl: fallback, image_keyword: customKeyword.trim() };
            updateUserPost(post.userId, updated);
            onPostUpdated?.(updated);
          }
        }
      }
    } finally {
      setImageLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setImageUrl(result);
        setVectorCandidates(prev => [result, ...prev]);
        if (post?.userId) {
          const updated = { ...post, imageUrl: result };
          updateUserPost(post.userId, updated);
          onPostUpdated?.(updated);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const generateCardDataUrl = async (): Promise<string> => {
    if (!exportRef.current) throw new Error("No canvas element");
    const el = exportRef.current;
    const origTransform = el.style.transform;
    try {
      el.style.transform = 'none';
      // Use toJpeg with quality 0.85 so dataUrl is compressed (~80KB) and safely within Firestore's 1MB limit
      return await htmlToImage.toJpeg(el, {
        quality: 0.85,
        pixelRatio: 1.0,
        backgroundColor: '#ffffff',
        skipFonts: true,
      });
    } finally {
      el.style.transform = origTransform;
    }
  };

  const handleQueueForAutopost = async () => {
    if (!post?.userId) {
      alert("Please sign in with Google to queue posts for autoposting.");
      return;
    }
    setIsQueueing(true);
    try {
      const dataUrl = await generateCardDataUrl();
      const storageUrl = await uploadRenderedCard(post.userId, post.id, dataUrl);
      const postToQueue = getUpdatedPost(storageUrl);
      const res = await queuePostForAutopost(post.userId, postToQueue, storageUrl, undefined, allPosts);
      setQueueSuccess(true);
      onPostUpdated?.(res.post);
      setTimeout(() => setQueueSuccess(false), 3000);
    } catch (err: any) {
      console.error("Queue error:", err);
      alert("Failed to queue post: " + (err?.message || err));
    } finally {
      setIsQueueing(false);
    }
  };

  const handleUnqueue = async () => {
    if (!post?.userId) return;
    setIsQueueing(true);
    try {
      const updated = await unqueuePost(post.userId, post);
      onPostUpdated?.(updated);
    } catch (err: any) {
      console.error("Unqueue error:", err);
      alert("Failed to unqueue post: " + (err?.message || err));
    } finally {
      setIsQueueing(false);
    }
  };

  const handleReschedule = async () => {
    if (!post?.userId || !rescheduleInput) return;
    setIsRescheduling(true);
    try {
      const newDate = new Date(rescheduleInput);
      if (isNaN(newDate.getTime())) {
        alert("Please select a valid date and time.");
        return;
      }
      const updated = await reschedulePost(post.userId, post, newDate.toISOString());
      onPostUpdated?.(updated);
      setShowReschedule(false);
    } catch (err: any) {
      console.error("Reschedule error:", err);
      alert("Failed to reschedule post: " + (err?.message || err));
    } finally {
      setIsRescheduling(false);
    }
  };

  const handlePostNow = async () => {
    if (!post?.userId) {
      alert("Please sign in to post.");
      return;
    }
    setIsPostingNow(true);
    setPostNowStatus("Rendering & uploading image...");
    try {
      const dataUrl = await generateCardDataUrl();
      const storageUrl = await uploadRenderedCard(post.userId, post.id, dataUrl);
      const postToPost = getUpdatedPost(storageUrl);
      const queued = await queuePostForAutopost(post.userId, postToPost, storageUrl, undefined, allPosts);
      setPostNowStatus("Publishing to socials...");

      const config = getLocalSocialConfig();
      const res = await dispatchPostDirectly(queued, config, post.userId);
      if (res.success) {
        setPostNowStatus(`✅ Posted to: ${res.platforms.join(', ')}!`);
        onPostUpdated?.({ 
          ...queued, 
          scheduleStatus: 'posted', 
          postedPlatforms: res.platforms, 
          postedAt: Date.now() 
        });
      } else {
        setPostNowStatus(`⚠️ Failed: ${res.errors.join(' | ')}`);
      }
    } catch (err: any) {
      setPostNowStatus(`❌ Error: ${err?.message || err}`);
    } finally {
      setIsPostingNow(false);
    }
  };

  const handleDownload = async () => {
    if (!exportRef.current) return;
    const el = exportRef.current;
    const origTransform = el.style.transform;
    try {
      // Temporarily remove preview transform to capture full 1000x1000 canvas
      el.style.transform = 'none';
      const dataUrl = await htmlToImage.toPng(el, {
        quality: 1.0,
        pixelRatio: 1.5,
        backgroundColor: '#ffffff',
        skipFonts: true,
      });
      const link = document.createElement('a');
      link.download = `DQR-${post.id}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      el.style.transform = origTransform;
    }
  };

  const handleShareToTwitter = () => {
    const tweetText = buildSocialCaption(post);
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShare = async () => {
    if (!exportRef.current) return;
    const el = exportRef.current;
    const origTransform = el.style.transform;
    setIsSharing(true);
    try {
      el.style.transform = 'none';
      const dataUrl = await htmlToImage.toPng(el, {
        quality: 1.0,
        pixelRatio: 1.2,
        backgroundColor: '#ffffff',
        skipFonts: true,
      });
      const title = questionText || contextText || 'Daily Quiz and Riddles';
      if (navigator.canShare && navigator.share) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `quiz-${post.id}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Daily Quiz and Riddles', text: title });
        } else {
          await navigator.share({ title: 'Daily Quiz and Riddles', text: title, url: window.location.href });
        }
      } else {
        alert('Sharing is best on mobile! On desktop, click Download Post to save and publish.');
      }
    } catch (err) {
      console.error('Share failed:', err);
    } finally {
      el.style.transform = origTransform;
      setIsSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/90 backdrop-blur-xl" onClick={handleClose}>
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />

      <div
        className="w-full max-w-5xl bg-[#09090b] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Unified Top Header (Always at the very top on all devices) ── */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-800 bg-[#0c0c0e] shrink-0 z-30">
          <div className="flex items-center gap-2.5 sm:gap-3 overflow-hidden">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#0477CF] px-2.5 py-1 bg-[#0477CF]/10 rounded-lg shrink-0">
              {post.category}
            </span>
            <h3 className="text-sm sm:text-base md:text-lg font-bold text-white font-heading truncate">
              Post Details & Studio
            </h3>
          </div>
          <button 
            type="button"
            onClick={handleClose} 
            className="p-1.5 sm:p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors shrink-0"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Single Unified Scroll Container (Entire modal scrolls as one seamless page on mobile) ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="flex flex-col md:flex-row min-h-full">
            {/* ── Left / Top Panel: Preview Card & Publishing Actions ── */}
            <div className="w-full md:w-[470px] bg-zinc-950/80 p-4 sm:p-6 border-b md:border-b-0 md:border-r border-zinc-800/80 flex flex-col items-center gap-4 shrink-0">
          
          {/* Scheduled / Posted Status Notification */}
          {post.scheduleStatus === 'queued' && (
            <div className="w-full flex flex-col gap-2">
              <div className="w-full px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5 truncate">
                  <Clock size={13} className="text-amber-400 shrink-0" />
                  <span className="truncate">Scheduled: {getQueuedScheduleInfo(post).label}</span>
                </span>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => setShowReschedule(prev => !prev)}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                  >
                    {showReschedule ? 'Cancel' : 'Change Time'}
                  </button>
                  <span className="text-[10px] font-mono text-amber-400 uppercase bg-amber-500/20 px-1.5 py-0.5 rounded">
                    QUEUED
                  </span>
                </div>
              </div>

              {showReschedule && (
                <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-200">Change Scheduled Time</span>
                    <span className="text-[10px] text-zinc-400">Updates Buffer calendar</span>
                  </div>
                  <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                    <input
                      type="datetime-local"
                      value={rescheduleInput}
                      onChange={e => setRescheduleInput(e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#0477CF]"
                    />
                    <button
                      type="button"
                      onClick={handleReschedule}
                      disabled={isRescheduling || !rescheduleInput}
                      className="px-3 py-1.5 bg-[#0477CF] hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-all shrink-0 flex items-center gap-1"
                    >
                      {isRescheduling ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Save New Time
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {post.scheduleStatus === 'posted' && (
            <div className="w-full px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5 truncate">
                <Check size={13} className="text-emerald-400 shrink-0" />
                <span className="truncate">Published: {formatPostedDate(post.postedAt)}</span>
              </span>
              {post.postedPlatforms && post.postedPlatforms.length > 0 && (
                <span className="text-[9px] font-mono text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded shrink-0 ml-2">
                  {post.postedPlatforms.join(', ')}
                </span>
              )}
            </div>
          )}

          {/* Layout Selector Pills */}
          <div className="w-full flex items-center justify-center gap-1.5 bg-zinc-900/90 p-1.5 rounded-2xl border border-zinc-800 text-[11px] font-bold overflow-x-auto">
            <button
              onClick={() => setSelectedLayout('auto')}
              className={`px-3 py-1.5 rounded-xl transition-all ${selectedLayout === 'auto' ? 'bg-[#0477CF] text-white shadow' : 'text-zinc-400 hover:text-white'}`}
            >
              Auto
            </button>
            <button
              onClick={() => setSelectedLayout('side')}
              className={`px-3 py-1.5 rounded-xl transition-all ${selectedLayout === 'side' ? 'bg-[#0477CF] text-white shadow' : 'text-zinc-400 hover:text-white'}`}
            >
              Side by Side
            </button>
            <button
              onClick={() => setSelectedLayout('center')}
              className={`px-3 py-1.5 rounded-xl transition-all ${selectedLayout === 'center' ? 'bg-[#0477CF] text-white shadow' : 'text-zinc-400 hover:text-white'}`}
            >
              Center Image
            </button>
            <button
              onClick={() => setSelectedLayout('text-only')}
              className={`px-3 py-1.5 rounded-xl transition-all ${selectedLayout === 'text-only' ? 'bg-[#0477CF] text-white shadow' : 'text-zinc-400 hover:text-white'}`}
            >
              Text Only
            </button>
          </div>

          {/* Exportable Square Post Card Container (Scaled dynamically to previewSize) */}
          <div ref={previewWrapperRef} className="w-full flex items-center justify-center py-1 sm:py-2">
            <div 
              style={{ width: `${previewSize}px`, height: `${previewSize}px` }}
              className="rounded-3xl overflow-hidden shadow-2xl border border-zinc-200 relative bg-white shrink-0"
            >
              {imageLoading && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center z-20">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="animate-spin text-[#0477CF]" size={28} />
                    <span className="text-xs font-bold text-zinc-500">Searching Transparent Vector...</span>
                  </div>
                </div>
              )}

              {/* The full-res 1000x1000 canvas scaled cleanly */}
              <div
                ref={exportRef}
                style={{
                  width: '1000px',
                  height: '1000px',
                  transform: `scale(${previewSize / 1000})`,
                  transformOrigin: 'top left',
                }}
              >
                <Canvas1000
                  contextText={contextText}
                  questionText={questionText}
                  imageUrl={imageUrl}
                  resolvedLayout={resolvedLayout}
                />
              </div>
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="w-full flex flex-col gap-3">
            <div className="w-full flex items-center gap-2 sm:gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 bg-white hover:bg-zinc-100 text-black font-black py-3 sm:py-3.5 px-3 sm:px-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 text-xs sm:text-sm shadow-md"
              >
                <Download size={16} /> Download (1500px)
              </button>
              <button
                onClick={handleShare}
                disabled={isSharing}
                className="p-3 sm:p-3.5 bg-[#0477CF] hover:bg-blue-600 text-white rounded-2xl transition-all active:scale-95 disabled:opacity-50 shadow-md shrink-0"
                title="Share"
              >
                {isSharing ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
              </button>
            </div>

            {/* Social Autopost & Queue Buttons */}
            {post.userId && (
              <div className="w-full flex flex-col gap-2 pt-2 border-t border-zinc-900">
                <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                  {post.scheduleStatus === 'queued' ? (
                    <div className="flex-1 flex gap-1.5 min-w-[140px]">
                      <button
                        type="button"
                        disabled
                        className="flex-1 py-2.5 sm:py-3 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      >
                        <Check size={14} /> Queued
                      </button>
                      <button
                        type="button"
                        onClick={handleUnqueue}
                        disabled={isQueueing}
                        className="py-2.5 sm:py-3 px-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border bg-zinc-900 hover:bg-red-500/20 border-zinc-800 hover:border-red-500/40 text-zinc-300 hover:text-red-400 transition-all shrink-0"
                        title="Remove from autopost queue"
                      >
                        {isQueueing ? <Loader2 size={14} className="animate-spin" /> : 'Unqueue'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleQueueForAutopost}
                      disabled={isQueueing}
                      className={`flex-1 min-w-[140px] py-2.5 sm:py-3 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${queueSuccess ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-white'}`}
                      title={nextSlotLabel ? `Queue for ${nextSlotLabel}` : 'Queue Autopost'}
                    >
                      {isQueueing ? <Loader2 size={14} className="animate-spin" /> : (queueSuccess ? <Check size={14} /> : <Clock size={14} />)}
                      {queueSuccess ? 'Queued!' : `Queue Autopost${nextSlotLabel ? ` (${nextSlotLabel})` : ''}`}
                    </button>
                  )}
                  <button
                    onClick={handlePostNow}
                    disabled={isPostingNow}
                    className="py-2.5 sm:py-3 px-3.5 bg-[#0477CF] hover:bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50 shrink-0"
                    title="Publish to enabled socials"
                  >
                    {isPostingNow ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Post Now
                  </button>
                  <button
                    onClick={handleShareToTwitter}
                    type="button"
                    className="py-2.5 sm:py-3 px-3.5 bg-zinc-900 hover:bg-black border border-zinc-700 hover:border-zinc-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0"
                    title="Share on X"
                  >
                    𝕏 Tweet
                  </button>
                  {onWriteArticle && (
                    <button
                      onClick={() => onWriteArticle(post)}
                      type="button"
                      className="py-2.5 sm:py-3 px-3.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-zinc-200 hover:text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0"
                      title="Write full SEO article for WordPress website"
                    >
                      <BookOpen size={14} className="text-[#0477CF]" />
                      <span>
                        {post.wpStatus === 'publish'
                          ? 'WP Article (Live)'
                          : post.wpStatus === 'future'
                          ? 'WP Article (Scheduled)'
                          : post.articleContent
                          ? 'WP Article (Draft)'
                          : 'WP Article'}
                      </span>
                    </button>
                  )}
                  {post.wpPostUrl && (
                    <a
                      href={post.wpPostUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 sm:py-3 px-3.5 bg-sky-950/60 hover:bg-sky-900/80 border border-sky-600/40 text-sky-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0"
                      title="Open published article on quizandriddles.com"
                    >
                      <Globe size={14} className="text-sky-400" />
                      <span>View on Web</span>
                      <ExternalLink size={11} className="opacity-70" />
                    </a>
                  )}
                </div>
                {postNowStatus && (
                  <div className="text-[11px] p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-300">
                    {postNowStatus}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right / Bottom Panel: Controls & Details ──────────────────────────── */}
        <div className="flex-1 p-4 sm:p-6 flex flex-col justify-between space-y-4 sm:space-y-5">
          <div className="space-y-4 sm:space-y-5">
            {/* Section Header */}
            <div className="flex items-center justify-between pb-1 border-b border-zinc-850">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} className="text-[#0477CF]" /> Editor & Content Tools
              </span>
            </div>

            {/* Vector Selector & Tools */}
            <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                  <ImageIcon size={14} className="text-emerald-400" /> Vector Illustration (Transparent)
                </span>
                {imageUrl && (
                  <button 
                    onClick={handleRemoveImage} 
                    className="text-[11px] text-zinc-400 hover:text-red-400 font-medium"
                  >
                    Remove Image
                  </button>
                )}
              </div>

              {/* Keyword Search */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customKeyword}
                  onChange={(e) => setCustomKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchImage()}
                  placeholder="e.g. socks, hourglass, compass..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#0477CF]"
                />
                <button
                  onClick={handleSearchImage}
                  disabled={imageLoading}
                  className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <Search size={13} /> Search
                </button>
              </div>

              {/* Vector Candidates Gallery */}
              {vectorCandidates.length > 1 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Choose Vector:</span>
                  <div className="flex gap-2 overflow-x-auto py-1">
                    {vectorCandidates.map((url, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectVector(url)}
                        className={`w-14 h-14 rounded-xl border p-1 bg-white flex items-center justify-center shrink-0 transition-all ${imageUrl === url ? 'border-[#0477CF] ring-2 ring-[#0477CF]/40' : 'border-zinc-700 opacity-60 hover:opacity-100'}`}
                      >
                        <img src={url} alt="" className="max-h-full max-w-full object-contain" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload button */}
              <div className="pt-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:text-white rounded-xl text-xs font-semibold text-zinc-300 flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload size={14} /> Upload Custom Image (PNG / SVG)
                </button>
              </div>
            </div>

            {/* Text Editor Toggle */}
            <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="w-full flex items-center justify-between text-xs font-bold text-zinc-300"
              >
                <span className="flex items-center gap-2">
                  <Edit3 size={14} className="text-[#0477CF]" /> Edit Post Text
                </span>
                <span className="text-[11px] text-[#0477CF] font-medium">{isEditing ? 'Collapse' : 'Expand'}</span>
              </button>

              {isEditing && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">
                      {post.category === 'Would you rather' ? 'Option A (Left Blue Box)' : 'Context Setup (Top, Navy)'}
                    </label>
                    <textarea
                      rows={2}
                      value={contextText}
                      onChange={(e) => setContextText(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#0477CF]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">
                      {post.category === 'Would you rather' ? 'Option B (Right Red Box)' : 'Question / Highlight (Red)'}
                    </label>
                    <textarea
                      rows={2}
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#0477CF]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Answer & Explanation */}
            <div className="space-y-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-[11px] mb-1.5 uppercase tracking-wider">
                  <CheckCircle2 size={14} /> Correct Answer
                </div>
                <p className="text-emerald-100 font-bold text-base">{post.answer}</p>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-blue-400 font-bold text-[11px] mb-1.5 uppercase tracking-wider">
                  <Info size={14} /> The Logic / Fun Fact
                </div>
                <p className="text-zinc-300 text-xs leading-relaxed italic">{post.read_more_content}</p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3.5 rounded-2xl transition-colors text-sm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
  );
};

export default PostModal;