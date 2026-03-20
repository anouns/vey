export type AppMode = 'qa/search' | 'library';

export type ProviderType = 'ollama' | 'groq';

export interface ProviderConfig {
  provider: ProviderType;
  model: string;
  embeddingModel: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface BookRecord {
  id: string;
  title: string;
  path: string;
  addedAt: string;
  chunkCount: number;
}

export interface IndexedChunk {
  id: string;
  bookTitle: string;
  sourcePath: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
}

export interface SearchHit {
  id: string;
  bookTitle: string;
  text: string;
  score: number;
  sourcePath: string;
}

export interface RagAnswer {
  answer: string;
  citations: SearchHit[];
  insufficientContext: boolean;
}
