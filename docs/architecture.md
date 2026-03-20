# vey.TUI architecture

## Goal

Recreate the dense terminal feel of `gemini-cli`, but repurpose the agent layer into a book-centric RAG workflow with two primary modes:

- `[qa/search]` for semantic retrieval and grounded answering
- `[library]` for book ingestion and library inspection

## UI split

- `src/ui/App.tsx`
  Orchestrates app state, keyboard handling, router calls, and top-level layout.
- `src/ui/components/Header.tsx`
  Persistent top area with date, time, active provider/model, current mode, and session timer.
- `src/ui/components/LogoScreen.tsx`
  Startup identity screen with TrueColor ANSI logo.
- `src/ui/components/ModeTabs.tsx`
  Mode indicator aligned with the original gemini-cli header conventions.
- `src/ui/components/OutputPanel.tsx`
  Result stream for retrieval hits, grounded answers, book listings, and shell output.
- `src/ui/components/InputPanel.tsx`
  Focusable prompt surface matching the terminal chat flow.
- `src/ui/components/HelpModal.tsx`
  Shortcut overlay for `?`.

## RAG split

- `src/services/bookIndexer.ts`
  Loads `.txt` books, chunks text via `RecursiveCharacterTextSplitter`, embeds, and writes chunk vectors to `MemoryVectorStore`.
- `src/services/searchEngine.ts`
  Runs similarity search, applies a minimum-score threshold, builds constrained RAG prompts, and returns citations.
- `src/services/providerFactory.ts`
  Creates the model/embedding clients for Ollama or Groq-backed generation.
- `src/services/commandRouter.ts`
  Converts raw TUI input into app actions, shell passthrough, library commands, search, or RAG answers.

## Data flow

1. User adds a `.txt` file in `[library]`.
2. `BookIndexer` splits it into overlapping chunks and stores metadata per chunk.
3. In `[qa/search]`, a query hits `SearchEngine.findRelevantPassages`.
4. If relevant chunks exist, they are either rendered directly or passed into the LLM with a strict grounding prompt.
5. The UI renders the answer and citations in one output stream.

## Current tradeoffs

- Vector store is in-memory for simplicity and reliability in a hackathon setup.
- Book registry is persisted in `.vey/index.json`, while vectors are rebuilt per session.
- Groq is used for generation only; embeddings still rely on Ollama in this version.
