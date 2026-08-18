import { ApiAuthenticationError, requireApiProfile } from '../../backend/api-auth.js';
import { DocumentFileError, readDocumentFile } from '../../backend/document-files.js';

type RouteContext = { params: { fileId: string } };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const profile = await requireApiProfile(request);
    const file = await readDocumentFile(profile, context.params.fileId);
    return new Response(new Uint8Array(file.data), {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Length': String(file.data.byteLength),
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    const status = error instanceof ApiAuthenticationError || error instanceof DocumentFileError
      ? error.status
      : 500;
    const message = error instanceof ApiAuthenticationError || error instanceof DocumentFileError
      ? error.message
      : 'Não foi possível abrir o documento.';
    return Response.json({ error: message }, { status });
  }
}
