import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { getDatabaseClient } from "./database.js";
import { hashPassword, verifyPassword } from "./passwords.js";

const LOCAL_AUTH_SECRET =
  "idex-local-auth-secret-only-for-development-change-in-production";

function getTrustedOrigins(baseURL: string): string[] {
  const configured = (process.env.BETTER_AUTH_TRUSTED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([baseURL, ...configured])];
}

export function getAuth() {
  const production =
    process.env.NODE_ENV === "production" || process.argv.includes("--production");
  const baseURL =
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "http://localhost:3000";
  const secret = process.env.BETTER_AUTH_SECRET?.trim() || LOCAL_AUTH_SECRET;

  if (production && secret === LOCAL_AUTH_SECRET) {
    throw new Error(
      "BETTER_AUTH_SECRET é obrigatória e deve ser exclusiva em produção.",
    );
  }

  const database = getDatabaseClient();

  return betterAuth({
    appName: "Idex Finance",
    baseURL,
    basePath: "/api/auth",
    secret,
    trustedOrigins: getTrustedOrigins(baseURL),
    database: prismaAdapter(database, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      password: {
        hash: hashPassword,
        verify: ({ hash: storedHash, password }) =>
          verifyPassword(storedHash, password),
      },
    },
    user: {
      modelName: "user",
    },
    session: {
      modelName: "userSession",
      expiresIn: 60 * 60 * 12,
      updateAge: 60 * 60,
      cookieCache: { enabled: false },
    },
    account: {
      modelName: "authAccount",
      encryptOAuthTokens: true,
    },
    verification: {
      modelName: "verification",
      storeIdentifier: "hashed",
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "authRateLimit",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const user = await database.user.findUnique({
              where: { id: session.userId },
              select: { status: true, deletedAt: true },
            });
            return user?.status === "ACTIVE" && !user.deletedAt
              ? { data: session }
              : false;
          },
          after: async (session) => {
            const user = await database.user.update({
              where: { id: session.userId },
              data: { lastLoginAt: new Date() },
              include: {
                tenantMemberships: { select: { tenantId: true }, take: 1 },
              },
            });
            const tenantId = user.tenantMemberships[0]?.tenantId;
            if (tenantId) {
              await database.auditLog.create({
                data: {
                  tenantId,
                  userId: user.id,
                  action: "LOGIN",
                  entityType: "User",
                  entityId: user.id,
                  ipAddress: session.ipAddress || null,
                  userAgent: session.userAgent || null,
                },
              });
            }
          },
        },
      },
    },
    advanced: {
      useSecureCookies: production,
      cookiePrefix: "idex",
      database: { generateId: "uuid" },
      defaultCookieAttributes: {
        httpOnly: true,
        secure: production,
        sameSite: "lax",
        path: "/",
      },
    },
  });

}
