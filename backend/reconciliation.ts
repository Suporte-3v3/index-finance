import { Prisma } from "./generated/prisma/client.js";
import { getDatabaseClient } from "./database.js";
import { writeNotification } from "./notifications.js";

type Role = "BPO_ADMIN" | "BPO_TEAM" | "CLIENT" | "ACCOUNTANT";
export interface ReconciliationProfile {
  id: string;
  isPlatformAdmin: boolean;
  tenantMemberships: Array<{ tenantId: string; role: Role }>;
  companyMemberships: Array<{ companyId: string; role: Role; permissions?: string[] }>;
}

export class ReconciliationApiError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function optionalText(value: unknown, max: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new ReconciliationApiError("Campo inválido.");
  const normalized = value.trim();
  if (normalized.length > max) throw new ReconciliationApiError("Campo excede o tamanho permitido.");
  return normalized || null;
}

function text(value: unknown, field: string, max: number) {
  const normalized = optionalText(value, max);
  if (!normalized) throw new ReconciliationApiError(`Informe ${field}.`);
  return normalized;
}

function uuid(value: unknown, field: string) {
  const normalized = optionalText(value, 36);
  if (!normalized || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new ReconciliationApiError(`${field} inválido.`);
  }
  return normalized;
}

function date(value: unknown) {
  const normalized = text(value, "a data", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new ReconciliationApiError("Data inválida.");
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new ReconciliationApiError("Data inválida.");
  }
  return parsed;
}

function amount(value: unknown, allowZero = true) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || (!allowZero && normalized === 0) || Math.abs(normalized) > 999_999_999_999_999) {
    throw new ReconciliationApiError("Valor inválido.");
  }
  return Math.round((normalized + Number.EPSILON) * 100) / 100;
}

function adminTenantIds(profile: ReconciliationProfile) {
  return profile.tenantMemberships.filter(({ role }) => role === "BPO_ADMIN").map(({ tenantId }) => tenantId);
}

function accessibleTenantIds(profile: ReconciliationProfile) {
  return profile.tenantMemberships.filter(({ role }) => role === "BPO_ADMIN" || role === "BPO_TEAM").map(({ tenantId }) => tenantId);
}

function hasPermission(profile: ReconciliationProfile, company: { id: string; tenantId: string }, permission: string) {
  return profile.isPlatformAdmin || adminTenantIds(profile).includes(company.tenantId) || profile.companyMemberships.some(
    (membership) => membership.companyId === company.id &&
      (membership.role === "BPO_ADMIN" || membership.permissions?.includes(permission)),
  );
}

async function requireBankAccount(profile: ReconciliationProfile, bankAccountId: string, permission: string) {
  const account = await getDatabaseClient().bankAccount.findFirst({
    where: { id: uuid(bankAccountId, "Conta bancária"), deletedAt: null, company: { deletedAt: null } },
    include: { company: { select: { id: true, tenantId: true } } },
  });
  if (!account) throw new ReconciliationApiError("Conta bancária não encontrada.", 404);
  if (!hasPermission(profile, account.company, permission)) throw new ReconciliationApiError("Sem permissão para esta operação.", 403);
  return account;
}

const STATUS_FROM_DATABASE = {
  PENDING: "Pendente",
  RECONCILED: "Conciliada",
  PARTIALLY_RECONCILED: "Parcialmente conciliada",
  DIVERGENT: "Divergente",
  IGNORED: "Ignorada",
} as const;

function mapEntry(entry: any) {
  const reconciliation = entry.reconciliations?.find((item: any) => !item.reversedAt);
  return {
    id: entry.id,
    date: entry.date.toISOString().slice(0, 10),
    description: entry.description,
    amount: Number(entry.amount),
    documentNumber: entry.documentNumber || undefined,
    isReconciled: entry.reconciliationStatus !== "PENDING" && entry.reconciliationStatus !== "DIVERGENT",
    reconciliationStatus: STATUS_FROM_DATABASE[entry.reconciliationStatus as keyof typeof STATUS_FROM_DATABASE] || "Pendente",
    matchedTransactionId: reconciliation?.financialEntityId,
  };
}

async function audit(
  tx: Prisma.TransactionClient,
  profile: ReconciliationProfile,
  company: { id: string; tenantId: string },
  action: string,
  entityId: string,
  nextData: unknown,
) {
  await tx.auditLog.create({
    data: {
      tenantId: company.tenantId,
      companyId: company.id,
      userId: profile.id,
      action,
      entityType: "BankStatementEntry",
      entityId,
      previousData: Prisma.JsonNull,
      nextData: JSON.parse(JSON.stringify(nextData)) as Prisma.InputJsonValue,
    },
  });
}

export async function listStatementEntries(profile: ReconciliationProfile) {
  const companies = await getDatabaseClient().company.findMany({
    where: profile.isPlatformAdmin ? { deletedAt: null } : {
      deletedAt: null,
      OR: [
        { tenantId: { in: accessibleTenantIds(profile) } },
        { id: { in: profile.companyMemberships.map(({ companyId }) => companyId) } },
      ],
    },
    select: { id: true, tenantId: true },
  });
  const permitted = companies.filter((company) =>
    hasPermission(profile, company, "reconciliation.view") || hasPermission(profile, company, "reconciliation.execute"),
  );
  const entries = await getDatabaseClient().bankStatementEntry.findMany({
    where: { companyId: { in: permitted.map(({ id }) => id) } },
    include: { reconciliations: { where: { reversedAt: null }, orderBy: { createdAt: "desc" } } },
    orderBy: [{ date: "desc" }, { importedAt: "desc" }],
  });
  const statementItems: Record<string, ReturnType<typeof mapEntry>[]> = {};
  for (const entry of entries) {
    (statementItems[entry.bankAccountId] ||= []).push(mapEntry(entry));
  }
  return { statementItems };
}

export async function importStatementEntries(profile: ReconciliationProfile, bankAccountId: string, body: any) {
  const account = await requireBankAccount(profile, bankAccountId, "reconciliation.execute");
  if (!Array.isArray(body?.entries)) throw new ReconciliationApiError("Informe os itens do extrato.");
  if (body.entries.length > 10_000) throw new ReconciliationApiError("O extrato excede o limite de 10.000 itens.");
  const rows = body.entries.map((entry: any) => ({
    companyId: account.companyId,
    bankAccountId: account.id,
    externalId: text(entry.id ?? entry.externalId, "o identificador externo", 160),
    date: date(entry.date),
    description: text(entry.description, "a descrição", 500),
    amount: amount(entry.amount),
    documentNumber: optionalText(entry.documentNumber, 100),
  }));
  const result = await getDatabaseClient().$transaction(async (tx) => {
    const created = await tx.bankStatementEntry.createMany({ data: rows, skipDuplicates: true });
    await audit(tx, profile, account.company, "IMPORTAR_EXTRATO", account.id, { importedCount: created.count });
    await writeNotification(tx, {
      companyId: account.company.id,
      title: "Extrato bancário importado",
      message: `${created.count} lançamento(s) importado(s) para ${account.bankName}.`,
      type: "INFO",
    });
    return created.count;
  });
  const entries = await getDatabaseClient().bankStatementEntry.findMany({
    where: { bankAccountId: account.id },
    include: { reconciliations: { where: { reversedAt: null } } },
    orderBy: [{ date: "desc" }, { importedAt: "desc" }],
  });
  return { importedCount: result, items: entries.map(mapEntry) };
}

async function reconcileInTransaction(
  tx: Prisma.TransactionClient,
  profile: ReconciliationProfile,
  account: any,
  entry: any,
  financialRecordId: string,
  type: "A_PAGAR" | "A_RECEBER",
  notes: string | null,
) {
  if (entry.reconciliationStatus !== "PENDING") throw new ReconciliationApiError("Este item do extrato já foi tratado.", 409);
  const bankAmount = Number(entry.amount);
  if (bankAmount === 0) throw new ReconciliationApiError("Um item de valor zero não pode ser conciliado.");
  const absoluteAmount = Math.abs(bankAmount);
  let partial = false;

  if (type === "A_PAGAR") {
    if (bankAmount >= 0) throw new ReconciliationApiError("Uma entrada bancária não pode quitar uma conta a pagar.");
    const payable = await tx.accountPayable.findFirst({ where: { id: financialRecordId, companyId: account.companyId, bankAccountId: account.id, deletedAt: null } });
    if (!payable) throw new ReconciliationApiError("Conta a pagar não encontrada.", 404);
    if (["PAID", "CANCELED", "REJECTED"].includes(payable.status)) throw new ReconciliationApiError("A conta a pagar não pode ser conciliada no status atual.", 409);
    const outstanding = Number(payable.amount) + Number(payable.interest) + Number(payable.penalty) - Number(payable.discount) - Number(payable.paidAmount);
    if (Math.round(outstanding * 100) !== Math.round(absoluteAmount * 100)) throw new ReconciliationApiError("O valor do extrato é diferente do saldo da conta a pagar.", 409);
    await tx.accountPayablePayment.create({ data: { payableId: payable.id, bankAccountId: account.id, date: entry.date, amount: absoluteAmount, notes, registeredById: profile.id } });
    await tx.accountPayable.update({ where: { id: payable.id }, data: { paidAmount: Number(payable.paidAmount) + absoluteAmount, status: "PAID", paymentDate: entry.date } });
    await tx.bankAccount.update({ where: { id: account.id }, data: { balance: { decrement: absoluteAmount } } });
  } else {
    if (bankAmount <= 0) throw new ReconciliationApiError("Uma saída bancária não pode ser vinculada a uma conta a receber.");
    const receivable = await tx.accountReceivable.findFirst({ where: { id: financialRecordId, companyId: account.companyId, bankAccountId: account.id, deletedAt: null } });
    if (!receivable) throw new ReconciliationApiError("Conta a receber não encontrada.", 404);
    if (["RECEIVED", "CANCELED"].includes(receivable.status)) throw new ReconciliationApiError("A conta a receber não pode ser conciliada no status atual.", 409);
    const outstanding = Number(receivable.amount) + Number(receivable.interest) + Number(receivable.penalty) - Number(receivable.discount) - Number(receivable.receivedAmount);
    if (Math.round(absoluteAmount * 100) > Math.round(outstanding * 100)) throw new ReconciliationApiError("O valor do extrato supera o saldo da conta a receber.", 409);
    const receivedAmount = Number(receivable.receivedAmount) + absoluteAmount;
    partial = Math.round(receivedAmount * 100) < Math.round((Number(receivable.amount) + Number(receivable.interest) + Number(receivable.penalty) - Number(receivable.discount)) * 100);
    await tx.accountReceivableReceipt.create({ data: { receivableId: receivable.id, bankAccountId: account.id, date: entry.date, amount: absoluteAmount, notes, registeredById: profile.id } });
    await tx.accountReceivable.update({ where: { id: receivable.id }, data: { receivedAmount, status: partial ? "PARTIALLY_RECEIVED" : "RECEIVED", receiptDate: partial ? null : entry.date } });
    await tx.bankAccount.update({ where: { id: account.id }, data: { balance: { increment: absoluteAmount } } });
  }

  const reconciliation = await tx.reconciliation.create({
    data: {
      companyId: account.companyId,
      bankAccountId: account.id,
      statementEntryId: entry.id,
      financialEntityType: type === "A_PAGAR" ? "AccountPayable" : "AccountReceivable",
      financialEntityId: financialRecordId,
      amount: absoluteAmount,
      notes,
      reconciledById: profile.id,
    },
  });
  const updatedEntry = await tx.bankStatementEntry.update({
    where: { id: entry.id },
    data: { reconciliationStatus: partial ? "PARTIALLY_RECONCILED" : "RECONCILED" },
    include: { reconciliations: { where: { reversedAt: null } } },
  });
  await audit(tx, profile, account.company, "CONCILIAR_EXTRATO", entry.id, { financialRecordId, type, partial });
  await writeNotification(tx, {
    companyId: account.company.id,
    title: "Item do extrato conciliado",
    message: `${entry.description} foi conciliado.`,
    type: "SUCCESS",
  });
  return { item: mapEntry(updatedEntry), reconciliationId: reconciliation.id, partial };
}

export async function reconcileStatementEntry(profile: ReconciliationProfile, bankAccountId: string, statementItemId: string, body: any) {
  const account = await requireBankAccount(profile, bankAccountId, "reconciliation.execute");
  const entryId = uuid(statementItemId, "Item do extrato");
  const financialRecordId = uuid(body?.financialRecordId, "Lançamento financeiro");
  const type = body?.type;
  if (type !== "A_PAGAR" && type !== "A_RECEBER") throw new ReconciliationApiError("Tipo de conciliação inválido.");
  const notes = optionalText(body?.notes, 10_000);
  return getDatabaseClient().$transaction(async (tx) => {
    const entry = await tx.bankStatementEntry.findFirst({ where: { id: entryId, bankAccountId: account.id, companyId: account.companyId } });
    if (!entry) throw new ReconciliationApiError("Item do extrato não encontrado.", 404);
    return reconcileInTransaction(tx, profile, account, entry, financialRecordId, type, notes);
  });
}

export async function autoReconcileStatementEntries(profile: ReconciliationProfile, bankAccountId: string) {
  const account = await requireBankAccount(profile, bankAccountId, "reconciliation.execute");
  return getDatabaseClient().$transaction(async (tx) => {
    const entries = await tx.bankStatementEntry.findMany({ where: { bankAccountId: account.id, reconciliationStatus: "PENDING", amount: { not: 0 } }, orderBy: { date: "asc" } });
    const payables = await tx.accountPayable.findMany({ where: { companyId: account.companyId, bankAccountId: account.id, deletedAt: null, status: { notIn: ["PAID", "CANCELED", "REJECTED"] } } });
    const receivables = await tx.accountReceivable.findMany({ where: { companyId: account.companyId, bankAccountId: account.id, deletedAt: null, status: { notIn: ["RECEIVED", "CANCELED"] } } });
    const used = new Set<string>();
    const items = [];
    for (const entry of entries) {
      const bankAmount = Number(entry.amount);
      const match = bankAmount < 0
        ? payables.find((item) => !used.has(item.id) && Math.round((Number(item.amount) + Number(item.interest) + Number(item.penalty) - Number(item.discount) - Number(item.paidAmount)) * 100) === Math.round(Math.abs(bankAmount) * 100))
        : receivables.find((item) => !used.has(item.id) && Math.round((Number(item.amount) + Number(item.interest) + Number(item.penalty) - Number(item.discount) - Number(item.receivedAmount)) * 100) === Math.round(bankAmount * 100));
      if (!match) continue;
      used.add(match.id);
      items.push(await reconcileInTransaction(tx, profile, account, entry, match.id, bankAmount < 0 ? "A_PAGAR" : "A_RECEBER", "Conciliação automática"));
    }
    return { matchedCount: items.length, items: items.map(({ item }) => item) };
  });
}

export async function ignoreStatementEntry(profile: ReconciliationProfile, bankAccountId: string, statementItemId: string, body: any) {
  const account = await requireBankAccount(profile, bankAccountId, "reconciliation.execute");
  const reason = text(body?.reason, "o motivo", 10_000);
  return getDatabaseClient().$transaction(async (tx) => {
    const existing = await tx.bankStatementEntry.findFirst({ where: { id: uuid(statementItemId, "Item do extrato"), bankAccountId: account.id, companyId: account.companyId } });
    if (!existing) throw new ReconciliationApiError("Item do extrato não encontrado.", 404);
    if (existing.reconciliationStatus !== "PENDING") throw new ReconciliationApiError("Este item do extrato já foi tratado.", 409);
    const updated = await tx.bankStatementEntry.update({ where: { id: existing.id }, data: { reconciliationStatus: "IGNORED" }, include: { reconciliations: { where: { reversedAt: null } } } });
    await audit(tx, profile, account.company, "IGNORAR_ITEM_EXTRATO", existing.id, { reason });
    await writeNotification(tx, {
      companyId: account.company.id,
      title: "Item do extrato ignorado",
      message: `${existing.description} foi marcado como ignorado.`,
      type: "WARNING",
    });
    return mapEntry(updated);
  });
}
