import { formatDate, formatDateTime } from "./dateFormatters";

export type ReportFilePeriod = {
  startDate?: string;
  endDate?: string;
};

export const formatBrazilianDate = (value?: string | null): string => {
  return formatDate(value);
};

export const formatBrazilianDateTime = (
  value: string,
  timeZone?: string,
): string => {
  return formatDateTime(value, timeZone);
};

export const formatBrazilianCurrency = (value: number): string =>
  Number.isFinite(value)
    ? value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "-";

export const formatBrazilianPercent = (value: number): string =>
  Number.isFinite(value)
    ? `${value.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}%`
    : "-";

export const sanitizeFileNameSegment = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "relatorio";

export const buildReportFileBaseName = (
  reportType: string,
  companyName: string,
  period: ReportFilePeriod,
  generatedAt: string,
): string => {
  const periodLabel = formatDate((period.startDate || generatedAt).slice(0, 7));
  return [
    sanitizeFileNameSegment(reportType),
    sanitizeFileNameSegment(companyName),
    sanitizeFileNameSegment(periodLabel),
  ].join("_");
};

export const safeReportText = (value: unknown): string => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number" && !Number.isFinite(value)) return "-";
  const text = String(value).trim();
  if (!text || /^(undefined|null|nan)$/i.test(text)) return "-";
  return formatBrazilianDate(text);
};

