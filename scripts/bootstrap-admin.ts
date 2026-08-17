import path from "node:path";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { getDatabaseClient, disconnectDatabase } from "../backend/database.js";
import { hashPassword } from "../backend/passwords.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
  override: false,
  quiet: true,
});

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.ADMIN_NAME?.trim();
const password = process.env.ADMIN_PASSWORD || "";
const tenantName = process.env.ADMIN_TENANT_NAME?.trim() || "Idex Finance";
const tenantSlug = process.env.ADMIN_TENANT_SLUG?.trim() || "idex-finance";

if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
  throw new Error("Defina ADMIN_EMAIL com um endereço válido.");
}
if (!name || name.length < 3) {
  throw new Error("Defina ADMIN_NAME com pelo menos 3 caracteres.");
}
if (password.length < 8 || password.length > 128) {
  throw new Error("ADMIN_PASSWORD deve ter entre 8 e 128 caracteres.");
}
if (password.toLowerCase().includes(email.split("@")[0])) {
  throw new Error("ADMIN_PASSWORD não pode conter o identificador do e-mail.");
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenantSlug)) {
  throw new Error("ADMIN_TENANT_SLUG deve usar letras minúsculas, números e hífens.");
}

const database = getDatabaseClient();

try {
  const existing = await database.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error(
      "Já existe um usuário com esse e-mail; o bootstrap não altera contas existentes.",
    );
  }

  const passwordHash = await hashPassword(password);
  const userId = randomUUID();
  const result = await database.$transaction(async (transaction) => {
    const tenant = await transaction.tenant.upsert({
      where: { slug: tenantSlug },
      create: { name: tenantName, slug: tenantSlug },
      update: {},
    });
    const user = await transaction.user.create({
      data: {
        id: userId,
        email,
        name,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        passwordChangedAt: new Date(),
        isPlatformAdmin: true,
        authAccounts: {
          create: {
            accountId: userId,
            providerId: "credential",
            password: passwordHash,
          },
        },
        tenantMemberships: {
          create: {
            tenantId: tenant.id,
            role: "BPO_ADMIN",
            status: "ACTIVE",
          },
        },
      },
      select: { id: true, email: true },
    });
    return user;
  });

  console.log(`Administrador criado com segurança: ${result.email}`);
} finally {
  await disconnectDatabase();
}
