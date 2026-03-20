import React from 'react';
import { Box, Text } from 'ink';
import type { AppMode } from '../../types.js';
import { theme } from '../theme.js';

export function ModeTabs({ mode }: { mode: AppMode }) {
  const qaColor = mode === 'qa/search' ? theme.accent : theme.dim;
  const libraryColor = mode === 'library' ? theme.accent : theme.dim;

  return (
    <Box marginBottom={1}>
      <Text color={qaColor}>[qa/search]</Text>
      <Text color={theme.dim}>  </Text>
      <Text color={libraryColor}>[library]</Text>
      <Text color={theme.dim}>  Tab: focus  Ctrl+W: switch mode</Text>
    </Box>
  );
}
