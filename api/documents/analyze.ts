import {
  analyzeDocument,
  DocumentAssistantError,
  DocumentAnalysisInput,
} from '../../backend/document-assistant.js';

export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  let input: DocumentAnalysisInput;
  try {
    input = (await request.json()) as DocumentAnalysisInput;
  } catch {
    return Response.json(
      { error: 'O corpo da requisição não contém um JSON válido.' },
      { status: 400 },
    );
  }

  try {
    const analysis = await analyzeDocument(input);
    return Response.json({ analysis, source: 'gemini' });
  } catch (error) {
    const status = error instanceof DocumentAssistantError ? error.status : 500;
    const message =
      error instanceof Error
        ? error.message
        : 'Não foi possível analisar o documento agora.';
    return Response.json({ error: message }, { status });
  }
}
