import { promises as fs } from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import Tesseract from 'tesseract.js';
import WordExtractor from 'word-extractor';

const wordExtractor = new WordExtractor();

const textExtensions = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.yaml',
  '.yml',
  '.csv',
  '.log',
  '.xml',
  '.html',
  '.htm',
  '.ini',
  '.env',
]);

const imageExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.bmp',
  '.gif',
  '.tif',
  '.tiff',
]);

export const supportedExtensions = new Set([
  ...textExtensions,
  ...imageExtensions,
  '.pdf',
  '.doc',
  '.docx',
]);

function cleanupExtractedText(text) {
  return String(text || '')
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function readPlainText(filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function readPdfText(filePath) {
  const parser = new PDFParse({ data: await fs.readFile(filePath) });
  const result = await parser.getText();
  return result.text || '';
}

async function readDocxText(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || '';
}

async function readDocText(filePath) {
  const doc = await wordExtractor.extract(filePath);
  return [
    doc.getBody?.() || '',
    doc.getHeaders?.() || '',
    doc.getFooters?.() || '',
    doc.getFootnotes?.() || '',
    doc.getEndnotes?.() || '',
  ].join('\n');
}

async function readImageText(filePath) {
  const result = await Tesseract.recognize(filePath, 'eng+rus');
  return result?.data?.text || '';
}

export async function extractTextFromFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  let text = '';

  if (textExtensions.has(extension)) {
    text = await readPlainText(filePath);
  } else if (extension === '.pdf') {
    text = await readPdfText(filePath);
  } else if (extension === '.docx') {
    text = await readDocxText(filePath);
  } else if (extension === '.doc') {
    text = await readDocText(filePath);
  } else if (imageExtensions.has(extension)) {
    text = await readImageText(filePath);
  } else {
    return '';
  }

  return cleanupExtractedText(text);
}
