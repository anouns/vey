import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

export function HelpModal() {
  const shortcuts = [
    ['?', 'открыть/закрыть shortcuts'],
    ['!', 'выполнить shell-команду'],
    ['Ctrl+W', 'переключить режим qa/search <-> library'],
    ['Tab', 'сменить фокус между окном и вводом'],
    ['/model [provider] [name]', 'сменить модель'],
    ['/scan .', 'прочитать все текстовые файлы в папке'],
    ['/books', 'список книг в library'],
    ['/add <path>', 'загрузить txt-книгу'],
  ];

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.border} paddingX={1} marginBottom={1}>
      <Text color={theme.accent}>Shortcuts</Text>
      {shortcuts.map(([key, description]) => (
        <Text key={key}>
          <Text color={theme.info}>{key}</Text>
          <Text color={theme.dim}>  </Text>
          <Text>{description}</Text>
        </Text>
      ))}
    </Box>
  );
}
