import type { BankAccount, MasterDataOption, MasterDataType } from "../types";

export class MasterDataImportError extends Error {}

export type MasterDataImportKind = MasterDataType | "BANK";

export interface ParsedMasterDataRow {
  row: number;
  kind: MasterDataImportKind | null;
  name: string;
  parentCategory: string;
  agency: string;
  accountNumber: string;
  bankType: BankAccount["type"] | null;
  initialBalance: number;
  errors: string[];
  warnings: string[];
  skip: boolean;
}

export interface MasterDataImportReference {
  masterData: MasterDataOption[];
  bankAccounts: BankAccount[];
  companyId: string;
}

const HEADER_ROW = [
  "Tipo de Cadastro",
  "Nome",
  "Categoria Principal",
  "Agência",
  "Número da Conta",
  "Tipo de Conta",
  "Saldo Inicial",
];

const EXAMPLE_ROWS: (string | number)[][] = [
  ["Categoria", "Serviços (EXEMPLO - apague esta linha)", "", "", "", "", ""],
  ["Subcategoria", "Software (EXEMPLO - apague esta linha)", "Serviços (EXEMPLO - apague esta linha)", "", "", "", ""],
  ["Centro de Custo", "Administrativo (EXEMPLO - apague esta linha)", "", "", "", "", ""],
  ["Forma de Pagamento", "Pix (EXEMPLO - apague esta linha)", "", "", "", "", ""],
  ["Tipo de Documento", "Nota Fiscal (EXEMPLO - apague esta linha)", "", "", "", "", ""],
  ["Fornecedor", "Fornecedor Modelo (EXEMPLO - apague esta linha)", "", "", "", "", ""],
  ["Cliente", "Cliente Modelo (EXEMPLO - apague esta linha)", "", "", "", "", ""],
  ["Caixa (Padaria)", "Caixa 1 (EXEMPLO - apague esta linha)", "", "", "", "", ""],
  ["Conta Bancária", "Banco Modelo (EXEMPLO - apague esta linha)", "", "0001", "12345-6", "Corrente", 0],
];

const INSTRUCTIONS_ROWS: (string | number)[][] = [
  ["MODELO DE IMPORTAÇÃO DE CADASTROS - IDEX FINANCE"],
  ["Preencha uma linha por cadastro na aba \"Cadastros\"."],
  ["Apague todas as linhas de exemplo antes de enviar o arquivo."],
  [],
  ["Tipo de Cadastro", "Campos obrigatórios", "Observações"],
  ["Categoria", "Nome", "Usada nos lançamentos financeiros."],
  ["Subcategoria", "Nome e Categoria Principal", "A categoria principal deve existir ou estar em outra linha da mesma planilha."],
  ["Centro de Custo", "Nome", "Usado nos lançamentos financeiros."],
  ["Forma de Pagamento", "Nome", "Usada nos lançamentos financeiros."],
  ["Tipo de Documento", "Nome", "Ex.: Nota Fiscal, Boleto, Recibo."],
  ["Fornecedor", "Nome", "Obrigatório para importar contas a pagar."],
  ["Cliente", "Nome", "Obrigatório para importar contas a receber."],
  ["Caixa (Padaria)", "Nome", "Cadastro utilizado pelo módulo Caixa da Padaria."],
  ["Conta Bancária", "Nome, Número da Conta e Tipo de Conta", "Agência é opcional. Tipos: Corrente, Poupança ou Investimento."],
  [],
  ["Cadastros já existentes serão ignorados; cadastros inativos serão reativados."],
  ["O limite é de 500 linhas por arquivo."],
];

const normalizeLabel = (value: string) =>
  value
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");

const normalizeName = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

const TYPE_BY_LABEL: Record<string, MasterDataImportKind> = {
  categoria: "CATEGORY",
  subcategoria: "SUBCATEGORY",
  "centro de custo": "COST_CENTER",
  "forma de pagamento": "PAYMENT_METHOD",
  "tipo de documento": "DOCUMENT_TYPE",
  fornecedor: "SUPPLIER",
  cliente: "CUSTOMER",
  "caixa (padaria)": "BAKERY_REGISTER",
  "conta bancaria": "BANK",
};

const BANK_TYPE_BY_LABEL: Record<string, BankAccount["type"]> = {
  corrente: "Corrente",
  poupanca: "Poupança",
  investimento: "Investimento",
};

const cell = (row: unknown[], index: number) => String(row[index] ?? "").trim();

function parseMoney(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return value;
  const text = String(value).trim();
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  return Number(normalized);
}

export function validateMasterDataRows(
  sourceRows: Omit<ParsedMasterDataRow, "errors" | "warnings" | "skip">[],
  reference: MasterDataImportReference,
): ParsedMasterDataRow[] {
  const activeMasterKeys = new Set(
    reference.masterData
      .filter((item) => item.companyId === reference.companyId && item.active)
      .map((item) => `${item.type}|${normalizeName(item.name)}`),
  );
  const inactiveMasterKeys = new Set(
    reference.masterData
      .filter((item) => item.companyId === reference.companyId && !item.active)
      .map((item) => `${item.type}|${normalizeName(item.name)}`),
  );
  const categoryNames = new Set(
    reference.masterData
      .filter((item) => item.companyId === reference.companyId && item.type === "CATEGORY" && item.active)
      .map((item) => normalizeName(item.name)),
  );
  sourceRows.forEach((row) => {
    if (row.kind === "CATEGORY" && row.name) categoryNames.add(normalizeName(row.name));
  });
  const activeBankKeys = new Set(
    reference.bankAccounts
      .filter((account) => account.companyId === reference.companyId)
      .map((account) => `${normalizeName(account.agency || "")}|${normalizeName(account.accountNumber)}`),
  );
  const seen = new Set<string>();

  return sourceRows.map((row) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let skip = false;
    if (!row.kind) errors.push("Tipo de cadastro inválido.");
    if (!row.name) errors.push("Nome é obrigatório.");
    if (row.name.length > 160) errors.push("Nome excede 160 caracteres.");

    if (row.kind === "SUBCATEGORY") {
      if (!row.parentCategory) errors.push("Categoria principal é obrigatória para subcategorias.");
      else if (!categoryNames.has(normalizeName(row.parentCategory))) {
        errors.push(`Categoria principal "${row.parentCategory}" não encontrada.`);
      }
    }

    let key = "";
    if (row.kind === "BANK") {
      if (!row.accountNumber) errors.push("Número da conta é obrigatório.");
      if (!row.bankType) errors.push("Tipo de conta inválido: use Corrente, Poupança ou Investimento.");
      if (!Number.isFinite(row.initialBalance)) errors.push("Saldo inicial inválido.");
      key = `BANK|${normalizeName(row.agency)}|${normalizeName(row.accountNumber)}`;
      if (row.accountNumber && activeBankKeys.has(`${normalizeName(row.agency)}|${normalizeName(row.accountNumber)}`)) {
        warnings.push("Conta bancária já cadastrada; esta linha será ignorada.");
        skip = true;
      }
    } else if (row.kind) {
      key = `${row.kind}|${normalizeName(row.name)}`;
      if (activeMasterKeys.has(key)) {
        warnings.push("Cadastro já existe e será ignorado.");
        skip = true;
      } else if (inactiveMasterKeys.has(key)) {
        warnings.push("Cadastro inativo será reativado.");
      }
    }

    if (key && seen.has(key)) errors.push("Cadastro duplicado dentro da planilha.");
    if (key) seen.add(key);
    return { ...row, errors, warnings, skip: skip && errors.length === 0 };
  });
}

export function parseMasterDataRows(
  sheetRows: unknown[][],
  reference: MasterDataImportReference,
): ParsedMasterDataRow[] {
  const dataRows = sheetRows
    .slice(1)
    .map((row, index) => ({ values: row, spreadsheetRow: index + 2 }))
    .filter(({ values }) => values.some((value) => String(value ?? "").trim()));
  if (!dataRows.length) throw new MasterDataImportError("A planilha não possui cadastros para importar.");
  if (dataRows.length > 500) throw new MasterDataImportError("Limite de 500 cadastros por importação.");
  const parsed = dataRows.map(({ values, spreadsheetRow }) => ({
    row: spreadsheetRow,
    kind: TYPE_BY_LABEL[normalizeLabel(cell(values, 0))] ?? null,
    name: cell(values, 1),
    parentCategory: cell(values, 2),
    agency: cell(values, 3),
    accountNumber: cell(values, 4),
    bankType: BANK_TYPE_BY_LABEL[normalizeLabel(cell(values, 5))] ?? null,
    initialBalance: parseMoney(values[6]),
  }));
  return validateMasterDataRows(parsed, reference);
}

export async function parseMasterDataImportFile(
  file: File,
  reference: MasterDataImportReference,
) {
  const XLSX = await import("xlsx");
  let workbook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  } catch {
    throw new MasterDataImportError("Não foi possível ler o arquivo. Envie um arquivo .xlsx válido.");
  }
  const sheet = workbook.Sheets["Cadastros"];
  if (!sheet) throw new MasterDataImportError('A planilha deve conter a aba "Cadastros".');
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  if (rows.length <= 1) throw new MasterDataImportError("A planilha não possui cadastros para importar.");
  const receivedHeaders = (rows[0] ?? []).map((value) => String(value ?? "").trim());
  if (HEADER_ROW.some((header, index) => receivedHeaders[index] !== header)) {
    throw new MasterDataImportError("O cabeçalho da aba Cadastros foi alterado. Use uma nova cópia da planilha modelo.");
  }
  return parseMasterDataRows(rows, reference);
}

export async function buildMasterDataTemplateWorkbookBase64() {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const dataSheet = XLSX.utils.aoa_to_sheet([HEADER_ROW, ...EXAMPLE_ROWS]);
  dataSheet["!cols"] = [
    { wch: 24 },
    { wch: 44 },
    { wch: 34 },
    { wch: 16 },
    { wch: 22 },
    { wch: 20 },
    { wch: 18 },
  ];
  dataSheet["!autofilter"] = { ref: `A1:G${EXAMPLE_ROWS.length + 1}` };
  if (dataSheet.G10) dataSheet.G10.z = "#,##0.00";
  XLSX.utils.book_append_sheet(workbook, dataSheet, "Cadastros");
  const instructionsSheet = XLSX.utils.aoa_to_sheet(INSTRUCTIONS_ROWS);
  instructionsSheet["!cols"] = [{ wch: 28 }, { wch: 42 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instruções");
  return XLSX.write(workbook, { type: "base64", bookType: "xlsx" }) as string;
}

function base64ToBytes(content: string) {
  const binary = window.atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function downloadMasterDataTemplate() {
  const bytes = base64ToBytes(await buildMasterDataTemplateWorkbookBase64());
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "modelo-importacao-cadastros-idex.xlsx";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
