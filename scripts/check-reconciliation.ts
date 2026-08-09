import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

const { disconnectDatabase, getDatabaseClient } = await import("../backend/database.js");
const { createPayables, createReceivables } = await import("../backend/financial-entries.js");
const {
  ReconciliationApiError,
  autoReconcileStatementEntries,
  ignoreStatementEntry,
  importStatementEntries,
  listStatementEntries,
  reconcileStatementEntry,
} = await import("../backend/reconciliation.js");

const database = getDatabaseClient();
const userId = randomUUID();
const tenantId = randomUUID();
const companyId = randomUUID();
const bankAccountId = randomUUID();
const profile = {
  id: userId,
  isPlatformAdmin: false,
  tenantMemberships: [{ tenantId, role: "BPO_ADMIN" as const }],
  companyMemberships: [],
};

try {
  await database.user.create({ data: { id: userId, name: "Operador de conciliação", email: `reconciliation-${userId}@idex.invalid`, emailVerified: true } });
  await database.tenant.create({
    data: { id: tenantId, name: "Tenant temporário de conciliação", slug: `reconciliation-${tenantId}`, memberships: { create: { userId, role: "BPO_ADMIN" } } },
  });
  await database.company.create({
    data: { id: companyId, tenantId, cnpj: Date.now().toString().padStart(14, "5").slice(-14), corporateName: "Empresa temporária de conciliação Ltda", tradeName: "Verificação de conciliação", approvalLimit: 1000 },
  });
  await database.bankAccount.create({
    data: { id: bankAccountId, companyId, bankName: "Banco de Teste", agency: "0001", accountNumber: "REC-001", type: "CHECKING", balance: 1000 },
  });

  const payableInput = {
    companyId,
    supplier: "Fornecedor Teste",
    category: "Administrativo",
    costCenter: "Operacional",
    competenceMonth: "2026-08",
    issueDate: "2026-08-01",
    dueDate: "2026-08-20",
    interest: 0,
    penalty: 0,
    discount: 0,
    paymentMethod: "PIX",
    bankAccountId,
    recurrence: "Nenhuma",
    responsibleId: userId,
    needsApproval: false,
  };
  const payableManual = await createPayables(profile, { ...payableInput, description: "Pagamento manual", amount: 100 });
  const payableAuto = await createPayables(profile, { ...payableInput, description: "Pagamento automático", amount: 50 });
  const receivableInput = {
    companyId,
    customer: "Cliente Teste",
    category: "Receitas",
    costCenter: "Comercial",
    competenceMonth: "2026-08",
    issueDate: "2026-08-01",
    dueDate: "2026-08-20",
    interest: 0,
    penalty: 0,
    discount: 0,
    paymentMethod: "PIX",
    bankAccountId,
    recurrence: "Nenhuma",
    responsibleId: userId,
  };
  const receivablePartial = await createReceivables(profile, { ...receivableInput, description: "Recebimento parcial", amount: 100 });
  const receivableAuto = await createReceivables(profile, { ...receivableInput, description: "Recebimento automático", amount: 75 });

  const imported = await importStatementEntries(profile, bankAccountId, {
    entries: [
      { id: "ext-pay-100", date: "2026-08-10", description: "PIX fornecedor", amount: -100 },
      { id: "ext-rec-60", date: "2026-08-11", description: "PIX cliente parcial", amount: 60 },
      { id: "ext-pay-50", date: "2026-08-12", description: "Débito automático", amount: -50 },
      { id: "ext-rec-75", date: "2026-08-13", description: "Crédito cliente", amount: 75 },
      { id: "ext-ignore", date: "2026-08-14", description: "Tarifa analisada", amount: -5 },
    ],
  });
  assert.equal(imported.importedCount, 5);
  assert.equal((await importStatementEntries(profile, bankAccountId, { entries: [{ id: "ext-pay-100", date: "2026-08-10", description: "PIX fornecedor", amount: -100 }] })).importedCount, 0);
  const byDescription = new Map(imported.items.map((item) => [item.description, item]));

  const manualPayment = await reconcileStatementEntry(profile, bankAccountId, byDescription.get("PIX fornecedor")!.id, {
    financialRecordId: payableManual.payables[0].id,
    type: "A_PAGAR",
    notes: "Baixa conferida",
  });
  assert.equal(manualPayment.partial, false);
  assert.equal(manualPayment.item.reconciliationStatus, "Conciliada");

  const partialReceipt = await reconcileStatementEntry(profile, bankAccountId, byDescription.get("PIX cliente parcial")!.id, {
    financialRecordId: receivablePartial[0].id,
    type: "A_RECEBER",
    notes: "Recebimento parcial conferido",
  });
  assert.equal(partialReceipt.partial, true);
  assert.equal(partialReceipt.item.reconciliationStatus, "Parcialmente conciliada");
  assert.equal(Number((await database.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } })).balance), 960);

  const automatic = await autoReconcileStatementEntries(profile, bankAccountId);
  assert.equal(automatic.matchedCount, 2);
  assert.equal(Number((await database.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } })).balance), 985);
  assert.equal((await database.accountPayable.findUniqueOrThrow({ where: { id: payableAuto.payables[0].id } })).status, "PAID");
  assert.equal((await database.accountReceivable.findUniqueOrThrow({ where: { id: receivableAuto[0].id } })).status, "RECEIVED");

  const ignored = await ignoreStatementEntry(profile, bankAccountId, byDescription.get("Tarifa analisada")!.id, { reason: "Tarifa sem lançamento financeiro" });
  assert.equal(ignored.reconciliationStatus, "Ignorada");
  const workspace = await listStatementEntries(profile);
  assert.equal(workspace.statementItems[bankAccountId].length, 5);
  assert.equal(workspace.statementItems[bankAccountId].filter((item) => item.isReconciled).length, 5);

  await assert.rejects(
    importStatementEntries({ id: randomUUID(), isPlatformAdmin: false, tenantMemberships: [], companyMemberships: [] }, bankAccountId, { entries: [] }),
    (error) => error instanceof ReconciliationApiError && error.status === 403,
  );

  console.log("Conciliação validada: importação idempotente, baixas, recebimento parcial, saldo atômico, automação e itens ignorados.");
} finally {
  await database.auditLog.deleteMany({ where: { companyId } });
  await database.approvalStep.deleteMany({ where: { approval: { companyId } } });
  await database.approval.deleteMany({ where: { companyId } });
  await database.reconciliation.deleteMany({ where: { companyId } });
  await database.bankStatementEntry.deleteMany({ where: { companyId } });
  await database.accountPayablePayment.deleteMany({ where: { payable: { companyId } } });
  await database.accountReceivableReceipt.deleteMany({ where: { receivable: { companyId } } });
  await database.accountPayable.deleteMany({ where: { companyId } });
  await database.accountReceivable.deleteMany({ where: { companyId } });
  await database.bankAccount.deleteMany({ where: { companyId } });
  await database.company.deleteMany({ where: { id: companyId } });
  await database.tenant.deleteMany({ where: { id: tenantId } });
  await database.user.deleteMany({ where: { id: userId } });
  await disconnectDatabase();
}
