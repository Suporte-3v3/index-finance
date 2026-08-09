import { getDatabaseClient } from "./database.js";
import { hashPassword, verifyPassword } from "./passwords.js";

export class AccountApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export function validateNewPassword(password: unknown, email: string) {
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    throw new AccountApiError("A nova senha deve ter entre 12 e 128 caracteres.");
  }
  const emailIdentifier = email.split("@")[0]?.toLowerCase();
  if (emailIdentifier && password.toLowerCase().includes(emailIdentifier)) {
    throw new AccountApiError("A nova senha não pode conter o identificador do e-mail.");
  }
  return password;
}

export async function changeOwnPassword(input: {
  userId: string;
  currentSessionId: string;
  currentPassword: unknown;
  newPassword: unknown;
}) {
  const database = getDatabaseClient();
  const user = await database.user.findUnique({
    where: { id: input.userId },
    select: {
      email: true,
      authAccounts: {
        where: { providerId: "credential" },
        select: { id: true, password: true },
        take: 1,
      },
    },
  });
  const account = user?.authAccounts[0];
  if (!user || !account?.password) {
    throw new AccountApiError("Credencial não encontrada.", 404);
  }
  if (
    typeof input.currentPassword !== "string" ||
    !(await verifyPassword(account.password, input.currentPassword))
  ) {
    throw new AccountApiError("A senha temporária está incorreta.", 401);
  }
  const newPassword = validateNewPassword(input.newPassword, user.email);
  if (await verifyPassword(account.password, newPassword)) {
    throw new AccountApiError("A nova senha deve ser diferente da senha atual.");
  }
  const passwordHash = await hashPassword(newPassword);

  await database.$transaction([
    database.authAccount.update({
      where: { id: account.id },
      data: { password: passwordHash, updatedAt: new Date() },
    }),
    database.user.update({
      where: { id: input.userId },
      data: { passwordChangedAt: new Date() },
    }),
    database.userSession.deleteMany({
      where: {
        userId: input.userId,
        id: { not: input.currentSessionId },
      },
    }),
  ]);
}
