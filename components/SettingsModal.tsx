import React, { useState, useEffect } from 'react';
import { 
  X, Check, AlertCircle, Loader2, Sparkles, 
  Image as ImageIcon, Share2, Clock, Trash2, Globe
} from 'lucide-react';
import { testAllSocialIntegrations, SocialTestResult } from '../services/socialDirectService';
import { getGeminiApiKey, setGeminiApiKey } from '../services/geminiService';
import { getPixabayKey, setPixabayKey } from '../services/imageService';
import { GoogleGenAI } from '@google/genai';
import { SocialConfig, WordPressConfig } from '../types';
import { getSocialConfig, saveSocialConfig, getLocalSocialConfig } from '../services/socialService';
import { 
  getLocalWordPressConfig, 
  saveLocalWordPressConfig, 
  testWordPressConnection 
} from '../services/wordpressService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  userId?: string;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved, userId }) => {
  const [activeTab, setActiveTab] = useState<'ai' | 'social' | 'wordpress'>('wordpress');
  
  // AI Keys
  const [geminiKey, setGeminiKey] = useState(getGeminiApiKey());
  const [pixabayKey, setPixabayVal] = useState(getPixabayKey());
  const [testingGemini, setTestingGemini] = useState(false);
  const [testStatus, setTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  
  // Social Config - Initialize immediately from localStorage
  const [socialConfig, setSocialConfig] = useState<SocialConfig>(() => getLocalSocialConfig());
  const [saveMsg, setSaveMsg] = useState(false);
  const [isTestingSocials, setIsTestingSocials] = useState(false);
  const [socialTestResults, setSocialTestResults] = useState<SocialTestResult[] | null>(null);
  const [newTimeInput, setNewTimeInput] = useState('');

  // WordPress Config
  const [wpConfig, setWpConfig] = useState<WordPressConfig>(() => getLocalWordPressConfig());
  const [isTestingWp, setIsTestingWp] = useState(false);
  const [wpTestResult, setWpTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleTestWordPress = async () => {
    setIsTestingWp(true);
    setWpTestResult(null);
    try {
      saveLocalWordPressConfig(wpConfig);
      const res = await testWordPressConnection(wpConfig);
      setWpTestResult({ ok: res.success, msg: res.message });
    } catch (err: any) {
      setWpTestResult({ ok: false, msg: err?.message || String(err) });
    } finally {
      setIsTestingWp(false);
    }
  };

  const handleTestAllSocials = async () => {
    setIsTestingSocials(true);
    setSocialTestResults(null);
    try {
      await saveSocialConfig(userId, socialConfig);
      const results = await testAllSocialIntegrations(socialConfig);
      setSocialTestResults(results);
    } catch (err: any) {
      setSocialTestResults([
        { platform: 'buffer', name: 'Buffer Connection', success: false, error: err?.message || String(err) }
      ]);
    } finally {
      setIsTestingSocials(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const local = getLocalSocialConfig();
      setSocialConfig(local);
      setWpConfig(getLocalWordPressConfig());
      if (userId) {
        getSocialConfig(userId).then((cfg) => setSocialConfig(cfg));
      }
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setGeminiApiKey(geminiKey);
    setPixabayKey(pixabayKey);
    saveLocalWordPressConfig(wpConfig);
    await saveSocialConfig(userId, socialConfig);

    setSaveMsg(true);
    setTimeout(() => {
      setSaveMsg(false);
      onSaved?.();
      onClose();
    }, 800);
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

  const removeScheduleTime = (timeToRemove: string) => {
    setSocialConfig({
      ...socialConfig,
      scheduleTimes: (socialConfig.scheduleTimes || []).filter(t => t !== timeToRemove)
    });
  };

  const addScheduleTime = () => {
    if (!newTimeInput) return;
    const current = socialConfig.scheduleTimes || [];
    if (!current.includes(newTimeInput)) {
      setSocialConfig({
        ...socialConfig,
        scheduleTimes: [...current, newTimeInput].sort()
      });
    }
    setNewTimeInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-xl p-4 sm:p-6 shadow-2xl relative flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-bold font-heading">Settings & Autopost</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Manage your API keys, schedule times, and automated publishing.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex gap-1.5 sm:gap-2 pt-3 pb-2 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('wordpress')}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'wordpress' 
                ? 'bg-[#0477CF] text-white shadow-md' 
                : 'bg-zinc-800/60 text-zinc-400 hover:text-white'
            }`}
          >
            <Globe size={14} /> WordPress Blog
          </button>
          <button
            onClick={() => setActiveTab('social')}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'social' 
                ? 'bg-[#0477CF] text-white shadow-md' 
                : 'bg-zinc-800/60 text-zinc-400 hover:text-white'
            }`}
          >
            <Share2 size={14} /> Social Autopost
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'ai' 
                ? 'bg-[#0477CF] text-white shadow-md' 
                : 'bg-zinc-800/60 text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles size={14} /> AI & Media Keys
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto pr-1 py-3 flex-1 space-y-4">
          {activeTab === 'wordpress' && (
            <div className="space-y-4">
              <div className="border border-zinc-800 bg-zinc-950/80 p-4 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe size={18} className="text-[#0477CF]" />
                    <div>
                      <h3 className="text-sm font-bold text-white">WordPress Integration</h3>
                      <p className="text-[11px] text-zinc-400">Auto-publish companion articles directly to quizandriddles.com</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wpConfig.enabled}
                      onChange={(e) => setWpConfig({ ...wpConfig, enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0477CF]"></div>
                  </label>
                </div>

                <div className="space-y-3 pt-2 border-t border-zinc-800/80 text-xs">
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">WordPress Site URL</label>
                    <input
                      type="url"
                      value={wpConfig.siteUrl}
                      onChange={(e) => setWpConfig({ ...wpConfig, siteUrl: e.target.value })}
                      placeholder="https://quizandriddles.com"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#0477CF]"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">WordPress Username</label>
                    <input
                      type="text"
                      value={wpConfig.username}
                      onChange={(e) => setWpConfig({ ...wpConfig, username: e.target.value })}
                      placeholder="aeskay"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#0477CF]"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">Application Password</label>
                    <input
                      type="password"
                      value={wpConfig.applicationPassword}
                      onChange={(e) => setWpConfig({ ...wpConfig, applicationPassword: e.target.value })}
                      placeholder="xxxx xxxx xxxx xxxx"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#0477CF]"
                    />
                    <p className="text-[10px] text-zinc-500 mt-1">Generated in WP Admin &rarr; Users &rarr; Profile &rarr; Application Passwords.</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-zinc-900/60 rounded-xl border border-zinc-800/80">
                    <div>
                      <span className="font-bold text-zinc-200 block">Auto-Publish with Social Queue</span>
                      <span className="text-[11px] text-zinc-400">Automatically schedule companion articles when queuing social posts</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!wpConfig.autoPublishWithQueue}
                      onChange={(e) => setWpConfig({ ...wpConfig, autoPublishWithQueue: e.target.checked })}
                      className="w-4 h-4 rounded text-[#0477CF] focus:ring-0 focus:ring-offset-0 bg-zinc-800 border-zinc-700"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleTestWordPress}
                      disabled={isTestingWp}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                      {isTestingWp ? <Loader2 size={13} className="animate-spin text-blue-400" /> : <Globe size={13} />}
                      <span>{isTestingWp ? 'Verifying...' : 'Test Connection'}</span>
                    </button>
                  </div>

                  {wpTestResult && (
                    <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                      wpTestResult.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
                    }`}>
                      {wpTestResult.ok ? <Check size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
                      <span>{wpTestResult.msg}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'social' && (
            <div className="space-y-4">
              
              {/* Autopost Master Toggle & Scheduled Times */}
              <div className="border border-zinc-800 bg-zinc-950/80 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-[#0477CF]" />
                    <div>
                      <span className="font-bold text-sm text-white">24/7 Autopost Schedule</span>
                      <p className="text-[10px] text-zinc-400">Queue items publish automatically at these daily times.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSocialConfig({ ...socialConfig, autopostEnabled: !socialConfig.autopostEnabled })}
                    className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${socialConfig.autopostEnabled ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                  >
                    {socialConfig.autopostEnabled ? 'ENABLED' : 'PAUSED'}
                  </button>
                </div>

                {/* Slots display */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {(socialConfig.scheduleTimes || ['09:00', '13:00', '18:00']).map((time) => (
                    <span 
                      key={time} 
                      className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-300 flex items-center gap-1.5"
                    >
                      {time}
                      <button 
                        type="button" 
                        onClick={() => removeScheduleTime(time)}
                        className="text-zinc-500 hover:text-red-400"
                        title="Remove time"
                      >
                        <Trash2 size={12} />
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
              <div className="border border-zinc-800 bg-zinc-950/80 p-4 rounded-2xl space-y-3">
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

              {/* Unified Buffer Multi-Channel Pipeline */}
              <div className="border border-zinc-800 bg-zinc-950/80 p-4 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white flex items-center gap-2">
                      <Share2 size={16} className="text-[#0477CF]" /> Buffer Multi-Channel Publishing
                    </span>
                    <a href="https://publish.buffer.com" target="_blank" rel="noreferrer" className="text-[10px] text-[#0477CF] hover:underline">
                      publish.buffer.com &rarr;
                    </a>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                    3/3 Channels Connected
                  </span>
                </div>

                <p className="text-[11px] text-zinc-400">
                  Buffer automatically publishes your cards to all 4 destinations (Instagram + FB cross-post, TikTok, and Twitter / X) with zero developer portal setups.
                </p>

                {/* Connected Channels Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 flex items-center gap-2.5">
                    <span className="text-base">📸</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">quiz_riddles_</div>
                      <div className="text-[10px] text-zinc-400">Instagram (+ FB Page)</div>
                    </div>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 flex items-center gap-2.5">
                    <span className="text-base">🎵</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">quiz_riddles1</div>
                      <div className="text-[10px] text-zinc-400">TikTok</div>
                    </div>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 flex items-center gap-2.5">
                    <span className="text-base">𝕏</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">quiz_riddles</div>
                      <div className="text-[10px] text-zinc-400">Twitter / X</div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">Buffer Access Token</label>
                  <input
                    type="password"
                    placeholder="Buffer Access Token"
                    value={socialConfig.buffer?.accessToken || (process.env.VITE_BUFFER_ACCESS_TOKEN || '')}
                    onChange={(e) => setSocialConfig({
                      ...socialConfig,
                      buffer: {
                        accessToken: e.target.value,
                        channelId: socialConfig.buffer?.channelId || '6ada7779778b240e2f9221b8',
                        enabled: true
                      }
                    })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#0477CF]"
                  />
                </div>
              </div>

              {/* Diagnostic Test Box */}
              <div className="border border-blue-500/30 bg-blue-500/5 p-4 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-sm text-white flex items-center gap-2">
                      <Sparkles size={16} className="text-[#0477CF]" /> Verify Buffer Channel Connections
                    </span>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Verifies that your Buffer token is active and confirms all 3 channels are reachable (without posting test spam).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestAllSocials}
                    disabled={isTestingSocials}
                    className="px-4 py-2 bg-[#0477CF] hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
                  >
                    {isTestingSocials ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {isTestingSocials ? 'Verifying...' : '⚡ Verify Channels'}
                  </button>
                </div>

                {socialTestResults && (
                  <div className="space-y-2 pt-2 border-t border-zinc-800">
                    {socialTestResults.map((r, i) => (
                      <div
                        key={i}
                        className={`p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 border ${
                          r.success
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-red-500/10 border-red-500/30 text-red-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {r.success ? <Check size={14} className="text-emerald-400 shrink-0" /> : <AlertCircle size={14} className="text-red-400 shrink-0" />}
                          <span className="font-bold">{r.name}:</span>
                          <span>{r.success ? `Connected & Ready` : `Failed (${r.error})`}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
