/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AccountPayable, AccountReceivable, BankAccount, Document, MasterDataOption } from "../types";

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
  "Competência (AAAA-MM)",
  "Data de Emissão (AAAA-MM-DD)",
  "Data de Vencimento (AAAA-MM-DD)",
  "Valor",
  "Juros",
  "Multa",
  "Desconto",
  "Forma de Pagamento",
  "Conta Bancária",
  "Nº Documento",
  "Observações",
];

const EXAMPLE_ROWS: (string | number)[][] = [
  [
    "A Pagar",
    "Aluguel da sede (EXEMPLO - apague esta linha)",
    "Imobiliária Central",
    "Aluguel",
    "Administrativo",
    "2026-08",
    "2026-08-01",
    "2026-08-10",
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
    "2026-08",
    "2026-08-02",
    "2026-08-20",
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
  ["Competência (AAAA-MM)", "Sim", "Ex.: 2026-08"],
  ["Data de Emissão (AAAA-MM-DD)", "Sim", "Ex.: 2026-08-01"],
  ["Data de Vencimento (AAAA-MM-DD)", "Sim", "Ex.: 2026-08-10"],
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

async function buildImportTemplateWorkbookBase64(reference: TemplateMasterData) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([HEADER_ROW, ...EXAMPLE_ROWS]),
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
}

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

function cell(row: string[], index: number) {
  return (row[index] ?? "").toString().trim();
}

export function parseImportRows(
  sheetRows: string[][],
  reference: TemplateMasterData,
): ParsedImportRow[] {
  const bankAccountByLabel = new Map(
    reference.bankAccounts.map((account) => [bankAccountLabel(account).toLocaleLowerCase("pt-BR"), account.id]),
  );
  const categorySet = new Set(reference.categories.map((name) => name.toLocaleLowerCase("pt-BR")));
  const costCenterSet = new Set(reference.costCenters.map((name) => name.toLocaleLowerCase("pt-BR")));
  const paymentMethodSet = new Set(reference.paymentMethods.map((name) => name.toLocaleLowerCase("pt-BR")));

  const dataRows = sheetRows.slice(1).filter((row) => row.some((value) => String(value ?? "").trim()));

  return dataRows.map((row, index) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const typeLabel = cell(row, 0);
    const type = TYPE_LABELS[typeLabel.toLocaleLowerCase("pt-BR")] ?? null;
    if (!type) errors.push('Tipo inválido: use "A Pagar" ou "A Receber".');

    const description = cell(row, 1);
    if (!description) errors.push("Descrição é obrigatória.");

    const partyName = cell(row, 2);
    if (!partyName) errors.push(type === "RECEBER" ? "Cliente é obrigatório." : "Fornecedor é obrigatório.");

    const category = cell(row, 3);
    if (!category) errors.push("Categoria é obrigatória.");
    else if (categorySet.size && !categorySet.has(category.toLocaleLowerCase("pt-BR")))
      warnings.push('Categoria não encontrada nos cadastros da empresa — será criada como texto livre.');

    const costCenter = cell(row, 4);
    if (!costCenter) errors.push("Centro de custo é obrigatório.");
    else if (costCenterSet.size && !costCenterSet.has(costCenter.toLocaleLowerCase("pt-BR")))
      warnings.push('Centro de custo não encontrado nos cadastros da empresa — será criado como texto livre.');

    const competenceMonth = cell(row, 5);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competenceMonth)) errors.push("Competência inválida (use AAAA-MM).");

    const issueDate = cell(row, 6);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) errors.push("Data de emissão inválida (use AAAA-MM-DD).");

    const dueDate = cell(row, 7);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) errors.push("Data de vencimento inválida (use AAAA-MM-DD).");

    const amountRaw = cell(row, 8);
    const amount = parseMoney(amountRaw);
    if (!amountRaw || !Number.isFinite(amount) || amount <= 0) errors.push("Valor inválido (deve ser maior que zero).");

    const interest = cell(row, 9) ? parseMoney(cell(row, 9)) : 0;
    if (!Number.isFinite(interest) || interest < 0) errors.push("Juros inválido.");
    const penalty = cell(row, 10) ? parseMoney(cell(row, 10)) : 0;
    if (!Number.isFinite(penalty) || penalty < 0) errors.push("Multa inválida.");
    const discount = cell(row, 11) ? parseMoney(cell(row, 11)) : 0;
    if (!Number.isFinite(discount) || discount < 0) errors.push("Desconto inválido.");

    const paymentMethod = cell(row, 12);
    if (!paymentMethod) errors.push("Forma de pagamento é obrigatória.");
    else if (paymentMethodSet.size && !paymentMethodSet.has(paymentMethod.toLocaleLowerCase("pt-BR")))
      warnings.push("Forma de pagamento não encontrada nos cadastros da empresa — será criada como texto livre.");

    const bankAccountLabelRaw = cell(row, 13);
    let bankAccountId: string | undefined;
    if (bankAccountLabelRaw) {
      bankAccountId = bankAccountByLabel.get(bankAccountLabelRaw.toLocaleLowerCase("pt-BR"));
      if (!bankAccountId) errors.push('Conta bancária não encontrada — copie o nome exato da aba "Valores Válidos".');
    }

    return {
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
      errors,
      warnings,
    };
  });
}

export async function parseImportFile(
  file: File,
  reference: TemplateMasterData,
): Promise<ParsedImportRow[]> {
  const XLSX = await import("xlsx");
  let workbook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  } catch {
    throw new FinancialEntriesImportError("Não foi possível ler o arquivo. Envie um arquivo .xlsx válido.");
  }
  const sheetName = workbook.SheetNames.find((name) => name === "Lançamentos") ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new FinancialEntriesImportError('A planilha não contém a aba "Lançamentos".');
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean)[]>(sheet, { header: 1, defval: "" })
    .map((row) => row.map((value) => String(value)));
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
  return {
    row: row.row,
    type: row.type,
    description: row.fields.description,
    ...(isPayable ? { supplier: row.fields.partyName } : { customer: row.fields.partyName }),
    category: row.fields.category,
    costCenter: row.fields.costCenter,
    competenceMonth: row.fields.competenceMonth,
    issueDate: row.fields.issueDate,
    dueDate: row.fields.dueDate,
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
