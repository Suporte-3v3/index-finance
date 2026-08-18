import {
  createDocumentUploadSession,
  DocumentAssistantError,
  DocumentUploadInput,
} from '../../backend/document-assistant.js';
import {
  ApiAuthenticationError,
  requireApiCompanyPermission,
  requireApiProfile,
} from '../../backend/api-auth.js';

export async function POST(request: Request): Promise<Response> {
  let input: DocumentUploadInput;
  try {
    const profile = await requireApiProfile(request);
    input = (await request.json()) as DocumentUploadInput;
    await requireApiCompanyPermission(profile, input.companyId, 'documents.upload');
  } catch (error) {
    const status = error instanceof ApiAuthenticationError
      ? error.status
      : error instanceof SyntaxError
        ? 400
        : 500;
    const message = error instanceof ApiAuthenticationError
      ? error.message
      : status === 400
        ? 'O corpo da requisição não contém um JSON válido.'
        : 'Não foi possível validar o acesso ao assistente.';
    return Response.json({ error: message }, { status });
  }

  try {
    const session = await createDocumentUploadSession(input);
    return Response.json(session);
  } catch (error) {
    const status = error instanceof DocumentAssistantError ? error.status : 500;
    const message =
      error instanceof Error
        ? error.message
        : 'Não foi possível preparar o documento para análise.';
    return Response.json({ error: message }, { status });
  }
}
