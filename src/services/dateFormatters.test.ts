import assert from "node:assert/strict";
import test from "node:test";
import {
  brazilianDateToIso,
  brazilianMonthToIso,
  formatDate,
  formatDateTime,
  isoDateToBrazilian,
  isoMonthToBrazilian,
  maskBrazilianDate,
  maskBrazilianMonth,
} from "./dateFormatters";

test("padroniza datas visíveis como DD-MM-AAAA", () => {
  assert.equal(formatDate("2026-08-17"), "17-08-2026");
  assert.equal(formatDate("17/08/2026"), "17-08-2026");
  assert.equal(formatDate("2026-08"), "08-2026");
  assert.equal(isoDateToBrazilian("2026-08-17"), "17-08-2026");
});

test("padroniza data e hora sem depender do formato do navegador", () => {
  assert.equal(
    formatDateTime("2026-08-17T12:30:00.000Z", "America/Sao_Paulo"),
    "17-08-2026 09:30",
  );
});

test("converte a entrada brasileira para o ISO usado pela API", () => {
  assert.equal(brazilianDateToIso("17-08-2026"), "2026-08-17");
  assert.equal(brazilianDateToIso("31-02-2026"), null);
  assert.equal(brazilianDateToIso("2026-08-17"), null);
});

test("aplica a máscara DD-MM-AAAA durante a digitação", () => {
  assert.equal(maskBrazilianDate("1"), "1");
  assert.equal(maskBrazilianDate("1708"), "17-08");
  assert.equal(maskBrazilianDate("17082026"), "17-08-2026");
  assert.equal(maskBrazilianDate("2026-08-17"), "17-08-2026");
});

test("padroniza competências como MM-AAAA e conserva ISO internamente", () => {
  assert.equal(isoMonthToBrazilian("2026-08"), "08-2026");
  assert.equal(brazilianMonthToIso("08-2026"), "2026-08");
  assert.equal(brazilianMonthToIso("13-2026"), null);
  assert.equal(maskBrazilianMonth("082026"), "08-2026");
});
