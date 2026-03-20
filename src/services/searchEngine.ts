import type { IndexedChunk, ProviderConfig, RagAnswer, SearchHit } from '../types.js';
import { MAX_CITATIONS, MIN_SIMILARITY_SCORE } from '../config/defaults.js';
import { BookIndexer } from './bookIndexer.js';
import { createEmbedding, generateAnswer } from './providerFactory.js';

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function rankChunks(chunks: IndexedChunk[], queryEmbedding: number[]): SearchHit[] {
  return chunks
    .map((chunk) => ({
      id: chunk.id,
      bookTitle: chunk.bookTitle,
      text: chunk.text,
      sourcePath: chunk.sourcePath,
      score: cosineSimilarity(chunk.embedding, queryEmbedding),
    }))
    .sort((left, right) => right.score - left.score);
}

export class SearchEngine {
  constructor(
    private readonly indexer: BookIndexer,
    private readonly provider: ProviderConfig,
  ) {}

  async findRelevantPassages(query: string, limit = MAX_CITATIONS): Promise<SearchHit[]> {
    const chunks = this.indexer.getAllChunks();
    if (chunks.length === 0) {
      return [];
    }

    const queryEmbedding = await createEmbedding(this.provider, query);
    const ranked = rankChunks(chunks, queryEmbedding);
    return ranked
      .filter((hit) => hit.score >= MIN_SIMILARITY_SCORE)
      .slice(0, limit);
  }

  async answerQuestion(question: string): Promise<RagAnswer> {
    const citations = await this.findRelevantPassages(question, MAX_CITATIONS);
    if (citations.length === 0) {
      return {
        answer: 'В загруженных текстах нет нужного фрагмента.',
        citations: [],
        insufficientContext: true,
      };
    }

    const context = citations
      .map(
        (citation, index) =>
          `[${index + 1}] Источник: ${citation.bookTitle}\n${citation.text}`,
      )
      .join('\n\n');

    const answer = await generateAnswer(
      this.provider,
      'Отвечай ТОЛЬКО на основе предоставленных фрагментов. Если ответа там нет, скажи об этом прямо. Не выдумывай факты и не ссылайся на внешние знания.',
      `Вопрос пользователя: ${question}\n\nФрагменты:\n${context}\n\nДай короткий, ясный ответ по-русски только на основании этих фрагментов.`,
    );

    return {
      answer: answer || 'Не удалось сформировать ответ по найденным фрагментам.',
      citations,
      insufficientContext: false,
    };
  }
}
