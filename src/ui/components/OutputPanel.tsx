import React from 'react';
import { Box, Text } from 'ink';
import type { BookRecord, RagAnswer, SearchHit } from '../../types.js';
import { theme } from '../theme.js';

type OutputEntry =
  | { type: 'info'; text: string }
  | { type: 'books'; books: BookRecord[]; text: string }
  | { type: 'search'; hits: SearchHit[]; text: string }
  | { type: 'answer'; answer: RagAnswer; text: string }
  | { type: 'shell'; output: string; text: string };

export function OutputPanel({ entries, focused }: { entries: OutputEntry[]; focused: boolean }) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={focused ? theme.accent : theme.border}
      paddingX={1}
      flexGrow={1}
      marginBottom={1}
    >
      <Text color={theme.accent}>Results</Text>
      {entries.length === 0 && <Text color={theme.dim}>Пока нет результатов.</Text>}
      {entries.map((entry, index) => (
        <Box key={`${entry.type}-${index}`} flexDirection="column" marginBottom={1}>
          <Text color={theme.dim}>{entry.text}</Text>
          {entry.type === 'books' &&
            entry.books.map((book) => (
              <Text key={book.id}>
                <Text color={theme.info}>{book.title}</Text>
                <Text color={theme.dim}>  чанков: {book.chunkCount}  путь: {book.path}</Text>
              </Text>
            ))}
          {entry.type === 'search' &&
            entry.hits.map((hit) => (
              <Box key={hit.id} flexDirection="column" marginTop={1}>
                <Text color={theme.info}>
                  {hit.bookTitle}  similarity={hit.score.toFixed(3)}
                </Text>
                <Text>{hit.text}</Text>
              </Box>
            ))}
          {entry.type === 'answer' && (
            <Box flexDirection="column" marginTop={1}>
              <Text>{entry.answer.answer}</Text>
              <Text color={theme.accent}>Цитаты:</Text>
              {entry.answer.citations.map((citation) => (
                <Box key={citation.id} flexDirection="column" marginTop={1}>
                  <Text color={theme.info}>{citation.bookTitle}</Text>
                  <Text>{citation.text}</Text>
                </Box>
              ))}
            </Box>
          )}
          {entry.type === 'shell' && <Text>{entry.output}</Text>}
        </Box>
      ))}
    </Box>
  );
}
