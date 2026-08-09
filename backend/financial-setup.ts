import { Prisma } from "./generated/prisma/client.js";
import { getDatabaseClient } from "./database.js";
import { writeNotification } from "./notifications.js";

type Role = "BPO_ADMIN" | "BPO_TEAM" | "CLIENT" | "ACCOUNTANT";

export interface FinancialAccessProfile {
  id: string;
  isPlatformAdmin: boolean;
  tenantMemberships: Array<{ tenantId: string; role: Role }>;
  companyMemberships: Array<{
    companyId: string;
    role: Role;
    clientOperator?: boolean;
  }>;
}

export class FinancialSetupApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const BANK_TYPE_TO_DATABASE = {
  Corrente: "CHECKING",
  "Poupança": "SAVINGS",
  Investimento: "INVESTMENT",
  Caixa: "CASH",
} as const;

const BANK_TYPE_FROM_DATABASE = {
  CHECKING: "Corrente",
  SAVINGS: "Poupança",
  INVESTMENT: "Investimento",
  CASH: "Caixa",
} as const;

const MASTER_DATA_TYPES = new Set([
  "CATEGORY",
  "SUBCATEGORY",
  "PAYMENT_METHOD",
  "COST_CENTER",
  "DOCUMENT_TYPE",
  "SUPPLIER",
  "CUSTOMER",
  "BAKERY_REGISTER",
]);

function requiredText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new FinancialSetupApiError(`Informe ${field}.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new FinancialSetupApiError(`${field} excede o tamanho permitido.`);
  }
  return normalized;
}

function optionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new FinancialSetupApiError("Campo inválido.");
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new FinancialSetupApiError("Campo excede o tamanho permitido.");
  }
  return normalized || null;
}

function money(value: unknown, field: string) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || Math.abs(normalized) > 999_999_999_999_999) {
    throw new FinancialSetupApiError(`${field} inválido.`);
  }
  return Math.round((normalized + Number.EPSILON) * 100) / 100;
}

function masterDataType(value: unknown) {
  if (typeof value !== "string" || !MASTER_DATA_TYPES.has(value)) {
    throw new FinancialSetupApiError("Tipo de cadastro mestre inválido.");
  }
  return value as
    | "CATEGORY"
    | "SUBCATEGORY"
    | "PAYMENT_METHOD"
    | "COST_CENTER"
    | "DOCUMENT_TYPE"
    | "SUPPLIER"
    | "CUSTOMER"
    | "BAKERY_REGISTER";
}

function accessibleTenantIds(profile: FinancialAccessProfile) {
  return profile.tenantMemberships
    .filter(({ role }) => role === "BPO_ADMIN" || role === "BPO_TEAM")
    .map(({ tenantId }) => tenantId);
}

function managedTenantIds(profile: FinancialAccessProfile) {
  return profile.tenantMemberships
    .filter(({ role }) => role === "BPO_ADMIN" || role === "BPO_TEAM")
    .map(({ tenantId }) => tenantId);
}

function accessibleCompanyIds(profile: FinancialAccessProfile) {
  return profile.companyMemberships.map(({ companyId }) => companyId);
}

function canManageCompany(
  profile: FinancialAccessProfile,
  company: { id: string; tenantId: string },
) {
  return (
    profile.isPlatformAdmin ||
    managedTenantIds(profile).includes(company.tenantId) ||
    profile.companyMemberships.some(
      ({ companyId, role }) =>
        companyId === company.id && (role === "BPO_ADMIN" || role === "BPO_TEAM"),
    )
  );
}

function canAdjustCompanyBalance(
  profile: FinancialAccessProfile,
  company: { id: string; tenantId: string },
) {
  return (
    canManageCompany(profile, company) ||
    profile.companyMemberships.some(
      ({ companyId, role, clientOperator }) =>
        companyId === company.id && role === "CLIENT" && clientOperator === true,
    )
  );
}

async function requireCompany(
  profile: FinancialAccessProfile,
  companyId: string,
  permission: "read" | "manage" | "adjust",
) {
  const company = await getDatabaseClient().company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { id: true, tenantId: true },
  });
  if (!company) throw new FinancialSetupApiError("Empresa não encontrada.", 404);

  const canRead =
    profile.isPlatformAdmin ||
    accessibleTenantIds(profile).includes(company.tenantId) ||
    accessibleCompanyIds(profile).includes(company.id);
  const allowed =
    permission === "read"
      ? canRead
      : permission === "manage"
        ? canManageCompany(profile, company)
        : canAdjustCompanyBalance(profile, company);
  if (!allowed) throw new FinancialSetupApiError("Sem permissão para esta empresa.", 403);
  return company;
}

function mapBankAccount(account: any) {
  return {
    id: account.id,
    companyId: account.companyId,
    bankName: account.bankName,
    agency: account.agency || "",
    accountNumber: account.accountNumber,
    type: BANK_TYPE_FROM_DATABASE[account.type as keyof typeof BANK_TYPE_FROM_DATABASE],
    balance: Number(account.balance),
    isBolsaAccount: account.isBolsaAccount || undefined,
  };
}

function mapMasterData(item: any) {
  return {
    id: item.id,
    companyId: item.companyId,
    type: item.type,
    name: item.name,
    parentId: item.parentId || undefined,
    active: item.active,
    createdAt: item.createdAt.toISOString(),
  };
}

function auditData(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function writeAudit(
  transaction: Prisma.TransactionClient,
  profile: FinancialAccessProfile,
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
      previousData: previousData == null ? Prisma.JsonNull : auditData(previousData),
      nextData: nextData == null ? Prisma.JsonNull : auditData(nextData),
    },
  });
}

export async function listFinancialSetup(profile: FinancialAccessProfile) {
  const companyWhere = profile.isPlatformAdmin
    ? { deletedAt: null }
    : {
        deletedAt: null,
        OR: [
          { tenantId: { in: accessibleTenantIds(profile) } },
          { id: { in: accessibleCompanyIds(profile) } },
        ],
      };
  const companies = await getDatabaseClient().company.findMany({
    where: companyWhere,
    select: { id: true },
  });
  const companyIds = companies.map(({ id }) => id);
  const [bankAccounts, masterData] = await Promise.all([
    getDatabaseClient().bankAccount.findMany({
      where: { companyId: { in: companyIds }, active: true, deletedAt: null },
      orderBy: [{ companyId: "asc" }, { isBolsaAccount: "asc" }, { bankName: "asc" }],
    }),
    getDatabaseClient().masterDataOption.findMany({
      where: { companyId: { in: companyIds } },
      orderBy: [{ companyId: "asc" }, { type: "asc" }, { name: "asc" }],
    }),
  ]);
  return {
    bankAccounts: bankAccounts.map(mapBankAccount),
    masterData: masterData.map(mapMasterData),
  };
}

export async function createBankAccount(
  profile: FinancialAccessProfile,
  body: any,
) {
  const companyId = requiredText(body?.companyId, "a empresa", 36);
  const company = await requireCompany(profile, companyId, "manage");
  const type = BANK_TYPE_TO_DATABASE[body?.type as keyof typeof BANK_TYPE_TO_DATABASE];
  if (!type) throw new FinancialSetupApiError("Tipo da conta bancária inválido.");
  try {
    return await getDatabaseClient().$transaction(async (transaction) => {
      const account = await transaction.bankAccount.create({
        data: {
          companyId,
          bankName: requiredText(body?.bankName, "o banco", 160),
          agency: optionalText(body?.agency, 20),
          accountNumber: requiredText(body?.accountNumber, "a conta bancária", 40),
          type,
          balance: money(body?.balance, "Saldo"),
        },
      });
      await writeAudit(
        transaction,
        profile,
        company,
        "CRIAR_CONTA_BANCARIA",
        "BankAccount",
        account.id,
        null,
        mapBankAccount(account),
      );
      await writeNotification(transaction, {
        companyId: company.id,
        title: "Conta bancária cadastrada",
        message: `${account.bankName} foi cadastrada.`,
        type: "INFO",
      });
      return mapBankAccount(account);
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      throw new FinancialSetupApiError("Esta conta bancária já está cadastrada.", 409);
    }
    throw error;
  }
}

export async function updateBankAccount(
  profile: FinancialAccessProfile,
  accountId: string,
  body: any,
) {
  const database = getDatabaseClient();
  const existing = await database.bankAccount.findFirst({
    where: { id: accountId, active: true, deletedAt: null },
    include: { company: { select: { id: true, tenantId: true, deletedAt: true } } },
  });
  if (!existing || existing.company.deletedAt) {
    throw new FinancialSetupApiError("Conta bancária não encontrada.", 404);
  }
  await requireCompany(profile, existing.companyId, "manage");
  if (existing.isBolsaAccount) {
    throw new FinancialSetupApiError("A conta Bolsa é administrada pelo módulo Caixa.", 409);
  }

  const data: Record<string, unknown> = {};
  if (body.bankName !== undefined)
    data.bankName = requiredText(body.bankName, "o banco", 160);
  if (body.agency !== undefined) data.agency = optionalText(body.agency, 20);
  if (body.accountNumber !== undefined)
    data.accountNumber = requiredText(body.accountNumber, "a conta bancária", 40);
  if (body.type !== undefined) {
    const type = BANK_TYPE_TO_DATABASE[body.type as keyof typeof BANK_TYPE_TO_DATABASE];
    if (!type) throw new FinancialSetupApiError("Tipo da conta bancária inválido.");
    data.type = type;
  }
  if (body.balance !== undefined) data.balance = money(body.balance, "Saldo");

  try {
    return await database.$transaction(async (transaction) => {
      const updated = await transaction.bankAccount.update({
        where: { id: accountId },
        data,
      });
      await writeAudit(
        transaction,
        profile,
        existing.company,
        "ATUALIZAR_CONTA_BANCARIA",
        "BankAccount",
        accountId,
        mapBankAccount(existing),
        mapBankAccount(updated),
      );
      await writeNotification(transaction, {
        companyId: existing.company.id,
        title: "Conta bancária atualizada",
        message: `${updated.bankName} foi atualizada.`,
        type: "INFO",
      });
      return mapBankAccount(updated);
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      throw new FinancialSetupApiError("Esta conta bancária já está cadastrada.", 409);
    }
    throw error;
  }
}

export async function deactivateBankAccount(
  profile: FinancialAccessProfile,
  accountId: string,
) {
  const database = getDatabaseClient();
  const existing = await database.bankAccount.findFirst({
    where: { id: accountId, active: true, deletedAt: null },
    include: { company: { select: { id: true, tenantId: true, deletedAt: true } } },
  });
  if (!existing || existing.company.deletedAt) {
    throw new FinancialSetupApiError("Conta bancária não encontrada.", 404);
  }
  await requireCompany(profile, existing.companyId, "manage");
  if (existing.isBolsaAccount) {
    throw new FinancialSetupApiError("A conta Bolsa não pode ser excluída.", 409);
  }
  await database.$transaction(async (transaction) => {
    await transaction.bankAccount.update({
      where: { id: accountId },
      data: { active: false, deletedAt: new Date() },
    });
    await writeAudit(
      transaction,
      profile,
      existing.company,
      "DESATIVAR_CONTA_BANCARIA",
      "BankAccount",
      accountId,
      mapBankAccount(existing),
      null,
    );
    await writeNotification(transaction, {
      companyId: existing.company.id,
      title: "Conta bancária desativada",
      message: `${existing.bankName} foi desativada.`,
      type: "WARNING",
    });
  });
}

export async function ensureBolsaBankAccount(
  profile: FinancialAccessProfile,
  companyId: string,
) {
  const company = await requireCompany(profile, companyId, "adjust");
  const database = getDatabaseClient();
  const existing = await database.bankAccount.findFirst({
    where: { companyId, isBolsaAccount: true, active: true, deletedAt: null },
  });
  if (existing) return mapBankAccount(existing);

  try {
    return await database.$transaction(async (transaction) => {
      const created = await transaction.bankAccount.create({
        data: {
          companyId,
          bankName: "Bolsa",
          agency: "-",
          accountNumber: "BOLSA",
          type: "CASH",
          balance: 0,
          isBolsaAccount: true,
        },
      });
      await writeAudit(
        transaction,
        profile,
        company,
        "CRIAR_CONTA_BOLSA",
        "BankAccount",
        created.id,
        null,
        mapBankAccount(created),
      );
      return mapBankAccount(created);
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      const concurrent = await database.bankAccount.findFirst({
        where: { companyId, isBolsaAccount: true, active: true, deletedAt: null },
      });
      if (concurrent) return mapBankAccount(concurrent);
    }
    throw error;
  }
}

export async function adjustBankAccountBalance(
  profile: FinancialAccessProfile,
  accountId: string,
  body: any,
) {
  const delta = money(body?.delta, "Movimentação");
  if (delta === 0) throw new FinancialSetupApiError("A movimentação deve ser diferente de zero.");
  const database = getDatabaseClient();
  const existing = await database.bankAccount.findFirst({
    where: { id: accountId, active: true, deletedAt: null },
    include: { company: { select: { id: true, tenantId: true, deletedAt: true } } },
  });
  if (!existing || existing.company.deletedAt) {
    throw new FinancialSetupApiError("Conta bancária não encontrada.", 404);
  }
  await requireCompany(profile, existing.companyId, "adjust");

  return database.$transaction(async (transaction) => {
    const updated = await transaction.bankAccount.update({
      where: { id: accountId },
      data: { balance: { increment: delta } },
    });
    await writeAudit(
      transaction,
      profile,
      existing.company,
      requiredText(body?.meta?.action || "AJUSTAR_SALDO", "a ação", 120),
      "BankAccount",
      accountId,
      { balance: Number(existing.balance) },
      {
        balance: Number(updated.balance),
        sourceEntityType: optionalText(body?.meta?.entityType, 100),
        sourceEntityId: optionalText(body?.meta?.entityId, 160),
      },
    );
    await writeNotification(transaction, {
      companyId: existing.company.id,
      title: "Saldo bancário atualizado",
      message: `Saldo de ${updated.bankName} ajustado.`,
      type: "INFO",
    });
    return mapBankAccount(updated);
  });
}

export async function adjustBankAccountBalances(
  profile: FinancialAccessProfile,
  body: any,
) {
  if (!Array.isArray(body?.movements) || body.movements.length === 0 || body.movements.length > 20) {
    throw new FinancialSetupApiError("Informe de uma a vinte movimentações bancárias.");
  }
  const combined = new Map<string, number>();
  for (const movement of body.movements) {
    const accountId = requiredText(movement?.accountId, "a conta bancária", 36);
    const delta = money(movement?.delta, "Movimentação");
    combined.set(accountId, money((combined.get(accountId) || 0) + delta, "Movimentação"));
  }
  for (const [accountId, delta] of [...combined]) {
    if (delta === 0) combined.delete(accountId);
  }
  if (combined.size === 0) return [];

  const database = getDatabaseClient();
  const accounts = await database.bankAccount.findMany({
    where: {
      id: { in: [...combined.keys()] },
      active: true,
      deletedAt: null,
      company: { deletedAt: null },
    },
    include: { company: { select: { id: true, tenantId: true } } },
  });
  if (accounts.length !== combined.size) {
    throw new FinancialSetupApiError("Uma das contas bancárias não foi encontrada.", 404);
  }
  const company = accounts[0].company;
  if (accounts.some((account) => account.companyId !== company.id)) {
    throw new FinancialSetupApiError("As movimentações devem pertencer à mesma empresa.");
  }
  await requireCompany(profile, company.id, "adjust");
  const action = requiredText(body?.meta?.action || "AJUSTAR_SALDOS", "a ação", 120);

  return database.$transaction(async (transaction) => {
    const updatedAccounts = [];
    for (const account of accounts) {
      const updated = await transaction.bankAccount.update({
        where: { id: account.id },
        data: { balance: { increment: combined.get(account.id)! } },
      });
      await writeAudit(
        transaction,
        profile,
        company,
        action,
        "BankAccount",
        account.id,
        { balance: Number(account.balance) },
        {
          balance: Number(updated.balance),
          sourceEntityType: optionalText(body?.meta?.entityType, 100),
          sourceEntityId: optionalText(body?.meta?.entityId, 160),
        },
      );
      await writeNotification(transaction, {
        companyId: company.id,
        title: "Saldo bancário atualizado",
        message: `Saldo de ${updated.bankName} ajustado.`,
        type: "INFO",
      });
      updatedAccounts.push(mapBankAccount(updated));
    }
    return updatedAccounts;
  });
}

export async function createMasterData(
  profile: FinancialAccessProfile,
  body: any,
) {
  const companyId = requiredText(body?.companyId, "a empresa", 36);
  const company = await requireCompany(profile, companyId, "manage");
  const type = masterDataType(body?.type);
  const parentId = optionalText(body?.parentId, 36);
  if (type === "SUBCATEGORY" && !parentId) {
    throw new FinancialSetupApiError("Selecione a categoria principal.");
  }
  if (parentId) {
    const parent = await getDatabaseClient().masterDataOption.findFirst({
      where: { id: parentId, companyId, type: "CATEGORY", active: true },
      select: { id: true },
    });
    if (!parent) throw new FinancialSetupApiError("Categoria principal inválida.");
  }

  const name = requiredText(body?.name, "o nome", 160);
  const inactive = await getDatabaseClient().masterDataOption.findUnique({
    where: { companyId_type_name: { companyId, type, name } },
  });
  try {
    return await getDatabaseClient().$transaction(async (transaction) => {
      const item = inactive
        ? await transaction.masterDataOption.update({
            where: { id: inactive.id },
            data: { active: true, parentId },
          })
        : await transaction.masterDataOption.create({
            data: { companyId, type, name, parentId },
          });
      await writeAudit(
        transaction,
        profile,
        company,
        inactive ? "REATIVAR_CADASTRO_MESTRE" : "CRIAR_CADASTRO_MESTRE",
        "MasterDataOption",
        item.id,
        inactive ? mapMasterData(inactive) : null,
        mapMasterData(item),
      );
      await writeNotification(transaction, {
        companyId: company.id,
        title: "Cadastro mestre atualizado",
        message: `${item.name} foi ${inactive ? "reativado" : "criado"} nos cadastros.`,
        type: "INFO",
      });
      return mapMasterData(item);
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      throw new FinancialSetupApiError("Este cadastro já existe.", 409);
    }
    throw error;
  }
}

export async function updateMasterData(
  profile: FinancialAccessProfile,
  itemId: string,
  body: any,
) {
  const database = getDatabaseClient();
  const existing = await database.masterDataOption.findFirst({
    where: { id: itemId },
    include: { company: { select: { id: true, tenantId: true, deletedAt: true } } },
  });
  if (!existing || existing.company.deletedAt) {
    throw new FinancialSetupApiError("Cadastro não encontrado.", 404);
  }
  await requireCompany(profile, existing.companyId, "manage");

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = requiredText(body.name, "o nome", 160);
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      throw new FinancialSetupApiError("Status inválido.");
    }
    data.active = body.active;
  }
  if (body.parentId !== undefined) {
    const parentId = optionalText(body.parentId, 36);
    if (existing.type === "SUBCATEGORY" && !parentId) {
      throw new FinancialSetupApiError("Selecione a categoria principal.");
    }
    if (parentId) {
      const parent = await database.masterDataOption.findFirst({
        where: {
          id: parentId,
          companyId: existing.companyId,
          type: "CATEGORY",
          active: true,
        },
        select: { id: true },
      });
      if (!parent) throw new FinancialSetupApiError("Categoria principal inválida.");
    }
    data.parentId = parentId;
  }

  try {
    return await database.$transaction(async (transaction) => {
      const updated = await transaction.masterDataOption.update({
        where: { id: itemId },
        data,
      });
      await writeAudit(
        transaction,
        profile,
        existing.company,
        "ATUALIZAR_CADASTRO_MESTRE",
        "MasterDataOption",
        itemId,
        mapMasterData(existing),
        mapMasterData(updated),
      );
      await writeNotification(transaction, {
        companyId: existing.company.id,
        title: "Cadastro mestre atualizado",
        message: `${updated.name} foi atualizado.`,
        type: "INFO",
      });
      return mapMasterData(updated);
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      throw new FinancialSetupApiError("Este cadastro já existe.", 409);
    }
    throw error;
  }
}

export async function deactivateMasterData(
  profile: FinancialAccessProfile,
  itemId: string,
) {
  const database = getDatabaseClient();
  const existing = await database.masterDataOption.findFirst({
    where: { id: itemId },
    include: { company: { select: { id: true, tenantId: true, deletedAt: true } } },
  });
  if (!existing || existing.company.deletedAt) {
    throw new FinancialSetupApiError("Cadastro não encontrado.", 404);
  }
  await requireCompany(profile, existing.companyId, "manage");
  await database.$transaction(async (transaction) => {
    await transaction.masterDataOption.updateMany({
      where: { OR: [{ id: itemId }, { parentId: itemId }] },
      data: { active: false },
    });
    await writeAudit(
      transaction,
      profile,
      existing.company,
      "DESATIVAR_CADASTRO_MESTRE",
      "MasterDataOption",
      itemId,
      mapMasterData(existing),
      null,
    );
    await writeNotification(transaction, {
      companyId: existing.company.id,
      title: "Cadastro mestre desativado",
      message: `${existing.name} foi desativado.`,
      type: "WARNING",
    });
  });
}
