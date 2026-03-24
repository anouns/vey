import React, { useState, useEffect, useRef, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

// ─── SETTINGS PANEL (screenshot-style) ─────────────────────────────
function SettingsPanel({ settings, setSettings, ollamaModels, groqModels, onClose, setSelectedModel }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-6" onClick={onClose}>
      <div className="bg-[#0d0f0d] border border-[#4ade80]/20 w-full max-w-[680px] rounded-lg shadow-[0_0_60px_rgba(74,222,128,0.06)] overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-8 py-5 flex justify-between items-center bg-[#0a0c0a] border-b border-[#4ade80]/10">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#4ade80] text-[20px]">settings</span>
            <span className="text-[12px] font-black tracking-[0.25em] uppercase text-[#4ade80]">
              SYSTEM_PARAMETERS // V.2.1.0
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">STATUS: CONFIG_MODE</span>
            <div className="w-2 h-2 rounded-full bg-[#4ade80] shadow-[0_0_8px_#4ade80]"></div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {/* Section 01: Neural Engine */}
          <div className="space-y-5">
            <div className="inline-block border border-white/10 rounded px-3 py-1.5">
              <span className="text-[10px] font-black tracking-[0.2em] uppercase text-white/50">01. NEURAL_ENGINE</span>
            </div>

            <div className="grid grid-cols-2 gap-5">
              {/* Ollama Provider */}
              <div className="space-y-2">
                <span className="text-[9px] text-[#4ade80] uppercase font-bold tracking-[0.2em]">PROVIDER: OLLAMA</span>
                <select
                  value={settings.ollamaModel}
                  onChange={(e) => setSettings({...settings, ollamaModel: e.target.value})}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-md px-4 py-3 text-[12px] font-bold text-white/80 focus:border-[#4ade80]/40 outline-none transition-colors hover:border-white/20"
                >
                  {ollamaModels.length > 0 ? (
                    ollamaModels.map(m => <option key={m} value={m}>{m}</option>)
                  ) : (
                    <option>No models found</option>
                  )}
                </select>
                <div className="text-[9px] text-white/20 font-mono">Localhost connection active :11434</div>
              </div>

              {/* Groq Provider */}
              <div className="space-y-2">
                <span className="text-[9px] text-[#4ade80] uppercase font-bold tracking-[0.2em]">PROVIDER: GROQ_CLOUD</span>
                <input
                  type="password"
                  placeholder="••••••••••••••"
                  value={settings.groqKey}
                  onChange={(e) => setSettings({...settings, groqKey: e.target.value})}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-md px-4 py-3 text-[13px] font-mono text-white/80 focus:border-[#4ade80]/40 outline-none placeholder:text-white/10 transition-colors hover:border-white/20"
                />
              </div>
            </div>

            {/* Groq Model Selector */}
            <div className="flex justify-end">
              <div className="w-[calc(50%-10px)]">
                <select
                  value={settings.groqModel || ''}
                  onChange={(e) => {
                    setSettings(prev => ({...prev, groqModel: e.target.value}));
                    setSelectedModel(e.target.value);
                  }}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-md px-4 py-3 text-[11px] font-bold text-white/80 focus:border-[#4ade80]/40 outline-none transition-colors hover:border-white/20"
                >
                  {groqModels.length > 0 ? (
                    groqModels.map(m => <option key={m} value={m}>{m} (Production)</option>)
                  ) : (
                    <option>Enter Key to load models</option>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Section 02: Visual Interface */}
          <div className="space-y-5">
            <div className="inline-block border border-white/10 rounded px-3 py-1.5">
              <span className="text-[10px] font-black tracking-[0.2em] uppercase text-white/50">02. VISUAL_INTERFACE</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'Obsidian', label: 'OBSIDIAN_DEFAULT', colors: ['#1a1a2e', '#4ade80', '#38bdf8'], active: true },
                { id: 'High Contrast', label: 'HIGH_CONTRAST', colors: ['#1a1a2e', '#ec4899', '#a855f7'], active: false },
                { id: 'Light Theme', label: 'AMBER_TERMINAL', colors: ['#f59e0b', '#fb923c'], active: false },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setSettings({...settings, theme: t.id})}
                  className={`relative py-5 px-4 border rounded-md text-[9px] font-black tracking-[0.15em] uppercase transition-all text-left ${
                    settings.theme === t.id
                      ? 'bg-[#4ade80]/5 border-[#4ade80]/50 text-[#4ade80]'
                      : 'bg-[#0a0a0a] border-white/8 text-white/30 hover:border-white/20'
                  }`}
                >
                  {settings.theme === t.id && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#4ade80] shadow-[0_0_8px_#4ade80]"></div>
                  )}
                  <div className="mb-3">{t.label}</div>
                  <div className="flex gap-1.5">
                    {t.colors.map((c, i) => (
                      <div key={i} className="w-4 h-4 rounded-sm" style={{ backgroundColor: c }}></div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Status Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <div className="space-y-1">
              <div className="text-[9px] text-white/30 font-bold uppercase tracking-widest">LOCAL_AUTH: VERIFIED</div>
              <div className="text-[9px] text-[#4ade80] font-bold uppercase tracking-widest">SYNC: ENABLED</div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-3 border border-white/10 text-white/40 text-[10px] font-black uppercase tracking-[0.15em] rounded-md hover:bg-white/5 transition-all"
              >
                CLOSE_SESSION
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-[#4ade80] text-black text-[10px] font-black uppercase tracking-[0.15em] rounded-md hover:bg-[#22c55e] transition-all shadow-[0_0_20px_rgba(74,222,128,0.15)] flex items-center gap-2"
              >
                COMMIT_CHANGES
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── INTERACTIVE TERMINAL ──────────────────────────────────────────
const InteractiveTerminal = ({ initialCmd, initialOutput }) => {
  const [history, setHistory] = useState([{ cmd: initialCmd, output: initialOutput }]);
  const [input, setInput] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const bottomRef = useRef(null);

  const runCmd = async (e) => {
    e.preventDefault();
    if (!input.trim() || isWorking) return;
    const cmd = input.trim();
    setInput('');
    setIsWorking(true);
    setHistory(prev => [...prev, { cmd, output: '...' }]);
    try {
      const response = await fetch('http://127.0.0.1:8000/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      });
      const data = await response.json();
      setHistory(prev => {
        const updated = [...prev];
        updated[updated.length - 1].output = data.output;
        return updated;
      });
    } catch (err) {
      setHistory(prev => {
        const updated = [...prev];
        updated[updated.length - 1].output = 'FATAL_ERROR: Connection lost.';
        return updated;
      });
    }
    setIsWorking(false);
    bottomRef.current?.scrollIntoView();
  };

  return (
    <div className="bg-[#0a0c0a] border border-[#4ade80]/15 p-6 font-mono text-[13px] group relative rounded-lg mt-4 transition-all flex flex-col">
      <div className="absolute right-4 top-4 text-[10px] text-[#4ade80]/50 flex gap-3 uppercase tracking-widest font-sans font-black">
        TERMINAL_SESSION
        <span className="material-symbols-outlined text-[14px]">terminal</span>
      </div>
      <div className="flex-1 overflow-x-auto text-white/70 whitespace-pre custom-scrollbar pb-2 leading-relaxed max-h-[300px] overflow-y-auto">
        {history.map((h, i) => (
          <div key={i} className="mb-4">
            <div className="text-[#4ade80] font-bold">{'>'} {h.cmd}</div>
            <div className="opacity-80 mt-1 selection:bg-[#4ade80]/30">{h.output}</div>
          </div>
        ))}
        {isWorking && <div className="text-[#4ade80] animate-pulse">...</div>}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={runCmd} className="mt-3 flex items-center pt-3 opacity-50 focus-within:opacity-100 transition-opacity">
        <span className="text-[#4ade80] font-bold mr-3">{'>'}</span>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          className="flex-1 bg-transparent outline-none text-[#4ade80] placeholder:text-[#4ade80]/20 font-mono text-[12px]"
          placeholder="Enter command..."
        />
      </form>
    </div>
  );
};

// ─── MAIN APP ──────────────────────────────────────────────────────
function App() {
  const loadSettings = () => {
    const saved = localStorage.getItem('vey_settings');
    if (saved) return JSON.parse(saved);
    return { groqKey: '', ollamaModel: 'deepseek-coder', groqModel: '', theme: 'Obsidian' };
  };

  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(localStorage.getItem('vey_model') || 'PYTHON_LOCAL_AI');
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'VEY', content: 'Система инициализирована. Готов к работе.' }
  ]);
  const [metrics, setMetrics] = useState({ cpu: 0, memory: 0, indexing: 0 });
  const [workspacePath, setWorkspacePath] = useState(localStorage.getItem('vey_workspace') || '');
  const [workspaceFiles, setWorkspaceFiles] = useState([]);
  const [ollamaModels, setOllamaModels] = useState([]);
  const [groqModels, setGroqModels] = useState([]);
  const [backendReady, setBackendReady] = useState(false);
  const [bootMessage, setBootMessage] = useState("INITIALIZING NEURAL LINK");
  const [expandedFolders, setExpandedFolders] = useState(new Set(['.']));
  const [pendingFileChange, setPendingFileChange] = useState(null);
  const [settings, setSettings] = useState(loadSettings());
  const [isThinking, setIsThinking] = useState(false);
  const [isTerminalExecution, setIsTerminalExecution] = useState(false);
  const [thinkingFrame, setThinkingFrame] = useState(0);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const frames = ['/', '-', '\\', '|'];

  useEffect(() => { localStorage.setItem('vey_settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('vey_model', selectedModel); }, [selectedModel]);

  const models = [
    { id: 'PYTHON_LOCAL_AI', name: 'VEY.AI Core', icon: 'terminal' },
    { id: 'OLLAMA_RAG', name: `OLLAMA: ${settings.ollamaModel}`, icon: 'precision_manufacturing' },
    { id: settings.groqModel || 'GROQ_RAG', name: settings.groqKey ? `GROQ: ${settings.groqModel || 'Cloud'}` : 'GROQ (API Key)', icon: 'bolt' }
  ];

  const currentModel = models.find(m => m.id === selectedModel) || models[0];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  // Thinking animation
  useEffect(() => {
    let interval;
    if (isThinking || isTerminalExecution) {
      interval = setInterval(() => { setThinkingFrame(f => (f + 1) % frames.length); }, 150);
    }
    return () => clearInterval(interval);
  }, [isThinking, isTerminalExecution]);

  // Metrics polling - also reconnects if backend starts late
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/metrics');
        const data = await res.json();
        setMetrics(data);
        if (!backendReady) {
          setBackendReady(true);
          // Load workspace files on reconnect
          try {
            const savedPath = localStorage.getItem('vey_workspace');
            const url = savedPath
              ? `http://127.0.0.1:8000/workspace/files?path=${encodeURIComponent(savedPath)}`
              : 'http://127.0.0.1:8000/workspace/files';
            const filesRes = await fetch(url);
            const filesData = await filesRes.json();
            setWorkspaceFiles(filesData.files || []);
          } catch(e) {}
        }
      } catch (e) {}
    };
    const interval = setInterval(fetchMetrics, 3000);
    fetchMetrics();
    return () => clearInterval(interval);
  }, [backendReady]);

  // Mount Workspace
  const handleMountWorkspace = async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: "Select Project Folder" });
      if (selected) {
        setWorkspacePath(selected);
        setWorkspaceFiles([]);
        localStorage.setItem('vey_workspace', selected);
        const response = await fetch(`http://127.0.0.1:8000/workspace/files?path=${encodeURIComponent(selected)}`);
        const data = await response.json();
        setWorkspaceFiles(data.files || []);
        setMessages(prev => [...prev, { role: 'VEY', content: `📁 Рабочая папка: \`${selected}\`` }]);
      }
    } catch (err) {
      console.error("Dialog Error:", err);
    }
  };

  // Backend ping + workspace load on startup
  useEffect(() => {
    let checkInterval;
    let bootStart = Date.now();

    const pingBackend = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/metrics');
        if (res.ok) {
          setBackendReady(true);
          clearInterval(checkInterval);

          // Load last workspace from backend
          try {
            const wsRes = await fetch('http://127.0.0.1:8000/workspace/current');
            const wsData = await wsRes.json();
            if (wsData.path) {
              setWorkspacePath(wsData.path);
              localStorage.setItem('vey_workspace', wsData.path);
            }
          } catch(e) {}

          // Load workspace files
          try {
            const savedPath = localStorage.getItem('vey_workspace');
            const url = savedPath
              ? `http://127.0.0.1:8000/workspace/files?path=${encodeURIComponent(savedPath)}`
              : 'http://127.0.0.1:8000/workspace/files';
            const filesRes = await fetch(url);
            const filesData = await filesRes.json();
            setWorkspaceFiles(filesData.files || []);
          } catch(e) {}
        }
      } catch (e) {
        // Auto-skip loading after 15 seconds
        if (Date.now() - bootStart > 15000) {
          setBackendReady(true);
          clearInterval(checkInterval);
          setMessages(prev => [...prev, { role: 'VEY', content: '⚠️ AI-бэкенд не найден. Запустите `python scripts/ai_service.py` вручную или используйте Groq/Ollama.' }]);
          return;
        }
        setBootMessage(prev => prev.length > 35 ? "WAITING FOR AI BACKEND" : prev + ".");
      }
    };
    checkInterval = setInterval(pingBackend, 1500);
    pingBackend();

    return () => clearInterval(checkInterval);
  }, []);

  // Fetch Ollama Models
  useEffect(() => {
    const fetchOllama = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/models/ollama');
        const data = await res.json();
        setOllamaModels(data.models || []);
      } catch (e) {}
    };
    fetchOllama();
  }, [isSettingsOpen]);

  // Fetch Groq Models
  useEffect(() => {
    const fetchGroq = async () => {
      if (!settings.groqKey) return;
      try {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${settings.groqKey}` }
        });
        const data = await res.json();
        if (data && data.data) {
          const gm = data.data.map(m => m.id).filter(id => !id.includes('whisper'));
          setGroqModels(gm);
          if (!settings.groqModel && gm.length > 0) {
            setSettings(prev => ({...prev, groqModel: gm[0]}));
          }
        }
      } catch (e) {}
    };
    fetchGroq();
  }, [settings.groqKey, isSettingsOpen]);

  // ─── PROCESS AI RESPONSE: parse FILE_REQUEST, FILE_EDIT, FILE_PATCH ───
  const processAIResponse = useCallback(async (answer) => {
    // FILE_REQUEST: create new file
    const fileMatch = answer.match(/\[FILE_REQUEST:\s*([^\]]+)\]([\s\S]*?)\[\/FILE_REQUEST\]/);
    // FILE_EDIT: overwrite file
    const editMatch = answer.match(/\[FILE_EDIT:\s*([^\]]+)\]([\s\S]*?)\[\/FILE_EDIT\]/);
    // FILE_PATCH: find & replace in file
    const patchMatch = answer.match(/\[FILE_PATCH:\s*([^\]]+)\]([\s\S]*?)\[\/FILE_PATCH\]/);
    // OPEN_FOLDER
    const folderMatch = answer.match(/\[OPEN_FOLDER:\s*([^\]]+)\]/);

    let cleanedAnswer = answer;

    if (folderMatch) {
      const folderPath = folderMatch[1].trim();
      cleanedAnswer = cleanedAnswer.replace(/\[OPEN_FOLDER:[\s\S]*?\]/, '').trim();
      setMessages(prev => [...prev, { role: 'VEY', content: cleanedAnswer || `Открываю папку: ${folderPath}` }]);
      try {
        const res = await fetch(`http://127.0.0.1:8000/workspace/files?path=${encodeURIComponent(folderPath)}`);
        const wsData = await res.json();
        setWorkspaceFiles(wsData.files || []);
        setWorkspacePath(folderPath);
        localStorage.setItem('vey_workspace', folderPath);
      } catch(e) {}
      return;
    }

    if (patchMatch) {
      const filepath = patchMatch[1].trim();
      const patchBody = patchMatch[2];
      const findMatch = patchBody.match(/\[FIND\]([\s\S]*?)\[\/FIND\]/);
      const replaceMatch = patchBody.match(/\[REPLACE\]([\s\S]*?)\[\/REPLACE\]/);
      cleanedAnswer = cleanedAnswer.replace(/\[FILE_PATCH:[\s\S]*?\[\/FILE_PATCH\]/, '').trim();

      if (findMatch && replaceMatch) {
        setPendingFileChange({
          type: 'patch',
          filename: filepath,
          findText: findMatch[1].trim(),
          replaceText: replaceMatch[1].trim(),
          originalResponse: cleanedAnswer
        });
        setMessages(prev => [...prev, { role: 'VEY', content: cleanedAnswer || `Подготовлен патч для файла \`${filepath}\`` }]);
        return;
      }
    }

    if (editMatch) {
      const filepath = editMatch[1].trim();
      const content = editMatch[2].trim();
      cleanedAnswer = cleanedAnswer.replace(/\[FILE_EDIT:[\s\S]*?\[\/FILE_EDIT\]/, '').trim();
      setPendingFileChange({
        type: 'edit',
        filename: filepath,
        content: content,
        originalResponse: cleanedAnswer
      });
      setMessages(prev => [...prev, { role: 'VEY', content: cleanedAnswer || `Готово к изменению файла \`${filepath}\`` }]);
      return;
    }

    if (fileMatch) {
      const filename = fileMatch[1].trim();
      const content = fileMatch[2].trim();
      cleanedAnswer = cleanedAnswer.replace(/\[FILE_REQUEST:[\s\S]*?\[\/FILE_REQUEST\]/, '').trim();
      setPendingFileChange({
        type: 'create',
        filename: filename,
        content: content,
        originalResponse: cleanedAnswer
      });
      setMessages(prev => [...prev, { role: 'VEY', content: cleanedAnswer || `Готов создать файл \`${filename}\`` }]);
      return;
    }

    setMessages(prev => [...prev, { role: 'VEY', content: cleanedAnswer }]);
  }, []);

  // ─── APPROVE FILE CHANGE ──────────────────────────────────────────
  const handleApproveFileChange = async () => {
    if (!pendingFileChange) return;
    try {
      let response;
      if (pendingFileChange.type === 'patch') {
        response = await fetch('http://127.0.0.1:8000/file/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filepath: pendingFileChange.filename,
            content: '',
            mode: 'patch',
            patch_target: pendingFileChange.findText,
            patch_replacement: pendingFileChange.replaceText
          })
        });
      } else {
        response = await fetch('http://127.0.0.1:8000/file/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: pendingFileChange.filename,
            content: pendingFileChange.content
          })
        });
      }
      const data = await response.json();
      if (data.status === 'SUCCESS') {
        const action = pendingFileChange.type === 'patch' ? 'Патч применён' : pendingFileChange.type === 'edit' ? 'Файл изменён' : 'Файл создан';
        setMessages(prev => [...prev, { role: 'VEY', content: `✅ ${action}: \`${pendingFileChange.filename}\`` }]);
        // Refresh workspace
        const res = await fetch('http://127.0.0.1:8000/workspace/files');
        const wsData = await res.json();
        setWorkspaceFiles(wsData.files || []);
      } else {
        setMessages(prev => [...prev, { role: 'VEY', content: `❌ Ошибка: ${data.message}`, error: true }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'VEY', content: "❌ Ошибка записи файла.", error: true }]);
    }
    setPendingFileChange(null);
  };

  // ─── SUBMIT HANDLER ──────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;

    const rawInput = input.trim();
    const isTerminalCmd = rawInput.startsWith('!');

    const userMsg = { role: 'USR', content: rawInput };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    if (isTerminalCmd) setIsTerminalExecution(true);
    else setIsThinking(true);

    try {
      if (isTerminalCmd) {
        const cmd = rawInput.substring(1).trim();
        const response = await fetch('http://127.0.0.1:8000/terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: cmd })
        });
        const data = await response.json();
        setIsTerminalExecution(false);
        setMessages(prev => [...prev, {
          role: 'VEY',
          content: `Терминал \`${cmd}\`:`,
          code: data.output,
          cmd: cmd,
          isTerminal: true
        }]);
      } else {
        const response = await fetch('http://127.0.0.1:8000/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: rawInput }],
            model: selectedModel,
            api_key: settings.groqKey
          })
        });
        const data = await response.json();
        setIsThinking(false);
        await processAIResponse(data.answer);
      }
    } catch (err) {
      setIsThinking(false);
      setIsTerminalExecution(false);
      setMessages(prev => [...prev, { role: 'VEY', content: '❌ Сервис недоступен. Проверьте backend.', error: true }]);
    }
  };

  const toggleFolder = (path) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ─── RENDER ──────────────────────────────────────────────────────
  return (
    <div className={`font-sans text-[#e0e0e0] selection:bg-[#4ade80]/30 selection:text-white h-screen flex flex-col overflow-hidden bg-[#080a08] relative antialiased ${settings.theme === 'High Contrast' ? 'contrast-125' : ''} ${settings.theme === 'Light Theme' ? 'invert hue-rotate-180' : ''}`}>

      {/* ── FIXED TITLEBAR (always visible, integrated) ── */}
      <div data-tauri-drag-region className="flex justify-between items-center px-4 bg-[#060806] h-9 z-[9999] shrink-0 border-b border-white/[0.04] select-none">
        <div data-tauri-drag-region className="text-white/25 text-[10px] uppercase tracking-[0.2em] pointer-events-none font-bold flex-1">VEY.AI</div>
        <div className="flex items-center h-full">
          <button onClick={() => appWindow.minimize()} className="text-white/30 hover:text-white hover:bg-white/5 transition-all material-symbols-outlined text-[14px] h-full w-10 flex items-center justify-center">remove</button>
          <button onClick={() => appWindow.toggleMaximize()} className="text-white/30 hover:text-white hover:bg-white/5 transition-all material-symbols-outlined text-[14px] h-full w-10 flex items-center justify-center">crop_square</button>
          <button onClick={() => appWindow.close()} className="text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all material-symbols-outlined text-[14px] h-full w-10 flex items-center justify-center">close</button>
        </div>
      </div>

      {/* Settings Panel */}
      {isSettingsOpen && (
        <SettingsPanel
          settings={settings}
          setSettings={setSettings}
          ollamaModels={ollamaModels}
          groqModels={groqModels}
          onClose={() => setIsSettingsOpen(false)}
          setSelectedModel={setSelectedModel}
        />
      )}

      {/* ── TOP BAR ── */}
      <header className="bg-[#080a08] text-[#4ade80] uppercase tracking-[0.15em] text-[10px] border-b border-white/[0.06] flex justify-between items-center w-full px-6 h-12 z-50 shrink-0">
        <div className="flex items-center h-full">
          <span className="text-lg font-black text-[#4ade80] tracking-[0.25em] mr-8 select-none flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#4ade80] shadow-[0_0_10px_#4ade80]"></div>
            VEY
          </span>
          <div className="flex items-center gap-8 border-l border-white/[0.06] pl-8 h-6">
            {/* CPU */}
            <div className="flex flex-col gap-1 w-28">
              <div className="flex justify-between text-[8px] font-bold text-white/25 tracking-widest">
                <span>CPU</span>
                <span className="text-[#4ade80]">{metrics.cpu}%</span>
              </div>
              <div className="h-[3px] bg-white/[0.04] rounded-full overflow-hidden">
                <div className="h-full bg-[#4ade80] transition-all duration-1000 rounded-full" style={{ width: `${metrics.cpu}%` }}></div>
              </div>
            </div>
            {/* RAM */}
            <div className="flex flex-col gap-1 w-28">
              <div className="flex justify-between text-[8px] font-bold text-white/25 tracking-widest">
                <span>RAM</span>
                <span className="text-[#38bdf8]">{metrics.memory}%</span>
              </div>
              <div className="h-[3px] bg-white/[0.04] rounded-full overflow-hidden">
                <div className="h-full bg-[#38bdf8] transition-all duration-1000 rounded-full" style={{ width: `${metrics.memory}%` }}></div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-white/15">
            <span className="text-[9px] font-bold tracking-widest uppercase">v2.1.0</span>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-9 h-9 flex items-center justify-center border border-white/[0.06] hover:border-[#4ade80]/30 hover:bg-[#4ade80]/5 rounded-lg transition-all group"
          >
            <span className="material-symbols-outlined text-[18px] text-white/30 group-hover:text-[#4ade80] transition-colors">settings</span>
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Chat Area */}
        <main className="flex-1 flex flex-col relative bg-[#080a08] overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 lg:p-12 space-y-10 scroll-smooth">
            <div className="max-w-3xl mx-auto w-full space-y-10 pb-24">
              {/* Loading State */}
              {!backendReady && (
                <div className="h-full flex flex-col items-center justify-center space-y-6 py-20">
                  <div className="relative flex items-center justify-center h-20 w-20 mb-4">
                    <div className="absolute inset-0 border-t-2 border-emerald-500/80 w-full h-full rounded-full animate-spin shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                    <div className="absolute inset-2 border-r-2 border-emerald-700/60 w-full h-full rounded-full animate-[spin_1.5s_linear_reverse_infinite]"></div>
                    <span className="material-symbols-outlined text-emerald-400 text-2xl opacity-90 animate-pulse">memory</span>
                  </div>
                  <div className="text-emerald-400 font-mono text-lg tracking-[0.3em] font-bold animate-pulse">BOOTING VEY.AI</div>
                  <div className="text-emerald-600 font-mono text-xs tracking-widest uppercase">{bootMessage}</div>
                  <div className="text-emerald-900/60 font-mono text-[10px] mt-8 max-w-sm text-center">
                    Загрузка моделей. Это может занять 10-30 секунд...
                  </div>
                  <button
                    onClick={() => {
                      setBackendReady(true);
                      setMessages(prev => [...prev, { role: 'VEY', content: '⚠️ Загрузка пропущена. AI-бэкенд подключится автоматически когда будет готов.' }]);
                    }}
                    className="mt-6 px-6 py-2 border border-emerald-800/40 text-emerald-700 text-[11px] font-bold uppercase tracking-widest rounded-lg hover:bg-emerald-900/20 hover:text-emerald-500 transition-all"
                  >
                    Пропустить
                  </button>
                </div>
              )}

              {/* Messages */}
              {backendReady && messages.map((msg, i) => (
                <div key={i} className={`flex gap-5 group ${msg.error ? 'opacity-50' : ''}`}>
                  <div className={`w-8 h-8 flex-shrink-0 border flex items-center justify-center rounded-lg ${
                    msg.role === 'VEY' || msg.role === 'SYS'
                      ? 'border-[#4ade80]/20 bg-[#4ade80]/[0.04]'
                      : 'border-white/8 bg-white/[0.02]'
                  }`}>
                    {msg.role === 'VEY' || msg.role === 'SYS' ? (
                      <span className="material-symbols-outlined text-[#4ade80] text-[16px]">memory</span>
                    ) : (
                      <span className="material-symbols-outlined text-white/30 text-[16px]">person</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-4 min-w-0 pt-0.5">
                    <div className={`${msg.role === 'VEY' || msg.role === 'SYS' ? 'text-white/85' : 'text-[#4ade80]'} text-[15px] leading-[1.75] break-words font-normal w-full`}>
                      {msg.role === 'VEY' || msg.role === 'SYS' ? (
                        <div className="markdown-body overflow-x-hidden">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                    {msg.code && msg.isTerminal ? (
                      <InteractiveTerminal initialCmd={msg.cmd} initialOutput={msg.code} />
                    ) : (msg.code && (
                      <div className="bg-[#0a0c0a] border border-white/[0.06] p-6 font-mono text-[13px] group relative rounded-lg mt-3">
                        <div className="absolute right-4 top-4 text-[10px] text-white/15 flex gap-3 uppercase tracking-widest font-sans">
                          {msg.ref}
                          <span className="material-symbols-outlined text-[14px] cursor-pointer hover:text-[#4ade80] transition-colors">content_copy</span>
                        </div>
                        <pre className="text-white/60 whitespace-pre overflow-x-auto custom-scrollbar pb-2 leading-relaxed selection:bg-[#4ade80]/50">
                          {msg.code}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Thinking Indicator */}
              {isThinking && (
                <div className="flex gap-5">
                  <div className="w-8 h-8 flex-shrink-0 border border-[#4ade80]/20 bg-[#4ade80]/[0.04] flex items-center justify-center rounded-lg">
                    <span className="material-symbols-outlined text-[#4ade80] text-[16px] animate-spin">memory</span>
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="text-[#4ade80] text-[15px] font-bold tracking-wide flex items-center gap-2">
                      <span className="font-mono text-lg w-4 text-center">{frames[thinkingFrame]}</span>
                      Думаю...
                    </div>
                  </div>
                </div>
              )}

              {/* Terminal Execution Indicator */}
              {isTerminalExecution && (
                <div className="flex gap-5">
                  <div className="w-8 h-8 flex-shrink-0 border border-amber-400/20 bg-amber-400/[0.04] flex items-center justify-center rounded-lg">
                    <span className="material-symbols-outlined text-amber-400 text-[16px] animate-pulse">terminal</span>
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="text-amber-400 text-[15px] font-bold tracking-wide flex items-center gap-2">
                      <span className="font-mono text-lg w-4 text-center">{frames[thinkingFrame]}</span>
                      Выполняю команду...
                    </div>
                  </div>
                </div>
              )}

              {/* Pending File Change */}
              {pendingFileChange && (
                <div className="flex gap-5">
                  <div className="w-8 h-8 flex-shrink-0 border border-[#38bdf8]/20 bg-[#38bdf8]/[0.04] flex items-center justify-center rounded-lg">
                    <span className="material-symbols-outlined text-[#38bdf8] text-[16px]">description</span>
                  </div>
                  <div className="flex-1 bg-[#0a0c0a] border border-[#38bdf8]/15 p-6 rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-[#38bdf8] uppercase tracking-[0.2em]">
                          {pendingFileChange.type === 'patch' ? 'Патч файла' : pendingFileChange.type === 'edit' ? 'Изменение файла' : 'Создание файла'}
                        </span>
                        <h3 className="text-white text-sm font-bold">{pendingFileChange.filename}</h3>
                      </div>
                      <span className="material-symbols-outlined text-[#38bdf8] animate-pulse">edit_document</span>
                    </div>
                    <div className="bg-black/30 border border-white/[0.04] p-4 rounded-lg">
                      <pre className="text-[12px] text-white/40 font-mono whitespace-pre overflow-x-auto max-h-[200px] custom-scrollbar">
                        {pendingFileChange.type === 'patch'
                          ? `FIND:\n${pendingFileChange.findText}\n\nREPLACE:\n${pendingFileChange.replaceText}`
                          : pendingFileChange.content?.substring(0, 2000) + (pendingFileChange.content?.length > 2000 ? '\n...(ещё)' : '')}
                      </pre>
                    </div>
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={handleApproveFileChange}
                        className="px-6 py-2.5 bg-[#38bdf8] text-black text-[10px] font-black uppercase tracking-widest hover:bg-[#38bdf8]/80 transition-all rounded-lg"
                      >
                        Применить
                      </button>
                      <button
                        onClick={() => setPendingFileChange(null)}
                        className="px-6 py-2.5 bg-white/5 border border-white/8 text-white/40 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all rounded-lg"
                      >
                        Отклонить
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        </main>

        {/* ── SIDEBAR ── */}
        <aside className="w-[280px] bg-[#080a08] border-l border-white/[0.04] flex flex-col shrink-0 z-40 relative h-full">
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col h-full">
            {/* Model Selector */}
            <div className="p-6 space-y-3 border-b border-white/[0.04] bg-[#080a08] sticky top-0 z-20">
              <label className="uppercase text-white/15 text-[9px] font-bold tracking-[0.25em] block">AI Processor</label>
              <div className="relative">
                <div
                  onClick={() => setIsModelOpen(!isModelOpen)}
                  className="bg-[#0a0c0a] border border-white/8 p-3 flex justify-between items-center cursor-pointer hover:border-[#4ade80]/25 transition-all rounded-lg group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#4ade80] text-base group-hover:scale-110 transition-transform">{currentModel.icon}</span>
                    <span className="text-[10px] text-white font-bold tracking-wide uppercase truncate max-w-[160px]">{currentModel.name}</span>
                  </div>
                  <span className={`material-symbols-outlined text-white/15 text-sm transition-transform duration-200 ${isModelOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </div>

                {isModelOpen && (
                  <div className="absolute top-full left-0 w-full mt-1.5 bg-[#0d0f0d] border border-white/8 rounded-lg z-50 shadow-2xl overflow-hidden py-1">
                    {models.map(model => (
                      <div
                        key={model.id}
                        onClick={() => { setSelectedModel(model.id); setIsModelOpen(false); }}
                        className={`px-3 py-3 flex items-center gap-2.5 cursor-pointer hover:bg-[#4ade80]/5 transition-colors ${
                          selectedModel === model.id ? 'bg-[#4ade80]/8 border-l-2 border-[#4ade80]' : ''
                        }`}
                      >
                        <span className={`material-symbols-outlined text-base ${selectedModel === model.id ? 'text-[#4ade80]' : 'text-white/15'}`}>{model.icon}</span>
                        <span className={`text-[10px] font-bold tracking-wide uppercase ${selectedModel === model.id ? 'text-[#4ade80]' : 'text-white/50'}`}>{model.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Workspace */}
            <div className="px-6 py-6 space-y-5 flex-1">
              <div className="flex justify-between items-center">
                <label className="uppercase text-white/15 text-[9px] font-bold tracking-[0.25em] block">Workspace</label>
                <div className="flex gap-3">
                  <button onClick={async () => {
                    try {
                      const res = await fetch('http://127.0.0.1:8000/workspace/files');
                      const data = await res.json();
                      setWorkspaceFiles(data.files || []);
                    } catch(e) {}
                  }} className="text-white/15 hover:text-[#4ade80] transition-colors">
                    <span className="material-symbols-outlined text-[14px]">refresh</span>
                  </button>
                </div>
              </div>

              <div className="space-y-0.5 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                {workspaceFiles.length > 0 ? (
                  workspaceFiles.map((file, idx) => {
                    const pathParts = file.path.split(/[\\/]/);
                    const parentPath = pathParts.slice(0, -1).join('/');
                    const isVisible = parentPath === "" || expandedFolders.has(parentPath);

                    if (!isVisible) return null;

                    return (
                      <div
                        key={idx}
                        onClick={() => file.type === 'directory' && toggleFolder(file.path)}
                        className={`flex items-center gap-2.5 py-1.5 px-2.5 rounded-md cursor-pointer transition-colors group ${
                          file.type === 'directory'
                            ? 'text-white/35 hover:text-white/70'
                            : 'text-white/50 hover:bg-white/[0.03]'
                        }`}
                        style={{ paddingLeft: pathParts.length * 10 }}
                      >
                        <span className={`material-symbols-outlined text-[15px] transition-transform duration-200 ${
                          file.type === 'directory'
                            ? (expandedFolders.has(file.path) ? 'rotate-90 text-[#4ade80]' : 'text-white/15')
                            : 'opacity-20 group-hover:opacity-50 text-[#4ade80]'
                        }`}>
                          {file.type === 'directory' ? 'chevron_right' : 'description'}
                        </span>
                        <span className={`text-[11px] font-medium tracking-tight truncate ${
                          file.type === 'directory' ? 'uppercase text-[9px] tracking-[0.08em]' : ''
                        }`}>{file.name}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-[10px] text-white/8 font-mono italic p-4 text-center">Нет подключённой папки</div>
                )}
              </div>

              <div
                onClick={handleMountWorkspace}
                className="border border-white/[0.04] border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-3 bg-white/[0.005] hover:bg-[#4ade80]/[0.03] hover:border-[#4ade80]/15 transition-all cursor-pointer group"
              >
                <span className="material-symbols-outlined text-white/8 group-hover:text-[#4ade80]/30 text-2xl transition-colors">folder_open</span>
                <span className="text-[9px] font-bold text-white/15 group-hover:text-[#4ade80]/50 tracking-[0.15em] uppercase text-center">Открыть папку</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ── INPUT BAR ── */}
      <div className="bg-[#080a08] z-50 px-6 py-4 shrink-0">
        <div className="max-w-3xl mx-auto">
          <form className="w-full" onSubmit={handleSubmit}>
            <div className="relative flex items-center">
              <span className={`absolute left-4 font-bold text-lg transition-all duration-200 select-none ${
                input.startsWith('!') ? 'text-amber-400' : 'text-[#4ade80]/30'
              }`}>
                {input.startsWith('!') ? '>' : '/'}
              </span>
              <input
                ref={inputRef}
                className={`w-full bg-[#0d0f0d] border rounded-xl ${
                  input.startsWith('!')
                    ? 'text-amber-400 border-amber-400/20 focus:border-amber-400/40'
                    : 'text-[#4ade80] border-white/[0.06] focus:border-[#4ade80]/30'
                } font-mono placeholder:text-white/[0.06] pl-11 pr-14 text-[15px] transition-all py-4 tracking-tight outline-none focus:shadow-[0_0_15px_rgba(74,222,128,0.03)]`}
                placeholder={input.startsWith('!') ? "Команда терминала..." : "Введите сообщение или !команду..."}
                type="text"
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <div className="absolute right-3 flex items-center gap-3">
                {input.startsWith('!') && (
                  <span className="text-[8px] uppercase font-black tracking-widest text-amber-400 border border-amber-400/20 px-2 py-0.5 rounded bg-amber-400/5">
                    CMD
                  </span>
                )}
                <button type="submit" className={`w-8 h-8 flex items-center justify-center border hover:bg-white/5 transition-all rounded-lg group ${
                  input.startsWith('!') ? 'border-amber-400/20' : 'border-[#4ade80]/15'
                }`}>
                  <span className={`material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-0.5 ${
                    input.startsWith('!') ? 'text-amber-400/60' : 'text-[#4ade80]/50'
                  }`}>send</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
