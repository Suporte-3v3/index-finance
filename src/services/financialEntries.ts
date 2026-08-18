import type { AccountPayable, AccountReceivable, Approval, BankAccount } from "../types";

export class FinancialEntriesServiceError extends Error {}

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
      // Mantém uma mensagem segura quando a resposta não é JSON.
    }
    throw new FinancialEntriesServiceError(message);
  }
  return (await response.json()) as T;
}

export function fetchFinancialEntries() {
  return request<{
    accountsPayable: AccountPayable[];
    accountsReceivable: AccountReceivable[];
    paymentApprovals: Approval[];
  }>("/api/financial-entries");
}

export function createPersistedPayables(
  companyId: string,
  data: Record<string, unknown>,
) {
  return request<{ payables: AccountPayable[]; approvals: Approval[] }>("/api/payables", {
    method: "POST",
    body: JSON.stringify({ ...data, companyId }),
  });
}

export function updatePersistedPayable(id: string, updates: Record<string, unknown>) {
  return request<AccountPayable>(`/api/payables/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function cancelPersistedPayable(id: string) {
  return request<AccountPayable>(`/api/payables/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    body: "{}",
  });
}

export function deletePersistedPayables(ids: string[]) {
  return request<{ deletedIds: string[]; deletedDocumentIds: string[] }>("/api/payables/batch-delete", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export function schedulePersistedPayable(id: string) {
  return request<AccountPayable>(`/api/payables/${encodeURIComponent(id)}/schedule`, {
    method: "POST",
    body: "{}",
  });
}

export function payPersistedPayable(
  id: string,
  data: Record<string, unknown>,
) {
  return request<{ payable: AccountPayable; bankAccount: BankAccount }>(
    `/api/payables/${encodeURIComponent(id)}/pay`,
    { method: "POST", body: JSON.stringify(data) },
  );
}

export function createPersistedReceivables(
  companyId: string,
  data: Record<string, unknown>,
) {
  return request<AccountReceivable[]>("/api/receivables", {
    method: "POST",
    body: JSON.stringify({ ...data, companyId }),
  });
}

export function updatePersistedReceivable(id: string, updates: Record<string, unknown>) {
  return request<AccountReceivable>(`/api/receivables/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function cancelPersistedReceivable(id: string) {
  return request<AccountReceivable>(`/api/receivables/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    body: "{}",
  });
}

export function deletePersistedReceivables(ids: string[]) {
  return request<{ deletedIds: string[]; deletedDocumentIds: string[] }>("/api/receivables/batch-delete", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export function receivePersistedReceivable(id: string, amount: number, date: string) {
  return request<{ receivable: AccountReceivable; bankAccount: BankAccount }>(
    `/api/receivables/${encodeURIComponent(id)}/receive`,
    { method: "POST", body: JSON.stringify({ amount, date }) },
  );
}

export function decidePersistedPaymentApproval(
  id: string,
  decision: "Aprovada" | "Rejeitada" | "Ajuste solicitado",
  comment: string,
) {
  return request<{ approval: Approval; payable: AccountPayable }>(
    `/api/payment-approvals/${encodeURIComponent(id)}/decision`,
    { method: "POST", body: JSON.stringify({ decision, comment }) },
  );
}
