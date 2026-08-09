import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "./generated/prisma/client.js";
import { getDatabaseClient } from "./database.js";
import { writeNotification } from "./notifications.js";

type Role = "BPO_ADMIN" | "BPO_TEAM" | "CLIENT" | "ACCOUNTANT";
export interface DocumentProfile {
  id: string;
  isPlatformAdmin: boolean;
  tenantMemberships: Array<{ tenantId: string; role: Role }>;
  companyMemberships: Array<{
    companyId: string;
    role: Role;
    permissions?: string[];
  }>;
}

export class DocumentRecordApiError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const STATUS_FROM_DATABASE = {
  AWAITING_ANALYSIS: "Aguardando Análise",
  AWAITING_APPROVAL: "Aguardando Aprovação",
  SHARED: "Compartilhado",
  POSTED: "Lançado",
  CANCELED: "Cancelado",
} as const;
const STATUS_TO_DATABASE = {
  "Aguardando Análise": "AWAITING_ANALYSIS",
  "Aguardando Aprovação": "AWAITING_APPROVAL",
  Compartilhado: "SHARED",
  Lançado: "POSTED",
  Cancelado: "CANCELED",
} as const;
const APPROVAL_STATUS_FROM_DATABASE = {
  PENDING: "Pendente",
  APPROVED: "Aprovada",
  REJECTED: "Rejeitada",
  CHANGES_REQUESTED: "Ajuste solicitado",
  CANCELED: "Cancelada",
  EXPIRED: "Expirada",
} as const;
const DECISION_TO_DATABASE = {
  Aprovada: "APPROVED",
  Rejeitada: "REJECTED",
  "Ajuste solicitado": "CHANGES_REQUESTED",
} as const;

function text(value: unknown, field: string, max: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new DocumentRecordApiError(`Informe ${field}.`);
  }
  const normalized = value.trim();
  if (normalized.length > max) throw new DocumentRecordApiError(`${field} excede o tamanho permitido.`);
  return normalized;
}
function optionalText(value: unknown, max: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new DocumentRecordApiError("Campo inválido.");
  const normalized = value.trim();
  if (normalized.length > max) throw new DocumentRecordApiError("Campo excede o tamanho permitido.");
  return normalized || null;
}
function uuid(value: unknown, field: string, required = true) {
  const normalized = optionalText(value, 36);
  if (!normalized && !required) return null;
  if (!normalized || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new DocumentRecordApiError(`${field} inválido.`);
  }
  return normalized;
}
function competence(value: unknown) {
  const normalized = optionalText(value, 7);
  if (normalized && !/^\d{4}-(0[1-9]|1[0-2])$/.test(normalized)) {
    throw new DocumentRecordApiError("Competência inválida.");
  }
  return normalized;
}
function fileBytes(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return BigInt(Math.round(value));
  if (typeof value !== "string") return 0n;
  const match = value.replace(",", ".").match(/^([\d.]+)\s*(B|KB|MB|GB)?$/i);
  if (!match) return 0n;
  const units: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
  return BigInt(Math.round(Number(match[1]) * units[(match[2] || "B").toUpperCase()]));
}
function formatSize(value: bigint) {
  const size = Number(value);
  if (size < 1024) return `${size} B`;
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 ** 2).toFixed(1)} MB`;
}
function tenantIds(profile: DocumentProfile) {
  return profile.tenantMemberships
    .filter(({ role }) => role === "BPO_ADMIN" || role === "BPO_TEAM")
    .map(({ tenantId }) => tenantId);
}
function adminTenantIds(profile: DocumentProfile) {
  return profile.tenantMemberships.filter(({ role }) => role === "BPO_ADMIN").map(({ tenantId }) => tenantId);
}
function isBpoForCompany(profile: DocumentProfile, company: { id: string; tenantId: string }) {
  return profile.isPlatformAdmin || adminTenantIds(profile).includes(company.tenantId) || profile.companyMemberships.some(
    ({ companyId, role }) => companyId === company.id && (role === "BPO_ADMIN" || role === "BPO_TEAM"),
  );
}
function hasPermission(profile: DocumentProfile, company: { id: string; tenantId: string }, permission: string) {
  return profile.isPlatformAdmin || adminTenantIds(profile).includes(company.tenantId) || profile.companyMemberships.some(
    (membership) => membership.companyId === company.id &&
      (membership.role === "BPO_ADMIN" || membership.permissions?.includes(permission)),
  );
}
async function requireCompany(profile: DocumentProfile, companyId: string, permission: string) {
  const company = await getDatabaseClient().company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { id: true, tenantId: true },
  });
  if (!company) throw new DocumentRecordApiError("Empresa não encontrada.", 404);
  if (!hasPermission(profile, company, permission)) {
    throw new DocumentRecordApiError("Sem permissão para esta empresa.", 403);
  }
  return company;
}
function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
async function audit(
  tx: Prisma.TransactionClient,
  profile: DocumentProfile,
  company: { id: string; tenantId: string },
  action: string,
  entityId: string,
  previousData: unknown,
  nextData: unknown,
) {
  await tx.auditLog.create({
    data: {
      tenantId: company.tenantId,
      companyId: company.id,
      userId: profile.id,
      action,
      entityType: "Document",
      entityId,
      previousData: previousData == null ? Prisma.JsonNull : asJson(previousData),
      nextData: nextData == null ? Prisma.JsonNull : asJson(nextData),
    },
  });
}

type InternalFields = Record<string, unknown>;
function unpack(value: unknown) {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
  const internal = raw.__idex && typeof raw.__idex === "object"
    ? (raw.__idex as InternalFields)
    : {};
  delete raw.__idex;
  return { extractedData: raw, internal };
}
function pack(extractedData: unknown, internal: InternalFields) {
  const safe = extractedData && typeof extractedData === "object" && !Array.isArray(extractedData)
    ? extractedData as Record<string, unknown>
    : {};
  return { ...safe, __idex: internal } as Prisma.InputJsonValue;
}

const documentInclude = {
  uploadedBy: { select: { name: true } },
  company: { select: { id: true, tenantId: true } },
};
function mapDocument(item: any, users: Map<string, { name: string; role?: Role }> = new Map()) {
  const { extractedData, internal } = unpack(item.extractedData);
  const recipient = item.recipientId ? users.get(item.recipientId) : undefined;
  const sharedById = internal.sharedById as string | undefined;
  const launchedById = internal.launchedById as string | undefined;
  return {
    id: item.id,
    companyId: item.companyId,
    category: item.category,
    name: item.name,
    description: item.description || "",
    competenceMonth: item.competenceMonth || "",
    uploadedAt: item.createdAt.toISOString(),
    uploadedById: item.uploadedById,
    uploadedByName: item.uploadedBy.name,
    recipientId: item.recipientId || undefined,
    recipientName: recipient?.name,
    recipientRole: recipient?.role,
    sharedById,
    sharedByName: sharedById ? users.get(sharedById)?.name : undefined,
    sharedByRole: sharedById ? users.get(sharedById)?.role : undefined,
    sharedAt: internal.sharedAt as string | undefined,
    fileSize: (internal.fileSize as string | undefined) || formatSize(item.fileSizeBytes),
    mimeType: item.mimeType,
    hash: item.sha256,
    relatedEntityId: item.relatedEntityId || undefined,
    status: STATUS_FROM_DATABASE[item.status as keyof typeof STATUS_FROM_DATABASE],
    purpose: item.purpose,
    signedUrl: item.objectKey.startsWith("/uploads/") ? item.objectKey : undefined,
    aiSummary: item.aiSummary || undefined,
    extractedData: Object.keys(extractedData).length ? extractedData : undefined,
    processingConfidence: item.processingConfidence == null ? undefined : Number(item.processingConfidence),
    supplier: internal.supplier as string | undefined,
    dueDate: internal.dueDate as string | undefined,
    expenseType: internal.expenseType as string | undefined,
    documentNumber: internal.documentNumber as string | undefined,
    amount: internal.amount == null ? undefined : Number(internal.amount),
    analysisWarnings: item.analysisWarnings,
    entryType: internal.entryType as string | undefined,
    costCenter: internal.costCenter as string | undefined,
    bankAccountId: internal.bankAccountId as string | undefined,
    destinationBankAccountId: internal.destinationBankAccountId as string | undefined,
    paymentMethod: internal.paymentMethod as string | undefined,
    recurrence: internal.recurrence as string | undefined,
    installmentCount: internal.installmentCount == null ? undefined : Number(internal.installmentCount),
    notes: internal.notes as string | undefined,
    origin: (internal.origin as string | undefined) || "Documento",
    launchedById,
    launchedByName: launchedById ? users.get(launchedById)?.name : undefined,
    launchedAt: internal.launchedAt as string | undefined,
  };
}

const approvalInclude = {
  requester: { select: { name: true } },
  steps: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" as const } },
};
function mapApproval(item: any, users: Map<string, { name: string; role?: Role }> = new Map()) {
  const recipient = item.recipientId ? users.get(item.recipientId) : undefined;
  return {
    id: item.id,
    companyId: item.companyId,
    type: "DOCUMENTO",
    relatedId: item.relatedEntityId,
    description: item.description,
    amount: Number(item.amount || 0),
    dueDate: item.dueDate?.toISOString().slice(0, 10) || "",
    requesterId: item.requesterId,
    requesterName: item.requester.name,
    requesterRole: users.get(item.requesterId)?.role,
    recipientId: item.recipientId || undefined,
    recipientName: recipient?.name,
    recipientRole: recipient?.role,
    dueDateApproval: item.approvalDeadline?.toISOString() || item.createdAt.toISOString(),
    status: APPROVAL_STATUS_FROM_DATABASE[item.status as keyof typeof APPROVAL_STATUS_FROM_DATABASE],
    justification: item.justification || undefined,
    attachmentUrl: item.attachmentObjectKey?.startsWith("/uploads/") ? item.attachmentObjectKey : undefined,
    createdAt: item.createdAt.toISOString(),
    history: item.steps.map((step: any) => ({
      id: step.id,
      userId: step.userId,
      userName: step.user.name,
      role: step.role,
      decision: APPROVAL_STATUS_FROM_DATABASE[step.decision as keyof typeof APPROVAL_STATUS_FROM_DATABASE],
      comment: step.comment || "",
      timestamp: step.createdAt.toISOString(),
      ipAddress: step.ipAddress || "",
      userAgent: step.userAgent || "",
    })),
  };
}

async function userMap(ids: Array<string | null | undefined>) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const rows = await getDatabaseClient().user.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      name: true,
      tenantMemberships: { where: { status: "ACTIVE" }, select: { role: true } },
      companyMemberships: { where: { status: "ACTIVE" }, select: { role: true } },
    },
  });
  return new Map(rows.map((row) => [row.id, {
    name: row.name,
    role: (row.companyMemberships[0]?.role || row.tenantMemberships[0]?.role) as Role | undefined,
  }]));
}

function internalFromBody(body: any, previous: InternalFields = {}) {
  const keys = [
    "supplier", "dueDate", "expenseType", "documentNumber", "amount", "entryType",
    "costCenter", "bankAccountId", "destinationBankAccountId", "paymentMethod",
    "recurrence", "installmentCount", "notes", "origin", "sharedById", "sharedAt",
    "launchedById", "launchedAt", "fileSize",
  ];
  const next = { ...previous };
  for (const key of keys) {
    if (body[key] !== undefined) next[key] = body[key] === "" ? undefined : body[key];
  }
  return next;
}

async function validateRecipient(companyId: string, userId: string, approvalOnly: boolean) {
  const membership = await getDatabaseClient().companyMembership.findFirst({
    where: {
      companyId,
      userId,
      status: "ACTIVE",
      role: approvalOnly ? "CLIENT" : { in: ["CLIENT", "ACCOUNTANT"] },
    },
    select: { userId: true },
  });
  if (!membership) throw new DocumentRecordApiError("Destinatário inválido para esta empresa.");
  return membership.userId;
}

export async function listDocuments(profile: DocumentProfile) {
  const companies = await getDatabaseClient().company.findMany({
    where: profile.isPlatformAdmin ? { deletedAt: null } : {
      deletedAt: null,
      OR: [
        { tenantId: { in: tenantIds(profile) } },
        { id: { in: profile.companyMemberships.map(({ companyId }) => companyId) } },
      ],
    },
    select: { id: true, tenantId: true },
  });
  const companyById = new Map(companies.map((company) => [company.id, company]));
  let documents = await getDatabaseClient().document.findMany({
    where: { companyId: { in: companies.map(({ id }) => id) }, deletedAt: null },
    include: documentInclude,
    orderBy: { createdAt: "desc" },
  });
  documents = documents.filter((document) => {
    const company = companyById.get(document.companyId)!;
    return isBpoForCompany(profile, company) || document.uploadedById === profile.id || document.recipientId === profile.id;
  });
  let approvals = await getDatabaseClient().approval.findMany({
    where: { companyId: { in: companies.map(({ id }) => id) }, type: "DOCUMENT" },
    include: approvalInclude,
    orderBy: { createdAt: "desc" },
  });
  approvals = approvals.filter((item) => item.requesterId === profile.id || item.recipientId === profile.id || isBpoForCompany(profile, companyById.get(item.companyId)!));
  const users = await userMap([
    ...documents.flatMap((item) => {
      const { internal } = unpack(item.extractedData);
      return [item.uploadedById, item.recipientId, internal.sharedById as string, internal.launchedById as string];
    }),
    ...approvals.flatMap((item) => [item.requesterId, item.recipientId, ...item.steps.map((step) => step.userId)]),
  ]);
  return {
    documents: documents.map((item) => mapDocument(item, users)),
    documentApprovals: approvals.map((item) => mapApproval(item, users)),
  };
}

export async function createDocument(profile: DocumentProfile, body: any) {
  const companyId = uuid(body?.companyId, "Empresa")!;
  const company = await requireCompany(profile, companyId, "documents.upload");
  const shareRecipientId = uuid(body?.recipientId, "Destinatário", false);
  const approvalRecipientId = uuid(body?.approvalRecipientId, "Destinatário da aprovação", false);
  if (shareRecipientId && approvalRecipientId) throw new DocumentRecordApiError("Selecione apenas uma finalidade de envio.");
  const recipientId = shareRecipientId
    ? await validateRecipient(companyId, shareRecipientId, false)
    : approvalRecipientId
      ? await validateRecipient(companyId, approvalRecipientId, true)
      : null;
  const previewUrl = optionalText(body?.previewUrl, 5_000_000);
  const objectKey = previewUrl?.startsWith("/uploads/") ? previewUrl : `metadata/${randomUUID()}`;
  const sha256 = /^[0-9a-f]{64}$/i.test(body?.hash || "")
    ? body.hash.toLowerCase()
    : createHash("sha256").update(`${companyId}:${objectKey}:${randomUUID()}`).digest("hex");
  const shared = Boolean(recipientId);
  const internal = internalFromBody({
    ...body,
    origin: body?.origin || "Documento",
    ...(shared ? { sharedById: profile.id, sharedAt: new Date().toISOString() } : {}),
  });
  const database = getDatabaseClient();
  return database.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        companyId,
        category: text(body?.category, "a categoria", 80),
        name: text(body?.name, "o nome do arquivo", 255),
        description: optionalText(body?.description, 20_000),
        competenceMonth: competence(body?.competenceMonth),
        uploadedById: profile.id,
        recipientId,
        objectKey,
        fileSizeBytes: fileBytes(body?.fileSizeBytes ?? body?.fileSize),
        mimeType: text(body?.mimeType || "application/octet-stream", "o tipo do arquivo", 150),
        sha256,
        status: shareRecipientId ? "SHARED" : approvalRecipientId ? "AWAITING_APPROVAL" : "AWAITING_ANALYSIS",
        purpose: shareRecipientId ? "VIEW_ONLY" : "PROCESSING",
        aiSummary: optionalText(body?.aiSummary, 20_000),
        extractedData: pack(body?.extractedData, internal),
        processingConfidence: body?.processingConfidence == null ? null : Number(body.processingConfidence),
        analysisWarnings: Array.isArray(body?.analysisWarnings)
          ? body.analysisWarnings.filter((item: unknown): item is string => typeof item === "string").slice(0, 100)
          : [],
      },
      include: documentInclude,
    });
    let approval = null;
    if (approvalRecipientId) {
      approval = await tx.approval.create({
        data: {
          companyId,
          type: "DOCUMENT",
          relatedEntityType: "Document",
          relatedEntityId: document.id,
          description: document.description || document.name,
          amount: internal.amount == null ? null : Number(internal.amount),
          dueDate: typeof internal.dueDate === "string" ? new Date(`${internal.dueDate}T00:00:00.000Z`) : null,
          requesterId: profile.id,
          recipientId: approvalRecipientId,
          approvalDeadline: typeof internal.dueDate === "string" ? new Date(`${internal.dueDate}T23:59:59.999Z`) : null,
          attachmentObjectKey: objectKey,
        },
        include: approvalInclude,
      });
    }
    await audit(tx, profile, company, "CRIAR_DOCUMENTO", document.id, null, { name: document.name, status: document.status });
    await writeNotification(tx, {
      companyId: company.id,
      userId: recipientId || undefined,
      title: "Novo documento",
      message: `${document.name} foi adicionado à Central de Documentos.`,
      type: "INFO",
    });
    const users = await userMap([profile.id, recipientId]);
    return { document: mapDocument(document, users), approval: approval ? mapApproval(approval, users) : undefined };
  });
}

export async function updateDocument(profile: DocumentProfile, documentId: string, body: any) {
  const database = getDatabaseClient();
  const existing = await database.document.findFirst({
    where: { id: uuid(documentId, "Documento")!, deletedAt: null },
    include: documentInclude,
  });
  if (!existing) throw new DocumentRecordApiError("Documento não encontrado.", 404);
  const company = await requireCompany(profile, existing.companyId, "documents.upload");
  if (!isBpoForCompany(profile, company) && existing.uploadedById !== profile.id) {
    throw new DocumentRecordApiError("Sem permissão para alterar este documento.", 403);
  }
  const unpacked = unpack(existing.extractedData);
  const data: Record<string, unknown> = {};
  if (body.category !== undefined) data.category = text(body.category, "a categoria", 80);
  if (body.name !== undefined) data.name = text(body.name, "o nome", 255);
  if (body.description !== undefined) data.description = optionalText(body.description, 20_000);
  if (body.competenceMonth !== undefined) data.competenceMonth = competence(body.competenceMonth);
  if (body.aiSummary !== undefined) data.aiSummary = optionalText(body.aiSummary, 20_000);
  if (body.processingConfidence !== undefined) data.processingConfidence = body.processingConfidence == null ? null : Number(body.processingConfidence);
  if (body.analysisWarnings !== undefined && Array.isArray(body.analysisWarnings)) data.analysisWarnings = body.analysisWarnings.filter((item: unknown): item is string => typeof item === "string").slice(0, 100);
  if (body.relatedEntityId !== undefined) {
    data.relatedEntityId = uuid(body.relatedEntityId, "Vínculo financeiro", false);
    data.relatedEntityType = body.entryType === "Conta a Receber" ? "AccountReceivable" : "AccountPayable";
  }
  if (body.status !== undefined) {
    const status = STATUS_TO_DATABASE[body.status as keyof typeof STATUS_TO_DATABASE];
    if (!status) throw new DocumentRecordApiError("Status inválido.");
    data.status = status;
    if (status === "CANCELED") data.canceledAt = new Date();
  }
  data.extractedData = pack(
    body.extractedData === undefined ? unpacked.extractedData : body.extractedData,
    internalFromBody(body, unpacked.internal),
  );
  return database.$transaction(async (tx) => {
    const updated = await tx.document.update({ where: { id: existing.id }, data, include: documentInclude });
    await audit(tx, profile, company, "ATUALIZAR_DOCUMENTO", existing.id, { status: existing.status }, { status: updated.status });
    await writeNotification(tx, {
      companyId: company.id,
      title: "Documento atualizado",
      message: `${updated.name} foi atualizado.`,
      type: "INFO",
    });
    const { internal } = unpack(updated.extractedData);
    const users = await userMap([updated.uploadedById, updated.recipientId, internal.sharedById as string, internal.launchedById as string]);
    return mapDocument(updated, users);
  });
}

export async function submitDocumentApproval(profile: DocumentProfile, documentId: string, body: any) {
  const database = getDatabaseClient();
  const existing = await database.document.findFirst({
    where: { id: uuid(documentId, "Documento")!, deletedAt: null },
    include: documentInclude,
  });
  if (!existing) throw new DocumentRecordApiError("Documento não encontrado.", 404);
  const company = await requireCompany(profile, existing.companyId, "approvals.request");
  if (!isBpoForCompany(profile, company)) throw new DocumentRecordApiError("Somente a equipe BPO pode solicitar esta aprovação.", 403);
  if (existing.status !== "AWAITING_ANALYSIS") throw new DocumentRecordApiError("Documento indisponível para aprovação.", 409);
  const recipientId = await validateRecipient(existing.companyId, uuid(body?.recipientId, "Destinatário")!, true);
  const unpacked = unpack(existing.extractedData);
  const nextInternal = internalFromBody(
    { ...body, sharedById: profile.id, sharedAt: new Date().toISOString() },
    unpacked.internal,
  );
  return database.$transaction(async (tx) => {
    const document = await tx.document.update({
      where: { id: existing.id },
      data: {
        recipientId,
        status: "AWAITING_APPROVAL",
        extractedData: pack(body?.extractedData ?? unpacked.extractedData, nextInternal),
      },
      include: documentInclude,
    });
    const approval = await tx.approval.create({
      data: {
        companyId: existing.companyId,
        type: "DOCUMENT",
        relatedEntityType: "Document",
        relatedEntityId: existing.id,
        description: document.description || document.name,
        amount: nextInternal.amount == null ? null : Number(nextInternal.amount),
        dueDate: typeof nextInternal.dueDate === "string" ? new Date(`${nextInternal.dueDate}T00:00:00.000Z`) : null,
        requesterId: profile.id,
        recipientId,
        approvalDeadline: typeof nextInternal.dueDate === "string" ? new Date(`${nextInternal.dueDate}T23:59:59.999Z`) : null,
        attachmentObjectKey: existing.objectKey,
      },
      include: approvalInclude,
    });
    await audit(tx, profile, company, "SOLICITAR_APROVACAO_DOCUMENTO", existing.id, { status: existing.status }, { status: document.status, recipientId });
    await writeNotification(tx, {
      companyId: company.id,
      userId: recipientId,
      title: "Aprovação de documento solicitada",
      message: `${document.name} aguarda sua aprovação.`,
      type: "WARNING",
    });
    const users = await userMap([profile.id, recipientId]);
    return { document: mapDocument(document, users), approval: mapApproval(approval, users) };
  });
}

export async function decideDocumentApproval(profile: DocumentProfile, approvalId: string, body: any) {
  const decision = DECISION_TO_DATABASE[body?.decision as keyof typeof DECISION_TO_DATABASE];
  if (!decision) throw new DocumentRecordApiError("Decisão inválida.");
  const database = getDatabaseClient();
  const existing = await database.approval.findFirst({
    where: { id: uuid(approvalId, "Aprovação")!, type: "DOCUMENT" },
    include: { ...approvalInclude, company: { select: { id: true, tenantId: true } } },
  });
  if (!existing) throw new DocumentRecordApiError("Aprovação não encontrada.", 404);
  if (existing.recipientId !== profile.id) throw new DocumentRecordApiError("Esta aprovação pertence a outro usuário.", 403);
  if (existing.status !== "PENDING") throw new DocumentRecordApiError("Esta aprovação já foi decidida.", 409);
  const role = profile.companyMemberships.find(({ companyId }) => companyId === existing.companyId)?.role;
  if (role !== "CLIENT") throw new DocumentRecordApiError("Apenas o cliente destinatário pode decidir.", 403);
  const documentStatus = decision === "APPROVED" ? "POSTED" : decision === "REJECTED" ? "CANCELED" : "AWAITING_ANALYSIS";
  return database.$transaction(async (tx) => {
    await tx.approvalStep.create({
      data: { approvalId: existing.id, userId: profile.id, role, decision, comment: optionalText(body?.comment, 10_000) },
    });
    const approval = await tx.approval.update({
      where: { id: existing.id },
      data: { status: decision, justification: optionalText(body?.comment, 10_000) },
      include: approvalInclude,
    });
    const document = await tx.document.update({
      where: { id: existing.relatedEntityId },
      data: { status: documentStatus, canceledAt: documentStatus === "CANCELED" ? new Date() : null },
      include: documentInclude,
    });
    await audit(tx, profile, existing.company, "DECIDIR_APROVACAO_DOCUMENTO", document.id, { status: "AWAITING_APPROVAL" }, { status: documentStatus, decision });
    await writeNotification(tx, {
      companyId: existing.companyId,
      userId: existing.requesterId,
      title: "Aprovação de documento decidida",
      message: `${document.name} foi ${
        decision === "APPROVED" ? "aprovado" : decision === "REJECTED" ? "rejeitado" : "marcado para ajuste"
      }.`,
      type: decision === "APPROVED" ? "SUCCESS" : decision === "REJECTED" ? "ALERT" : "WARNING",
    });
    const users = await userMap([existing.requesterId, existing.recipientId]);
    return { document: mapDocument(document, users), approval: mapApproval(approval, users) };
  });
}

export async function deleteDocument(profile: DocumentProfile, documentId: string) {
  const database = getDatabaseClient();
  const existing = await database.document.findFirst({
    where: { id: uuid(documentId, "Documento")!, deletedAt: null },
    include: documentInclude,
  });
  if (!existing) throw new DocumentRecordApiError("Documento não encontrado.", 404);
  const company = await requireCompany(profile, existing.companyId, "documents.upload");
  if (!isBpoForCompany(profile, company) && existing.uploadedById !== profile.id) {
    throw new DocumentRecordApiError("Sem permissão para excluir este documento.", 403);
  }
  await database.$transaction(async (tx) => {
    await tx.document.update({ where: { id: existing.id }, data: { deletedAt: new Date(), status: "CANCELED", canceledAt: new Date() } });
    await tx.approval.updateMany({ where: { relatedEntityType: "Document", relatedEntityId: existing.id, status: "PENDING" }, data: { status: "CANCELED" } });
    await audit(tx, profile, company, "EXCLUIR_DOCUMENTO", existing.id, { name: existing.name }, null);
    await writeNotification(tx, {
      companyId: company.id,
      title: "Documento excluído",
      message: `${existing.name} foi excluído.`,
      type: "WARNING",
    });
  });
}
