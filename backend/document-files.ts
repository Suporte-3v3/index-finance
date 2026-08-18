import { getDatabaseClient } from "./database.js";

export const MAX_STORED_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const DOCUMENT_FILE_CHUNK_BYTES = 2 * 1024 * 1024;

type DocumentFileProfile = {
  id: string;
  isPlatformAdmin: boolean;
  tenantMemberships: Array<{ tenantId: string; role: string }>;
  companyMemberships: Array<{ companyId: string; role: string; permissions?: string[] }>;
};

export class DocumentFileError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function requiredText(value: unknown, field: string, max: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new DocumentFileError(`Informe ${field}.`);
  }
  const normalized = value.trim();
  if (normalized.length > max) throw new DocumentFileError(`${field} excede o tamanho permitido.`);
  return normalized;
}

function uuid(value: unknown, field: string) {
  const normalized = requiredText(value, field, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new DocumentFileError(`${field} inválido.`);
  }
  return normalized;
}

function canAccessCompany(profile: DocumentFileProfile, company: { id: string; tenantId: string }) {
  return profile.isPlatformAdmin ||
    profile.tenantMemberships.some(({ tenantId, role }) =>
      tenantId === company.tenantId && (role === "BPO_ADMIN" || role === "BPO_TEAM"),
    ) ||
    profile.companyMemberships.some(({ companyId }) => companyId === company.id);
}

function decodeChunk(value: unknown) {
  if (typeof value !== "string" || !value || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new DocumentFileError("Bloco do arquivo inválido.");
  }
  return Buffer.from(value, "base64");
}

export async function storeDocumentFileChunk(profile: DocumentFileProfile, body: any) {
  const fileId = uuid(body?.fileId, "o arquivo");
  const companyId = uuid(body?.companyId, "a empresa");
  const fileName = requiredText(body?.fileName, "o nome do arquivo", 255);
  const mimeType = requiredText(body?.mimeType || "application/octet-stream", "o tipo do arquivo", 150);
  const size = Number(body?.size);
  const chunkIndex = Number(body?.chunkIndex);
  const totalChunks = Number(body?.totalChunks);
  if (!Number.isInteger(size) || size <= 0 || size > MAX_STORED_DOCUMENT_BYTES) {
    throw new DocumentFileError("O arquivo deve ter no máximo 20 MB.");
  }
  const expectedTotalChunks = Math.ceil(size / DOCUMENT_FILE_CHUNK_BYTES);
  if (!Number.isInteger(totalChunks) || totalChunks !== expectedTotalChunks) {
    throw new DocumentFileError("Quantidade de blocos do arquivo inválida.");
  }
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= totalChunks) {
    throw new DocumentFileError("Índice do bloco inválido.");
  }
  const data = decodeChunk(body?.data);
  const expectedChunkSize = chunkIndex === totalChunks - 1
    ? size - DOCUMENT_FILE_CHUNK_BYTES * chunkIndex
    : DOCUMENT_FILE_CHUNK_BYTES;
  if (data.byteLength !== expectedChunkSize) {
    throw new DocumentFileError("Tamanho do bloco do arquivo inválido.");
  }

  const database = getDatabaseClient();
  const company = await database.company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { id: true, tenantId: true },
  });
  if (!company) throw new DocumentFileError("Empresa não encontrada.", 404);
  if (!canAccessCompany(profile, company)) throw new DocumentFileError("Sem acesso a esta empresa.", 403);

  return database.$transaction(async (tx) => {
    const existing = await tx.documentFile.findUnique({ where: { id: fileId } });
    if (!existing) {
      if (chunkIndex !== 0) throw new DocumentFileError("Envie o primeiro bloco antes dos demais.", 409);
      await tx.documentFile.create({
        data: {
          id: fileId,
          companyId,
          uploadedById: profile.id,
          fileName,
          mimeType,
          sizeBytes: BigInt(size),
          totalChunks,
        },
      });
    } else if (
      existing.companyId !== companyId ||
      existing.uploadedById !== profile.id ||
      existing.fileName !== fileName ||
      existing.mimeType !== mimeType ||
      existing.sizeBytes !== BigInt(size) ||
      existing.totalChunks !== totalChunks
    ) {
      throw new DocumentFileError("Os dados deste envio não correspondem ao arquivo iniciado.", 409);
    }

    await tx.documentFileChunk.upsert({
      where: { fileId_chunkIndex: { fileId, chunkIndex } },
      create: { fileId, chunkIndex, data },
      update: { data },
    });
    const storedChunks = await tx.documentFileChunk.count({ where: { fileId } });
    return {
      url: `/api/document-files/${fileId}`,
      complete: storedChunks === totalChunks,
      storedChunks,
      totalChunks,
    };
  });
}

export async function readDocumentFile(_profile: DocumentFileProfile, fileIdInput: string) {
  const fileId = uuid(fileIdInput, "o arquivo");
  const file = await getDatabaseClient().documentFile.findUnique({
    where: { id: fileId },
    include: { chunks: { orderBy: { chunkIndex: "asc" } } },
  });
  if (!file) throw new DocumentFileError("Arquivo não encontrado.", 404);
  if (file.chunks.length !== file.totalChunks) {
    throw new DocumentFileError("O envio deste arquivo ainda não foi concluído.", 409);
  }
  const data = Buffer.concat(file.chunks.map((chunk) => Buffer.from(chunk.data)));
  if (BigInt(data.byteLength) !== file.sizeBytes) {
    throw new DocumentFileError("O arquivo armazenado está incompleto.", 409);
  }
  return { data, fileName: file.fileName, mimeType: file.mimeType };
}
