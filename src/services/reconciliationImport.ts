/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ParsedStatementRow, StatementFieldKey } from "./ofxImport";
import { brazilianDateToIso } from "./dateFormatters";

export class ReconciliationImportError extends Error {}

const HEADER_ROW = [
  "Data (DD-MM-AAAA)",
  "Descrição",
  "Valor (negativo = saída, positivo = entrada)",
  "Nº Documento (opcional)",
  "Identificador (opcional)",
];

const EXAMPLE_ROWS: (string | number | Date)[][] = [
  [new Date(2026, 7, 1), "PIX ENV PAGTO FORNECEDOR (EXEMPLO - apague esta linha)", -1500, "1039", ""],
  [new Date(2026, 7, 2), "COBRANCA RECEBIDA CLIENTE (EXEMPLO - apague esta linha)", 4500, "2026042", ""],
];

const INSTRUCTIONS_ROWS: (string | number)[][] = [
  ["MODELO DE IMPORTAÇÃO DE EXTRATO BANCÁRIO - IDEX FINANCE"],
  ["Preencha uma linha por transação na aba \"Extrato\" e envie o arquivo de volta no sistema."],
  [],
  ["Coluna", "Obrigatório", "Formato / observações"],
  ["Data (DD-MM-AAAA)", "Sim", "Ex.: 01-08-2026"],
  ["Descrição", "Sim", "Texto livre, até 500 caracteres"],
  ["Valor (negativo = saída, positivo = entrada)", "Sim", "Número diferente de zero. Use ponto ou vírgula para decimais"],
  ["Nº Documento (opcional)", "Não", "Número do documento/cheque, se houver"],
  ["Identificador (opcional)", "Não", "Deixe em branco para o sistema gerar automaticamente a partir dos demais campos. Preencha apenas se seu banco fornecer um identificador único por transação"],
  [],
  ["Não altere os nomes das abas nem da linha de cabeçalho."],
  ["Apague as duas linhas de exemplo antes de enviar o arquivo."],
];

export async function buildTemplateWorkbookBase64() {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const statementSheet = XLSX.utils.aoa_to_sheet([HEADER_ROW, ...EXAMPLE_ROWS], {
    cellDates: true,
    dateNF: "dd-mm-yyyy",
  });
  for (const address of ["A2", "A3"]) {
    if (statementSheet[address]) statementSheet[address].z = "dd-mm-yyyy";
  }
  statementSheet["!cols"] = [
    { wch: 22 },
    { wch: 58 },
    { wch: 46 },
    { wch: 28 },
    { wch: 34 },
  ];
  statementSheet["!autofilter"] = { ref: `A1:E${EXAMPLE_ROWS.length + 1}` };
  XLSX.utils.book_append_sheet(
    workbook,
    statementSheet,
    "Extrato",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(INSTRUCTIONS_ROWS),
    "Instruções",
  );
  return XLSX.write(workbook, { type: "base64", bookType: "xlsx" }) as string;
}

function base64ToBytes(content: string) {
  const binary = window.atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function downloadStatementImportTemplate(bankAccountLabel: string) {
  const base64 = await buildTemplateWorkbookBase64();
  const bytes = base64ToBytes(base64);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `modelo-extrato-${bankAccountLabel.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.xlsx`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function cell(row: unknown[], index: number) {
  return (row[index] ?? "").toString().trim();
}

function parseMoney(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return NaN;
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  return Number(normalized);
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

export function statementDateToIso(value: string) {
  return brazilianDateToIso(value);
}

function addFieldError(
  fieldErrors: Partial<Record<StatementFieldKey, string[]>>,
  field: StatementFieldKey,
  message: string,
) {
  fieldErrors[field] = [...(fieldErrors[field] ?? []), message];
}

// Hash não-criptográfico (FNV-1a) usado apenas para gerar um identificador estável
// quando a planilha não informa um; reimportar a mesma planilha deve continuar
// deduplicando no backend (unique em [bankAccountId, externalId]).
function stableId(parts: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < parts.length; index += 1) {
    hash ^= parts.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `xlsx-${(hash >>> 0).toString(16)}`;
}

export function validateStatementRow(row: ParsedStatementRow): ParsedStatementRow {
  const fieldErrors: ParsedStatementRow["fieldErrors"] = {};
  if (!statementDateToIso(row.date)) {
    addFieldError(fieldErrors, "date", "Data inválida (use DD-MM-AAAA).");
  }
  if (!row.description.trim()) {
    addFieldError(fieldErrors, "description", "Descrição é obrigatória.");
  }
  if (!Number.isFinite(row.amount) || row.amount === 0) {
    addFieldError(fieldErrors, "amount", "Valor inválido (deve ser diferente de zero).");
  }
  if (!row.externalId.trim()) {
    addFieldError(fieldErrors, "externalId", "Identificador é obrigatório.");
  }
  return {
    ...row,
    errors: Object.values(fieldErrors).flat(),
    fieldErrors,
  };
}

export function parseStatementRows(sheetRows: unknown[][]): ParsedStatementRow[] {
  const dataRows = sheetRows.slice(1).filter((row) => row.some((value) => String(value ?? "").trim()));

  return dataRows.map((row, index) => {
    const date = normalizeDateCell(row[0]);
    const description = cell(row, 1);
    const amountRaw = cell(row, 2);
    const amount = parseMoney(amountRaw);
    const documentNumber = cell(row, 3) || undefined;
    const explicitId = cell(row, 4);
    const externalId = explicitId || stableId(`${date}|${description}|${amountRaw}|${documentNumber ?? ""}`);

    return validateStatementRow({
      row: index + 2,
      externalId,
      date,
      description,
      amount,
      documentNumber,
      errors: [],
      fieldErrors: {},
    });
  });
}

export function toStatementImportPayload(row: ParsedStatementRow) {
  const date = statementDateToIso(row.date);
  if (!date) throw new ReconciliationImportError("Corrija a data inválida antes de importar esta linha.");
  return {
    id: row.externalId,
    date,
    description: row.description,
    amount: row.amount,
    documentNumber: row.documentNumber,
    isReconciled: false,
    reconciliationStatus: "Pendente" as const,
  };
}

export async function parseStatementExcelFile(file: File): Promise<ParsedStatementRow[]> {
  const XLSX = await import("xlsx");
  let workbook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  } catch {
    throw new ReconciliationImportError("Não foi possível ler o arquivo. Envie um arquivo .xlsx válido.");
  }
  const sheetName = workbook.SheetNames.find((name) => name === "Extrato") ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new ReconciliationImportError('A planilha não contém a aba "Extrato".');
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | Date)[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  if (!rows.length) throw new ReconciliationImportError("A planilha está vazia.");
  return parseStatementRows(rows);
}
