import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "./passwords.js";

test("protege senhas com Argon2id e salt exclusivo", async () => {
  const password = "Senha local forte #2026";
  const firstHash = await hashPassword(password);
  const secondHash = await hashPassword(password);

  assert.match(firstHash, /^\$argon2id\$/);
  assert.notEqual(firstHash, secondHash);
  assert.equal(await verifyPassword(firstHash, password), true);
  assert.equal(await verifyPassword(firstHash, "senha incorreta"), false);
});

test("rejeita hashes inválidos sem expor erro interno", async () => {
  assert.equal(await verifyPassword("não-é-um-hash", "senha"), false);
});
