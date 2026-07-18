import {
  createDocumentUploadSession,
  DocumentAssistantError,
  DocumentUploadInput,
} from '../../backend/document-assistant.js';

export async function POST(request: Request): Promise<Response> {
  let input: DocumentUploadInput;
  try {
    input = (await request.json()) as DocumentUploadInput;
  } catch {
    return Response.json(
      { error: 'O corpo da requisição não contém um JSON válido.' },
      { status: 400 },
    );
  }

  try {
    const uploadUrl = await createDocumentUploadSession(input);
    return Response.json({ uploadUrl });
  } catch (error) {
    const status = error instanceof DocumentAssistantError ? error.status : 500;
    const message =
      error instanceof Error
        ? error.message
        : 'Não foi possível preparar o documento para análise.';
    return Response.json({ error: message }, { status });
  }
}
