import type { ProviderConfig } from '../types.js';

export const DEFAULT_PROVIDER: ProviderConfig = {
  provider: 'ollama',
  model: process.env.OLLAMA_MODEL || 'llama3.1:8b',
  embeddingModel: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
  apiKey: process.env.GROQ_API_KEY,
};

export const DATA_DIR = '.vey';
export const BOOKS_DIR = `${DATA_DIR}/books`;
export const DEFAULT_BOOK_DIR = 'books';
export const MAX_CITATIONS = 5;
export const MIN_SIMILARITY_SCORE = 0.22;
export const SUPPORTED_TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.yaml',
  '.yml',
  '.csv',
  '.log',
]);
