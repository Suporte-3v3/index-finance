import { randomInt, randomUUID } from "node:crypto";
import { getDatabaseClient } from "./database.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { validateNewPassword } from "./account.js";
import type { AccessProfile } from "./companies.js";

type Role = "BPO_ADMIN" | "BPO_TEAM" | "CLIENT" | "ACCOUNTANT";

export class UserApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const ROLES = new Set<Role>(["BPO_ADMIN", "BPO_TEAM", "CLIENT", "ACCOUNTANT"]);
const ROLE_PRIORITY: Record<Role, number> = {
  CLIENT: 1,
  ACCOUNTANT: 2,
  BPO_TEAM: 3,
  BPO_ADMIN: 4,
};
const ALLOWED_PERMISSIONS = new Set([
  "operations-center.view",
  "companies.manage",
  "team.manage",
  "audit-logs.view",
  "accounts-payable.view",
  "accounts-payable.create",
  "accounts-payable.update",
  "accounts-payable.cancel",
  "accounts-receivable.view",
  "accounts-receivable.create",
  "accounts-receivable.update",
  "accounts-receivable.cancel",
  "approvals.request",
  "approvals.approve",
  "documents.upload",
  "documents.download",
  "reports.view",
  "reports.generate",
  "reconciliation.execute",
  "notifications.manage",
  "dashboard.view",
]);
const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

function temporaryPassword() {
  return Array.from(
    { length: 20 },
    () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)],
  ).join("");
}

function text(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new UserApiError(`Informe ${field}.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new UserApiError(`${field} muito longo.`);
  return normalized;
}

function optionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new UserApiError("Campo inválido.");
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new UserApiError("Campo muito longo.");
  return normalized || null;
}

function email(value: unknown) {
  const normalized = text(value, "o e-mail", 254).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalized)) throw new UserApiError("E-mail inválido.");
  return normalized;
}

function role(value: unknown): Role {
  if (typeof value !== "string" || !ROLES.has(value as Role)) {
    throw new UserApiError("Perfil de acesso inválido.");
  }
  return value as Role;
}

function permissions(value: unknown) {
  if (!Array.isArray(value)) return [];
  const normalized = [
    ...new Set(value.filter((item): item is string => typeof item === "string")),
  ];
  if (normalized.some((item) => !ALLOWED_PERMISSIONS.has(item))) {
    throw new UserApiError("A lista de permissões contém um valor inválido.");
  }
  return normalized;
}

function companyIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string"))];
}

function managedTenantIds(profile: AccessProfile) {
  return profile.tenantMemberships
    .filter(({ role }) => role === "BPO_ADMIN")
    .map(({ tenantId }) => tenantId);
}

function highestRole(roles: Role[]) {
  return roles.reduce<Role>(
    (highest, current) =>
      ROLE_PRIORITY[current] > ROLE_PRIORITY[highest] ? current : highest,
    "CLIENT",
  );
}

async function resolveCompaniesForWrite(
  profile: AccessProfile,
  requestedIds: string[],
  requestedRole: Role,
) {
  const database = getDatabaseClient();
  const companies = await database.company.findMany({
    where: { id: { in: requestedIds }, deletedAt: null },
    select: { id: true, tenantId: true },
  });
  if (companies.length !== requestedIds.length) {
    throw new UserApiError("Uma das empresas selecionadas não existe.");
  }
  const tenantIds = [...new Set(companies.map(({ tenantId }) => tenantId))];
  let tenantId = tenantIds[0];
  if (!tenantId && requestedRole === "BPO_ADMIN") {
    tenantId = managedTenantIds(profile)[0];
  }
  if (!tenantId || tenantIds.length > 1) {
    throw new UserApiError("Selecione empresas de um único tenant.");
  }
  if (!profile.isPlatformAdmin && !managedTenantIds(profile).includes(tenantId)) {
    throw new UserApiError("Sem permissão para administrar este tenant.", 403);
  }
  if (requestedRole !== "BPO_ADMIN" && requestedIds.length === 0) {
    throw new UserApiError("Selecione pelo menos uma empresa.");
  }
  if (requestedRole === "CLIENT" && requestedIds.length !== 1) {
    throw new UserApiError("Usuários clientes devem acessar uma única empresa.");
  }
  return { tenantId, companies };
}

async function mapUsers(rows: any[]) {
  const tenantIds = [
    ...new Set(rows.flatMap((user) => user.tenantMemberships.map((item: any) => item.tenantId))),
  ];
  const tenantCompanies = await getDatabaseClient().company.findMany({
    where: { tenantId: { in: tenantIds }, deletedAt: null },
    select: { id: true, tenantId: true },
  });
  return rows.map((user) => {
    const roles = [
      ...user.tenantMemberships.map((item: any) => item.role as Role),
      ...user.companyMemberships.map((item: any) => item.role as Role),
    ];
    const tenantAccess = new Set(
      user.tenantMemberships
        .filter((item: any) => item.role === "BPO_ADMIN" || item.role === "BPO_TEAM")
        .map((item: any) => item.tenantId),
    );
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      title: user.title || undefined,
      role: user.isPlatformAdmin ? "BPO_ADMIN" : highestRole(roles),
      status: user.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
      companies: [
        ...new Set([
          ...user.companyMemberships.map((item: any) => item.companyId),
          ...tenantCompanies
            .filter(({ tenantId }) => tenantAccess.has(tenantId))
            .map(({ id }) => id),
        ]),
      ],
      permissions: [
        ...new Set(
          user.companyMemberships.flatMap((item: any) => item.permissions as string[]),
        ),
      ],
      clientOperator: user.companyMemberships.some(
        (item: any) => item.clientOperator,
      ),
    };
  });
}

async function userRows(profile: AccessProfile, targetUserId?: string) {
  const tenantIds = managedTenantIds(profile);
  const database = getDatabaseClient();
  const tenantCompanies = tenantIds.length
    ? await database.company.findMany({
        where: { tenantId: { in: tenantIds }, deletedAt: null },
        select: { id: true },
      })
    : [];
  const accessibleCompanyIds = [
    ...new Set([
      ...profile.companyMemberships.map(({ companyId }) => companyId),
      ...tenantCompanies.map(({ id }) => id),
    ]),
  ];
  return database.user.findMany({
    where: {
      deletedAt: null,
      ...(targetUserId ? { id: targetUserId } : {}),
      ...(profile.isPlatformAdmin
        ? {}
        : {
            OR: [
              { tenantMemberships: { some: { tenantId: { in: tenantIds } } } },
              {
                companyMemberships: {
                  some: { companyId: { in: accessibleCompanyIds } },
                },
              },
            ],
          }),
    },
    include: {
      tenantMemberships: { where: { status: { in: ["ACTIVE", "SUSPENDED"] } } },
      companyMemberships: { where: { status: { in: ["ACTIVE", "SUSPENDED"] } } },
    },
    orderBy: [{ name: "asc" }],
  });
}

export async function listManagedUsers(profile: AccessProfile) {
  if (!profile.isPlatformAdmin && managedTenantIds(profile).length === 0) {
    throw new UserApiError("Sem permissão para gerenciar usuários.", 403);
  }
  return mapUsers(await userRows(profile));
}

export async function createManagedUser(profile: AccessProfile, body: any) {
  const requestedRole = role(body?.role);
  const requestedCompanyIds = companyIds(body?.companies);
  const access = await resolveCompaniesForWrite(
    profile,
    requestedCompanyIds,
    requestedRole,
  );
  const generatedPassword = temporaryPassword();
  const passwordHash = await hashPassword(generatedPassword);
  const userId = randomUUID();

  try {
    await getDatabaseClient().$transaction(async (transaction) => {
      await transaction.user.create({
        data: {
          id: userId,
          name: text(body?.name, "o nome", 160),
          email: email(body?.email),
          title: optionalText(body?.title, 120),
          emailVerified: true,
          emailVerifiedAt: new Date(),
          passwordChangedAt: null,
          authAccounts: {
            create: {
              accountId: userId,
              providerId: "credential",
              password: passwordHash,
            },
          },
        },
      });
      if (requestedRole === "BPO_ADMIN") {
        await transaction.tenantMembership.create({
          data: {
            userId,
            tenantId: access.tenantId,
            role: "BPO_ADMIN",
            status: "ACTIVE",
          },
        });
      } else {
        const selectedPermissions = permissions(body?.permissions);
        const clientOperator = requestedRole === "CLIENT" && Boolean(body?.clientOperator);
        await transaction.companyMembership.createMany({
          data: requestedCompanyIds.map((companyId) => ({
            userId,
            companyId,
            role: requestedRole,
            status: "ACTIVE" as const,
            permissions:
              clientOperator
                ? selectedPermissions.filter((item) => item !== "approvals.approve")
                : selectedPermissions,
            clientOperator,
          })),
        });
      }
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      throw new UserApiError("Já existe um usuário com este e-mail.", 409);
    }
    throw error;
  }

  const [created] = await mapUsers(await userRows(profile, userId));
  return { user: created, temporaryPassword: generatedPassword };
}

async function getManagedTarget(profile: AccessProfile, targetUserId: string) {
  const rows = await userRows(profile, targetUserId);
  const target = rows[0];
  if (!target) throw new UserApiError("Usuário não encontrado.", 404);
  return target;
}

export async function updateManagedUser(
  profile: AccessProfile,
  targetUserId: string,
  body: any,
) {
  const target = await getManagedTarget(profile, targetUserId);
  if (target.isPlatformAdmin && !profile.isPlatformAdmin) {
    throw new UserApiError("Administradores da plataforma não podem ser alterados.", 403);
  }
  const currentMapped = (await mapUsers([target]))[0];
  const requestedRole = body.role === undefined ? currentMapped.role : role(body.role);
  const requestedCompanyIds =
    body.companies === undefined ? currentMapped.companies : companyIds(body.companies);
  const selectedPermissions =
    body.permissions === undefined
      ? (currentMapped.permissions as string[])
      : permissions(body.permissions);
  const nextStatus =
    body.status === undefined
      ? currentMapped.status
      : body.status === "ACTIVE" || body.status === "INACTIVE"
        ? body.status
        : (() => {
            throw new UserApiError("Status de usuário inválido.");
          })();

  if (targetUserId === profile.id && (requestedRole !== currentMapped.role || nextStatus !== "ACTIVE")) {
    throw new UserApiError("Você não pode remover o próprio acesso administrativo.");
  }

  let access: Awaited<ReturnType<typeof resolveCompaniesForWrite>> | undefined;
  if (!target.isPlatformAdmin) {
    access = await resolveCompaniesForWrite(
      profile,
      requestedCompanyIds,
      requestedRole,
    );
  }

  try {
    await getDatabaseClient().$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: targetUserId },
        data: {
          ...(body.name !== undefined ? { name: text(body.name, "o nome", 160) } : {}),
          ...(body.email !== undefined ? { email: email(body.email) } : {}),
          ...(body.title !== undefined ? { title: optionalText(body.title, 120) } : {}),
          status: nextStatus,
        },
      });
      if (!target.isPlatformAdmin && access) {
        await transaction.tenantMembership.deleteMany({ where: { userId: targetUserId } });
        await transaction.companyMembership.deleteMany({ where: { userId: targetUserId } });
        if (requestedRole === "BPO_ADMIN") {
          await transaction.tenantMembership.create({
            data: {
              userId: targetUserId,
              tenantId: access.tenantId,
              role: "BPO_ADMIN",
              status: nextStatus === "ACTIVE" ? "ACTIVE" : "SUSPENDED",
            },
          });
        } else {
          const clientOperator =
            requestedRole === "CLIENT" && Boolean(body.clientOperator ?? currentMapped.clientOperator);
          await transaction.companyMembership.createMany({
            data: requestedCompanyIds.map((companyId) => ({
              userId: targetUserId,
              companyId,
              role: requestedRole,
              status: nextStatus === "ACTIVE" ? ("ACTIVE" as const) : ("SUSPENDED" as const),
              permissions:
                clientOperator
                  ? selectedPermissions.filter((item) => item !== "approvals.approve")
                  : selectedPermissions,
              clientOperator,
            })),
          });
        }
      }
      if (nextStatus === "INACTIVE") {
        await transaction.userSession.deleteMany({ where: { userId: targetUserId } });
      }
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      throw new UserApiError("Já existe um usuário com este e-mail.", 409);
    }
    throw error;
  }
  const [updated] = await mapUsers(await userRows(profile, targetUserId));
  return updated;
}

export async function deactivateManagedUser(
  profile: AccessProfile,
  targetUserId: string,
) {
  if (targetUserId === profile.id) {
    throw new UserApiError("Você não pode desativar a própria conta.");
  }
  const target = await getManagedTarget(profile, targetUserId);
  if (target.isPlatformAdmin) {
    throw new UserApiError("Administradores da plataforma não podem ser desativados.", 403);
  }
  await getDatabaseClient().$transaction([
    getDatabaseClient().user.update({
      where: { id: targetUserId },
      data: { status: "INACTIVE", deletedAt: new Date() },
    }),
    getDatabaseClient().tenantMembership.updateMany({
      where: { userId: targetUserId },
      data: { status: "REVOKED" },
    }),
    getDatabaseClient().companyMembership.updateMany({
      where: { userId: targetUserId },
      data: { status: "REVOKED" },
    }),
    getDatabaseClient().userSession.deleteMany({ where: { userId: targetUserId } }),
  ]);
}

export async function resetManagedUserPassword(
  profile: AccessProfile,
  targetUserId: string,
) {
  await getManagedTarget(profile, targetUserId);
  if (targetUserId === profile.id) {
    throw new UserApiError("Use a alteração de senha da própria conta.");
  }
  const generatedPassword = temporaryPassword();
  const passwordHash = await hashPassword(generatedPassword);
  const database = getDatabaseClient();
  const account = await database.authAccount.findFirst({
    where: { userId: targetUserId, providerId: "credential" },
    select: { id: true },
  });
  if (!account) throw new UserApiError("Credencial não encontrada.", 404);
  await database.$transaction([
    database.authAccount.update({
      where: { id: account.id },
      data: { password: passwordHash },
    }),
    database.user.update({
      where: { id: targetUserId },
      data: { passwordChangedAt: null },
    }),
    database.userSession.deleteMany({ where: { userId: targetUserId } }),
  ]);
  return { temporaryPassword: generatedPassword };
}

export async function setManagedUserPassword(
  profile: AccessProfile,
  targetUserId: string,
  newPassword: unknown,
) {
  const target = await getManagedTarget(profile, targetUserId);
  if (targetUserId === profile.id) {
    throw new UserApiError("Use a alteração de senha da própria conta.");
  }
  const database = getDatabaseClient();
  const account = await database.authAccount.findFirst({
    where: { userId: targetUserId, providerId: "credential" },
    select: { id: true, password: true },
  });
  if (!account) throw new UserApiError("Credencial não encontrada.", 404);

  let validated: string;
  try {
    validated = validateNewPassword(newPassword, target.email);
  } catch (error) {
    throw new UserApiError(
      error instanceof Error ? error.message : "Senha inválida.",
    );
  }
  if (account.password && (await verifyPassword(account.password, validated))) {
    throw new UserApiError("A nova senha deve ser diferente da senha atual.");
  }
  const passwordHash = await hashPassword(validated);
  await database.$transaction([
    database.authAccount.update({
      where: { id: account.id },
      data: { password: passwordHash },
    }),
    database.user.update({
      where: { id: targetUserId },
      data: { passwordChangedAt: new Date() },
    }),
    database.userSession.deleteMany({ where: { userId: targetUserId } }),
  ]);
}
