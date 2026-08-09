import type { Notification } from "../types";

export class NotificationServiceError extends Error {}

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
    throw new NotificationServiceError(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function fetchNotifications() {
  return request<Notification[]>("/api/notifications");
}
export function markPersistedNotificationRead(id: string) {
  return request<Notification>(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
}
export function markAllPersistedNotificationsRead() {
  return request<Notification[]>("/api/notifications/read-all", { method: "POST" });
}
