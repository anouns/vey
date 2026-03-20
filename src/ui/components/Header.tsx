import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import stringWidth from 'string-width';
import { theme } from '../theme.js';
import type { AppMode, ProviderConfig } from '../../types.js';

interface HeaderProps {
  mode: AppMode;
  provider: ProviderConfig;
  sessionStartedAt: number;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function Header({ mode, provider, sessionStartedAt }: HeaderProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const date = useMemo(
    () =>
      new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(now),
    [now],
  );

  const time = useMemo(
    () =>
      new Intl.DateTimeFormat('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(now),
    [now],
  );

  const modeLabel = `[${mode}]`;
  const providerLabel = `${provider.provider}:${provider.model}`;
  const sessionLabel = `session ${formatDuration(now - sessionStartedAt)}`;
  const topRule = '─'.repeat(Math.max(stringWidth(modeLabel) + stringWidth(providerLabel) + 12, 54));

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={theme.border}>{topRule}</Text>
      <Box justifyContent="space-between">
        <Text color={theme.accent}>vey.TUI</Text>
        <Text color={theme.dim}>{date}</Text>
      </Box>
      <Box justifyContent="space-between">
        <Text color={theme.text}>
          <Text color={theme.accentMuted}>{modeLabel}</Text>
          {'  '}
          {providerLabel}
        </Text>
        <Text color={theme.info}>
          {time}
          {'  '}
          {sessionLabel}
        </Text>
      </Box>
      <Text color={theme.border}>{topRule}</Text>
    </Box>
  );
}
