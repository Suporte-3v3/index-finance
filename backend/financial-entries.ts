import { randomUUID } from "node:crypto";
import { Prisma } from "./generated/prisma/client.js";
import { getDatabaseClient } from "./database.js";

type Role = "BPO_ADMIN" | "BPO_TEAM" | "CLIENT" | "ACCOUNTANT";

export interface FinancialEntriesProfile {
  id: string;
  isPlatformAdmin: boolean;
  tenantMemberships: Array<{ tenantId: string; role: Role }>;
  companyMemberships: Array<{
    companyId: string;
    role: Role;
    permissions?: string[];
  }>;
}

export class FinancialEntriesApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const RECURRENCE_TO_DATABASE = {
  Nenhuma: "NONE",
  Semanal: "WEEKLY",
  Mensal: "MONTHLY",
  Trimestral: "QUARTERLY",
  Anual: "ANNUAL",
  Parcelada: "INSTALLMENTS",
} as const;

const RECURRENCE_FROM_DATABASE = {
  NONE: "Nenhuma",
  WEEKLY: "Semanal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  ANNUAL: "Anual",
  INSTALLMENTS: "Parcelada",
} as const;

const PAYABLE_STATUS_FROM_DATABASE = {
  DRAFT: "Rascunho",
  PENDING: "Pendente",
  AWAITING_APPROVAL: "Aguardando aprovação",
  UPCOMING: "A vencer",
  APPROVED: "Aprovada",
  SCHEDULED: "Agendada",
  PAID: "Paga",
  PARTIALLY_PAID: "Parcialmente paga",
  OVERDUE: "Vencida",
  REJECTED: "Rejeitada",
  CANCELED: "Cancelada",
} as const;

const RECEIVABLE_STATUS_FROM_DATABASE = {
  DRAFT: "Rascunho",
  PENDING: "Pendente",
  OPEN: "A receber",
  PARTIALLY_RECEIVED: "Parcialmente recebido",
  RECEIVED: "Recebido",
  OVERDUE: "Vencido",
  COLLECTION: "Em cobrança",
  NEGOTIATED: "Negociada",
  CANCELED: "Cancelado",
} as const;

const APPROVAL_STATUS_FROM_DATABASE = {
  PENDING: "Pendente",
  APPROVED: "Aprovada",
  REJECTED: "Rejeitada",
  CHANGES_REQUESTED: "Ajuste solicitado",
  CANCELED: "Cancelada",
  EXPIRED: "Expirada",
} as const;

const APPROVAL_DECISION_TO_DATABASE = {
  Aprovada: "APPROVED",
  Rejeitada: "REJECTED",
  "Ajuste solicitado": "CHANGES_REQUESTED",
} as const;

function requiredText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new FinancialEntriesApiError(`Informe ${field}.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new FinancialEntriesApiError(`${field} excede o tamanho permitido.`);
  }
  return normalized;
}

function optionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new FinancialEntriesApiError("Campo inválido.");
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new FinancialEntriesApiError("Campo excede o tamanho permitido.");
  }
  return normalized || null;
}

function uuid(value: unknown, field: string, required = true) {
  const normalized = optionalText(value, 36);
  if (!normalized && !required) return null;
  if (!normalized || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new FinancialEntriesApiError(`${field} inválido.`);
  }
  return normalized;
}

function money(value: unknown, field: string, allowZero = true) {
  const normalized = Number(value);
  if (
    !Number.isFinite(normalized) ||
    normalized < 0 ||
    (!allowZero && normalized === 0) ||
    normalized > 999_999_999_999_999
  ) {
    throw new FinancialEntriesApiError(`${field} inválido.`);
  }
  return Math.round((normalized + Number.EPSILON) * 100) / 100;
}

function date(value: unknown, field: string) {
  const normalized = requiredText(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new FinancialEntriesApiError(`${field} inválida.`);
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new FinancialEntriesApiError(`${field} inválida.`);
  }
  return parsed;
}

function competenceMonth(value: unknown) {
  const normalized = requiredText(value, "a competência", 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(normalized)) {
    throw new FinancialEntriesApiError("Competência inválida.");
  }
  return normalized;
}

function recurrence(value: unknown) {
  const mapped = RECURRENCE_TO_DATABASE[value as keyof typeof RECURRENCE_TO_DATABASE];
  if (!mapped) throw new FinancialEntriesApiError("Recorrência inválida.");
  return mapped;
}

function tenantIds(profile: FinancialEntriesProfile) {
  return profile.tenantMemberships
    .filter(({ role }) => role === "BPO_ADMIN" || role === "BPO_TEAM")
    .map(({ tenantId }) => tenantId);
}

function companyIds(profile: FinancialEntriesProfile) {
  return profile.companyMemberships.map(({ companyId }) => companyId);
}

function administratorTenantIds(profile: FinancialEntriesProfile) {
  return profile.tenantMemberships
    .filter(({ role }) => role === "BPO_ADMIN")
    .map(({ tenantId }) => tenantId);
}

function hasPermission(
  profile: FinancialEntriesProfile,
  company: { id: string; tenantId: string },
  permission: string,
) {
  return (
    profile.isPlatformAdmin ||
    administratorTenantIds(profile).includes(company.tenantId) ||
    profile.companyMemberships.some(
      (membership) =>
        membership.companyId === company.id &&
        (membership.role === "BPO_ADMIN" || membership.permissions?.includes(permission)),
    )
  );
}

async function requireCompany(
  profile: FinancialEntriesProfile,
  companyId: string,
  permission: string,
) {
  const company = await getDatabaseClient().company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { id: true, tenantId: true, approvalLimit: true },
  });
  if (!company) throw new FinancialEntriesApiError("Empresa não encontrada.", 404);
  if (!hasPermission(profile, company, permission)) {
    throw new FinancialEntriesApiError("Sem permissão para esta operação.", 403);
  }
  return company;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function audit(
  transaction: Prisma.TransactionClient,
  profile: FinancialEntriesProfile,
  company: { id: string; tenantId: string },
  action: string,
  entityType: string,
  entityId: string,
  previousData: unknown,
  nextData: unknown,
) {
  await transaction.auditLog.create({
    data: {
      tenantId: company.tenantId,
      companyId: company.id,
      userId: profile.id,
      action,
      entityType,
      entityId,
      previousData: previousData == null ? Prisma.JsonNull : json(previousData),
      nextData: nextData == null ? Prisma.JsonNull : json(nextData),
    },
  });
}

function isoDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : undefined;
}

function mapBankAccount(account: any) {
  const types = {
    CHECKING: "Corrente",
    SAVINGS: "Poupança",
    INVESTMENT: "Investimento",
    CASH: "Caixa",
  } as const;
  return {
    id: account.id,
    companyId: account.companyId,
    bankName: account.bankName,
    agency: account.agency || "",
    accountNumber: account.accountNumber,
    type: types[account.type as keyof typeof types],
    balance: Number(account.balance),
    isBolsaAccount: account.isBolsaAccount || undefined,
  };
}

const payableInclude = {
  payments: {
    include: {
      bankAccount: { select: { bankName: true } },
      registeredBy: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
};

function mapPayable(item: any) {
  return {
    id: item.id,
    companyId: item.companyId,
    description: item.description,
    supplier: item.supplierName,
    category: item.categoryName,
    costCenter: item.costCenterName,
    competenceMonth: item.competenceMonth,
    issueDate: isoDate(item.issueDate)!,
    dueDate: isoDate(item.dueDate)!,
    amount: Number(item.amount),
    interest: Number(item.interest),
    penalty: Number(item.penalty),
    discount: Number(item.discount),
    finalAmount: Number(item.finalAmount),
    paymentMethod: item.paymentMethod,
    bankAccountId: item.bankAccountId || "",
    recurrence: RECURRENCE_FROM_DATABASE[item.recurrence as keyof typeof RECURRENCE_FROM_DATABASE],
    installmentGroupId: item.installmentGroupId || undefined,
    installmentNumber: item.installmentNumber || undefined,
    installmentCount: item.installmentCount || undefined,
    documentNumber: item.documentNumber || "",
    notes: item.notes || "",
    attachmentUrl: item.attachmentObjectKey || undefined,
    attachmentName: item.attachmentName || undefined,
    status: PAYABLE_STATUS_FROM_DATABASE[item.status as keyof typeof PAYABLE_STATUS_FROM_DATABASE],
    responsibleId: item.responsibleId || item.createdById,
    needsApproval: item.needsApproval,
    paymentDate: isoDate(item.paymentDate),
    paymentReceiptUrl: item.payments?.at(-1)?.receiptObjectKey || undefined,
    paidAmount: Number(item.paidAmount),
    paymentHistory: (item.payments || []).map((payment: any) => ({
      id: payment.id,
      date: isoDate(payment.date)!,
      amount: Number(payment.amount),
      bankAccountId: payment.bankAccountId,
      bankAccountName: payment.bankAccount.bankName,
      interest: Number(payment.interest),
      penalty: Number(payment.penalty),
      discount: Number(payment.discount),
      notes: payment.notes || undefined,
      receiptUrl: payment.receiptObjectKey || undefined,
      registeredById: payment.registeredById,
      registeredByName: payment.registeredBy.name,
      createdAt: payment.createdAt.toISOString(),
    })),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function mapReceivable(item: any) {
  return {
    id: item.id,
    companyId: item.companyId,
    description: item.description,
    customer: item.customerName,
    category: item.categoryName,
    costCenter: item.costCenterName,
    competenceMonth: item.competenceMonth,
    issueDate: isoDate(item.issueDate)!,
    dueDate: isoDate(item.dueDate)!,
    amount: Number(item.amount),
    interest: Number(item.interest),
    penalty: Number(item.penalty),
    discount: Number(item.discount),
    receivedAmount: Number(item.receivedAmount),
    paymentMethod: item.paymentMethod,
    bankAccountId: item.bankAccountId || "",
    recurrence: RECURRENCE_FROM_DATABASE[item.recurrence as keyof typeof RECURRENCE_FROM_DATABASE],
    installmentGroupId: item.installmentGroupId || undefined,
    installmentNumber: item.installmentNumber || undefined,
    installmentCount: item.installmentCount || undefined,
    documentNumber: item.documentNumber || "",
    notes: item.notes || "",
    attachmentUrl: item.attachmentObjectKey || undefined,
    attachmentName: item.attachmentName || undefined,
    status: RECEIVABLE_STATUS_FROM_DATABASE[item.status as keyof typeof RECEIVABLE_STATUS_FROM_DATABASE],
    responsibleId: item.responsibleId || item.createdById,
    receiptDate: isoDate(item.receiptDate),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

const approvalInclude = {
  requester: { select: { name: true } },
  steps: {
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
};

function mapApproval(item: any) {
  return {
    id: item.id,
    companyId: item.companyId,
    type: "PAGAMENTO",
    relatedId: item.relatedEntityId,
    description: item.description,
    amount: Number(item.amount || 0),
    dueDate: isoDate(item.dueDate) || "",
    requesterId: item.requesterId,
    requesterName: item.requester.name,
    dueDateApproval: item.approvalDeadline?.toISOString() || item.createdAt.toISOString(),
    status: APPROVAL_STATUS_FROM_DATABASE[item.status as keyof typeof APPROVAL_STATUS_FROM_DATABASE],
    justification: item.justification || undefined,
    attachmentUrl: item.attachmentObjectKey || undefined,
    createdAt: item.createdAt.toISOString(),
    history: (item.steps || []).map((step: any) => ({
      id: step.id,
      userId: step.userId,
      userName: step.user.name,
      role: step.role,
      decision: APPROVAL_STATUS_FROM_DATABASE[step.decision as "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" | "CANCELED"],
      comment: step.comment || "",
      timestamp: step.createdAt.toISOString(),
      ipAddress: step.ipAddress || undefined,
      userAgent: step.userAgent || undefined,
    })),
  };
}

function addMonths(input: Date, months: number) {
  const date = new Date(input);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date;
}

function installmentSlices(total: number, dueDate: Date, countInput: unknown) {
  const count = Math.floor(Number(countInput));
  if (!Number.isInteger(count) || count < 2 || count > 360) {
    throw new FinancialEntriesApiError("A quantidade de parcelas deve estar entre 2 e 360.");
  }
  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents - baseCents * count;
  const groupId = randomUUID();
  return Array.from({ length: count }, (_, index) => ({
    amount: (baseCents + (index < remainder ? 1 : 0)) / 100,
    dueDate: addMonths(dueDate, index),
    groupId,
    number: index + 1,
    count,
  }));
}

async function validateBank(companyId: string, bankAccountId: string | null) {
  if (!bankAccountId) return null;
  const bank = await getDatabaseClient().bankAccount.findFirst({
    where: { id: bankAccountId, companyId, active: true, deletedAt: null },
    select: { id: true },
  });
  if (!bank) throw new FinancialEntriesApiError("Conta bancária inválida para esta empresa.");
  return bank.id;
}

export async function listFinancialEntries(profile: FinancialEntriesProfile) {
  const accessibleCompanies = await getDatabaseClient().company.findMany({
    where: profile.isPlatformAdmin
      ? { deletedAt: null }
      : {
          deletedAt: null,
          OR: [{ tenantId: { in: tenantIds(profile) } }, { id: { in: companyIds(profile) } }],
        },
    select: { id: true, tenantId: true },
  });
  const payableCompanyIds = accessibleCompanies
    .filter((company) => hasPermission(profile, company, "accounts-payable.view"))
    .map(({ id }) => id);
  const receivableCompanyIds = accessibleCompanies
    .filter((company) => hasPermission(profile, company, "accounts-receivable.view"))
    .map(({ id }) => id);
  const approvalCompanyIds = accessibleCompanies
    .filter((company) =>
      profile.isPlatformAdmin ||
      administratorTenantIds(profile).includes(company.tenantId) ||
      profile.companyMemberships.some((membership) =>
        membership.companyId === company.id &&
        (membership.role === "BPO_ADMIN" ||
          membership.role === "BPO_TEAM" ||
          membership.permissions?.includes("approvals.approve")),
      ),
    )
    .map(({ id }) => id);
  const [payables, receivables, paymentApprovals] = await Promise.all([
    getDatabaseClient().accountPayable.findMany({
      where: { companyId: { in: payableCompanyIds }, deletedAt: null },
      include: payableInclude,
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    }),
    getDatabaseClient().accountReceivable.findMany({
      where: { companyId: { in: receivableCompanyIds }, deletedAt: null },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    }),
    getDatabaseClient().approval.findMany({
      where: { companyId: { in: approvalCompanyIds }, type: "PAYMENT" },
      include: approvalInclude,
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return {
    accountsPayable: payables.map(mapPayable),
    accountsReceivable: receivables.map(mapReceivable),
    paymentApprovals: paymentApprovals.map(mapApproval),
  };
}

export async function createPayables(profile: FinancialEntriesProfile, body: any) {
  const companyId = uuid(body?.companyId, "Empresa")!;
  const company = await requireCompany(profile, companyId, "accounts-payable.create");
  const amount = money(body?.amount, "Valor", false);
  const interest = money(body?.interest || 0, "Juros");
  const penalty = money(body?.penalty || 0, "Multa");
  const discount = money(body?.discount || 0, "Desconto");
  const total = money(amount + interest + penalty - discount, "Valor final", false);
  const due = date(body?.dueDate, "Data de vencimento");
  const inputCompetence = competenceMonth(body?.competenceMonth);
  const recurrenceType = recurrence(body?.recurrence);
  const bankAccountId = await validateBank(companyId, uuid(body?.bankAccountId, "Conta bancária", false));
  const slices = recurrenceType === "INSTALLMENTS"
    ? installmentSlices(total, due, body?.installmentCount)
    : [{ amount: total, dueDate: due, groupId: null, number: null, count: null }];

  const database = getDatabaseClient();
  return database.$transaction(async (transaction) => {
    const payables = [];
    const approvals = [];
    for (const slice of slices) {
      const description = `${requiredText(body?.description, "a descrição", 500)}${slice.count ? ` (Parcela ${slice.number}/${slice.count})` : ""}`;
      const needsApproval = Boolean(body?.needsApproval) || slice.amount >= Number(company.approvalLimit);
      const payable = await transaction.accountPayable.create({
        data: {
          companyId,
          description,
          supplierName: requiredText(body?.supplier, "o fornecedor", 200),
          categoryName: requiredText(body?.category, "a categoria", 160),
          costCenterName: requiredText(body?.costCenter, "o centro de custo", 160),
          competenceMonth: slice.count ? slice.dueDate.toISOString().slice(0, 7) : inputCompetence,
          issueDate: date(body?.issueDate, "Data de emissão"),
          dueDate: slice.dueDate,
          amount: slice.count ? slice.amount : amount,
          interest: slice.count ? 0 : interest,
          penalty: slice.count ? 0 : penalty,
          discount: slice.count ? 0 : discount,
          finalAmount: slice.amount,
          paymentMethod: requiredText(body?.paymentMethod, "a forma de pagamento", 100),
          bankAccountId,
          recurrence: recurrenceType,
          installmentGroupId: slice.groupId,
          installmentNumber: slice.number,
          installmentCount: slice.count,
          documentNumber: optionalText(body?.documentNumber, 100),
          notes: optionalText(body?.notes, 10_000),
          attachmentObjectKey: optionalText(body?.attachmentUrl, 500),
          attachmentName: optionalText(body?.attachmentName, 255),
          status: needsApproval ? "AWAITING_APPROVAL" : "UPCOMING",
          responsibleId: uuid(body?.responsibleId || profile.id, "Responsável", false),
          needsApproval,
          createdById: profile.id,
        },
        include: payableInclude,
      });
      payables.push(payable);
      await audit(transaction, profile, company, "CRIAR_CONTA_PAGAR", "AccountPayable", payable.id, null, mapPayable(payable));
      if (needsApproval) {
        const approval = await transaction.approval.create({
          data: {
            companyId,
            type: "PAYMENT",
            relatedEntityType: "AccountPayable",
            relatedEntityId: payable.id,
            description,
            amount: slice.amount,
            dueDate: slice.dueDate,
            requesterId: profile.id,
            approvalDeadline: slice.dueDate,
            attachmentObjectKey: optionalText(body?.attachmentUrl, 500),
          },
          include: approvalInclude,
        });
        approvals.push(approval);
      }
    }
    return {
      payables: payables.map(mapPayable),
      approvals: approvals.map(mapApproval),
    };
  });
}

export async function updatePayable(profile: FinancialEntriesProfile, payableId: string, body: any) {
  const database = getDatabaseClient();
  const existing = await database.accountPayable.findFirst({
    where: { id: uuid(payableId, "Título")!, deletedAt: null },
    include: { ...payableInclude, company: { select: { id: true, tenantId: true } } },
  });
  if (!existing) throw new FinancialEntriesApiError("Título não encontrado.", 404);
  await requireCompany(profile, existing.companyId, "accounts-payable.update");
  if (["PAID", "PARTIALLY_PAID", "CANCELED"].includes(existing.status)) {
    throw new FinancialEntriesApiError("Este título não pode mais ser editado.", 409);
  }
  const data: Record<string, unknown> = {};
  if (body.description !== undefined) data.description = requiredText(body.description, "a descrição", 500);
  if (body.supplier !== undefined) data.supplierName = requiredText(body.supplier, "o fornecedor", 200);
  if (body.category !== undefined) data.categoryName = requiredText(body.category, "a categoria", 160);
  if (body.costCenter !== undefined) data.costCenterName = requiredText(body.costCenter, "o centro de custo", 160);
  if (body.competenceMonth !== undefined) data.competenceMonth = competenceMonth(body.competenceMonth);
  if (body.issueDate !== undefined) data.issueDate = date(body.issueDate, "Data de emissão");
  if (body.dueDate !== undefined) data.dueDate = date(body.dueDate, "Data de vencimento");
  if (body.paymentMethod !== undefined) data.paymentMethod = requiredText(body.paymentMethod, "a forma de pagamento", 100);
  if (body.bankAccountId !== undefined) data.bankAccountId = await validateBank(existing.companyId, uuid(body.bankAccountId, "Conta bancária", false));
  if (body.documentNumber !== undefined) data.documentNumber = optionalText(body.documentNumber, 100);
  if (body.notes !== undefined) data.notes = optionalText(body.notes, 10_000);
  if (body.attachmentUrl !== undefined) data.attachmentObjectKey = optionalText(body.attachmentUrl, 500);
  if (body.attachmentName !== undefined) data.attachmentName = optionalText(body.attachmentName, 255);
  const amount = body.amount === undefined ? Number(existing.amount) : money(body.amount, "Valor", false);
  const interest = body.interest === undefined ? Number(existing.interest) : money(body.interest, "Juros");
  const penalty = body.penalty === undefined ? Number(existing.penalty) : money(body.penalty, "Multa");
  const discount = body.discount === undefined ? Number(existing.discount) : money(body.discount, "Desconto");
  Object.assign(data, { amount, interest, penalty, discount, finalAmount: money(amount + interest + penalty - discount, "Valor final", false) });

  return database.$transaction(async (transaction) => {
    const updated = await transaction.accountPayable.update({ where: { id: existing.id }, data, include: payableInclude });
    await audit(transaction, profile, existing.company, "ATUALIZAR_CONTA_PAGAR", "AccountPayable", existing.id, mapPayable(existing), mapPayable(updated));
    return mapPayable(updated);
  });
}

export async function cancelPayable(profile: FinancialEntriesProfile, payableId: string) {
  const database = getDatabaseClient();
  const existing = await database.accountPayable.findFirst({
    where: { id: uuid(payableId, "Título")!, deletedAt: null },
    include: { ...payableInclude, company: { select: { id: true, tenantId: true } } },
  });
  if (!existing) throw new FinancialEntriesApiError("Título não encontrado.", 404);
  await requireCompany(profile, existing.companyId, "accounts-payable.cancel");
  if (existing.payments.length) throw new FinancialEntriesApiError("Títulos com pagamentos não podem ser cancelados.", 409);
  if (existing.status === "CANCELED") return mapPayable(existing);
  return database.$transaction(async (transaction) => {
    const updated = await transaction.accountPayable.update({
      where: { id: existing.id },
      data: { status: "CANCELED", canceledAt: new Date() },
      include: payableInclude,
    });
    await transaction.approval.updateMany({
      where: { relatedEntityType: "AccountPayable", relatedEntityId: existing.id, status: "PENDING" },
      data: { status: "CANCELED" },
    });
    await audit(transaction, profile, existing.company, "CANCELAR_CONTA_PAGAR", "AccountPayable", existing.id, mapPayable(existing), mapPayable(updated));
    return mapPayable(updated);
  });
}

export async function schedulePayable(profile: FinancialEntriesProfile, payableId: string) {
  const database = getDatabaseClient();
  const existing = await database.accountPayable.findFirst({
    where: { id: uuid(payableId, "Título")!, deletedAt: null },
    include: { ...payableInclude, company: { select: { id: true, tenantId: true } } },
  });
  if (!existing) throw new FinancialEntriesApiError("Título não encontrado.", 404);
  await requireCompany(profile, existing.companyId, "accounts-payable.update");
  if (["PAID", "CANCELED", "AWAITING_APPROVAL", "REJECTED"].includes(existing.status)) {
    throw new FinancialEntriesApiError("Este título não pode ser agendado.", 409);
  }
  return database.$transaction(async (transaction) => {
    const updated = await transaction.accountPayable.update({ where: { id: existing.id }, data: { status: "SCHEDULED" }, include: payableInclude });
    await audit(transaction, profile, existing.company, "AGENDAR_CONTA_PAGAR", "AccountPayable", existing.id, mapPayable(existing), mapPayable(updated));
    return mapPayable(updated);
  });
}

export async function payPayable(profile: FinancialEntriesProfile, payableId: string, body: any) {
  const database = getDatabaseClient();
  const id = uuid(payableId, "Título")!;
  const initial = await database.accountPayable.findFirst({
    where: { id, deletedAt: null },
    include: { company: { select: { id: true, tenantId: true } } },
  });
  if (!initial) throw new FinancialEntriesApiError("Título não encontrado.", 404);
  await requireCompany(profile, initial.companyId, "reconciliation.execute");
  const bankAccountId = uuid(body?.bankAccountId, "Conta bancária")!;
  const requestedAmount = money(body?.amount, "Valor do pagamento", false);
  const extraInterest = money(body?.interest || 0, "Juros");
  const extraPenalty = money(body?.penalty || 0, "Multa");
  const extraDiscount = money(body?.discount || 0, "Desconto");

  return database.$transaction(async (transaction) => {
    const payable = await transaction.accountPayable.findUnique({ where: { id }, include: payableInclude });
    if (!payable || ["PAID", "CANCELED", "AWAITING_APPROVAL", "REJECTED"].includes(payable.status)) {
      throw new FinancialEntriesApiError("Este título não pode receber pagamento.", 409);
    }
    const bank = await transaction.bankAccount.findFirst({
      where: { id: bankAccountId, companyId: payable.companyId, active: true, deletedAt: null },
    });
    if (!bank) throw new FinancialEntriesApiError("Conta bancária inválida para este pagamento.");
    const finalAmount = money(Number(payable.finalAmount) + extraInterest + extraPenalty - extraDiscount, "Valor final", false);
    const outstanding = Math.max(finalAmount - Number(payable.paidAmount), 0);
    if (outstanding <= 0) throw new FinancialEntriesApiError("Este título já está integralmente pago.", 409);
    const paidNow = Math.min(requestedAmount, outstanding);
    const fullyPaid = outstanding - paidNow <= 0.01;
    await transaction.accountPayablePayment.create({
      data: {
        payableId: id,
        bankAccountId,
        date: date(body?.date, "Data do pagamento"),
        amount: paidNow,
        interest: extraInterest,
        penalty: extraPenalty,
        discount: extraDiscount,
        notes: optionalText(body?.notes, 10_000),
        receiptObjectKey: optionalText(body?.receiptUrl, 500),
        registeredById: profile.id,
      },
    });
    await transaction.accountPayable.update({
      where: { id },
      data: {
        interest: { increment: extraInterest },
        penalty: { increment: extraPenalty },
        discount: { increment: extraDiscount },
        finalAmount,
        paidAmount: { increment: paidNow },
        bankAccountId,
        paymentDate: fullyPaid ? date(body?.date, "Data do pagamento") : payable.paymentDate,
        status: fullyPaid ? "PAID" : "PARTIALLY_PAID",
      },
    });
    const updatedBank = await transaction.bankAccount.update({ where: { id: bankAccountId }, data: { balance: { decrement: paidNow } } });
    const updated = await transaction.accountPayable.findUniqueOrThrow({ where: { id }, include: payableInclude });
    await audit(transaction, profile, initial.company, "CONFIRMAR_PAGAMENTO", "AccountPayable", id, mapPayable(payable), mapPayable(updated));
    return { payable: mapPayable(updated), bankAccount: mapBankAccount(updatedBank) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createReceivables(profile: FinancialEntriesProfile, body: any) {
  const companyId = uuid(body?.companyId, "Empresa")!;
  const company = await requireCompany(profile, companyId, "accounts-receivable.create");
  const amount = money(body?.amount, "Valor", false);
  const due = date(body?.dueDate, "Data de vencimento");
  const inputCompetence = competenceMonth(body?.competenceMonth);
  const recurrenceType = recurrence(body?.recurrence);
  const bankAccountId = await validateBank(companyId, uuid(body?.bankAccountId, "Conta bancária", false));
  const slices = recurrenceType === "INSTALLMENTS"
    ? installmentSlices(amount, due, body?.installmentCount)
    : [{ amount, dueDate: due, groupId: null, number: null, count: null }];
  return getDatabaseClient().$transaction(async (transaction) => {
    const receivables = [];
    for (const slice of slices) {
      const item = await transaction.accountReceivable.create({
        data: {
          companyId,
          description: `${requiredText(body?.description, "a descrição", 500)}${slice.count ? ` (Parcela ${slice.number}/${slice.count})` : ""}`,
          customerName: requiredText(body?.customer, "o cliente", 200),
          categoryName: requiredText(body?.category, "a categoria", 160),
          costCenterName: requiredText(body?.costCenter, "o centro de custo", 160),
          competenceMonth: slice.count ? slice.dueDate.toISOString().slice(0, 7) : inputCompetence,
          issueDate: date(body?.issueDate, "Data de emissão"),
          dueDate: slice.dueDate,
          amount: slice.amount,
          interest: slice.count ? 0 : money(body?.interest || 0, "Juros"),
          penalty: slice.count ? 0 : money(body?.penalty || 0, "Multa"),
          discount: slice.count ? 0 : money(body?.discount || 0, "Desconto"),
          paymentMethod: requiredText(body?.paymentMethod, "a forma de pagamento", 100),
          bankAccountId,
          recurrence: recurrenceType,
          installmentGroupId: slice.groupId,
          installmentNumber: slice.number,
          installmentCount: slice.count,
          documentNumber: optionalText(body?.documentNumber, 100),
          notes: optionalText(body?.notes, 10_000),
          attachmentObjectKey: optionalText(body?.attachmentUrl, 500),
          attachmentName: optionalText(body?.attachmentName, 255),
          status: "OPEN",
          responsibleId: uuid(body?.responsibleId || profile.id, "Responsável", false),
          createdById: profile.id,
        },
      });
      receivables.push(item);
      await audit(transaction, profile, company, "CRIAR_CONTA_RECEBER", "AccountReceivable", item.id, null, mapReceivable(item));
    }
    return receivables.map(mapReceivable);
  });
}

export async function updateReceivable(profile: FinancialEntriesProfile, receivableId: string, body: any) {
  const database = getDatabaseClient();
  const existing = await database.accountReceivable.findFirst({
    where: { id: uuid(receivableId, "Título")!, deletedAt: null },
    include: { company: { select: { id: true, tenantId: true } }, receipts: { select: { id: true } } },
  });
  if (!existing) throw new FinancialEntriesApiError("Título não encontrado.", 404);
  await requireCompany(profile, existing.companyId, "accounts-receivable.update");
  if (existing.receipts.length || ["RECEIVED", "CANCELED"].includes(existing.status)) {
    throw new FinancialEntriesApiError("Este título não pode mais ser editado.", 409);
  }
  const data: Record<string, unknown> = {};
  if (body.description !== undefined) data.description = requiredText(body.description, "a descrição", 500);
  if (body.customer !== undefined) data.customerName = requiredText(body.customer, "o cliente", 200);
  if (body.category !== undefined) data.categoryName = requiredText(body.category, "a categoria", 160);
  if (body.costCenter !== undefined) data.costCenterName = requiredText(body.costCenter, "o centro de custo", 160);
  if (body.competenceMonth !== undefined) data.competenceMonth = competenceMonth(body.competenceMonth);
  if (body.issueDate !== undefined) data.issueDate = date(body.issueDate, "Data de emissão");
  if (body.dueDate !== undefined) data.dueDate = date(body.dueDate, "Data de vencimento");
  if (body.amount !== undefined) data.amount = money(body.amount, "Valor", false);
  if (body.interest !== undefined) data.interest = money(body.interest, "Juros");
  if (body.penalty !== undefined) data.penalty = money(body.penalty, "Multa");
  if (body.discount !== undefined) data.discount = money(body.discount, "Desconto");
  if (body.paymentMethod !== undefined) data.paymentMethod = requiredText(body.paymentMethod, "a forma de pagamento", 100);
  if (body.bankAccountId !== undefined) data.bankAccountId = await validateBank(existing.companyId, uuid(body.bankAccountId, "Conta bancária", false));
  if (body.documentNumber !== undefined) data.documentNumber = optionalText(body.documentNumber, 100);
  if (body.notes !== undefined) data.notes = optionalText(body.notes, 10_000);
  if (body.attachmentUrl !== undefined) data.attachmentObjectKey = optionalText(body.attachmentUrl, 500);
  if (body.attachmentName !== undefined) data.attachmentName = optionalText(body.attachmentName, 255);
  return database.$transaction(async (transaction) => {
    const updated = await transaction.accountReceivable.update({ where: { id: existing.id }, data });
    await audit(transaction, profile, existing.company, "ATUALIZAR_CONTA_RECEBER", "AccountReceivable", existing.id, mapReceivable(existing), mapReceivable(updated));
    return mapReceivable(updated);
  });
}

export async function cancelReceivable(profile: FinancialEntriesProfile, receivableId: string) {
  const database = getDatabaseClient();
  const existing = await database.accountReceivable.findFirst({
    where: { id: uuid(receivableId, "Título")!, deletedAt: null },
    include: { company: { select: { id: true, tenantId: true } }, receipts: { select: { id: true } } },
  });
  if (!existing) throw new FinancialEntriesApiError("Título não encontrado.", 404);
  await requireCompany(profile, existing.companyId, "accounts-receivable.cancel");
  if (existing.receipts.length) throw new FinancialEntriesApiError("Títulos com recebimentos não podem ser cancelados.", 409);
  if (existing.status === "CANCELED") return mapReceivable(existing);
  return database.$transaction(async (transaction) => {
    const updated = await transaction.accountReceivable.update({ where: { id: existing.id }, data: { status: "CANCELED", canceledAt: new Date() } });
    await audit(transaction, profile, existing.company, "CANCELAR_CONTA_RECEBER", "AccountReceivable", existing.id, mapReceivable(existing), mapReceivable(updated));
    return mapReceivable(updated);
  });
}

export async function receiveReceivable(profile: FinancialEntriesProfile, receivableId: string, body: any) {
  const database = getDatabaseClient();
  const id = uuid(receivableId, "Título")!;
  const initial = await database.accountReceivable.findFirst({
    where: { id, deletedAt: null },
    include: { company: { select: { id: true, tenantId: true } } },
  });
  if (!initial) throw new FinancialEntriesApiError("Título não encontrado.", 404);
  await requireCompany(profile, initial.companyId, "reconciliation.execute");
  const requestedAmount = money(body?.amount, "Valor do recebimento", false);
  return database.$transaction(async (transaction) => {
    const receivable = await transaction.accountReceivable.findUnique({ where: { id } });
    if (!receivable || ["RECEIVED", "CANCELED"].includes(receivable.status)) {
      throw new FinancialEntriesApiError("Este título não pode receber nova baixa.", 409);
    }
    if (!receivable.bankAccountId) throw new FinancialEntriesApiError("Defina a conta bancária deste recebimento.");
    const bank = await transaction.bankAccount.findFirst({
      where: { id: receivable.bankAccountId, companyId: receivable.companyId, active: true, deletedAt: null },
    });
    if (!bank) throw new FinancialEntriesApiError("Conta bancária inválida para este recebimento.");
    const total = Number(receivable.amount) + Number(receivable.interest) + Number(receivable.penalty) - Number(receivable.discount);
    const outstanding = Math.max(total - Number(receivable.receivedAmount), 0);
    if (outstanding <= 0) throw new FinancialEntriesApiError("Este título já foi integralmente recebido.", 409);
    const receivedNow = Math.min(requestedAmount, outstanding);
    const fullyReceived = outstanding - receivedNow <= 0.01;
    await transaction.accountReceivableReceipt.create({
      data: {
        receivableId: id,
        bankAccountId: bank.id,
        date: date(body?.date, "Data do recebimento"),
        amount: receivedNow,
        registeredById: profile.id,
      },
    });
    const updated = await transaction.accountReceivable.update({
      where: { id },
      data: {
        receivedAmount: { increment: receivedNow },
        receiptDate: date(body?.date, "Data do recebimento"),
        status: fullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED",
      },
    });
    const updatedBank = await transaction.bankAccount.update({ where: { id: bank.id }, data: { balance: { increment: receivedNow } } });
    await audit(transaction, profile, initial.company, "RECEBER_CONTA_RECEBER", "AccountReceivable", id, mapReceivable(receivable), mapReceivable(updated));
    return { receivable: mapReceivable(updated), bankAccount: mapBankAccount(updatedBank) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function decidePaymentApproval(
  profile: FinancialEntriesProfile,
  approvalId: string,
  body: any,
) {
  const database = getDatabaseClient();
  const decision = APPROVAL_DECISION_TO_DATABASE[body?.decision as keyof typeof APPROVAL_DECISION_TO_DATABASE];
  if (!decision) throw new FinancialEntriesApiError("Decisão inválida.");
  const existing = await database.approval.findFirst({
    where: { id: uuid(approvalId, "Aprovação")!, type: "PAYMENT" },
    include: { ...approvalInclude, company: { select: { id: true, tenantId: true } } },
  });
  if (!existing) throw new FinancialEntriesApiError("Aprovação não encontrada.", 404);
  await requireCompany(profile, existing.companyId, "approvals.approve");
  if (existing.status !== "PENDING") throw new FinancialEntriesApiError("Esta aprovação já foi decidida.", 409);
  const payableStatus = decision === "APPROVED" ? "UPCOMING" : decision === "REJECTED" ? "REJECTED" : "PENDING";
  return database.$transaction(async (transaction) => {
    await transaction.approvalStep.create({
      data: {
        approvalId: existing.id,
        userId: profile.id,
        role: profile.companyMemberships.find(({ companyId }) => companyId === existing.companyId)?.role || "BPO_ADMIN",
        decision,
        comment: optionalText(body?.comment, 10_000),
      },
    });
    await transaction.approval.update({
      where: { id: existing.id },
      data: { status: decision, justification: optionalText(body?.comment, 10_000) },
    });
    const payable = await transaction.accountPayable.update({
      where: { id: existing.relatedEntityId },
      data: { status: payableStatus },
      include: payableInclude,
    });
    const updatedApproval = await transaction.approval.findUniqueOrThrow({ where: { id: existing.id }, include: approvalInclude });
    await audit(transaction, profile, existing.company, "DECIDIR_APROVACAO_PAGAMENTO", "Approval", existing.id, mapApproval(existing), mapApproval(updatedApproval));
    return { approval: mapApproval(updatedApproval), payable: mapPayable(payable) };
  });
}
