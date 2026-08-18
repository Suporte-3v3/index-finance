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

function isBpoForCompany(profile: DocumentFileProfile, company: { id: string; tenantId: string }) {
  return profile.isPlatformAdmin ||
    profile.tenantMemberships.some(({ tenantId, role }) =>
      tenantId === company.tenantId && (role === "BPO_ADMIN" || role === "BPO_TEAM"),
    ) ||
    profile.companyMemberships.some(({ companyId, role }) =>
      companyId === company.id && (role === "BPO_ADMIN" || role === "BPO_TEAM"),
    );
}

function hasCompanyPermission(
  profile: DocumentFileProfile,
  company: { id: string; tenantId: string },
  permission: string,
) {
  return profile.isPlatformAdmin ||
    profile.tenantMemberships.some(({ tenantId, role }) =>
      tenantId === company.tenantId && role === "BPO_ADMIN",
    ) ||
    profile.companyMemberships.some(({ companyId, role, permissions }) =>
      companyId === company.id && (role === "BPO_ADMIN" || permissions?.includes(permission)),
    );
}

function belongsToCompany(profile: DocumentFileProfile, companyId: string) {
  return profile.companyMemberships.some((membership) => membership.companyId === companyId);
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
  if (!hasCompanyPermission(profile, company, "documents.upload")) {
    throw new DocumentFileError("Sem permissão para enviar documentos nesta empresa.", 403);
  }

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

async function canReadObjectKey(profile: DocumentFileProfile, objectKey: string) {
  const database = getDatabaseClient();
  const documents = await database.document.findMany({
    where: { objectKey, deletedAt: null },
    include: { company: { select: { id: true, tenantId: true } } },
  });
  const reports = await database.report.findMany({
    where: { objectKey },
    include: { company: { select: { id: true, tenantId: true } } },
  });
  if (documents.length || reports.length) {
    return documents.some((document) =>
      isBpoForCompany(profile, document.company) ||
      (belongsToCompany(profile, document.companyId) &&
        (document.uploadedById === profile.id || document.recipientId === profile.id)),
    ) || reports.some((report) =>
      isBpoForCompany(profile, report.company) ||
      (belongsToCompany(profile, report.companyId) &&
        (report.generatedById === profile.id || report.recipientId === profile.id)),
    );
  }
  const messages = await database.supportMessage.findMany({
    where: { attachments: { not: { equals: null } } },
    include: {
      ticket: { include: { company: { select: { id: true, tenantId: true } } } },
    },
  });
  const message = messages.find((item) =>
    Array.isArray(item.attachments) && item.attachments.some((attachment) =>
      attachment && typeof attachment === "object" &&
      (attachment as Record<string, unknown>).url === objectKey,
    ),
  );
  return Boolean(message &&
    (isBpoForCompany(profile, message.ticket.company) || message.ticket.requesterId === profile.id));
}

export async function validateDocumentFileReference(
  profile: DocumentFileProfile,
  companyId: string,
  objectKey: string,
) {
  const match = objectKey.match(/^\/api\/document-files\/([0-9a-f-]{36})$/i);
  if (!match) return;
  const file = await getDatabaseClient().documentFile.findUnique({
    where: { id: match[1] },
    include: { _count: { select: { chunks: true } } },
  });
  if (
    !file ||
    file.companyId !== companyId ||
    file.uploadedById !== profile.id ||
    file._count.chunks !== file.totalChunks
  ) {
    throw new DocumentFileError("O arquivo informado não pertence a este envio.", 403);
  }
}

export async function authorizeLegacyDocumentFile(profile: DocumentFileProfile, objectKey: string) {
  if (!/^\/uploads\/[0-9]+-[0-9a-f-]{36}(\.[a-z0-9]{1,9})?$/i.test(objectKey)) {
    throw new DocumentFileError("Arquivo inválido.", 400);
  }
  if (!await canReadObjectKey(profile, objectKey)) {
    throw new DocumentFileError("Sem permissão para abrir este arquivo.", 403);
  }
}

export async function authorizeLegacyFileUpload(profile: DocumentFileProfile, body: any) {
  if (body?.purpose === "REPORT") {
    const companyId = uuid(body?.companyId, "a empresa");
    const company = await getDatabaseClient().company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { id: true, tenantId: true },
    });
    if (!company || !hasCompanyPermission(profile, company, "reports.generate")) {
      throw new DocumentFileError("Sem permissão para armazenar este relatório.", 403);
    }
    return;
  }
  if (body?.purpose === "SUPPORT") {
    const ticketId = uuid(body?.ticketId, "o chamado");
    const ticket = await getDatabaseClient().supportTicket.findUnique({
      where: { id: ticketId },
      include: { company: { select: { id: true, tenantId: true } } },
    });
    if (!ticket || (!isBpoForCompany(profile, ticket.company) && ticket.requesterId !== profile.id)) {
      throw new DocumentFileError("Sem permissão para anexar arquivos a este chamado.", 403);
    }
    return;
  }
  if (body?.purpose === "BACKUP") {
    const isAdministrator = profile.isPlatformAdmin ||
      profile.tenantMemberships.some(({ role }) => role === "BPO_ADMIN");
    if (!isAdministrator) throw new DocumentFileError("Sem permissão para restaurar arquivos.", 403);
    return;
  }
  throw new DocumentFileError("Finalidade do arquivo inválida.", 400);
}

export async function readDocumentFile(profile: DocumentFileProfile, fileIdInput: string) {
  const fileId = uuid(fileIdInput, "o arquivo");
  const file = await getDatabaseClient().documentFile.findUnique({
    where: { id: fileId },
    include: { chunks: { orderBy: { chunkIndex: "asc" } } },
  });
  if (!file) throw new DocumentFileError("Arquivo não encontrado.", 404);
  const objectKey = `/api/document-files/${file.id}`;
  if (!await canReadObjectKey(profile, objectKey) && file.uploadedById !== profile.id) {
    throw new DocumentFileError("Sem permissão para abrir este arquivo.", 403);
  }
  if (file.chunks.length !== file.totalChunks) {
    throw new DocumentFileError("O envio deste arquivo ainda não foi concluído.", 409);
  }
  const data = Buffer.concat(file.chunks.map((chunk) => Buffer.from(chunk.data)));
  if (BigInt(data.byteLength) !== file.sizeBytes) {
    throw new DocumentFileError("O arquivo armazenado está incompleto.", 409);
  }
  return { data, fileName: file.fileName, mimeType: file.mimeType };
}
