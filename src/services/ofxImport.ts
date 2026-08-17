/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class OfxImportError extends Error {}

export type StatementFieldKey = "date" | "description" | "amount" | "documentNumber" | "externalId";

export interface ParsedStatementRow {
  row: number;
  externalId: string;
  date: string;
  description: string;
  amount: number;
  documentNumber?: string;
  errors: string[];
  fieldErrors: Partial<Record<StatementFieldKey, string[]>>;
}

function tag(block: string, name: string) {
  const match = block.match(new RegExp(`<${name}>([^<\r\n]*)`, "i"));
  return match ? match[1].trim() : "";
}

function toIsoDate(dtposted: string) {
  const digits = dtposted.slice(0, 8);
  if (!/^\d{8}$/.test(digits)) return "";
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function isoToBrazilianDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

function isValidBrazilianDate(value: string) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function decodeOfx(buffer: ArrayBuffer) {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  const charsetMatch = utf8.slice(0, 400).match(/CHARSET:\s*1252/i);
  if (charsetMatch) return new TextDecoder("windows-1252").decode(buffer);
  return utf8;
}

export async function parseOfxFile(file: File): Promise<{
  rows: ParsedStatementRow[];
  accountNumberHint?: string;
}> {
  const text = decodeOfx(await file.arrayBuffer());

  const accountNumberHint = tag(text, "ACCTID") || undefined;

  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi);
  if (!blocks || blocks.length === 0) {
    throw new OfxImportError("Não foi possível encontrar transações neste arquivo OFX.");
  }

  const rows: ParsedStatementRow[] = blocks.map((block, index) => {
    const fieldErrors: ParsedStatementRow["fieldErrors"] = {};
    const addError = (field: StatementFieldKey, message: string) => {
      fieldErrors[field] = [...(fieldErrors[field] ?? []), message];
    };

    const fitid = tag(block, "FITID");
    const dtposted = tag(block, "DTPOSTED");
    const trnamt = tag(block, "TRNAMT");
    const memo = tag(block, "MEMO");
    const name = tag(block, "NAME");
    const checknum = tag(block, "CHECKNUM");

    const date = isoToBrazilianDate(toIsoDate(dtposted));
    if (!isValidBrazilianDate(date)) {
      addError("date", "Data da transação inválida ou ausente (DTPOSTED).");
    }

    const amount = Number(trnamt.replace(",", "."));
    if (!trnamt || !Number.isFinite(amount) || amount === 0) {
      addError("amount", "Valor da transação inválido ou ausente (TRNAMT).");
    }

    const description = memo || name;
    if (!description) addError("description", "Descrição da transação ausente (MEMO/NAME).");

    if (!fitid) addError("externalId", "Identificador da transação ausente (FITID).");

    return {
      row: index + 1,
      externalId: fitid || `ofx-${index + 1}`,
      date,
      description,
      amount,
      documentNumber: checknum || undefined,
      errors: Object.values(fieldErrors).flat(),
      fieldErrors,
    };
  });

  return { rows, accountNumberHint };
}
