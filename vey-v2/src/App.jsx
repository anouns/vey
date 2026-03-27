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

// ─── BOOT SCREEN ───────────────────────────────────────────────────
function BootScreen({ bootSteps, onSkip, bootLog }) {
  const [glitchText, setGlitchText] = useState('');
  const glitchChars = '█▓▒░╔╗╚╝║═╬╣╠╩╦';

  useEffect(() => {
    const interval = setInterval(() => {
      let t = '';
      for (let i = 0; i < 24; i++) {
        t += glitchChars[Math.floor(Math.random() * glitchChars.length)];
      }
      setGlitchText(t);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  const completedSteps = bootSteps.filter(s => s.done).length;
  const totalSteps = bootSteps.length;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div className="boot-screen">
      {/* Animated background grid */}
      <div className="boot-grid" />

      {/* Scan lines */}
      <div className="boot-scanlines" />

      {/* Main content */}
      <div className="boot-content">
        {/* Logo */}
        <div className="boot-logo-container">
          <div className="boot-hex-ring">
            <svg viewBox="0 0 120 120" className="boot-hex-svg">
              <defs>
                <linearGradient id="hexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#4ade80', stopOpacity: 0.8 }} />
                  <stop offset="100%" style={{ stopColor: '#22d3ee', stopOpacity: 0.4 }} />
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r="50" fill="none" stroke="url(#hexGrad)" strokeWidth="1.5" className="boot-ring-1" />
              <circle cx="60" cy="60" r="42" fill="none" stroke="#4ade80" strokeWidth="0.5" opacity="0.3" className="boot-ring-2" />
              <circle cx="60" cy="60" r="35" fill="none" stroke="#4ade80" strokeWidth="2" strokeDasharray="8 4" className="boot-ring-3" />
            </svg>
          </div>
          <div className="boot-logo-text">VEY</div>
          <div className="boot-logo-sub">.AI</div>
        </div>

        {/* Status */}
        <div className="boot-status">
          <div className="boot-status-label">SYSTEM INITIALIZATION</div>
          <div className="boot-progress-container">
            <div className="boot-progress-bar" style={{ width: `${progress}%` }} />
            <div className="boot-progress-glow" style={{ left: `${progress}%` }} />
          </div>
          <div className="boot-progress-text">{Math.round(progress)}%</div>
        </div>

        {/* Boot steps */}
        <div className="boot-steps">
          {bootSteps.map((step, i) => (
            <div key={i} className={`boot-step ${step.done ? 'done' : step.active ? 'active' : step.error ? 'error' : 'pending'}`}>
              <div className="boot-step-indicator">
                {step.done ? '✓' : step.error ? '✕' : step.active ? '◆' : '○'}
              </div>
              <div className="boot-step-text">{step.label}</div>
              {step.active && <div className="boot-step-spinner" />}
              {step.detail && <div className="boot-step-detail">{step.detail}</div>}
            </div>
          ))}
        </div>

        {/* Boot log */}
        {bootLog.length > 0 && (
          <div className="boot-log">
            {bootLog.slice(-6).map((line, i) => (
              <div key={i} className="boot-log-line">{line}</div>
            ))}
          </div>
        )}

        {/* Decorative glitch text */}
        <div className="boot-glitch">{glitchText}</div>

        {/* Skip button */}
        <button onClick={onSkip} className="boot-skip-btn">
          ПРОПУСТИТЬ ЗАГРУЗКУ
        </button>
      </div>
    </div>
  );
}

// ─── THINKING DISPLAY ──────────────────────────────────────────────
function ThinkingDisplay({ steps, isStreaming }) {
  return (
    <div className="thinking-display">
      <div className="thinking-display-header">
        <span className="material-symbols-outlined spinning thinking-display-icon">psychology</span>
        <span className="thinking-display-title">ПРОЦЕСС РАЗМЫШЛЕНИЯ</span>
      </div>
      <div className="thinking-display-steps">
        {steps.map((step, i) => (
          <div key={i} className={`thinking-display-step ${i === steps.length - 1 && !isStreaming ? 'active' : i === steps.length - 1 ? 'active' : 'done'}`}>
            <div className="thinking-step-dot" />
            <span>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── UTILS ────────────────────────────────────────────────────────
const normalizeLaTeX = (text) => {
  if (!text) return "";
  return text
    .replace(/\\\[/g, '$$$$')
    .replace(/\\\]/g, '$$$$')
    .replace(/\\\(/g, '$$')
    .replace(/\\\)/g, '$$')
    // Handle the case where the AI might output [ formula ] (old style)
    .replace(/\[\s*([\s\S]+?)\s*\]/g, (match, p1) => {
       // Only replace if it looks like a formula (contains subscripts, symbols, etc)
       if (p1.includes('_') || p1.includes('^') || p1.includes('\\') || p1.includes('=')) {
         return '$$' + p1 + '$$';
       }
       return match;
    });
};

// ─── STREAMING MESSAGE ─────────────────────────────────────────────
function StreamingMessage({ content, thinkingSteps, isComplete }) {
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setCursorVisible(v => !v), 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`message ${isComplete ? 'complete' : 'streaming'}`}>
      <div className="message-avatar avatar-ai">
        <span className="material-symbols-outlined glowing-neon">memory</span>
      </div>
      <div className="message-body">
        {/* Thinking steps */}
        {thinkingSteps.length > 0 && (
          <div className="thinking-process">
            <div className="thinking-header">
              <span className="material-symbols-outlined spinning">cyclone</span>
              <span className="thinking-label">ПРОЦЕСС РАЗМЫШЛЕНИЯ</span>
            </div>
            <div className="thinking-steps-flow">
              {thinkingSteps.map((step, i) => (
                <div key={i} className="thinking-display-step">
                  <div className="thinking-step-dot" />
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Streaming content */}
        {content && (
          <div className="message-text text-ai">
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                {normalizeLaTeX(content)}
              </ReactMarkdown>
              {!isComplete && cursorVisible && <span className="streaming-cursor">▊</span>}
            </div>
          </div>
        )}
        {!content && !isComplete && thinkingSteps.length === 0 && (
          <div className="thinking-indicator">
            <span className="material-symbols-outlined spinning">hourglass_top</span>
            Обрабатываю запрос...
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SETTINGS PANEL ─────────────────────────────────────────────────
function SettingsPanel({ settings, setSettings, ollamaModels, groqModels, onClose, setSelectedModel }) {
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="settings-header">
          <div className="settings-header-left">
            <span className="material-symbols-outlined settings-icon">settings</span>
            <span className="settings-title">SYSTEM_PARAMETERS // V.2.1.0</span>
          </div>
          <div className="settings-header-right">
            <span className="settings-status-text">STATUS: CONFIG_MODE</span>
            <div className="status-dot" />
          </div>
        </div>

        <div className="settings-body">
          {/* Section 01: Neural Engine */}
          <div className="settings-section">
            <div className="settings-section-label">
              <span>01. NEURAL_ENGINE</span>
            </div>

            <div className="settings-grid-2">
              {/* Ollama */}
              <div className="settings-field">
                <span className="field-label">PROVIDER: OLLAMA</span>
                <select
                  value={settings.ollamaModel}
                  onChange={(e) => setSettings({ ...settings, ollamaModel: e.target.value })}
                  className="field-select"
                >
                  {ollamaModels.length > 0 ? (
                    ollamaModels.map(m => <option key={m} value={m}>{m}</option>)
                  ) : (
                    <option>No models found</option>
                  )}
                </select>
                <div className="field-hint">Localhost connection active :11434</div>
              </div>

              {/* Groq */}
              <div className="settings-field">
                <span className="field-label">PROVIDER: GROQ_CLOUD</span>
                <input
                  type="password"
                  placeholder="••••••••••••••"
                  value={settings.groqKey}
                  onChange={(e) => setSettings({ ...settings, groqKey: e.target.value })}
                  className="field-input"
                />
              </div>
            </div>

            {/* Groq Model */}
            <div className="settings-field-right">
              <select
                value={settings.groqModel || ''}
                onChange={(e) => {
                  setSettings(prev => ({ ...prev, groqModel: e.target.value }));
                  setSelectedModel(e.target.value);
                }}
                className="field-select"
              >
                {groqModels.length > 0 ? (
                  groqModels.map(m => <option key={m} value={m}>{m} (Production)</option>)
                ) : (
                  <option>Enter Key to load models</option>
                )}
              </select>
            </div>
          </div>

          {/* Section 02: Visual Interface */}
          <div className="settings-section">
            <div className="settings-section-label">
              <span>02. VISUAL_INTERFACE</span>
            </div>

            <div className="settings-themes">
              {[
                { id: 'Obsidian', label: 'OBSIDIAN', colors: ['#1a1a2e', '#4ade80', '#38bdf8'] },
                { id: 'High Contrast', label: 'HIGH_CONTRAST', colors: ['#1a1a2e', '#ec4899', '#a855f7'] },
                { id: 'Light Theme', label: 'AMBER_TERM', colors: ['#f59e0b', '#fb923c'] },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setSettings({ ...settings, theme: t.id })}
                  className={`theme-card ${settings.theme === t.id ? 'active' : ''}`}
                >
                  {settings.theme === t.id && <div className="theme-active-dot" />}
                  <div className="theme-label">{t.label}</div>
                  <div className="theme-colors">
                    {t.colors.map((c, i) => (
                      <div key={i} className="theme-swatch" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="settings-footer">
            <div className="settings-footer-status">
              <div className="footer-status-line dim">LOCAL_AUTH: VERIFIED</div>
              <div className="footer-status-line green">SYNC: ENABLED</div>
            </div>
            <div className="settings-footer-actions">
              <button onClick={onClose} className="btn-ghost">CLOSE_SESSION</button>
              <button onClick={onClose} className="btn-primary">
                COMMIT_CHANGES
                <span className="material-symbols-outlined btn-icon">check_circle</span>
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
    <div className="terminal-block">
      <div className="terminal-header-badge">
        TERMINAL_SESSION
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>terminal</span>
      </div>
      <div className="terminal-output">
        {history.map((h, i) => (
          <div key={i} className="terminal-entry">
            <div className="terminal-cmd">{'>'} {h.cmd}</div>
            <div className="terminal-result">{h.output}</div>
          </div>
        ))}
        {isWorking && <div className="terminal-working">...</div>}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={runCmd} className="terminal-input-form">
        <span className="terminal-prompt">{'>'}</span>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          className="terminal-input"
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
  const [expandedFolders, setExpandedFolders] = useState(new Set(['.']));
  const [pendingFileChange, setPendingFileChange] = useState(null);
  const [settings, setSettings] = useState(loadSettings());
  const [isThinking, setIsThinking] = useState(false);
  const [isTerminalExecution, setIsTerminalExecution] = useState(false);
  const [thinkingFrame, setThinkingFrame] = useState(0);

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingThinkingSteps, setStreamingThinkingSteps] = useState([]);

  // Boot log for detailed progress visibility
  const [bootLog, setBootLog] = useState([]);

  const [bootSteps, setBootSteps] = useState([
    { label: 'Инициализация ядра', done: false, active: true },
    { label: 'Подключение к AI-бэкенду', done: false, active: false },
    { label: 'Проверка WebView2', done: false, active: false },
    { label: 'Загрузка рабочей области', done: false, active: false },
    { label: 'Система готова', done: false, active: false },
  ]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const frames = ['/', '-', '\\', '|'];
  const abortControllerRef = useRef(null);

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

  useEffect(() => { scrollToBottom(); }, [messages, streamingContent]);

  // Thinking animation
  useEffect(() => {
    let interval;
    if (isThinking || isTerminalExecution) {
      interval = setInterval(() => { setThinkingFrame(f => (f + 1) % frames.length); }, 150);
    }
    return () => clearInterval(interval);
  }, [isThinking, isTerminalExecution]);

  // Metrics polling
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/metrics');
        const data = await res.json();
        setMetrics(data);
        if (!backendReady) {
          setBackendReady(true);
          try {
            const savedPath = localStorage.getItem('vey_workspace');
            const url = savedPath
              ? `http://127.0.0.1:8000/workspace/files?path=${encodeURIComponent(savedPath)}`
              : 'http://127.0.0.1:8000/workspace/files';
            const filesRes = await fetch(url);
            const filesData = await filesRes.json();
            setWorkspaceFiles(filesData.files || []);
          } catch (e) { }
        }
      } catch (e) { }
    };
    const interval = setInterval(fetchMetrics, 3000);
    fetchMetrics();
    return () => clearInterval(interval);
  }, [backendReady]);

  // Boot sequence with step-by-step progress and detailed logging
  useEffect(() => {
    let checkInterval;
    let bootStart = Date.now();
    let attempt = 0;

    const addLog = (msg) => {
      const ts = ((Date.now() - bootStart) / 1000).toFixed(1);
      setBootLog(prev => [...prev, `[${ts}s] ${msg}`]);
    };

    addLog('VEY.AI v2.1.0 — Запуск системы');

    // Step 1 completes immediately (init)
    setTimeout(() => {
      addLog('Ядро инициализировано');
      setBootSteps(prev => prev.map((s, i) =>
        i === 0 ? { ...s, done: true, active: false } :
          i === 1 ? { ...s, active: true } : s
      ));
      addLog('Поиск AI-бэкенда на порту 8000...');
    }, 500);

    const pingBackend = async () => {
      attempt++;
      try {
        const res = await fetch('http://127.0.0.1:8000/status', { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const statusData = await res.json();
          addLog(`Бэкенд обнаружен (PID: ${statusData.pid || '?'}, аптайм: ${statusData.uptime_sec || 0}с)`);

          // Step 2: Backend connected
          setBootSteps(prev => prev.map((s, i) =>
            i <= 1 ? { ...s, done: true, active: false } :
              i === 2 ? { ...s, active: true } : s
          ));

          addLog('Проверка WebView2 компонентов...');

          setTimeout(() => {
            addLog('WebView2 — OK');
            setBootSteps(prev => prev.map((s, i) =>
              i <= 2 ? { ...s, done: true, active: false } :
                i === 3 ? { ...s, active: true } : s
            ));
            addLog('Загрузка рабочей области...');
          }, 300);

          // Load workspace
          try {
            const wsRes = await fetch('http://127.0.0.1:8000/workspace/current');
            const wsData = await wsRes.json();
            if (wsData.path) {
              setWorkspacePath(wsData.path);
              localStorage.setItem('vey_workspace', wsData.path);
              addLog(`Рабочая область: ${wsData.path}`);
            }
          } catch (e) { }

          try {
            const savedPath = localStorage.getItem('vey_workspace');
            const url = savedPath
              ? `http://127.0.0.1:8000/workspace/files?path=${encodeURIComponent(savedPath)}`
              : 'http://127.0.0.1:8000/workspace/files';
            const filesRes = await fetch(url);
            const filesData = await filesRes.json();
            setWorkspaceFiles(filesData.files || []);
            addLog(`Файлов загружено: ${(filesData.files || []).length}`);
          } catch (e) { }

          // Step 4: workspace loaded
          setTimeout(() => {
            setBootSteps(prev => prev.map((s, i) =>
              i <= 3 ? { ...s, done: true, active: false } :
                i === 4 ? { ...s, active: true } : s
            ));
            addLog('Подготовка интерфейса...');
          }, 600);

          // Step 5: ready
          setTimeout(() => {
            addLog('═══ СИСТЕМА ГОТОВА ═══');
            setBootSteps(prev => prev.map(s => ({ ...s, done: true, active: false })));
            setBackendReady(true);
            clearInterval(checkInterval);
          }, 1200);

          return;
        }
      } catch (e) {
        if (attempt % 3 === 0) {
          addLog(`Попытка ${attempt}: ожидание бэкенда...`);
        }

        // Try the old /metrics endpoint as fallback
        try {
          const fallback = await fetch('http://127.0.0.1:8000/metrics', { signal: AbortSignal.timeout(2000) });
          if (fallback.ok) {
            addLog('Бэкенд обнаружен (legacy mode)');

            setBootSteps(prev => prev.map((s, i) =>
              i <= 1 ? { ...s, done: true, active: false } :
                i === 2 ? { ...s, active: true } : s
            ));

            setTimeout(() => {
              setBootSteps(prev => prev.map((s, i) =>
                i <= 3 ? { ...s, done: true, active: false } :
                  i === 4 ? { ...s, active: true } : s
              ));
            }, 500);

            setTimeout(() => {
              addLog('═══ СИСТЕМА ГОТОВА ═══');
              setBootSteps(prev => prev.map(s => ({ ...s, done: true, active: false })));
              setBackendReady(true);
              clearInterval(checkInterval);
            }, 1000);

            return;
          }
        } catch (e2) { }

        // Auto-skip after 20 seconds
        if (Date.now() - bootStart > 20000) {
          addLog('⚠ Таймаут подключения к бэкенду');
          setBackendReady(true);
          clearInterval(checkInterval);
          setMessages(prev => [...prev, {
            role: 'VEY',
            content: '⚠️ AI-бэкенд не обнаружен. Используйте Groq или Ollama, либо запустите бэкенд вручную:\n\n```\npython scripts/ai_service.py\n```\n\nБэкенд подключится автоматически когда будет готов.'
          }]);
          return;
        }
      }
    };

    // Start checking after a small delay to let the backend process spawn
    setTimeout(() => {
      checkInterval = setInterval(pingBackend, 1000);
      pingBackend();
    }, 800);

    return () => clearInterval(checkInterval);
  }, []);

  const handleSkipBoot = () => {
    setBackendReady(true);
    setMessages(prev => [...prev, {
      role: 'VEY',
      content: '⚠️ Загрузка пропущена. AI-бэкенд подключится автоматически когда будет готов.'
    }]);
  };

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

  // Fetch Ollama Models
  useEffect(() => {
    const fetchOllama = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/models/ollama');
        const data = await res.json();
        setOllamaModels(data.models || []);
      } catch (e) { }
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
            setSettings(prev => ({ ...prev, groqModel: gm[0] }));
          }
        }
      } catch (e) { }
    };
    fetchGroq();
  }, [settings.groqKey, isSettingsOpen]);

  // ─── PROCESS AI RESPONSE ──────────────────────────────────────────
  const processAIResponse = useCallback(async (answer) => {
    const fileMatch = answer.match(/\[FILE_REQUEST:\s*([^\]]+)\]([\s\S]*?)\[\/FILE_REQUEST\]/);
    const editMatch = answer.match(/\[FILE_EDIT:\s*([^\]]+)\]([\s\S]*?)\[\/FILE_EDIT\]/);
    const patchMatch = answer.match(/\[FILE_PATCH:\s*([^\]]+)\]([\s\S]*?)\[\/FILE_PATCH\]/);
    const folderMatch = answer.match(/\[OPEN_FOLDER:\s*([^\]]+)\]/);
    const pdfMatch = answer.match(/\[PDF_REQUEST:\s*([^\]]+)\]([\s\S]*?)\[\/PDF_REQUEST\]/);

    let cleanedAnswer = answer
      .replace(/\[OPEN_FOLDER:[\s\S]*?\]/, '')
      .replace(/\[FILE_PATCH:[\s\S]*?\[\/FILE_PATCH\]/, '')
      .replace(/\[FILE_EDIT:[\s\S]*?\[\/FILE_EDIT\]/, '')
      .replace(/\[FILE_REQUEST:[\s\S]*?\[\/FILE_REQUEST\]/, '')
      .replace(/\[PDF_REQUEST:[\s\S]*?\[\/PDF_REQUEST\]/, '')
      .trim();

    if (folderMatch) {
      const folderPath = folderMatch[1].trim();
      setMessages(prev => [...prev, { role: 'VEY', content: cleanedAnswer || `Открываю папку: ${folderPath}` }]);
      try {
        const res = await fetch(`http://127.0.0.1:8000/workspace/files?path=${encodeURIComponent(folderPath)}`);
        const wsData = await res.json();
        setWorkspaceFiles(wsData.files || []);
        setWorkspacePath(folderPath);
        localStorage.setItem('vey_workspace', folderPath);
      } catch (e) { }
      return;
    }

    if (pdfMatch) {
      setPendingFileChange({
        type: 'pdf',
        filename: pdfMatch[1].trim(),
        content: pdfMatch[2].trim(),
        originalResponse: cleanedAnswer
      });
      setMessages(prev => [...prev, { role: 'VEY', content: cleanedAnswer || `Подготовлен файл \`${pdfMatch[1].trim()}\` для выгрузки в PDF.` }]);
      return;
    }

    if (patchMatch) {
      const filepath = patchMatch[1].trim();
      const findMatch = patchMatch[2].match(/\[FIND\]([\s\S]*?)\[\/FIND\]/);
      const replaceMatch = patchMatch[2].match(/\[REPLACE\]([\s\S]*?)\[\/REPLACE\]/);
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
      setPendingFileChange({
        type: 'edit',
        filename: editMatch[1].trim(),
        content: editMatch[2].trim(),
        originalResponse: cleanedAnswer
      });
      setMessages(prev => [...prev, { role: 'VEY', content: cleanedAnswer || `Готово к изменению файла \`${editMatch[1].trim()}\`` }]);
      return;
    }

    if (fileMatch) {
      setPendingFileChange({
        type: 'create',
        filename: fileMatch[1].trim(),
        content: fileMatch[2].trim(),
        originalResponse: cleanedAnswer
      });
      setMessages(prev => [...prev, { role: 'VEY', content: cleanedAnswer || `Готов создать файл \`${fileMatch[1].trim()}\`` }]);
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

  // ─── STREAMING SUBMIT HANDLER ────────────────────────────────────
  const handleStreamingSubmit = async (rawInput) => {
    setIsStreaming(true);
    setStreamingContent('');
    setStreamingThinkingSteps([]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('http://127.0.0.1:8000/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: rawInput }],
          model: selectedModel,
          api_key: settings.groqKey,
          stream: true
        }),
        signal: controller.signal
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'thinking') {
                setStreamingThinkingSteps(prev => [...prev, data.content]);
              } else if (data.type === 'chunk') {
                fullContent += data.content;
                setStreamingContent(fullContent);
              } else if (data.type === 'error') {
                fullContent += (fullContent ? '\n\n' : '') + `❌ ${data.content}`;
                setStreamingContent(fullContent);
              } else if (data.type === 'done') {
                const finalContent = data.full_content || fullContent;
                setIsStreaming(false);
                setStreamingContent('');
                setStreamingThinkingSteps([]);
                await processAIResponse(finalContent);
                return;
              }
            } catch (e) { }
          }
        }
      }

      // If we got here without a 'done' event, finalize
      if (fullContent) {
        setIsStreaming(false);
        setStreamingContent('');
        setStreamingThinkingSteps([]);
        await processAIResponse(fullContent);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setIsStreaming(false);
      setStreamingContent('');
      setStreamingThinkingSteps([]);
      // Fall back to non-streaming
      try {
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
        await processAIResponse(data.answer);
      } catch (fallbackErr) {
        setMessages(prev => [...prev, { role: 'VEY', content: '❌ Сервис недоступен. Проверьте backend.', error: true }]);
      }
    }
  };

  // ─── SUBMIT HANDLER ───────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isThinking || isStreaming) return;

    const rawInput = input.trim();
    const isTerminalCmd = rawInput.startsWith('!');

    const userMsg = { role: 'USR', content: rawInput };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    if (isTerminalCmd) {
      setIsTerminalExecution(true);
      try {
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
      } catch (err) {
        setIsTerminalExecution(false);
        setMessages(prev => [...prev, { role: 'VEY', content: '❌ Сервис недоступен. Проверьте backend.', error: true }]);
      }
    } else {
      // Use streaming by default
      await handleStreamingSubmit(rawInput);
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
        // Cancel streaming
        if (isStreaming && abortControllerRef.current) {
          abortControllerRef.current.abort();
          setIsStreaming(false);
          setStreamingContent('');
          setStreamingThinkingSteps([]);
        }
      }
    };

    const handleGlobalClick = (e) => {
      // Handle code copy buttons
      const copyBtn = e.target.closest('.code-copy-btn');
      if (copyBtn) {
        const codeBlock = copyBtn.closest('.code-block');
        const codeText = codeBlock?.querySelector('.code-content')?.innerText || 
                         codeBlock?.querySelector('pre')?.innerText;
        if (codeText) {
          navigator.clipboard.writeText(codeText);
          const originalIcon = copyBtn.innerText;
          copyBtn.innerText = 'done';
          setTimeout(() => { copyBtn.innerText = originalIcon; }, 2000);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleGlobalClick);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleGlobalClick);
    };
  }, [isStreaming, pendingFileChange]);

  // ─── RENDER ──────────────────────────────────────────────────────
  if (!backendReady) {
    return (
      <div className={`app-root ${settings.theme === 'High Contrast' ? 'contrast-125' : ''} ${settings.theme === 'Light Theme' ? 'invert hue-rotate-180' : ''}`}>
        {/* Titlebar even during boot */}
        <div data-tauri-drag-region className="titlebar">
          <div data-tauri-drag-region className="titlebar-label">VEY.AI</div>
          <div className="titlebar-controls">
            <button onClick={() => appWindow.minimize()} className="titlebar-btn material-symbols-outlined">remove</button>
            <button onClick={() => appWindow.toggleMaximize()} className="titlebar-btn material-symbols-outlined">crop_square</button>
            <button onClick={() => appWindow.close()} className="titlebar-btn titlebar-btn-close material-symbols-outlined">close</button>
          </div>
        </div>
        <BootScreen bootSteps={bootSteps} onSkip={handleSkipBoot} bootLog={bootLog} />
      </div>
    );
  }

  return (
    <div className={`app-root ${settings.theme === 'High Contrast' ? 'contrast-125' : ''} ${settings.theme === 'Light Theme' ? 'invert hue-rotate-180' : ''}`}>

      {/* Titlebar */}
      <div data-tauri-drag-region className="titlebar">
        <div data-tauri-drag-region className="titlebar-label">VEY.AI</div>
        <div className="titlebar-controls">
          <button onClick={() => appWindow.minimize()} className="titlebar-btn material-symbols-outlined">remove</button>
          <button onClick={() => appWindow.toggleMaximize()} className="titlebar-btn material-symbols-outlined">crop_square</button>
          <button onClick={() => appWindow.close()} className="titlebar-btn titlebar-btn-close material-symbols-outlined">close</button>
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

      {/* Top Bar */}
      <header className="top-bar">
        <div className="top-bar-left">
          <span className="top-bar-logo">
            <div className="logo-dot" />
            VEY
          </span>
          <div className="top-bar-metrics">
            {/* CPU */}
            <div className="metric">
              <div className="metric-header">
                <span className="metric-label">CPU</span>
                <span className="metric-value green">{metrics.cpu}%</span>
              </div>
              <div className="metric-track">
                <div className="metric-fill green" style={{ width: `${metrics.cpu}%` }} />
              </div>
            </div>
            {/* RAM */}
            <div className="metric">
              <div className="metric-header">
                <span className="metric-label">RAM</span>
                <span className="metric-value blue">{metrics.memory}%</span>
              </div>
              <div className="metric-track">
                <div className="metric-fill blue" style={{ width: `${metrics.memory}%` }} />
              </div>
            </div>
          </div>
        </div>
        <div className="top-bar-right">
          {isStreaming && (
            <div className="streaming-badge">
              <span className="material-symbols-outlined spinning" style={{ fontSize: 14 }}>sync</span>
              STREAMING
            </div>
          )}
          <div className="version-tag">v2.1.0</div>
          <button onClick={() => setIsSettingsOpen(true)} className="settings-btn">
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="main-layout">
        {/* Chat Area */}
        <main className="chat-area">
          <div className="chat-scroll">
            <div className="chat-container">
              {/* Messages */}
              {messages.map((msg, i) => (
                <div key={i} className={`message ${msg.error ? 'message-error' : ''}`}>
                  <div className={`message-avatar ${msg.role === 'VEY' || msg.role === 'SYS' ? 'avatar-ai' : 'avatar-user'}`}>
                    {msg.role === 'VEY' || msg.role === 'SYS' ? (
                      <span className="material-symbols-outlined">memory</span>
                    ) : (
                      <span className="material-symbols-outlined">person</span>
                    )}
                  </div>
                  <div className="message-body">
                    <div className={`message-text ${msg.role === 'VEY' || msg.role === 'SYS' ? 'text-ai' : 'text-user'}`}>
                      {msg.role === 'VEY' || msg.role === 'SYS' ? (
                        <div className="markdown-body">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {normalizeLaTeX(msg.content)}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                    {msg.code && msg.isTerminal ? (
                      <InteractiveTerminal initialCmd={msg.cmd} initialOutput={msg.code} />
                    ) : (msg.code && (
                      <div className="code-block">
                        <div className="code-block-header">
                          {msg.ref}
                          <span className="material-symbols-outlined code-copy-btn">content_copy</span>
                        </div>
                        <pre className="code-content">{msg.code}</pre>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Streaming Response */}
              {isStreaming && (
                <StreamingMessage
                  content={streamingContent}
                  thinkingSteps={streamingThinkingSteps}
                  isComplete={false}
                />
              )}

              {/* Terminal Execution */}
              {isTerminalExecution && (
                <div className="message">
                  <div className="message-avatar avatar-terminal">
                    <span className="material-symbols-outlined pulsing">terminal</span>
                  </div>
                  <div className="message-body">
                    <div className="terminal-indicator">
                      <span className="thinking-frame">{frames[thinkingFrame]}</span>
                      Выполняю команду...
                    </div>
                  </div>
                </div>
              )}

              {/* Pending File Change */}
              {pendingFileChange && (
                <div className="message">
                  <div className="message-avatar avatar-file">
                    <span className="material-symbols-outlined">description</span>
                  </div>
                  <div className="file-change-card">
                    <div className="file-change-header">
                      <div>
                        <span className="file-change-type">
                          {pendingFileChange.type === 'patch' ? 'Патч файла' : pendingFileChange.type === 'edit' ? 'Изменение файла' : 'Создание файла'}
                        </span>
                        <h3 className="file-change-name">{pendingFileChange.filename}</h3>
                      </div>
                      <span className="material-symbols-outlined pulsing file-change-icon">
                        {pendingFileChange.type === 'pdf' ? 'picture_as_pdf' : 'edit_document'}
                      </span>
                    </div>
                    <div className="file-change-preview">
                      <pre>
                        {pendingFileChange.type === 'patch'
                          ? `FIND:\n${pendingFileChange.findText}\n\nREPLACE:\n${pendingFileChange.replaceText}`
                          : pendingFileChange.content?.substring(0, 2000) + (pendingFileChange.content?.length > 2000 ? '\n...(ещё)' : '')}
                      </pre>
                    </div>
                    <div className="file-change-actions">
                      <button onClick={handleApproveFileChange} className="btn-approve">
                        {pendingFileChange.type === 'pdf' ? 'Скачать PDF' : 'Применить'}
                      </button>
                      <button onClick={() => setPendingFileChange(null)} className="btn-reject">Отклонить</button>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        </main>

        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-inner">
            {/* Model Selector */}
            <div className="sidebar-section sidebar-model-section">
              <label className="sidebar-label">AI Processor</label>
              <div className="model-selector-wrapper">
                <div onClick={() => setIsModelOpen(!isModelOpen)} className="model-selector">
                  <div className="model-selector-content">
                    <span className="material-symbols-outlined model-icon">{currentModel.icon}</span>
                    <span className="model-name">{currentModel.name}</span>
                  </div>
                  <span className={`material-symbols-outlined model-chevron ${isModelOpen ? 'rotated' : ''}`}>expand_more</span>
                </div>

                {isModelOpen && (
                  <div className="model-dropdown">
                    {models.map(model => (
                      <div
                        key={model.id}
                        onClick={() => { setSelectedModel(model.id); setIsModelOpen(false); }}
                        className={`model-option ${selectedModel === model.id ? 'active' : ''}`}
                      >
                        <span className={`material-symbols-outlined model-option-icon ${selectedModel === model.id ? 'active' : ''}`}>{model.icon}</span>
                        <span className={`model-option-name ${selectedModel === model.id ? 'active' : ''}`}>{model.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Workspace */}
            <div className="sidebar-section sidebar-workspace-section">
              <div className="workspace-header">
                <label className="sidebar-label">Workspace</label>
                <button onClick={async () => {
                  try {
                    const res = await fetch('http://127.0.0.1:8000/workspace/files');
                    const data = await res.json();
                    setWorkspaceFiles(data.files || []);
                  } catch (e) { }
                }} className="workspace-refresh-btn">
                  <span className="material-symbols-outlined">refresh</span>
                </button>
              </div>

              <div className="file-tree">
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
                        className={`file-tree-item ${file.type === 'directory' ? 'is-dir' : 'is-file'}`}
                        style={{ paddingLeft: pathParts.length * 10 }}
                      >
                        <span className={`material-symbols-outlined file-tree-icon ${file.type === 'directory'
                            ? (expandedFolders.has(file.path) ? 'expanded' : '')
                            : 'file-icon'
                          }`}>
                          {file.type === 'directory' ? 'chevron_right' : 'description'}
                        </span>
                        <span className={`file-tree-name ${file.type === 'directory' ? 'dir-name' : ''}`}>
                          {file.name}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="file-tree-empty">Нет подключённой папки</div>
                )}
              </div>

              <div onClick={handleMountWorkspace} className="mount-workspace-btn">
                <span className="material-symbols-outlined mount-icon">folder_open</span>
                <span className="mount-label">Открыть папку</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Input Bar */}
      <div className="input-bar">
        <div className="input-bar-inner">
          <form className="input-form" onSubmit={handleSubmit}>
            <div className="input-wrapper">
              <span className={`input-prefix ${input.startsWith('!') ? 'terminal-mode' : ''}`}>
                {input.startsWith('!') ? '>' : '/'}
              </span>
              <input
                ref={inputRef}
                className={`chat-input ${input.startsWith('!') ? 'terminal-mode' : ''}`}
                placeholder={input.startsWith('!') ? "Команда терминала..." : "Введите сообщение или !команду..."}
                type="text"
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isStreaming}
              />
              <div className="input-actions">
                {input.startsWith('!') && (
                  <span className="cmd-badge">CMD</span>
                )}
                {isStreaming && (
                  <button
                    type="button"
                    onClick={() => {
                      if (abortControllerRef.current) {
                        abortControllerRef.current.abort();
                        setIsStreaming(false);
                        setStreamingContent('');
                        setStreamingThinkingSteps([]);
                      }
                    }}
                    className="stop-btn"
                  >
                    <span className="material-symbols-outlined">stop_circle</span>
                  </button>
                )}
                <button type="submit" className={`send-btn ${input.startsWith('!') ? 'terminal-mode' : ''}`} disabled={isStreaming}>
                  <span className="material-symbols-outlined">send</span>
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
