import { getDatabaseClient } from "./database.js";

type Role = "BPO_ADMIN" | "BPO_TEAM" | "CLIENT" | "ACCOUNTANT";

export interface AuditLogAccessProfile {
  id: string;
  isPlatformAdmin: boolean;
  tenantMemberships: Array<{ tenantId: string; role: Role }>;
  companyMemberships: Array<{ companyId: string; role: Role }>;
}

export class AuditLogApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

function adminTenantIds(profile: AuditLogAccessProfile) {
  return profile.tenantMemberships.filter(({ role }) => role === "BPO_ADMIN").map(({ tenantId }) => tenantId);
}

function isPlatformAuditor(profile: AuditLogAccessProfile) {
  return profile.isPlatformAdmin || adminTenantIds(profile).length > 0;
}

function primaryRole(user: {
  isPlatformAdmin: boolean;
  tenantMemberships: Array<{ role: Role }>;
  companyMemberships: Array<{ role: Role }>;
}): Role {
  const roles = new Set([
    ...user.tenantMemberships.map(({ role }) => role),
    ...user.companyMemberships.map(({ role }) => role),
  ]);
  if (user.isPlatformAdmin || roles.has("BPO_ADMIN")) return "BPO_ADMIN";
  if (roles.has("BPO_TEAM")) return "BPO_TEAM";
  if (roles.has("ACCOUNTANT")) return "ACCOUNTANT";
  return "CLIENT";
}

function mapAuditLog(item: any) {
  return {
    id: item.id,
    tenantId: item.tenantId,
    companyId: item.companyId || undefined,
    companyName: item.company ? item.company.tradeName || item.company.corporateName : undefined,
    userId: item.userId || "",
    userName: item.user ? item.user.name : "Sistema",
    role: item.user ? primaryRole(item.user) : "BPO_ADMIN",
    action: item.action,
    entityType: item.entityType,
    entityId: item.entityId || "",
    previousData: item.previousData == null ? undefined : JSON.stringify(item.previousData),
    nextData: item.nextData == null ? undefined : JSON.stringify(item.nextData),
    timestamp: item.createdAt.toISOString(),
    ipAddress: item.ipAddress || "",
    userAgent: item.userAgent || "",
    origin: item.origin,
  };
}

export async function listAuditLogs(profile: AuditLogAccessProfile) {
  if (!isPlatformAuditor(profile)) {
    throw new AuditLogApiError("Sem permissão para consultar a auditoria.", 403);
  }
  const database = getDatabaseClient();
  const tenantIds = profile.isPlatformAdmin
    ? (await database.tenant.findMany({ select: { id: true } })).map(({ id }) => id)
    : adminTenantIds(profile);

  const items = await database.auditLog.findMany({
    where: { tenantId: { in: tenantIds } },
    include: {
      company: { select: { tradeName: true, corporateName: true } },
      user: {
        select: {
          name: true,
          isPlatformAdmin: true,
          tenantMemberships: { select: { role: true } },
          companyMemberships: { select: { role: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  return items.map(mapAuditLog);
}
