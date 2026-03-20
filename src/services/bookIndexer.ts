import { copyFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { BOOKS_DIR, DEFAULT_BOOK_DIR, SUPPORTED_TEXT_EXTENSIONS } from '../config/defaults.js';
import type { BookRecord, IndexedChunk, ProviderConfig } from '../types.js';
import { ensureDir, fileExists, safeReadJson, writeJson } from '../utils/fs.js';
import { createEmbedding } from './providerFactory.js';

interface BookIndexState {
  books: BookRecord[];
  chunks: IndexedChunk[];
  indexedRoots: string[];
}

const STATE_FILE = '.vey/index.json';

function normalizeText(text: string): string {
  return text.replace(/\0/g, '').replace(/\r/g, '').trim();
}

function chunkText(text: string, chunkSize = 1200, overlap = 220): string[] {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
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

async function walkTextFiles(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.vey') {
      continue;
    }

    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walkTextFiles(absolutePath)));
      continue;
    }

    if (SUPPORTED_TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      results.push(absolutePath);
    }
  }

  return results;
}

export class BookIndexer {
  private readonly statePath: string;
  private state: BookIndexState = {
    books: [],
    chunks: [],
    indexedRoots: [],
  };

  constructor(
    private readonly cwd: string,
    private readonly provider: ProviderConfig,
  ) {
    this.statePath = path.join(cwd, STATE_FILE);
  }

  async init(): Promise<void> {
    await ensureDir(path.join(this.cwd, BOOKS_DIR));
    this.state = await safeReadJson<BookIndexState>(this.statePath, {
      books: [],
      chunks: [],
      indexedRoots: [],
    });
  }

  async listBooks(): Promise<BookRecord[]> {
    return this.state.books;
  }

  async bootstrapDefaultBooks(): Promise<BookRecord[]> {
    const builtInDir = path.join(this.cwd, DEFAULT_BOOK_DIR);
    if (!(await fileExists(path.join(builtInDir, 'sample-alice.txt')))) {
      return this.state.books;
    }

    if (this.state.books.length > 0) {
      return this.state.books;
    }

    await this.scanFolder(builtInDir);
    return this.state.books;
  }

  async addBook(inputPath: string, copyToLibrary = false): Promise<BookRecord> {
    if (!(await fileExists(inputPath))) {
      throw new Error(`Файл не найден: ${inputPath}`);
    }

    const absolutePath = path.resolve(this.cwd, inputPath);
    const title = path.basename(absolutePath);
    const libraryPath = path.join(this.cwd, BOOKS_DIR, title);
    const sourcePath = copyToLibrary ? libraryPath : absolutePath;

    if (copyToLibrary && absolutePath !== libraryPath) {
      await copyFile(absolutePath, libraryPath);
    }

    const text = await readFile(absolutePath, 'utf8');
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      throw new Error(`Файл пустой или не содержит читаемого текста: ${absolutePath}`);
    }

    this.state.chunks = this.state.chunks.filter((chunk) => chunk.sourcePath !== sourcePath);
    const embeddedChunks: IndexedChunk[] = [];
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const embedding = await createEmbedding(this.provider, chunk);
      embeddedChunks.push({
        id: `${sourcePath}:${index}`,
        bookTitle: title,
        sourcePath,
        chunkIndex: index,
        text: chunk,
        embedding,
      });
    }

    const record: BookRecord = {
      id: `book-${Buffer.from(sourcePath).toString('base64url')}`,
      title,
      path: sourcePath,
      addedAt: new Date().toISOString(),
      chunkCount: embeddedChunks.length,
    };

    this.state.books = [...this.state.books.filter((book) => book.path !== sourcePath), record];
    this.state.chunks.push(...embeddedChunks);
    await this.persist();
    return record;
  }

  async scanFolder(folderPath: string): Promise<{ books: BookRecord[]; scannedFiles: number }> {
    const absoluteRoot = path.resolve(this.cwd, folderPath || '.');
    const files = await walkTextFiles(absoluteRoot);
    const imported: BookRecord[] = [];

    for (const filePath of files) {
      const book = await this.addBook(filePath, false);
      imported.push(book);
    }

    this.state.indexedRoots = Array.from(new Set([...this.state.indexedRoots, absoluteRoot]));
    await this.persist();
    return {
      books: imported,
      scannedFiles: files.length,
    };
  }

  getAllChunks(): IndexedChunk[] {
    return this.state.chunks;
  }

  getIndexedRoots(): string[] {
    return this.state.indexedRoots;
  }

  private async persist(): Promise<void> {
    await writeJson(this.statePath, this.state);
  }
}
