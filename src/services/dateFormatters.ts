const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const BRAZILIAN_DATE = /^(\d{2})[-/](\d{2})[-/](\d{4})$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;
const BRAZILIAN_MONTH = /^(\d{2})-(\d{4})$/;

function validIsoDate(yearText: string, monthText: string, dayText: string) {
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function brazilianDateToIso(value: string) {
  const match = BRAZILIAN_DATE.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  return validIsoDate(year, month, day) ? `${year}-${month}-${day}` : null;
}

export function isoDateToBrazilian(value?: string | null, fallback = "") {
  if (!value) return fallback;
  const match = ISO_DATE.exec(value.trim());
  if (!match || !validIsoDate(match[1], match[2], match[3])) return fallback;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function brazilianMonthToIso(value: string) {
  const match = BRAZILIAN_MONTH.exec(value.trim());
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 12) return null;
  return `${match[2]}-${match[1]}`;
}

export function isoMonthToBrazilian(value?: string | null, fallback = "") {
  if (!value) return fallback;
  const match = ISO_MONTH.exec(value.trim());
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return fallback;
  return `${match[2]}-${match[1]}`;
}

function dateParts(date: Date, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(timeZone ? { timeZone } : {}),
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("day")}-${part("month")}-${part("year")}`;
}

export function formatDate(
  value?: string | Date | null,
  options: { fallback?: string; timeZone?: string } = {},
) {
  const fallback = options.fallback ?? "-";
  if (!value) return fallback;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? fallback : dateParts(value, options.timeZone);
  }
  const trimmed = value.trim();
  const isoDate = ISO_DATE.exec(trimmed);
  if (isoDate && validIsoDate(isoDate[1], isoDate[2], isoDate[3])) {
    return `${isoDate[3]}-${isoDate[2]}-${isoDate[1]}`;
  }
  const brazilianDate = BRAZILIAN_DATE.exec(trimmed);
  if (brazilianDate && validIsoDate(brazilianDate[3], brazilianDate[2], brazilianDate[1])) {
    return `${brazilianDate[1]}-${brazilianDate[2]}-${brazilianDate[3]}`;
  }
  const month = ISO_MONTH.exec(trimmed);
  if (month && Number(month[2]) >= 1 && Number(month[2]) <= 12) {
    return `${month[2]}-${month[1]}`;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? trimmed : dateParts(parsed, options.timeZone);
}

export function formatDateTime(value?: string | Date | null, timeZone?: string) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
  return formatted.replace(/\//g, "-").replace(",", "");
}

export function maskBrazilianDate(value: string) {
  if (ISO_DATE.test(value)) return isoDateToBrazilian(value);
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

export function maskBrazilianMonth(value: string) {
  if (ISO_MONTH.test(value)) return isoMonthToBrazilian(value);
  const digits = value.replace(/\D/g, "").slice(0, 6);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}-${digits.slice(2)}`;
}
