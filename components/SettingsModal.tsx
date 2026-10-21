import React, { useState } from 'react';
import { X, Key, Check, AlertCircle, Loader2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { getGeminiApiKey, setGeminiApiKey } from '../services/geminiService';
import { getPixabayKey, setPixabayKey } from '../services/imageService';
import { GoogleGenAI } from '@google/genai';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [geminiKey, setGeminiKey] = useState(getGeminiApiKey());
  const [pixabayKey, setPixabayVal] = useState(getPixabayKey());
  const [testingGemini, setTestingGemini] = useState(false);
  const [testStatus, setTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saveMsg, setSaveMsg] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    setGeminiApiKey(geminiKey);
    setPixabayKey(pixabayKey);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" onClick={onClose}>
      <div 
        className="w-full max-w-lg bg-[#0e0e11] border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl relative text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#0477CF]/20 text-[#0477CF] rounded-2xl">
              <Key size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold font-heading">Engine Settings</h2>
              <p className="text-xs text-zinc-400">Configure your API keys</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-xl">
            <X size={20} />
          </button>
        </div>

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
                Get free key &rarr;
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
                Get free key &rarr;
              </a>
            </div>
            <p className="text-xs text-zinc-400">
              Enables searching 4+ million transparent vector illustrations. (Wikimedia Commons is used as default free fallback).
            </p>
            <input
              type="password"
              value={pixabayKey}
              onChange={(e) => setPixabayVal(e.target.value)}
              placeholder="e.g. 12345678-abcdef..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-4 flex gap-3">
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
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
