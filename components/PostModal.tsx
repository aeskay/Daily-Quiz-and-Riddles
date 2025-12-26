import React, { useState, useRef, useEffect } from 'react';
import { X, CheckCircle2, Info, Share2, Download, Image as ImageIcon, Loader2 } from 'lucide-react';
import { QuizPost } from '../types';
import { generatePostImage } from '../services/geminiService';
import * as htmlToImage from 'html-to-image';

interface PostModalProps {
  post: QuizPost | null;
  onClose: () => void;
}

const PostModal: React.FC<PostModalProps> = ({ post, onClose }) => {
  const [generatingImage, setGeneratingImage] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalImageUrl(null); }, [post]);

  if (!post) return null;

  const handleGenerateGraphic = async () => {
    setGeneratingImage(true);
    try {
      const url = await generatePostImage(post);
      setLocalImageUrl(url);
    } catch (err) { 
      console.error(err); 
    } finally { 
      setGeneratingImage(false); 
    }
  };

  const handleDownload = async () => {
    if (!exportRef.current) return;
    try {
      const dataUrl = await htmlToImage.toPng(exportRef.current, { 
        quality: 1.0, 
        pixelRatio: 3, 
        backgroundColor: '#ffffff' 
      });
      const link = document.createElement('a');
      link.download = `DQR-${post.id}.png`; 
      link.href = dataUrl; 
      link.click();
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  const handleShare = async () => {
    if (!exportRef.current) return;
    setIsSharing(true);
    try {
      const dataUrl = await htmlToImage.toPng(exportRef.current, { 
        quality: 1.0, 
        pixelRatio: 2, 
        backgroundColor: '#ffffff' 
      });
      
      const [question] = post.visual_text.split('|').map(s => s.trim());
      const shareTitle = 'Daily Quiz & Riddles';
      const shareText = `Can you solve this? ${question} #DQR #Enigma`;

      // Try to share the image file if supported
      if (navigator.canShare && navigator.share) {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], `enigma.png`, { type: 'image/png' });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: shareTitle,
            text: shareText,
          });
        } else {
          // Fallback to text/url sharing
          await navigator.share({
            title: shareTitle,
            text: shareText,
            url: window.location.href,
          });
        }
      } else {
        // Desktop Fallback: Copy link or notify
        alert("Sharing is best on mobile devices. You can download the image and post it manually!");
      }
    } catch (err) {
      console.error('Error sharing:', err);
    } finally {
      setIsSharing(false);
    }
  };

  const [question, hook] = post.visual_text.split('|').map(s => s.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 bg-zinc-950 border border-zinc-800 rounded-[2.5rem] overflow-hidden h-[90vh] md:h-auto overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="relative bg-zinc-900 border-r border-zinc-800 p-8 flex flex-col items-center justify-center">
          <div ref={exportRef} className="aspect-square w-full max-w-[400px] bg-white rounded-3xl overflow-hidden relative border border-zinc-200 shadow-2xl">
            {localImageUrl && <img src={localImageUrl} className="absolute inset-0 w-full h-full object-cover opacity-20" alt="background" />}
            <div className="relative h-full p-8 flex flex-col justify-between text-zinc-900 text-center">
              <div className="flex justify-between items-start">
                <span className="px-3 py-1 bg-zinc-100 rounded-full text-[9px] font-black uppercase tracking-widest text-zinc-500">{post.category}</span>
                <div className="px-2 py-1 bg-[#0477CF] text-white rounded font-black text-xs">DQ&R</div>
              </div>
              <div className="space-y-4 px-2">
                <h3 className={`text-3xl font-bold leading-tight text-black ${post.category.includes('Math') ? 'font-mono-math' : ''}`}>{question}</h3>
                {hook && <p className="text-lg font-bold text-red-600 mt-2">{hook}</p>}
              </div>
              <p className="text-[12px] font-black tracking-[0.2em] uppercase text-[#0477CF]">Daily Quiz and Riddles</p>
            </div>
          </div>
          
          <div className="mt-6 flex gap-3 w-full max-w-[400px]">
            <button 
              onClick={handleGenerateGraphic} 
              disabled={generatingImage} 
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {generatingImage ? <Loader2 className="animate-spin" size={18} /> : <ImageIcon size={18} />}
              AI Backdrop
            </button>
            <button 
              onClick={handleShare} 
              disabled={isSharing}
              className="bg-[#0477CF] hover:bg-blue-600 text-white p-3 rounded-xl transition-all active:scale-95 disabled:opacity-50"
              title="Share to Social Media"
            >
              {isSharing ? <Loader2 className="animate-spin" size={20} /> : <Share2 size={20} />}
            </button>
            <button 
              onClick={handleDownload} 
              className="bg-white hover:bg-zinc-200 text-black p-3 rounded-xl transition-all active:scale-95"
              title="Download Image"
            >
              <Download size={20} />
            </button>
          </div>
        </div>

        <div className="p-8 md:p-12 flex flex-col gap-8 bg-zinc-950">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-black text-zinc-500 uppercase tracking-[0.2em]">Enigma Details</h2>
            <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors"><X size={24} /></button>
          </div>
          <div className="space-y-6">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 md:p-8">
              <div className="flex items-center gap-2 text-emerald-400 font-black text-[10px] mb-4 uppercase tracking-widest"><CheckCircle2 size={16} /> SOLUTION</div>
              <p className="text-emerald-50 text-2xl font-bold">{post.answer}</p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-3xl p-6 md:p-8">
              <div className="flex items-center gap-2 text-blue-400 font-black text-[10px] mb-4 uppercase tracking-widest"><Info size={16} /> THE LOGIC</div>
              <p className="text-zinc-300 leading-relaxed text-lg italic">{post.read_more_content}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-full bg-[#0477CF] hover:bg-blue-600 text-white font-bold py-5 rounded-2xl shadow-lg transition-all active:scale-[0.98]">DONE</button>
        </div>
      </div>
    </div>
  );
};

export default PostModal;