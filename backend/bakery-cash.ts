import { Prisma } from "./generated/prisma/client.js";
import { getDatabaseClient } from "./database.js";
import { ensureBolsaBankAccount } from "./financial-setup.js";

type Role = "BPO_ADMIN" | "BPO_TEAM" | "CLIENT" | "ACCOUNTANT";

export interface BakeryAccessProfile {
  id: string;
  name: string;
  isPlatformAdmin: boolean;
  tenantMemberships: Array<{ tenantId: string; role: Role }>;
  companyMemberships: Array<{ companyId: string; role: Role; clientOperator?: boolean }>;
}

export class BakeryCashApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const STATUS_TO_DATABASE = {
  Aberto: "OPEN",
  "Aguardando fechamento": "AWAITING_CLOSE",
  Fechado: "CLOSED",
  Reaberto: "REOPENED",
  Cancelado: "CANCELED",
} as const;
const STATUS_FROM_DATABASE = {
  OPEN: "Aberto",
  AWAITING_CLOSE: "Aguardando fechamento",
  CLOSED: "Fechado",
  REOPENED: "Reaberto",
  CANCELED: "Cancelado",
} as const;
const RECONCILIATION_TO_DATABASE = {
  "Aguardando conciliação": "AWAITING",
  Conciliado: "RECONCILED",
  Divergente: "DIVERGENT",
} as const;
const RECONCILIATION_FROM_DATABASE = {
  AWAITING: "Aguardando conciliação",
  RECONCILED: "Conciliado",
  DIVERGENT: "Divergente",
} as const;

function text(value: unknown, field: string, max: number) {
  if (typeof value !== "string" || !value.trim()) throw new BakeryCashApiError(`Informe ${field}.`);
  const normalized = value.trim();
  if (normalized.length > max) throw new BakeryCashApiError(`${field} excede o tamanho permitido.`);
  return normalized;
}
function optionalText(value: unknown, max: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new BakeryCashApiError("Campo inválido.");
  const normalized = value.trim();
  if (normalized.length > max) throw new BakeryCashApiError("Campo excede o tamanho permitido.");
  return normalized || null;
}
function uuid(value: unknown, field: string, required = true) {
  const normalized = optionalText(value, 36);
  if (!normalized && !required) return null;
  if (!normalized || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new BakeryCashApiError(`${field} inválido.`);
  }
  return normalized;
}
function money(value: unknown, field: string) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || Math.abs(normalized) > 999_999_999_999_999) {
    throw new BakeryCashApiError(`${field} inválido.`);
  }
  return Math.round((normalized + Number.EPSILON) * 100) / 100;
}
function nonNegativeMoney(value: unknown, field: string) {
  const normalized = money(value, field);
  if (normalized < 0) throw new BakeryCashApiError(`${field} não pode ser negativo.`);
  return normalized;
}
function positiveMoney(value: unknown, field: string) {
  const normalized = money(value, field);
  if (normalized <= 0) throw new BakeryCashApiError(`${field} deve ser maior que zero.`);
  return normalized;
}
function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
function num(value: Prisma.Decimal | number | null | undefined) {
  return value == null ? 0 : Number(value);
}

function accessibleTenantIds(profile: BakeryAccessProfile) {
  return profile.tenantMemberships
    .filter(({ role }) => role === "BPO_ADMIN" || role === "BPO_TEAM")
    .map(({ tenantId }) => tenantId);
}
function isBpoForCompany(profile: BakeryAccessProfile, company: { id: string; tenantId: string }) {
  return (
    profile.isPlatformAdmin ||
    accessibleTenantIds(profile).includes(company.tenantId) ||
    profile.companyMemberships.some(
      ({ companyId, role }) => companyId === company.id && (role === "BPO_ADMIN" || role === "BPO_TEAM"),
    )
  );
}
function canOperateCompany(profile: BakeryAccessProfile, company: { id: string; tenantId: string }) {
  return (
    isBpoForCompany(profile, company) ||
    profile.companyMemberships.some(
      ({ companyId, role, clientOperator }) =>
        companyId === company.id && role === "CLIENT" && clientOperator === true,
    )
  );
}
function accessibleCompanyIds(profile: BakeryAccessProfile) {
  return profile.companyMemberships.map(({ companyId }) => companyId);
}

async function requireCompany(profile: BakeryAccessProfile, companyId: string, permission: "read" | "operate") {
  const company = await getDatabaseClient().company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { id: true, tenantId: true },
  });
  if (!company) throw new BakeryCashApiError("Empresa não encontrada.", 404);
  const allowed =
    permission === "operate"
      ? canOperateCompany(profile, company)
      : profile.isPlatformAdmin ||
        accessibleTenantIds(profile).includes(company.tenantId) ||
        accessibleCompanyIds(profile).includes(company.id);
  if (!allowed) throw new BakeryCashApiError("Sem permissão para esta empresa.", 403);
  return company;
}

const CARD_MACHINE_INCLUDE = { cardMachineEntries: { orderBy: { createdAt: "asc" as const } } };
const SHIFT_INCLUDE = {
  cardMachineEntries: { where: { closeSnapshotId: null }, orderBy: { createdAt: "asc" as const } },
  closeSnapshots: { include: CARD_MACHINE_INCLUDE, orderBy: { createdAt: "asc" as const } },
};

function mapShift(item: any) {
  return {
    id: item.id,
    companyId: item.companyId,
    registerId: item.registerId,
    registerName: item.registerName,
    shiftLabel: item.shiftLabel,
    operatorId: item.operatorId,
    operatorName: item.operatorName,
    status: STATUS_FROM_DATABASE[item.status as keyof typeof STATUS_FROM_DATABASE],
    openedAt: item.openedAt.toISOString(),
    initialBalance: num(item.initialBalance),
    openNote: item.openNote || undefined,
    initialBalanceJustification: item.initialBalanceJustification || undefined,
    previousShiftFinalBalance: item.previousShiftFinalBalance != null ? num(item.previousShiftFinalBalance) : undefined,
    closedAt: item.closedAt ? item.closedAt.toISOString() : undefined,
    finalBalanceCounted: item.finalBalanceCounted != null ? num(item.finalBalanceCounted) : undefined,
    closeNote: item.closeNote || undefined,
    estimatedCashRevenue: item.estimatedCashRevenue != null ? num(item.estimatedCashRevenue) : undefined,
    pixRevenueTotal: item.pixRevenueTotal != null ? num(item.pixRevenueTotal) : undefined,
    cardMachineEntries: (item.cardMachineEntries || []).map(mapCardMachineEntry),
    cardMachineTotal: item.cardMachineTotal != null ? num(item.cardMachineTotal) : undefined,
    totalRevenue: item.totalRevenue != null ? num(item.totalRevenue) : undefined,
    reopenedAt: item.reopenedAt ? item.reopenedAt.toISOString() : undefined,
    reopenedById: item.reopenedById || undefined,
    reopenedByName: item.reopenedByName || undefined,
    reopenReason: item.reopenReason || undefined,
    closeHistory: (item.closeSnapshots || []).map(mapCloseSnapshot),
  };
}
function mapCloseSnapshot(item: any) {
  return {
    closedAt: item.closedAt.toISOString(),
    finalBalanceCounted: num(item.finalBalanceCounted),
    estimatedCashRevenue: num(item.estimatedCashRevenue),
    pixRevenueTotal: num(item.pixRevenueTotal),
    cardMachineTotal: num(item.cardMachineTotal),
    cardMachineEntries: (item.cardMachineEntries || []).map(mapCardMachineEntry),
    totalRevenue: num(item.totalRevenue),
    changedById: item.changedById,
    changedByName: item.changedByName,
    reason: item.reason || undefined,
  };
}
function mapCardMachineEntry(item: any) {
  return { id: item.id, bankAccountId: item.bankAccountId, bankAccountName: item.bankAccountName, amount: num(item.amount) };
}
function mapExpense(item: any) {
  return {
    id: item.id,
    companyId: item.companyId,
    shiftId: item.shiftId,
    description: item.description,
    supplier: item.supplier || undefined,
    amount: num(item.amount),
    source: item.source,
    category: item.category || undefined,
    note: item.note || undefined,
    receiptUrl: item.receiptObjectKey || undefined,
    createdAt: item.createdAt.toISOString(),
    createdById: item.createdById,
    createdByName: item.createdByName,
    canceled: item.canceled || undefined,
    canceledAt: item.canceledAt ? item.canceledAt.toISOString() : undefined,
    canceledById: item.canceledById || undefined,
  };
}
function mapWithdrawal(item: any) {
  return {
    id: item.id,
    companyId: item.companyId,
    shiftId: item.shiftId,
    amount: num(item.amount),
    note: item.note || undefined,
    receiptUrl: item.receiptObjectKey || undefined,
    createdAt: item.createdAt.toISOString(),
    createdById: item.createdById,
    createdByName: item.createdByName,
    canceled: item.canceled || undefined,
    canceledAt: item.canceledAt ? item.canceledAt.toISOString() : undefined,
    canceledById: item.canceledById || undefined,
  };
}
function mapPixSale(item: any) {
  return {
    id: item.id,
    companyId: item.companyId,
    shiftId: item.shiftId,
    amount: num(item.amount),
    bankAccountId: item.bankAccountId,
    bankAccountName: item.bankAccountName,
    customerName: item.customerName || undefined,
    description: item.description || undefined,
    note: item.note || undefined,
    receiptUrl: item.receiptObjectKey || undefined,
    createdAt: item.createdAt.toISOString(),
    createdById: item.createdById,
    createdByName: item.createdByName,
    reconciliationStatus: RECONCILIATION_FROM_DATABASE[item.reconciliationStatus as keyof typeof RECONCILIATION_FROM_DATABASE],
    reconciledAt: item.reconciledAt ? item.reconciledAt.toISOString() : undefined,
    reconciledById: item.reconciledById || undefined,
    canceled: item.canceled || undefined,
    canceledAt: item.canceledAt ? item.canceledAt.toISOString() : undefined,
    canceledById: item.canceledById || undefined,
  };
}

async function adjustBalance(
  transaction: Prisma.TransactionClient,
  profile: BakeryAccessProfile,
  company: { id: string; tenantId: string },
  bankAccountId: string,
  delta: number,
  action: string,
  entityType: string,
  entityId: string,
) {
  const updated = await transaction.bankAccount.update({
    where: { id: bankAccountId },
    data: { balance: { increment: delta } },
  });
  await transaction.auditLog.create({
    data: {
      tenantId: company.tenantId,
      companyId: company.id,
      userId: profile.id,
      action,
      entityType: "BankAccount",
      entityId: bankAccountId,
      nextData: { balance: Number(updated.balance), sourceEntityType: entityType, sourceEntityId: entityId },
    },
  });
}

async function findBolsaAccount(companyId: string) {
  const account = await getDatabaseClient().bankAccount.findFirst({
    where: { companyId, isBolsaAccount: true, active: true, deletedAt: null },
  });
  if (!account) throw new BakeryCashApiError("Conta Bolsa não encontrada para esta empresa.", 404);
  return account;
}

async function requireEditableShift(profile: BakeryAccessProfile, shiftId: string) {
  const shift = await getDatabaseClient().bakeryShift.findFirst({
    where: { id: uuid(shiftId, "o turno") },
    include: { company: { select: { id: true, tenantId: true, deletedAt: true } } },
  });
  if (!shift || shift.company.deletedAt) throw new BakeryCashApiError("Turno não encontrado.", 404);
  const canEdit = isBpoForCompany(profile, shift.company) || shift.operatorId === profile.id;
  if (!canEdit) throw new BakeryCashApiError("Sem permissão para este turno.", 403);
  if (shift.status !== "OPEN" && shift.status !== "REOPENED") {
    throw new BakeryCashApiError("O turno não está aberto para lançamentos.", 409);
  }
  return shift;
}

export async function listBakeryCash(profile: BakeryAccessProfile) {
  const database = getDatabaseClient();
  const companies = await database.company.findMany({
    where: profile.isPlatformAdmin
      ? { deletedAt: null }
      : {
          deletedAt: null,
          OR: [
            { tenantId: { in: accessibleTenantIds(profile) } },
            { id: { in: accessibleCompanyIds(profile) } },
          ],
        },
    select: { id: true },
  });
  const companyIds = companies.map(({ id }) => id);
  const [shifts, expenses, withdrawals, pixSales] = await Promise.all([
    database.bakeryShift.findMany({ where: { companyId: { in: companyIds } }, include: SHIFT_INCLUDE, orderBy: { openedAt: "desc" } }),
    database.bakeryExpense.findMany({ where: { companyId: { in: companyIds } }, orderBy: { createdAt: "desc" } }),
    database.bakeryWithdrawal.findMany({ where: { companyId: { in: companyIds } }, orderBy: { createdAt: "desc" } }),
    database.bakeryPixSale.findMany({ where: { companyId: { in: companyIds } }, orderBy: { createdAt: "desc" } }),
  ]);
  return {
    shifts: shifts.map(mapShift),
    expenses: expenses.map(mapExpense),
    withdrawals: withdrawals.map(mapWithdrawal),
    pixSales: pixSales.map(mapPixSale),
  };
}

export async function openShift(profile: BakeryAccessProfile, body: any) {
  const companyId = uuid(body?.companyId, "a empresa");
  const company = await requireCompany(profile, companyId, "operate");
  const registerId = uuid(body?.registerId, "o caixa");
  const database = getDatabaseClient();

  const register = await database.masterDataOption.findFirst({
    where: { id: registerId, companyId, type: "BAKERY_REGISTER", active: true },
  });
  if (!register) throw new BakeryCashApiError("Caixa inválido.", 404);

  const openStatuses = ["OPEN", "AWAITING_CLOSE", "REOPENED"] as const;
  const operatorHasOpenShift = await database.bakeryShift.findFirst({
    where: { operatorId: profile.id, status: { in: [...openStatuses] } },
  });
  if (operatorHasOpenShift) throw new BakeryCashApiError("Você já possui um turno aberto.", 409);
  const registerInUse = await database.bakeryShift.findFirst({
    where: { registerId, status: { in: [...openStatuses] } },
  });
  if (registerInUse) throw new BakeryCashApiError("Este caixa já está em uso em outro turno.", 409);

  const lastClosed = await database.bakeryShift.findFirst({
    where: { registerId, status: "CLOSED" },
    orderBy: { closedAt: "desc" },
  });

  await ensureBolsaBankAccount(profile as any, companyId);

  const shift = await database.$transaction(async (transaction) => {
    const created = await transaction.bakeryShift.create({
      data: {
        companyId,
        registerId,
        registerName: register.name,
        shiftLabel: text(body?.shiftLabel, "o turno", 80),
        operatorId: profile.id,
        operatorName: profile.name,
        status: "OPEN",
        initialBalance: nonNegativeMoney(body?.initialBalance, "o saldo inicial"),
        openNote: optionalText(body?.openNote, 2000),
        initialBalanceJustification: optionalText(body?.initialBalanceJustification, 2000),
        previousShiftFinalBalance: lastClosed?.finalBalanceCounted ?? undefined,
      },
      include: SHIFT_INCLUDE,
    });
    await transaction.auditLog.create({
      data: {
        tenantId: company.tenantId,
        companyId: company.id,
        userId: profile.id,
        action: "ABRIR_TURNO_CAIXA",
        entityType: "BakeryShift",
        entityId: created.id,
        nextData: { registerName: created.registerName, initialBalance: Number(created.initialBalance) },
      },
    });
    return created;
  });
  return mapShift(shift);
}

export async function addExpense(profile: BakeryAccessProfile, body: any) {
  const shift = await requireEditableShift(profile, body?.shiftId);
  const source = body?.source === "BOLSA" ? "BOLSA" : body?.source === "CAIXA" ? "CAIXA" : null;
  if (!source) throw new BakeryCashApiError("Origem da despesa inválida.");
  const amount = positiveMoney(body?.amount, "o valor da despesa");
  const database = getDatabaseClient();
  const bolsa = source === "BOLSA" ? await findBolsaAccount(shift.companyId) : null;

  const expense = await database.$transaction(async (transaction) => {
    const created = await transaction.bakeryExpense.create({
      data: {
        companyId: shift.companyId,
        shiftId: shift.id,
        description: text(body?.description, "a descrição", 300),
        supplier: optionalText(body?.supplier, 200),
        amount,
        source,
        category: optionalText(body?.category, 160),
        note: optionalText(body?.note, 2000),
        receiptObjectKey: optionalText(body?.receiptUrl, 500),
        createdById: profile.id,
        createdByName: profile.name,
      },
    });
    if (bolsa) {
      await adjustBalance(transaction, profile, shift.company, bolsa.id, -amount, "CAIXA_PADARIA_DESPESA_BOLSA", "BakeryExpense", created.id);
    }
    return created;
  });
  return mapExpense(expense);
}

export async function cancelExpense(profile: BakeryAccessProfile, expenseId: string) {
  const database = getDatabaseClient();
  const expense = await database.bakeryExpense.findFirst({ where: { id: uuid(expenseId, "a despesa") } });
  if (!expense) throw new BakeryCashApiError("Despesa não encontrada.", 404);
  if (expense.canceled) throw new BakeryCashApiError("Esta despesa já está cancelada.", 409);
  const shift = await requireEditableShift(profile, expense.shiftId);

  const updated = await database.$transaction(async (transaction) => {
    const canceled = await transaction.bakeryExpense.update({
      where: { id: expense.id },
      data: { canceled: true, canceledAt: new Date(), canceledById: profile.id },
    });
    if (expense.source === "BOLSA") {
      const bolsa = await findBolsaAccount(shift.companyId);
      await adjustBalance(
        transaction,
        profile,
        shift.company,
        bolsa.id,
        Number(expense.amount),
        "CAIXA_PADARIA_CANCELAR_DESPESA_BOLSA",
        "BakeryExpense",
        expense.id,
      );
    }
    return canceled;
  });
  return mapExpense(updated);
}

export async function addWithdrawal(profile: BakeryAccessProfile, body: any) {
  const shift = await requireEditableShift(profile, body?.shiftId);
  const amount = positiveMoney(body?.amount, "o valor da sangria");
  const bolsa = await findBolsaAccount(shift.companyId);
  const database = getDatabaseClient();

  const withdrawal = await database.$transaction(async (transaction) => {
    const created = await transaction.bakeryWithdrawal.create({
      data: {
        companyId: shift.companyId,
        shiftId: shift.id,
        amount,
        note: optionalText(body?.note, 2000),
        receiptObjectKey: optionalText(body?.receiptUrl, 500),
        createdById: profile.id,
        createdByName: profile.name,
      },
    });
    await adjustBalance(transaction, profile, shift.company, bolsa.id, amount, "CAIXA_PADARIA_SANGRIA", "BakeryWithdrawal", created.id);
    return created;
  });
  return mapWithdrawal(withdrawal);
}

export async function cancelWithdrawal(profile: BakeryAccessProfile, withdrawalId: string) {
  const database = getDatabaseClient();
  const withdrawal = await database.bakeryWithdrawal.findFirst({ where: { id: uuid(withdrawalId, "a sangria") } });
  if (!withdrawal) throw new BakeryCashApiError("Sangria não encontrada.", 404);
  if (withdrawal.canceled) throw new BakeryCashApiError("Esta sangria já está cancelada.", 409);
  const shift = await requireEditableShift(profile, withdrawal.shiftId);
  const bolsa = await findBolsaAccount(shift.companyId);

  const updated = await database.$transaction(async (transaction) => {
    const canceled = await transaction.bakeryWithdrawal.update({
      where: { id: withdrawal.id },
      data: { canceled: true, canceledAt: new Date(), canceledById: profile.id },
    });
    await adjustBalance(
      transaction,
      profile,
      shift.company,
      bolsa.id,
      -Number(withdrawal.amount),
      "CAIXA_PADARIA_CANCELAR_SANGRIA",
      "BakeryWithdrawal",
      withdrawal.id,
    );
    return canceled;
  });
  return mapWithdrawal(updated);
}

export async function addPixSale(profile: BakeryAccessProfile, body: any) {
  const shift = await requireEditableShift(profile, body?.shiftId);
  const bankAccountId = uuid(body?.bankAccountId, "a conta bancária");
  const amount = positiveMoney(body?.amount, "o valor da venda");
  const database = getDatabaseClient();
  const bankAccount = await database.bankAccount.findFirst({
    where: { id: bankAccountId, companyId: shift.companyId, active: true, deletedAt: null, isBolsaAccount: false },
  });
  if (!bankAccount) throw new BakeryCashApiError("Conta bancária inválida para venda no PIX.", 404);

  const sale = await database.$transaction(async (transaction) => {
    const created = await transaction.bakeryPixSale.create({
      data: {
        companyId: shift.companyId,
        shiftId: shift.id,
        amount,
        bankAccountId: bankAccount.id,
        bankAccountName: bankAccount.bankName,
        customerName: optionalText(body?.customerName, 200),
        description: optionalText(body?.description, 2000),
        note: optionalText(body?.note, 2000),
        receiptObjectKey: optionalText(body?.receiptUrl, 500),
        createdById: profile.id,
        createdByName: profile.name,
      },
    });
    await adjustBalance(transaction, profile, shift.company, bankAccount.id, amount, "CAIXA_PADARIA_VENDA_PIX", "BakeryPixSale", created.id);
    return created;
  });
  return mapPixSale(sale);
}

export async function cancelPixSale(profile: BakeryAccessProfile, pixSaleId: string) {
  const database = getDatabaseClient();
  const sale = await database.bakeryPixSale.findFirst({ where: { id: uuid(pixSaleId, "a venda") } });
  if (!sale) throw new BakeryCashApiError("Venda não encontrada.", 404);
  if (sale.canceled) throw new BakeryCashApiError("Esta venda já está cancelada.", 409);
  const shift = await requireEditableShift(profile, sale.shiftId);
  if (sale.reconciliationStatus === "RECONCILED" && !isBpoForCompany(profile, shift.company)) {
    throw new BakeryCashApiError("Apenas a equipe BPO pode cancelar uma venda já conciliada.", 403);
  }

  const updated = await database.$transaction(async (transaction) => {
    const canceled = await transaction.bakeryPixSale.update({
      where: { id: sale.id },
      data: {
        canceled: true,
        canceledAt: new Date(),
        canceledById: profile.id,
        reconciliationStatus: "AWAITING",
        reconciledAt: null,
        reconciledById: null,
      },
    });
    await adjustBalance(
      transaction,
      profile,
      shift.company,
      sale.bankAccountId,
      -Number(sale.amount),
      "CAIXA_PADARIA_CANCELAR_VENDA_PIX",
      "BakeryPixSale",
      sale.id,
    );
    return canceled;
  });
  return mapPixSale(updated);
}

export async function setPixReconciliationStatus(profile: BakeryAccessProfile, pixSaleId: string, status: string) {
  const database = getDatabaseClient();
  const sale = await database.bakeryPixSale.findFirst({
    where: { id: uuid(pixSaleId, "a venda") },
    include: { company: { select: { id: true, tenantId: true } } },
  });
  if (!sale) throw new BakeryCashApiError("Venda não encontrada.", 404);
  if (sale.canceled) throw new BakeryCashApiError("Não é possível conciliar uma venda cancelada.", 409);
  if (!isBpoForCompany(profile, sale.company)) {
    throw new BakeryCashApiError("Apenas a equipe BPO pode conciliar vendas no PIX.", 403);
  }
  const reconciliationStatus = RECONCILIATION_TO_DATABASE[status as keyof typeof RECONCILIATION_TO_DATABASE];
  if (!reconciliationStatus) throw new BakeryCashApiError("Status de conciliação inválido.");

  const updated = await database.bakeryPixSale.update({
    where: { id: sale.id },
    data: {
      reconciliationStatus,
      reconciledAt: reconciliationStatus === "RECONCILED" ? new Date() : null,
      reconciledById: reconciliationStatus === "RECONCILED" ? profile.id : null,
    },
  });
  return mapPixSale(updated);
}

export async function markAwaitingClose(profile: BakeryAccessProfile, shiftId: string) {
  const shift = await requireEditableShift(profile, shiftId);
  const updated = await getDatabaseClient().bakeryShift.update({
    where: { id: shift.id },
    data: { status: "AWAITING_CLOSE" },
    include: SHIFT_INCLUDE,
  });
  return mapShift(updated);
}

export async function cancelPendingClose(profile: BakeryAccessProfile, shiftId: string) {
  const database = getDatabaseClient();
  const shift = await database.bakeryShift.findFirst({
    where: { id: uuid(shiftId, "o turno") },
    include: { company: { select: { id: true, tenantId: true, deletedAt: true } } },
  });
  if (!shift || shift.company.deletedAt) throw new BakeryCashApiError("Turno não encontrado.", 404);
  const canEdit = isBpoForCompany(profile, shift.company) || shift.operatorId === profile.id;
  if (!canEdit) throw new BakeryCashApiError("Sem permissão para este turno.", 403);
  if (shift.status !== "AWAITING_CLOSE") throw new BakeryCashApiError("O turno não está aguardando fechamento.", 409);

  const updated = await database.bakeryShift.update({
    where: { id: shift.id },
    data: { status: "OPEN" },
    include: SHIFT_INCLUDE,
  });
  return mapShift(updated);
}

function computeShiftTotals(
  shift: { initialBalance: Prisma.Decimal },
  finalBalanceCounted: number,
  caixaExpensesTotal: number,
  withdrawalsTotal: number,
  pixTotal: number,
  cardMachineTotal: number,
) {
  const estimatedCashRevenue = roundMoney(
    finalBalanceCounted + caixaExpensesTotal + withdrawalsTotal - Number(shift.initialBalance),
  );
  const totalRevenue = roundMoney(estimatedCashRevenue + pixTotal + cardMachineTotal);
  return { estimatedCashRevenue, totalRevenue };
}

export async function closeShift(profile: BakeryAccessProfile, body: any) {
  const database = getDatabaseClient();
  const shift = await database.bakeryShift.findFirst({
    where: { id: uuid(body?.shiftId, "o turno") },
    include: { company: { select: { id: true, tenantId: true, deletedAt: true } }, cardMachineEntries: { where: { closeSnapshotId: null } } },
  });
  if (!shift || shift.company.deletedAt) throw new BakeryCashApiError("Turno não encontrado.", 404);
  const canEdit = isBpoForCompany(profile, shift.company) || shift.operatorId === profile.id;
  if (!canEdit) throw new BakeryCashApiError("Sem permissão para este turno.", 403);
  if (shift.status !== "AWAITING_CLOSE") throw new BakeryCashApiError("O turno não está aguardando fechamento.", 409);

  const finalBalanceCounted = nonNegativeMoney(body?.finalBalanceCounted, "o saldo final contado");
  const requestedEntries: Array<{ bankAccountId: string; amount: number }> = Array.isArray(body?.cardMachineEntries)
    ? body.cardMachineEntries.map((entry: any) => ({
        bankAccountId: uuid(entry?.bankAccountId, "a conta da maquininha"),
        amount: positiveMoney(entry?.amount, "o valor da maquininha"),
      }))
    : [];
  const cardMachineAccountIds = [...new Set(requestedEntries.map((entry) => entry.bankAccountId))];
  const cardMachineAccounts = cardMachineAccountIds.length
    ? await database.bankAccount.findMany({
        where: {
          id: { in: cardMachineAccountIds },
          companyId: shift.companyId,
          active: true,
          deletedAt: null,
          isBolsaAccount: false,
        },
        select: { id: true, bankName: true },
      })
    : [];
  if (cardMachineAccounts.length !== cardMachineAccountIds.length) {
    throw new BakeryCashApiError("Conta bancária inválida para venda na maquininha.", 404);
  }
  const cardMachineAccountNames = new Map(cardMachineAccounts.map((account) => [account.id, account.bankName]));
  const entries = requestedEntries.map((entry) => ({
    ...entry,
    bankAccountName: cardMachineAccountNames.get(entry.bankAccountId)!,
  }));

  const [caixaExpenses, withdrawals, pixSales] = await Promise.all([
    database.bakeryExpense.aggregate({ where: { shiftId: shift.id, source: "CAIXA", canceled: false }, _sum: { amount: true } }),
    database.bakeryWithdrawal.aggregate({ where: { shiftId: shift.id, canceled: false }, _sum: { amount: true } }),
    database.bakeryPixSale.aggregate({ where: { shiftId: shift.id, canceled: false }, _sum: { amount: true } }),
  ]);
  const caixaExpensesTotal = num(caixaExpenses._sum.amount);
  const withdrawalsTotal = num(withdrawals._sum.amount);
  const pixTotal = num(pixSales._sum.amount);
  const cardMachineTotal = roundMoney(entries.reduce((sum, entry) => sum + entry.amount, 0));
  const { estimatedCashRevenue, totalRevenue } = computeShiftTotals(
    shift,
    finalBalanceCounted,
    caixaExpensesTotal,
    withdrawalsTotal,
    pixTotal,
    cardMachineTotal,
  );

  const updated = await database.$transaction(async (transaction) => {
    const isReclose = shift.closedAt != null;
    if (isReclose && shift.cardMachineEntries.length > 0) {
      const snapshot = await transaction.bakeryShiftCloseSnapshot.create({
        data: {
          shiftId: shift.id,
          closedAt: shift.closedAt!,
          finalBalanceCounted: shift.finalBalanceCounted!,
          estimatedCashRevenue: shift.estimatedCashRevenue!,
          pixRevenueTotal: shift.pixRevenueTotal!,
          cardMachineTotal: shift.cardMachineTotal!,
          totalRevenue: shift.totalRevenue!,
          changedById: shift.reopenedById || profile.id,
          changedByName: shift.reopenedByName || profile.name,
          reason: shift.reopenReason,
        },
      });
      for (const entry of shift.cardMachineEntries) {
        await transaction.bakeryCardMachineEntry.update({
          where: { id: entry.id },
          data: { closeSnapshotId: snapshot.id },
        });
        await adjustBalance(
          transaction,
          profile,
          shift.company,
          entry.bankAccountId,
          -Number(entry.amount),
          "CAIXA_PADARIA_ESTORNAR_MAQUININHA_REFECHAMENTO",
          "BakeryShift",
          shift.id,
        );
      }
    }

    for (const entry of entries) {
      const created = await transaction.bakeryCardMachineEntry.create({
        data: { shiftId: shift.id, bankAccountId: entry.bankAccountId, bankAccountName: entry.bankAccountName, amount: entry.amount },
      });
      await adjustBalance(transaction, profile, shift.company, entry.bankAccountId, entry.amount, "CAIXA_PADARIA_VENDA_MAQUININHA", "BakeryShift", created.id);
    }

    const closed = await transaction.bakeryShift.update({
      where: { id: shift.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        finalBalanceCounted,
        closeNote: optionalText(body?.closeNote, 2000),
        estimatedCashRevenue,
        pixRevenueTotal: pixTotal,
        cardMachineTotal,
        totalRevenue,
      },
      include: SHIFT_INCLUDE,
    });
    await transaction.auditLog.create({
      data: {
        tenantId: shift.company.tenantId,
        companyId: shift.company.id,
        userId: profile.id,
        action: "FECHAR_TURNO_CAIXA",
        entityType: "BakeryShift",
        entityId: shift.id,
        nextData: { finalBalanceCounted, totalRevenue },
      },
    });
    return closed;
  });
  return mapShift(updated);
}

export async function reopenShift(profile: BakeryAccessProfile, body: any) {
  const database = getDatabaseClient();
  const shift = await database.bakeryShift.findFirst({
    where: { id: uuid(body?.shiftId, "o turno") },
    include: { company: { select: { id: true, tenantId: true, deletedAt: true } } },
  });
  if (!shift || shift.company.deletedAt) throw new BakeryCashApiError("Turno não encontrado.", 404);
  if (!isBpoForCompany(profile, shift.company)) throw new BakeryCashApiError("Apenas a equipe BPO pode reabrir turnos.", 403);
  if (shift.status !== "CLOSED") throw new BakeryCashApiError("Apenas turnos fechados podem ser reabertos.", 409);
  const reason = text(body?.reason, "a justificativa", 2000);

  const updated = await database.$transaction(async (transaction) => {
    const reopened = await transaction.bakeryShift.update({
      where: { id: shift.id },
      data: { status: "REOPENED", reopenedAt: new Date(), reopenedById: profile.id, reopenedByName: profile.name, reopenReason: reason },
      include: SHIFT_INCLUDE,
    });
    await transaction.auditLog.create({
      data: {
        tenantId: shift.company.tenantId,
        companyId: shift.company.id,
        userId: profile.id,
        action: "REABRIR_TURNO_CAIXA",
        entityType: "BakeryShift",
        entityId: shift.id,
        nextData: { reason },
      },
    });
    return reopened;
  });
  return mapShift(updated);
}

export async function cancelShift(profile: BakeryAccessProfile, shiftId: string) {
  const database = getDatabaseClient();
  const shift = await database.bakeryShift.findFirst({
    where: { id: uuid(shiftId, "o turno") },
    include: {
      company: { select: { id: true, tenantId: true, deletedAt: true } },
      expenses: { where: { canceled: false } },
      withdrawals: { where: { canceled: false } },
      pixSales: { where: { canceled: false } },
      cardMachineEntries: { where: { closeSnapshotId: null } },
    },
  });
  if (!shift || shift.company.deletedAt) throw new BakeryCashApiError("Turno não encontrado.", 404);
  if (!isBpoForCompany(profile, shift.company)) throw new BakeryCashApiError("Apenas a equipe BPO pode cancelar turnos.", 403);
  if (shift.status === "CLOSED") throw new BakeryCashApiError("Reabra o turno antes de cancelá-lo.", 409);
  if (shift.status === "CANCELED") throw new BakeryCashApiError("Este turno já está cancelado.", 409);

  const hasBolsaMovements = shift.expenses.some((expense) => expense.source === "BOLSA") || shift.withdrawals.length > 0;
  const bolsa = hasBolsaMovements ? await findBolsaAccount(shift.companyId) : null;

  const updated = await database.$transaction(async (transaction) => {
    const canceledAt = new Date();
    for (const expense of shift.expenses) {
      await transaction.bakeryExpense.update({
        where: { id: expense.id },
        data: { canceled: true, canceledAt, canceledById: profile.id },
      });
      if (expense.source === "BOLSA") {
        await adjustBalance(
          transaction,
          profile,
          shift.company,
          bolsa!.id,
          Number(expense.amount),
          "CAIXA_PADARIA_CANCELAR_TURNO_DESPESA_BOLSA",
          "BakeryExpense",
          expense.id,
        );
      }
    }
    for (const withdrawal of shift.withdrawals) {
      await transaction.bakeryWithdrawal.update({
        where: { id: withdrawal.id },
        data: { canceled: true, canceledAt, canceledById: profile.id },
      });
      await adjustBalance(
        transaction,
        profile,
        shift.company,
        bolsa!.id,
        -Number(withdrawal.amount),
        "CAIXA_PADARIA_CANCELAR_TURNO_SANGRIA",
        "BakeryWithdrawal",
        withdrawal.id,
      );
    }
    for (const sale of shift.pixSales) {
      await transaction.bakeryPixSale.update({
        where: { id: sale.id },
        data: {
          canceled: true,
          canceledAt,
          canceledById: profile.id,
          reconciliationStatus: "AWAITING",
          reconciledAt: null,
          reconciledById: null,
        },
      });
      await adjustBalance(
        transaction,
        profile,
        shift.company,
        sale.bankAccountId,
        -Number(sale.amount),
        "CAIXA_PADARIA_CANCELAR_TURNO_VENDA_PIX",
        "BakeryPixSale",
        sale.id,
      );
    }
    if (shift.cardMachineEntries.length > 0) {
      const snapshot = await transaction.bakeryShiftCloseSnapshot.create({
        data: {
          shiftId: shift.id,
          closedAt: shift.closedAt!,
          finalBalanceCounted: shift.finalBalanceCounted!,
          estimatedCashRevenue: shift.estimatedCashRevenue!,
          pixRevenueTotal: shift.pixRevenueTotal!,
          cardMachineTotal: shift.cardMachineTotal!,
          totalRevenue: shift.totalRevenue!,
          changedById: profile.id,
          changedByName: profile.name,
          reason: "Turno cancelado",
        },
      });
      for (const entry of shift.cardMachineEntries) {
        await transaction.bakeryCardMachineEntry.update({
          where: { id: entry.id },
          data: { closeSnapshotId: snapshot.id },
        });
        await adjustBalance(
          transaction,
          profile,
          shift.company,
          entry.bankAccountId,
          -Number(entry.amount),
          "CAIXA_PADARIA_CANCELAR_TURNO_MAQUININHA",
          "BakeryCardMachineEntry",
          entry.id,
        );
      }
    }
    const canceled = await transaction.bakeryShift.update({
      where: { id: shift.id },
      data: { status: "CANCELED" },
      include: SHIFT_INCLUDE,
    });
    await transaction.auditLog.create({
      data: {
        tenantId: shift.company.tenantId,
        companyId: shift.company.id,
        userId: profile.id,
        action: "CANCELAR_TURNO_CAIXA",
        entityType: "BakeryShift",
        entityId: shift.id,
      },
    });
    return canceled;
  });
  return mapShift(updated);
}
