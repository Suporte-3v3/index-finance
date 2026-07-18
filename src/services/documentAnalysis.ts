import { Document } from '../types';

export interface VisualDocumentAnalysis {
  documentType: Document['category']; supplier: string; dueDate: string; expenseType: string;
  companyName: string; documentNumber: string; amount: number; currency: string;
  competenceMonth: string; summary: string; confidence: number; warnings: string[];
}

interface GeminiUploadedFile {
  file?: {
    name?: string;
    uri?: string;
  };
  error?: { message?: string };
}

function inferMimeType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic') return 'image/heic';
  if (extension === 'heif') return 'image/heif';
  return file.type;
}

async function prepareFileForGemini(file: File): Promise<{
  fileUri: string;
  uploadedFileName: string;
  mimeType: string;
}> {
  const mimeType = inferMimeType(file);
  const sessionResponse = await fetch('/api/documents/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      mimeType,
      size: file.size,
    }),
  });
  const session = (await sessionResponse.json()) as {
    uploadUrl?: string;
    error?: string;
  };
  if (!sessionResponse.ok || !session.uploadUrl) {
    throw new Error(
      session.error || 'Não foi possível preparar o arquivo para análise.',
    );
  }

  const uploadResponse = await fetch(session.uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': mimeType,
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: file,
  });
  const uploaded = (await uploadResponse.json()) as GeminiUploadedFile;
  if (!uploadResponse.ok || !uploaded.file?.uri || !uploaded.file.name) {
    throw new Error(
      uploaded.error?.message || 'O Gemini não recebeu o arquivo para análise.',
    );
  }

  return {
    fileUri: uploaded.file.uri,
    uploadedFileName: uploaded.file.name,
    mimeType,
  };
}

export async function analyzeDocumentVisually(file: File, companyName: string, context: string): Promise<VisualDocumentAnalysis> {
  let result: Response;
  try {
    const uploaded = await prepareFileForGemini(file);
    result = await fetch('/api/documents/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...uploaded, fileName: file.name, companyName, context })
    });
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Servidor de análise visual indisponível.');
  }

  const responseText = await result.text();
  if (!responseText.trim()) {
    throw new Error(`O servidor de análise respondeu sem conteúdo (HTTP ${result.status}).`);
  }

  let payload: { analysis?: VisualDocumentAnalysis; error?: string };
  try {
    payload = JSON.parse(responseText) as typeof payload;
  } catch {
    throw new Error('A rota de análise visual não está ativa neste deploy.');
  }

  if (!result.ok || !payload.analysis) {
    throw new Error(payload.error || `Falha na análise visual (HTTP ${result.status}).`);
  }
  return payload.analysis;
}
