import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

const { changeOwnPassword } = await import("../backend/account.js");
const { getAuthenticatedProfile } = await import("../backend/auth-profile.js");
const { disconnectDatabase, getDatabaseClient } = await import("../backend/database.js");
const { verifyPassword } = await import("../backend/passwords.js");
const {
  createManagedUser,
  deactivateManagedUser,
  listManagedUsers,
  resetManagedUserPassword,
  updateManagedUser,
} = await import("../backend/users.js");

const database = getDatabaseClient();
const adminId = randomUUID();
const tenantId = randomUUID();
const companyId = randomUUID();
let managedUserId: string | undefined;

const adminProfile = {
  id: adminId,
  isPlatformAdmin: true,
  tenantMemberships: [{ tenantId, role: "BPO_ADMIN" as const }],
  companyMemberships: [],
};

try {
  await database.user.create({
    data: {
      id: adminId,
      name: "Admin temporário de usuários",
      email: `user-admin-check-${adminId}@idex.invalid`,
      emailVerified: true,
      passwordChangedAt: new Date(),
      isPlatformAdmin: true,
    },
  });
  await database.tenant.create({
    data: {
      id: tenantId,
      name: "Tenant temporário de usuários",
      slug: `user-check-${tenantId}`,
      memberships: {
        create: { userId: adminId, role: "BPO_ADMIN", status: "ACTIVE" },
      },
    },
  });
  await database.company.create({
    data: {
      id: companyId,
      tenantId,
      cnpj: `8${Date.now().toString().slice(-13)}`,
      corporateName: "Empresa Temporária de Usuários Ltda",
      tradeName: "Empresa Temporária de Usuários",
      bpoResponsibleId: adminId,
      status: "ACTIVE",
      clientModules: ["dashboard"],
    },
  });

  const created = await createManagedUser(adminProfile, {
    name: "Cliente temporário",
    email: `managed-check-${randomUUID()}@idex.invalid`,
    title: "Cliente",
    role: "CLIENT",
    status: "ACTIVE",
    companies: [companyId],
    permissions: ["dashboard.view", "reports.view"],
    clientOperator: false,
  });
  managedUserId = created.user.id;
  assert.equal(created.temporaryPassword.length, 20);
  assert.deepEqual(created.user.companies, [companyId]);

  const account = await database.authAccount.findFirstOrThrow({
    where: { userId: managedUserId, providerId: "credential" },
  });
  assert.ok(account.password);
  assert.equal(
    await verifyPassword(account.password!, created.temporaryPassword),
    true,
  );
  assert.equal(
    (await getAuthenticatedProfile(managedUserId))?.mustChangePassword,
    true,
  );

  const updated = await updateManagedUser(adminProfile, managedUserId, {
    title: "Cliente atualizado",
    permissions: ["dashboard.view", "reports.generate"],
  });
  assert.equal(updated.title, "Cliente atualizado");
  assert.deepEqual(updated.permissions.sort(), ["dashboard.view", "reports.generate"]);

  const reset = await resetManagedUserPassword(adminProfile, managedUserId);
  assert.notEqual(reset.temporaryPassword, created.temporaryPassword);
  const sessionId = randomUUID();
  await database.userSession.create({
    data: {
      id: sessionId,
      userId: managedUserId,
      token: `user-check-${randomUUID()}`,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  await changeOwnPassword({
    userId: managedUserId,
    currentSessionId: sessionId,
    currentPassword: reset.temporaryPassword,
    newPassword: "Nova senha exclusiva #2026",
  });
  assert.equal(
    (await getAuthenticatedProfile(managedUserId))?.mustChangePassword,
    false,
  );

  const managedUsers = await listManagedUsers(adminProfile);
  assert.equal(managedUsers.some(({ id }) => id === managedUserId), true);
  const tenantManagedUsers = await listManagedUsers({
    ...adminProfile,
    isPlatformAdmin: false,
  });
  assert.equal(
    tenantManagedUsers.some(({ id }) => id === managedUserId),
    true,
  );

  await deactivateManagedUser(adminProfile, managedUserId);
  assert.equal(
    await database.userSession.count({ where: { userId: managedUserId } }),
    0,
  );

  console.log(
    "Usuários validados: credencial, RBAC, senha temporária, troca obrigatória e desativação.",
  );
} finally {
  if (managedUserId) {
    await database.user.deleteMany({ where: { id: managedUserId } });
  }
  await database.company.deleteMany({ where: { id: companyId } });
  await database.user.deleteMany({ where: { id: adminId } });
  await database.tenant.deleteMany({ where: { id: tenantId } });
  await disconnectDatabase();
}
