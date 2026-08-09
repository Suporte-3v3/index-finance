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
  decideDocumentApproval,
  deleteDocument,
  listDocuments,
  submitDocumentApproval,
  updateDocument,
} = await import("../backend/document-records.js");

const database = getDatabaseClient();
const adminId = randomUUID();
const clientId = randomUUID();
const outsiderId = randomUUID();
const tenantId = randomUUID();
const companyId = randomUUID();
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
const outsiderProfile = {
  id: outsiderId,
  isPlatformAdmin: false,
  tenantMemberships: [],
  companyMemberships: [],
};

const baseDocument = {
  companyId,
  category: "Notas fiscais",
  name: "nota-fiscal-teste.pdf",
  description: "Documento temporário de verificação",
  competenceMonth: "2026-08",
  fileSize: "1.5 KB",
  mimeType: "application/pdf",
  supplier: "Fornecedor Temporário",
  dueDate: "2026-08-20",
  amount: 250.5,
  documentNumber: "DOC-TESTE-001",
  expenseType: "Administrativo",
};

try {
  await database.user.createMany({
    data: [
      { id: adminId, name: "Administrador de documentos", email: `document-admin-${adminId}@idex.invalid`, emailVerified: true },
      { id: clientId, name: "Cliente de documentos", email: `document-client-${clientId}@idex.invalid`, emailVerified: true },
      { id: outsiderId, name: "Usuário sem acesso", email: `document-outsider-${outsiderId}@idex.invalid`, emailVerified: true },
    ],
  });
  await database.tenant.create({
    data: {
      id: tenantId,
      name: "Tenant temporário de documentos",
      slug: `document-check-${tenantId}`,
      memberships: { create: { userId: adminId, role: "BPO_ADMIN" } },
    },
  });
  await database.company.create({
    data: {
      id: companyId,
      tenantId,
      cnpj: Date.now().toString().padStart(14, "6").slice(-14),
      corporateName: "Empresa temporária de documentos Ltda",
      tradeName: "Verificação de documentos",
      memberships: {
        create: {
          userId: clientId,
          role: "CLIENT",
          permissions: ["documents.upload", "documents.view"],
        },
      },
    },
  });

  const privateDocument = await createDocument(adminProfile, baseDocument);
  assert.match(privateDocument.document.id, /^[0-9a-f-]{36}$/i);
  assert.equal(privateDocument.document.status, "Aguardando Análise");
  assert.equal(privateDocument.document.amount, 250.5);

  const updated = await updateDocument(adminProfile, privateDocument.document.id, {
    description: "Documento atualizado no PostgreSQL",
    amount: 300,
    entryType: "Conta a Pagar",
  });
  assert.equal(updated.description, "Documento atualizado no PostgreSQL");
  assert.equal(updated.amount, 300);

  const shared = await createDocument(adminProfile, {
    ...baseDocument,
    name: "documento-compartilhado.pdf",
    recipientId: clientId,
  });
  assert.equal(shared.document.status, "Compartilhado");
  assert.equal(shared.document.purpose, "VIEW_ONLY");

  const directApproval = await createDocument(adminProfile, {
    ...baseDocument,
    name: "documento-aprovacao-direta.pdf",
    approvalRecipientId: clientId,
  });
  assert.ok(directApproval.approval);
  assert.equal(directApproval.document.status, "Aguardando Aprovação");
  const approved = await decideDocumentApproval(
    clientProfile,
    directApproval.approval!.id,
    { decision: "Aprovada", comment: "Documento conferido" },
  );
  assert.equal(approved.approval.status, "Aprovada");
  assert.equal(approved.document.status, "Lançado");
  assert.equal(approved.approval.history.length, 1);

  const submittedSource = await createDocument(adminProfile, {
    ...baseDocument,
    name: "documento-submetido.pdf",
  });
  const submitted = await submitDocumentApproval(
    adminProfile,
    submittedSource.document.id,
    { recipientId: clientId, amount: 999, dueDate: "2026-08-25" },
  );
  assert.equal(submitted.document.status, "Aguardando Aprovação");
  assert.equal(submitted.approval.amount, 999);
  assert.equal(submitted.approval.dueDate, "2026-08-25");
  const changesRequested = await decideDocumentApproval(
    clientProfile,
    submitted.approval.id,
    { decision: "Ajuste solicitado", comment: "Corrigir centro de custo" },
  );
  assert.equal(changesRequested.document.status, "Aguardando Análise");

  const adminWorkspace = await listDocuments(adminProfile);
  assert.equal(adminWorkspace.documents.length, 4);
  assert.equal(adminWorkspace.documentApprovals.length, 2);
  const clientWorkspace = await listDocuments(clientProfile);
  assert.deepEqual(
    new Set(clientWorkspace.documents.map((item) => item.id)),
    new Set([shared.document.id, directApproval.document.id, submitted.document.id]),
  );
  assert.equal(clientWorkspace.documentApprovals.length, 2);

  const clientOwned = await createDocument(clientProfile, {
    ...baseDocument,
    name: "documento-do-cliente.pdf",
  });
  assert.equal(clientOwned.document.uploadedById, clientId);
  await deleteDocument(clientProfile, clientOwned.document.id);
  assert.equal((await listDocuments(clientProfile)).documents.some((item) => item.id === clientOwned.document.id), false);

  await assert.rejects(
    createDocument(outsiderProfile, baseDocument),
    (error) => error instanceof DocumentRecordApiError && error.status === 403,
  );
  await assert.rejects(
    updateDocument(clientProfile, shared.document.id, { description: "Alteração indevida" }),
    (error) => error instanceof DocumentRecordApiError && error.status === 403,
  );

  await deleteDocument(adminProfile, privateDocument.document.id);
  assert.equal((await listDocuments(adminProfile)).documents.some((item) => item.id === privateDocument.document.id), false);

  console.log("Documentos validados: criação, visibilidade, edição, compartilhamento, aprovação, RBAC e exclusão lógica.");
} finally {
  await database.auditLog.deleteMany({ where: { companyId } });
  await database.approvalStep.deleteMany({ where: { approval: { companyId } } });
  await database.approval.deleteMany({ where: { companyId } });
  await database.document.deleteMany({ where: { companyId } });
  await database.company.deleteMany({ where: { id: companyId } });
  await database.tenant.deleteMany({ where: { id: tenantId } });
  await database.user.deleteMany({ where: { id: { in: [adminId, clientId, outsiderId] } } });
  await disconnectDatabase();
}
