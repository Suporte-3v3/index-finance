import type {
  BankAccount,
  Company,
  MasterDataOption,
  MasterDataType,
  Tenant,
} from "../types";

export class CompanyServiceError extends Error {}

export interface CompanyOnboardingPayload {
  initialBankAccount: Omit<BankAccount, "id" | "companyId">;
  masterData: Partial<Record<MasterDataType, string[]>>;
}

type CompanyCreatePayload = Omit<Company, "id" | "createdAt" | "status"> & {
  onboarding: CompanyOnboardingPayload;
};

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
    throw new CompanyServiceError(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function fetchCompanyWorkspace() {
  return request<{ companies: Company[]; tenants: Tenant[] }>("/api/companies");
}

export function createPersistedCompany(
  company: Omit<Company, "id" | "createdAt" | "status">,
  onboarding: CompanyOnboardingPayload,
) {
  return request<{
    company: Company;
    initialBankAccount: BankAccount;
    masterData: MasterDataOption[];
  }>("/api/companies", {
    method: "POST",
    body: JSON.stringify({ ...company, onboarding } satisfies CompanyCreatePayload),
  });
}

export function updatePersistedCompany(
  companyId: string,
  updates: Partial<Omit<Company, "id" | "createdAt" | "tenantId">>,
) {
  return request<Company>(`/api/companies/${encodeURIComponent(companyId)}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deactivatePersistedCompany(companyId: string) {
  return request<void>(`/api/companies/${encodeURIComponent(companyId)}`, {
    method: "DELETE",
  });
}
