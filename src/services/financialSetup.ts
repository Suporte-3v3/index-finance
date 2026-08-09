import type { BankAccount, MasterDataOption, MasterDataType } from "../types";

export class FinancialSetupServiceError extends Error {}

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
    throw new FinancialSetupServiceError(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function fetchFinancialSetup() {
  return request<{ bankAccounts: BankAccount[]; masterData: MasterDataOption[] }>(
    "/api/financial-setup",
  );
}

export function createPersistedBankAccount(
  companyId: string,
  data: Omit<BankAccount, "id" | "companyId">,
) {
  return request<BankAccount>("/api/bank-accounts", {
    method: "POST",
    body: JSON.stringify({ ...data, companyId }),
  });
}

export function updatePersistedBankAccount(
  accountId: string,
  updates: Partial<Omit<BankAccount, "id" | "companyId" | "isBolsaAccount">>,
) {
  return request<BankAccount>(`/api/bank-accounts/${encodeURIComponent(accountId)}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deactivatePersistedBankAccount(accountId: string) {
  return request<void>(`/api/bank-accounts/${encodeURIComponent(accountId)}`, {
    method: "DELETE",
  });
}

export function ensurePersistedBolsaAccount(companyId: string) {
  return request<BankAccount>(
    `/api/bank-accounts/bolsa/${encodeURIComponent(companyId)}`,
    { method: "POST" },
  );
}

export function adjustPersistedBankBalance(
  accountId: string,
  delta: number,
  meta: { action: string; entityType: string; entityId: string },
) {
  return request<BankAccount>(
    `/api/bank-accounts/${encodeURIComponent(accountId)}/adjust-balance`,
    { method: "POST", body: JSON.stringify({ delta, meta }) },
  );
}

export function adjustPersistedBankBalances(
  movements: Array<{ accountId: string; delta: number }>,
  meta: { action: string; entityType: string; entityId: string },
) {
  return request<BankAccount[]>("/api/bank-accounts/batch-adjust", {
    method: "POST",
    body: JSON.stringify({ movements, meta }),
  });
}

export function createPersistedMasterData(
  companyId: string,
  type: MasterDataType,
  name: string,
  parentId?: string,
) {
  return request<MasterDataOption>("/api/master-data", {
    method: "POST",
    body: JSON.stringify({ companyId, type, name, parentId }),
  });
}

export function updatePersistedMasterData(
  itemId: string,
  updates: Partial<Pick<MasterDataOption, "name" | "parentId" | "active">>,
) {
  return request<MasterDataOption>(`/api/master-data/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deactivatePersistedMasterData(itemId: string) {
  return request<void>(`/api/master-data/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
  });
}
