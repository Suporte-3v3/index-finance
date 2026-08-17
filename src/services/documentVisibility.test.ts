import assert from "node:assert/strict";
import test from "node:test";
import type { Document, User } from "../types";
import {
  getDocumentsVisibleToUser,
  isDocumentDeliveredByBpo,
} from "./documentVisibility";

const client: User = {
  id: "client-1",
  name: "Cliente",
  email: "cliente@exemplo.com",
  role: "CLIENT",
  status: "ACTIVE",
  companies: ["company-1"],
  permissions: ["documents.upload"],
};

const clientUpload: Document = {
  id: "document-client",
  companyId: "company-1",
  category: "Boleto",
  name: "boleto.pdf",
  description: "Documento enviado pelo cliente",
  competenceMonth: "2026-08",
  uploadedAt: "2026-08-17T12:00:00.000Z",
  uploadedById: client.id,
  uploadedByName: client.name,
  fileSize: "10 KB",
  mimeType: "application/pdf",
  hash: "hash-client",
  status: "Aguardando Análise",
  purpose: "PROCESSING",
};

test("documento do cliente continua em seus envios após o BPO solicitar aprovação", () => {
  const submittedForApproval: Document = {
    ...clientUpload,
    recipientId: client.id,
    recipientName: client.name,
    recipientRole: "CLIENT",
    sharedById: "bpo-1",
    sharedByName: "Analista BPO",
    sharedByRole: "BPO_TEAM",
    sharedAt: "2026-08-17T13:00:00.000Z",
    status: "Aguardando Aprovação",
  };

  assert.equal(isDocumentDeliveredByBpo(submittedForApproval, client.id), false);
  assert.deepEqual(
    getDocumentsVisibleToUser([submittedForApproval], client).map(({ id }) => id),
    [submittedForApproval.id],
  );
});

test("documento criado pelo BPO para o cliente aparece como recebido", () => {
  const deliveredByBpo: Document = {
    ...clientUpload,
    id: "document-bpo",
    uploadedById: "bpo-1",
    uploadedByName: "Analista BPO",
    recipientId: client.id,
    recipientName: client.name,
    recipientRole: "CLIENT",
    sharedById: "bpo-1",
    sharedByName: "Analista BPO",
    sharedByRole: "BPO_TEAM",
    sharedAt: "2026-08-17T13:00:00.000Z",
    status: "Compartilhado",
    purpose: "VIEW_ONLY",
  };

  assert.equal(isDocumentDeliveredByBpo(deliveredByBpo, client.id), true);
});

