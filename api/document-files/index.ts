import { ApiAuthenticationError, requireApiProfile } from '../../backend/api-auth.js';
import { DocumentFileError, storeDocumentFileChunk } from '../../backend/document-files.js';

export async function POST(request: Request): Promise<Response> {
  try {
    const profile = await requireApiProfile(request);
    const input = await request.json();
    return Response.json(await storeDocumentFileChunk(profile, input));
  } catch (error) {
    const status = error instanceof ApiAuthenticationError || error instanceof DocumentFileError
      ? error.status
      : error instanceof SyntaxError
        ? 400
        : 500;
    const message = error instanceof ApiAuthenticationError || error instanceof DocumentFileError
      ? error.message
      : status === 400
        ? 'O corpo da requisição não contém um JSON válido.'
        : 'Não foi possível armazenar o documento.';
    return Response.json({ error: message }, { status });
  }
}
