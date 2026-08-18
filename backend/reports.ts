import { Prisma } from "./generated/prisma/client.js";
import { getDatabaseClient } from "./database.js";
import { writeNotification } from "./notifications.js";

type Role = "BPO_ADMIN" | "BPO_TEAM" | "CLIENT" | "ACCOUNTANT";

export interface ReportAccessProfile {
  id: string;
  name: string;
  isPlatformAdmin: boolean;
  tenantMemberships: Array<{ tenantId: string; role: Role }>;
  companyMemberships: Array<{ companyId: string; role: Role; permissions?: string[] }>;
}

export class ReportApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const MODEL_TYPE_TO_DATABASE = {
  "Contas a Pagar": "PAYABLES",
  "Contas a Receber": "RECEIVABLES",
  "Fluxo de Caixa": "CASH_FLOW",
  "DRE Gerencial": "DRE",
} as const;
const MODEL_TYPE_FROM_DATABASE = {
  PAYABLES: "Contas a Pagar",
  RECEIVABLES: "Contas a Receber",
  CASH_FLOW: "Fluxo de Caixa",
  DRE: "DRE Gerencial",
} as const;

function text(value: unknown, field: string, max: number) {
  if (typeof value !== "string" || !value.trim()) throw new ReportApiError(`Informe ${field}.`);
  const normalized = value.trim();
  if (normalized.length > max) throw new ReportApiError(`${field} excede o tamanho permitido.`);
  return normalized;
}
function optionalText(value: unknown, max: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new ReportApiError("Campo inválido.");
  const normalized = value.trim();
  if (normalized.length > max) throw new ReportApiError("Campo excede o tamanho permitido.");
  return normalized || null;
}
function uuid(value: unknown, field: string, required = true) {
  const normalized = optionalText(value, 36);
  if (!normalized && !required) return null;
  if (!normalized || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new ReportApiError(`${field} inválido.`);
  }
  return normalized;
}
function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function formatFileSize(value: bigint | null) {
  if (value == null) return "—";
  const bytes = Number(value);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function administratorTenantIds(profile: ReportAccessProfile) {
  return profile.tenantMemberships
    .filter(({ role }) => role === "BPO_ADMIN")
    .map(({ tenantId }) => tenantId);
}

function companyIdsWithPermission(profile: ReportAccessProfile, permission: "reports.view" | "reports.generate") {
  return profile.companyMemberships
    .filter(({ role, permissions }) => role === "BPO_ADMIN" || permissions?.includes(permission))
    .map(({ companyId }) => companyId);
}

function isBpoForCompany(profile: ReportAccessProfile, company: { id: string; tenantId: string }) {
  return profile.isPlatformAdmin ||
    administratorTenantIds(profile).includes(company.tenantId) ||
    profile.companyMemberships.some(({ companyId, role }) =>
      companyId === company.id && (role === "BPO_ADMIN" || role === "BPO_TEAM"),
    );
}

async function validateRecipient(companyId: string, recipientId: string) {
  const membership = await getDatabaseClient().companyMembership.findFirst({
    where: {
      companyId,
      userId: recipientId,
      status: "ACTIVE",
      role: { in: ["CLIENT", "ACCOUNTANT"] },
      user: { status: "ACTIVE", deletedAt: null },
    },
    include: { user: { select: { name: true } } },
  });
  if (!membership) throw new ReportApiError("Destinatário inválido para esta empresa.", 400);
  return { id: recipientId, name: membership.user.name, role: membership.role };
}

async function validateTemplate(companyId: string, templateId: string) {
  const template = await getDatabaseClient().reportTemplate.findFirst({
    where: { id: templateId, companyId },
    select: { id: true, name: true },
  });
  if (!template) throw new ReportApiError("Modelo inválido para esta empresa.", 400);
  return template;
}

async function requireCompany(
  profile: ReportAccessProfile,
  companyId: string,
  permission: "reports.view" | "reports.generate",
) {
  const company = await getDatabaseClient().company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { id: true, tenantId: true },
  });
  if (!company) throw new ReportApiError("Empresa não encontrada.", 404);
  const allowed =
    profile.isPlatformAdmin ||
    administratorTenantIds(profile).includes(company.tenantId) ||
    companyIdsWithPermission(profile, permission).includes(company.id);
  if (!allowed) throw new ReportApiError("Sem permissão para esta operação.", 403);
  return company;
}

function mapReport(item: any) {
  return {
    id: item.id,
    companyId: item.companyId,
    name: item.name,
    type: item.type,
    filters: item.filters,
    generatedAt: item.generatedAt.toISOString(),
    generatedById: item.generatedById,
    generatedByName: item.generatedByName,
    format: item.format || undefined,
    fileName: item.fileName || undefined,
    mimeType: item.mimeType || undefined,
    fileUrl: item.objectKey || undefined,
    fileSize: formatFileSize(item.fileSizeBytes),
    templateId: item.templateId || undefined,
    templateName: item.templateName || undefined,
    recipientId: item.recipientId || undefined,
    recipientName: item.recipientName || undefined,
    recipientRole: item.recipientRole || undefined,
  };
}

function mapTemplate(item: any) {
  return {
    id: item.id,
    companyId: item.companyId,
    name: item.name,
    modelType: MODEL_TYPE_FROM_DATABASE[item.modelType as keyof typeof MODEL_TYPE_FROM_DATABASE],
    blocks: item.blocks,
    filters: item.filters,
    dreOptions: item.dreOptions || undefined,
    notes: item.notes || undefined,
    orientation: item.orientation || undefined,
    favorite: item.favorite,
    archived: item.archived,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    createdById: item.createdById,
    createdByName: item.createdByName,
  };
}

export async function listReports(profile: ReportAccessProfile) {
  const database = getDatabaseClient();
  const companies = await database.company.findMany({
    where: profile.isPlatformAdmin
      ? { deletedAt: null }
      : {
          deletedAt: null,
          OR: [
            { tenantId: { in: administratorTenantIds(profile) } },
            { id: { in: companyIdsWithPermission(profile, "reports.view") } },
          ],
        },
    select: { id: true, tenantId: true },
  });
  const bpoCompanyIds = companies.filter((company) => isBpoForCompany(profile, company)).map(({ id }) => id);
  const personalCompanyIds = companies.filter((company) => !isBpoForCompany(profile, company)).map(({ id }) => id);
  const reports = await database.report.findMany({
    where: {
      OR: [
        { companyId: { in: bpoCompanyIds } },
        {
          companyId: { in: personalCompanyIds },
          OR: [{ generatedById: profile.id }, { recipientId: profile.id }],
        },
      ],
    },
    orderBy: { generatedAt: "desc" },
  });
  return reports.map(mapReport);
}

export async function createReport(profile: ReportAccessProfile, body: any) {
  const companyId = uuid(body?.companyId, "a empresa");
  const company = await requireCompany(profile, companyId, "reports.generate");
  const format = body?.format === "PDF" || body?.format === "EXCEL" ? body.format : undefined;
  const recipientId = uuid(body?.recipientId, "o destinatário", false);
  const recipient = recipientId ? await validateRecipient(companyId, recipientId) : null;
  const templateId = uuid(body?.templateId, "o modelo", false);
  const template = templateId ? await validateTemplate(companyId, templateId) : null;

  const report = await getDatabaseClient().report.create({
    data: {
      companyId,
      name: text(body?.name, "o nome do relatório", 200),
      type: text(body?.type, "o tipo do relatório", 100),
      filters: asJson(body?.filters),
      generatedById: profile.id,
      generatedByName: profile.name,
      format,
      fileName: optionalText(body?.fileName, 255),
      mimeType: optionalText(body?.mimeType, 150),
      objectKey: optionalText(body?.objectKey, 500),
      fileSizeBytes: typeof body?.fileSizeBytes === "number" ? BigInt(Math.round(body.fileSizeBytes)) : null,
      templateId: template?.id,
      templateName: template?.name,
      recipientId: recipient?.id,
      recipientName: recipient?.name,
      recipientRole: recipient?.role,
    },
  });
  if (report.recipientId) {
    await getDatabaseClient().$transaction(async (transaction) => {
      await writeNotification(transaction, {
        companyId: company.id,
        userId: report.recipientId,
        title: "Novo relatório disponível",
        message: `${report.name} foi compartilhado com você.`,
        type: "INFO",
      });
    });
  }
  return mapReport(report);
}

export async function deleteReport(profile: ReportAccessProfile, reportId: string) {
  const report = await getDatabaseClient().report.findFirst({ where: { id: uuid(reportId, "o relatório") } });
  if (!report) throw new ReportApiError("Relatório não encontrado.", 404);
  await requireCompany(profile, report.companyId, "reports.generate");
  await getDatabaseClient().report.delete({ where: { id: report.id } });
}

export async function listReportTemplates(profile: ReportAccessProfile) {
  const database = getDatabaseClient();
  const companies = await database.company.findMany({
    where: profile.isPlatformAdmin
      ? { deletedAt: null }
      : {
          deletedAt: null,
          OR: [
            { tenantId: { in: administratorTenantIds(profile) } },
            { id: { in: companyIdsWithPermission(profile, "reports.view") } },
          ],
        },
    select: { id: true, tenantId: true },
  });
  const bpoCompanyIds = companies.filter((company) => isBpoForCompany(profile, company)).map(({ id }) => id);
  const personalCompanyIds = companies.filter((company) => !isBpoForCompany(profile, company)).map(({ id }) => id);
  const templates = await database.reportTemplate.findMany({
    where: {
      OR: [
        { companyId: { in: bpoCompanyIds } },
        { companyId: { in: personalCompanyIds }, createdById: profile.id },
      ],
    },
    orderBy: [{ favorite: "desc" }, { updatedAt: "desc" }],
  });
  return templates.map(mapTemplate);
}

export async function createReportTemplate(profile: ReportAccessProfile, body: any) {
  const companyId = uuid(body?.companyId, "a empresa");
  await requireCompany(profile, companyId, "reports.generate");
  const modelType = MODEL_TYPE_TO_DATABASE[body?.modelType as keyof typeof MODEL_TYPE_TO_DATABASE];
  if (!modelType) throw new ReportApiError("Tipo de modelo inválido.");

  const template = await getDatabaseClient().reportTemplate.create({
    data: {
      companyId,
      name: text(body?.name, "o nome do modelo", 200),
      modelType,
      blocks: asJson(body?.blocks ?? []),
      filters: asJson(body?.filters ?? {}),
      dreOptions: body?.dreOptions ? asJson(body.dreOptions) : undefined,
      notes: optionalText(body?.notes, 2000),
      orientation: optionalText(body?.orientation, 20),
      createdById: profile.id,
      createdByName: profile.name,
    },
  });
  return mapTemplate(template);
}

async function requireTemplate(profile: ReportAccessProfile, templateId: string) {
  const template = await getDatabaseClient().reportTemplate.findFirst({
    where: { id: uuid(templateId, "o modelo") },
    include: { company: { select: { id: true, tenantId: true, deletedAt: true } } },
  });
  if (!template || template.company.deletedAt) throw new ReportApiError("Modelo não encontrado.", 404);
  await requireCompany(profile, template.companyId, "reports.generate");
  return template;
}

export async function updateReportTemplate(profile: ReportAccessProfile, templateId: string, body: any) {
  const existing = await requireTemplate(profile, templateId);
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = text(body.name, "o nome do modelo", 200);
  if (body.favorite !== undefined) {
    if (typeof body.favorite !== "boolean") throw new ReportApiError("Valor de favorito inválido.");
    data.favorite = body.favorite;
  }
  if (body.archived !== undefined) {
    if (typeof body.archived !== "boolean") throw new ReportApiError("Valor de arquivado inválido.");
    data.archived = body.archived;
  }
  if (body.notes !== undefined) data.notes = optionalText(body.notes, 2000);
  if (body.blocks !== undefined) data.blocks = asJson(body.blocks);
  if (body.filters !== undefined) data.filters = asJson(body.filters);
  if (body.dreOptions !== undefined) data.dreOptions = body.dreOptions ? asJson(body.dreOptions) : Prisma.JsonNull;

  const updated = await getDatabaseClient().reportTemplate.update({ where: { id: existing.id }, data });
  return mapTemplate(updated);
}

export async function duplicateReportTemplate(profile: ReportAccessProfile, templateId: string) {
  const existing = await requireTemplate(profile, templateId);
  const duplicate = await getDatabaseClient().reportTemplate.create({
    data: {
      companyId: existing.companyId,
      name: `${existing.name} (cópia)`,
      modelType: existing.modelType,
      blocks: existing.blocks as Prisma.InputJsonValue,
      filters: existing.filters as Prisma.InputJsonValue,
      dreOptions: existing.dreOptions as Prisma.InputJsonValue | undefined,
      notes: existing.notes,
      orientation: existing.orientation,
      createdById: profile.id,
      createdByName: profile.name,
    },
  });
  return mapTemplate(duplicate);
}

export async function deleteReportTemplate(profile: ReportAccessProfile, templateId: string) {
  const existing = await requireTemplate(profile, templateId);
  await getDatabaseClient().reportTemplate.delete({ where: { id: existing.id } });
}
