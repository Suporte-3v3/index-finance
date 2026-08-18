import type { ReportRecord } from "../types";

export function hasDownloadableReportFile(report: ReportRecord) {
  return Boolean(report.fileContent || report.fileUrl);
}

export function persistedReportFileUrl(report: ReportRecord) {
  return report.fileContent ? undefined : report.fileUrl;
}
