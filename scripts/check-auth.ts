import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
  override: false,
  quiet: true,
});

const { disconnectDatabase, getDatabaseClient } = await import(
  "../backend/database.js"
);
const { getAuth } = await import("../backend/auth.js");
const { getAuthenticatedProfile } = await import(
  "../backend/auth-profile.js"
);
const { hashPassword } = await import("../backend/passwords.js");

const database = getDatabaseClient();
const auth = getAuth();
const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:3000";
const userId = randomUUID();
const email = `auth-check-${userId}@idex.invalid`;
const password = "Teste seguro temporário #2026";

function authRequest(pathname: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("origin", baseURL);
  headers.set("sec-fetch-site", "same-origin");
  headers.set("x-forwarded-for", "127.0.0.1");
  return new Request(`${baseURL}${pathname}`, { ...init, headers });
}

try {
  await database.user.create({
    data: {
      id: userId,
      name: "Verificação automática",
      email,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      authAccounts: {
        create: {
          accountId: userId,
          providerId: "credential",
          password: await hashPassword(password),
        },
      },
    },
  });

  const signInResponse = await auth.handler(
    authRequest("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  const signInBody = await signInResponse.text();
  assert.equal(signInResponse.status, 200, signInBody);

  const setCookie = signInResponse.headers.get("set-cookie") || "";
  const sessionCookie = setCookie.match(/(?:^|,\s*)(idex\.session_token=[^;]+)/)?.[1];
  assert.ok(sessionCookie, "Cookie HttpOnly de sessão não foi emitido.");

  const sessionResponse = await auth.handler(
    authRequest("/api/auth/get-session", {
      headers: { cookie: sessionCookie },
    }),
  );
  const session = (await sessionResponse.json()) as {
    user?: { id?: string; email?: string };
  };
  assert.equal(sessionResponse.status, 200);
  assert.equal(session.user?.id, userId);
  assert.equal(session.user?.email, email);

  const profile = await getAuthenticatedProfile(userId);
  assert.equal(profile?.id, userId);
  assert.equal(profile?.email, email);
  assert.equal(profile?.mustChangePassword, true);
  assert.deepEqual(profile?.companyMemberships, []);

  const signOutResponse = await auth.handler(
    authRequest("/api/auth/sign-out", {
      method: "POST",
      headers: {
        cookie: sessionCookie,
        "content-type": "application/json",
      },
      body: "{}",
    }),
  );
  assert.equal(signOutResponse.status, 200);
  assert.equal(await database.userSession.count({ where: { userId } }), 0);

  console.log("Autenticação validada: login, cookie de sessão e logout.");
} finally {
  await database.user.deleteMany({ where: { id: userId } });
  await disconnectDatabase();
}
