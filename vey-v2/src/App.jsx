import React, { useState, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';

function App() {
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('PYTHON_LOCAL_AI');
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'VEY', content: 'SYSTEM INITIALIZED. STANDBY FOR COMMAND...' }
  ]);
  const [metrics, setMetrics] = useState({ cpu: 0, memory: 0, indexing: 0 });
  const [workspaceFiles, setWorkspaceFiles] = useState([]);
  const [ollamaModels, setOllamaModels] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set(['.'])); // Root expanded by default
  const [pendingFileChange, setPendingFileChange] = useState(null);
  const [settings, setSettings] = useState({
    groqKey: '',
    ollamaModel: 'deepseek-coder',
    theme: 'Obsidian'
  });

  const messagesEndRef = useRef(null);

  const models = [
    { id: 'PYTHON_LOCAL_AI', name: 'VEY_RAG_ENGINE (tuned)', icon: 'terminal' },
    { id: 'OLLAMA_RAG', name: `OLLAMA: ${settings.ollamaModel}`, icon: 'precision_manufacturing' },
    { id: 'GROQ_RAG', name: 'GROQ_CLOUD_LPU', icon: 'bolt' }
  ];

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

  // Fetch Workspace
  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/workspace/files');
        const data = await res.json();
        setWorkspaceFiles(data.files || []);
      } catch (e) {}
    };
    fetchWorkspace();
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

  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingFrame, setThinkingFrame] = useState(0);

  const frames = ['/', '-', '\\', '|'];

  useEffect(() => {
    let interval;
    if (isThinking) {
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
    const isTerminalCmd = rawInput.startsWith('!');
    
    // Add user message to UI
    const userMsg = { role: 'USR', content: rawInput };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    try {
      if (isTerminalCmd) {
        // TERMINAL MODE
        const cmd = rawInput.substring(1).trim();
        const response = await fetch('http://127.0.0.1:8000/terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: cmd })
        });
        const data = await response.json();
        setIsThinking(false);
        setMessages(prev => [...prev, { 
            role: 'VEY', 
            content: `TERMINAL_OUTPUT [${cmd}]:`,
            code: data.output,
            ref: 'BASH/POWERSHELL'
        }]);
      } else {
        // CHAT MODE
        const response = await fetch('http://127.0.0.1:8000/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
              messages: [{ role: 'user', content: rawInput }],
              model: selectedModel 
          })
        });
        const data = await response.json();
        setIsThinking(false);
        
        // Check for File Request tag
        const fileMatch = data.answer.match(/\[FILE_REQUEST:\s*([^\]]+)\]([\s\S]*?)\[\/FILE_REQUEST\]/);
        if (fileMatch) {
            setPendingFileChange({
                filename: fileMatch[1].trim(),
                content: fileMatch[2].trim(),
                originalResponse: data.answer.replace(/\[FILE_REQUEST:[\s\S]*?\[\/FILE_REQUEST\]/, '').trim()
            });
            setMessages(prev => [...prev, { role: 'VEY', content: "I've prepared a file change. Please review the request above." }]);
        } else {
            setMessages(prev => [...prev, { role: 'VEY', content: data.answer }]);
        }
      }
    } catch (err) {
      setIsThinking(false);
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
        if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            setIsShortcutsOpen(prev => !prev);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={`font-sans text-[#e0e0e0] selection:bg-[#4ade80]/30 selection:text-white h-screen flex flex-col overflow-hidden bg-[#0a0a0a] relative antialiased scroll-smooth ${settings.theme === 'High Contrast' ? 'contrast-125' : ''}`}>
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
                <div className="space-y-3">
                    <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest pl-1">API ACCESS KEY</span>
                    <input 
                      type="password"
                      placeholder="gsk_********************"
                      value={settings.groqKey}
                      onChange={(e) => setSettings({...settings, groqKey: e.target.value})}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-sm px-4 py-4 text-[13px] font-mono text-white/80 focus:border-[#38bdf8]/40 outline-none placeholder:text-white/5"
                    />
                </div>
              </div>

              {/* Theme Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#facc15] text-lg">palette</span>
                  <label className="uppercase text-white/40 text-[10px] font-bold tracking-[0.2em]">Visual Environment</label>
                </div>
                <div className="flex gap-4">
                  {['Obsidian', 'High Contrast', 'Amber Terminal'].map(t => (
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

      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col relative bg-[#0a0a0a] overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-12 lg:p-16 space-y-16 scroll-smooth">
            <div className="max-w-4xl mx-auto w-full space-y-16 pb-32">
                {messages.map((msg, i) => (
                <div key={i} className={`flex gap-8 group ${msg.error ? 'opacity-50' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    <div className={`w-10 h-10 flex-shrink-0 border flex items-center justify-center rounded-sm ${msg.role === 'VEY' ? 'border-[#4ade80]/30 bg-[#4ade80]/5' : 'border-white/10 bg-white/5'}`}>
                    <span className={`text-[10px] font-black tracking-tighter ${msg.role === 'VEY' ? 'text-[#4ade80]' : 'text-white/40'}`}>{msg.role}</span>
                    </div>
                    <div className="flex-1 space-y-6 min-w-0 pt-1">
                    <div className={`${msg.role === 'VEY' ? 'text-white/90' : 'text-[#4ade80]'} text-[16px] leading-[1.7] break-words font-medium`}>
                        {msg.content}
                    </div>
                    {msg.code && (
                        <div className="bg-[#111] border border-white/5 p-8 font-mono text-[13px] group relative rounded-sm shadow-inner mt-4">
                        <div className="absolute right-6 top-6 text-[10px] text-white/20 flex gap-4 uppercase tracking-widest font-sans">
                            {msg.ref}
                            <span className="material-symbols-outlined text-[14px] cursor-pointer hover:text-[#4ade80]">content_copy</span>
                        </div>
                        <pre className="text-white/70 whitespace-pre overflow-x-auto custom-scrollbar pb-2 leading-relaxed selection:bg-[#4ade80]/50">
                            {msg.code}
                        </pre>
                        </div>
                    )}
                    </div>
                </div>
                ))}
                {isThinking && (
                  <div className="flex gap-8 animate-in fade-in duration-300">
                    <div className="w-10 h-10 flex-shrink-0 border border-[#4ade80]/30 bg-[#4ade80]/5 flex items-center justify-center rounded-sm">
                      <span className="text-[10px] font-black tracking-tighter text-[#4ade80]">VEY</span>
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="text-[#4ade80] text-[16px] font-black tracking-widest flex items-center gap-3">
                        <span className="font-mono text-xl w-4 text-center">{frames[thinkingFrame]}</span>
                        THINKING...
                      </div>
                    </div>
                  </div>
                )}
                {pendingFileChange && (
                    <div className="flex gap-8 animate-in zoom-in-95 duration-300">
                        <div className="w-10 h-10 flex-shrink-0 border border-[#38bdf8]/30 bg-[#38bdf8]/5 flex items-center justify-center rounded-sm">
                            <span className="text-[10px] font-black tracking-tighter text-[#38bdf8]">SYS</span>
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
          )}
          <form className="w-full" onSubmit={handleSubmit}>
            <div className="relative flex items-center group">
                <span className={`absolute left-4 font-black text-xl transition-all duration-300 select-none ${isShortcutsOpen ? 'text-[#38bdf8]' : 'text-[#4ade80] opacity-40'}`}>
                  {input.startsWith('!') ? '>' : '/'}
                </span>
                <input 
                  className={`w-full bg-[#111] border rounded-sm focus:ring-1 text-[#4ade80] font-mono placeholder:text-white/5 pl-12 pr-32 text-lg transition-all py-6 tracking-tight shadow-2xl outline-none ${isShortcutsOpen ? 'border-[#38bdf8]/50 ring-[#38bdf8]/20' : 'border-white/5 focus:border-[#4ade80]/50 ring-[#4ade80]/20'}`} 
                  placeholder={input.startsWith('!') ? "SYSTEM COMMAND..." : "EXECUTE ANALYTIC PROTOCOL..."} 
                  type="text"
                  autoFocus
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <div className="absolute right-4 flex items-center gap-4">
                  <button 
                    type="button" 
                    onClick={() => setIsShortcutsOpen(!isShortcutsOpen)}
                    className={`text-[10px] font-black tracking-widest uppercase transition-all px-3 py-1.5 border rounded-sm ${isShortcutsOpen ? 'bg-[#38bdf8]/10 border-[#38bdf8] text-[#38bdf8]' : 'text-white/20 hover:text-white/40 border-white/10 hover:border-white/20'}`}
                  >
                    Shortcuts?
                  </button>
                  <button type="submit" className="w-10 h-10 bg-[#4ade80]/10 border border-[#4ade80]/20 rounded-sm flex items-center justify-center hover:bg-[#4ade80] hover:text-[#0a0a0a] transition-all text-[#4ade80] shadow-[0_0_15px_rgba(74,222,128,0.2)]">
                      <span className="material-symbols-outlined text-[20px]">send</span>
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
