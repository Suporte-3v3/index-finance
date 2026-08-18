import assert from "node:assert/strict";
import test from "node:test";
import {
  isActiveDashboardPayable,
  isActiveDashboardReceivable,
} from "./dashboardMetrics";

test("dashboard ignora contas canceladas em todas as métricas", () => {
  assert.equal(isActiveDashboardPayable({ status: "Cancelada" }), false);
  assert.equal(isActiveDashboardPayable({ status: "A vencer" }), true);
  assert.equal(isActiveDashboardReceivable({ status: "Cancelado" }), false);
  assert.equal(isActiveDashboardReceivable({ status: "A receber" }), true);
});
