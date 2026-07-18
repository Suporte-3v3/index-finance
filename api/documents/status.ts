import {
  getGeminiModel,
  hasConfiguredGeminiKey,
  MAX_DOCUMENT_BYTES,
} from '../../backend/document-assistant';

export function GET(): Response {
  return Response.json(
    {
      available: hasConfiguredGeminiKey(),
      model: getGeminiModel(),
      maxFileSize: MAX_DOCUMENT_BYTES,
      environment: 'vercel',
      persistentUploads: false,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
