import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

const { disconnectDatabase, getDatabaseClient } = await import("../backend/database.js");
const { createDocument } = await import("../backend/document-records.js");
const { storeDocumentFileChunk } = await import("../backend/document-files.js");
const {
  ReportApiError,
  createReport,
  createReportTemplate,
  deleteReport,
  deleteReportTemplate,
  listReports,
  listReportTemplates,
  updateReportTemplate,
} = await import("../backend/reports.js");

type Role = "BPO_ADMIN" | "BPO_TEAM" | "CLIENT" | "ACCOUNTANT";
type TestProfile = {
  id: string;
  name: string;
  isPlatformAdmin: boolean;
  tenantMemberships: Array<{ tenantId: string; role: Role }>;
  companyMemberships: Array<{ companyId: string; role: Role; permissions: string[] }>;
};

async function expectForbidden(operation: () => Promise<unknown>) {
  await assert.rejects(operation, (error: unknown) =>
    error instanceof ReportApiError && error.status === 403,
  );
}

const database = getDatabaseClient();
const marker = randomUUID();
const tenantId = randomUUID();
const companyId = randomUUID();
const foreignCompanyId = randomUUID();
const adminId = randomUUID();
const generatorId = randomUUID();
const viewerId = randomUUID();
const restrictedId = randomUUID();
const foreignRecipientId = randomUUID();
const userIds = [adminId, generatorId, viewerId, restrictedId, foreignRecipientId];

const profile = (
  id: string,
  name: string,
  companyMemberships: TestProfile["companyMemberships"],
  tenantMemberships: TestProfile["tenantMemberships"] = [],
): TestProfile => ({ id, name, isPlatformAdmin: false, tenantMemberships, companyMemberships });

const admin = profile(adminId, "Administrador BPO", [], [{ tenantId, role: "BPO_ADMIN" }]);
const generator = profile(generatorId, "Gerador", [{
  companyId,
  role: "CLIENT",
  permissions: ["reports.view", "reports.generate", "documents.upload"],
}]);
const viewer = profile(viewerId, "Visualizador", [{
  companyId,
  role: "CLIENT",
  permissions: ["reports.view"],
}]);
const restricted = profile(restrictedId, "Sem relatórios", [{ companyId, role: "CLIENT", permissions: [] }]);

try {
  await database.tenant.create({
    data: { id: tenantId, name: "Verificação de relatórios", slug: `reports-check-${marker}` },
  });
  await database.user.createMany({
    data: [
      { id: adminId, name: admin.name, email: `reports-admin-${marker}@idex.invalid`, emailVerified: true, passwordChangedAt: new Date() },
      { id: generatorId, name: generator.name, email: `reports-generator-${marker}@idex.invalid`, emailVerified: true, passwordChangedAt: new Date() },
      { id: viewerId, name: viewer.name, email: `reports-viewer-${marker}@idex.invalid`, emailVerified: true, passwordChangedAt: new Date() },
      { id: restrictedId, name: restricted.name, email: `reports-restricted-${marker}@idex.invalid`, emailVerified: true, passwordChangedAt: new Date() },
      { id: foreignRecipientId, name: "Cliente externo", email: `reports-foreign-${marker}@idex.invalid`, emailVerified: true, passwordChangedAt: new Date() },
    ],
  });
  await database.company.create({
    data: {
      id: companyId,
      tenantId,
      cnpj: marker.replace(/-/g, "").slice(0, 14),
      corporateName: "Empresa da verificação de relatórios",
      tradeName: "Empresa Relatórios",
      clientModules: ["reports"],
    },
  });
  await database.company.create({
    data: {
      id: foreignCompanyId,
      tenantId,
      cnpj: marker.replace(/-/g, "").slice(14, 28),
      corporateName: "Outra empresa da verificação",
      tradeName: "Empresa Externa",
      clientModules: ["reports"],
    },
  });
  await database.companyMembership.createMany({
    data: [
      ...[generator, viewer, restricted].flatMap((item) => item.companyMemberships.map((membership) => ({
        ...membership,
        userId: item.id,
      }))),
      {
        companyId: foreignCompanyId,
        userId: foreignRecipientId,
        role: "CLIENT",
        permissions: ["reports.view"],
      },
    ],
  });

  await expectForbidden(() => createReport(restricted, {
    companyId,
    name: "Relatório indevido",
    type: "DRE Gerencial",
    filters: {},
  }));

  const report = await createReport(generator, {
    companyId,
    name: "Relatório autorizado",
    type: "DRE Gerencial",
    filters: {},
    recipientId: viewerId,
    recipientName: "Nome adulterado",
    recipientRole: "ACCOUNTANT",
  });
  assert.equal(report.recipientName, viewer.name);
  assert.equal(report.recipientRole, "CLIENT");
  assert.ok((await listReports(viewer)).some((item) => item.id === report.id));
  assert.deepEqual(await listReports(restricted), []);
  await expectForbidden(() => deleteReport(viewer, report.id));

  const template = await createReportTemplate(generator, {
    companyId,
    name: "Modelo autorizado",
    modelType: "DRE Gerencial",
    blocks: [],
    filters: {},
  });
  await expectForbidden(() => updateReportTemplate(viewer, template.id, { name: "Alteração indevida" }));
  await expectForbidden(() => deleteReportTemplate(viewer, template.id));
  const updatedTemplate = await updateReportTemplate(generator, template.id, {
    name: "Modelo atualizado",
    orientation: "landscape",
  });
  assert.equal(updatedTemplate.orientation, "landscape");
  assert.equal((await listReportTemplates(viewer)).some((item) => item.id === template.id), false);

  const adminReport = await createReport(admin, {
    companyId,
    name: "Relatório do administrador",
    type: "Fluxo de Caixa",
    filters: {},
  });
  assert.ok(adminReport.id);
  assert.equal((await listReports(viewer)).some((item) => item.id === adminReport.id), false);

  await assert.rejects(
    () => createReport(generator, {
      companyId,
      name: "Destinatário externo",
      type: "Contas a Receber",
      filters: {},
      recipientId: foreignRecipientId,
    }),
    (error: unknown) => error instanceof ReportApiError && error.status === 400,
  );

  const fileId = randomUUID();
  const fileContents = Buffer.from("%PDF-1.4\nrelatorio de verificacao\n");
  const storedFile = await storeDocumentFileChunk(generator, {
    fileId,
    companyId,
    fileName: "relatorio-verificacao.pdf",
    mimeType: "application/pdf",
    size: fileContents.byteLength,
    chunkIndex: 0,
    totalChunks: 1,
    data: fileContents.toString("base64"),
  });
  const documentResult = await createDocument(generator, {
    companyId,
    name: "relatorio-verificacao.pdf",
    description: "Relatório gerado pela verificação",
    category: "Relatório",
    competenceMonth: "2026-08",
    fileSize: `${fileContents.byteLength} B`,
    mimeType: "application/pdf",
    previewUrl: storedFile.url,
    origin: "Documento",
  });
  assert.equal(documentResult.document.signedUrl, storedFile.url);

  console.log("Relatórios validados: RBAC de consulta, geração, modelos e exclusão.");
} finally {
  const companyIds = [companyId, foreignCompanyId];
  await database.notification.deleteMany({ where: { companyId: { in: companyIds } } });
  await database.document.deleteMany({ where: { companyId: { in: companyIds } } });
  await database.documentFile.deleteMany({ where: { companyId: { in: companyIds } } });
  await database.report.deleteMany({ where: { companyId: { in: companyIds } } });
  await database.reportTemplate.deleteMany({ where: { companyId: { in: companyIds } } });
  await database.companyMembership.deleteMany({ where: { companyId: { in: companyIds } } });
  await database.auditLog.deleteMany({ where: { companyId: { in: companyIds } } });
  await database.company.deleteMany({ where: { id: { in: companyIds } } });
  await database.tenantMembership.deleteMany({ where: { tenantId } });
  await database.tenant.deleteMany({ where: { id: tenantId } });
  await database.user.deleteMany({ where: { id: { in: userIds } } });
  await disconnectDatabase();
}
