import * as XLSX from "xlsx";
import { ReportExportFormat, ReportRecord } from "../types";

export type ReportCell = string | number;

export type ReportSectionData =
  | { kind: "kpis"; title?: string; items: { label: string; value: string }[] }
  | { kind: "table"; title: string; columns: string[]; rows: ReportCell[][] }
  | {
      kind: "chart";
      title: string;
      chartType: "bar" | "pie";
      columns: string[];
      rows: ReportCell[][];
    };

export interface ReportDocumentData {
  title: string;
  companyName: string;
  filters: string;
  generatedAt: string;
  generatedBy: string;
  sections: ReportSectionData[];
}

export interface ReportArtifact {
  format: ReportExportFormat;
  fileName: string;
  mimeType: string;
  fileContent: string;
  fileSize: string;
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return window.btoa(binary);
};

const base64ToBytes = (content: string) => {
  const binary = window.atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
};

const safeFileName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "relatorio";

const displayCell = (value: ReportCell) =>
  typeof value === "number"
    ? value.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : value;

const asciiText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\x20-\x7E]/g, "?");

const escapePdfText = (value: string) =>
  asciiText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const wrapLine = (value: string, maxLength = 112) => {
  const words = asciiText(value).split(/\s+/);
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= maxLength) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines.length ? lines : [""];
};

const sectionToLines = (section: ReportSectionData): string[] => {
  if (section.kind === "kpis") {
    const lines: string[] = [];
    if (section.title) lines.push(section.title.toUpperCase());
    section.items.forEach((item) => lines.push(`${item.label}: ${item.value}`));
    return lines;
  }
  const lines = [section.title.toUpperCase(), section.columns.join(" | "), "-".repeat(80)];
  if (section.rows.length === 0) lines.push("Nenhum registro encontrado para os filtros informados.");
  section.rows.forEach((row) => {
    wrapLine(row.map(displayCell).join(" | ")).forEach((line) => lines.push(line));
  });
  return lines;
};

// Layout de página (pt): A4 paisagem-like já usado (842x595), com cabeçalho
// (marca + título + empresa/período/filtros) e rodapé (marca + paginação)
// repetidos em toda página, como pedido para relatórios padronizados.
const PAGE_WIDTH = 842;
const MARGIN_X = 36;
const BODY_TOP = 560;
const BODY_LINE_HEIGHT = 11;
const FOOTER_LINE_Y = 34;
const FOOTER_RULE_Y = 42;

type PdfOp =
  | { kind: "text"; text: string; x: number; y: number; font: "F1" | "F2"; size: number }
  | { kind: "rule"; y: number };

const opsToStream = (ops: PdfOp[]) =>
  ops
    .map((op) =>
      op.kind === "rule"
        ? `${MARGIN_X} ${op.y} m ${PAGE_WIDTH - MARGIN_X} ${op.y} l S`
        : `BT /${op.font} ${op.size} Tf 1 0 0 1 ${op.x} ${op.y} Tm (${escapePdfText(op.text)}) Tj ET`,
    )
    .join("\n");

const buildHeader = (doc: ReportDocumentData) => {
  const ops: PdfOp[] = [];
  let y = BODY_TOP;
  ops.push({ kind: "text", text: "IDEX FINANCE — CENTRAL DE RELATÓRIOS", x: MARGIN_X, y, font: "F2", size: 8 });
  y -= 18;
  ops.push({ kind: "text", text: doc.title, x: MARGIN_X, y, font: "F2", size: 14 });
  y -= 16;
  ops.push({ kind: "text", text: `Empresa: ${doc.companyName}`, x: MARGIN_X, y, font: "F1", size: 8 });
  y -= 11;
  if (doc.filters) {
    wrapLine(`Período/Filtros: ${doc.filters}`, 130).forEach((line) => {
      ops.push({ kind: "text", text: line, x: MARGIN_X, y, font: "F1", size: 8 });
      y -= 10;
    });
  }
  ops.push({
    kind: "text",
    text: `Emitido em ${new Date(doc.generatedAt).toLocaleString("pt-BR")} por ${doc.generatedBy}`,
    x: MARGIN_X,
    y,
    font: "F1",
    size: 8,
  });
  y -= 10;
  ops.push({ kind: "rule", y });
  y -= 16;
  return { ops, bodyStartY: y };
};

const buildFooter = (pageNumber: number, totalPages: number): PdfOp[] => [
  { kind: "rule", y: FOOTER_RULE_Y },
  { kind: "text", text: "Idex Finance — Gestão que move resultados", x: MARGIN_X, y: FOOTER_LINE_Y, font: "F1", size: 7 },
  {
    kind: "text",
    text: `Página ${pageNumber} de ${totalPages}`,
    x: PAGE_WIDTH - MARGIN_X - 70,
    y: FOOTER_LINE_Y,
    font: "F1",
    size: 7,
  },
];

const createPdf = (doc: ReportDocumentData) => {
  const bodyLines = doc.sections.flatMap((section) => [...sectionToLines(section), ""]);
  const { bodyStartY } = buildHeader(doc);
  const linesPerPage = Math.max(10, Math.floor((bodyStartY - FOOTER_RULE_Y - 10) / BODY_LINE_HEIGHT));

  const pages: string[][] = [];
  for (let index = 0; index < bodyLines.length; index += linesPerPage) {
    pages.push(bodyLines.slice(index, index + linesPerPage));
  }
  if (pages.length === 0) pages.push([]);

  const fontRegularId = 3 + pages.length * 2;
  const fontBoldId = fontRegularId + 1;
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pages
    .map((_, index) => `${3 + index * 2} 0 R`)
    .join(" ")}] /Count ${pages.length} >>`;

  pages.forEach((pageLines, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    const { ops: headerOps, bodyStartY: startY } = buildHeader(doc);
    const bodyOps: PdfOp[] = pageLines.map((line, lineIndex) => ({
      kind: "text",
      text: line,
      x: MARGIN_X,
      y: startY - lineIndex * BODY_LINE_HEIGHT,
      font: "F1",
      size: 8,
    }));
    const stream = opsToStream([
      ...headerOps,
      ...bodyOps,
      ...buildFooter(index + 1, pages.length),
    ]);
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] ` +
      `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[fontRegularId] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[fontBoldId] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let id = 1; id <= fontBoldId; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${fontBoldId + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let id = 1; id <= fontBoldId; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf +=
    `trailer\n<< /Size ${fontBoldId + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF`;
  return pdf;
};

const uniqueSheetName = (base: string, used: Set<string>) => {
  const clean = base.replace(/[\\/*?:[\]]/g, " ").trim().slice(0, 31) || "Dados";
  let name = clean;
  let suffix = 2;
  while (used.has(name.toLocaleLowerCase("pt-BR"))) {
    name = `${clean.slice(0, 28)} ${suffix}`;
    suffix += 1;
  }
  used.add(name.toLocaleLowerCase("pt-BR"));
  return name;
};

const createExcel = (doc: ReportDocumentData) => {
  const workbook = XLSX.utils.book_new();
  const usedSheetNames = new Set<string>();

  const summaryRows: ReportCell[][] = [
    ["IDEX FINANCE — CENTRAL DE RELATÓRIOS"],
    [doc.title],
    ["Empresa", doc.companyName],
    ["Período/Filtros", doc.filters],
    ["Emitido em", new Date(doc.generatedAt).toLocaleString("pt-BR")],
    ["Gerado por", doc.generatedBy],
  ];
  doc.sections
    .filter((section): section is Extract<ReportSectionData, { kind: "kpis" }> => section.kind === "kpis")
    .forEach((section) => {
      summaryRows.push([]);
      if (section.title) summaryRows.push([section.title]);
      section.items.forEach((item) => summaryRows.push([item.label, item.value]));
    });
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(summaryRows),
    uniqueSheetName("Resumo", usedSheetNames),
  );

  doc.sections
    .filter((section) => section.kind !== "kpis")
    .forEach((section) => {
      if (section.kind !== "table" && section.kind !== "chart") return;
      const rows: ReportCell[][] = [[section.title], section.columns, ...section.rows];
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(rows),
        uniqueSheetName(section.title, usedSheetNames),
      );
    });

  const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
  return base64;
};

export function createReportArtifact(
  doc: ReportDocumentData,
  format: ReportExportFormat,
): ReportArtifact {
  const date = doc.generatedAt.slice(0, 10);
  const baseName = `${safeFileName(doc.title)}-${date}`;

  if (format === "EXCEL") {
    const base64 = createExcel(doc);
    const bytes = base64ToBytes(base64);
    return {
      format,
      fileName: `${baseName}.xlsx`,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileContent: base64,
      fileSize: formatFileSize(bytes.byteLength),
    };
  }

  const pdf = createPdf(doc);
  const bytes = new TextEncoder().encode(pdf);
  return {
    format,
    fileName: `${baseName}.pdf`,
    mimeType: "application/pdf",
    fileContent: bytesToBase64(bytes),
    fileSize: formatFileSize(bytes.byteLength),
  };
}

export function downloadReportFile(report: ReportRecord): boolean {
  if (!report.fileContent || !report.fileName || !report.mimeType) return false;
  try {
    const bytes = base64ToBytes(report.fileContent);
    const blob = new Blob([bytes], { type: report.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = report.fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    return true;
  } catch {
    return false;
  }
}
