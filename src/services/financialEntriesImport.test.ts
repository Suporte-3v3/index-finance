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
  subCategories: [],
  costCenters: ["Administrativo"],
  paymentMethods: ["Pix"],
  suppliers: ["Imobiliária Central"],
  customers: ["Cliente Modelo Ltda"],
  bankAccounts: [],
};

const header = Array.from({ length: 17 }, (_, index) => `Coluna ${index + 1}`);

function validRow(issueDate: unknown = "01-08-2026", dueDate: unknown = "10-08-2026") {
  return [
    "A Pagar",
    "Aluguel da sede",
    "Imobiliária Central",
    "Aluguel",
    "",
    "Administrativo",
    "08-2026",
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
  assert.equal(payload.competenceMonth, "2026-08");
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

test("bloqueia referências financeiras que ainda não estão cadastradas", () => {
  const unknownReferenceRow = validRow();
  unknownReferenceRow[2] = "Fornecedor sem cadastro";
  unknownReferenceRow[3] = "Categoria sem cadastro";
  unknownReferenceRow[5] = "Centro sem cadastro";
  unknownReferenceRow[13] = "Forma sem cadastro";

  const [row] = parseImportRows([header, unknownReferenceRow], reference);

  assert.ok(row.fieldErrors.partyName?.some((message) => message.includes("não cadastrado")));
  assert.ok(row.fieldErrors.category?.some((message) => message.includes("não cadastrada")));
  assert.ok(row.fieldErrors.costCenter?.some((message) => message.includes("não cadastrado")));
  assert.ok(row.fieldErrors.paymentMethod?.some((message) => message.includes("não cadastrada")));
  assert.equal(row.warnings.length, 0);
});

test("bloqueia referências quando a empresa ainda não possui nenhum cadastro", () => {
  const [row] = parseImportRows([header, validRow()], {
    categories: [],
    subCategories: [],
    costCenters: [],
    paymentMethods: [],
    suppliers: [],
    customers: [],
    bankAccounts: [],
  });

  assert.ok(row.errors.length >= 4);
});

test("gera o modelo com cabeçalhos brasileiros e células de data formatadas", async () => {
  const XLSX = await import("xlsx");
  const base64 = await buildImportTemplateWorkbookBase64(reference);
  const workbook = XLSX.read(base64, { type: "base64", cellDates: true, cellNF: true });
  const sheet = workbook.Sheets["Lançamentos"];

  assert.equal(sheet.H1.v, "Data de Emissão (DD-MM-AAAA)");
  assert.equal(sheet.I1.v, "Data de Vencimento (DD-MM-AAAA)");
  assert.equal(sheet.G1.v, "Competência (MM-AAAA)");
  assert.equal(sheet.H2.z, "dd-mm-yyyy");
  assert.equal(sheet.I2.z, "dd-mm-yyyy");
  assert.ok(sheet.H2.v instanceof Date);
  assert.ok(sheet.I2.v instanceof Date);
});

test("conversão de data brasileira não aceita calendário inválido", () => {
  assert.equal(brazilianDateToIso("17-08-2026"), "2026-08-17");
  assert.equal(brazilianDateToIso("31-02-2026"), null);
  assert.equal(brazilianDateToIso("2026-08-17"), null);
});
