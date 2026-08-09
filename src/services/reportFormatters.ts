export type ReportFilePeriod = {
  startDate?: string;
  endDate?: string;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;

export const formatBrazilianDate = (value?: string | null): string => {
  if (!value) return "-";
  const dateMatch = value.match(ISO_DATE);
  if (dateMatch) return `${dateMatch[3]}/${dateMatch[2]}/${dateMatch[1]}`;
  const monthMatch = value.match(ISO_MONTH);
  if (monthMatch) return `${monthMatch[2]}/${monthMatch[1]}`;
  return value;
};

export const formatBrazilianDateTime = (
  value: string,
  timeZone?: string,
): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
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
  const periodLabel = (period.startDate || generatedAt).slice(0, 7);
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

