import type { BankStatementItem } from "../types";

export class ReconciliationServiceError extends Error {}

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
    throw new ReconciliationServiceError(message);
  }
  return (await response.json()) as T;
}

export function fetchStatementEntries() {
  return request<{ statementItems: Record<string, BankStatementItem[]> }>("/api/reconciliation");
}

export function importPersistedStatement(bankAccountId: string, entries: BankStatementItem[]) {
  return request<{ importedCount: number; items: BankStatementItem[] }>(
    `/api/reconciliation/${encodeURIComponent(bankAccountId)}/import`,
    { method: "POST", body: JSON.stringify({ entries }) },
  );
}

export function reconcilePersistedStatementItem(
  bankAccountId: string,
  statementItemId: string,
  financialRecordId: string,
  type: "A_PAGAR" | "A_RECEBER",
  notes: string,
) {
  return request<{ item: BankStatementItem; reconciliationId: string; partial: boolean }>(
    `/api/reconciliation/${encodeURIComponent(bankAccountId)}/items/${encodeURIComponent(statementItemId)}/reconcile`,
    { method: "POST", body: JSON.stringify({ financialRecordId, type, notes }) },
  );
}

export function autoReconcilePersistedStatements(bankAccountId: string) {
  return request<{ matchedCount: number; items: BankStatementItem[] }>(
    `/api/reconciliation/${encodeURIComponent(bankAccountId)}/auto`,
    { method: "POST" },
  );
}

export function ignorePersistedStatementItem(bankAccountId: string, statementItemId: string, reason: string) {
  return request<BankStatementItem>(
    `/api/reconciliation/${encodeURIComponent(bankAccountId)}/items/${encodeURIComponent(statementItemId)}/ignore`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}
