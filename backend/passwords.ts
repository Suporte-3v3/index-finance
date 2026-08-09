import { hash, verify } from "@node-rs/argon2";

const ARGON2_OPTIONS = {
  // @node-rs/argon2 declares Algorithm as an ambient const enum, which cannot
  // be imported with this project's isolatedModules setting. Value 2 is Argon2id.
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
