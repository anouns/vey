import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { DEFAULT_PROVIDER } from '../config/defaults.js';
import { BookIndexer } from '../services/bookIndexer.js';
import { CommandRouter } from '../services/commandRouter.js';
import type { AppMode, ProviderConfig } from '../types.js';
import { Header } from './components/Header.js';
import { HelpModal } from './components/HelpModal.js';
import { InputPanel } from './components/InputPanel.js';
import { LogoScreen } from './components/LogoScreen.js';
import { ModeTabs } from './components/ModeTabs.js';
import { OutputPanel } from './components/OutputPanel.js';
import { theme } from './theme.js';

type OutputEntry = React.ComponentProps<typeof OutputPanel>['entries'][number];

export function App() {
  const cwd = process.cwd();
  const { exit } = useApp();
  const providerRef = useRef<ProviderConfig>({ ...DEFAULT_PROVIDER });
  const [, setProviderVersion] = useState(0);
  const [mode, setMode] = useState<AppMode>('qa/search');
  const [focus, setFocus] = useState<'results' | 'input'>('input');
  const [input, setInput] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [entries, setEntries] = useState<OutputEntry[]>([]);
  const [bootMessage, setBootMessage] = useState('Инициализация библиотеки...');
  const [ready, setReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const sessionStartedAt = useMemo(() => Date.now(), []);
  const router = useMemo(() => {
    const indexer = new BookIndexer(cwd, providerRef.current);
    return new CommandRouter(cwd, providerRef.current, indexer);
  }, [cwd]);

  useEffect(() => {
    router
      .initialize()
      .then(() => {
        setBootMessage('vey.TUI готов. Для индексации текущей папки используй /scan .');
        setReady(true);
      })
      .catch((error: unknown) => {
        setBootMessage(`Ошибка инициализации: ${String(error)}`);
      });
  }, [router]);

  useInput((inputChar, key) => {
    if (key.ctrl && inputChar === 'c') {
      exit();
      return;
    }

    if (inputChar === '?' && input.length === 0) {
      setShowHelp((value) => !value);
      return;
    }

    if (key.tab) {
      setFocus((value) => (value === 'input' ? 'results' : 'input'));
      return;
    }

    if (key.ctrl && inputChar && inputChar.toLowerCase() === 'w') {
      setMode((value) => (value === 'qa/search' ? 'library' : 'qa/search'));
      return;
    }

    if (key.return) {
      void handleSubmit();
      return;
    }

    if (key.backspace || key.delete) {
      setInput((value) => value.slice(0, -1));
      return;
    }

    if (key.escape) {
      setShowHelp(false);
      setInput('');
      return;
    }

    if (!key.ctrl && !key.meta && inputChar) {
      setInput((value) => value + inputChar);
    }
  });

  async function handleSubmit() {
    if (!ready || isGenerating) {
      return;
    }

    const current = input.trim();
    if (!current) {
      return;
    }

    setIsGenerating(true);
    setInput('');

    try {
      const result = await router.handlePrompt(current, mode);
      if (current.startsWith('/model')) {
        setProviderVersion((value) => value + 1);
      }
      const nextEntry: OutputEntry =
        result.kind === 'books'
          ? ({ type: 'books' as const, books: result.books, text: result.message })
          : result.kind === 'search'
            ? ({ type: 'search' as const, hits: result.hits, text: result.message })
            : result.kind === 'answer'
              ? ({ type: 'answer' as const, answer: result.answer, text: result.message })
              : result.kind === 'shell'
                ? ({ type: 'shell' as const, output: result.output, text: result.message })
                : ({ type: 'info' as const, text: result.message });

      setEntries((value) => [...value, nextEntry].slice(-10));
    } catch (error: unknown) {
      setEntries((value) => [
        ...value,
        { type: 'info' as const, text: `Ошибка: ${String(error)}` } as OutputEntry,
      ].slice(-10));
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Box flexDirection="column" height="100%">
      <Header mode={mode} provider={providerRef.current} sessionStartedAt={sessionStartedAt} />
      {showHelp ? (
        <Box borderStyle="single" borderColor={theme.accent} padding={1} marginY={1}>
          <Text bold color={theme.accent}>Shortcuts / Keyboard Help:{"\n"}</Text>
          <Text color={theme.text}>
            ? - Toggle this help (on empty input){"\n"}
            !cmd - System shell pass-through{"\n"}
            Ctrl+W - Toggle QA/Library mode{"\n"}
            Tab - Switch focus{"\n"}
            Esc - Clear input / Close help{"\n"}
            /scan [dir] - Start indexing files{"\n"}
            /model [name] - Change AI model
          </Text>
        </Box>
      ) : (
        <LogoScreen />
      )}
      <ModeTabs mode={mode} />
      <Box flexGrow={1} flexDirection="column">
        <OutputPanel entries={entries} focused={focus === 'results'} />
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {input.startsWith('/') && (
          <Box borderStyle="classic" borderColor={theme.dim} paddingX={1} marginBottom={-1} alignSelf="flex-start">
            <Text color={theme.dim}>Commands: /scan, /add, /books, /reset, /model, /quit</Text>
          </Box>
        )}
        <InputPanel value={input} focused={focus === 'input'} mode={mode} />
        <Box paddingX={1} flexDirection="row" justifyContent="space-between">
          <Text color={theme.dim}>{bootMessage}</Text>
          {isGenerating && (
            <Box>
              <Text color={theme.accent}>Generating... </Text>
              <Spinner />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function Spinner() {
  const [frame, setFrame] = useState(0);
  const frames = ['\\', '|', '/', '-'];
  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);
  return <Text color={theme.accent}>{frames[frame]}</Text>;
}
