import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function safeReadJson<T>(
  filePath: string,
  fallback: T,
): Promise<T> {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

export async function listTextFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.txt'))
      .map((entry) => path.join(dirPath, entry.name));
  } catch {
    return [];
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const result = await stat(filePath);
    return result.isFile();
  } catch {
    return false;
  }
}
