import * as XLSX from "xlsx";
import type { ReportCell, ReportDocumentData, ReportSectionData } from "./reportFiles";
import { formatDateTime } from "./dateFormatters";
import { formatBrazilianDate, safeReportText } from "./reportFormatters";

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

const ISO_DATE_VALUE = /^(\d{4})-(\d{2})-(\d{2})$/;

const excelCellValue = (value: ReportCell): ReportCell | Date => {
  if (typeof value !== "string") return value;
  const match = ISO_DATE_VALUE.exec(value);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return safeReportText(value);
};

const applyExcelDateFormats = (sheet: XLSX.WorkSheet) => {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell?.v instanceof Date || cell?.t === "d") cell.z = "dd-mm-yyyy";
    }
  }
};

export const createExcel = (doc: ReportDocumentData) => {
  const workbook = XLSX.utils.book_new();
  const usedSheetNames = new Set<string>();
  const period = doc.period?.startDate && doc.period?.endDate
    ? `${formatBrazilianDate(doc.period.startDate)} a ${formatBrazilianDate(doc.period.endDate)}`
    : "-";
  const summaryRows: ReportCell[][] = [
    ["IDEX FINANCE - CENTRAL DE RELATÓRIOS"],
    [doc.title],
    ["Empresa", doc.companyName],
    ["CNPJ", doc.companyCnpj || "-"],
    ["Período", period],
    ["Filtros", doc.filters],
    ["Emitido em", formatDateTime(doc.generatedAt, doc.timeZone)],
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
      const rows: (ReportCell | Date)[][] = [
        [section.title],
        section.columns,
        ...section.rows.map((row) => row.map(excelCellValue)),
      ];
      const sheet = XLSX.utils.aoa_to_sheet(rows, { cellDates: true, dateNF: "dd-mm-yyyy" });
      applyExcelDateFormats(sheet);
      XLSX.utils.book_append_sheet(
        workbook,
        sheet,
        uniqueSheetName(section.title, usedSheetNames),
      );
    });

  return XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
};
