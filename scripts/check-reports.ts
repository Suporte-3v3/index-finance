import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

const { disconnectDatabase, getDatabaseClient } = await import("../backend/database.js");
const {
  ReportApiError,
  createReport,
  createReportTemplate,
  deleteReport,
  deleteReportTemplate,
  listReports,
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
const adminId = randomUUID();
const generatorId = randomUUID();
const viewerId = randomUUID();
const restrictedId = randomUUID();
const userIds = [adminId, generatorId, viewerId, restrictedId];

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
  permissions: ["reports.view", "reports.generate"],
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
  await database.companyMembership.createMany({
    data: [generator, viewer, restricted].flatMap((item) => item.companyMemberships.map((membership) => ({
      ...membership,
      userId: item.id,
    }))),
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
  });
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
  await updateReportTemplate(generator, template.id, { name: "Modelo atualizado" });

  const adminReport = await createReport(admin, {
    companyId,
    name: "Relatório do administrador",
    type: "Fluxo de Caixa",
    filters: {},
  });
  assert.ok(adminReport.id);

  console.log("Relatórios validados: RBAC de consulta, geração, modelos e exclusão.");
} finally {
  await database.notification.deleteMany({ where: { companyId } });
  await database.report.deleteMany({ where: { companyId } });
  await database.reportTemplate.deleteMany({ where: { companyId } });
  await database.companyMembership.deleteMany({ where: { companyId } });
  await database.auditLog.deleteMany({ where: { companyId } });
  await database.company.deleteMany({ where: { id: companyId } });
  await database.tenantMembership.deleteMany({ where: { tenantId } });
  await database.tenant.deleteMany({ where: { id: tenantId } });
  await database.user.deleteMany({ where: { id: { in: userIds } } });
  await disconnectDatabase();
}
