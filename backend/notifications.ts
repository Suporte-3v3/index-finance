import type { Prisma } from "./generated/prisma/client.js";
import { getDatabaseClient } from "./database.js";

type Role = "BPO_ADMIN" | "BPO_TEAM" | "CLIENT" | "ACCOUNTANT";

export interface NotificationAccessProfile {
  id: string;
  isPlatformAdmin: boolean;
  tenantMemberships: Array<{ tenantId: string; role: Role }>;
  companyMemberships: Array<{ companyId: string; role: Role }>;
}

export class NotificationApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

function accessibleTenantIds(profile: NotificationAccessProfile) {
  return profile.tenantMemberships
    .filter(({ role }) => role === "BPO_ADMIN" || role === "BPO_TEAM")
    .map(({ tenantId }) => tenantId);
}

function accessibleCompanyIds(profile: NotificationAccessProfile) {
  return profile.companyMemberships.map(({ companyId }) => companyId);
}

async function accessibleCompanyIdsIncludingTenants(profile: NotificationAccessProfile) {
  if (profile.isPlatformAdmin) {
    const companies = await getDatabaseClient().company.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });
    return companies.map(({ id }) => id);
  }
  const tenantIds = accessibleTenantIds(profile);
  const companyIds = accessibleCompanyIds(profile);
  if (tenantIds.length === 0) return companyIds;
  const companiesInTenants = await getDatabaseClient().company.findMany({
    where: { tenantId: { in: tenantIds }, deletedAt: null },
    select: { id: true },
  });
  return [...new Set([...companyIds, ...companiesInTenants.map(({ id }) => id)])];
}

function mapNotification(item: any) {
  return {
    id: item.id,
    companyId: item.companyId || undefined,
    userId: item.userId || undefined,
    title: item.title,
    message: item.message,
    type: item.type,
    isRead: item.readAt != null,
    createdAt: item.createdAt.toISOString(),
    relatedLink: item.relatedLink || undefined,
  };
}

export async function listNotifications(profile: NotificationAccessProfile) {
  const companyIds = await accessibleCompanyIdsIncludingTenants(profile);
  const items = await getDatabaseClient().notification.findMany({
    where: {
      OR: [
        { userId: profile.id },
        { userId: null, companyId: { in: companyIds } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return items.map(mapNotification);
}

export async function markNotificationRead(profile: NotificationAccessProfile, notificationId: string) {
  const database = getDatabaseClient();
  const companyIds = await accessibleCompanyIdsIncludingTenants(profile);
  const existing = await database.notification.findFirst({
    where: {
      id: notificationId,
      OR: [
        { userId: profile.id },
        { userId: null, companyId: { in: companyIds } },
      ],
    },
  });
  if (!existing) throw new NotificationApiError("Notificação não encontrada.", 404);
  if (existing.readAt) return mapNotification(existing);
  const updated = await database.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
  return mapNotification(updated);
}

export async function markAllNotificationsRead(profile: NotificationAccessProfile) {
  const companyIds = await accessibleCompanyIdsIncludingTenants(profile);
  await getDatabaseClient().notification.updateMany({
    where: {
      readAt: null,
      OR: [
        { userId: profile.id },
        { userId: null, companyId: { in: companyIds } },
      ],
    },
    data: { readAt: new Date() },
  });
  return listNotifications(profile);
}

export async function writeNotification(
  transaction: Prisma.TransactionClient,
  data: {
    companyId?: string | null;
    userId?: string | null;
    title: string;
    message: string;
    type?: "INFO" | "WARNING" | "SUCCESS" | "ALERT";
    relatedLink?: string | null;
  },
) {
  await transaction.notification.create({
    data: {
      companyId: data.companyId || null,
      userId: data.userId || null,
      title: data.title,
      message: data.message,
      type: data.type || "INFO",
      relatedLink: data.relatedLink || null,
    },
  });
}
