import type { ReportRecord, ReportTemplate } from "../types";

export class ReportServiceError extends Error {}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let message = "Não foi possível concluir a operação.";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Resposta não estruturada.
    }
    throw new ReportServiceError(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function fetchReports() {
  return request<ReportRecord[]>("/api/reports");
}
export function createPersistedReport(data: Record<string, unknown>) {
  return request<ReportRecord>("/api/reports", { method: "POST", body: JSON.stringify(data) });
}
export function deletePersistedReport(id: string) {
  return request<void>(`/api/reports/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function fetchReportTemplates() {
  return request<ReportTemplate[]>("/api/report-templates");
}
export function createPersistedReportTemplate(data: Record<string, unknown>) {
  return request<ReportTemplate>("/api/report-templates", { method: "POST", body: JSON.stringify(data) });
}
export function updatePersistedReportTemplate(id: string, updates: Record<string, unknown>) {
  return request<ReportTemplate>(`/api/report-templates/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}
export function duplicatePersistedReportTemplate(id: string) {
  return request<ReportTemplate>(`/api/report-templates/${encodeURIComponent(id)}/duplicate`, { method: "POST" });
}
export function deletePersistedReportTemplate(id: string) {
  return request<void>(`/api/report-templates/${encodeURIComponent(id)}`, { method: "DELETE" });
}
