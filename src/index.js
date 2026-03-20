#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { extractTextFromFile, supportedExtensions } from './textExtraction.js';

const workspaceRoot = process.cwd();
const dataDir = path.join(workspaceRoot, '.vey');
const statePath = path.join(dataDir, 'index.json');
const configPath = path.join(dataDir, 'config.json');
const workspaceRulesPath = path.join(workspaceRoot, 'WORKSPACE_RAG_RULES.md');
const slashCommands = [
  { command: '/scan .', description: 'Проиндексировать текущую папку' },
  { command: '/books', description: 'Показать файлы в индексе' },
  { command: '/cd ..', description: 'Подняться на папку выше' },
  { command: '/reset', description: 'Очистить индекс' },
  { command: '/model', description: 'Выбрать модель или Groq key' },
  { command: '/quit', description: 'Выйти из программы' },
];

const colors = {
  accent: '#c084fc',
  cyan: '#67e8f9',
  green: '#b8f06a',
  pink: '#f472b6',
  border: '#5f6368',
  white: '#f5f5f5',
  dim: '#a1a1aa',
  red: '#fca5a5',
  yellow: '#fde68a',
  box: '#2f2f2f',
  selected: '#33443a',
  shellBorder: '#4f78d1',
};

const slashCommandsV2 = [
  { command: '/scan', description: 'Scan current folder' },
  { command: '/open', description: 'Open folder path' },
  { command: '/book', description: 'Show files in current folder' },
  { command: '/books', description: 'Show indexed files' },
  { command: '/cls', description: 'Clear chat history' },
  { command: '/cd ..', description: 'Go to parent folder' },
  { command: '/reset', description: 'Clear index' },
  { command: '/model', description: 'Choose model or Groq key' },
  { command: '/quit', description: 'Exit program' },
];

const spinnerFrames = ['\\', '|', '/', '-'];
const blockCursor = '█';

const state = {
  currentDir: workspaceRoot,
  mode: 'qa/search',
  input: '',
  shellMode: false,
  showHelp: false,
  slashMenuVisible: false,
  slashMenuIndex: 0,
  modelMenuVisible: false,
  modelMenuIndex: 0,
  captureGroqKey: false,
  startedAt: Date.now(),
  messages: [],
  loading: false,
  spinnerIndex: 0,
  cursorVisible: true,
  messageScrollOffset: 0,
  activePane: 'main',
  shellSession: null,
  index: {
    books: [],
    chunks: [],
    indexedRoots: [],
  },
  config: {
    provider: 'ollama',
    model: process.env.OLLAMA_MODEL || 'llama3.1:8b',
    embeddingModel: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    groqApiKey: process.env.GROQ_API_KEY || '',
  },
  ollamaModels: [],
  chatHistory: [],
  lastError: '',
  workspaceRules: '',
};

let spinnerTimer = null;
let cursorTimer = null;
let lastFrame = '';

function color(hex, text) {
  const normalized = hex.replace('#', '');
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;
}

function bg(hex, text) {
  const normalized = hex.replace('#', '');
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `\x1b[48;2;${r};${g};${b}m${text}\x1b[0m`;
}

function bold(text) {
  return `\x1b[1m${text}\x1b[0m`;
}

function dim(text) {
  return `\x1b[2m${text}\x1b[0m`;
}

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

function fit(text, width) {
  const plain = stripAnsi(text);
  if (plain.length >= width) {
    return text.slice(0, width);
  }
  return text + ' '.repeat(width - plain.length);
}

function wrapText(text, width) {
  const lines = [];
  for (const originalLine of String(text).split('\n')) {
    const words = originalLine.split(' ');
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (stripAnsi(candidate).length > width && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    lines.push(current);
  }
  return lines;
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function renderScreen() {
  const width = Math.max(90, process.stdout.columns || 120);
  const height = Math.max(30, process.stdout.rows || 40);
  const lines = [];

  lines.push(renderHeader(width));
  lines.push('─'.repeat(width));

  if (state.showHelp) {
    lines.push(...renderHelp(width));
    lines.push('─'.repeat(width));
  }

  const bottomLines = renderBottomArea(width);
  const availableForMessages = Math.max(5, height - bottomLines.length - lines.length - 1);
  const messageLines = renderMessages(width, availableForMessages);
  lines.push(...messageLines);
  if (messageLines.length < availableForMessages) {
    lines.push(...Array.from({ length: availableForMessages - messageLines.length }, () => ''));
  }
  lines.push(...bottomLines);

  const frame = `\x1b[H\x1b[J${lines.join('\n')}`;
  if (frame !== lastFrame) {
    process.stdout.write(frame);
    lastFrame = frame;
  }
}

function renderHeader(width) {
  const now = new Date();
  const date = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(now);
  const time = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(now);
  const timer = formatDuration(Date.now() - state.startedAt);
  const left = `${color(colors.accent, '◆')} ${color(colors.white, 'vey.TUI')} ${dim(`${date} ${time}`)} ${dim(`session ${timer}`)}`;
  const right = color(colors.accent, '? for shortcuts');
  return `${fit(left, Math.max(0, width - stripAnsi(right).length - 1))} ${right}`;
}

function renderHelp(width) {
  const items = [
    ['?', 'shortcuts'],
    ['/', 'slash commands'],
    ['!', 'start shell session'],
    ['Tab', 'focus shell pane'],
    ['Shift+Tab', 'back to main input'],
    ['Esc', 'close menus'],
    ['↑ ↓', 'move in menu'],
    ['Enter', 'submit or select'],
  ];
  const columns = 2;
  const rows = Math.ceil(items.length / columns);
  const result = [`${bold('Shortcuts')} ${dim('See /help for more')}`];
  for (let row = 0; row < rows; row += 1) {
    const parts = [];
    for (let col = 0; col < columns; col += 1) {
      const item = items[row + col * rows];
      if (!item) {
        continue;
      }
      parts.push(fit(`${color(colors.accent, item[0])} ${item[1]}`, Math.floor(width / columns) - 1));
    }
    result.push(parts.join(' '));
  }
  return result;
}

function renderMessages(width, maxLines) {
  const contentWidth = width - 2;
  const allLines = state.messages.flatMap((entry) => formatMessage(entry, contentWidth));
  const end = Math.max(0, allLines.length - state.messageScrollOffset);
  const start = Math.max(0, end - maxLines);
  return allLines.slice(start, end);
}

function formatMessage(entry, width) {
  if (entry.kind === 'user') {
    const content = wrapText(entry.text, width - 4);
    return [
      bg(colors.box, ` ${fit(`${color(colors.accent, '>')} ${entry.label || 'You'}`, width - 2)} `),
      ...content.map((line) => bg(colors.box, ` ${fit(line, width - 2)} `)),
      bg(colors.box, ` ${' '.repeat(Math.max(0, width - 2))} `),
      '',
    ];
  }

  const typeColor = entry.kind === 'error'
    ? colors.red
    : entry.kind === 'shell'
      ? colors.cyan
      : colors.green;
  const header = `${color(typeColor, entry.kind.toUpperCase())} ${dim(entry.timestamp)} ${entry.message}`;
  const lines = wrapText(header, width);

  if (entry.kind === 'answer' && entry.answer) {
    lines.push(...wrapText(entry.answer, width));
    if (entry.citations?.length) {
      lines.push(color(colors.accent, 'Цитаты'));
      for (const citation of entry.citations) {
        lines.push(...wrapText(`${citation.bookTitle} ${citation.sourcePath}`, width));
        lines.push(...wrapText(citation.text, width));
      }
    }
  }

  if (entry.kind === 'books' && entry.items) {
    for (const item of entry.items) {
      lines.push(...wrapText(`${item.title}  chunks=${item.chunkCount}`, width));
      lines.push(...wrapText(item.path, width));
    }
  }

  if (entry.kind === 'shell' && entry.output) {
    lines.push(...renderShellBlock(entry.command, entry.output, width));
  }

  if (entry.kind === 'info' && entry.details) {
    lines.push(...wrapText(entry.details, width));
  }

  lines.push('');
  return lines;
}

function renderShellBlock(command, output, width) {
  const top = `┌${'─'.repeat(Math.max(10, width - 2))}`;
  const title = `${color(colors.shellBorder, '∞-')} ${bold('Shell Command')} ${command}`;
  const body = wrapText(output, width - 2).map((line) => line);
  const bottom = `└${'─'.repeat(Math.max(10, width - 2))}`;
  return [top, title, ...body, bottom];
}

function renderBottomArea(width) {
  const lines = [];
  const shellLines = renderLiveShellPane(width);
  if (shellLines.length) {
    lines.push(...shellLines);
    lines.push('─'.repeat(width));
  }

  const menuLines = renderMenus(width);
  if (menuLines.length) {
    lines.push(...menuLines);
  }

  if (state.shellMode) {
    lines.push(`${color(colors.cyan, 'shell mode enabled')} ${dim('(esc to disable)')}`);
  }
  if (state.loading) {
    lines.push(`${color(colors.cyan, spinnerFrames[state.spinnerIndex])} ${dim('model is thinking...')}`);
  } else if (state.lastError) {
    lines.push(color(colors.red, state.lastError));
  }

  lines.push(...renderInputBox(width));
  lines.push(...renderFooter(width));
  return lines;
}

function renderLiveShellPane(width) {
  if (!state.shellSession) {
    return [];
  }
  const title = `${color(colors.shellBorder, '∞-')} ${bold('Shell Command')} ${state.shellSession.command}`;
  const outputLines = state.shellSession.buffer.length
    ? state.shellSession.buffer.flatMap((line) => wrapText(line, width - 2))
    : [dim('No output yet')];
  const tailSize = Math.min(18, Math.max(6, outputLines.length + 1));
  const tail = outputLines.slice(-tailSize);
  const prompt = state.activePane === 'shell'
    ? `${state.shellSession.input}${state.cursorVisible ? blockCursor : ' '}`
    : state.shellSession.input;
  return [
    `┌${'─'.repeat(Math.max(10, width - 2))}`,
    title,
    ...tail,
    prompt || '>',
    `└${'─'.repeat(Math.max(10, width - 2))}`,
  ];
}

function renderMenus(width) {
  if (state.modelMenuVisible) {
    return renderMenu(modelMenuItems(), state.modelMenuIndex, width);
  }
  if (state.slashMenuVisible) {
    return renderMenu(filteredSlashCommands(), state.slashMenuIndex, width);
  }
  return [];
}

function renderMenu(items, selectedIndex, width) {
  const visible = items.slice(0, 8);
  return visible.map((item, index) => {
    const selected = index === selectedIndex;
    const command = item.command || item.label;
    const description = item.description || '';
    const base = `${fit(command, 24)} ${description}`;
    return selected
      ? bg(colors.selected, color(colors.green, fit(base, width)))
      : fit(`${color(colors.white, command)} ${dim(description)}`, width);
  });
}

function renderInputBox(width) {
  const prompt = state.captureGroqKey
    ? 'key'
    : state.shellMode
      ? color(colors.cyan, '!')
    : color(colors.accent, '>');
  const placeholder = state.captureGroqKey
    ? 'Введите Groq API key'
    : state.shellMode
      ? 'Type your shell command'
      : 'Type your message or @path/to/file';
  const text = state.input || dim(placeholder);
  const cursor = state.activePane === 'main' && state.cursorVisible ? blockCursor : ' ';
  const line = `${prompt} ${text}${state.input ? cursor : state.activePane === 'main' ? cursor : ''}`;
  return [bg(colors.box, ` ${fit(line, width - 2)} `)];
}

function renderFooter(width) {
  const location = abbreviatePath(state.currentDir, Math.floor(width * 0.55));
  const leftTop = `${color(colors.white, 'workspace')} ${location}`;
  const leftBottom = '~';
  const rightTop = color(colors.white, '/model');
  const rightBottom = state.config.provider === 'groq'
    ? color(colors.pink, state.config.model)
    : color(colors.cyan, state.config.model);
  const rightWidth = Math.max(18, Math.floor(width * 0.24));
  const leftWidth = width - rightWidth;
  return [
    `${fit(leftTop, leftWidth)}${fit(rightTop, rightWidth)}`,
    `${fit(leftBottom, leftWidth)}${fit(rightBottom, rightWidth)}`,
  ];
}

function abbreviatePath(input, maxLength) {
  if (input.length <= maxLength) {
    return input;
  }
  return `...${input.slice(-(maxLength - 3))}`;
}

function filteredSlashCommands() {
  const query = state.input.startsWith('/') ? state.input.slice(1).toLowerCase() : '';
  return slashCommandsV2.filter((item) => item.command.toLowerCase().includes(query));
}

function modelMenuItems() {
  const items = state.ollamaModels.map((model) => ({
    label: `${model.name}${model.name === state.config.model ? ' (active)' : ''}`,
    value: model.name,
    type: 'ollama',
  }));
  items.push({
    label: state.config.groqApiKey ? 'Обновить Groq key' : 'Добавить Groq key',
    value: 'groq-key',
    type: 'groq-key',
  });
  return items;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function saveJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

async function loadState() {
  await ensureDir(dataDir);
  try {
    state.index = JSON.parse(await fs.readFile(statePath, 'utf8'));
  } catch {
    await saveJson(statePath, state.index);
  }

  try {
    const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
    state.config = { ...state.config, ...config };
  } catch {
    await saveJson(configPath, state.config);
  }

  try {
    state.workspaceRules = await fs.readFile(workspaceRulesPath, 'utf8');
  } catch {
    state.workspaceRules = '';
  }
}

async function persistAll() {
  await saveJson(statePath, state.index);
  await saveJson(configPath, state.config);
}

async function refreshOllamaModels() {
  try {
    const response = await fetch(`${state.config.baseUrl}/api/tags`);
    const json = await response.json();
    state.ollamaModels = json.models || [];
  } catch {
    state.ollamaModels = [];
  }
}

function normalizeActiveModel() {
  if (state.config.provider !== 'ollama' || !state.ollamaModels.length) {
    return;
  }
  const names = state.ollamaModels.map((item) => item.name);
  const preferred = ['llama3.1:8b', 'qwen3:8b', 'qwen3.5:9b'];
  const chosen = preferred.find((name) => names.includes(name)) || names[0];
  state.config.model = chosen;
}

async function ollamaFetch(url, payload) {
  const response = await fetch(`${state.config.baseUrl}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function createEmbedding(text) {
  const json = await ollamaFetch('/api/embed', {
    model: state.config.embeddingModel,
    input: text,
  });
  return json.embeddings?.[0] || json.embedding || [];
}

async function generateAnswer(messages) {
  if (state.config.provider === 'groq') {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.config.groqApiKey}`,
      },
      body: JSON.stringify({
        model: state.config.model,
        temperature: 0.2,
        top_p: 0.9,
        messages,
      }),
    });
    if (!response.ok) {
      throw new Error(`Groq error: ${response.status} ${response.statusText}`);
    }
    const json = await response.json();
    return json.choices?.[0]?.message?.content?.trim() || '';
  }

  const json = await ollamaFetch('/api/chat', {
    model: state.config.model,
    stream: false,
    options: {
      temperature: 0.2,
      top_p: 0.9,
      repeat_penalty: 1.2,
      num_ctx: 8192,
      num_predict: 128,
    },
    messages,
  });
  return json.message?.content?.trim() || '';
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function lexicalScore(query, text) {
  const tokens = Array.from(new Set(tokenize(query)));
  if (!tokens.length) {
    return 0;
  }
  const lower = text.toLowerCase();
  let hits = 0;
  for (const token of tokens) {
    if (lower.includes(token)) {
      hits += 1;
    }
  }
  return hits / tokens.length;
}

function cosineSimilarity(a, b) {
  if (!a.length || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function pushMessage(kind, message, extra = {}) {
  state.messages.push({
    kind,
    message,
    timestamp: new Date().toLocaleTimeString('ru-RU'),
    ...extra,
  });
  state.messageScrollOffset = 0;
}

function pushUserMessage(text) {
  state.messages.push({
    kind: 'user',
    text,
    label: 'You',
    timestamp: new Date().toLocaleTimeString('ru-RU'),
  });
  state.messageScrollOffset = 0;
}

async function walkTextFiles(rootDir, maxFiles = 60, results = []) {
  if (results.length >= maxFiles) {
    return results;
  }
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (results.length >= maxFiles) {
      break;
    }
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.vey') {
      continue;
    }
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      await walkTextFiles(fullPath, maxFiles, results);
      continue;
    }
    if (supportedExtensions.has(path.extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }
  return results;
}

function chunkText(text, chunkSize = 1200, overlap = 180) {
  const normalized = text.replace(/\0/g, '').replace(/\r/g, '').trim();
  if (!normalized) {
    return [];
  }
  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(normalized.length, start + chunkSize);
    chunks.push(normalized.slice(start, end));
    if (end === normalized.length) {
      break;
    }
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

function isWithinRoot(filePath, rootPath) {
  const normalizedFile = path.resolve(filePath);
  const normalizedRoot = path.resolve(rootPath);
  return normalizedFile === normalizedRoot || normalizedFile.startsWith(`${normalizedRoot}${path.sep}`);
}

function getCurrentRootBooks() {
  return state.index.books.filter((book) => isWithinRoot(book.path, state.currentDir));
}

function getCurrentRootChunks() {
  return state.index.chunks.filter((chunk) => isWithinRoot(chunk.sourcePath, state.currentDir));
}

function normalizeForMatch(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function titleReferenceScore(question, title) {
  const questionTokens = Array.from(new Set(normalizeForMatch(question).split(/\s+/).filter(Boolean)));
  const titleTokens = Array.from(new Set(normalizeForMatch(title).split(/\s+/).filter(Boolean)));
  if (!questionTokens.length || !titleTokens.length) {
    return 0;
  }
  let hits = 0;
  for (const token of titleTokens) {
    if (questionTokens.includes(token)) {
      hits += 1;
    }
  }
  return hits / titleTokens.length;
}

function getExplicitBookMatches(question) {
  const ranked = getCurrentRootBooks()
    .map((book) => ({ ...book, titleScore: titleReferenceScore(question, book.title) }))
    .filter((book) => book.titleScore >= 0.34)
    .sort((a, b) => b.titleScore - a.titleScore);
  const topScore = ranked[0]?.titleScore || 0;
  return ranked.filter((book) => book.titleScore >= Math.max(0.34, topScore - 0.05));
}

function shouldUseWorkspaceMaterials(question) {
  return shouldUseStrictMaterialSearch(question) || getExplicitBookMatches(question).length > 0;
}

function isSmallTalkQuestion(question) {
  return /^(hi|hello|hey|привет|здравствуй|добрый день|как дела|что ты умеешь)/i.test(question.trim());
}

async function indexFile(filePath) {
  const absolutePath = path.resolve(state.currentDir, filePath);
  const text = await extractTextFromFile(absolutePath);
  const chunks = chunkText(text);
  if (!chunks.length) {
    return null;
  }

  state.index.books = state.index.books.filter((book) => book.path !== absolutePath);
  state.index.chunks = state.index.chunks.filter((chunk) => chunk.sourcePath !== absolutePath);

  for (let index = 0; index < chunks.length; index += 1) {
    const embedding = await createEmbedding(chunks[index]);
    state.index.chunks.push({
      id: `${absolutePath}:${index}`,
      bookTitle: path.basename(absolutePath),
      sourcePath: absolutePath,
      chunkIndex: index,
      text: chunks[index],
      embedding,
    });
  }

  const record = {
    id: `book-${Buffer.from(absolutePath).toString('base64url')}`,
    title: path.basename(absolutePath),
    path: absolutePath,
    addedAt: new Date().toISOString(),
    chunkCount: chunks.length,
  };
  state.index.books.push(record);
  return record;
}

async function scanFolder(folder, options = {}) {
  const silent = Boolean(options.silent);
  const root = path.resolve(state.currentDir, folder || '.');
  state.index.books = state.index.books.filter((book) => !isWithinRoot(book.path, root));
  state.index.chunks = state.index.chunks.filter((chunk) => !isWithinRoot(chunk.sourcePath, root));
  const files = await walkTextFiles(root);
  const items = [];
  for (const file of files) {
    const result = await indexFile(file);
    if (result) {
      items.push(result);
    }
  }
  state.index.indexedRoots = Array.from(new Set([...state.index.indexedRoots, root]));
  await persistAll();
  if (!silent && items.length) {
    pushMessage('books', `Сканирование завершено: ${items.length} файлов.`, { items: items.slice(0, 5) });
  }
}

async function autoIndexCurrentDir() {
  const root = path.resolve(state.currentDir);
  await withLoading(async () => {
    await scanFolder(root, { silent: true });
  });
}

async function similaritySearch(query, limit = 4) {
  const activeChunks = getCurrentRootChunks();
  if (!activeChunks.length) {
    return [];
  }
  const queryEmbedding = await createEmbedding(query);
  const ranked = activeChunks
    .map((chunk) => {
      const lexical = lexicalScore(query, `${chunk.bookTitle}\n${chunk.text}`);
      return {
        id: chunk.id,
        bookTitle: chunk.bookTitle,
        sourcePath: chunk.sourcePath,
        text: chunk.text,
        score: cosineSimilarity(chunk.embedding, queryEmbedding) * 0.72 + lexical * 0.28,
        lexical,
      };
    })
    .sort((a, b) => b.score - a.score);

  const strongLexical = ranked.filter((item) => item.lexical >= 0.2);
  if (strongLexical.length) {
    return strongLexical
      .sort((a, b) => (b.lexical - a.lexical) || (b.score - a.score))
      .slice(0, limit);
  }

  const top = ranked[0]?.score || 0;
  if (top < 0.18) {
    return [];
  }
  const filtered = ranked.filter((item) => item.score >= Math.max(0.18, top * 0.75));
  const lexicalMatches = filtered.filter((item) => item.lexical > 0);
  return (lexicalMatches.length ? lexicalMatches : filtered).slice(0, limit);
}

function detectIntent(question) {
  const lower = question.toLowerCase();
  if (lower.includes('кратко') || lower.includes('выжимк')) {
    return 'brief';
  }
  if (lower.includes('подробно') || lower.includes('детально')) {
    return 'detailed';
  }
  return 'normal';
}

function detectLanguage(question) {
  return /[а-яё]/i.test(question) ? 'ru' : 'en';
}

function shouldUseMaterialSearch(question) {
  return /(найди|найти|поиск|где говорится|в материалах|в файлах|в документах|по тексту|по книге|search|find)/i.test(question.toLowerCase());
}

function shouldUseStrictMaterialSearch(question) {
  const lower = question.toLowerCase();
  return /(найди|найти|поищи|отыщи|поиск|где говорится|что сказано|в материалах|в файлах|в документах|по тексту|по книге|по книгам|в книге|в книгах|search|find|look up)/i.test(lower);
}

function buildGeneralAnswerPrompt(language, style) {
  const briefHint = style === 'brief'
    ? 'Дай короткий ответ без воды.'
    : style === 'detailed'
      ? 'Ответь подробнее, но по делу.'
      : 'Ответь естественно и без повторов.';
  if (language === 'ru') {
    return `Ты обычный полезный AI-помощник. Отвечай на языке пользователя. Не ссылайся на материалы и цитаты, если пользователь прямо не просил искать по файлам. Если ты не уверен, скажи об этом честно. ${briefHint}`;
  }
  return `You are a helpful assistant. Answer in the user's language. Do not mention files or citations unless the user explicitly asked to search materials. If uncertain, say so clearly. ${briefHint}`;
}

function buildRagAnswerPrompt(language, style) {
  const styleHint = style === 'brief'
    ? 'Дай очень короткий ответ.'
    : style === 'detailed'
      ? 'Можно ответить подробнее, но без воды.'
      : 'Дай ясный ответ без повторов.';
  if (language === 'ru') {
    return `Ты AI-помощник. Отвечай только по релевантным найденным фрагментам. Если данных мало, прямо скажи это. Отвечай на языке пользователя. ${styleHint}`;
  }
  return `You are an AI assistant. Answer only from relevant retrieved snippets. If the snippets are insufficient, say so clearly. Answer in the user's language. ${styleHint}`;
}

async function answerQuestion(question) {
  const language = detectLanguage(question);
  const style = detectIntent(question);
  const answerSystem = buildGeneralAnswerPrompt(language, style);
  const baseSystem = language === 'ru'
    ? 'Отвечай естественно, без повторов, по делу. Если пользователь пишет по-русски, отвечай по-русски. Если просит кратко, отвечай кратко. Если просит выжимку, дай выжимку списком или коротким абзацем.'
    : 'Answer naturally, without repetition, in the user language. Be concise when the user asks for a summary.';
  const useMaterials = shouldUseStrictMaterialSearch(question);
  const citations = useMaterials ? await similaritySearch(question) : [];

  const weakRetrieval =
    useMaterials &&
    (
      !citations.length ||
      ((citations[0]?.score || 0) < 0.35 && (citations[0]?.lexical || 0) === 0)
    );

  if (!useMaterials || weakRetrieval) {
    const answer = await generateAnswer([
      { role: 'system', content: `${baseSystem} Не зацикливайся на прежних ответах.` },
      ...state.chatHistory.slice(-6),
      { role: 'user', content: question },
    ]);
    const message = useMaterials
      ? `Найдено 0 информации в: ${state.index.indexedRoots.length ? state.index.indexedRoots.join(', ') : state.currentDir}`
      : 'Ответ модели.';
    pushMessage('answer', 'Ответ модели.', {
      answer: useMaterials ? `${message}\n\nМой общий ответ:\n${answer}` : answer,
      citations: [],
    });
    state.chatHistory.push({ role: 'user', content: question });
    state.chatHistory.push({ role: 'assistant', content: answer });
    state.chatHistory = state.chatHistory.slice(-8);
    return;
  }

  const styleHint = style === 'brief'
    ? 'Сделай очень короткий ответ.'
    : style === 'detailed'
      ? 'Можно ответить подробнее, но без воды.'
      : 'Сделай ясный ответ без лишних повторов.';
  const context = citations
    .map((item, index) => `[${index + 1}] ${item.bookTitle}\n${item.text}`)
    .join('\n\n');
  const answer = await generateAnswer([
    {
      role: 'system',
      content: `${baseSystem} Отвечай только на основе предоставленных фрагментов, если они релевантны вопросу. Если информации недостаточно, честно скажи это. ${styleHint}`,
    },
    ...state.chatHistory.slice(-4),
    {
      role: 'user',
      content: `Вопрос: ${question}\n\nФрагменты:\n${context}`,
    },
  ]);
  pushMessage('answer', 'Ответ модели с учетом файлов.', {
    answer,
    citations: citations.slice(0, 2),
  });
  state.chatHistory.push({ role: 'user', content: question });
  state.chatHistory.push({ role: 'assistant', content: answer });
  state.chatHistory = state.chatHistory.slice(-8);
}

async function answerQuestionV2(question) {
  const language = detectLanguage(question);
  const style = detectIntent(question);
  const useMaterials = shouldUseStrictMaterialSearch(question);
  const citations = useMaterials ? await similaritySearch(question) : [];
  const weakRetrieval =
    useMaterials &&
    (
      !citations.length ||
      ((citations[0]?.score || 0) < 0.35 && (citations[0]?.lexical || 0) === 0)
    );

  if (!useMaterials || weakRetrieval) {
    const answer = await generateAnswer([
      { role: 'system', content: buildGeneralAnswerPrompt(language, style) },
      ...state.chatHistory.slice(-6),
      { role: 'user', content: question },
    ]);
    const notFound = useMaterials
      ? `Найдено 0 информации в: ${state.index.indexedRoots.length ? state.index.indexedRoots.join(', ') : state.currentDir}`
      : '';
    pushMessage('answer', useMaterials ? 'Совпадений в материалах не найдено.' : 'Ответ модели.', {
      answer: useMaterials ? `${notFound}\n\n${answer}` : answer,
      citations: [],
    });
    state.chatHistory.push({ role: 'user', content: question });
    state.chatHistory.push({ role: 'assistant', content: answer });
    state.chatHistory = state.chatHistory.slice(-8);
    return;
  }

  const context = citations
    .map((item, index) => `[${index + 1}] ${item.bookTitle}\n${item.text}`)
    .join('\n\n');
  const answer = await generateAnswer([
    { role: 'system', content: buildRagAnswerPrompt(language, style) },
    ...state.chatHistory.slice(-4),
    { role: 'user', content: `Вопрос: ${question}\n\nФрагменты:\n${context}` },
  ]);
  pushMessage('answer', 'Ответ по найденным материалам.', {
    answer,
    citations: citations.slice(0, 3),
  });
  state.chatHistory.push({ role: 'user', content: question });
  state.chatHistory.push({ role: 'assistant', content: answer });
  state.chatHistory = state.chatHistory.slice(-8);
}

async function answerQuestionV3(question) {
  const language = detectLanguage(question);
  const style = detectIntent(question);
  const explicitBooks = getExplicitBookMatches(question);
  const workspaceChunks = getCurrentRootChunks();
  const inspectWholeWorkspace = workspaceChunks.length > 0 && workspaceChunks.length <= 12;
  const useMaterials = (workspaceChunks.length > 0 && !isSmallTalkQuestion(question)) || shouldUseWorkspaceMaterials(question);

  let citations = [];
  if (explicitBooks.length) {
    const bookPaths = new Set(explicitBooks.map((book) => book.path));
    citations = workspaceChunks
      .filter((chunk) => bookPaths.has(chunk.sourcePath))
      .slice(0, 8)
      .map((chunk) => ({
        bookTitle: chunk.bookTitle,
        sourcePath: chunk.sourcePath,
        text: chunk.text,
        score: 1,
        lexical: 1,
      }));
  } else if (inspectWholeWorkspace && useMaterials) {
    citations = workspaceChunks.slice(0, 12).map((chunk) => ({
      bookTitle: chunk.bookTitle,
      sourcePath: chunk.sourcePath,
      text: chunk.text,
      score: 0.5,
      lexical: lexicalScore(question, `${chunk.bookTitle}\n${chunk.text}`),
    }));
  } else if (useMaterials) {
    citations = await similaritySearch(question, 6);
  }

  const workspaceFiles = getCurrentRootBooks().map((book) => book.title).join(', ') || 'no indexed files';
  const localRules = state.workspaceRules || '';
  const weakRetrieval = useMaterials && !citations.length;

  if (!useMaterials || weakRetrieval) {
    const answer = await generateAnswer([
      {
        role: 'system',
        content: `${buildGeneralAnswerPrompt(language, style)}\n${localRules}\nIndexed workspace files: ${workspaceFiles}\nIf the question is about local files or file contents, rely on scanned workspace content and never claim that you have no access to local files. First try word-level matches, then meaning-level matches.`,
      },
      ...state.chatHistory.slice(-6),
      { role: 'user', content: question },
    ]);
    const notFound = useMaterials
      ? `Найдено 0 информации в: ${state.currentDir}`
      : '';
    pushMessage('answer', useMaterials ? 'Совпадений в материалах не найдено.' : 'Ответ модели.', {
      answer: useMaterials ? `${notFound}\n\n${answer}` : answer,
      citations: [],
    });
    state.chatHistory.push({ role: 'user', content: question });
    state.chatHistory.push({ role: 'assistant', content: answer });
    state.chatHistory = state.chatHistory.slice(-8);
    return;
  }

  const context = citations
    .map((item, index) => `[${index + 1}] ${item.bookTitle}\n${item.text}`)
    .join('\n\n');
  const answer = await generateAnswer([
      {
        role: 'system',
        content: `${buildRagAnswerPrompt(language, style)}\n${localRules}\nIndexed workspace files: ${workspaceFiles}\nYou must use the scanned file fragments below as the primary source of truth for file-related questions. First search by explicit word overlap and filename overlap, then use semantic matching only if needed. Do not say you lack access to local files when citations are available.`,
      },
    ...state.chatHistory.slice(-4),
    { role: 'user', content: `Вопрос: ${question}\n\nФрагменты:\n${context}` },
  ]);
  pushMessage('answer', 'Ответ по найденным материалам.', {
    answer,
    citations: citations.slice(0, 5),
  });
  state.chatHistory.push({ role: 'user', content: question });
  state.chatHistory.push({ role: 'assistant', content: answer });
  state.chatHistory = state.chatHistory.slice(-8);
}

function extractFolderTarget(input) {
  const trimmed = input.trim();
  const openMatch = trimmed.match(/^(?:\/open\s+)(.+)$/i);
  if (openMatch) {
    return openMatch[1].trim();
  }
  const naturalMatch = trimmed.match(/^(?:\u043e\u0442\u043a\u0440\u043e\u0439 \u043f\u0430\u043f\u043a\u0443:|open folder:)\s*(.+)$/i);
  if (naturalMatch) {
    return naturalMatch[1].trim();
  }
  return '';
}

async function changeDirectory(target) {
  const cleaned = target.trim().replace(/^["']|["']$/g, '');
  const candidate = path.isAbsolute(cleaned)
    ? path.normalize(cleaned)
    : path.resolve(state.currentDir, cleaned);
  const stats = await fs.stat(candidate);
  if (!stats.isDirectory()) {
    throw new Error(`Это не папка: ${candidate}`);
  }
  state.currentDir = candidate;
  pushMessage('info', `Открыта папка: ${candidate}`);
  await autoIndexCurrentDir();
}

async function maybeHandleFolderOpen(input) {
  const match = input.match(/^(открой папку:|open folder:)\s*(.+)$/i);
  if (!match) {
    return false;
  }
  await changeDirectory(match[2].trim());
  return true;
}

async function maybeHandleFolderOpenV2(input) {
  const trimmed = input.trim();
  const match = trimmed.match(/^(открой папку:|open folder:)\s*(.+)$/i);
  if (!match) {
    return false;
  }
  await changeDirectory(match[2].trim());
  return true;
}

function archiveShellSession(session) {
  if (!session || session.archived) {
    return;
  }
  session.archived = true;
  const output = session.buffer.length ? session.buffer.join('\n') : 'No output yet';
  pushMessage('shell', `Shell session: ${session.command}`, {
    command: session.command,
    output,
  });
}

function startShellSession(command) {
  closeShellSession();
  const child = spawn(command, {
    cwd: state.currentDir,
    shell: true,
    stdio: 'pipe',
  });

  const session = {
    command,
    child,
    buffer: [],
    input: '',
    alive: true,
    archived: false,
  };

  child.stdout.on('data', (data) => {
    const text = String(data).replace(/\r/g, '');
    session.buffer.push(...text.split('\n').filter(Boolean));
    renderScreen();
  });

  child.stderr.on('data', (data) => {
    const text = String(data).replace(/\r/g, '');
    session.buffer.push(...text.split('\n').filter(Boolean));
    renderScreen();
  });

  child.on('exit', (code) => {
    session.alive = false;
    session.buffer.push(`Process exited with code ${code ?? 0}`);
    archiveShellSession(session);
    if (state.shellSession === session) {
      state.shellSession = null;
    }
    state.activePane = 'main';
    renderScreen();
  });

  state.shellSession = session;
  state.activePane = 'shell';
}

function closeShellSession() {
  const session = state.shellSession;
  if (!session) {
    return;
  }
  if (session.alive) {
    archiveShellSession(session);
    session.child.kill();
  }
  state.shellSession = null;
}

async function executeShellCommand(input) {
  const trimmed = input.trim();
  const cdMatch = trimmed.match(/^cd\s+(.+)$/i);
  if (cdMatch) {
    await changeDirectory(cdMatch[1].trim());
    return;
  }
  startShellSession(input);
}

function startSpinner() {
  stopSpinner();
  spinnerTimer = setInterval(() => {
    state.spinnerIndex = (state.spinnerIndex + 1) % spinnerFrames.length;
    renderScreen();
  }, 120);
}

function stopSpinner() {
  if (spinnerTimer) {
    clearInterval(spinnerTimer);
    spinnerTimer = null;
  }
}

function startCursorBlink() {
  if (cursorTimer) {
    clearInterval(cursorTimer);
  }
  cursorTimer = setInterval(() => {
    state.cursorVisible = !state.cursorVisible;
    renderScreen();
  }, 500);
}

async function withLoading(action) {
  state.loading = true;
  startSpinner();
  renderScreen();
  try {
    await action();
  } finally {
    state.loading = false;
    stopSpinner();
    renderScreen();
  }
}

async function applyCommand(command) {
  if (command === '/quit') {
    shutdown(0);
    return;
  }
  if (command === '/books' || command === '/book') {
    pushMessage('books', `В индексе ${state.index.books.length} файлов.`, {
      items: state.index.books.slice(-8),
    });
    return;
  }
  if (command === '/reset') {
    state.index = { books: [], chunks: [], indexedRoots: [] };
    await persistAll();
    pushMessage('info', 'Индекс очищен.');
    return;
  }
  if (command.startsWith('/scan')) {
    const folder = command.replace('/scan', '').trim() || '.';
    await withLoading(async () => {
      await scanFolder(folder);
    });
    return;
  }
  if (command.startsWith('/cd ')) {
    await changeDirectory(command.replace('/cd ', '').trim());
    return;
  }
  if (command.startsWith('/open ')) {
    await changeDirectory(command.replace('/open ', '').trim());
    return;
  }
  if (command === '/open') {
    pushMessage('info', 'Use /open <folder-path>');
    return;
  }
  if (command === '/model') {
    await refreshOllamaModels();
    state.modelMenuVisible = true;
    state.modelMenuIndex = 0;
    return;
  }
  pushMessage('error', `Неизвестная команда: ${command}`);
}

async function applyCommandV2(command) {
  if (command === '/quit') {
    shutdown(0);
    return;
  }
  if (command === '/books' || command === '/book') {
    const currentBooks = getCurrentRootBooks();
    pushMessage('books', `Files in current folder: ${currentBooks.length}`, {
      items: currentBooks.slice(-50),
    });
    return;
  }
  if (command === '/cls') {
    state.messages = [];
    state.chatHistory = [];
    state.messageScrollOffset = 0;
    state.lastError = '';
    return;
  }
  if (command === '/reset') {
    state.index = { books: [], chunks: [], indexedRoots: [] };
    await persistAll();
    pushMessage('info', 'Index cleared.');
    await autoIndexCurrentDir();
    return;
  }
  if (command === '/scan' || command.startsWith('/scan ')) {
    const folder = command.replace('/scan', '').trim() || '.';
    await withLoading(async () => {
      await scanFolder(folder, { silent: false });
    });
    return;
  }
  if (command.startsWith('/cd ')) {
    await changeDirectory(command.replace('/cd ', '').trim());
    return;
  }
  if (command.startsWith('/open ')) {
    await changeDirectory(command.replace('/open ', '').trim());
    return;
  }
  if (command === '/open') {
    pushMessage('info', 'Use /open <folder-path>');
    return;
  }
  if (command === '/model') {
    await refreshOllamaModels();
    state.modelMenuVisible = true;
    state.modelMenuIndex = 0;
    return;
  }
  pushMessage('error', `Unknown command: ${command}`);
}

async function submitMainInput() {
  const value = state.input.trim();
  if (!value) {
    return;
  }
  state.lastError = '';

  if (state.captureGroqKey) {
    state.config.groqApiKey = value;
    state.config.provider = 'groq';
    state.captureGroqKey = false;
    state.input = '';
    await persistAll();
    pushMessage('info', 'Groq key сохранен.');
    return;
  }

  if (state.modelMenuVisible) {
    await activateMenuSelection();
    return;
  }

  if (state.slashMenuVisible && !/\s/.test(value)) {
    await activateMenuSelection();
    return;
  }

  const current = value;
  state.input = '';
  pushUserMessage(current);

  if (state.shellMode) {
    state.shellMode = false;
    await executeShellCommand(current);
    return;
  }

  if (current.startsWith('!')) {
    await executeShellCommand(current.slice(1).trim());
    return;
  }

  if (current.startsWith('/')) {
    await applyCommandV2(current);
    return;
  }

  const folderTarget = extractFolderTarget(current);
  if (folderTarget) {
    await changeDirectory(folderTarget);
    return;
  }

  await withLoading(async () => {
    await answerQuestionV3(current);
  });
}

async function activateMenuSelection() {
  if (state.modelMenuVisible) {
    const items = modelMenuItems();
    const selected = items[state.modelMenuIndex];
    if (!selected) {
      return;
    }
    if (selected.type === 'groq-key') {
      state.captureGroqKey = true;
      state.modelMenuVisible = false;
      state.input = '';
      return;
    }
    state.config.provider = 'ollama';
    state.config.model = selected.value;
    state.modelMenuVisible = false;
    state.input = '';
    await persistAll();
    pushMessage('info', `Модель переключена: ${selected.value}`);
    return;
  }

  if (state.slashMenuVisible) {
    const items = filteredSlashCommands();
    const selected = items[state.slashMenuIndex];
    if (!selected) {
      return;
    }
    state.input = selected.command;
    state.slashMenuVisible = false;
    if (selected.command === '/model') {
      await refreshOllamaModels();
      state.modelMenuVisible = true;
      state.modelMenuIndex = 0;
    } else if (selected.command === '/open') {
      state.input = '/open ';
      updateMenus();
    } else {
      await submitMainInput();
    }
  }
}

function updateMenus() {
  state.slashMenuVisible = state.input.startsWith('/') && !state.modelMenuVisible && !/\s/.test(state.input.trim());
  if (state.input === '/model') {
    state.slashMenuVisible = false;
    state.modelMenuVisible = true;
  }
}

function moveMenuSelection(delta) {
  if (state.modelMenuVisible) {
    const items = modelMenuItems();
    if (items.length) {
      state.modelMenuIndex = (state.modelMenuIndex + delta + items.length) % items.length;
    }
    return;
  }
  if (state.slashMenuVisible) {
    const items = filteredSlashCommands();
    if (items.length) {
      state.slashMenuIndex = (state.slashMenuIndex + delta + items.length) % items.length;
    }
  }
}

function scrollMessages(delta) {
  const width = Math.max(90, process.stdout.columns || 120);
  const totalLines = state.messages.flatMap((entry) => formatMessage(entry, width - 2)).length;
  const visibleLines = Math.max(5, Math.max(30, process.stdout.rows || 40) - 12);
  const maxOffset = Math.max(0, totalLines - visibleLines);
  state.messageScrollOffset = Math.max(0, Math.min(maxOffset, state.messageScrollOffset + delta));
}

function sendToShellInput(text) {
  const session = state.shellSession;
  if (!session?.alive) {
    return;
  }
  session.input += text;
}

function submitShellInput() {
  const session = state.shellSession;
  if (!session?.alive) {
    return;
  }
  session.child.stdin.write(`${session.input}\n`);
  session.input = '';
}

function shutdown(code = 0) {
  stopSpinner();
  if (cursorTimer) {
    clearInterval(cursorTimer);
  }
  closeShellSession();
  process.stdout.write('\x1b[?1049l\x1b[?25h');
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.exit(code);
}

async function handleKeypress(str, key) {
  if (key.ctrl && key.name === 'c') {
    shutdown(0);
    return;
  }

  if (key.shift && key.name === 'tab') {
    state.activePane = 'main';
    renderScreen();
    return;
  }

  if (key.name === 'tab') {
    if (state.shellSession?.alive) {
      state.activePane = state.activePane === 'main' ? 'shell' : 'main';
    }
    renderScreen();
    return;
  }

  if (key.name === 'escape') {
    state.showHelp = false;
    state.slashMenuVisible = false;
    state.modelMenuVisible = false;
    state.shellMode = false;
    if (state.shellSession) {
      closeShellSession();
      state.activePane = 'main';
    }
    if (state.captureGroqKey) {
      state.captureGroqKey = false;
      state.input = '';
    }
    renderScreen();
    return;
  }

  if (state.activePane === 'shell' && state.shellSession?.alive) {
    if (key.name === 'return') {
      submitShellInput();
      renderScreen();
      return;
    }
    if (key.name === 'backspace') {
      state.shellSession.input = state.shellSession.input.slice(0, -1);
      renderScreen();
      return;
    }
    if (typeof str === 'string' && str.length === 1 && !key.ctrl && !key.meta) {
      sendToShellInput(str);
      renderScreen();
      return;
    }
  }

  if (key.name === 'up') {
    if (state.modelMenuVisible || state.slashMenuVisible) {
      moveMenuSelection(-1);
    } else {
      scrollMessages(3);
    }
    renderScreen();
    return;
  }
  if (key.name === 'down') {
    if (state.modelMenuVisible || state.slashMenuVisible) {
      moveMenuSelection(1);
    } else {
      scrollMessages(-3);
    }
    renderScreen();
    return;
  }
  if (key.name === 'pageup') {
    scrollMessages(12);
    renderScreen();
    return;
  }
  if (key.name === 'pagedown') {
    scrollMessages(-12);
    renderScreen();
    return;
  }
  if (key.name === 'return') {
    await submitMainInput();
    renderScreen();
    return;
  }
  if (key.name === 'backspace') {
    state.input = state.input.slice(0, -1);
    updateMenus();
    renderScreen();
    return;
  }
  if (str === '?' && !state.input) {
    state.showHelp = !state.showHelp;
    renderScreen();
    return;
  }
  if (str === '!' && !state.input) {
    state.shellMode = !state.shellMode;
    renderScreen();
    return;
  }
  if (typeof str === 'string' && str.length === 1 && !key.ctrl && !key.meta) {
    state.input += str;
    updateMenus();
    if (state.input === '/model') {
      await refreshOllamaModels();
      state.modelMenuVisible = true;
      state.modelMenuIndex = 0;
    }
    renderScreen();
  }
}

async function runBatchMode() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const lines = chunks.join('').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    state.input = line;
    if (line === '/quit') {
      break;
    }
    await submitMainInput();
  }
  renderScreen();
}

async function runInteractiveMode() {
  readline.emitKeypressEvents(process.stdin);
  process.stdout.write('\x1b[?1049h\x1b[?25l');
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.on('keypress', (str, key) => {
    void handleKeypress(str, key);
  });
  startCursorBlink();
  renderScreen();
}

process.on('SIGINT', () => shutdown(0));
process.on('uncaughtException', (error) => {
  state.lastError = error.message;
  pushMessage('error', error.message);
  renderScreen();
});

await loadState();
await refreshOllamaModels();
normalizeActiveModel();

if (process.stdin.isTTY) {
  await autoIndexCurrentDir();
  await runInteractiveMode();
} else {
  await runBatchMode();
}
