import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

const { disconnectDatabase, getDatabaseClient } = await import(
  "../backend/database.js"
);
const {
  CompanyApiError,
  createCompany,
  deactivateCompany,
  listAccessibleCompanies,
  updateCompany,
} = await import("../backend/companies.js");

const database = getDatabaseClient();
const userId = randomUUID();
const tenantId = randomUUID();
let companyId: string | undefined;

const profile = {
  id: userId,
  isPlatformAdmin: true,
  tenantMemberships: [{ tenantId, role: "BPO_ADMIN" as const }],
  companyMemberships: [],
};

try {
  await database.user.create({
    data: {
      id: userId,
      name: "Verificação de empresas",
      email: `company-check-${userId}@idex.invalid`,
      emailVerified: true,
      status: "ACTIVE",
      isPlatformAdmin: true,
    },
  });
  await database.tenant.create({
    data: {
      id: tenantId,
      name: "Tenant temporário de empresas",
      slug: `company-check-${tenantId}`,
      memberships: {
        create: { userId, role: "BPO_ADMIN", status: "ACTIVE" },
      },
    },
  });

  const created = await createCompany(profile, {
    tenantId,
    cnpj: `9${Date.now().toString().slice(-13)}`,
    corporateName: "Empresa de Verificação Ltda",
    tradeName: "Empresa de Verificação",
    segment: "Serviços",
    taxRegime: "Simples Nacional",
    primaryContactName: "Contato de Teste",
    primaryContactEmail: "contato-company-check@idex.invalid",
    accountantName: "",
    accountantEmail: "",
    bpoResponsibleId: userId,
    approvalLimit: 5000,
    clientModules: ["dashboard", "reports"],
    onboarding: {
      initialBankAccount: {
        bankName: "Banco de Teste",
        agency: "0001",
        accountNumber: "12345-6",
        type: "Corrente",
        balance: 100,
      },
      masterData: {
        CATEGORY: ["Administrativo"],
        PAYMENT_METHOD: ["PIX"],
      },
    },
  });
  companyId = created.company.id;
  assert.equal(created.initialBankAccount.companyId, companyId);
  assert.equal(created.masterData.length, 2);

  const workspace = await listAccessibleCompanies(profile);
  assert.equal(workspace.companies.some(({ id }) => id === companyId), true);

  const updated = await updateCompany(profile, companyId, {
    tradeName: "Empresa de Verificação Atualizada",
    status: "Em dia",
  });
  assert.equal(updated.tradeName, "Empresa de Verificação Atualizada");
  assert.equal(updated.status, "Em dia");

  await assert.rejects(
    updateCompany(
      {
        id: randomUUID(),
        isPlatformAdmin: false,
        tenantMemberships: [],
        companyMemberships: [],
      },
      companyId,
      { tradeName: "Alteração indevida" },
    ),
    (error) => error instanceof CompanyApiError && error.status === 403,
  );

  await deactivateCompany(profile, companyId);
  assert.ok(
    await database.company.findFirst({
      where: { id: companyId, deletedAt: { not: null } },
    }),
  );

  console.log(
    "Empresas validadas: criação transacional, listagem isolada, edição e desativação.",
  );
} finally {
  if (companyId) {
    await database.masterDataOption.deleteMany({ where: { companyId } });
    await database.bankAccount.deleteMany({ where: { companyId } });
    await database.company.deleteMany({ where: { id: companyId } });
  }
  await database.user.deleteMany({ where: { id: userId } });
  await database.tenant.deleteMany({ where: { id: tenantId } });
  await disconnectDatabase();
}
