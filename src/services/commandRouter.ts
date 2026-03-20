import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import type { BookRecord, ProviderConfig, RagAnswer, SearchHit } from '../types.js';
import { BookIndexer } from './bookIndexer.js';
import { SearchEngine } from './searchEngine.js';

const execAsync = promisify(exec);

export type CommandResult =
  | { kind: 'books'; books: BookRecord[]; message: string }
  | { kind: 'search'; hits: SearchHit[]; message: string }
  | { kind: 'answer'; answer: RagAnswer; message: string }
  | { kind: 'shell'; output: string; message: string }
  | { kind: 'info'; message: string };

export class CommandRouter {
  private readonly search: SearchEngine;

  constructor(
    private readonly cwd: string,
    private readonly provider: ProviderConfig,
    private readonly indexer: BookIndexer,
  ) {
    this.search = new SearchEngine(indexer, provider);
  }

  async initialize(): Promise<void> {
    await this.indexer.init();
    await this.indexer.bootstrapDefaultBooks();
  }

  async handlePrompt(input: string, mode: 'qa/search' | 'library'): Promise<CommandResult> {
    const trimmed = input.trim();
    if (!trimmed) {
      return { kind: 'info', message: 'Пустой ввод.' };
    }

    if (trimmed.startsWith('!')) {
      return this.runShell(trimmed.slice(1).trim());
    }

    if (trimmed.startsWith('/model')) {
      return this.handleModel(trimmed);
    }

    if (trimmed.startsWith('/scan')) {
      return this.handleScan(trimmed);
    }

    if (mode === 'library') {
      return this.handleLibrary(trimmed);
    }

    if (/найди|find|fragment|цитат/i.test(trimmed)) {
      const hits = await this.search.findRelevantPassages(trimmed);
      return {
        kind: 'search',
        hits,
        message: hits.length
          ? `Найдено ${hits.length} релевантных фрагмента(ов).`
          : 'В загруженных текстах нет нужного фрагмента.',
      };
    }

    const answer = await this.search.answerQuestion(trimmed);
    return {
      kind: 'answer',
      answer,
      message: answer.insufficientContext
        ? 'Недостаточно контекста для ответа.'
        : 'Ответ построен по найденным фрагментам.',
    };
  }

  private async handleLibrary(input: string): Promise<CommandResult> {
    if (input === '/books') {
      const books = await this.indexer.listBooks();
      return { kind: 'books', books, message: `В библиотеке ${books.length} книг.` };
    }

    if (input.startsWith('/scan')) {
      return this.handleScan(input);
    }

    const normalizedPath = input.startsWith('/add ')
      ? input.replace('/add ', '')
      : input;
    const record = await this.indexer.addBook(path.resolve(this.cwd, normalizedPath));
    return {
      kind: 'info',
      message: `Книга "${record.title}" загружена, чанков: ${record.chunkCount}.`,
    };
  }

  private runShell(command: string): CommandResult {
    if (!command) {
      return { kind: 'info', message: 'После ! нужна команда терминала.' };
    }

    try {
      const { spawnSync } = require('node:child_process');
      spawnSync(command, { stdio: 'inherit', shell: true, cwd: this.cwd });
      return {
        kind: 'shell',
        output: 'Команда выполнена (см. выше).',
        message: `Shell: ${command}`,
      };
    } catch (error: unknown) {
      return {
        kind: 'info',
        message: `Ошибка выполнения: ${String(error)}`,
      };
    }
  }

  private handleModel(input: string): CommandResult {
    const args = input.split(/\s+/).slice(1);
    if (args.length === 0) {
      return {
        kind: 'info',
        message: `Текущий провайдер: ${this.provider.provider}, модель: ${this.provider.model}, embeddings: ${this.provider.embeddingModel}.`,
      };
    }

    const [providerOrModel, maybeModel] = args;
    if (providerOrModel === 'ollama' || providerOrModel === 'groq') {
      this.provider.provider = providerOrModel;
      if (maybeModel) {
        this.provider.model = maybeModel;
      }
    } else {
      this.provider.model = providerOrModel;
    }

    return {
      kind: 'info',
      message: `Модель обновлена: ${this.provider.provider}/${this.provider.model}.`,
    };
  }

  private async handleScan(input: string): Promise<CommandResult> {
    const folder = input.replace('/scan', '').trim() || '.';
    const result = await this.indexer.scanFolder(folder);
    return {
      kind: 'books',
      books: result.books,
      message: `Сканирование завершено: ${result.scannedFiles} файлов из ${path.resolve(this.cwd, folder)}.`,
    };
  }
}
