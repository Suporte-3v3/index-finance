import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

const { disconnectDatabase, getDatabaseClient } = await import("../backend/database.js");
const {
  FinancialSetupApiError,
  adjustBankAccountBalance,
  adjustBankAccountBalances,
  createBankAccount,
  createMasterData,
  deactivateBankAccount,
  deactivateMasterData,
  ensureBolsaBankAccount,
  listFinancialSetup,
  updateBankAccount,
  updateMasterData,
} = await import("../backend/financial-setup.js");

const database = getDatabaseClient();
const adminId = randomUUID();
const operatorId = randomUUID();
const tenantId = randomUUID();
const companyId = randomUUID();

const adminProfile = {
  id: adminId,
  isPlatformAdmin: false,
  tenantMemberships: [{ tenantId, role: "BPO_ADMIN" as const }],
  companyMemberships: [],
};
const operatorProfile = {
  id: operatorId,
  isPlatformAdmin: false,
  tenantMemberships: [],
  companyMemberships: [
    { companyId, role: "CLIENT" as const, clientOperator: true },
  ],
};

try {
  await database.user.createMany({
    data: [
      {
        id: adminId,
        name: "Administrador da verificação financeira",
        email: `financial-admin-${adminId}@idex.invalid`,
        emailVerified: true,
      },
      {
        id: operatorId,
        name: "Operador da verificação financeira",
        email: `financial-operator-${operatorId}@idex.invalid`,
        emailVerified: true,
      },
    ],
  });
  await database.tenant.create({
    data: {
      id: tenantId,
      name: "Tenant temporário financeiro",
      slug: `financial-check-${tenantId}`,
      memberships: { create: { userId: adminId, role: "BPO_ADMIN" } },
    },
  });
  await database.company.create({
    data: {
      id: companyId,
      tenantId,
      cnpj: Date.now().toString().padStart(14, "8").slice(-14),
      corporateName: "Empresa de verificação financeira Ltda",
      tradeName: "Verificação financeira",
      memberships: {
        create: {
          userId: operatorId,
          role: "CLIENT",
          clientOperator: true,
        },
      },
    },
  });

  const bank = await createBankAccount(adminProfile, {
    companyId,
    bankName: "Banco de Teste",
    agency: "0001",
    accountNumber: "12345-6",
    type: "Corrente",
    balance: 100,
  });
  assert.equal(bank.balance, 100);
  const updatedBank = await updateBankAccount(adminProfile, bank.id, { balance: 125.5 });
  assert.equal(updatedBank.balance, 125.5);

  const category = await createMasterData(adminProfile, {
    companyId,
    type: "CATEGORY",
    name: "Administrativo",
  });
  const subcategory = await createMasterData(adminProfile, {
    companyId,
    type: "SUBCATEGORY",
    name: "Escritório",
    parentId: category.id,
  });
  const updatedCategory = await updateMasterData(adminProfile, category.id, {
    name: "Administração",
  });
  assert.equal(updatedCategory.name, "Administração");
  assert.equal(subcategory.parentId, category.id);

  const bolsa = await ensureBolsaBankAccount(operatorProfile, companyId);
  const sameBolsa = await ensureBolsaBankAccount(operatorProfile, companyId);
  assert.equal(sameBolsa.id, bolsa.id);
  const adjusted = await adjustBankAccountBalance(operatorProfile, bolsa.id, {
    delta: 42.75,
    meta: {
      action: "CHECK_MOVIMENTO_BOLSA",
      entityType: "FinancialSetupCheck",
      entityId: "temporary-check",
    },
  });
  assert.equal(adjusted.balance, 42.75);
  const transferred = await adjustBankAccountBalances(adminProfile, {
    movements: [
      { accountId: bank.id, delta: -10 },
      { accountId: bolsa.id, delta: 10 },
    ],
    meta: {
      action: "CHECK_TRANSFERENCIA",
      entityType: "FinancialSetupCheck",
      entityId: "temporary-transfer",
    },
  });
  assert.equal(transferred.find(({ id }) => id === bank.id)?.balance, 115.5);
  assert.equal(transferred.find(({ id }) => id === bolsa.id)?.balance, 52.75);

  const workspace = await listFinancialSetup(adminProfile);
  assert.equal(workspace.bankAccounts.length, 2);
  assert.equal(workspace.masterData.length, 2);

  await assert.rejects(
    createBankAccount(
      {
        id: randomUUID(),
        isPlatformAdmin: false,
        tenantMemberships: [],
        companyMemberships: [],
      },
      {
        companyId,
        bankName: "Sem acesso",
        accountNumber: "999",
        type: "Corrente",
        balance: 0,
      },
    ),
    (error) => error instanceof FinancialSetupApiError && error.status === 403,
  );

  await deactivateMasterData(adminProfile, category.id);
  assert.equal(
    (await database.masterDataOption.findUnique({ where: { id: subcategory.id } }))?.active,
    false,
  );
  await deactivateBankAccount(adminProfile, bank.id);
  assert.ok(
    await database.bankAccount.findFirst({
      where: { id: bank.id, active: false, deletedAt: { not: null } },
    }),
  );

  console.log(
    "Configuração financeira validada: isolamento, CRUD, hierarquia, Bolsa única e saldo persistente.",
  );
} finally {
  await database.auditLog.deleteMany({ where: { companyId } });
  await database.masterDataOption.deleteMany({ where: { companyId } });
  await database.bankAccount.deleteMany({ where: { companyId } });
  await database.company.deleteMany({ where: { id: companyId } });
  await database.tenant.deleteMany({ where: { id: tenantId } });
  await database.user.deleteMany({ where: { id: { in: [adminId, operatorId] } } });
  await disconnectDatabase();
}
