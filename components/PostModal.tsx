
import React, { useState, useRef } from 'react';
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
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(post?.imageUrl || null);
  const exportRef = useRef<HTMLDivElement>(null);

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
        pixelRatio: 3, // Higher resolution for social media
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `DQ&R-${post.id}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const [question, hook] = post.visual_text.split('|').map(s => s.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div 
        className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 bg-zinc-950 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl transform transition-all animate-in zoom-in-95 duration-300 h-[90vh] md:h-auto overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Side: The Social Card Export Preview */}
        <div className="relative bg-zinc-900 border-r border-zinc-800 p-8 flex flex-col items-center justify-center">
          <div className="mb-4 text-zinc-500 text-[10px] font-black tracking-widest uppercase flex items-center gap-2">
            <Share2 size={12} /> Social Media Preview
          </div>
          
          <div 
            ref={exportRef}
            className="aspect-square w-full max-w-[400px] bg-white rounded-3xl overflow-hidden relative border border-zinc-200 shadow-2xl"
          >
            {localImageUrl ? (
              <img src={localImageUrl} alt="AI Generated Graphic" className="absolute inset-0 w-full h-full object-cover opacity-20" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-50 to-white opacity-100" />
            )}
            
            <div className="relative h-full p-8 flex flex-col justify-between text-zinc-900">
              <div className="flex justify-between items-start">
                <span className="px-3 py-1 bg-zinc-100 rounded-full text-[9px] font-black tracking-widest uppercase border border-zinc-200">
                  {post.category}
                </span>
                <div className="px-2 py-1 bg-[#0477CF] text-white rounded font-black text-xs tracking-tighter">DQ&R</div>
              </div>

              <div className="text-center space-y-4 px-2">
                <h3 className={`text-3xl font-bold font-heading leading-tight text-black ${post.category.includes('Math') ? 'font-mono-math' : ''}`}>
                  {question}
                </h3>
                {hook && (
                  <p className="text-lg font-bold text-red-600 mt-2 leading-tight">
                    {hook}
                  </p>
                )}
              </div>

              <div className="text-center">
                <p className="text-[12px] font-black tracking-[0.2em] uppercase text-[#0477CF]">Daily Quiz and Riddles</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3 w-full max-w-[400px]">
            <button 
              onClick={handleGenerateGraphic}
              disabled={generatingImage}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {generatingImage ? <Loader2 className="animate-spin" size={18} /> : <ImageIcon size={18} />}
              {localImageUrl ? 'Re-Gen Backdrop' : 'Add AI Backdrop'}
            </button>
            <button 
              onClick={handleDownload}
              className="bg-white hover:bg-zinc-200 text-black font-bold p-3 rounded-xl transition-all active:scale-95"
              title="Download Card"
            >
              <Download size={20} />
            </button>
          </div>
        </div>

        {/* Right Side: Answer & Logic */}
        <div className="p-8 md:p-12 flex flex-col gap-8 bg-zinc-950 overflow-y-auto">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-black tracking-widest text-zinc-500 uppercase">Enigma Details</h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-zinc-900 rounded-full text-zinc-500 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="space-y-6">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 md:p-8">
              <div className="flex items-center gap-2 text-emerald-400 font-black text-[10px] tracking-widest mb-4">
                <CheckCircle2 size={16} />
                <span>OFFICIAL SOLUTION</span>
              </div>
              <p className="text-emerald-50 text-2xl font-bold leading-relaxed">
                {post.answer}
              </p>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-3xl p-6 md:p-8">
              <div className="flex items-center gap-2 text-blue-400 font-black text-[10px] tracking-widest mb-4">
                <Info size={16} />
                <span>THE LOGIC / WHY IT'S TRICKY</span>
              </div>
              <p className="text-zinc-300 leading-relaxed text-lg italic font-light">
                {post.read_more_content}
              </p>
            </div>
          </div>

          <div className="mt-auto pt-8 border-t border-zinc-900">
             <button 
                onClick={onClose}
                className="w-full bg-[#0477CF] hover:bg-blue-600 text-white font-bold py-5 rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-500/20"
              >
                DONE
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostModal;
