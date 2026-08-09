import type { SupportTicket } from "../types";

export class SupportTicketServiceError extends Error {}

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
    throw new SupportTicketServiceError(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function fetchSupportTickets() {
  return request<SupportTicket[]>("/api/support-tickets");
}
export function createPersistedSupportTicket(data: Record<string, unknown>) {
  return request<SupportTicket>("/api/support-tickets", { method: "POST", body: JSON.stringify(data) });
}
export function updatePersistedSupportTicket(id: string, updates: Record<string, unknown>) {
  return request<SupportTicket>(`/api/support-tickets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}
export function deletePersistedSupportTicket(id: string) {
  return request<void>(`/api/support-tickets/${encodeURIComponent(id)}`, { method: "DELETE" });
}
export function addPersistedSupportMessage(id: string, content: string, attachments?: unknown[]) {
  return request<{ ticket: SupportTicket; message: SupportTicket["messages"][number] }>(
    `/api/support-tickets/${encodeURIComponent(id)}/messages`,
    { method: "POST", body: JSON.stringify({ content, attachments }) },
  );
}
