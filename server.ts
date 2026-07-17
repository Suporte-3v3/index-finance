import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';

// `.env.local` is intentionally gitignored and takes precedence over `.env`.
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false });

const app = express();
const port = Number(process.env.PORT || 3000);
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(rootDir, '.data', 'uploads');
await mkdir(uploadDir, { recursive: true });

function hasConfiguredGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && !['MY_GEMINI_API_KEY', 'SUA_CHAVE_REAL'].includes(key));
}

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
  const apiKey = process.env.GEMINI_API_KEY;
  response.json({
    available: hasConfiguredGeminiKey(),
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  });
});

app.post('/api/documents/analyze', async (request, response) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!hasConfiguredGeminiKey() || !apiKey) {
    response.status(503).json({ error: 'Serviço de análise visual não configurado.' });
    return;
  }

  const { data, mimeType, fileName, companyName, context } = request.body as Record<string, string>;
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']);
  if (!data || !mimeType || !fileName || !allowedTypes.has(mimeType)) {
    response.status(400).json({ error: 'Arquivo ausente ou formato não compatível com a análise visual.' });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: [
        { inlineData: { mimeType, data } },
        { text: `Analise visualmente este documento financeiro brasileiro. Pode ser foto, PDF, boleto, nota fiscal, comprovante, recibo, extrato ou contrato.
Extraia somente informações realmente legíveis; nunca invente. Use string vazia para campos ilegíveis. Datas em YYYY-MM-DD, competência em YYYY-MM e valor como número sem símbolo.
Empresa selecionada: ${companyName || 'não informada'}. Contexto do usuário: ${context || 'nenhum'}.
Resuma objetivamente o documento. Em warnings, informe desfoque, corte, reflexo ou campos importantes ilegíveis.` }
      ],
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object', additionalProperties: false,
          required: ['documentType', 'supplier', 'dueDate', 'expenseType', 'companyName', 'documentNumber', 'amount', 'currency', 'competenceMonth', 'summary', 'confidence', 'warnings'],
          properties: {
            documentType: { type: 'string', enum: ['Nota fiscal', 'Boleto', 'Comprovante', 'Extrato', 'Contrato', 'Recibo', 'Relatório', 'Documento contábil', 'Outros'] },
            supplier: { type: 'string' }, dueDate: { type: 'string' }, expenseType: { type: 'string' },
            companyName: { type: 'string' }, documentNumber: { type: 'string' },
            amount: { type: 'number' }, currency: { type: 'string' }, competenceMonth: { type: 'string' },
            summary: { type: 'string' }, confidence: { type: 'number', minimum: 0, maximum: 100 },
            warnings: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    });

    if (!result.text) throw new Error('O modelo não retornou conteúdo.');
    response.json({ analysis: JSON.parse(result.text), source: 'gemini' });
  } catch (error) {
    console.error('Document analysis failed:', error instanceof Error ? error.message : error);
    response.status(502).json({ error: 'Não foi possível analisar o documento agora.' });
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
