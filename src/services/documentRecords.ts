import type { Approval, Document, User } from "../types";

export class DocumentRecordServiceError extends Error {}

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
    throw new DocumentRecordServiceError(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function fetchDocumentRecords() {
  return request<{
    documents: Document[];
    documentApprovals: Approval[];
    documentUsers: User[];
  }>(
    "/api/document-records",
  );
}

export function createPersistedDocument(data: Record<string, unknown>) {
  return request<{ document: Document; approval?: Approval }>("/api/document-records", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updatePersistedDocument(id: string, updates: Record<string, unknown>) {
  return request<Document>(`/api/document-records/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deletePersistedDocument(id: string) {
  return request<void>(`/api/document-records/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function deletePersistedDocuments(documentIds: string[]) {
  return request<{ deletedIds: string[] }>("/api/document-records/batch-delete", {
    method: "POST",
    body: JSON.stringify({ documentIds }),
  });
}

export function requestPersistedDocumentApproval(
  id: string,
  recipientId: string,
  updates: Record<string, unknown>,
) {
  return request<{ document: Document; approval: Approval }>(
    `/api/document-records/${encodeURIComponent(id)}/request-approval`,
    { method: "POST", body: JSON.stringify({ ...updates, recipientId }) },
  );
}

export function decidePersistedDocumentApproval(
  id: string,
  decision: "Aprovada" | "Rejeitada" | "Ajuste solicitado",
  comment: string,
) {
  return request<{ document: Document; approval: Approval }>(
    `/api/document-approvals/${encodeURIComponent(id)}/decision`,
    { method: "POST", body: JSON.stringify({ decision, comment }) },
  );
}
