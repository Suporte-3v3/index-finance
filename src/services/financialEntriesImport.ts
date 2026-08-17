/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AccountPayable, AccountReceivable, BankAccount, Document, MasterDataOption } from "../types";
import { brazilianDateToIso as parseBrazilianDateToIso, brazilianMonthToIso } from "./dateFormatters";

export class FinancialEntriesImportError extends Error {}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let message = "Não foi possível importar os lançamentos.";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Mantém uma mensagem segura quando a resposta não é JSON.
    }
    throw new FinancialEntriesImportError(message);
  }
  return (await response.json()) as T;
}

const HEADER_ROW: (string | number)[] = [
  "Tipo",
  "Descrição",
  "Fornecedor/Cliente",
  "Categoria",
  "Centro de Custo",
  "Competência (MM-AAAA)",
  "Data de Emissão (DD-MM-AAAA)",
  "Data de Vencimento (DD-MM-AAAA)",
  "Valor",
  "Juros",
  "Multa",
  "Desconto",
  "Forma de Pagamento",
  "Conta Bancária",
  "Nº Documento",
  "Observações",
];

const EXAMPLE_ROWS: (string | number | Date)[][] = [
  [
    "A Pagar",
    "Aluguel da sede (EXEMPLO - apague esta linha)",
    "Imobiliária Central",
    "Aluguel",
    "Administrativo",
    "08-2026",
    new Date(2026, 7, 1),
    new Date(2026, 7, 10),
    3500,
    0,
    0,
    0,
    "Transferência (TED/DOC)",
    "",
    "",
    "",
  ],
  [
    "A Receber",
    "Venda de serviços (EXEMPLO - apague esta linha)",
    "Cliente Modelo Ltda",
    "Serviços prestados",
    "Comercial",
    "08-2026",
    new Date(2026, 7, 2),
    new Date(2026, 7, 20),
    1200,
    0,
    0,
    0,
    "Pix",
    "",
    "",
    "",
  ],
];

const INSTRUCTIONS_ROWS: (string | number)[][] = [
  ["MODELO DE IMPORTAÇÃO DE LANÇAMENTOS - IDEX FINANCE"],
  ["Preencha uma linha por lançamento na aba \"Lançamentos\" e envie o arquivo de volta no sistema."],
  [],
  ["Coluna", "Obrigatório", "Formato / observações"],
  ["Tipo", "Sim", "\"A Pagar\" ou \"A Receber\" (exatamente assim)"],
  ["Descrição", "Sim", "Texto livre, até 500 caracteres"],
  ["Fornecedor/Cliente", "Sim", "Nome do fornecedor (contas a pagar) ou cliente (contas a receber)"],
  ["Categoria", "Sim", "Veja a aba \"Valores Válidos\" para os nomes já cadastrados"],
  ["Centro de Custo", "Sim", "Veja a aba \"Valores Válidos\""],
  ["Competência (MM-AAAA)", "Sim", "Ex.: 08-2026"],
  ["Data de Emissão (DD-MM-AAAA)", "Sim", "Ex.: 01-08-2026"],
  ["Data de Vencimento (DD-MM-AAAA)", "Sim", "Ex.: 10-08-2026"],
  ["Valor", "Sim", "Número maior que zero. Use ponto ou vírgula para decimais (ex.: 1500.50)"],
  ["Juros", "Não", "Número. Deixe em branco ou 0 se não houver"],
  ["Multa", "Não", "Número. Deixe em branco ou 0 se não houver"],
  ["Desconto", "Não", "Número. Deixe em branco ou 0 se não houver"],
  ["Forma de Pagamento", "Sim", "Veja a aba \"Valores Válidos\""],
  ["Conta Bancária", "Não", "Copie exatamente o nome da aba \"Valores Válidos\". Deixe em branco se ainda não souber"],
  ["Nº Documento", "Não", "Número da nota fiscal/boleto, se houver"],
  ["Observações", "Não", "Texto livre"],
  [],
  ["Não altere os nomes das abas nem da linha de cabeçalho."],
  ["Apague as duas linhas de exemplo antes de enviar o arquivo."],
];

export interface TemplateMasterData {
  categories: string[];
  costCenters: string[];
  paymentMethods: string[];
  bankAccounts: BankAccount[];
}

function bankAccountLabel(account: BankAccount) {
  return `${account.bankName} - Ag ${account.agency || "-"} - CC ${account.accountNumber}`;
}

export function buildImportTemplateMasterData(
  masterData: MasterDataOption[],
  bankAccounts: BankAccount[],
  companyId: string,
): TemplateMasterData {
  const namesOf = (type: MasterDataOption["type"]) =>
    masterData
      .filter((item) => item.companyId === companyId && item.type === type && item.active)
      .map((item) => item.name)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    categories: namesOf("CATEGORY"),
    costCenters: namesOf("COST_CENTER"),
    paymentMethods: namesOf("PAYMENT_METHOD"),
    bankAccounts: bankAccounts.filter((account) => account.companyId === companyId),
  };
}

export async function buildImportTemplateWorkbookBase64(reference: TemplateMasterData) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const entriesSheet = XLSX.utils.aoa_to_sheet([HEADER_ROW, ...EXAMPLE_ROWS], {
    cellDates: true,
    dateNF: "dd-mm-yyyy",
  });
  for (const address of ["G2", "H2", "G3", "H3"]) {
    if (entriesSheet[address]) entriesSheet[address].z = "dd-mm-yyyy";
  }
  entriesSheet["!cols"] = [
    { wch: 14 },
    { wch: 42 },
    { wch: 28 },
    { wch: 24 },
    { wch: 24 },
    { wch: 22 },
    { wch: 28 },
    { wch: 31 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 28 },
    { wch: 36 },
    { wch: 20 },
    { wch: 42 },
  ];
  entriesSheet["!autofilter"] = { ref: `A1:P${EXAMPLE_ROWS.length + 1}` };

  XLSX.utils.book_append_sheet(
    workbook,
    entriesSheet,
    "Lançamentos",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(INSTRUCTIONS_ROWS),
    "Instruções",
  );

  const validValuesRows: (string | number)[][] = [
    ["VALORES JÁ CADASTRADOS PARA ESTA EMPRESA"],
    ["Copie os nomes exatamente como aparecem abaixo."],
    [],
    ["Categorias"],
    ...(reference.categories.length ? reference.categories.map((name) => [name]) : [["(nenhuma cadastrada ainda)"]]),
    [],
    ["Centros de Custo"],
    ...(reference.costCenters.length ? reference.costCenters.map((name) => [name]) : [["(nenhum cadastrado ainda)"]]),
    [],
    ["Formas de Pagamento"],
    ...(reference.paymentMethods.length ? reference.paymentMethods.map((name) => [name]) : [["(nenhuma cadastrada ainda)"]]),
    [],
    ["Contas Bancárias"],
    ...(reference.bankAccounts.length
      ? reference.bankAccounts.map((account) => [bankAccountLabel(account)])
      : [["(nenhuma cadastrada ainda)"]]),
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(validValuesRows),
    "Valores Válidos",
  );

  return XLSX.write(workbook, { type: "base64", bookType: "xlsx" }) as string;
}

function base64ToBytes(content: string) {
  const binary = window.atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function downloadImportTemplate(companyName: string, reference: TemplateMasterData) {
  const base64 = await buildImportTemplateWorkbookBase64(reference);
  const bytes = base64ToBytes(base64);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `modelo-lancamentos-${companyName.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.xlsx`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export interface ParsedImportRow {
  row: number;
  type: "PAGAR" | "RECEBER" | null;
  fields: {
    description: string;
    partyName: string;
    category: string;
    costCenter: string;
    competenceMonth: string;
    issueDate: string;
    dueDate: string;
    amount: number;
    interest: number;
    penalty: number;
    discount: number;
    paymentMethod: string;
    bankAccountId?: string;
    documentNumber?: string;
    notes?: string;
  };
  errors: string[];
  warnings: string[];
  fieldErrors: Partial<Record<ImportFieldKey, string[]>>;
  fieldWarnings: Partial<Record<ImportFieldKey, string[]>>;
}

export type ImportFieldKey = "type" | keyof ParsedImportRow["fields"];

const TYPE_LABELS: Record<string, "PAGAR" | "RECEBER"> = {
  "a pagar": "PAGAR",
  "a receber": "RECEBER",
};

function parseMoney(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return NaN;
  // Aceita tanto formato BR com vírgula decimal (1.500,50 / 1500,50) quanto ponto (1500.50).
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  return Number(normalized);
}

function cell(row: unknown[], index: number) {
  return (row[index] ?? "").toString().trim();
}

function formatDateParts(day: number, month: number, year: number) {
  return `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${String(year).padStart(4, "0")}`;
}

function normalizeDateCell(raw: unknown) {
  if (raw instanceof Date && Number.isFinite(raw.getTime())) {
    return formatDateParts(raw.getDate(), raw.getMonth() + 1, raw.getFullYear());
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(raw) * 86_400_000);
    return formatDateParts(date.getUTCDate(), date.getUTCMonth() + 1, date.getUTCFullYear());
  }
  return String(raw ?? "").trim();
}

export function brazilianDateToIso(value: string) {
  return parseBrazilianDateToIso(value);
}

function addFieldMessage(
  messages: Partial<Record<ImportFieldKey, string[]>>,
  field: ImportFieldKey,
  message: string,
) {
  messages[field] = [...(messages[field] ?? []), message];
}

export function validateImportRow(
  row: ParsedImportRow,
  reference: TemplateMasterData,
): ParsedImportRow {
  const fieldErrors: ParsedImportRow["fieldErrors"] = {};
  const fieldWarnings: ParsedImportRow["fieldWarnings"] = {};
  const categorySet = new Set(reference.categories.map((name) => name.toLocaleLowerCase("pt-BR")));
  const costCenterSet = new Set(reference.costCenters.map((name) => name.toLocaleLowerCase("pt-BR")));
  const paymentMethodSet = new Set(reference.paymentMethods.map((name) => name.toLocaleLowerCase("pt-BR")));
  const bankAccountIds = new Set(reference.bankAccounts.map((account) => account.id));

  if (!row.type) addFieldMessage(fieldErrors, "type", 'Tipo inválido: use "A Pagar" ou "A Receber".');
  if (!row.fields.description) addFieldMessage(fieldErrors, "description", "Descrição é obrigatória.");
  if (!row.fields.partyName) {
    addFieldMessage(
      fieldErrors,
      "partyName",
      row.type === "RECEBER" ? "Cliente é obrigatório." : "Fornecedor é obrigatório.",
    );
  }

  if (!row.fields.category) addFieldMessage(fieldErrors, "category", "Categoria é obrigatória.");
  else if (categorySet.size && !categorySet.has(row.fields.category.toLocaleLowerCase("pt-BR"))) {
    addFieldMessage(fieldWarnings, "category", "Categoria não encontrada nos cadastros da empresa — será criada como texto livre.");
  }

  if (!row.fields.costCenter) addFieldMessage(fieldErrors, "costCenter", "Centro de custo é obrigatório.");
  else if (costCenterSet.size && !costCenterSet.has(row.fields.costCenter.toLocaleLowerCase("pt-BR"))) {
    addFieldMessage(fieldWarnings, "costCenter", "Centro de custo não encontrado nos cadastros da empresa — será criado como texto livre.");
  }

  if (!brazilianMonthToIso(row.fields.competenceMonth)) {
    addFieldMessage(fieldErrors, "competenceMonth", "Competência inválida (use MM-AAAA).");
  }
  if (!brazilianDateToIso(row.fields.issueDate)) {
    addFieldMessage(fieldErrors, "issueDate", "Data de emissão inválida (use DD-MM-AAAA).");
  }
  if (!brazilianDateToIso(row.fields.dueDate)) {
    addFieldMessage(fieldErrors, "dueDate", "Data de vencimento inválida (use DD-MM-AAAA).");
  }

  if (!Number.isFinite(row.fields.amount) || row.fields.amount <= 0) {
    addFieldMessage(fieldErrors, "amount", "Valor inválido (deve ser maior que zero).");
  }
  if (!Number.isFinite(row.fields.interest) || row.fields.interest < 0) {
    addFieldMessage(fieldErrors, "interest", "Juros inválido.");
  }
  if (!Number.isFinite(row.fields.penalty) || row.fields.penalty < 0) {
    addFieldMessage(fieldErrors, "penalty", "Multa inválida.");
  }
  if (!Number.isFinite(row.fields.discount) || row.fields.discount < 0) {
    addFieldMessage(fieldErrors, "discount", "Desconto inválido.");
  }

  if (!row.fields.paymentMethod) addFieldMessage(fieldErrors, "paymentMethod", "Forma de pagamento é obrigatória.");
  else if (paymentMethodSet.size && !paymentMethodSet.has(row.fields.paymentMethod.toLocaleLowerCase("pt-BR"))) {
    addFieldMessage(fieldWarnings, "paymentMethod", "Forma de pagamento não encontrada nos cadastros da empresa — será criada como texto livre.");
  }

  if (row.fields.bankAccountId && !bankAccountIds.has(row.fields.bankAccountId)) {
    addFieldMessage(fieldErrors, "bankAccountId", 'Conta bancária não encontrada — selecione uma conta válida.');
  }

  return {
    ...row,
    fieldErrors,
    fieldWarnings,
    errors: Object.values(fieldErrors).flat(),
    warnings: Object.values(fieldWarnings).flat(),
  };
}

export function parseImportRows(
  sheetRows: unknown[][],
  reference: TemplateMasterData,
): ParsedImportRow[] {
  const bankAccountByLabel = new Map(
    reference.bankAccounts.map((account) => [bankAccountLabel(account).toLocaleLowerCase("pt-BR"), account.id]),
  );
  const dataRows = sheetRows.slice(1).filter((row) => row.some((value) => String(value ?? "").trim()));

  return dataRows.map((row, index) => {
    const typeLabel = cell(row, 0);
    const type = TYPE_LABELS[typeLabel.toLocaleLowerCase("pt-BR")] ?? null;

    const description = cell(row, 1);
    const partyName = cell(row, 2);
    const category = cell(row, 3);
    const costCenter = cell(row, 4);
    const competenceMonth = cell(row, 5);
    const issueDate = normalizeDateCell(row[6]);
    const dueDate = normalizeDateCell(row[7]);

    const amountRaw = cell(row, 8);
    const amount = parseMoney(amountRaw);
    const interest = cell(row, 9) ? parseMoney(cell(row, 9)) : 0;
    const penalty = cell(row, 10) ? parseMoney(cell(row, 10)) : 0;
    const discount = cell(row, 11) ? parseMoney(cell(row, 11)) : 0;

    const paymentMethod = cell(row, 12);
    const bankAccountLabelRaw = cell(row, 13);
    let bankAccountId: string | undefined;
    if (bankAccountLabelRaw) {
      bankAccountId = bankAccountByLabel.get(bankAccountLabelRaw.toLocaleLowerCase("pt-BR")) ?? bankAccountLabelRaw;
    }

    return validateImportRow({
      row: index + 2,
      type,
      fields: {
        description,
        partyName,
        category,
        costCenter,
        competenceMonth,
        issueDate,
        dueDate,
        amount,
        interest,
        penalty,
        discount,
        paymentMethod,
        bankAccountId,
        documentNumber: cell(row, 14) || undefined,
        notes: cell(row, 15) || undefined,
      },
      errors: [],
      warnings: [],
      fieldErrors: {},
      fieldWarnings: {},
    }, reference);
  });
}

export async function parseImportFile(
  file: File,
  reference: TemplateMasterData,
): Promise<ParsedImportRow[]> {
  const XLSX = await import("xlsx");
  let workbook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  } catch {
    throw new FinancialEntriesImportError("Não foi possível ler o arquivo. Envie um arquivo .xlsx válido.");
  }
  const sheetName = workbook.SheetNames.find((name) => name === "Lançamentos") ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new FinancialEntriesImportError('A planilha não contém a aba "Lançamentos".');
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | Date)[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  if (!rows.length) throw new FinancialEntriesImportError("A planilha está vazia.");
  return parseImportRows(rows, reference);
}

export type ImportEntryResult =
  | { row: number; success: true; type: "PAGAR"; payable: AccountPayable; document?: Document }
  | { row: number; success: true; type: "RECEBER"; receivable: AccountReceivable; document?: Document }
  | { row: number; success: false; error: string };

export interface ImportEntriesResult {
  total: number;
  createdCount: number;
  failedCount: number;
  results: ImportEntryResult[];
}

export function submitImportEntries(companyId: string, entries: unknown[]) {
  return request<ImportEntriesResult>("/api/financial-entries/import", {
    method: "POST",
    body: JSON.stringify({ companyId, entries }),
  });
}

export function toImportPayload(row: ParsedImportRow) {
  const isPayable = row.type === "PAGAR";
  const issueDate = brazilianDateToIso(row.fields.issueDate);
  const dueDate = brazilianDateToIso(row.fields.dueDate);
  const competenceMonth = brazilianMonthToIso(row.fields.competenceMonth);
  if (!issueDate || !dueDate || !competenceMonth) {
    throw new FinancialEntriesImportError("Corrija as datas e a competência antes de importar esta linha.");
  }
  return {
    row: row.row,
    type: row.type,
    description: row.fields.description,
    ...(isPayable ? { supplier: row.fields.partyName } : { customer: row.fields.partyName }),
    category: row.fields.category,
    costCenter: row.fields.costCenter,
    competenceMonth,
    issueDate,
    dueDate,
    amount: row.fields.amount,
    interest: row.fields.interest,
    penalty: row.fields.penalty,
    discount: row.fields.discount,
    paymentMethod: row.fields.paymentMethod,
    bankAccountId: row.fields.bankAccountId,
    documentNumber: row.fields.documentNumber,
    notes: row.fields.notes,
    recurrence: "Nenhuma",
  };
}
