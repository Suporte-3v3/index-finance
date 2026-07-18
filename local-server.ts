// Local development/production server. Vercel uses the functions in /api.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import {
  analyzeDocument,
  createDocumentUploadSession,
  DocumentAssistantError,
  getGeminiModel,
  hasConfiguredGeminiKey,
} from './backend/document-assistant';

// `.env.local` is intentionally gitignored and takes precedence over `.env`.
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false });

const app = express();
const port = Number(process.env.PORT || 3000);
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(rootDir, '.data', 'uploads');
await mkdir(uploadDir, { recursive: true });

// Base64 increases the payload by roughly 33%; this safely accommodates a 20 MB file.
app.use(express.json({ limit: '30mb' }));
app.use('/uploads', express.static(uploadDir, { fallthrough: false }));

app.post('/api/documents/upload', async (request, response) => {
  const { data, fileName } = request.body as { data?: string; fileName?: string };
  if (!data || !fileName) {
    response.status(400).json({ error: 'Arquivo ausente.' });
    return;
  }
  try {
    const extension = path.extname(fileName).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10);
    const storedName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    await writeFile(path.join(uploadDir, storedName), Buffer.from(data, 'base64'));
    response.json({ url: `/uploads/${storedName}` });
  } catch (error) {
    console.error('Document upload failed:', error instanceof Error ? error.message : error);
    response.status(500).json({ error: 'Não foi possível armazenar o documento.' });
  }
});

app.get('/api/documents/status', (_request, response) => {
  response.json({
    available: hasConfiguredGeminiKey(),
    model: getGeminiModel(),
    maxFileSize: 20 * 1024 * 1024,
    environment: 'local',
    persistentUploads: true
  });
});

app.post('/api/documents/upload-url', async (request, response) => {
  try {
    const uploadUrl = await createDocumentUploadSession(request.body);
    response.json({ uploadUrl });
  } catch (error) {
    const status = error instanceof DocumentAssistantError ? error.status : 500;
    response.status(status).json({
      error:
        error instanceof Error
          ? error.message
          : 'Não foi possível preparar o documento para análise.',
    });
  }
});

app.post('/api/documents/analyze', async (request, response) => {
  try {
    const analysis = await analyzeDocument(request.body);
    response.json({ analysis, source: 'gemini' });
  } catch (error) {
    const status = error instanceof DocumentAssistantError ? error.status : 500;
    response.status(status).json({
      error:
        error instanceof Error
          ? error.message
          : 'Não foi possível analisar o documento agora.',
    });
  }
});

const production = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
if (production) {
  app.use(express.static(path.join(rootDir, 'dist')));
  app.get('*', (_request, response) => response.sendFile(path.join(rootDir, 'dist', 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.listen(port, '0.0.0.0', () => console.log(`Idex Finance disponível em http://localhost:${port}`));
