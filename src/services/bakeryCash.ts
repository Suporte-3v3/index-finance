import type { BakeryExpense, BakeryPixSale, BakeryShift, BakeryWithdrawal } from "../types";

export class BakeryCashServiceError extends Error {}

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
    throw new BakeryCashServiceError(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface BakeryCashWorkspace {
  shifts: BakeryShift[];
  expenses: BakeryExpense[];
  withdrawals: BakeryWithdrawal[];
  pixSales: BakeryPixSale[];
}

export function fetchBakeryCash() {
  return request<BakeryCashWorkspace>("/api/bakery-cash");
}
export function openPersistedShift(data: Record<string, unknown>) {
  return request<BakeryShift>("/api/bakery-cash/shifts", { method: "POST", body: JSON.stringify(data) });
}
export function markPersistedShiftAwaitingClose(shiftId: string) {
  return request<BakeryShift>(`/api/bakery-cash/shifts/${encodeURIComponent(shiftId)}/await-close`, { method: "POST" });
}
export function cancelPersistedPendingClose(shiftId: string) {
  return request<BakeryShift>(`/api/bakery-cash/shifts/${encodeURIComponent(shiftId)}/cancel-pending-close`, { method: "POST" });
}
export function closePersistedShift(shiftId: string, data: Record<string, unknown>) {
  return request<BakeryShift>(`/api/bakery-cash/shifts/${encodeURIComponent(shiftId)}/close`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
export function reopenPersistedShift(shiftId: string, reason: string) {
  return request<BakeryShift>(`/api/bakery-cash/shifts/${encodeURIComponent(shiftId)}/reopen`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
export function cancelPersistedShift(shiftId: string) {
  return request<BakeryShift>(`/api/bakery-cash/shifts/${encodeURIComponent(shiftId)}/cancel`, { method: "POST" });
}
export function addPersistedExpense(data: Record<string, unknown>) {
  return request<BakeryExpense>("/api/bakery-cash/expenses", { method: "POST", body: JSON.stringify(data) });
}
export function cancelPersistedExpense(expenseId: string) {
  return request<BakeryExpense>(`/api/bakery-cash/expenses/${encodeURIComponent(expenseId)}/cancel`, { method: "POST" });
}
export function addPersistedWithdrawal(data: Record<string, unknown>) {
  return request<BakeryWithdrawal>("/api/bakery-cash/withdrawals", { method: "POST", body: JSON.stringify(data) });
}
export function cancelPersistedWithdrawal(withdrawalId: string) {
  return request<BakeryWithdrawal>(`/api/bakery-cash/withdrawals/${encodeURIComponent(withdrawalId)}/cancel`, { method: "POST" });
}
export function addPersistedPixSale(data: Record<string, unknown>) {
  return request<BakeryPixSale>("/api/bakery-cash/pix-sales", { method: "POST", body: JSON.stringify(data) });
}
export function cancelPersistedPixSale(pixSaleId: string) {
  return request<BakeryPixSale>(`/api/bakery-cash/pix-sales/${encodeURIComponent(pixSaleId)}/cancel`, { method: "POST" });
}
export function setPersistedPixReconciliationStatus(pixSaleId: string, status: string) {
  return request<BakeryPixSale>(`/api/bakery-cash/pix-sales/${encodeURIComponent(pixSaleId)}/reconciliation`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}
