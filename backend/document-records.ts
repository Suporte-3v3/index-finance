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
function confidenceForDatabase(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const percentage = Number(value);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new DocumentRecordApiError("Confiança da análise inválida.");
  }
  return percentage / 100;
}
function confidenceFromDatabase(value: unknown) {
  if (value === undefined || value === null) return undefined;
  return Number((Number(value) * 100).toFixed(2));
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

const RECURRENCE_FOR_APPROVED_DOCUMENT = {
  Nenhuma: "NONE",
  Semanal: "WEEKLY",
  Mensal: "MONTHLY",
  Trimestral: "QUARTERLY",
  Anual: "ANNUAL",
  Parcelada: "INSTALLMENTS",
} as const;

function approvedDocumentMoney(value: unknown, field: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999_999_999_999_999) {
    throw new DocumentRecordApiError(`${field} inválido.`);
  }
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function approvedDocumentDate(value: unknown, fallback: Date, field: string) {
  const normalized = typeof value === "string" && value ? value : fallback.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new DocumentRecordApiError(`${field} inválida.`);
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new DocumentRecordApiError(`${field} inválida.`);
  }
  return parsed;
}

function addApprovalMonths(value: Date, months: number) {
  const next = new Date(value);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

function approvedDocumentSlices(total: number, dueDate: Date, recurrence: string, countInput: unknown) {
  if (recurrence !== "INSTALLMENTS") {
    return [{ amount: total, dueDate, groupId: null, number: null, count: null }];
  }
  const count = Math.floor(Number(countInput));
  if (!Number.isInteger(count) || count < 2 || count > 360) {
    throw new DocumentRecordApiError("A quantidade de parcelas deve estar entre 2 e 360.");
  }
  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents - baseCents * count;
  const groupId = randomUUID();
  return Array.from({ length: count }, (_, index) => ({
    amount: (baseCents + (index < remainder ? 1 : 0)) / 100,
    dueDate: addApprovalMonths(dueDate, index),
    groupId,
    number: index + 1,
    count,
  }));
}

function approvalLaunchPermission(internal: InternalFields) {
  return internal.entryType === "Conta a Receber"
    ? "accounts-receivable.create"
    : internal.entryType === "Transferência"
      ? null
      : "accounts-payable.create";
}

function requireApprovalLaunchPermission(
  profile: DocumentProfile,
  company: { id: string; tenantId: string },
  internal: InternalFields,
) {
  const permission = approvalLaunchPermission(internal);
  if (permission && !hasPermission(profile, company, permission)) {
    throw new DocumentRecordApiError("Sem permissão para criar o lançamento financeiro desta aprovação.", 403);
  }
}

async function postApprovedDocument(
  tx: Prisma.TransactionClient,
  document: any,
  requesterId: string,
) {
  const { extractedData, internal } = unpack(document.extractedData);
  const entryType = internal.entryType === "Conta a Receber"
    ? "Conta a Receber"
    : internal.entryType === "Transferência"
      ? "Transferência"
      : "Conta a Pagar";
  const amount = approvedDocumentMoney(internal.amount, "Valor");
  const dueDate = approvedDocumentDate(internal.dueDate, document.createdAt, "Data de vencimento");
  const competenceMonth = typeof document.competenceMonth === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(document.competenceMonth)
    ? document.competenceMonth
    : dueDate.toISOString().slice(0, 7);
  const description = document.description || document.aiSummary || document.name;
  const category = typeof internal.expenseType === "string" && internal.expenseType.trim()
    ? internal.expenseType.trim()
    : document.category;
  const costCenter = typeof internal.costCenter === "string" && internal.costCenter.trim()
    ? internal.costCenter.trim()
    : "A classificar";
  const paymentMethod = typeof internal.paymentMethod === "string" && internal.paymentMethod.trim()
    ? internal.paymentMethod.trim()
    : "A definir";
  const bankAccountId = typeof internal.bankAccountId === "string" && internal.bankAccountId
    ? internal.bankAccountId
    : null;
  if (bankAccountId) {
    const bank = await tx.bankAccount.findFirst({
      where: { id: bankAccountId, companyId: document.companyId, active: true, deletedAt: null },
      select: { id: true },
    });
    if (!bank) throw new DocumentRecordApiError("Conta bancária inválida para esta empresa.");
  }

  const launchedAt = new Date().toISOString();
  const nextInternal = {
    ...internal,
    entryType,
    launchedById: requesterId,
    launchedAt,
  };

  if (entryType === "Transferência") {
    const destinationBankAccountId = typeof internal.destinationBankAccountId === "string"
      ? internal.destinationBankAccountId
      : "";
    if (!bankAccountId || !destinationBankAccountId || bankAccountId === destinationBankAccountId) {
      throw new DocumentRecordApiError("Informe contas bancárias de origem e destino diferentes.");
    }
    const destination = await tx.bankAccount.findFirst({
      where: { id: destinationBankAccountId, companyId: document.companyId, active: true, deletedAt: null },
      select: { id: true },
    });
    if (!destination) throw new DocumentRecordApiError("Conta bancária de destino inválida.");
    await tx.bankAccount.update({ where: { id: bankAccountId }, data: { balance: { decrement: amount } } });
    await tx.bankAccount.update({ where: { id: destinationBankAccountId }, data: { balance: { increment: amount } } });
    return { relatedEntityType: null, relatedEntityId: null, extractedData: pack(extractedData, nextInternal) };
  }

  const recurrence = RECURRENCE_FOR_APPROVED_DOCUMENT[
    (internal.recurrence as keyof typeof RECURRENCE_FOR_APPROVED_DOCUMENT) || "Nenhuma"
  ] || "NONE";
  const slices = approvedDocumentSlices(amount, dueDate, recurrence, internal.installmentCount);
  let relatedEntityId: string | null = null;

  if (entryType === "Conta a Receber") {
    const customer = typeof internal.supplier === "string" && internal.supplier.trim()
      ? internal.supplier.trim()
      : "Cliente a confirmar";
    for (const slice of slices) {
      const receivable = await tx.accountReceivable.create({
        data: {
          companyId: document.companyId,
          description: `${description}${slice.count ? ` (Parcela ${slice.number}/${slice.count})` : ""}`,
          customerName: customer,
          categoryName: category,
          costCenterName: costCenter,
          competenceMonth: slice.count ? slice.dueDate.toISOString().slice(0, 7) : competenceMonth,
          issueDate: approvedDocumentDate(undefined, document.createdAt, "Data de emissão"),
          dueDate: slice.dueDate,
          amount: slice.amount,
          paymentMethod,
          bankAccountId,
          recurrence,
          installmentGroupId: slice.groupId,
          installmentNumber: slice.number,
          installmentCount: slice.count,
          documentNumber: typeof internal.documentNumber === "string" ? internal.documentNumber || null : null,
          notes: typeof internal.notes === "string" ? internal.notes || null : "Lançamento aprovado pela Central de Documentos.",
          attachmentObjectKey: document.objectKey,
          attachmentName: document.name,
          status: "OPEN",
          responsibleId: requesterId,
          createdById: requesterId,
        },
      });
      relatedEntityId ||= receivable.id;
    }
    return { relatedEntityType: "AccountReceivable", relatedEntityId, extractedData: pack(extractedData, nextInternal) };
  }

  const supplier = typeof internal.supplier === "string" && internal.supplier.trim()
    ? internal.supplier.trim()
    : "Fornecedor a confirmar";
  for (const slice of slices) {
    const payable = await tx.accountPayable.create({
      data: {
        companyId: document.companyId,
        description: `${description}${slice.count ? ` (Parcela ${slice.number}/${slice.count})` : ""}`,
        supplierName: supplier,
        categoryName: category,
        costCenterName: costCenter,
        competenceMonth: slice.count ? slice.dueDate.toISOString().slice(0, 7) : competenceMonth,
        issueDate: approvedDocumentDate(undefined, document.createdAt, "Data de emissão"),
        dueDate: slice.dueDate,
        amount: slice.amount,
        finalAmount: slice.amount,
        paymentMethod,
        bankAccountId,
        recurrence,
        installmentGroupId: slice.groupId,
        installmentNumber: slice.number,
        installmentCount: slice.count,
        documentNumber: typeof internal.documentNumber === "string" ? internal.documentNumber || null : null,
        notes: typeof internal.notes === "string" ? internal.notes || null : "Lançamento aprovado pela Central de Documentos.",
        attachmentObjectKey: document.objectKey,
        attachmentName: document.name,
        status: "UPCOMING",
        responsibleId: requesterId,
        needsApproval: false,
        createdById: requesterId,
      },
    });
    relatedEntityId ||= payable.id;
  }
  return { relatedEntityType: "AccountPayable", relatedEntityId, extractedData: pack(extractedData, nextInternal) };
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
    signedUrl:
      item.objectKey.startsWith("/uploads/") || item.objectKey.startsWith("/api/document-files/")
        ? item.objectKey
        : undefined,
    aiSummary: item.aiSummary || undefined,
    extractedData: Object.keys(extractedData).length ? extractedData : undefined,
    processingConfidence: confidenceFromDatabase(item.processingConfidence),
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
    attachmentUrl:
      item.attachmentObjectKey?.startsWith("/uploads/") || item.attachmentObjectKey?.startsWith("/api/document-files/")
        ? item.attachmentObjectKey
        : undefined,
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

async function documentUsersForBpo(
  profile: DocumentProfile,
  companies: Array<{ id: string; tenantId: string }>,
) {
  const companyIds = companies
    .filter((company) => isBpoForCompany(profile, company))
    .map(({ id }) => id);
  if (companyIds.length === 0) return [];
  const rows = await getDatabaseClient().user.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      companyMemberships: {
        some: {
          companyId: { in: companyIds },
          status: "ACTIVE",
          role: { in: ["CLIENT", "ACCOUNTANT"] },
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      title: true,
      companyMemberships: {
        where: {
          companyId: { in: companyIds },
          status: "ACTIVE",
          role: { in: ["CLIENT", "ACCOUNTANT"] },
        },
        select: { companyId: true, role: true, permissions: true },
      },
    },
    orderBy: { name: "asc" },
  });
  return rows.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    title: user.title || undefined,
    role: user.companyMemberships.some(({ role }) => role === "CLIENT")
      ? "CLIENT" as const
      : "ACCOUNTANT" as const,
    status: "ACTIVE" as const,
    companies: [...new Set(user.companyMemberships.map(({ companyId }) => companyId))],
    permissions: [
      ...new Set(user.companyMemberships.flatMap(({ permissions }) => permissions)),
    ],
  }));
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
    documentUsers: await documentUsersForBpo(profile, companies),
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
  const objectKey =
    previewUrl?.startsWith("/uploads/") || previewUrl?.startsWith("/api/document-files/")
      ? previewUrl
      : `metadata/${randomUUID()}`;
  const sha256 = /^[0-9a-f]{64}$/i.test(body?.hash || "")
    ? body.hash.toLowerCase()
    : createHash("sha256").update(`${companyId}:${objectKey}:${randomUUID()}`).digest("hex");
  const shared = Boolean(recipientId);
  const awaitsBpoAnalysis = !shared && !isBpoForCompany(profile, company);
  const internal = internalFromBody({
    ...body,
    origin: body?.origin || "Documento",
    ...(shared ? { sharedById: profile.id, sharedAt: new Date().toISOString() } : {}),
  });
  if (approvalRecipientId) {
    if (!isBpoForCompany(profile, company)) {
      throw new DocumentRecordApiError("Somente a equipe BPO pode solicitar esta aprovação.", 403);
    }
    requireApprovalLaunchPermission(profile, company, internal);
  }
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
        processingConfidence: confidenceForDatabase(body?.processingConfidence),
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
      title: awaitsBpoAnalysis
        ? "Documento aguardando análise do BPO"
        : "Novo documento",
      message: awaitsBpoAnalysis
        ? `${document.uploadedBy.name} enviou ${document.name} para análise do BPO.`
        : `${document.name} foi adicionado à Central de Documentos.`,
      type: awaitsBpoAnalysis ? "WARNING" : "INFO",
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
  if (body.processingConfidence !== undefined) data.processingConfidence = confidenceForDatabase(body.processingConfidence);
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
  requireApprovalLaunchPermission(profile, company, nextInternal);
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
    const documentBeforeDecision = await tx.document.findFirst({
      where: { id: existing.relatedEntityId, deletedAt: null },
      include: documentInclude,
    });
    if (!documentBeforeDecision || documentBeforeDecision.status !== "AWAITING_APPROVAL") {
      throw new DocumentRecordApiError("Documento indisponível para esta decisão.", 409);
    }
    const financialPosting = decision === "APPROVED"
      ? await postApprovedDocument(tx, documentBeforeDecision, existing.requesterId)
      : null;
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
      data: {
        status: documentStatus,
        canceledAt: documentStatus === "CANCELED" ? new Date() : null,
        ...(financialPosting
          ? {
              relatedEntityType: financialPosting.relatedEntityType,
              relatedEntityId: financialPosting.relatedEntityId,
              extractedData: financialPosting.extractedData,
            }
          : {}),
      },
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
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

type DeletedFinancialEntries = {
  deletedPayableIds: string[];
  deletedReceivableIds: string[];
  adjustedBankAccounts: Array<{ id: string; balance: number }>;
};

type DeletableDocument = {
  id: string;
  companyId: string;
  relatedEntityId: string | null;
  relatedEntityType: string | null;
  extractedData: unknown;
  status: string;
  company: { id: string; tenantId: string };
};

function linkedFinancialReference(document: {
  relatedEntityId: string | null;
  relatedEntityType: string | null;
  extractedData: unknown;
}) {
  if (!document.relatedEntityId) return null;
  const { internal } = unpack(document.extractedData);
  const entryType = internal.entryType as string | undefined;
  if (
    document.relatedEntityType === "AccountReceivable" ||
    entryType === "Conta a Receber"
  ) {
    return { id: document.relatedEntityId, type: "RECEIVABLE" as const };
  }
  if (
    document.relatedEntityType === "AccountPayable" ||
    entryType === "Conta a Pagar"
  ) {
    return { id: document.relatedEntityId, type: "PAYABLE" as const };
  }
  return null;
}

function transferToReverse(document: DeletableDocument) {
  const { internal } = unpack(document.extractedData);
  if (internal.entryType !== "Transferência" || document.status !== "POSTED") return null;
  const sourceAccountId = internal.bankAccountId;
  const destinationAccountId = internal.destinationBankAccountId;
  const amount = Number(internal.amount);
  if (
    typeof sourceAccountId !== "string" ||
    typeof destinationAccountId !== "string" ||
    sourceAccountId === destinationAccountId ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new DocumentRecordApiError(
      "A transferência não possui dados suficientes para reverter os saldos com segurança.",
      409,
    );
  }
  return { sourceAccountId, destinationAccountId, amount };
}

function requireLinkedDeletionPermissions(
  profile: DocumentProfile,
  documents: DeletableDocument[],
) {
  for (const document of documents) {
    const reference = linkedFinancialReference(document);
    if (
      reference?.type === "PAYABLE" &&
      !hasPermission(profile, document.company, "accounts-payable.cancel")
    ) {
      throw new DocumentRecordApiError(
        "Sem permissão para excluir a conta a pagar vinculada a este documento.",
        403,
      );
    }
    if (
      reference?.type === "RECEIVABLE" &&
      !hasPermission(profile, document.company, "accounts-receivable.cancel")
    ) {
      throw new DocumentRecordApiError(
        "Sem permissão para excluir a conta a receber vinculada a este documento.",
        403,
      );
    }
    if (transferToReverse(document) && !isBpoForCompany(profile, document.company)) {
      throw new DocumentRecordApiError(
        "Sem permissão para excluir uma transferência entre contas.",
        403,
      );
    }
  }
}

async function reverseLinkedTransfers(
  tx: Prisma.TransactionClient,
  profile: DocumentProfile,
  documents: DeletableDocument[],
) {
  const adjusted = new Map<string, { id: string; balance: number }>();
  for (const document of documents) {
    const transfer = transferToReverse(document);
    if (!transfer) continue;
    const accounts = await tx.bankAccount.findMany({
      where: {
        id: { in: [transfer.sourceAccountId, transfer.destinationAccountId] },
        companyId: document.companyId,
      },
      select: { id: true, balance: true },
    });
    if (accounts.length !== 2) {
      throw new DocumentRecordApiError(
        "Não foi possível localizar as contas da transferência para reverter os saldos.",
        409,
      );
    }
    const sourceBefore = accounts.find((item) => item.id === transfer.sourceAccountId)!;
    const destinationBefore = accounts.find((item) => item.id === transfer.destinationAccountId)!;
    const source = await tx.bankAccount.update({
      where: { id: transfer.sourceAccountId },
      data: { balance: { increment: transfer.amount } },
      select: { id: true, balance: true },
    });
    const destination = await tx.bankAccount.update({
      where: { id: transfer.destinationAccountId },
      data: { balance: { decrement: transfer.amount } },
      select: { id: true, balance: true },
    });
    adjusted.set(source.id, { id: source.id, balance: Number(source.balance) });
    adjusted.set(destination.id, { id: destination.id, balance: Number(destination.balance) });
    await audit(
      tx,
      profile,
      document.company,
      "EXCLUIR_TRANSFERENCIA_ENTRE_CONTAS",
      document.id,
      {
        sourceAccountId: source.id,
        sourceBalance: Number(sourceBefore.balance),
        destinationAccountId: destination.id,
        destinationBalance: Number(destinationBefore.balance),
        amount: transfer.amount,
      },
      {
        sourceAccountId: source.id,
        sourceBalance: Number(source.balance),
        destinationAccountId: destination.id,
        destinationBalance: Number(destination.balance),
        reversed: true,
      },
    );
  }
  return [...adjusted.values()];
}

async function deleteLinkedFinancialEntries(
  tx: Prisma.TransactionClient,
  profile: DocumentProfile,
  documents: DeletableDocument[],
  now: Date,
): Promise<DeletedFinancialEntries> {
  const payableCompanies = new Map<string, string>();
  const receivableCompanies = new Map<string, string>();
  documents.forEach((document) => {
    const reference = linkedFinancialReference(document);
    if (!reference) return;
    if (reference.type === "PAYABLE") payableCompanies.set(reference.id, document.companyId);
    else receivableCompanies.set(reference.id, document.companyId);
  });

  const [linkedPayables, linkedReceivables] = await Promise.all([
    tx.accountPayable.findMany({
      where: { id: { in: [...payableCompanies.keys()] }, deletedAt: null },
      select: { id: true, companyId: true, installmentGroupId: true },
    }),
    tx.accountReceivable.findMany({
      where: { id: { in: [...receivableCompanies.keys()] }, deletedAt: null },
      select: { id: true, companyId: true, installmentGroupId: true },
    }),
  ]);
  if (
    linkedPayables.some((item) => payableCompanies.get(item.id) !== item.companyId) ||
    linkedReceivables.some((item) => receivableCompanies.get(item.id) !== item.companyId)
  ) {
    throw new DocumentRecordApiError("Vínculo financeiro inválido para um dos lançamentos.", 409);
  }

  const payableIds = [...payableCompanies.keys()];
  const receivableIds = [...receivableCompanies.keys()];
  const payableGroups = linkedPayables
    .map((item) => item.installmentGroupId)
    .filter((id): id is string => Boolean(id));
  const receivableGroups = linkedReceivables
    .map((item) => item.installmentGroupId)
    .filter((id): id is string => Boolean(id));
  const [payables, receivables] = await Promise.all([
    tx.accountPayable.findMany({
      where: {
        deletedAt: null,
        OR: [
          { id: { in: payableIds } },
          ...(payableGroups.length ? [{ installmentGroupId: { in: payableGroups } }] : []),
        ],
      },
      select: { id: true, payments: { select: { id: true }, take: 1 } },
    }),
    tx.accountReceivable.findMany({
      where: {
        deletedAt: null,
        OR: [
          { id: { in: receivableIds } },
          ...(receivableGroups.length ? [{ installmentGroupId: { in: receivableGroups } }] : []),
        ],
      },
      select: { id: true, receipts: { select: { id: true }, take: 1 } },
    }),
  ]);
  if (payables.some((item) => item.payments.length)) {
    throw new DocumentRecordApiError(
      "Não é possível excluir lançamentos com pagamentos registrados.",
      409,
    );
  }
  if (receivables.some((item) => item.receipts.length)) {
    throw new DocumentRecordApiError(
      "Não é possível excluir lançamentos com recebimentos registrados.",
      409,
    );
  }

  const deletedPayableIds = payables.map((item) => item.id);
  const deletedReceivableIds = receivables.map((item) => item.id);
  if (deletedPayableIds.length) {
    await tx.accountPayable.updateMany({
      where: { id: { in: deletedPayableIds } },
      data: { deletedAt: now, status: "CANCELED", canceledAt: now },
    });
    await tx.approval.updateMany({
      where: {
        relatedEntityType: "AccountPayable",
        relatedEntityId: { in: deletedPayableIds },
        status: "PENDING",
      },
      data: { status: "CANCELED" },
    });
  }
  if (deletedReceivableIds.length) {
    await tx.accountReceivable.updateMany({
      where: { id: { in: deletedReceivableIds } },
      data: { deletedAt: now, status: "CANCELED", canceledAt: now },
    });
    await tx.approval.updateMany({
      where: {
        relatedEntityType: "AccountReceivable",
        relatedEntityId: { in: deletedReceivableIds },
        status: "PENDING",
      },
      data: { status: "CANCELED" },
    });
  }
  const adjustedBankAccounts = await reverseLinkedTransfers(tx, profile, documents);
  return { deletedPayableIds, deletedReceivableIds, adjustedBankAccounts };
}

export async function deleteDocument(profile: DocumentProfile, documentId: string) {
  const database = getDatabaseClient();
  const existing = await database.document.findFirst({
    where: { id: uuid(documentId, "Documento")!, deletedAt: null },
    include: documentInclude,
  });
  if (!existing) throw new DocumentRecordApiError("Documento não encontrado.", 404);
  const company = existing.company;
  const isBpo = isBpoForCompany(profile, company);
  if (
    !isBpo &&
    (!hasPermission(profile, company, "documents.upload") || existing.uploadedById !== profile.id)
  ) {
    throw new DocumentRecordApiError("Sem permissão para excluir este documento.", 403);
  }
  requireLinkedDeletionPermissions(profile, [existing]);
  return database.$transaction(async (tx) => {
    const now = new Date();
    const financialEntries = await deleteLinkedFinancialEntries(tx, profile, [existing], now);
    await tx.document.update({ where: { id: existing.id }, data: { deletedAt: now, status: "CANCELED", canceledAt: now } });
    await tx.approval.updateMany({ where: { relatedEntityType: "Document", relatedEntityId: existing.id, status: "PENDING" }, data: { status: "CANCELED" } });
    await audit(tx, profile, company, "EXCLUIR_DOCUMENTO", existing.id, { name: existing.name }, null);
    await writeNotification(tx, {
      companyId: company.id,
      title: "Documento excluído",
      message: `${existing.name} foi excluído.`,
      type: "WARNING",
    });
    return { deletedIds: [existing.id], ...financialEntries };
  });
}

export async function deleteDocuments(profile: DocumentProfile, body: any) {
  const receivedIds = Array.isArray(body?.documentIds) ? body.documentIds : [];
  if (!receivedIds.length) {
    throw new DocumentRecordApiError("Selecione pelo menos um lançamento para excluir.");
  }
  if (receivedIds.length > 500) {
    throw new DocumentRecordApiError("O limite é de 500 lançamentos por exclusão em massa.");
  }
  const documentIds: string[] = [
    ...new Set<string>(
      receivedIds.map((id: unknown, index: number) => uuid(id, `Documento da linha ${index + 1}`)!),
    ),
  ];
  const database = getDatabaseClient();
  const documents = await database.document.findMany({
    where: { id: { in: documentIds }, deletedAt: null },
    include: {
      uploadedBy: { select: { name: true } },
      company: { select: { id: true, tenantId: true } },
    },
  });
  if (documents.length !== documentIds.length) {
    throw new DocumentRecordApiError(
      "Um ou mais lançamentos não foram encontrados. Atualize a tela e tente novamente.",
      404,
    );
  }
  documents.forEach((document) => {
    const company = document.company;
    const isBpo = isBpoForCompany(profile, company);
    if (
      !isBpo &&
      (!hasPermission(profile, company, "documents.upload") || document.uploadedById !== profile.id)
    ) {
      throw new DocumentRecordApiError("Sem permissão para excluir um dos lançamentos selecionados.", 403);
    }
  });
  requireLinkedDeletionPermissions(profile, documents);

  const financialEntries = await database.$transaction(async (tx) => {
    const now = new Date();
    const deletedFinancialEntries = await deleteLinkedFinancialEntries(tx, profile, documents, now);
    await tx.document.updateMany({
      where: { id: { in: documentIds }, deletedAt: null },
      data: { deletedAt: now, status: "CANCELED", canceledAt: now },
    });
    await tx.approval.updateMany({
      where: {
        relatedEntityType: "Document",
        relatedEntityId: { in: documentIds },
        status: "PENDING",
      },
      data: { status: "CANCELED" },
    });
    for (const document of documents) {
      await audit(
        tx,
        profile,
        document.company,
        "EXCLUIR_DOCUMENTO",
        document.id,
        { name: document.name },
        null,
      );
    }
    const companies = new Map(documents.map((document) => [document.company.id, document.company]));
    for (const company of companies.values()) {
      const count = documents.filter((document) => document.companyId === company.id).length;
      await writeNotification(tx, {
        companyId: company.id,
        title: "Lançamentos excluídos",
        message: `${count} lançamento(s) e seus títulos financeiros vinculados foram excluídos.`,
        type: "WARNING",
      });
    }
    return deletedFinancialEntries;
  });
  return { deletedIds: documentIds, ...financialEntries };
}
