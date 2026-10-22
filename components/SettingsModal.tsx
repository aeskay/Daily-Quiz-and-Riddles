import React, { useState, useEffect } from 'react';
import { 
  X, Key, Check, AlertCircle, Loader2, Sparkles, 
  Image as ImageIcon, Share2, Clock, Calendar, CheckSquare, Square
} from 'lucide-react';
import { getGeminiApiKey, setGeminiApiKey } from '../services/geminiService';
import { getPixabayKey, setPixabayKey } from '../services/imageService';
import { GoogleGenAI } from '@google/genai';
import { SocialConfig } from '../types';
import { getSocialConfig, saveSocialConfig, DEFAULT_SOCIAL_CONFIG, getLocalSocialConfig } from '../services/socialService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  userId?: string;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved, userId }) => {
  const [activeTab, setActiveTab] = useState<'ai' | 'social'>('social');
  
  // AI Keys
  const [geminiKey, setGeminiKey] = useState(getGeminiApiKey());
  const [pixabayKey, setPixabayVal] = useState(getPixabayKey());
  const [testingGemini, setTestingGemini] = useState(false);
  const [testStatus, setTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  
  // Social Config - Initialize immediately from localStorage so keys never disappear
  const [socialConfig, setSocialConfig] = useState<SocialConfig>(() => getLocalSocialConfig());
  const [saveMsg, setSaveMsg] = useState(false);
  const [newTimeInput, setNewTimeInput] = useState('');
  const [detectingIg, setDetectingIg] = useState(false);
  const [detectIgMsg, setDetectIgMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const local = getLocalSocialConfig();
      setSocialConfig(local);
      if (userId) {
        getSocialConfig(userId).then((cfg) => setSocialConfig(cfg));
      }
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setGeminiApiKey(geminiKey);
    setPixabayKey(pixabayKey);
    await saveSocialConfig(userId, socialConfig);

    setSaveMsg(true);
    setTimeout(() => {
      setSaveMsg(false);
      onSaved?.();
      onClose();
    }, 800);
  };


  const handleDetectInstagram = async () => {
    if (!socialConfig.meta.pageId.trim() || !socialConfig.meta.accessToken.trim()) {
      setDetectIgMsg({ ok: false, msg: "Please enter your Facebook Page ID and Access Token first." });
      return;
    }
    setDetectingIg(true);
    setDetectIgMsg(null);
    try {
      const pageId = socialConfig.meta.pageId.trim();
      const token = socialConfig.meta.accessToken.trim();
      const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}?fields=name,instagram_business_account&access_token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (data.instagram_business_account?.id) {
        setSocialConfig({
          ...socialConfig,
          meta: {
            ...socialConfig.meta,
            instagramAccountId: data.instagram_business_account.id,
            postToInstagram: true
          }
        });
        setDetectIgMsg({ ok: true, msg: `Found IG ID: ${data.instagram_business_account.id}! Auto-filled & enabled.` });
      } else if (data.error) {
        setDetectIgMsg({ ok: false, msg: data.error.message || "Meta API error" });
      } else {
        setDetectIgMsg({ ok: false, msg: "No Instagram Business account linked to this Facebook Page." });
      }
    } catch (err: any) {
      setDetectIgMsg({ ok: false, msg: err?.message || "Detection request failed" });
    } finally {
      setDetectingIg(false);
    }
  };

  const handleTestKey = async () => {
    if (!geminiKey.trim()) {
      setTestStatus({ ok: false, msg: 'Please enter a Gemini API Key to test.' });
      return;
    }
    setTestingGemini(true);
    setTestStatus(null);
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey.trim() });
      const res = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: 'Say OK',
      });
      if (res.text) {
        setTestStatus({ ok: true, msg: 'API Key is valid and working!' });
      } else {
        setTestStatus({ ok: false, msg: 'No response from model.' });
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('prepayment') || msg.includes('depleted') || err?.status === 402) {
        setTestStatus({ ok: false, msg: 'Prepayment credits depleted on this project. Generate a new key from a free project at aistudio.google.com.' });
      } else {
        setTestStatus({ ok: false, msg: msg });
      }
    } finally {
      setTestingGemini(false);
    }
  };

  const addScheduleTime = () => {
    if (!newTimeInput) return;
    if (!socialConfig.scheduleTimes.includes(newTimeInput)) {
      setSocialConfig({
        ...socialConfig,
        scheduleTimes: [...socialConfig.scheduleTimes, newTimeInput].sort(),
      });
    }
    setNewTimeInput('');
  };

  const removeScheduleTime = (timeToRemove: string) => {
    setSocialConfig({
      ...socialConfig,
      scheduleTimes: socialConfig.scheduleTimes.filter(t => t !== timeToRemove),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" onClick={onClose}>
      <div 
        className="w-full max-w-2xl bg-[#0e0e11] border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl relative text-white max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#0477CF]/20 text-[#0477CF] rounded-2xl">
              <Key size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold font-heading">Settings & Autopost</h2>
              <p className="text-xs text-zinc-400">Configure AI generation and automated social posting</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-xl">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 mb-5 shrink-0">
          <button
            onClick={() => setActiveTab('social')}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs border-b-2 transition-colors ${activeTab === 'social' ? 'border-[#0477CF] text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
          >
            <Share2 size={15} /> Social Autopost (X, IG, FB, TikTok)
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs border-b-2 transition-colors ${activeTab === 'ai' ? 'border-[#0477CF] text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
          >
            <Sparkles size={15} /> AI & Engine Keys
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-6">
          {activeTab === 'social' && (
            <div className="space-y-6">
              {/* Autopilot Master Switch */}
              <div className="bg-zinc-900/90 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock size={16} className="text-[#0477CF]" /> Background Autopilot
                </h4>
                <button
                  onClick={() => setSocialConfig({ ...socialConfig, autopostEnabled: !socialConfig.autopostEnabled })}
                  className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${socialConfig.autopostEnabled ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                >
                  {socialConfig.autopostEnabled ? 'ENABLED' : 'PAUSED'}
                </button>
              </div>

              {/* Schedule Slots */}
              <div className="space-y-3 bg-zinc-950/60 border border-zinc-850 p-4 rounded-2xl">
                <label className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                  <Calendar size={14} className="text-[#0477CF]" /> Daily Schedule
                </label>

                <div className="flex flex-wrap gap-2 pt-1">
                  {socialConfig.scheduleTimes.map((time) => (
                    <span 
                      key={time} 
                      className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2"
                    >
                      {time}
                      <button 
                        onClick={() => removeScheduleTime(time)} 
                        className="text-zinc-400 hover:text-red-400"
                        title="Remove slot"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <input
                    type="time"
                    value={newTimeInput}
                    onChange={(e) => setNewTimeInput(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={addScheduleTime}
                    className="px-3 py-1.5 bg-[#0477CF] hover:bg-blue-600 text-white font-bold text-xs rounded-xl"
                  >
                    + Add Slot
                  </button>
                </div>
              </div>

              {/* Image Hosting (ImgBB) */}
              <div className="border border-zinc-850 bg-zinc-950/80 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-white">🖼️ Image Hosting (ImgBB)</span>
                  <a href="https://api.imgbb.com" target="_blank" rel="noreferrer" className="text-[10px] text-[#0477CF] hover:underline">
                    api.imgbb.com &rarr;
                  </a>
                </div>
                <input
                  type="password"
                  placeholder="ImgBB API Key"
                  value={socialConfig.imgbbApiKey || ''}
                  onChange={(e) => setSocialConfig({ ...socialConfig, imgbbApiKey: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#0477CF]"
                />
              </div>

              {/* 1. Twitter / X via Buffer */}
              <div className="border border-zinc-850 bg-zinc-950/80 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-white">𝕏 Twitter (via Buffer)</span>
                  <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={socialConfig.buffer?.enabled ?? true}
                      onChange={(e) => setSocialConfig({
                        ...socialConfig,
                        buffer: {
                          accessToken: socialConfig.buffer?.accessToken || 'i-mLlsruAUr7fE3HtY4tkZY5L1tAwLweU1ihZK3etwT',
                          channelId: socialConfig.buffer?.channelId || '6ada7779778b240e2f9221b8',
                          enabled: e.target.checked
                        }
                      })}
                      className="rounded"
                    />
                    Enable
                  </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-1">Buffer Access Token</label>
                    <input
                      type="password"
                      placeholder="Buffer Access Token"
                      value={socialConfig.buffer?.accessToken ?? 'i-mLlsruAUr7fE3HtY4tkZY5L1tAwLweU1ihZK3etwT'}
                      onChange={(e) => setSocialConfig({
                        ...socialConfig,
                        buffer: {
                          accessToken: e.target.value,
                          channelId: socialConfig.buffer?.channelId || '6ada7779778b240e2f9221b8',
                          enabled: socialConfig.buffer?.enabled ?? true
                        }
                      })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-1">Buffer Channel ID (@quiz_riddles)</label>
                    <input
                      type="text"
                      placeholder="Buffer Channel ID"
                      value={socialConfig.buffer?.channelId ?? '6ada7779778b240e2f9221b8'}
                      onChange={(e) => setSocialConfig({
                        ...socialConfig,
                        buffer: {
                          accessToken: socialConfig.buffer?.accessToken || '',
                          channelId: e.target.value,
                          enabled: socialConfig.buffer?.enabled ?? true
                        }
                      })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Meta: Facebook & Instagram */}
              <div className="border border-zinc-850 bg-zinc-950/80 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">📸 Instagram & Facebook (Meta)</span>
                    <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-[10px] text-[#0477CF] hover:underline">
                      Graph API Explorer &rarr;
                    </a>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={socialConfig.meta.postToInstagram}
                        onChange={(e) => setSocialConfig({
                          ...socialConfig,
                          meta: { ...socialConfig.meta, postToInstagram: e.target.checked }
                        })}
                      />
                      IG
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={socialConfig.meta.postToFacebook}
                        onChange={(e) => setSocialConfig({
                          ...socialConfig,
                          meta: { ...socialConfig.meta, postToFacebook: e.target.checked }
                        })}
                      />
                      FB Page
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    placeholder="Facebook Page ID"
                    value={socialConfig.meta.pageId}
                    onChange={(e) => setSocialConfig({ ...socialConfig, meta: { ...socialConfig.meta, pageId: e.target.value } })}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  />
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Instagram Business/Creator ID"
                      value={socialConfig.meta.instagramAccountId}
                      onChange={(e) => setSocialConfig({ ...socialConfig, meta: { ...socialConfig.meta, instagramAccountId: e.target.value } })}
                      className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white flex-1 min-w-0"
                    />
                    <button
                      type="button"
                      onClick={handleDetectInstagram}
                      disabled={detectingIg || !socialConfig.meta.pageId}
                      className="px-2.5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-bold text-[10px] shrink-0 disabled:opacity-50 transition-all flex items-center gap-1 shadow-md"
                      title="Auto-detect Instagram Business ID using your saved Facebook credentials"
                    >
                      {detectingIg ? <Loader2 size={12} className="animate-spin" /> : '⚡ Auto-Detect'}
                    </button>
                  </div>
                  <input
                    type="password"
                    placeholder="Long-Lived Page Access Token"
                    value={socialConfig.meta.accessToken}
                    onChange={(e) => setSocialConfig({ ...socialConfig, meta: { ...socialConfig.meta, accessToken: e.target.value } })}
                    className="md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                {detectIgMsg && (
                  <p className={`text-[11px] font-semibold mt-1.5 ${detectIgMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {detectIgMsg.msg}
                  </p>
                )}
              </div>

              {/* 3. TikTok */}
              <div className="border border-zinc-850 bg-zinc-950/80 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">🎵 TikTok</span>
                    <a href="https://developers.tiktok.com" target="_blank" rel="noreferrer" className="text-[10px] text-[#0477CF] hover:underline">
                      TikTok Developers &rarr;
                    </a>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={socialConfig.tiktok.enabled}
                      onChange={(e) => setSocialConfig({
                        ...socialConfig,
                        tiktok: { ...socialConfig.tiktok, enabled: e.target.checked }
                      })}
                      className="rounded"
                    />
                    Enable
                  </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <input
                    type="password"
                    placeholder="TikTok User Access Token"
                    value={socialConfig.tiktok.accessToken}
                    onChange={(e) => setSocialConfig({ ...socialConfig, tiktok: { ...socialConfig.tiktok, accessToken: e.target.value } })}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  />
                  <input
                    type="text"
                    placeholder="TikTok OpenID (optional)"
                    value={socialConfig.tiktok.openId}
                    onChange={(e) => setSocialConfig({ ...socialConfig, tiktok: { ...socialConfig.tiktok, openId: e.target.value } })}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-6">

              {/* Gemini Key */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold flex items-center gap-2 text-zinc-200">
                    <Sparkles size={14} className="text-[#0477CF]" /> Google Gemini API Key
                  </label>
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-[11px] text-[#0477CF] hover:underline"
                  >
                    Documentation &rarr;
                  </a>
                </div>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#0477CF]"
                />
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTestKey}
                    disabled={testingGemini}
                    className="text-xs font-semibold px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {testingGemini ? <Loader2 size={12} className="animate-spin" /> : null}
                    Test Connection
                  </button>
                </div>

                {testStatus && (
                  <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${testStatus.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                    {testStatus.ok ? <Check size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
                    <span>{testStatus.msg}</span>
                  </div>
                )}
              </div>

              {/* Pixabay Key */}
              <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold flex items-center gap-2 text-zinc-200">
                    <ImageIcon size={14} className="text-emerald-400" /> Pixabay API Key (Optional)
                  </label>
                  <a 
                    href="https://pixabay.com/api/docs/" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-[11px] text-emerald-400 hover:underline"
                  >
                    Documentation &rarr;
                  </a>
                </div>
                <input
                  type="password"
                  value={pixabayKey}
                  onChange={(e) => setPixabayVal(e.target.value)}
                  placeholder="e.g. 12345678-abcdef..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-5 border-t border-zinc-800/80 flex gap-3 shrink-0">
          <button
            onClick={handleSave}
            className="flex-1 bg-[#0477CF] hover:bg-blue-600 font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg"
          >
            {saveMsg ? <Check size={18} /> : null}
            {saveMsg ? 'Saved!' : 'Save Settings'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3.5 bg-zinc-800 hover:bg-zinc-700 font-semibold rounded-xl text-zinc-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
