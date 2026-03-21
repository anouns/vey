import React, { useState, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { FileIcon, defaultStyles } from 'react-file-icon';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

const InteractiveTerminal = ({ initialCmd, initialOutput }) => {
    const [history, setHistory] = useState([
        { cmd: initialCmd, output: initialOutput }
    ]);
    const [input, setInput] = useState('');
    const [isWorking, setIsWorking] = useState(false);
    const bottomRef = useRef(null);

    const runCmd = async (e) => {
        e.preventDefault();
        if (!input.trim() || isWorking) return;
        const cmd = input.trim();
        setInput('');
        setIsWorking(true);
        // Add optimistic
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
        <div className="bg-[#111] border border-[#facc15]/20 focus-within:border-[#facc15] p-8 font-mono text-[13px] group relative rounded-sm shadow-inner mt-4 transition-all flex flex-col">
            <div className="absolute right-6 top-6 text-[10px] text-[#facc15] flex gap-3 uppercase tracking-widest font-sans font-black">
                TERMINAL_SESSION
                <span className="material-symbols-outlined text-[14px]">terminal</span>
            </div>
            <div className="flex-1 overflow-x-auto text-white/70 whitespace-pre custom-scrollbar pb-2 leading-relaxed max-h-[300px] overflow-y-auto">
                {history.map((h, i) => (
                    <div key={i} className="mb-4">
                        <div className="text-[#facc15] font-black">{'>'} {h.cmd}</div>
                        <div className="opacity-80 mt-1 selection:bg-[#facc15]/30">{h.output}</div>
                    </div>
                ))}
                {isWorking && <div className="text-[#facc15] animate-pulse">...</div>}
                <div ref={bottomRef} />
            </div>
            <form onSubmit={runCmd} className="mt-4 flex items-center border-t border-white/10 pt-4 opacity-50 focus-within:opacity-100 transition-opacity">
                <span className="text-[#facc15] font-black mr-3">{'>'}</span>
                <input 
                    type="text" 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-[#facc15] placeholder:text-[#facc15]/30 font-mono text-[12px]"
                    placeholder="Enter command to continue session..."
                />
            </form>
        </div>
    );
};

function App() {
  const loadSettings = () => {
    const saved = localStorage.getItem('vey_settings');
    if (saved) return JSON.parse(saved);
    return {
      groqKey: '',
      ollamaModel: 'deepseek-coder',
      groqModel: '',
      theme: 'Obsidian'
    };
  };

  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(localStorage.getItem('vey_model') || 'PYTHON_LOCAL_AI');
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'VEY', content: 'SYSTEM INITIALIZED. STANDBY FOR COMMAND...' }
  ]);
  const [metrics, setMetrics] = useState({ cpu: 0, memory: 0, indexing: 0 });
  const [workspacePath, setWorkspacePath] = useState(localStorage.getItem('vey_workspace') || '');
  const [workspaceFiles, setWorkspaceFiles] = useState([]);
  const [ollamaModels, setOllamaModels] = useState([]);
  const [groqModels, setGroqModels] = useState([]);
  const [backendReady, setBackendReady] = useState(false);
  const [bootMessage, setBootMessage] = useState("INITIALIZING NEURAL LINK");
  const [isCommandMode, setIsCommandMode] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set(['.'])); // Root expanded by default
  const [pendingFileChange, setPendingFileChange] = useState(null);
  const [settings, setSettings] = useState(loadSettings());

  useEffect(() => {
    localStorage.setItem('vey_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('vey_model', selectedModel);
  }, [selectedModel]);

  const messagesEndRef = useRef(null);

  const models = [
    { id: 'PYTHON_LOCAL_AI', name: 'VEY.AI Core (Semantic Matrix)', icon: 'terminal' },
    { id: 'OLLAMA_RAG', name: `OLLAMA: ${settings.ollamaModel}`, icon: 'precision_manufacturing' },
    { id: settings.groqModel || 'GROQ_RAG', name: settings.groqKey ? `GROQ: ${settings.groqModel || 'Cloud LPU'}` : 'GROQ (Requires API Key)', icon: 'bolt' }
  ];

  // Also maintain the chosen groq model logic if selectedModel is a groq model
  const currentModel = models.find(m => m.id === selectedModel) || models[0];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch Metrics
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/metrics');
        const data = await res.json();
        setMetrics(data);
      } catch (e) {}
    };
    const interval = setInterval(fetchMetrics, 1000);
    fetchMetrics();
    return () => clearInterval(interval);
  }, []);

  // Mount Workspace
  const handleMountWorkspace = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Folder"
      });

      if (selected) {
        setWorkspacePath(selected);
        setWorkspaceFiles([]); // Clear immediately while loading
        localStorage.setItem('vey_workspace', selected);
        // Update backend CURRENT_WORKSPACE and get files
        const response = await fetch(`http://127.0.0.1:8000/workspace/files?path=${encodeURIComponent(selected)}`);
        const data = await response.json();
        setWorkspaceFiles(data.files || []);
        console.log("Mounted:", selected);
        setMessages(prev => [...prev, { role: 'VEY', content: `WORKSPACE_MOUNTED: ${selected}` }]);
      }
    } catch (err) {
      console.error("Tauri Dialog Error:", err);
      if (err.toString().includes("window.__TAURI__") || err.toString().includes("not found")) {
         alert("TAURI_API_NOT_FOUND: Ensure you are running inside the Vey Desktop app.");
      }
    }
  };

  // Fetch Workspace and Ping Backend
  useEffect(() => {
    let checkInterval;
    const pingBackend = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/metrics');
        if (res.ok) {
          setBackendReady(true);
          clearInterval(checkInterval);
        }
      } catch (e) {
        setBootMessage(prev => prev.length > 35 ? "LOADING SEMANTIC TENSORS" : prev + ".");
      }
    };
    checkInterval = setInterval(pingBackend, 2000);
    pingBackend();

    const fetchWorkspace = async () => {
      try {
        const savedPath = localStorage.getItem('vey_workspace');
        const url = savedPath 
          ? `http://127.0.0.1:8000/workspace/files?path=${encodeURIComponent(savedPath)}`
          : 'http://127.0.0.1:8000/workspace/files';
        const res = await fetch(url);
        const data = await res.json();
        setWorkspaceFiles(data.files || []);
      } catch (e) {}
    };
    fetchWorkspace();

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

  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isTerminalExecution, setIsTerminalExecution] = useState(false);
  const [thinkingFrame, setThinkingFrame] = useState(0);

  const frames = ['/', '-', '\\', '|'];

  useEffect(() => {
    let interval;
    if (isThinking || isTerminalExecution) {
      interval = setInterval(() => {
        setThinkingFrame(f => (f + 1) % frames.length);
      }, 150);
    }
    return () => clearInterval(interval);
  }, [isThinking]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;

    const rawInput = input.trim();
    const isTerminalCmd = isCommandMode || rawInput.startsWith('!');
    
    // Add user message to UI
    const userMsg = { role: 'USR', content: rawInput };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    
    if (isTerminalCmd) setIsTerminalExecution(true);
    else setIsThinking(true);

    try {
      if (isTerminalCmd) {
        // TERMINAL MODE
        const cmd = isCommandMode ? rawInput : rawInput.substring(1).trim();
        const response = await fetch('http://127.0.0.1:8000/terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: cmd })
        });
        const data = await response.json();
        setIsTerminalExecution(false);
        setMessages(prev => [...prev, { 
            role: 'VEY', 
            content: `TERMINAL_OUTPUT [${cmd}]:`,
            code: data.output,
            cmd: cmd,
            isTerminal: true
        }]);
      } else {
        // CHAT MODE
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
        
        // Check for File Request tag
        const fileMatch = data.answer.match(/\[FILE_REQUEST:\s*([^\]]+)\]([\s\S]*?)\[\/FILE_REQUEST\]/);
        const folderMatch = data.answer.match(/\[OPEN_FOLDER:\s*([^\]]+)\]/);
        
        let finalAnswer = data.answer;

        if (folderMatch) {
            const folderPath = folderMatch[1].trim();
            finalAnswer = finalAnswer.replace(/\[OPEN_FOLDER:[\s\S]*?\]/, '').trim();
            setMessages(prev => [...prev, { role: 'VEY', content: finalAnswer }]);
            setMessages(prev => [...prev, { role: 'SYS', content: `Opening folder: ${folderPath}` }]);
            // Reload workspace
            fetch(`http://127.0.0.1:8000/workspace/files?path=${encodeURIComponent(folderPath)}`)
                .then(res => res.json())
                .then(wsData => setWorkspaceFiles(wsData.files || []))
                .catch(() => {});
            return;
        }

        if (fileMatch) {
            finalAnswer = finalAnswer.replace(/\[FILE_REQUEST:[\s\S]*?\[\/FILE_REQUEST\]/, '').trim();
            setPendingFileChange({
                filename: fileMatch[1].trim(),
                content: fileMatch[2].trim(),
                originalResponse: finalAnswer
            });
            setMessages(prev => [...prev, { role: 'VEY', content: finalAnswer || "I've prepared a file change. Please review the request above." }]);
        } else {
            setMessages(prev => [...prev, { role: 'VEY', content: finalAnswer }]);
        }
      }
    } catch (err) {
      setIsThinking(false);
      setIsTerminalExecution(false);
      setMessages(prev => [...prev, { role: 'VEY', content: 'ERROR: SERVICE_UNREACHABLE. Check if backend is active.', error: true }]);
    }
  };

  // End of handleSend

  const handleApproveFileChange = async () => {
    if (!pendingFileChange) return;
    try {
        const response = await fetch('http://127.0.0.1:8000/file/write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: pendingFileChange.filename,
                content: pendingFileChange.content
            })
        });
        const data = await response.json();
        if (data.status === 'SUCCESS') {
            setMessages(prev => [...prev, { role: 'VEY', content: `FILE_MODIFIED: ${pendingFileChange.filename} saved successfully.` }]);
            // Refresh workspace
            const res = await fetch('http://127.0.0.1:8000/workspace/files');
            const wsData = await res.json();
            setWorkspaceFiles(wsData.files || []);
        } else {
            setMessages(prev => [...prev, { role: 'VEY', content: `ERROR: ${data.message}`, error: true }]);
        }
    } catch (e) {
        setMessages(prev => [...prev, { role: 'VEY', content: "ERROR: FAILED TO EXECUTE FILE WRITE.", error: true }]);
    }
    setPendingFileChange(null);
  };

  const toggleFolder = (path) => {
    setExpandedFolders(prev => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
    });
  };

  // Shortcut key listener
  useEffect(() => {
    const handleKeyDown = (e) => {
        const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
        if (e.key === '?' && !isInput) {
            setIsShortcutsOpen(prev => !prev);
        }
        if (e.key === '!' && !isInput) {
            e.preventDefault();
            setIsCommandMode(true);
            document.querySelector('input[type="text"]')?.focus();
        }
        if (e.key === 'Escape') {
            setIsCommandMode(false);
            setIsShortcutsOpen(false);
            setInput('');
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div data-tauri-drag-region className={`font-sans text-[#e0e0e0] selection:bg-[#4ade80]/30 selection:text-white h-screen flex flex-col overflow-hidden bg-[#0a0a0a] relative antialiased scroll-smooth ${settings.theme === 'High Contrast' ? 'contrast-125' : ''} ${settings.theme === 'Light Theme' ? 'invert hue-rotate-180' : ''}`}>
      {/* Invisible Hover Titlebar */}
      <div data-tauri-drag-region className="fixed top-0 left-0 right-0 h-8 flex justify-between items-center px-4 bg-black/95 z-[9999] opacity-0 hover:opacity-100 transition-opacity duration-300">
        <div data-tauri-drag-region className="text-white/40 text-[10px] uppercase tracking-widest pointer-events-none select-none flex-1 font-black">VEY.AI CORE</div>
        <div className="flex gap-5 h-full items-center">
          <button onClick={() => appWindow.minimize()} className="text-white/40 hover:text-white transition-colors material-symbols-outlined text-[13px] h-full px-2">remove</button>
          <button onClick={() => appWindow.toggleMaximize()} className="text-white/40 hover:text-white transition-colors material-symbols-outlined text-[13px] h-full px-2">crop_square</button>
          <button onClick={() => appWindow.close()} className="text-white/40 hover:text-red-500 transition-colors material-symbols-outlined text-[13px] h-full px-2">close</button>
        </div>
      </div>

      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.015]" style={{ backgroundImage: 'linear-gradient(#4ade80 1px, transparent 1px), linear-gradient(90deg, #4ade80 1px, transparent 1px)', backgroundSize: '60px 60px' }}></div>
      <div className="scanline"></div>

      {/* Settings Overlay */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-[#111] border border-[#4ade80]/20 w-full max-w-2xl rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-[#0a0a0a]">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-[#4ade80]">settings</span>
                <span className="text-[12px] font-black tracking-[0.3em] uppercase text-[#4ade80]">Vey_Settings_Panel</span>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="text-white/20 hover:text-white transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
              {/* Ollama Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#4ade80] text-lg">precision_manufacturing</span>
                  <label className="uppercase text-white/40 text-[10px] font-bold tracking-[0.2em]">Ollama Local Node</label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest pl-1">Active Model</span>
                    <select 
                      value={settings.ollamaModel}
                      onChange={(e) => setSettings({...settings, ollamaModel: e.target.value})}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-sm px-4 py-3 text-[11px] font-bold text-white/80 focus:border-[#4ade80]/40 outline-none"
                    >
                      {ollamaModels.length > 0 ? (
                        ollamaModels.map(m => <option key={m} value={m}>{m}</option>)
                      ) : (
                        <option>No models found</option>
                      )}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest pl-1">Node Status</span>
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-sm px-4 py-3 text-[11px] font-bold text-[#4ade80] flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse"></div>
                        CONNECTED : 127.0.0.1:11434
                    </div>
                  </div>
                </div>
              </div>

              {/* Groq Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#38bdf8] text-lg">bolt</span>
                  <label className="uppercase text-white/40 text-[10px] font-bold tracking-[0.2em]">Groq Cloud LPU</label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                      <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest pl-1">API ACCESS KEY</span>
                      <input 
                        type="password"
                        placeholder="gsk_********************"
                        value={settings.groqKey}
                        onChange={(e) => setSettings({...settings, groqKey: e.target.value})}
                        className="w-full bg-[#0a0a0a] border border-white/10 rounded-sm px-4 py-3 text-[13px] font-mono text-white/80 focus:border-[#38bdf8]/40 outline-none placeholder:text-white/5"
                      />
                  </div>
                  <div className="space-y-3">
                    <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest pl-1">Available Models</span>
                    <select 
                      value={settings.groqModel || ''}
                      onChange={(e) => {
                          setSettings(prev => ({...prev, groqModel: e.target.value}));
                          setSelectedModel(e.target.value);
                      }}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-sm px-4 py-3 text-[11px] font-bold text-white/80 focus:border-[#38bdf8]/40 outline-none"
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

              {/* Theme Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#facc15] text-lg">palette</span>
                  <label className="uppercase text-white/40 text-[10px] font-bold tracking-[0.2em]">Visual Environment</label>
                </div>
                <div className="flex gap-4">
                  {['Obsidian', 'High Contrast', 'Light Theme'].map(t => (
                    <button 
                      key={t}
                      onClick={() => setSettings({...settings, theme: t})}
                      className={`flex-1 py-4 border rounded-sm text-[10px] font-black tracking-widest uppercase transition-all ${settings.theme === t ? 'bg-[#4ade80]/10 border-[#4ade80] text-[#4ade80]' : 'bg-[#0a0a0a] border-white/5 text-white/20 hover:border-white/20'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TopAppBar */}
      <header className="bg-[#0a0a0a] text-[#4ade80] uppercase tracking-[0.2em] text-[10px] border-b border-[#4ade80]/10 flex justify-between items-center w-full px-8 h-14 z-50 shrink-0">
        <div className="flex items-center h-full">
          <span className="text-xl font-black text-[#4ade80] tracking-[0.3em] mr-12 select-none flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[#4ade80] shadow-[0_0_12px_#4ade80]"></div>
            VEY
          </span>
          <div className="flex items-center gap-10 border-l border-white/5 pl-10 h-6">
             <div className="flex flex-col gap-1.5 w-32">
                <div className="flex justify-between text-[8px] font-bold text-white/30 tracking-widest">
                    <span>CPU</span>
                    <span className="text-[#4ade80]">{metrics.cpu}%</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-[#4ade80] transition-all duration-1000" style={{ width: `${metrics.cpu}%` }}></div>
                </div>
             </div>
             <div className="flex flex-col gap-1.5 w-32">
                <div className="flex justify-between text-[8px] font-bold text-white/30 tracking-widest">
                    <span>RAM</span>
                    <span className="text-[#38bdf8]">{metrics.memory}%</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-[#38bdf8] transition-all duration-1000" style={{ width: `${metrics.memory}%` }}></div>
                </div>
             </div>
             <div className="flex flex-col gap-1.5 w-32">
                <div className="flex justify-between text-[8px] font-bold text-white/30 tracking-widest">
                    <span>INDEX</span>
                    <span className="text-[#facc15]">{metrics.indexing}%</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-[#facc15] transition-all duration-1000" style={{ width: `${metrics.indexing}%` }}></div>
                </div>
             </div>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 text-white/20">
            <span className="text-[9px] font-bold tracking-widest uppercase">Node_v2.0.4_Live</span>
          </div>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="w-10 h-10 flex items-center justify-center border border-white/5 hover:border-[#4ade80]/30 hover:bg-[#4ade80]/5 rounded-sm transition-all group"
          >
            <span className="material-symbols-outlined text-[20px] text-white/40 group-hover:text-[#4ade80] transition-colors">settings</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative z-10" data-tauri-drag-region>
        {/* Main Chat Area */}
        <main data-tauri-drag-region className="flex-1 flex flex-col relative bg-[#0a0a0a] overflow-hidden">
          <div data-tauri-drag-region className="flex-1 overflow-y-auto custom-scrollbar p-12 lg:p-16 space-y-16 scroll-smooth">
            <div className="max-w-4xl mx-auto w-full space-y-16 pb-32">
                {!backendReady && (
                <div className="h-full flex flex-col items-center justify-center space-y-6">
                  <div className="relative flex items-center justify-center h-24 w-24 mb-4">
                    <div className="absolute inset-0 border-t-2 border-emerald-500/80 w-full h-full rounded-full animate-spin shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                    <div className="absolute inset-2 border-r-2 border-emerald-700/60 w-full h-full rounded-full animate-[spin_1.5s_linear_reverse_infinite]"></div>
                    <div className="absolute inset-4 border-b-2 border-emerald-900/40 w-full h-full rounded-full animate-[spin_3s_linear_infinite]"></div>
                    <span className="material-icons text-emerald-400 text-3xl opacity-90 animate-pulse">memory</span>
                  </div>
                  <div className="text-emerald-400 font-mono text-xl tracking-[0.3em] font-bold animate-pulse shadow-emerald-500/50 drop-shadow-md">
                    BOOTING VEY.AI CORE
                  </div>
                  <div className="text-emerald-600 font-mono text-xs tracking-widest uppercase">
                    {bootMessage}
                  </div>
                  <div className="text-emerald-900/60 font-mono text-[10px] mt-12 max-w-sm text-center px-4">
                    LOADING QWEN NEURAL WEIGHTS AND SENTENCE TRANSFORMERS. THIS MAY TAKE 10-30 SECONDS...
                  </div>
                </div>
              )}
              
              {backendReady && messages.map((msg, i) => (
                <div key={i} className={`flex gap-8 group ${msg.error ? 'opacity-50' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    <div className={`w-10 h-10 flex-shrink-0 border flex items-center justify-center rounded-sm ${msg.role === 'VEY' || msg.role === 'SYS' ? 'border-[#4ade80]/30 bg-[#4ade80]/5' : 'border-white/10 bg-white/5'}`}>
                        {msg.role === 'VEY' || msg.role === 'SYS' ? (
                            <span className="material-symbols-outlined text-[#4ade80] text-[18px]">memory</span>
                        ) : (
                            <span className="material-symbols-outlined text-white/40 text-[18px]">person</span>
                        )}
                    </div>
                    <div className="flex-1 space-y-6 min-w-0 pt-1">
                    {(msg.role === 'VEY' || msg.role === 'SYS') && (
                        <div className="text-[#4ade80]/20 font-mono tracking-widest text-[10px] select-none uppercase mb-2">--------------------</div>
                    )}
                    <div className={`${msg.role === 'VEY' || msg.role === 'SYS' ? 'text-white/90' : 'text-[#4ade80]'} text-[16px] leading-[1.7] break-words font-medium w-full`}>
                        {msg.role === 'VEY' || msg.role === 'SYS' ? (
                            <div className="markdown-body overflow-x-hidden">
                                <ReactMarkdown 
                                    remarkPlugins={[remarkGfm, remarkMath]} 
                                    rehypePlugins={[rehypeKatex]}
                                >
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
                        <div className="bg-[#111] border border-white/5 p-8 font-mono text-[13px] group relative rounded-sm shadow-inner mt-4">
                        <div className="absolute right-6 top-6 text-[10px] text-white/20 flex gap-4 uppercase tracking-widest font-sans">
                            {msg.ref}
                            <span className="material-symbols-outlined text-[14px] cursor-pointer hover:text-[#4ade80]">content_copy</span>
                        </div>
                        <pre className="text-white/70 whitespace-pre overflow-x-auto custom-scrollbar pb-2 leading-relaxed selection:bg-[#4ade80]/50">
                            {msg.code}
                        </pre>
                        </div>
                    ))}
                    </div>
                </div>
                ))}
                {isThinking && (
                  <div className="flex gap-8 animate-in fade-in duration-300">
                    <div className="w-10 h-10 flex-shrink-0 border border-[#4ade80]/30 bg-[#4ade80]/5 flex items-center justify-center rounded-sm">
                      <span className="material-symbols-outlined text-[#4ade80] text-[18px] animate-spin">memory</span>
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="text-[#4ade80]/20 font-mono tracking-widest text-[10px] select-none uppercase mb-2">--------------------</div>
                      <div className="text-[#4ade80] text-[16px] font-black tracking-widest flex items-center gap-3">
                        <span className="font-mono text-xl w-4 text-center">{frames[thinkingFrame]}</span>
                        THINKING...
                      </div>
                    </div>
                  </div>
                )}
                {isTerminalExecution && (
                  <div className="flex gap-8 animate-in fade-in duration-300">
                    <div className="w-10 h-10 flex-shrink-0 border border-[#facc15]/30 bg-[#facc15]/5 flex items-center justify-center rounded-sm">
                      <span className="material-symbols-outlined text-[#facc15] text-[18px] animate-pulse">terminal</span>
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="text-[#facc15]/20 font-mono tracking-widest text-[10px] select-none uppercase mb-2">--------------------</div>
                      <div className="text-[#facc15] text-[16px] font-black tracking-widest flex items-center gap-3">
                        <span className="font-mono text-xl w-4 text-center">{frames[thinkingFrame]}</span>
                        EXECUTING COMMAND...
                      </div>
                    </div>
                  </div>
                )}
                {pendingFileChange && (
                    <div className="flex gap-8 animate-in zoom-in-95 duration-300">
                        <div className="w-10 h-10 flex-shrink-0 border border-[#38bdf8]/30 bg-[#38bdf8]/5 flex items-center justify-center rounded-sm">
                            <span className="material-symbols-outlined text-[#38bdf8] text-[18px]">admin_panel_settings</span>
                        </div>
                        <div className="flex-1 bg-[#111] border border-[#38bdf8]/20 p-8 rounded-sm space-y-6 shadow-2xl">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black text-[#38bdf8] uppercase tracking-[0.2em]">Pending_File_Protocol</span>
                                    <h3 className="text-white text-lg font-bold tracking-tight">{pendingFileChange.filename}</h3>
                                </div>
                                <span className="material-symbols-outlined text-[#38bdf8] animate-pulse">description</span>
                            </div>
                            <div className="bg-black/40 border border-white/5 p-6 rounded-sm">
                                <pre className="text-[12px] text-white/40 font-mono whitespace-pre overflow-x-auto max-h-[200px] custom-scrollbar-mini">
                                    {pendingFileChange.content}
                                </pre>
                            </div>
                            <div className="flex gap-4 pt-2">
                                <button 
                                    onClick={handleApproveFileChange}
                                    className="px-8 py-3 bg-[#38bdf8] text-black text-[10px] font-black uppercase tracking-widest hover:bg-[#38bdf8]/80 transition-all rounded-sm shadow-[0_0_20px_rgba(56,189,248,0.2)]"
                                >
                                    Authorize Modification
                                </button>
                                <button 
                                    onClick={() => setPendingFileChange(null)}
                                    className="px-8 py-3 bg-white/5 border border-white/10 text-white/40 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all rounded-sm"
                                >
                                    Deny Access
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
          </div>
        </main>

        <aside className="w-[320px] bg-[#0a0a0a] border-l border-white/5 flex flex-col shrink-0 z-40 relative h-full">
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col h-full">
            <div className="p-8 space-y-4 border-b border-white/5 bg-[#0a0a0a] sticky top-0 z-20">
              <label className="uppercase text-white/20 text-[9px] font-bold tracking-[0.3em] block ml-1">AI Processor</label>
              <div className="relative">
                <div 
                  onClick={() => setIsModelOpen(!isModelOpen)}
                  className="bg-[#111] border border-white/10 p-4 flex justify-between items-center cursor-pointer hover:border-[#4ade80]/30 transition-all rounded-sm group shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#4ade80] text-lg group-hover:scale-110 transition-transform">{currentModel.icon}</span>
                    <span className="text-[11px] text-white font-black tracking-[0.05em] uppercase truncate max-w-[180px]">{currentModel.name}</span>
                  </div>
                  <span className={`material-symbols-outlined text-white/20 text-sm transition-transform duration-300 ${isModelOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </div>

                {isModelOpen && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-[#111] border border-white/10 rounded-sm z-50 shadow-2xl overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-150">
                    {models.map(model => (
                      <div 
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(model.id);
                          setIsModelOpen(false);
                        }}
                        className={`px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-[#4ade80]/5 transition-colors ${selectedModel === model.id ? 'bg-[#4ade80]/10 border-l-2 border-[#4ade80]' : ''}`}
                      >
                        <span className={`material-symbols-outlined text-lg ${selectedModel === model.id ? 'text-[#4ade80]' : 'text-white/20'}`}>{model.icon}</span>
                        <span className={`text-[10px] font-black tracking-wide uppercase ${selectedModel === model.id ? 'text-[#4ade80]' : 'text-white/60'}`}>{model.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-8 py-10 space-y-8">
              <div className="flex justify-between items-center ml-1">
                <label className="uppercase text-white/20 text-[9px] font-bold tracking-[0.3em] block">Workspace</label>
                <div className="flex gap-4">
                    <button className="text-white/20 hover:text-[#4ade80] transition-colors"><span className="material-symbols-outlined text-[16px]">search</span></button>
                    <button className="text-white/20 hover:text-[#4ade80] transition-colors"><span className="material-symbols-outlined text-[16px]">refresh</span></button>
                </div>
              </div>
              
              <div className="space-y-1 ml-1 max-h-[400px] overflow-y-auto custom-scrollbar-mini pr-2">
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
                          className={`flex items-center gap-3 py-2 px-3 rounded-sm cursor-pointer transition-colors group ${file.type === 'directory' ? 'text-white/40 hover:text-white/80' : 'text-white/60 hover:bg-white/5'}`}
                          style={{ paddingLeft: pathParts.length * 12 }}
                        >
                          <span className={`material-symbols-outlined text-lg transition-transform duration-200 ${file.type === 'directory' ? (expandedFolders.has(file.path) ? 'rotate-90 text-[#4ade80]' : 'text-white/20') : 'opacity-20 group-hover:opacity-60 text-[#4ade80]'}`}>
                            {file.type === 'directory' ? 'chevron_right' : 'description'}
                          </span>
                          <span className={`text-[11px] font-bold tracking-tight truncate ${file.type === 'directory' ? 'uppercase text-[9px] tracking-[0.1em]' : ''}`}>{file.name}</span>
                        </div>
                    );
                  })
                ) : (
                  <div className="text-[10px] text-white/10 font-mono italic p-4 text-center">NO REPOSITORY MOUNTED</div>
                )}
              </div>

              <div 
                onClick={handleMountWorkspace}
                className="mt-6 border border-white/5 border-dashed rounded-sm p-8 flex flex-col items-center justify-center gap-4 bg-white/[0.01] hover:bg-[#4ade80]/5 hover:border-[#4ade80]/20 transition-all cursor-pointer group"
              >
                <span className="material-symbols-outlined text-white/10 group-hover:text-[#4ade80]/40 text-3xl transition-colors">folder_zip</span>
                <span className="text-[9px] font-black text-white/20 group-hover:text-[#4ade80]/60 tracking-[0.2em] uppercase text-center leading-relaxed">Mount Local Workspace</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <footer className="bg-[#0a0a0a] border-t border-[#4ade80]/10 z-50 py-10 px-12 shrink-0">
        <div className="max-w-4xl mx-auto relative">
          {isShortcutsOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-6 bg-[#0d0d0d] border border-[#4ade80]/20 p-8 rounded-sm shadow-2xl animate-in slide-in-from-bottom-4 duration-300 z-[100] backdrop-blur-md">
              <div className="grid grid-cols-2 gap-12">
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#4ade80] text-[18px]">keyboard</span>
                    <span className="text-[10px] font-black text-[#4ade80] uppercase tracking-[0.3em]">Quick_Shortcuts</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-[11px] font-bold"><span className="text-white/30 tracking-widest uppercase">Open Settings</span> <span className="text-[#4ade80] font-mono">⌘ ,</span></div>
                    <div className="flex justify-between text-[11px] font-bold"><span className="text-white/30 tracking-widest uppercase">Terminal Mode</span> <span className="text-[#4ade80] font-mono">! cmd</span></div>
                    <div className="flex justify-between text-[11px] font-bold"><span className="text-white/30 tracking-widest uppercase">Help Context</span> <span className="text-[#4ade80] font-mono">?</span></div>
                  </div>
                </div>
                <div className="space-y-5 border-l border-white/5 pl-12">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#38bdf8] text-[18px]">info</span>
                    <span className="text-[10px] font-black text-[#38bdf8] uppercase tracking-[0.3em]">Protocol_Info</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] text-white/40 leading-relaxed font-bold tracking-tight uppercase">VEY AI CORE analyzes local files in real-time. Use '!' for direct OS terminal access.</p>
                  </div>
                </div>
              </div>
            </div>
          )}          <form className="w-full" onSubmit={handleSubmit}>
            <div className={`relative flex items-center group ${isCommandMode ? 'ring-2 ring-[#facc15]/30' : ''} ${isShortcutsOpen ? 'ring-2 ring-[#38bdf8]/30' : ''}`}>
                <span className={`absolute left-4 font-black text-xl transition-all duration-300 select-none ${isShortcutsOpen ? 'text-[#38bdf8]' : (isCommandMode ? 'text-[#facc15]' : 'text-[#4ade80] opacity-40')}`}>
                  {isCommandMode || input.startsWith('!') ? '>' : '/'}
                </span>
                <input 
                  className={`w-full bg-[#111] border rounded-sm focus:ring-1 ${isCommandMode ? 'text-[#facc15] border-[#facc15]/50 ring-[#facc15]/20 bg-[#111]/80' : 'text-[#4ade80]'} font-mono placeholder:text-white/5 pl-12 pr-16 text-lg transition-all py-6 tracking-tight shadow-2xl outline-none ${!isCommandMode && isShortcutsOpen ? 'border-[#38bdf8]/50 ring-[#38bdf8]/20 bg-[#111]/80' : (!isCommandMode ? 'border-white/5 focus:border-[#4ade80]/50 ring-[#4ade80]/20' : '')}`} 
                  placeholder={isCommandMode || input.startsWith('!') ? "SYSTEM COMMAND..." : (isShortcutsOpen ? "SHORTCUTS MENU ACTIVE... (ESC TO CLOSE)" : "EXECUTE ANALYTIC PROTOCOL...")} 
                  type="text"
                  autoFocus
                  value={input}
                  onChange={(e) => {
                      if (e.target.value === '?' && input === '') {
                          setIsShortcutsOpen(prev => !prev);
                      } else {
                          setInput(e.target.value);
                      }
                  }}
                />
                <div className="absolute right-4 flex items-center gap-4">
                  {isCommandMode && (
                    <span className="text-[9px] uppercase font-black tracking-widest text-[#facc15] border border-[#facc15]/30 px-3 py-1 rounded-sm animate-pulse bg-[#facc15]/10">
                      OS_EXEC
                    </span>
                  )}
                  <button type="submit" className={`w-10 h-10 flex items-center justify-center border hover:bg-white/5 transition-all rounded-sm group ${isCommandMode ? 'border-[#facc15]/30 hover:border-[#facc15]/50' : 'border-[#4ade80]/20 hover:border-[#4ade80]/50'}`}>
                    <span className={`material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-0.5 ${isCommandMode ? 'text-[#facc15]/70' : 'text-[#4ade80]/70'}`}>send</span>
                  </button>
                </div>
            </div>
          </form>
        </div>
      </footer>
    </div>
  );
}

export default App;
