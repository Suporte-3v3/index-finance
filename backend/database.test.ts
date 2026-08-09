import assert from "node:assert/strict";
import test from "node:test";
import { hasDatabaseConfiguration } from "./database.js";

test("exige DATABASE_URL para habilitar a camada PostgreSQL", () => {
  const previous = process.env.DATABASE_URL;

  delete process.env.DATABASE_URL;
  assert.equal(hasDatabaseConfiguration(), false);

  process.env.DATABASE_URL = "   ";
  assert.equal(hasDatabaseConfiguration(), false);

  process.env.DATABASE_URL =
    "postgresql://idex_app:secret@localhost:5432/idex_finance";
  assert.equal(hasDatabaseConfiguration(), true);

  if (previous === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previous;
});
