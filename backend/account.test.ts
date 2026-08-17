import assert from "node:assert/strict";
import test from "node:test";
import { AccountApiError, validateNewPassword } from "./account";

test("aceita senha de primeiro acesso com tamanho seguro", () => {
  assert.equal(
    validateNewPassword("Abc#1234", "usuario@exemplo.com"),
    "Abc#1234",
  );
});

test("rejeita senha curta ou contendo o identificador do e-mail", () => {
  assert.throws(
    () => validateNewPassword("Ab#1234", "usuario@exemplo.com"),
    AccountApiError,
  );
  assert.throws(
    () => validateNewPassword("Minha senha usuario #2026", "usuario@exemplo.com"),
    AccountApiError,
  );
});
