import React, { useState, useEffect } from 'react';
import { Wifi, Server, CheckCircle2, XCircle, RefreshCw, X, Radio } from 'lucide-react';
import { getApiBaseUrl, setCustomApiUrl, resetApiUrl, testApiConnection } from '../lib/api';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ServerSettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [currentUrl, setCurrentUrl] = useState(getApiBaseUrl());
  const [inputUrl, setInputUrl] = useState(getApiBaseUrl());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const active = getApiBaseUrl();
      setCurrentUrl(active);
      setInputUrl(active);
      handleTest(active);
    }
  }, [isOpen]);

  const handleTest = async (urlToTest: string) => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testApiConnection(urlToTest);
      setTestResult(result);
    } catch {
      setTestResult({ ok: false, message: 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (!inputUrl.trim()) {
      toast.error('Please enter a valid server URL');
      return;
    }
    setCustomApiUrl(inputUrl.trim());
    setCurrentUrl(inputUrl.trim());
    toast.success('Backend server address updated!');
    onClose();
  };

  const handleReset = () => {
    resetApiUrl();
    const def = getApiBaseUrl();
    setCurrentUrl(def);
    setInputUrl(def);
    handleTest(def);
    toast.success('Reset to default server URL');
  };

  if (!isOpen) return null;

  const presets = [
    { label: 'Laptop Wi-Fi (Physical Phone)', url: 'http://192.168.1.13:5000/api' },
    { label: 'Android Emulator Host', url: 'http://10.0.2.2:5000/api' },
    { label: 'Localhost (Web Browser)', url: 'http://localhost:5000/api' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-red-700 to-[#B71C1C] text-white">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-red-200" />
            <div>
              <h3 className="font-bold text-base leading-tight">API Server Connection</h3>
              <p className="text-xs text-red-100">Configure backend server address</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Live Status Banner */}
          <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
            testing
              ? 'bg-blue-50 border-blue-200 text-blue-900'
              : testResult?.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center gap-2.5">
              {testing ? (
                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
              ) : testResult?.ok ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600" />
              )}
              <div>
                <p className="text-xs font-bold">
                  {testing ? 'Testing connection...' : testResult?.ok ? 'Connected to Backend' : 'Server Unreachable'}
                </p>
                <p className="text-[11px] opacity-80 font-mono truncate max-w-[220px]">
                  {testResult?.message || currentUrl}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleTest(inputUrl)}
              disabled={testing}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border shadow-xs hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Test
            </button>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
              Quick Environments
            </label>
            <div className="space-y-1.5">
              {presets.map((preset) => (
                <button
                  key={preset.url}
                  type="button"
                  onClick={() => {
                    setInputUrl(preset.url);
                    handleTest(preset.url);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all border ${
                    inputUrl === preset.url
                      ? 'border-[#B71C1C] bg-red-50 text-[#B71C1C] font-semibold'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Radio className={`w-3.5 h-3.5 ${inputUrl === preset.url ? 'text-[#B71C1C]' : 'text-gray-400'}`} />
                    <span>{preset.label}</span>
                  </div>
                  <span className="font-mono text-[10px] opacity-60 truncate max-w-[140px]">{preset.url.replace('/api', '')}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Manual Input */}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
              Custom Server URL
            </label>
            <div className="relative">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="http://192.168.1.13:5000/api"
                className="w-full px-3 py-2 text-xs font-mono border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B71C1C]/20 focus:border-[#B71C1C]"
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              For physical phones on Wi-Fi, use your laptop's Wi-Fi IP with port 5000.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-gray-600 hover:text-gray-900 font-medium underline"
          >
            Reset Default
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 font-semibold rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-bold text-white bg-[#B71C1C] hover:bg-red-800 rounded-lg shadow-sm transition-colors"
            >
              Save & Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ServerConnectionBadge: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeUrl, setActiveUrl] = useState(getApiBaseUrl());
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const updateUrl = () => {
      const url = getApiBaseUrl();
      setActiveUrl(url);
      testApiConnection(url).then((res) => setIsOnline(res.ok));
    };

    updateUrl();
    window.addEventListener('bloodai_api_changed', updateUrl);
    const interval = setInterval(updateUrl, 30000);

    return () => {
      window.removeEventListener('bloodai_api_changed', updateUrl);
      clearInterval(interval);
    };
  }, []);

  const displayHost = activeUrl.replace(/^https?:\/\//, '').replace(/\/api$/, '');

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 text-[11px] font-mono rounded-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-xs transition-colors shrink-0"
        title="Click to configure backend API server address"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
        <Wifi className="w-3 h-3 text-gray-400 shrink-0" />
        <span className="hidden md:inline font-semibold text-gray-800 truncate max-w-[130px]">{displayHost}</span>
        <span className="md:hidden text-[10px] font-bold text-gray-700">API</span>
      </button>

      <ServerSettingsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
