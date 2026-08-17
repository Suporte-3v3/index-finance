import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

const { changeOwnPassword } = await import("../backend/account.js");
const { getAuth } = await import("../backend/auth.js");
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
const auth = getAuth();
const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:3000";
const adminId = randomUUID();
const tenantId = randomUUID();
const companyId = randomUUID();
let managedUserId: string | undefined;
const previousPassword = "Senha anterior segura #2026";
const chosenPassword = "Nova senha exclusiva #2026";
const testIp = `10.${parseInt(adminId.slice(0, 2), 16)}.${parseInt(adminId.slice(2, 4), 16)}.${parseInt(adminId.slice(4, 6), 16)}`;

function authRequest(pathname: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("origin", baseURL);
  headers.set("sec-fetch-site", "same-origin");
  headers.set("x-forwarded-for", testIp);
  return new Request(`${baseURL}${pathname}`, { ...init, headers });
}

async function signIn(email: string, password: string) {
  return auth.handler(
    authRequest("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
}

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

  const setupSessionId = randomUUID();
  await database.userSession.create({
    data: {
      id: setupSessionId,
      userId: managedUserId,
      token: `user-check-${randomUUID()}`,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  await changeOwnPassword({
    userId: managedUserId,
    currentSessionId: setupSessionId,
    currentPassword: created.temporaryPassword,
    newPassword: previousPassword,
  });
  assert.equal(
    (await getAuthenticatedProfile(managedUserId))?.mustChangePassword,
    false,
  );

  const activeLogin = await signIn(created.user.email, previousPassword);
  assert.equal(activeLogin.status, 200, await activeLogin.text());
  assert.ok(
    await database.userSession.count({ where: { userId: managedUserId } }),
    "O login anterior ao reset deve criar uma sessão ativa.",
  );

  const reset = await resetManagedUserPassword(adminProfile, managedUserId);
  assert.notEqual(reset.temporaryPassword, created.temporaryPassword);
  assert.equal(
    await database.userSession.count({ where: { userId: managedUserId } }),
    0,
    "O reset deve encerrar todas as sessões existentes.",
  );
  const resetAccount = await database.authAccount.findFirstOrThrow({
    where: { userId: managedUserId, providerId: "credential" },
  });
  assert.equal(
    await verifyPassword(resetAccount.password!, reset.temporaryPassword),
    true,
  );
  assert.equal(await verifyPassword(resetAccount.password!, previousPassword), false);
  assert.equal(
    (await getAuthenticatedProfile(managedUserId))?.mustChangePassword,
    true,
  );

  const temporaryLogin = await signIn(created.user.email, reset.temporaryPassword);
  assert.equal(temporaryLogin.status, 200, await temporaryLogin.text());
  const temporarySession = await database.userSession.findFirstOrThrow({
    where: { userId: managedUserId },
    orderBy: { createdAt: "desc" },
  });

  await changeOwnPassword({
    userId: managedUserId,
    currentSessionId: temporarySession.id,
    currentPassword: reset.temporaryPassword,
    newPassword: chosenPassword,
  });
  const changedAccount = await database.authAccount.findFirstOrThrow({
    where: { userId: managedUserId, providerId: "credential" },
  });
  assert.equal(await verifyPassword(changedAccount.password!, reset.temporaryPassword), false);
  assert.equal(await verifyPassword(changedAccount.password!, chosenPassword), true);
  assert.equal(
    (await getAuthenticatedProfile(managedUserId))?.mustChangePassword,
    false,
  );

  const obsoleteLogin = await signIn(created.user.email, reset.temporaryPassword);
  assert.equal(obsoleteLogin.status, 401, "A senha temporária deve ser invalidada após a troca.");
  const finalLogin = await signIn(created.user.email, chosenPassword);
  assert.equal(finalLogin.status, 200, await finalLogin.text());

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
    "Usuários validados: reset temporário, sessões revogadas, troca obrigatória persistida e novo login.",
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
