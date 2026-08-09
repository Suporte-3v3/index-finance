import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReportFileBaseName,
  formatBrazilianCurrency,
  formatBrazilianDate,
  formatBrazilianPercent,
  safeReportText,
  sanitizeFileNameSegment,
} from "./reportFormatters";

test("formata datas, moeda e percentuais no padrão brasileiro", () => {
  assert.equal(formatBrazilianDate("2026-07-31"), "31/07/2026");
  assert.equal(formatBrazilianDate("2026-07"), "07/2026");
  assert.equal(formatBrazilianCurrency(1234.56), "R$ 1.234,56");
  assert.equal(formatBrazilianCurrency(-50), "-R$ 50,00");
  assert.equal(formatBrazilianPercent(12.345), "12,35%");
});

test("remove acentos, espaços e caracteres especiais do nome do arquivo", () => {
  assert.equal(sanitizeFileNameSegment("DRE Gerencial / São João"), "dre-gerencial-sao-joao");
  assert.equal(
    buildReportFileBaseName(
      "Contas a Pagar",
      "Alfa Tecnologia",
      { startDate: "2026-07-01", endDate: "2026-07-31" },
      "2026-08-06T17:30:00.000Z",
    ),
    "contas-a-pagar_alfa-tecnologia_2026-07",
  );
});

test("trata valores vazios ou inválidos sem expor valores internos", () => {
  assert.equal(safeReportText(undefined), "-");
  assert.equal(safeReportText(null), "-");
  assert.equal(safeReportText(Number.NaN), "-");
  assert.equal(safeReportText("undefined"), "-");
  assert.equal(safeReportText("Texto válido"), "Texto válido");
});

