import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

export function InputPanel({
  value,
  focused,
  mode,
}: {
  value: string;
  focused: boolean;
  mode: 'qa/search' | 'library';
}) {
  const placeholder =
    mode === 'library'
      ? '/scan . или /add books/my-book.txt'
      : 'Например: кто такой миша? или Найди, где говорится про Мишу';

  return (
    <Box
      flexDirection="row"
      borderStyle="round"
      borderColor={focused ? theme.accent : theme.border}
      paddingX={1}
    >
      <Box marginRight={1}>
        <Text color={theme.accent}>❯</Text>
      </Box>
      <Box flexGrow={1}>
        <Text color={value ? theme.text : theme.dim}>{value || placeholder}</Text>
      </Box>
      {focused && (
        <Box marginLeft={1}>
          <Text color={theme.dim}>[Enter to Submit]</Text>
        </Box>
      )}
    </Box>
  );
}
