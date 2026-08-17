import assert from "node:assert/strict";
import test from "node:test";
import {
  brazilianDateToIso,
  buildImportTemplateWorkbookBase64,
  parseImportRows,
  toImportPayload,
  validateImportRow,
  type TemplateMasterData,
} from "./financialEntriesImport";

const reference: TemplateMasterData = {
  categories: ["Aluguel"],
  costCenters: ["Administrativo"],
  paymentMethods: ["Pix"],
  bankAccounts: [],
};

const header = Array.from({ length: 16 }, (_, index) => `Coluna ${index + 1}`);

function validRow(issueDate: unknown = "01-08-2026", dueDate: unknown = "10-08-2026") {
  return [
    "A Pagar",
    "Aluguel da sede",
    "Imobiliária Central",
    "Aluguel",
    "Administrativo",
    "2026-08",
    issueDate,
    dueDate,
    "3.500,50",
    "0",
    "0",
    "0",
    "Pix",
    "",
    "DOC-1",
    "Teste de importação",
  ];
}

test("aceita DD-MM-AAAA na planilha e converte as datas para o formato do banco", () => {
  const [row] = parseImportRows([header, validRow()], reference);

  assert.equal(row.errors.length, 0);
  assert.equal(row.fields.issueDate, "01-08-2026");
  assert.equal(row.fields.dueDate, "10-08-2026");
  assert.equal(row.fields.amount, 3500.5);

  const payload = toImportPayload(row);
  assert.equal(payload.issueDate, "2026-08-01");
  assert.equal(payload.dueDate, "2026-08-10");
});

test("rejeita datas no formato americano/ISO e mostra o erro no campo correto", () => {
  const [row] = parseImportRows([header, validRow("2026-08-01", "2026-08-10")], reference);

  assert.ok(row.fieldErrors.issueDate?.some((message) => message.includes("DD-MM-AAAA")));
  assert.ok(row.fieldErrors.dueDate?.some((message) => message.includes("DD-MM-AAAA")));
  assert.equal(row.errors.length, 2);
});

test("rejeita datas inexistentes e revalida a linha depois da edição", () => {
  const [row] = parseImportRows([header, validRow("31-02-2026", "10-08-2026")], reference);
  assert.ok(row.fieldErrors.issueDate?.length);

  const corrected = validateImportRow({
    ...row,
    fields: { ...row.fields, issueDate: "28-02-2026" },
  }, reference);

  assert.equal(corrected.fieldErrors.issueDate, undefined);
  assert.equal(corrected.errors.length, 0);
});

test("preserva datas reais do Excel e as apresenta como DD-MM-AAAA", () => {
  const [row] = parseImportRows([
    header,
    validRow(new Date(2026, 7, 1), new Date(2026, 7, 10)),
  ], reference);

  assert.equal(row.fields.issueDate, "01-08-2026");
  assert.equal(row.fields.dueDate, "10-08-2026");
  assert.equal(row.errors.length, 0);
});

test("gera o modelo com cabeçalhos brasileiros e células de data formatadas", async () => {
  const XLSX = await import("xlsx");
  const base64 = await buildImportTemplateWorkbookBase64(reference);
  const workbook = XLSX.read(base64, { type: "base64", cellDates: true, cellNF: true });
  const sheet = workbook.Sheets["Lançamentos"];

  assert.equal(sheet.G1.v, "Data de Emissão (DD-MM-AAAA)");
  assert.equal(sheet.H1.v, "Data de Vencimento (DD-MM-AAAA)");
  assert.equal(sheet.G2.z, "dd-mm-yyyy");
  assert.equal(sheet.H2.z, "dd-mm-yyyy");
  assert.ok(sheet.G2.v instanceof Date);
  assert.ok(sheet.H2.v instanceof Date);
});

test("conversão de data brasileira não aceita calendário inválido", () => {
  assert.equal(brazilianDateToIso("17-08-2026"), "2026-08-17");
  assert.equal(brazilianDateToIso("31-02-2026"), null);
  assert.equal(brazilianDateToIso("2026-08-17"), null);
});
