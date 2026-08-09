import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

const { disconnectDatabase, getDatabaseClient } = await import("../backend/database.js");
const {
  FinancialEntriesApiError,
  cancelPayable,
  cancelReceivable,
  createPayables,
  createReceivables,
  decidePaymentApproval,
  listFinancialEntries,
  payPayable,
  receiveReceivable,
  schedulePayable,
  updatePayable,
  updateReceivable,
} = await import("../backend/financial-entries.js");

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

const payableInput = {
  description: "Serviço de verificação",
  supplier: "Fornecedor de Teste",
  category: "Administrativo",
  costCenter: "Operacional",
  competenceMonth: "2026-08",
  issueDate: "2026-08-01",
  dueDate: "2026-08-15",
  amount: 300,
  interest: 0,
  penalty: 0,
  discount: 0,
  paymentMethod: "PIX",
  bankAccountId,
  recurrence: "Nenhuma",
  documentNumber: "TESTE-001",
  notes: "Registro temporário",
  responsibleId: userId,
  needsApproval: false,
};

try {
  await database.user.create({
    data: {
      id: userId,
      name: "Verificação de títulos financeiros",
      email: `financial-entries-${userId}@idex.invalid`,
      emailVerified: true,
    },
  });
  await database.tenant.create({
    data: {
      id: tenantId,
      name: "Tenant temporário de títulos",
      slug: `financial-entries-${tenantId}`,
      memberships: { create: { userId, role: "BPO_ADMIN" } },
    },
  });
  await database.company.create({
    data: {
      id: companyId,
      tenantId,
      cnpj: Date.now().toString().padStart(14, "7").slice(-14),
      corporateName: "Empresa temporária de títulos Ltda",
      tradeName: "Verificação de títulos",
      approvalLimit: 1000,
    },
  });
  await database.bankAccount.create({
    data: {
      id: bankAccountId,
      companyId,
      bankName: "Banco de Verificação",
      agency: "0001",
      accountNumber: "FIN-001",
      type: "CHECKING",
      balance: 10_000,
    },
  });

  const createdPayable = await createPayables(profile, { companyId, ...payableInput });
  assert.equal(createdPayable.payables.length, 1);
  assert.equal(createdPayable.approvals.length, 0);
  const payableId = createdPayable.payables[0].id;

  const installments = await createPayables(profile, {
    companyId,
    ...payableInput,
    description: "Compra parcelada",
    amount: 100,
    recurrence: "Parcelada",
    installmentCount: 3,
  });
  assert.equal(installments.payables.length, 3);
  assert.equal(
    installments.payables.reduce((total, item) => total + item.finalAmount, 0),
    100,
  );

  const approvalRequired = await createPayables(profile, {
    companyId,
    ...payableInput,
    description: "Pagamento sujeito a aprovação",
    amount: 1500,
  });
  assert.equal(approvalRequired.approvals.length, 1);
  const approvalDecision = await decidePaymentApproval(
    profile,
    approvalRequired.approvals[0].id,
    { decision: "Aprovada", comment: "Aprovado na verificação" },
  );
  assert.equal(approvalDecision.payable.status, "A vencer");

  const updatedPayable = await updatePayable(profile, payableId, {
    description: "Serviço de verificação atualizado",
  });
  assert.equal(updatedPayable.description, "Serviço de verificação atualizado");
  const partialPayment = await payPayable(profile, payableId, {
    bankAccountId,
    date: "2026-08-10",
    amount: 125,
  });
  assert.equal(partialPayment.payable.status, "Parcialmente paga");
  assert.equal(partialPayment.bankAccount.balance, 9875);
  const fullPayment = await payPayable(profile, payableId, {
    bankAccountId,
    date: "2026-08-11",
    amount: 500,
  });
  assert.equal(fullPayment.payable.status, "Paga");
  assert.equal(fullPayment.payable.paidAmount, 300);
  assert.equal(fullPayment.bankAccount.balance, 9700);
  await assert.rejects(
    cancelPayable(profile, payableId),
    (error) => error instanceof FinancialEntriesApiError && error.status === 409,
  );
  const scheduled = await schedulePayable(profile, installments.payables[0].id);
  assert.equal(scheduled.status, "Agendada");

  const receivables = await createReceivables(profile, {
    companyId,
    description: "Faturamento parcelado",
    customer: "Cliente de Teste",
    category: "Receitas",
    costCenter: "Comercial",
    competenceMonth: "2026-08",
    issueDate: "2026-08-01",
    dueDate: "2026-08-20",
    amount: 301,
    interest: 0,
    penalty: 0,
    discount: 0,
    paymentMethod: "PIX",
    bankAccountId,
    recurrence: "Parcelada",
    installmentCount: 2,
    responsibleId: userId,
  });
  assert.equal(receivables.length, 2);
  assert.equal(receivables.reduce((total, item) => total + item.amount, 0), 301);
  const receivableId = receivables[0].id;
  const updatedReceivable = await updateReceivable(profile, receivableId, {
    description: "Faturamento atualizado",
  });
  assert.equal(updatedReceivable.description, "Faturamento atualizado");
  const partialReceipt = await receiveReceivable(profile, receivableId, {
    amount: 50,
    date: "2026-08-21",
  });
  assert.equal(partialReceipt.receivable.status, "Parcialmente recebido");
  const fullReceipt = await receiveReceivable(profile, receivableId, {
    amount: 999,
    date: "2026-08-22",
  });
  assert.equal(fullReceipt.receivable.status, "Recebido");
  assert.equal(fullReceipt.receivable.receivedAmount, receivables[0].amount);

  const cancelableReceivable = await createReceivables(profile, {
    companyId,
    description: "Faturamento cancelável",
    customer: "Cliente de Teste",
    category: "Receitas",
    costCenter: "Comercial",
    competenceMonth: "2026-08",
    issueDate: "2026-08-01",
    dueDate: "2026-08-25",
    amount: 50,
    paymentMethod: "PIX",
    bankAccountId,
    recurrence: "Nenhuma",
    responsibleId: userId,
  });
  assert.equal((await cancelReceivable(profile, cancelableReceivable[0].id)).status, "Cancelado");

  const workspace = await listFinancialEntries(profile);
  assert.equal(workspace.accountsPayable.length, 5);
  assert.equal(workspace.accountsReceivable.length, 3);
  assert.equal(workspace.paymentApprovals.length, 1);

  await assert.rejects(
    createPayables(
      { id: randomUUID(), isPlatformAdmin: false, tenantMemberships: [], companyMemberships: [] },
      { companyId, ...payableInput },
    ),
    (error) => error instanceof FinancialEntriesApiError && error.status === 403,
  );

  console.log(
    "Títulos validados: parcelas, aprovação, edição, pagamentos, recebimentos, cancelamentos e saldos atômicos.",
  );
} finally {
  await database.auditLog.deleteMany({ where: { companyId } });
  await database.approvalStep.deleteMany({ where: { approval: { companyId } } });
  await database.approval.deleteMany({ where: { companyId } });
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
