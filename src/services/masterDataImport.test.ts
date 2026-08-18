import assert from "node:assert/strict";
import test from "node:test";
import type { BankAccount, MasterDataOption } from "../types";
import {
  buildMasterDataTemplateWorkbookBase64,
  MasterDataImportError,
  parseMasterDataRows,
  type MasterDataImportReference,
} from "./masterDataImport";

const reference: MasterDataImportReference = {
  companyId: "company-1",
  masterData: [{
    id: "category-1",
    companyId: "company-1",
    type: "CATEGORY",
    name: "Administrativo",
    active: true,
    createdAt: "2026-08-17T12:00:00.000Z",
  } as MasterDataOption],
  bankAccounts: [{
    id: "bank-1",
    companyId: "company-1",
    bankName: "Banco Idex",
    agency: "0001",
    accountNumber: "12345-6",
    type: "Corrente",
    balance: 0,
  } as BankAccount],
};

const header = [
  "Tipo de Cadastro",
  "Nome",
  "Categoria Principal",
  "Agência",
  "Número da Conta",
  "Tipo de Conta",
  "Saldo Inicial",
];

test("valida todos os tipos de cadastro e resolve categoria da mesma planilha", () => {
  const rows = parseMasterDataRows([
    header,
    ["Categoria", "Tecnologia", "", "", "", "", ""],
    ["Subcategoria", "Software", "Tecnologia", "", "", "", ""],
    ["Centro de Custo", "Operações", "", "", "", "", ""],
    ["Forma de Pagamento", "Pix", "", "", "", "", ""],
    ["Tipo de Documento", "Nota Fiscal", "", "", "", "", ""],
    ["Fornecedor", "Fornecedor Alfa", "", "", "", "", ""],
    ["Cliente", "Cliente Beta", "", "", "", "", ""],
    ["Caixa (Padaria)", "Caixa 1", "", "", "", "", ""],
    ["Conta Bancária", "Banco Novo", "", "0002", "76543-1", "Poupança", "1.500,25"],
  ], reference);

  assert.equal(rows.length, 9);
  assert.equal(rows.every((row) => row.errors.length === 0), true);
  assert.equal(rows.at(-1)?.initialBalance, 1500.25);
  assert.equal(rows.at(-1)?.bankType, "Poupança");
});

test("bloqueia subcategoria órfã e duplicados dentro da planilha", () => {
  const rows = parseMasterDataRows([
    header,
    ["Subcategoria", "Software", "Categoria inexistente"],
    ["Fornecedor", "Fornecedor Alfa"],
    ["Fornecedor", "Fornecedor Alfa"],
  ], reference);

  assert.ok(rows[0].errors.some((message) => message.includes("não encontrada")));
  assert.ok(rows[2].errors.some((message) => message.includes("duplicado")));
});

test("marca cadastros existentes para serem ignorados", () => {
  const rows = parseMasterDataRows([
    header,
    ["Categoria", "Administrativo"],
    ["Conta Bancária", "Banco Idex", "", "0001", "12345-6", "Corrente", 0],
  ], reference);

  assert.equal(rows[0].skip, true);
  assert.equal(rows[1].skip, true);
  assert.equal(rows.every((row) => row.errors.length === 0), true);
});

test("rejeita planilha sem nenhuma linha de cadastro", () => {
  assert.throws(
    () => parseMasterDataRows([header], reference),
    (error) => error instanceof MasterDataImportError && error.message.includes("não possui cadastros"),
  );
});

test("mantém o número real da linha mesmo quando há linhas vazias", () => {
  const rows = parseMasterDataRows([
    header,
    [],
    ["Fornecedor", "Fornecedor Alfa"],
  ], reference);

  assert.equal(rows[0].row, 3);
});

test("gera modelo único com abas de cadastros e instruções", async () => {
  const XLSX = await import("xlsx");
  const base64 = await buildMasterDataTemplateWorkbookBase64();
  const workbook = XLSX.read(base64, { type: "base64", cellNF: true });
  const sheet = workbook.Sheets.Cadastros;

  assert.deepEqual(workbook.SheetNames, ["Cadastros", "Instruções"]);
  assert.equal(sheet.A1.v, "Tipo de Cadastro");
  assert.equal(sheet.G1.v, "Saldo Inicial");
  assert.equal(sheet.A10.v, "Conta Bancária");
  assert.equal(sheet.G10.z, "#,##0.00");
});
