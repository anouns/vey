## Workspace RAG Rules

- Before answering a question about the current workspace, treat scanned files from the currently open folder as the primary source of truth.
- First inspect the indexed file list for the current folder and prefer answering from those files.
- First look for lexical and filename matches, then only use meaning-level similarity if lexical search is weak.
- If the user mentions a specific file, use fragments from that file before using general knowledge.
- Never say that you do not have access to local files when the workspace has already been scanned and indexed.
- If the current folder has only a manageable number of indexed chunks, inspect all of them before finalizing the answer.
- If the scanned files do not contain the answer, say that no relevant information was found in the current folder, then provide a cautious general answer.
- Skip a file-grounded answer only when the question is clearly unrelated to the current folder or its files.
- Keep answers grounded, concise, and include citations when file fragments were used.
