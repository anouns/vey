import type { ProviderConfig } from '../types.js';

interface OllamaEmbedResponse {
  embeddings?: number[][];
  embedding?: number[];
}

interface OllamaChatResponse {
  message?: {
    content?: string;
  };
}

interface GroqChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export async function createEmbedding(
  config: ProviderConfig,
  text: string,
): Promise<number[]> {
  const baseUrl = config.baseUrl || 'http://127.0.0.1:11434';
  const response = await fetch(`${baseUrl}/api/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.embeddingModel,
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama embeddings error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as OllamaEmbedResponse;
  const embedding = json.embeddings?.[0] || json.embedding;
  if (!embedding || embedding.length === 0) {
    throw new Error('Ollama did not return an embedding vector.');
  }

  return embedding;
}

export async function generateAnswer(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  if (config.provider === 'groq') {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey || process.env.GROQ_API_KEY || ''}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.1,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq chat error: ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as GroqChatResponse;
    return json.choices?.[0]?.message?.content?.trim() || '';
  }

  const baseUrl = config.baseUrl || 'http://127.0.0.1:11434';
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      stream: false,
      options: {
        temperature: 0.1,
      },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama chat error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as OllamaChatResponse;
  return json.message?.content?.trim() || '';
}
