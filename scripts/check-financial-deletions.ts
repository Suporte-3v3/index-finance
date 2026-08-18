import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

const { disconnectDatabase, getDatabaseClient } = await import("../backend/database.js");
const {
  DocumentRecordApiError,
  createDocument,
  deleteDocument,
  updateDocument,
} = await import("../backend/document-records.js");
const {
  createPayables,
  createReceivables,
  deletePayables,
  deleteReceivables,
} = await import("../backend/financial-entries.js");
const { adjustBankAccountBalances } = await import("../backend/financial-setup.js");

const database = getDatabaseClient();
const adminId = randomUUID();
const clientId = randomUUID();
const tenantId = randomUUID();
const companyId = randomUUID();
const sourceAccountId = randomUUID();
const destinationAccountId = randomUUID();
const adminProfile = {
  id: adminId,
  isPlatformAdmin: false,
  tenantMemberships: [{ tenantId, role: "BPO_ADMIN" as const }],
  companyMemberships: [],
};
const clientProfile = {
  id: clientId,
  isPlatformAdmin: false,
  tenantMemberships: [],
  companyMemberships: [{
    companyId,
    role: "CLIENT" as const,
    permissions: ["documents.upload", "documents.view"],
  }],
};

const payableInput = {
  description: "Conta temporária de exclusão",
  supplier: "Fornecedor temporário",
  category: "Administrativo",
  costCenter: "Operacional",
  competenceMonth: "2026-08",
  issueDate: "2026-08-01",
  dueDate: "2026-08-20",
  amount: 300,
  interest: 0,
  penalty: 0,
  discount: 0,
  paymentMethod: "PIX",
  bankAccountId: sourceAccountId,
  recurrence: "Nenhuma",
  responsibleId: adminId,
  needsApproval: false,
};

const receivableInput = {
  description: "Recebível temporário de exclusão",
  customer: "Cliente temporário",
  category: "Receitas",
  costCenter: "Comercial",
  competenceMonth: "2026-08",
  issueDate: "2026-08-01",
  dueDate: "2026-08-20",
  amount: 300,
  interest: 0,
  penalty: 0,
  discount: 0,
  paymentMethod: "PIX",
  bankAccountId: sourceAccountId,
  recurrence: "Nenhuma",
  responsibleId: adminId,
};

async function createLinkedDocument(
  uploadedByProfile: typeof adminProfile | typeof clientProfile,
  entryType: "Conta a Pagar" | "Conta a Receber",
  relatedEntityId: string,
) {
  const created = await createDocument(uploadedByProfile, {
    companyId,
    category: "Outros",
    name: `verificacao-${randomUUID()}.pdf`,
    description: "Documento temporário para verificar exclusões",
    competenceMonth: "2026-08",
    fileSize: "1 KB",
    mimeType: "application/pdf",
    entryType,
    amount: 300,
  });
  await updateDocument(adminProfile, created.document.id, {
    status: "Lançado",
    entryType,
    relatedEntityId,
  });
  return created.document.id;
}

try {
  await database.user.createMany({
    data: [
      { id: adminId, name: "Admin da verificação de exclusão", email: `delete-admin-${adminId}@idex.invalid`, emailVerified: true },
      { id: clientId, name: "Cliente da verificação de exclusão", email: `delete-client-${clientId}@idex.invalid`, emailVerified: true },
    ],
  });
  await database.tenant.create({
    data: {
      id: tenantId,
      name: "Tenant temporário de exclusões",
      slug: `financial-deletions-${tenantId}`,
      memberships: { create: { userId: adminId, role: "BPO_ADMIN" } },
    },
  });
  await database.company.create({
    data: {
      id: companyId,
      tenantId,
      cnpj: Date.now().toString().padStart(14, "8").slice(-14),
      corporateName: "Empresa temporária de exclusões Ltda",
      tradeName: "Verificação de exclusões",
      memberships: {
        create: {
          userId: clientId,
          role: "CLIENT",
          permissions: ["documents.upload", "documents.view"],
        },
      },
    },
  });
  await database.bankAccount.createMany({
    data: [
      { id: sourceAccountId, companyId, bankName: "Conta origem", accountNumber: "DEL-001", type: "CHECKING", balance: 1000 },
      { id: destinationAccountId, companyId, bankName: "Conta destino", accountNumber: "DEL-002", type: "CHECKING", balance: 500 },
    ],
  });

  const protectedPayable = (await createPayables(adminProfile, { companyId, ...payableInput })).payables[0];
  const clientDocumentId = await createLinkedDocument(clientProfile, "Conta a Pagar", protectedPayable.id);
  await assert.rejects(
    deleteDocument(clientProfile, clientDocumentId),
    (error) => error instanceof DocumentRecordApiError && error.status === 403,
  );
  assert.equal((await database.accountPayable.findUniqueOrThrow({ where: { id: protectedPayable.id } })).deletedAt, null);
  await deleteDocument(adminProfile, clientDocumentId);
  assert.ok((await database.accountPayable.findUniqueOrThrow({ where: { id: protectedPayable.id } })).deletedAt);

  const protectedReceivable = (await createReceivables(adminProfile, { companyId, ...receivableInput }))[0];
  const clientReceivableDocumentId = await createLinkedDocument(
    clientProfile,
    "Conta a Receber",
    protectedReceivable.id,
  );
  await assert.rejects(
    deleteDocument(clientProfile, clientReceivableDocumentId),
    (error) => error instanceof DocumentRecordApiError && error.status === 403,
  );
  assert.equal(
    (await database.accountReceivable.findUniqueOrThrow({ where: { id: protectedReceivable.id } })).deletedAt,
    null,
  );
  await deleteDocument(adminProfile, clientReceivableDocumentId);

  const payableInstallments = (await createPayables(adminProfile, {
    companyId,
    ...payableInput,
    recurrence: "Parcelada",
    installmentCount: 3,
  })).payables;
  const payableDocumentId = await createLinkedDocument(adminProfile, "Conta a Pagar", payableInstallments[0].id);
  const firstPayableDeletion = await deletePayables(adminProfile, { ids: [payableInstallments[0].id] });
  assert.deepEqual(firstPayableDeletion.deletedDocumentIds, []);
  assert.equal(firstPayableDeletion.relinkedDocuments[0]?.relatedEntityId, payableInstallments[1].id);
  assert.equal((await database.document.findUniqueOrThrow({ where: { id: payableDocumentId } })).relatedEntityId, payableInstallments[1].id);
  await deletePayables(adminProfile, { ids: payableInstallments.slice(1).map((item) => item.id) });
  assert.ok((await database.document.findUniqueOrThrow({ where: { id: payableDocumentId } })).deletedAt);

  const documentOwnedInstallments = (await createPayables(adminProfile, {
    companyId,
    ...payableInput,
    recurrence: "Parcelada",
    installmentCount: 2,
  })).payables;
  const installmentDocumentId = await createLinkedDocument(
    adminProfile,
    "Conta a Pagar",
    documentOwnedInstallments[0].id,
  );
  await deleteDocument(adminProfile, installmentDocumentId);
  assert.equal(
    await database.accountPayable.count({
      where: { id: { in: documentOwnedInstallments.map((item) => item.id) }, deletedAt: null },
    }),
    0,
  );

  const receivableInstallments = await createReceivables(adminProfile, {
    companyId,
    ...receivableInput,
    recurrence: "Parcelada",
    installmentCount: 2,
  });
  const receivableDocumentId = await createLinkedDocument(adminProfile, "Conta a Receber", receivableInstallments[0].id);
  const firstReceivableDeletion = await deleteReceivables(adminProfile, { ids: [receivableInstallments[0].id] });
  assert.deepEqual(firstReceivableDeletion.deletedDocumentIds, []);
  assert.equal(firstReceivableDeletion.relinkedDocuments[0]?.relatedEntityId, receivableInstallments[1].id);
  await deleteReceivables(adminProfile, { ids: [receivableInstallments[1].id] });
  assert.ok((await database.document.findUniqueOrThrow({ where: { id: receivableDocumentId } })).deletedAt);

  const transfer = await createDocument(adminProfile, {
    companyId,
    category: "Outros",
    name: `transferencia-${randomUUID()}.pdf`,
    description: "Transferência temporária",
    competenceMonth: "2026-08",
    fileSize: "1 KB",
    mimeType: "application/x-manual-entry",
    entryType: "Transferência",
    bankAccountId: sourceAccountId,
    destinationBankAccountId: destinationAccountId,
    amount: 125,
    origin: "Manual",
  });
  await adjustBankAccountBalances(adminProfile, {
    movements: [
      { accountId: sourceAccountId, delta: -125 },
      { accountId: destinationAccountId, delta: 125 },
    ],
    meta: { action: "TRANSFERENCIA_ENTRE_CONTAS", entityType: "BankTransfer", entityId: transfer.document.id },
  });
  await updateDocument(adminProfile, transfer.document.id, {
    status: "Lançado",
    entryType: "Transferência",
  });
  const transferDeletion = await deleteDocument(adminProfile, transfer.document.id);
  assert.equal(transferDeletion.adjustedBankAccounts.find((item) => item.id === sourceAccountId)?.balance, 1000);
  assert.equal(transferDeletion.adjustedBankAccounts.find((item) => item.id === destinationAccountId)?.balance, 500);

  console.log("Exclusões validadas: permissões, vínculos parcelados e reversão atômica de transferências.");
} finally {
  await database.auditLog.deleteMany({ where: { companyId } });
  await database.notification.deleteMany({ where: { companyId } });
  await database.approvalStep.deleteMany({ where: { approval: { companyId } } });
  await database.approval.deleteMany({ where: { companyId } });
  await database.document.deleteMany({ where: { companyId } });
  await database.accountPayablePayment.deleteMany({ where: { payable: { companyId } } });
  await database.accountReceivableReceipt.deleteMany({ where: { receivable: { companyId } } });
  await database.accountPayable.deleteMany({ where: { companyId } });
  await database.accountReceivable.deleteMany({ where: { companyId } });
  await database.bankAccount.deleteMany({ where: { companyId } });
  await database.companyMembership.deleteMany({ where: { companyId } });
  await database.company.deleteMany({ where: { id: companyId } });
  await database.tenant.deleteMany({ where: { id: tenantId } });
  await database.user.deleteMany({ where: { id: { in: [adminId, clientId] } } });
  await disconnectDatabase();
}
