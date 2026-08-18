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
  launchDocument,
  listDocuments,
  submitDocumentApproval,
  updateDocument,
} = await import("../backend/document-records.js");
const { DocumentFileError, readDocumentFile, storeDocumentFileChunk } = await import("../backend/document-files.js");

const database = getDatabaseClient();
const adminId = randomUUID();
const teamId = randomUUID();
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
const teamProfile = {
  id: teamId,
  isPlatformAdmin: false,
  tenantMemberships: [],
  companyMemberships: [{
    companyId,
    role: "BPO_TEAM" as const,
    permissions: ["documents.upload", "documents.view", "approvals.request", "accounts-payable.create"],
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
  processingConfidence: 87,
  documentNumber: "DOC-TESTE-001",
  expenseType: "Administrativo",
};

try {
  await database.user.createMany({
    data: [
      { id: adminId, name: "Administrador de documentos", email: `document-admin-${adminId}@idex.invalid`, emailVerified: true },
      { id: teamId, name: "Analista de documentos", email: `document-team-${teamId}@idex.invalid`, emailVerified: true },
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
        create: [{
          userId: clientId,
          role: "CLIENT",
          permissions: ["documents.upload", "documents.view"],
        }, {
          userId: teamId,
          role: "BPO_TEAM",
          permissions: ["documents.upload", "documents.view", "approvals.request", "accounts-payable.create"],
        }],
      },
    },
  });

  const storedFileId = randomUUID();
  const storedContents = Buffer.from("arquivo persistente do assistente de documentos", "utf8");
  const storedFile = await storeDocumentFileChunk(adminProfile, {
    fileId: storedFileId,
    companyId,
    fileName: baseDocument.name,
    mimeType: baseDocument.mimeType,
    size: storedContents.byteLength,
    chunkIndex: 0,
    totalChunks: 1,
    data: storedContents.toString("base64"),
  });
  assert.equal(storedFile.complete, true);
  const downloadedFile = await readDocumentFile(adminProfile, storedFileId);
  assert.equal(downloadedFile.data.toString("utf8"), storedContents.toString("utf8"));

  const privateDocument = await createDocument(adminProfile, {
    ...baseDocument,
    previewUrl: storedFile.url,
  });
  assert.match(privateDocument.document.id, /^[0-9a-f-]{36}$/i);
  assert.equal(privateDocument.document.status, "Aguardando Análise");
  assert.equal(privateDocument.document.signedUrl, storedFile.url);
  await assert.rejects(
    readDocumentFile(clientProfile, storedFileId),
    (error) => error instanceof DocumentFileError && error.status === 403,
  );
  assert.equal(privateDocument.document.amount, 250.5);
  assert.equal(privateDocument.document.processingConfidence, 87);
  const storedPrivateDocument = await database.document.findUniqueOrThrow({
    where: { id: privateDocument.document.id },
    select: { processingConfidence: true },
  });
  assert.equal(Number(storedPrivateDocument.processingConfidence), 0.87);

  const updated = await updateDocument(adminProfile, privateDocument.document.id, {
    description: "Documento atualizado no PostgreSQL",
    amount: 300,
    processingConfidence: 92,
    entryType: "Conta a Pagar",
  });
  assert.equal(updated.description, "Documento atualizado no PostgreSQL");
  assert.equal(updated.amount, 300);
  assert.equal(updated.processingConfidence, 92);
  const launchedByBpo = await launchDocument(adminProfile, privateDocument.document.id, {
    entryType: "Conta a Pagar",
    costCenter: "Administrativo",
    paymentMethod: "Boleto",
  });
  assert.equal(launchedByBpo.status, "Lançado");
  assert.ok(launchedByBpo.relatedEntityId);
  assert.equal(
    (await database.accountPayable.findUniqueOrThrow({ where: { id: launchedByBpo.relatedEntityId } })).status,
    "UPCOMING",
  );

  const sharedFileId = randomUUID();
  const sharedContents = Buffer.from("arquivo compartilhado com o cliente", "utf8");
  const sharedFile = await storeDocumentFileChunk(adminProfile, {
    fileId: sharedFileId,
    companyId,
    fileName: "documento-compartilhado.pdf",
    mimeType: "application/pdf",
    size: sharedContents.byteLength,
    chunkIndex: 0,
    totalChunks: 1,
    data: sharedContents.toString("base64"),
  });
  const shared = await createDocument(adminProfile, {
    ...baseDocument,
    name: "documento-compartilhado.pdf",
    recipientId: clientId,
    previewUrl: sharedFile.url,
  });
  assert.equal(shared.document.status, "Compartilhado");
  assert.equal(shared.document.purpose, "VIEW_ONLY");
  assert.equal(
    (await readDocumentFile(clientProfile, sharedFileId)).data.toString("utf8"),
    sharedContents.toString("utf8"),
  );

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
  assert.equal(approved.document.entryType, "Conta a Pagar");
  assert.ok(approved.document.relatedEntityId);
  const approvedPayable = await database.accountPayable.findUniqueOrThrow({
    where: { id: approved.document.relatedEntityId },
  });
  assert.equal(Number(approvedPayable.amount), baseDocument.amount);
  assert.equal(approvedPayable.createdById, adminId);
  assert.equal(approvedPayable.status, "UPCOMING");

  const invalidApproval = await createDocument(adminProfile, {
    ...baseDocument,
    name: "documento-aprovacao-invalida.pdf",
    amount: 0,
    approvalRecipientId: clientId,
  });
  await assert.rejects(
    decideDocumentApproval(clientProfile, invalidApproval.approval!.id, {
      decision: "Aprovada",
      comment: "Tentativa sem valor",
    }),
    (error) => error instanceof DocumentRecordApiError && error.status === 400,
  );
  const invalidApprovalAfterFailure = await database.approval.findUniqueOrThrow({
    where: { id: invalidApproval.approval!.id },
  });
  const invalidDocumentAfterFailure = await database.document.findUniqueOrThrow({
    where: { id: invalidApproval.document.id },
  });
  assert.equal(invalidApprovalAfterFailure.status, "PENDING");
  assert.equal(invalidDocumentAfterFailure.status, "AWAITING_APPROVAL");
  assert.equal(invalidDocumentAfterFailure.relatedEntityId, null);

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
  assert.equal(adminWorkspace.documents.length, 5);
  assert.equal(adminWorkspace.documentApprovals.length, 3);
  const clientWorkspace = await listDocuments(clientProfile);
  assert.deepEqual(
    new Set(clientWorkspace.documents.map((item) => item.id)),
    new Set([shared.document.id, directApproval.document.id, invalidApproval.document.id, submitted.document.id]),
  );
  assert.equal(clientWorkspace.documentApprovals.length, 3);

  const clientOwned = await createDocument(clientProfile, {
    ...baseDocument,
    name: "documento-do-cliente.pdf",
  });
  assert.equal(clientOwned.document.uploadedById, clientId);
  assert.equal(clientOwned.document.status, "Aguardando Análise");
  assert.equal(
    (await listDocuments(adminProfile)).documents.some(
      (item) => item.id === clientOwned.document.id,
    ),
    true,
  );
  assert.equal(
    (await listDocuments(teamProfile)).documents.some(
      (item) => item.id === clientOwned.document.id,
    ),
    true,
  );
  assert.equal(
    (await listDocuments(teamProfile)).documentUsers.some(
      (user) => user.id === clientId && user.role === "CLIENT",
    ),
    true,
  );
  assert.equal((await listDocuments(clientProfile)).documentUsers.length, 0);
  const reviewedClientDocument = await updateDocument(
    teamProfile,
    clientOwned.document.id,
    { amount: 475.9, description: "Documento revisado pelo BPO" },
  );
  assert.equal(reviewedClientDocument.amount, 475.9);
  const clientApproval = await submitDocumentApproval(
    teamProfile,
    clientOwned.document.id,
    { recipientId: clientId },
  );
  assert.equal(clientApproval.document.status, "Aguardando Aprovação");
  assert.equal(clientApproval.document.uploadedById, clientId);
  assert.equal(clientApproval.document.sharedByRole, "BPO_TEAM");
  assert.equal(
    (await listDocuments(clientProfile)).documents.some(
      (item) =>
        item.id === clientOwned.document.id &&
        item.status === "Aguardando Aprovação",
    ),
    true,
  );
  const returnedToBpo = await decideDocumentApproval(
    clientProfile,
    clientApproval.approval.id,
    { decision: "Ajuste solicitado", comment: "Revisar o valor" },
  );
  assert.equal(returnedToBpo.document.status, "Aguardando Análise");
  assert.equal(
    (await listDocuments(teamProfile)).documents.some(
      (item) =>
        item.id === clientOwned.document.id &&
        item.status === "Aguardando Análise",
    ),
    true,
  );
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
  await database.accountPayable.deleteMany({ where: { companyId } });
  await database.accountReceivable.deleteMany({ where: { companyId } });
  await database.company.deleteMany({ where: { id: companyId } });
  await database.tenant.deleteMany({ where: { id: tenantId } });
  await database.user.deleteMany({ where: { id: { in: [adminId, teamId, clientId, outsiderId] } } });
  await disconnectDatabase();
}
