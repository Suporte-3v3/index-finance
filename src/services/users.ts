import type { User, UserRole } from "../types";

export class UserServiceError extends Error {}

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
      // Mantém a mensagem segura para respostas não JSON.
    }
    throw new UserServiceError(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function fetchManagedUsers() {
  return request<{ users: User[] }>("/api/users");
}

export function createPersistedUser(user: Omit<User, "id">) {
  return request<{ user: User; temporaryPassword: string }>("/api/users", {
    method: "POST",
    body: JSON.stringify(user),
  });
}

export function updatePersistedUser(
  userId: string,
  updates: {
    name?: string;
    email?: string;
    title?: string;
    role?: UserRole;
    status?: "ACTIVE" | "INACTIVE";
    companies?: string[];
    permissions?: string[];
    clientOperator?: boolean;
  },
) {
  return request<User>(`/api/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deactivatePersistedUser(userId: string) {
  return request<void>(`/api/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

export function resetPersistedUserPassword(userId: string) {
  return request<{ temporaryPassword: string }>(
    `/api/users/${encodeURIComponent(userId)}/reset-password`,
    { method: "POST", body: "{}" },
  );
}
