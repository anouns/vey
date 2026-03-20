# vey.TUI

Terminal-first local AI workspace assistant with workspace-grounded RAG, multi-format text extraction, Ollama support, Groq key support, and a Gemini CLI-inspired interaction model.

## Overview

`vey.TUI` is a Node.js terminal application focused on one operating principle:

1. open the current workspace,
2. extract text from supported files,
3. index the workspace locally,
4. answer from indexed material first,
5. fall back to general knowledge only when local evidence is missing.

The application is designed for interactive terminal work. It combines a custom raw-terminal UI, local-first retrieval, shell passthrough, workspace switching, grounded answering with citations, and a global `vey` launcher flow for Windows.

## Core Capabilities

### TUI

- Sticky header with program name, date, time, and session timer.
- Bottom-fixed input field.
- Shortcut overlay on `?`.
- Slash command menu on `/`.
- Model picker on `/model`.
- Shell mode on `!`.
- Persistent chat history.
- Chat scrolling with `Up`, `Down`, `PageUp`, and `PageDown`.

### Workspace

- Open another folder with `/open <path>`.
- Change workspace with `! cd <path>`.
- Re-index the current folder with `/scan`.
- List indexed files from the current workspace with `/book` or `/books`.
- Clear the chat with `/cls`.
- Reset and rebuild the index with `/reset`.

### Retrieval and Answering

- Workspace-first routing for file-grounded questions.
- Lexical-first matching before semantic fallback.
- Explicit file-name matching.
- Grounded answers with citations.
- "not found" handling when no local evidence is present.
- General assistant mode for ordinary non-file questions.

### Providers

- Local Ollama chat generation.
- Local Ollama embeddings.
- Groq API key capture from the UI.
- Runtime model switching.

## Supported File Types

`vey.TUI` extracts text from the following formats.

### Plain and structured text

- `.txt`
- `.md`
- `.markdown`
- `.json`
- `.yaml`
- `.yml`
- `.csv`
- `.log`
- `.xml`
- `.html`
- `.htm`
- `.ini`
- `.env`

### Documents

- `.pdf`
- `.doc`
- `.docx`

### Images with OCR

- `.png`
- `.jpg`
- `.jpeg`
- `.webp`
- `.bmp`
- `.gif`
- `.tif`
- `.tiff`

### Extraction backend

- `pdf-parse` for PDF text extraction.
- `mammoth` for DOCX extraction.
- `word-extractor` for DOC extraction.
- `tesseract.js` for OCR over image files.

If a file does not expose usable text, it is skipped during indexing.

## Retrieval Policy

The active retrieval policy is workspace-first.

### High-level behavior

1. The app indexes the currently opened folder.
2. The app answers from indexed files in the current workspace before using general knowledge.
3. Direct file references are prioritized when the question names a file.
4. Retrieval tries lexical overlap first.
5. Semantic similarity is used as a fallback.
6. If nothing relevant is found, the app states that clearly and only then may provide a cautious general answer.

### Prompt policy

Runtime prompt rules live in:

- [WORKSPACE_RAG_RULES.md](/Users/1thproj/Documents/THEBESTPROJECTEVER/WORKSPACE_RAG_RULES.md)

The runtime loads these rules and appends them to the answer instructions so the model does not claim that it has no access to local files after the workspace has already been scanned.

## Commands

### Core commands

- `/scan`
  Re-index the current workspace.

- `/open <path>`
  Open another folder and automatically re-index it.

- `/book`
  Show indexed files from the currently opened folder.

- `/books`
  Alias of `/book`.

- `/model`
  Open the model picker.

- `/reset`
  Clear the stored index and rebuild from the current folder.

- `/cls`
  Clear chat history and in-memory conversation state.

- `/quit`
  Exit the program.

### Shell commands

- `!`
  Enter shell mode.

- `! <command>`
  Run a shell command from inside the UI.

- `! cd <path>`
  Change the application workspace instead of launching a child shell.

### Navigation

- `?`
  Toggle shortcut help.

- `Tab`
  Focus the live shell pane.

- `Shift+Tab`
  Return focus to the main input.

- `Esc`
  Close menus and archive an active shell session into chat history.

- `Up` and `Down`
  Move in menus or scroll chat history.

- `PageUp` and `PageDown`
  Scroll chat history faster.

## Runtime Model Behavior

### Ollama

Default runtime targets Ollama and expects:

- a local Ollama daemon,
- a generation model such as `llama3.1:8b`,
- an embedding model such as `nomic-embed-text`.

Used endpoints:

- `/api/chat`
- `/api/embed`
- `/api/tags`

### Groq

Groq is supported as a generation backend. The UI supports storing a Groq API key and switching the active generation model.

## Project Structure

```text
THEBESTPROJECTEVER/
|-- .vey/
|   |-- config.json
|   `-- index.json
|-- books/
|   |-- sample-alice.txt
|   |-- sample-misha.txt
|   `-- sample-sherlock.txt
|-- docs/
|   `-- architecture.md
|-- scripts/
|   |-- build-installer.ps1
|   |-- install-global.cmd
|   `-- uninstall-global.cmd
|-- src/
|   |-- index.js
|   `-- textExtraction.js
|-- WORKSPACE_RAG_RULES.md
|-- package.json
|-- package-lock.json
|-- README.md
`-- tsconfig.json
```

## File Responsibilities

### [src/index.js](/Users/1thproj/Documents/THEBESTPROJECTEVER/src/index.js)

Main runtime and terminal application.

Contains:

- screen rendering,
- keyboard handling,
- slash command routing,
- workspace switching,
- shell integration,
- chat state management,
- indexing orchestration,
- retrieval logic,
- answer generation,
- Ollama and Groq integration.

### [src/textExtraction.js](/Users/1thproj/Documents/THEBESTPROJECTEVER/src/textExtraction.js)

Multi-format text extraction layer.

Contains:

- plain text reading,
- PDF extraction,
- DOC and DOCX extraction,
- OCR for image files,
- extracted text cleanup,
- extension support mapping.

### [WORKSPACE_RAG_RULES.md](/Users/1thproj/Documents/THEBESTPROJECTEVER/WORKSPACE_RAG_RULES.md)

Prompt policy file that enforces local grounded behavior.

### [scripts/build-installer.ps1](/Users/1thproj/Documents/THEBESTPROJECTEVER/scripts/build-installer.ps1)

Builds the Windows self-extracting installer with `IExpress`.

### [scripts/install-global.cmd](/Users/1thproj/Documents/THEBESTPROJECTEVER/scripts/install-global.cmd)

Installs the application into the user profile and registers the `vey` launcher.

### [scripts/uninstall-global.cmd](/Users/1thproj/Documents/THEBESTPROJECTEVER/scripts/uninstall-global.cmd)

Removes the installed files and deletes the user-level `PATH` entry.

## Indexing Flow

### Step 1. Workspace selection

The app starts in the current terminal folder. The workspace can then be changed with `/open <path>` or `! cd <path>`.

### Step 2. File discovery

The runtime walks the current workspace and skips technical folders such as:

- `.git`
- `.vey`
- `node_modules`

### Step 3. Text extraction

Each supported file type is passed through the appropriate extraction backend.

### Step 4. Chunking

Extracted text is normalized and split into overlapping chunks.

### Step 5. Embeddings

Each chunk receives an embedding through Ollama.

### Step 6. Retrieval

The current workspace index is searched with lexical-first ranking and semantic fallback.

### Step 7. Answer synthesis

The model receives the relevant fragments, the workspace policy, and the indexed file list. If evidence exists, the answer is grounded and citations are shown.

## Installation

### Requirements

- Windows 10 or newer.
- Node.js 20 or newer available in `PATH`.
- Ollama installed and running for local generation.
- At least one local generation model.
- At least one local embedding model.

### Local development

```bash
npm install
npm run start
```

### Global command via npm link

```bash
npm install
npm run link:global
vey
```

The global command preserves the caller working directory, so `vey` opens in the folder from which it was launched.

### Windows installer

Build the installer:

```bash
npm run build:installer
```

Generated artifact:

- `dist/vey-setup.exe`

Installer behavior:

- installs the application into `%LocalAppData%\Programs\vey-tui`,
- creates `%LocalAppData%\Programs\vey-tui\bin\vey.cmd`,
- adds that `bin` directory to the current user `PATH`,
- allows `vey` to be launched from any new terminal window.

After installation, open a new terminal and run:

```bash
vey
```

## Usage Examples

### Start in the current folder

```bash
node src/index.js
```

### Open another workspace

```text
/open C:\Users\name\Documents\my-folder
```

### Re-index the current folder

```text
/scan
```

### Ask about a file

```text
what is in sample-alice.txt
```

### Ask a fact grounded in a file

```text
how old is kirill?
what does kirill like?
```

### Clear the chat

```text
/cls
```

## Design Decisions

### Why a custom raw-terminal TUI

The runtime uses a custom raw terminal renderer instead of a heavier UI framework. This keeps the process easy to ship and predictable in a terminal session.

### Why workspace-first retrieval

The main failure mode in local AI assistants is generic chat leaking into file-grounded questions. This project explicitly prioritizes the open workspace before general knowledge.

### Why a prompt rules file

The prompt policy is externalized into a markdown document so it can be audited, refined, and version-controlled separately from the runtime logic.

## Known Limitations

- OCR on large image sets can be slow.
- PDF extraction quality depends on source structure.
- Very large workspaces can reduce retrieval precision unless the user narrows the folder.
- Legacy `.doc` parsing is less reliable than `.docx`.
- PowerShell batch-mode Russian text can still display mojibake because of console encoding, even when the logic itself is correct.
- The installer expects Node.js to already be installed on the target machine.

## Verification Notes

The project has been checked with:

- `node --check src/index.js`
- `npm run build:installer`
- direct workspace switching with `/open`
- shell workspace switching with `! cd`
- `/scan`
- `/book`
- shell transcript archiving
- file-grounded answering against local sample files
- launcher execution from another working directory

## Packaging and Distribution

The Windows packaging flow is now part of the repository.

### Build pipeline

1. `scripts/build-installer.ps1` stages the runtime files.
2. The script zips the staged payload.
3. `IExpress` wraps that payload and the install scripts into `dist/vey-setup.exe`.

### Installed layout

```text
%LocalAppData%\Programs\vey-tui\
|-- bin\
|   `-- vey.cmd
|-- books\
|-- docs\
|-- node_modules\
|-- scripts\
|-- src\
|-- package.json
`-- README.md
```

The launcher preserves the caller working directory, so:

```bash
cd C:\Users\name\Documents\some-project
vey
```

starts `vey.TUI` directly in `C:\Users\name\Documents\some-project`.
