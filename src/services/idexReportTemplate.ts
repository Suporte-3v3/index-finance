import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import idexLogo from "../../assets/idex-finance-logo-transparent.png?inline";
import { resolveCompanyLogo } from "./companyBranding";
import type {
  ReportCell,
  ReportDocumentData,
  ReportSectionData,
} from "./reportFiles";
import {
  formatBrazilianCurrency,
  formatBrazilianDate,
  formatBrazilianDateTime,
  safeReportText,
} from "./reportFormatters";

export type ReportOrientation = "auto" | "portrait" | "landscape";

const COLORS = {
  navy: [7, 24, 43] as const,
  institutional: [11, 47, 87] as const,
  technology: [36, 116, 181] as const,
  red: [212, 9, 50] as const,
  gold: [215, 185, 128] as const,
  canvas: [244, 246, 249] as const,
  white: [255, 255, 255] as const,
  ink: [23, 32, 51] as const,
  muted: [104, 115, 134] as const,
  border: [220, 226, 234] as const,
  positive: [19, 138, 98] as const,
  warning: [210, 138, 22] as const,
  canceled: [120, 129, 143] as const,
};

const MARGIN_X = 14;
const HEADER_HEIGHT = 25;
const CONTENT_TOP = 31;
const FOOTER_HEIGHT = 12;
const SECTION_GAP = 5;

const DATE_COLUMNS = /data|vencimento|pagamento|recebimento|compet[eê]ncia/i;
const MONEY_COLUMNS = /valor|saldo|receita|despesa|custo|resultado|pagamento|recebido|previsto|realizado|dedu[cç][aã]o|lucro|entrada|sa[ií]da|varia[cç][aã]o em/i;
const PERCENT_COLUMNS = /percent|margem|%/i;

const asColor = (value: readonly [number, number, number]) =>
  value as unknown as [number, number, number];

const splitFilterSummary = (filters: string) =>
  filters
    .split(/\s*\|\s*/)
    .map((entry) => {
      const separator = entry.indexOf(":");
      return separator > 0
        ? { label: entry.slice(0, separator).trim(), value: entry.slice(separator + 1).trim() }
        : { label: "Filtro", value: entry.trim() };
    })
    .filter((entry) => entry.value && !/^(undefined|null|nan)$/i.test(entry.value));

const chooseOrientation = (doc: ReportDocumentData): "portrait" | "landscape" => {
  if (doc.orientation && doc.orientation !== "auto") return doc.orientation;
  const widestTable = doc.sections.reduce((max, section) => {
    if (section.kind === "kpis") return max;
    const textWeight = section.columns.reduce(
      (sum, column) => sum + Math.min(24, Math.max(7, column.length)),
      0,
    );
    return Math.max(max, textWeight + section.columns.length * 5);
  }, 0);
  return widestTable > 92 ? "landscape" : "portrait";
};

const statusColor = (value: string) => {
  const normalized = value.toLocaleLowerCase("pt-BR");
  if (/vencid|rejeitad|cr[ií]tic/.test(normalized)) return COLORS.red;
  if (/paga|pago|recebid|conclu[ií]d|entrada/.test(normalized)) return COLORS.positive;
  if (/parcial|pendente|aguardando|agendada|a vencer/.test(normalized)) return COLORS.warning;
  if (/cancelad|rascunho/.test(normalized)) return COLORS.canceled;
  if (/sa[ií]da/.test(normalized)) return COLORS.red;
  return undefined;
};

const isNegative = (value: string) =>
  /^\s*-\s*(?:R\$\s*)?\d/.test(value) || /^\s*R\$\s*-\s*\d/.test(value) || /\(.*R\$/.test(value);

const formatCell = (value: ReportCell, column: string): string => {
  if (typeof value === "number") {
    if (MONEY_COLUMNS.test(column)) return formatBrazilianCurrency(value);
    if (PERCENT_COLUMNS.test(column)) return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
    return Number.isInteger(value)
      ? value.toLocaleString("pt-BR")
      : value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return safeReportText(value);
};

const drawHeader = (pdf: jsPDF, doc: ReportDocumentData, logoSource: string) => {
  const width = pdf.internal.pageSize.getWidth();
  pdf.setFillColor(...asColor(COLORS.navy));
  pdf.rect(0, 0, width, HEADER_HEIGHT, "F");
  pdf.setFillColor(...asColor(COLORS.red));
  pdf.rect(0, HEADER_HEIGHT - 1.5, width * 0.34, 1.5, "F");
  pdf.setFillColor(...asColor(COLORS.technology));
  pdf.rect(width * 0.34, HEADER_HEIGHT - 1.5, width * 0.42, 1.5, "F");
  pdf.setFillColor(...asColor(COLORS.gold));
  pdf.rect(width * 0.76, HEADER_HEIGHT - 1.5, width * 0.24, 1.5, "F");

  try {
    const format = logoSource.startsWith("data:image/jpeg")
      ? "JPEG"
      : logoSource.startsWith("data:image/webp")
        ? "WEBP"
        : "PNG";
    const properties = pdf.getImageProperties(logoSource);
    const maxWidth = 23;
    const maxHeight = 20.5;
    const scale = Math.min(maxWidth / properties.width, maxHeight / properties.height);
    const logoWidth = properties.width * scale;
    const logoHeight = properties.height * scale;
    pdf.addImage(
      logoSource,
      format,
      MARGIN_X + (maxWidth - logoWidth) / 2,
      1.5 + (maxHeight - logoHeight) / 2,
      logoWidth,
      logoHeight,
      undefined,
      "FAST",
    );
  } catch {
    // O texto institucional abaixo mantém o cabeçalho utilizável caso o asset
    // ainda não tenha terminado de carregar em um navegador muito antigo.
  }

  pdf.setTextColor(...asColor(COLORS.white));
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("Idex Finance", MARGIN_X + 26, 8);
  pdf.setFontSize(7.5);
  pdf.setFont("helvetica", "normal");
  const titleWidth = Math.max(48, width * 0.42);
  const titleLines = pdf.splitTextToSize(doc.reportType || doc.title, titleWidth).slice(0, 2);
  pdf.text(titleLines, MARGIN_X + 26, 13);

  const rightX = width - MARGIN_X;
  const period = doc.period?.startDate && doc.period?.endDate
    ? `${formatBrazilianDate(doc.period.startDate)} a ${formatBrazilianDate(doc.period.endDate)}`
    : "Período não informado";
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "bold");
  pdf.text(doc.companyName, rightX, 7, { align: "right", maxWidth: width * 0.32 });
  pdf.setFont("helvetica", "normal");
  if (doc.companyCnpj) pdf.text(`CNPJ ${doc.companyCnpj}`, rightX, 11.5, { align: "right" });
  pdf.text(period, rightX, 16, { align: "right" });
};

const drawFooter = (
  pdf: jsPDF,
  doc: ReportDocumentData,
  pageNumber: number,
  totalPages: number,
) => {
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const ruleY = height - FOOTER_HEIGHT + 1;
  pdf.setDrawColor(...asColor(COLORS.border));
  pdf.setLineWidth(0.25);
  pdf.line(MARGIN_X, ruleY, width - MARGIN_X, ruleY);
  pdf.setTextColor(...asColor(COLORS.muted));
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  pdf.text("Idex Finance - Gestão que move resultados", MARGIN_X, ruleY + 4);
  pdf.text(`${doc.companyName} | Documento confidencial`, width / 2, ruleY + 4, { align: "center" });
  pdf.text(`Página ${pageNumber} de ${totalPages}`, width - MARGIN_X, ruleY + 4, { align: "right" });
  pdf.text(`Gerado em ${formatBrazilianDateTime(doc.generatedAt, doc.timeZone)}`, MARGIN_X, ruleY + 7.5);
};

const addPage = (pdf: jsPDF) => {
  pdf.addPage();
  return CONTENT_TOP;
};

const ensureSpace = (pdf: jsPDF, y: number, required: number) => {
  const limit = pdf.internal.pageSize.getHeight() - FOOTER_HEIGHT - 3;
  return y + required > limit ? addPage(pdf) : y;
};

const drawSectionTitle = (pdf: jsPDF, title: string, y: number) => {
  pdf.setFillColor(...asColor(COLORS.institutional));
  pdf.roundedRect(MARGIN_X, y, 2, 6, 0.6, 0.6, "F");
  pdf.setTextColor(...asColor(COLORS.navy));
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text(title, MARGIN_X + 4, y + 4.4);
  return y + 8;
};

const drawIdentification = (pdf: jsPDF, doc: ReportDocumentData) => {
  const width = pdf.internal.pageSize.getWidth();
  const contentWidth = width - MARGIN_X * 2;
  let y = CONTENT_TOP;
  pdf.setTextColor(...asColor(COLORS.navy));
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  const titleLines = pdf.splitTextToSize(doc.title, contentWidth);
  pdf.text(titleLines, MARGIN_X, y);
  y += titleLines.length * 6 + 1;

  if (doc.description) {
    pdf.setTextColor(...asColor(COLORS.muted));
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    const descriptionLines = pdf.splitTextToSize(doc.description, contentWidth);
    pdf.text(descriptionLines, MARGIN_X, y);
    y += descriptionLines.length * 4 + 2;
  }

  const period = doc.period?.startDate && doc.period?.endDate
    ? `${formatBrazilianDate(doc.period.startDate)} a ${formatBrazilianDate(doc.period.endDate)}`
    : "Não informado";
  const details = [
    ["Empresa", doc.companyName],
    ["CNPJ", doc.companyCnpj || "Não informado"],
    ["Período", period],
    ["Base da data", doc.period?.dateBasis || "Não informada"],
    ...(doc.period?.regime ? [["Regime", doc.period.regime]] : []),
    ["Gerado em", formatBrazilianDateTime(doc.generatedAt, doc.timeZone)],
    ["Gerado por", doc.generatedBy],
  ];
  const columns = width > 240 ? 3 : 2;
  const cellWidth = contentWidth / columns;
  const rows = Math.ceil(details.length / columns);
  const detailHeight = rows * 8 + 4;
  pdf.setFillColor(...asColor(COLORS.white));
  pdf.setDrawColor(...asColor(COLORS.border));
  pdf.roundedRect(MARGIN_X, y, contentWidth, detailHeight, 1.5, 1.5, "FD");
  details.forEach(([label, value], index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = MARGIN_X + 4 + col * cellWidth;
    const itemY = y + 5 + row * 8;
    pdf.setTextColor(...asColor(COLORS.muted));
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.2);
    pdf.text(String(label).toUpperCase(), x, itemY);
    pdf.setTextColor(...asColor(COLORS.ink));
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.4);
    pdf.text(pdf.splitTextToSize(safeReportText(value), cellWidth - 7).slice(0, 1), x, itemY + 3.2);
  });
  return y + detailHeight + SECTION_GAP;
};

const drawFilters = (pdf: jsPDF, doc: ReportDocumentData, startY: number) => {
  const filters = doc.appliedFilters?.length
    ? doc.appliedFilters.filter((filter) => safeReportText(filter.value) !== "-")
    : splitFilterSummary(doc.filters || "");
  if (!filters.length) return startY;

  const width = pdf.internal.pageSize.getWidth();
  const contentWidth = width - MARGIN_X * 2;
  const columns = width > 240 ? 4 : 3;
  const rows = Math.ceil(filters.length / columns);
  const panelHeight = 8 + rows * 8;
  let y = ensureSpace(pdf, startY, panelHeight + 4);
  pdf.setFillColor(...asColor(COLORS.canvas));
  pdf.setDrawColor(...asColor(COLORS.border));
  pdf.roundedRect(MARGIN_X, y, contentWidth, panelHeight, 1.5, 1.5, "FD");
  pdf.setTextColor(...asColor(COLORS.navy));
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.text("FILTROS APLICADOS", MARGIN_X + 4, y + 5);
  const cellWidth = contentWidth / columns;
  filters.forEach((filter, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = MARGIN_X + 4 + col * cellWidth;
    const itemY = y + 11 + row * 8;
    pdf.setTextColor(...asColor(COLORS.muted));
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.2);
    pdf.text(filter.label.toUpperCase(), x, itemY);
    pdf.setTextColor(...asColor(COLORS.ink));
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text(pdf.splitTextToSize(safeReportText(filter.value), cellWidth - 7).slice(0, 1), x, itemY + 3);
  });
  return y + panelHeight + SECTION_GAP;
};

const drawSummary = (
  pdf: jsPDF,
  sections: Extract<ReportSectionData, { kind: "kpis" }>[],
  startY: number,
) => {
  const items = sections.flatMap((section) => section.items);
  if (!items.length) return startY;
  const width = pdf.internal.pageSize.getWidth();
  const contentWidth = width - MARGIN_X * 2;
  const columns = width > 240 ? Math.min(5, items.length) : Math.min(3, items.length);
  const rows = Math.ceil(items.length / columns);
  const cardWidth = (contentWidth - (columns - 1) * 3) / columns;
  const required = 9 + rows * 18;
  let y = ensureSpace(pdf, startY, required);
  y = drawSectionTitle(pdf, "Resumo do relatório", y);
  items.forEach((item, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = MARGIN_X + col * (cardWidth + 3);
    const cardY = y + row * 18;
    pdf.setFillColor(...asColor(COLORS.canvas));
    pdf.setDrawColor(...asColor(COLORS.border));
    pdf.roundedRect(x, cardY, cardWidth, 15, 1.3, 1.3, "FD");
    pdf.setTextColor(...asColor(COLORS.muted));
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.2);
    pdf.text(pdf.splitTextToSize(item.label.toUpperCase(), cardWidth - 6).slice(0, 2), x + 3, cardY + 4);
    const value = safeReportText(item.value);
    pdf.setTextColor(...asColor(isNegative(value) ? COLORS.red : COLORS.navy));
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.2);
    pdf.text(pdf.splitTextToSize(value, cardWidth - 6).slice(0, 1), x + 3, cardY + 12);
  });
  return y + rows * 18 + SECTION_GAP;
};

const drawTable = (
  pdf: jsPDF,
  section: Extract<ReportSectionData, { kind: "table" }>,
  startY: number,
) => {
  let y = ensureSpace(pdf, startY, 24);
  y = drawSectionTitle(pdf, section.title, y);
  const columns = section.columns.map(safeReportText);
  if (!section.rows.length) {
    const width = pdf.internal.pageSize.getWidth() - MARGIN_X * 2;
    pdf.setFillColor(...asColor(COLORS.canvas));
    pdf.setDrawColor(...asColor(COLORS.border));
    pdf.roundedRect(MARGIN_X, y, width, 17, 1.5, 1.5, "FD");
    pdf.setTextColor(...asColor(COLORS.muted));
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(
      "Nenhum registro encontrado para os filtros selecionados",
      pdf.internal.pageSize.getWidth() / 2,
      y + 9.5,
      { align: "center" },
    );
    return y + 17 + SECTION_GAP;
  }
  const body = section.rows.map((row) =>
    columns.map((column, index) => formatCell(row[index] ?? "", column)),
  );

  autoTable(pdf, {
    startY: y,
    margin: { top: CONTENT_TOP, right: MARGIN_X, bottom: FOOTER_HEIGHT + 3, left: MARGIN_X },
    head: columns.length ? [columns] : undefined,
    body,
    showHead: "everyPage",
    theme: "grid",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: columns.length >= 8 ? 7.1 : 7.6,
      textColor: asColor(COLORS.ink),
      lineColor: asColor(COLORS.border),
      lineWidth: 0.15,
      cellPadding: 2.1,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: asColor(COLORS.navy),
      textColor: asColor(COLORS.white),
      fontStyle: "bold",
      lineColor: asColor(COLORS.institutional),
      minCellHeight: 8,
    },
    alternateRowStyles: { fillColor: [248, 249, 251] },
    didParseCell: (hook) => {
      if (hook.section !== "body") return;
      const header = columns[hook.column.index] || "";
      const value = String(hook.cell.raw ?? "");
      if (DATE_COLUMNS.test(header)) hook.cell.styles.halign = "center";
      if (MONEY_COLUMNS.test(header) || PERCENT_COLUMNS.test(header)) hook.cell.styles.halign = "right";
      const semanticColor = statusColor(value);
      if (semanticColor) {
        hook.cell.styles.textColor = asColor(semanticColor);
        hook.cell.styles.fontStyle = "bold";
      } else if (isNegative(value)) {
        hook.cell.styles.textColor = asColor(COLORS.red);
      }
    },
  });
  const finalY = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y;
  return finalY + SECTION_GAP;
};

const drawChart = (
  pdf: jsPDF,
  section: Extract<ReportSectionData, { kind: "chart" }>,
  startY: number,
) => {
  const rows = section.rows.slice(0, 12);
  const required = 12 + Math.max(1, rows.length) * 7;
  let y = ensureSpace(pdf, startY, required);
  y = drawSectionTitle(pdf, section.title, y);
  if (!rows.length) {
    pdf.setTextColor(...asColor(COLORS.muted));
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text("Nenhum registro encontrado para os filtros selecionados", MARGIN_X, y + 4);
    return y + 11;
  }

  const width = pdf.internal.pageSize.getWidth() - MARGIN_X * 2;
  const labelWidth = Math.min(55, width * 0.34);
  const values = rows.map((row) => Number(row[1]) || 0);
  const maxValue = Math.max(1, ...values.map(Math.abs));
  rows.forEach((row, index) => {
    const value = values[index];
    const rowY = y + index * 7;
    pdf.setTextColor(...asColor(COLORS.ink));
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text(pdf.splitTextToSize(safeReportText(row[0]), labelWidth - 3).slice(0, 1), MARGIN_X, rowY + 4);
    const barX = MARGIN_X + labelWidth;
    const barWidth = Math.max(0.8, (width - labelWidth - 32) * (Math.abs(value) / maxValue));
    const palette = section.chartType === "pie"
      ? [COLORS.technology, COLORS.red, COLORS.gold, COLORS.positive][index % 4]
      : value < 0 ? COLORS.red : COLORS.technology;
    pdf.setFillColor(...asColor(palette));
    pdf.roundedRect(barX, rowY + 1, barWidth, 4, 0.8, 0.8, "F");
    pdf.setTextColor(...asColor(value < 0 ? COLORS.red : COLORS.navy));
    pdf.setFont("helvetica", "bold");
    pdf.text(formatBrazilianCurrency(value), MARGIN_X + width, rowY + 4, { align: "right" });
  });
  return y + rows.length * 7 + SECTION_GAP;
};

const drawTotals = (
  pdf: jsPDF,
  summaries: Extract<ReportSectionData, { kind: "kpis" }>[],
  startY: number,
) => {
  const sourceItems = summaries.flatMap((section) => section.items);
  const primaryIndex = sourceItems.findIndex((item) =>
    /total geral|total previsto|resultado l[ií]quido|saldo final/i.test(item.label),
  );
  const items = primaryIndex >= 0
    ? [...sourceItems.filter((_, index) => index !== primaryIndex), sourceItems[primaryIndex]]
    : sourceItems;
  if (!items.length) return startY;
  let y = ensureSpace(pdf, startY, 15 + items.length * 7);
  y = drawSectionTitle(pdf, "Totalizadores", y);
  const width = pdf.internal.pageSize.getWidth();
  const boxWidth = width - MARGIN_X * 2;
  const height = 5 + items.length * 7;
  pdf.setFillColor(235, 241, 247);
  pdf.setDrawColor(...asColor(COLORS.border));
  pdf.roundedRect(MARGIN_X, y, boxWidth, height, 1.5, 1.5, "FD");
  items.forEach((item, index) => {
    const itemY = y + 5 + index * 7;
    const isLast = index === items.length - 1;
    if (isLast) {
      pdf.setFillColor(...asColor(COLORS.navy));
      pdf.rect(MARGIN_X, itemY - 4.5, boxWidth, 7, "F");
    }
    pdf.setTextColor(...asColor(isLast ? COLORS.white : COLORS.ink));
    pdf.setFont("helvetica", isLast ? "bold" : "normal");
    pdf.setFontSize(7.5);
    pdf.text(item.label, MARGIN_X + 4, itemY);
    const value = safeReportText(item.value);
    pdf.setTextColor(...asColor(isLast ? COLORS.white : isNegative(value) ? COLORS.red : COLORS.navy));
    pdf.setFont("helvetica", "bold");
    pdf.text(value, width - MARGIN_X - 4, itemY, { align: "right" });
  });
  return y + height + SECTION_GAP;
};

const drawNotes = (pdf: jsPDF, notes: string, startY: number) => {
  if (!notes.trim()) return startY;
  const width = pdf.internal.pageSize.getWidth();
  const contentWidth = width - MARGIN_X * 2;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  const lines = notes.split(/\r?\n/).flatMap((line) => pdf.splitTextToSize(line || " ", contentWidth - 8));
  let y = ensureSpace(pdf, startY, 14 + lines.length * 4);
  y = drawSectionTitle(pdf, "Observações do responsável financeiro", y);
  const height = Math.max(13, 7 + lines.length * 4);
  pdf.setFillColor(...asColor(COLORS.canvas));
  pdf.setDrawColor(...asColor(COLORS.border));
  pdf.roundedRect(MARGIN_X, y, contentWidth, height, 1.5, 1.5, "FD");
  pdf.setTextColor(...asColor(COLORS.ink));
  pdf.text(lines, MARGIN_X + 4, y + 5);
  return y + height + SECTION_GAP;
};

export const createIdexReportPdf = (
  doc: ReportDocumentData,
  logoOverride?: string,
): Uint8Array => {
  const logoSource = logoOverride || resolveCompanyLogo(doc.companyLogoDataUrl, idexLogo);
  const orientation = chooseOrientation(doc);
  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });

  const noteSections = doc.sections.filter(
    (section): section is Extract<ReportSectionData, { kind: "kpis" }> =>
      section.kind === "kpis" && /coment[aá]rio|observa[cç][aã]o/i.test(section.title || ""),
  );
  const summaries = doc.sections.filter(
    (section): section is Extract<ReportSectionData, { kind: "kpis" }> =>
      section.kind === "kpis" && !noteSections.includes(section),
  );
  const contentSections = doc.sections.filter((section) => section.kind !== "kpis");
  const extractedNotes = noteSections.flatMap((section) => section.items.map((item) => item.value)).join("\n");

  let y = drawIdentification(pdf, doc);
  y = drawFilters(pdf, doc, y);
  y = drawSummary(pdf, summaries, y);
  contentSections.forEach((section) => {
    y = section.kind === "table" ? drawTable(pdf, section, y) : drawChart(pdf, section, y);
  });
  if (contentSections.length > 0) y = drawTotals(pdf, summaries, y);
  y = drawNotes(pdf, doc.notes || extractedNotes, y);
  void y;

  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    drawHeader(pdf, doc, logoSource);
    drawFooter(pdf, doc, page, totalPages);
  }

  return new Uint8Array(pdf.output("arraybuffer"));
};
