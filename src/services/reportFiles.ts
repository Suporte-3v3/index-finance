import { ReportExportFormat, ReportRecord } from "../types";
import { createIdexReportPdf, ReportOrientation } from "./idexReportTemplate";
import { buildReportFileBaseName } from "./reportFormatters";
import { createExcel } from "./reportExcel";

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
  reportType?: string;
  description?: string;
  companyName: string;
  companyCnpj?: string;
  companyLogoDataUrl?: string;
  filters: string;
  appliedFilters?: { label: string; value: string }[];
  period?: {
    startDate?: string;
    endDate?: string;
    dateBasis?: string;
    regime?: string;
  };
  generatedAt: string;
  generatedBy: string;
  notes?: string;
  orientation?: ReportOrientation;
  timeZone?: string;
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

export function createReportArtifact(
  doc: ReportDocumentData,
  format: ReportExportFormat,
): ReportArtifact {
  const baseName = buildReportFileBaseName(
    doc.reportType || doc.title,
    doc.companyName,
    doc.period || {},
    doc.generatedAt,
  );

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

  const bytes = createIdexReportPdf(doc);
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
