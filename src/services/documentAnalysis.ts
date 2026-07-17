import { Document } from '../types';

export interface VisualDocumentAnalysis {
  documentType: Document['category']; supplier: string; dueDate: string; expenseType: string;
  companyName: string; documentNumber: string; amount: number; currency: string;
  competenceMonth: string; summary: string; confidence: number; warnings: string[];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

export async function analyzeDocumentVisually(file: File, companyName: string, context: string): Promise<VisualDocumentAnalysis> {
  let result: Response;
  try {
    result = await fetch('/api/documents/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: await fileToBase64(file), mimeType: file.type, fileName: file.name, companyName, context })
    });
  } catch {
    throw new Error('Servidor de análise visual indisponível. Inicie o sistema com “npm run dev”.');
  }

  const responseText = await result.text();
  if (!responseText.trim()) {
    throw new Error(`O servidor de análise respondeu sem conteúdo (HTTP ${result.status}).`);
  }

  let payload: { analysis?: VisualDocumentAnalysis; error?: string };
  try {
    payload = JSON.parse(responseText) as typeof payload;
  } catch {
    throw new Error('A rota de análise visual não está ativa neste ambiente. Reinicie usando “npm run dev”.');
  }

  if (!result.ok || !payload.analysis) {
    if (result.status === 503) throw new Error('Análise visual não configurada. Defina GEMINI_API_KEY no arquivo .env.local e reinicie o servidor.');
    throw new Error(payload.error || `Falha na análise visual (HTTP ${result.status}).`);
  }
  return payload.analysis;
}
