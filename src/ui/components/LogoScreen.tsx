import React from 'react';
import { Box, Text } from 'ink';
import { renderLogo } from '../logo.js';
import { theme } from '../theme.js';

export function LogoScreen() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text>{renderLogo()}</Text>
      <Text color={theme.dim}>Terminal RAG for book search, grounded answers, and local model workflows.</Text>
    </Box>
  );
}
