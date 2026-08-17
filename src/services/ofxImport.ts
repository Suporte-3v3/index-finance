/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class OfxImportError extends Error {}

export interface ParsedStatementRow {
  row: number;
  externalId: string;
  date: string;
  description: string;
  amount: number;
  documentNumber?: string;
  errors: string[];
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
    const errors: string[] = [];

    const fitid = tag(block, "FITID");
    const dtposted = tag(block, "DTPOSTED");
    const trnamt = tag(block, "TRNAMT");
    const memo = tag(block, "MEMO");
    const name = tag(block, "NAME");
    const checknum = tag(block, "CHECKNUM");

    const date = toIsoDate(dtposted);
    if (!date) errors.push("Data da transação inválida ou ausente (DTPOSTED).");

    const amount = Number(trnamt.replace(",", "."));
    if (!trnamt || !Number.isFinite(amount) || amount === 0) {
      errors.push("Valor da transação inválido ou ausente (TRNAMT).");
    }

    const description = memo || name;
    if (!description) errors.push("Descrição da transação ausente (MEMO/NAME).");

    if (!fitid) errors.push("Identificador da transação ausente (FITID).");

    return {
      row: index + 1,
      externalId: fitid || `ofx-${index + 1}`,
      date,
      description,
      amount,
      documentNumber: checknum || undefined,
      errors,
    };
  });

  return { rows, accountNumberHint };
}
