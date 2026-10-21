import React, { useState, useRef, useEffect } from 'react';
import { 
  X, CheckCircle2, Info, Share2, Download, 
  Image as ImageIcon, Loader2, Upload, 
  Search, Edit3, ChevronRight 
} from 'lucide-react';
import { QuizPost } from '../types';
import { fetchVectorImage, fetchPixabayList } from '../services/imageService';
import { LOGO_DATA_URL } from '../services/logoData';
import * as htmlToImage from 'html-to-image';

interface PostModalProps {
  post: QuizPost | null;
  onClose: () => void;
}

type LayoutType = 'auto' | 'side' | 'center' | 'text-only' | 'wyr';

/** Official branding block scaled for 1000px canvas */
const CanvasBranding: React.FC = () => (
  <div style={{ position: 'absolute', bottom: '60px', right: '70px', display: 'flex', alignItems: 'center', gap: '16px' }} className="select-none">
    <img
      src={LOGO_DATA_URL}
      alt="Daily Quiz & Riddles Logo"
      style={{ width: '68px', height: '68px', objectFit: 'contain' }}
    />
    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: 1.1 }}>
      <span className="font-script" style={{ fontSize: '34px', color: '#0A4B78', letterSpacing: '0.5px' }}>
        Daily Quiz and Riddles
      </span>
      <span style={{ fontSize: '19px', color: '#0A4B78', fontWeight: 700, marginTop: '5px' }}>
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
  return (
    <div style={{ width: '1000px', height: '1000px', padding: '80px', position: 'relative', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }} className="bg-white select-none">
      <h2 style={{ fontSize: '48px', fontWeight: 900, color: '#0B3C68', textAlign: 'center', marginBottom: '50px' }}>
        Would You Rather?
      </h2>

      <div style={{ display: 'flex', alignItems: 'stretch', gap: '30px', flex: 1, maxHeight: '460px', marginBottom: '80px' }}>
        <div style={{ flex: 1, backgroundColor: '#0F4C81', color: 'white', borderRadius: '36px', padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <p style={{ fontSize: '38px', fontWeight: 700, lineHeight: 1.35, margin: 0 }}>{contextText || 'Option A'}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '26px', fontWeight: 900, color: '#94a3b8', padding: '10px' }}>OR</span>
        </div>
        <div style={{ flex: 1, backgroundColor: '#D92D46', color: 'white', borderRadius: '36px', padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <p style={{ fontSize: '38px', fontWeight: 700, lineHeight: 1.35, margin: 0 }}>{questionText || 'Option B'}</p>
        </div>
      </div>

      <CanvasBranding />
    </div>
  );
};

// ── Main PostModal Component ───────────────────────────────────────────────────

const PostModal: React.FC<PostModalProps> = ({ post, onClose }) => {
  const [selectedLayout, setSelectedLayout] = useState<LayoutType>('auto');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [vectorCandidates, setVectorCandidates] = useState<string[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  
  // Editable fields
  const [contextText, setContextText] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [customKeyword, setCustomKeyword] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const exportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when post changes
  useEffect(() => {
    if (!post) return;
    const parts = post.visual_text.split('|').map(s => s.trim());
    if (parts.length > 1) {
      setContextText(parts[0]);
      setQuestionText(parts[1]);
    } else {
      setContextText('');
      setQuestionText(parts[0] || '');
    }
    const kw = post.image_keyword || post.category;
    setCustomKeyword(kw);
    setSelectedLayout('auto');
    setImageUrl(post.imageUrl || null);
    setVectorCandidates([]);

    // Auto-fetch top vectors
    if (post.category !== 'Would you rather' && post.text_length !== 'long') {
      setImageLoading(true);
      fetchPixabayList(kw).then(list => {
        if (list.length > 0) {
          setVectorCandidates(list.slice(0, 5));
          setImageUrl(list[0]);
        } else {
          // Fallback to single vector search
          fetchVectorImage(kw).then(url => {
            if (url) setImageUrl(url);
          });
        }
      }).finally(() => setImageLoading(false));
    }
  }, [post]);

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
        setImageUrl(list[0]);
      } else {
        const fallback = await fetchVectorImage(customKeyword.trim());
        if (fallback) {
          setImageUrl(fallback);
          setVectorCandidates([fallback]);
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
      }
    };
    reader.readAsDataURL(file);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/90 backdrop-blur-xl" onClick={onClose}>
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />

      <div
        className="w-full max-w-5xl bg-[#09090b] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Left Preview Panel ─────────────────────────────────────────────────── */}
        <div className="w-full md:w-[470px] bg-zinc-950 p-6 md:p-8 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col items-center justify-between gap-5 overflow-y-auto">
          
          {/* Layout Selector Pills */}
          <div className="w-full flex items-center justify-center gap-1.5 bg-zinc-900/90 p-1.5 rounded-2xl border border-zinc-800 text-[11px] font-bold">
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

          {/* Exportable Square Post Card Container (Scaled 1000px -> 380px) */}
          <div className="w-full flex items-center justify-center py-2">
            <div className="w-[380px] h-[380px] rounded-3xl overflow-hidden shadow-2xl border border-zinc-200 relative bg-white">
              {imageLoading && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center z-20">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="animate-spin text-[#0477CF]" size={28} />
                    <span className="text-xs font-bold text-zinc-500">Searching Transparent Vector...</span>
                  </div>
                </div>
              )}

              {/* The full-res 1000x1000 canvas scaled cleanly to 380px */}
              <div
                ref={exportRef}
                style={{
                  width: '1000px',
                  height: '1000px',
                  transform: 'scale(0.38)',
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
          <div className="w-full flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="flex-1 bg-white hover:bg-zinc-100 text-black font-black py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 text-sm shadow-md"
            >
              <Download size={18} /> Download Post (1500px)
            </button>
            <button
              onClick={handleShare}
              disabled={isSharing}
              className="p-3.5 bg-[#0477CF] hover:bg-blue-600 text-white rounded-2xl transition-all active:scale-95 disabled:opacity-50 shadow-md"
              title="Share"
            >
              {isSharing ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
            </button>
          </div>
        </div>

        {/* ── Right Controls & Details Panel ────────────────────────────────────── */}
        <div className="flex-1 p-6 md:p-8 flex flex-col justify-between overflow-y-auto space-y-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#0477CF] px-2.5 py-1 bg-[#0477CF]/10 rounded-lg">
                  {post.category}
                </span>
                <h3 className="text-xl font-bold text-white font-heading mt-2">Post Editor & Vector Tools</h3>
              </div>
              <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white rounded-xl">
                <X size={22} />
              </button>
            </div>

            {/* Vector Selector & Tools */}
            <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                  <ImageIcon size={14} className="text-emerald-400" /> Vector Illustration (Transparent)
                </span>
                {imageUrl && (
                  <button 
                    onClick={() => { setImageUrl(null); setSelectedLayout('text-only'); }} 
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
                        onClick={() => setImageUrl(url)}
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
                    <label className="text-[11px] text-zinc-400 block mb-1">Context Setup (Top, Navy)</label>
                    <textarea
                      rows={2}
                      value={contextText}
                      onChange={(e) => setContextText(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#0477CF]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Question / Highlight (Red)</label>
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

          <button
            onClick={onClose}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3.5 rounded-2xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostModal;