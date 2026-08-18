import {
  getGeminiModel,
  hasConfiguredGeminiKey,
  MAX_DOCUMENT_BYTES,
} from '../../backend/document-assistant.js';
import { ApiAuthenticationError, requireApiProfile } from '../../backend/api-auth.js';

export async function GET(request: Request): Promise<Response> {
  try {
    await requireApiProfile(request);
    return Response.json(
      {
        available: hasConfiguredGeminiKey(),
        model: getGeminiModel(),
        maxFileSize: MAX_DOCUMENT_BYTES,
        environment: 'vercel',
        persistentUploads: true,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const status = error instanceof ApiAuthenticationError ? error.status : 500;
    const message = error instanceof ApiAuthenticationError
      ? error.message
      : 'Não foi possível consultar o assistente.';
    return Response.json({ error: message }, { status });
  }
}
