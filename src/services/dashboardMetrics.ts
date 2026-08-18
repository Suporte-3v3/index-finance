import type { AccountPayable, AccountReceivable } from "../types";

export function isActiveDashboardPayable(
  item: Pick<AccountPayable, "status">,
) {
  return item.status !== "Cancelada";
}

export function isActiveDashboardReceivable(
  item: Pick<AccountReceivable, "status">,
) {
  return item.status !== "Cancelado";
}
