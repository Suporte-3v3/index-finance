import { GoogleGenAI } from '@google/genai';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

export interface DocumentAnalysisInput {
  data?: string;
  fileUri?: string;
  uploadedFileName?: string;
  mimeType: string;
  fileName: string;
  companyName?: string;
  context?: string;
}

export interface DocumentUploadInput {
  fileName: string;
  mimeType: string;
  size: number;
}

export interface VisualDocumentAnalysis {
  documentType: string;
  supplier: string;
  dueDate: string;
  expenseType: string;
  companyName: string;
  documentNumber: string;
  amount: number;
  currency: string;
  competenceMonth: string;
  summary: string;
  confidence: number;
  warnings: string[];
}

export class DocumentAssistantError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'DocumentAssistantError';
  }
}

export function hasConfiguredGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(
    key && !['MY_GEMINI_API_KEY', 'SUA_CHAVE_REAL'].includes(key),
  );
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

const allowedTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!hasConfiguredGeminiKey() || !apiKey) {
    const configurationHint = process.env.VERCEL
      ? 'Cadastre GEMINI_API_KEY nas variáveis de ambiente da Vercel e faça um novo deploy.'
      : 'Defina GEMINI_API_KEY no arquivo .env.local e reinicie o npm run dev.';
    throw new DocumentAssistantError(
      `Análise visual não configurada. ${configurationHint}`,
      503,
    );
  }
  return apiKey;
}

export async function createDocumentUploadSession(
  input: DocumentUploadInput,
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (
    !input.fileName ||
    !allowedTypes.has(input.mimeType) ||
    !Number.isFinite(input.size) ||
    input.size <= 0 ||
    input.size > MAX_DOCUMENT_BYTES
  ) {
    throw new DocumentAssistantError(
      'Arquivo ausente, muito grande ou em formato não compatível com a análise visual.',
      400,
    );
  }

  const uploadResponse = await fetch(
    'https://generativelanguage.googleapis.com/upload/v1beta/files',
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(input.size),
        'X-Goog-Upload-Header-Content-Type': input.mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: input.fileName } }),
    },
  );

  const uploadUrl = uploadResponse.headers.get('x-goog-upload-url');
  if (!uploadResponse.ok || !uploadUrl) {
    console.error(
      'Gemini upload session failed:',
      uploadResponse.status,
      await uploadResponse.text(),
    );
    throw new DocumentAssistantError(
      'Não foi possível preparar o envio ao Gemini. Confira a chave, a cota e os logs da função na Vercel.',
      502,
    );
  }

  return uploadUrl;
}

export async function analyzeDocument(
  input: DocumentAnalysisInput,
): Promise<VisualDocumentAnalysis> {
  const apiKey = getGeminiApiKey();
  if (
    (!input.data && !input.fileUri) ||
    (input.fileUri && !input.uploadedFileName) ||
    !input.mimeType ||
    !input.fileName ||
    !allowedTypes.has(input.mimeType)
  ) {
    throw new DocumentAssistantError(
      'Arquivo ausente ou formato não compatível com a análise visual.',
      400,
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const temporaryFileName = /^files\/[a-z0-9-]+$/.test(
    input.uploadedFileName || '',
  )
    ? input.uploadedFileName
    : undefined;

  try {
    if (temporaryFileName) {
      let ready = false;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const uploadedFile = await ai.files.get({ name: temporaryFileName });
        const state = String(uploadedFile.state || '');
        if (state === 'ACTIVE') {
          ready = true;
          break;
        }
        if (state === 'FAILED') {
          throw new Error('O Gemini não conseguiu processar o arquivo enviado.');
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      if (!ready) {
        throw new Error('O Gemini demorou demais para preparar o documento.');
      }
    }

    const result = await ai.models.generateContent({
      model: getGeminiModel(),
      contents: [
        input.fileUri
          ? { fileData: { mimeType: input.mimeType, fileUri: input.fileUri } }
          : { inlineData: { mimeType: input.mimeType, data: input.data! } },
        {
          text: `Analise visualmente este documento financeiro brasileiro. Pode ser foto, PDF, boleto, nota fiscal, comprovante, recibo, extrato ou contrato.
Extraia somente informações realmente legíveis; nunca invente. Use string vazia para campos ilegíveis. Datas em YYYY-MM-DD, competência em YYYY-MM e valor como número sem símbolo.
Empresa selecionada: ${input.companyName || 'não informada'}. Contexto do usuário: ${input.context || 'nenhum'}.
Resuma objetivamente o documento. Em warnings, informe desfoque, corte, reflexo ou campos importantes ilegíveis.`,
        },
      ],
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          additionalProperties: false,
          required: [
            'documentType',
            'supplier',
            'dueDate',
            'expenseType',
            'companyName',
            'documentNumber',
            'amount',
            'currency',
            'competenceMonth',
            'summary',
            'confidence',
            'warnings',
          ],
          properties: {
            documentType: {
              type: 'string',
              enum: [
                'Nota fiscal',
                'Boleto',
                'Comprovante',
                'Extrato',
                'Contrato',
                'Recibo',
                'Relatório',
                'Documento contábil',
                'Outros',
              ],
            },
            supplier: { type: 'string' },
            dueDate: { type: 'string' },
            expenseType: { type: 'string' },
            companyName: { type: 'string' },
            documentNumber: { type: 'string' },
            amount: { type: 'number' },
            currency: { type: 'string' },
            competenceMonth: { type: 'string' },
            summary: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 100 },
            warnings: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    });

    if (!result.text) {
      throw new Error('O modelo não retornou conteúdo.');
    }

    return JSON.parse(result.text) as VisualDocumentAnalysis;
  } catch (error) {
    if (error instanceof DocumentAssistantError) throw error;
    console.error(
      'Document analysis failed:',
      error instanceof Error ? error.message : error,
    );
    throw new DocumentAssistantError(
      'Não foi possível analisar o documento agora. Confira a chave, a cota e os logs da função na Vercel.',
      502,
    );
  } finally {
    if (temporaryFileName) {
      await ai.files.delete({ name: temporaryFileName }).catch((deleteError) =>
        console.warn(
          'Could not delete temporary Gemini file:',
          deleteError instanceof Error ? deleteError.message : deleteError,
        ),
      );
    }
  }
}
