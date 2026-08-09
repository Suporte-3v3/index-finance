import assert from "node:assert/strict";
import test from "node:test";
import { AccountApiError, validateNewPassword } from "./account";

test("aceita senha de primeiro acesso com tamanho seguro", () => {
  assert.equal(
    validateNewPassword("Senha exclusiva e longa #2026", "usuario@exemplo.com"),
    "Senha exclusiva e longa #2026",
  );
});

test("rejeita senha curta ou contendo o identificador do e-mail", () => {
  assert.throws(
    () => validateNewPassword("curta", "usuario@exemplo.com"),
    AccountApiError,
  );
  assert.throws(
    () => validateNewPassword("Minha senha usuario #2026", "usuario@exemplo.com"),
    AccountApiError,
  );
});
