import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTemplateWorkbookBase64,
  parseStatementRows,
  statementDateToIso,
  toStatementImportPayload,
  validateStatementRow,
} from "./reconciliationImport";

const header = ["Data", "Descrição", "Valor", "Nº Documento", "Identificador"];

function validRow(date: unknown = "01-08-2026") {
  return [date, "PIX fornecedor", "-1.500,50", "DOC-1", "extrato-1"];
}

test("aceita DD-MM-AAAA e converte a data antes do envio ao banco", () => {
  const [row] = parseStatementRows([header, validRow()]);

  assert.equal(row.errors.length, 0);
  assert.equal(row.date, "01-08-2026");
  assert.equal(row.amount, -1500.5);

  const payload = toStatementImportPayload(row);
  assert.equal(payload.date, "2026-08-01");
  assert.equal(payload.amount, -1500.5);
});

test("rejeita data americana/ISO e associa o erro ao campo data", () => {
  const [row] = parseStatementRows([header, validRow("2026-08-01")]);

  assert.ok(row.fieldErrors.date?.some((message) => message.includes("DD-MM-AAAA")));
  assert.equal(row.errors.length, 1);
});

test("rejeita data inexistente e revalida a linha depois da edição", () => {
  const [row] = parseStatementRows([header, validRow("31-02-2026")]);
  assert.ok(row.fieldErrors.date?.length);

  const corrected = validateStatementRow({ ...row, date: "28-02-2026" });
  assert.equal(corrected.fieldErrors.date, undefined);
  assert.equal(corrected.errors.length, 0);
});

test("preserva datas reais do Excel e as apresenta como DD-MM-AAAA", () => {
  const [row] = parseStatementRows([header, validRow(new Date(2026, 7, 1))]);

  assert.equal(row.date, "01-08-2026");
  assert.equal(row.errors.length, 0);
});

test("gera o modelo de extrato com cabeçalho e células de data brasileiros", async () => {
  const XLSX = await import("xlsx");
  const base64 = await buildTemplateWorkbookBase64();
  const workbook = XLSX.read(base64, { type: "base64", cellDates: true, cellNF: true });
  const sheet = workbook.Sheets.Extrato;

  assert.equal(sheet.A1.v, "Data (DD-MM-AAAA)");
  assert.equal(sheet.A2.z, "dd-mm-yyyy");
  assert.equal(sheet.A3.z, "dd-mm-yyyy");
  assert.ok(sheet.A2.v instanceof Date);
  assert.ok(sheet.A3.v instanceof Date);
});

test("conversão valida o calendário e não aceita o formato ISO na entrada", () => {
  assert.equal(statementDateToIso("17-08-2026"), "2026-08-17");
  assert.equal(statementDateToIso("31-02-2026"), null);
  assert.equal(statementDateToIso("2026-08-17"), null);
});

test("mantém linhas idênticas como lançamentos distintos quando não há identificador", () => {
  const duplicate = ["01-08-2026", "PIX fornecedor", "-150,00", "DOC-1", ""];
  const rows = parseStatementRows([header, duplicate, duplicate]);

  assert.equal(rows[0].errors.length, 0);
  assert.equal(rows[1].errors.length, 0);
  assert.notEqual(rows[0].externalId, rows[1].externalId);
});
