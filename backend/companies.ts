import { getDatabaseClient } from "./database.js";

type Role = "BPO_ADMIN" | "BPO_TEAM" | "CLIENT" | "ACCOUNTANT";

export interface AccessProfile {
  id: string;
  isPlatformAdmin: boolean;
  tenantMemberships: Array<{ tenantId: string; role: Role }>;
  companyMemberships: Array<{ companyId: string; role: Role }>;
}

export class CompanyApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const STATUS_TO_DATABASE = {
  "Implantação": "IMPLEMENTATION",
  "Em dia": "ACTIVE",
  OK: "ACTIVE",
  Atenção: "ATTENTION",
  Atraso: "OVERDUE",
  "Sem movimentação": "NO_ACTIVITY",
  Inativo: "INACTIVE",
} as const;

const STATUS_FROM_DATABASE = {
  IMPLEMENTATION: "Implantação",
  ACTIVE: "Em dia",
  ATTENTION: "Atenção",
  OVERDUE: "Atraso",
  NO_ACTIVITY: "Sem movimentação",
  INACTIVE: "Inativo",
} as const;

const BANK_TYPE_TO_DATABASE = {
  Corrente: "CHECKING",
  Poupança: "SAVINGS",
  Investimento: "INVESTMENT",
  Caixa: "CASH",
} as const;

const BANK_TYPE_FROM_DATABASE = {
  CHECKING: "Corrente",
  SAVINGS: "Poupança",
  INVESTMENT: "Investimento",
  CASH: "Caixa",
} as const;

const MASTER_DATA_TYPES = new Set([
  "CATEGORY",
  "SUBCATEGORY",
  "PAYMENT_METHOD",
  "COST_CENTER",
  "DOCUMENT_TYPE",
  "SUPPLIER",
  "CUSTOMER",
  "BAKERY_REGISTER",
]);

const CLIENT_MODULES = new Set([
  "dashboard",
  "approvals",
  "documents",
  "cash-flow",
  "reports",
  "support",
  "bakery-cash",
]);

function requiredText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new CompanyApiError(`Informe ${field}.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new CompanyApiError(`${field} excede o tamanho permitido.`);
  }
  return normalized;
}

function optionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new CompanyApiError("Campo inválido.");
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new CompanyApiError("Campo excede o tamanho permitido.");
  }
  return normalized || null;
}

function email(value: unknown, field: string, required: boolean) {
  const normalized = optionalText(value, 254)?.toLowerCase() || null;
  if (required && !normalized) throw new CompanyApiError(`Informe ${field}.`);
  if (normalized && !/^\S+@\S+\.\S+$/.test(normalized)) {
    throw new CompanyApiError(`${field} inválido.`);
  }
  return normalized;
}

function cnpj(value: unknown) {
  const normalized = requiredText(value, "o CNPJ", 30).replace(/\D/g, "");
  if (normalized.length !== 14) throw new CompanyApiError("CNPJ inválido.");
  return normalized;
}

function modules(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new CompanyApiError("Selecione pelo menos um módulo do cliente.");
  }
  const normalized = [
    ...new Set(value.filter((item): item is string => typeof item === "string")),
  ];
  if (normalized.some((item) => !CLIENT_MODULES.has(item))) {
    throw new CompanyApiError("A lista de módulos contém um valor inválido.");
  }
  return normalized;
}

function money(value: unknown, field: string) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) throw new CompanyApiError(`${field} inválido.`);
  return normalized;
}

function logo(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (
    typeof value !== "string" ||
    !/^data:image\/(?:png|jpeg|webp);base64,/i.test(value) ||
    value.length > 1_500_000
  ) {
    throw new CompanyApiError("A logo deve ser uma imagem PNG, JPEG ou WebP válida.");
  }
  return value;
}

function managementTenantIds(profile: AccessProfile) {
  return profile.tenantMemberships
    .filter(({ role }) => role === "BPO_ADMIN")
    .map(({ tenantId }) => tenantId);
}

async function resolveTenant(profile: AccessProfile, requestedTenantId?: unknown) {
  const manageable = managementTenantIds(profile);
  const requested =
    typeof requestedTenantId === "string" && requestedTenantId
      ? requestedTenantId
      : undefined;

  let tenantId: string | undefined;
  if (profile.isPlatformAdmin) {
    tenantId = requested || manageable[0];
  } else {
    tenantId = requested ? manageable.find((id) => id === requested) : manageable[0];
  }
  if (!tenantId) {
    throw new CompanyApiError("Sua conta não administra um tenant ativo.", 403);
  }

  const tenant = await getDatabaseClient().tenant.findFirst({
    where: { id: tenantId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!tenant) throw new CompanyApiError("Tenant não encontrado.", 404);
  return tenant.id;
}

function canManageCompany(
  profile: AccessProfile,
  company: { id: string; tenantId: string },
) {
  return (
    profile.isPlatformAdmin ||
    managementTenantIds(profile).includes(company.tenantId) ||
    profile.companyMemberships.some(
      ({ companyId, role }) => companyId === company.id && role === "BPO_ADMIN",
    )
  );
}

function mapCompany(company: any) {
  return {
    id: company.id,
    tenantId: company.tenantId,
    cnpj: company.cnpj,
    corporateName: company.corporateName,
    tradeName: company.tradeName,
    segment: company.segment || "",
    taxRegime: company.taxRegime || "",
    accountantName: company.accountantName || "",
    accountantEmail: company.accountantEmail || "",
    primaryContactName: company.primaryContactName || "",
    primaryContactEmail: company.primaryContactEmail || "",
    bpoResponsibleId: company.bpoResponsibleId || "",
    status: STATUS_FROM_DATABASE[company.status as keyof typeof STATUS_FROM_DATABASE],
    approvalLimit: Number(company.approvalLimit),
    logoDataUrl: company.logoDataUrl || undefined,
    clientModules: company.clientModules,
    createdAt: company.createdAt.toISOString(),
  };
}

function mapTenant(tenant: any) {
  return {
    id: tenant.id,
    name: tenant.name,
    createdAt: tenant.createdAt.toISOString(),
    plan: tenant.plan,
    status: tenant.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
  };
}

export async function listAccessibleCompanies(profile: AccessProfile) {
  const tenantIds = profile.tenantMemberships
    .filter(({ role }) => role === "BPO_ADMIN" || role === "BPO_TEAM")
    .map(({ tenantId }) => tenantId);
  const companyIds = profile.companyMemberships.map(({ companyId }) => companyId);
  const database = getDatabaseClient();
  const companies = await database.company.findMany({
    where: {
      deletedAt: null,
      ...(profile.isPlatformAdmin
        ? {}
        : { OR: [{ tenantId: { in: tenantIds } }, { id: { in: companyIds } }] }),
    },
    include: { tenant: true },
    orderBy: [{ tradeName: "asc" }],
  });
  const tenants = [
    ...new Map(companies.map(({ tenant }) => [tenant.id, tenant])).values(),
  ];

  // A conta recém-criada pode ainda não ter empresas, mas precisa conhecer o
  // próprio tenant para cadastrar a primeira.
  if (tenants.length === 0 && profile.tenantMemberships.length > 0) {
    const membershipTenants = await database.tenant.findMany({
      where: {
        id: { in: profile.tenantMemberships.map(({ tenantId }) => tenantId) },
        status: "ACTIVE",
      },
    });
    tenants.push(...membershipTenants);
  }

  return {
    companies: companies.map(mapCompany),
    tenants: tenants.map(mapTenant),
  };
}

export async function createCompany(profile: AccessProfile, body: any) {
  const tenantId = await resolveTenant(profile, body?.tenantId);
  const bpoResponsibleId = requiredText(
    body?.bpoResponsibleId || profile.id,
    "o responsável BPO",
    100,
  );
  const responsible = await getDatabaseClient().user.findFirst({
    where: {
      id: bpoResponsibleId,
      status: "ACTIVE",
      deletedAt: null,
      OR: [
        { isPlatformAdmin: true },
        {
          tenantMemberships: {
            some: {
              tenantId,
              status: "ACTIVE",
              role: { in: ["BPO_ADMIN", "BPO_TEAM"] },
            },
          },
        },
      ],
    },
    select: { id: true },
  });
  if (!responsible) {
    throw new CompanyApiError("Responsável BPO inválido para este tenant.");
  }

  const primaryContactEmail = email(
    body?.primaryContactEmail,
    "o e-mail do contato principal",
    true,
  );
  const accountantEmail = email(body?.accountantEmail, "o e-mail do contador", false);
  if (accountantEmail && accountantEmail === primaryContactEmail) {
    throw new CompanyApiError("Contato principal e contador devem ter e-mails diferentes.");
  }
  const accountantName = optionalText(body?.accountantName, 160);
  if (Boolean(accountantName) !== Boolean(accountantEmail)) {
    throw new CompanyApiError("Informe nome e e-mail do contador, ou deixe ambos vazios.");
  }

  const bank = body?.onboarding?.initialBankAccount;
  const bankType = BANK_TYPE_TO_DATABASE[
    bank?.type as keyof typeof BANK_TYPE_TO_DATABASE
  ];
  if (!bankType) throw new CompanyApiError("Tipo da conta bancária inválido.");

  const masterDataInput = body?.onboarding?.masterData;
  if (!masterDataInput || typeof masterDataInput !== "object") {
    throw new CompanyApiError("Cadastros iniciais ausentes.");
  }
  const masterData = Object.entries(masterDataInput).flatMap(([type, values]) => {
    if (!MASTER_DATA_TYPES.has(type) || !Array.isArray(values)) return [];
    return [
      ...new Set(
        values
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ].map((name) => ({ type: type as any, name: name.slice(0, 160) }));
  });

  try {
    return await getDatabaseClient().$transaction(async (transaction) => {
      const company = await transaction.company.create({
        data: {
          tenantId,
          cnpj: cnpj(body?.cnpj),
          corporateName: requiredText(body?.corporateName, "a razão social", 200),
          tradeName: requiredText(body?.tradeName, "o nome fantasia", 160),
          segment: optionalText(body?.segment, 100),
          taxRegime: optionalText(body?.taxRegime, 80),
          accountantName,
          accountantEmail,
          primaryContactName: requiredText(
            body?.primaryContactName,
            "o contato principal",
            160,
          ),
          primaryContactEmail,
          bpoResponsibleId: responsible.id,
          approvalLimit: money(body?.approvalLimit, "Limite de aprovação"),
          logoDataUrl: logo(body?.logoDataUrl),
          clientModules: modules(body?.clientModules),
          status: "IMPLEMENTATION",
        },
      });
      const initialBankAccount = await transaction.bankAccount.create({
        data: {
          companyId: company.id,
          bankName: requiredText(bank?.bankName, "o banco", 160),
          agency: optionalText(bank?.agency, 20),
          accountNumber: requiredText(bank?.accountNumber, "a conta bancária", 40),
          type: bankType,
          balance: money(bank?.balance, "Saldo inicial"),
        },
      });
      if (masterData.length) {
        await transaction.masterDataOption.createMany({
          data: masterData.map((item) => ({ ...item, companyId: company.id })),
          skipDuplicates: true,
        });
      }
      const savedMasterData = await transaction.masterDataOption.findMany({
        where: { companyId: company.id },
        orderBy: [{ type: "asc" }, { name: "asc" }],
      });
      return {
        company: mapCompany(company),
        initialBankAccount: {
          id: initialBankAccount.id,
          companyId: company.id,
          bankName: initialBankAccount.bankName,
          agency: initialBankAccount.agency || "",
          accountNumber: initialBankAccount.accountNumber,
          type: BANK_TYPE_FROM_DATABASE[initialBankAccount.type],
          balance: Number(initialBankAccount.balance),
        },
        masterData: savedMasterData.map((item) => ({
          id: item.id,
          companyId: item.companyId,
          type: item.type,
          name: item.name,
          active: item.active,
          createdAt: item.createdAt.toISOString(),
        })),
      };
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      throw new CompanyApiError("Já existe uma empresa com este CNPJ.", 409);
    }
    throw error;
  }
}

export async function updateCompany(
  profile: AccessProfile,
  companyId: string,
  body: any,
) {
  const database = getDatabaseClient();
  const existing = await database.company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { id: true, tenantId: true },
  });
  if (!existing) throw new CompanyApiError("Empresa não encontrada.", 404);
  if (!canManageCompany(profile, existing)) {
    throw new CompanyApiError("Sem permissão para alterar esta empresa.", 403);
  }

  const data: Record<string, unknown> = {};
  if (body.cnpj !== undefined) data.cnpj = cnpj(body.cnpj);
  if (body.corporateName !== undefined)
    data.corporateName = requiredText(body.corporateName, "a razão social", 200);
  if (body.tradeName !== undefined)
    data.tradeName = requiredText(body.tradeName, "o nome fantasia", 160);
  if (body.segment !== undefined) data.segment = optionalText(body.segment, 100);
  if (body.taxRegime !== undefined) data.taxRegime = optionalText(body.taxRegime, 80);
  if (body.accountantName !== undefined)
    data.accountantName = optionalText(body.accountantName, 160);
  if (body.accountantEmail !== undefined)
    data.accountantEmail = email(body.accountantEmail, "o e-mail do contador", false);
  if (body.primaryContactName !== undefined)
    data.primaryContactName = requiredText(
      body.primaryContactName,
      "o contato principal",
      160,
    );
  if (body.primaryContactEmail !== undefined)
    data.primaryContactEmail = email(
      body.primaryContactEmail,
      "o e-mail do contato principal",
      true,
    );
  if (body.approvalLimit !== undefined)
    data.approvalLimit = money(body.approvalLimit, "Limite de aprovação");
  if (body.logoDataUrl !== undefined) data.logoDataUrl = logo(body.logoDataUrl);
  if (body.clientModules !== undefined) data.clientModules = modules(body.clientModules);
  if (body.status !== undefined) {
    const status = STATUS_TO_DATABASE[body.status as keyof typeof STATUS_TO_DATABASE];
    if (!status) throw new CompanyApiError("Status da empresa inválido.");
    data.status = status;
  }

  try {
    const updated = await database.company.update({
      where: { id: companyId },
      data,
    });
    return mapCompany(updated);
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      throw new CompanyApiError("Já existe uma empresa com este CNPJ.", 409);
    }
    throw error;
  }
}

export async function deactivateCompany(profile: AccessProfile, companyId: string) {
  const database = getDatabaseClient();
  const existing = await database.company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { id: true, tenantId: true },
  });
  if (!existing) throw new CompanyApiError("Empresa não encontrada.", 404);
  if (!canManageCompany(profile, existing)) {
    throw new CompanyApiError("Sem permissão para desativar esta empresa.", 403);
  }
  await database.company.update({
    where: { id: companyId },
    data: { status: "INACTIVE", deletedAt: new Date() },
  });
}
