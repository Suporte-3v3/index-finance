/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { useBPOState } from "../../hooks/useBPOState";
import { useBakeryCashState } from "../../hooks/useBakeryCashState";
import { BakeryPixReconciliationStatus, BakeryShift } from "../../types";
import { computeShiftTotals, formatBRL } from "./calculations";
import { Badge, BadgeTone, Card, MetricCard, Modal } from "../../components/ui";
import { MetricTone } from "../../components/ui/MetricCard";
import {
  Store,
  Coins,
  QrCode,
  Wallet,
  Receipt,
  ArrowDownToLine,
  Landmark,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Filter,
  CreditCard,
} from "lucide-react";

const SHIFT_STATUS_OPTIONS: BakeryShift["status"][] = [
  "Aberto",
  "Aguardando fechamento",
  "Fechado",
  "Reaberto",
  "Cancelado",
];
const PIX_STATUS_OPTIONS: BakeryPixReconciliationStatus[] = [
  "Aguardando conciliação",
  "Conciliado",
  "Divergente",
];

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

const SHIFT_STATUS_TONE: Record<BakeryShift["status"], BadgeTone> = {
  Aberto: "green",
  Reaberto: "navy",
  "Aguardando fechamento": "gold",
  Fechado: "neutral",
  Cancelado: "red",
};

const PIX_STATUS_TONE: Record<BakeryPixReconciliationStatus, BadgeTone> = {
  "Aguardando conciliação": "gold",
  Conciliado: "green",
  Divergente: "red",
};

const FILTER_SELECT_CLASS =
  "text-xs font-semibold text-ink dark:text-ink-dark bg-canvas dark:bg-white/5 border border-line dark:border-line-dark rounded-lg px-2 py-1.5 dark:[color-scheme:dark]";

export default function AdminDashboard() {
  const { activeCompany, bankAccounts } = useBPOState();
  const bakery = useBakeryCashState();

  const todayIso = new Date().toISOString().slice(0, 10);
  const [dateFilter, setDateFilter] = useState(todayIso);
  const [registerFilter, setRegisterFilter] = useState("ALL");
  const [shiftLabelFilter, setShiftLabelFilter] = useState("ALL");
  const [operatorFilter, setOperatorFilter] = useState("ALL");
  const [bankFilter, setBankFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [pixStatusFilter, setPixStatusFilter] = useState("ALL");
  const [reopenTarget, setReopenTarget] = useState<BakeryShift | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [reopenError, setReopenError] = useState("");

  if (!activeCompany) return null;

  const companyShifts = bakery.shifts.filter(
    (shift) => shift.companyId === activeCompany.id,
  );
  const registers = bakery.getRegistersForCompany(activeCompany.id);
  const bolsa = bakery.getBolsaAccount(activeCompany.id);
  const pixBanks = bankAccounts.filter(
    (ba) => ba.companyId === activeCompany.id && !ba.isBolsaAccount,
  );

  const operators = Array.from(
    new Map(
      companyShifts.map((shift) => [shift.operatorId, shift.operatorName]),
    ),
  );
  const shiftLabels = Array.from(new Set(companyShifts.map((shift) => shift.shiftLabel)));

  const filteredShifts = companyShifts.filter((shift) => {
    if (dateFilter && shift.openedAt.slice(0, 10) !== dateFilter) return false;
    if (registerFilter !== "ALL" && shift.registerId !== registerFilter) return false;
    if (shiftLabelFilter !== "ALL" && shift.shiftLabel !== shiftLabelFilter) return false;
    if (operatorFilter !== "ALL" && shift.operatorId !== operatorFilter) return false;
    if (statusFilter !== "ALL" && shift.status !== statusFilter) return false;
    return true;
  });

  const shiftRows = useMemo(
    () =>
      filteredShifts
        .map((shift) => {
          const totals = computeShiftTotals(
            shift,
            bakery.expenses,
            bakery.withdrawals,
            bakery.pixSales,
          );
          return { shift, totals };
        })
        .sort(
          (a, b) =>
            new Date(b.shift.openedAt).getTime() - new Date(a.shift.openedAt).getTime(),
        ),
    [filteredShifts, bakery.expenses, bakery.withdrawals, bakery.pixSales],
  );

  const filteredShiftIds = new Set(filteredShifts.map((shift) => shift.id));
  const filteredPixSales = bakery.pixSales.filter((sale) => {
    if (!filteredShiftIds.has(sale.shiftId)) return false;
    if (bankFilter !== "ALL" && sale.bankAccountId !== bankFilter) return false;
    if (pixStatusFilter !== "ALL" && sale.reconciliationStatus !== pixStatusFilter)
      return false;
    return true;
  });

  const summary = shiftRows.reduce(
    (acc, { shift, totals }) => {
      acc.caixaExpenses += totals.caixaExpenses;
      acc.bolsaExpenses += totals.bolsaExpenses;
      acc.withdrawals += totals.withdrawalsTotal;
      if (shift.status === "Fechado") {
        acc.estimatedCash += shift.estimatedCashRevenue || 0;
        acc.cardMachine += shift.cardMachineTotal || 0;
      }
      return acc;
    },
    { caixaExpenses: 0, bolsaExpenses: 0, withdrawals: 0, estimatedCash: 0, cardMachine: 0 },
  );
  const pixTotalActive = filteredPixSales
    .filter((sale) => !sale.canceled)
    .reduce((sum, sale) => sum + sale.amount, 0);
  const totalRevenue = summary.estimatedCash + pixTotalActive + summary.cardMachine;

  const openRegisters = companyShifts.filter((shift) =>
    ["Aberto", "Reaberto"].includes(shift.status),
  ).length;
  const closedToday = filteredShifts.filter((shift) => shift.status === "Fechado").length;
  const awaitingClose = companyShifts.filter(
    (shift) => shift.status === "Aguardando fechamento",
  ).length;
  const pixByStatus = (status: BakeryPixReconciliationStatus) =>
    filteredPixSales.filter((sale) => !sale.canceled && sale.reconciliationStatus === status);

  const confirmReopen = () => {
    if (!reopenTarget) return;
    setReopenError("");
    const result = bakery.reopenShift({
      shiftId: reopenTarget.id,
      reason: reopenReason,
    });
    if (!result.success) setReopenError(result.error || "Não foi possível reabrir.");
    else {
      setReopenTarget(null);
      setReopenReason("");
    }
  };

  const cards: { icon: React.ReactNode; tone: MetricTone; label: string; value: string }[] = [
    { icon: <Coins className="h-4.5 w-4.5" />, tone: "green", label: "Receita em espécie", value: formatBRL(summary.estimatedCash) },
    { icon: <QrCode className="h-4.5 w-4.5" />, tone: "navy", label: "Vendas no PIX", value: formatBRL(pixTotalActive) },
    { icon: <CreditCard className="h-4.5 w-4.5" />, tone: "gold", label: "Vendas nas maquininhas", value: formatBRL(summary.cardMachine) },
    { icon: <Wallet className="h-4.5 w-4.5" />, tone: "navy", label: "Receita total", value: formatBRL(totalRevenue) },
    { icon: <Landmark className="h-4.5 w-4.5" />, tone: "gold", label: "Saldo atual da Bolsa", value: formatBRL(bolsa?.balance || 0) },
    { icon: <Receipt className="h-4.5 w-4.5" />, tone: "red", label: "Despesas do Caixa", value: formatBRL(summary.caixaExpenses) },
    { icon: <Receipt className="h-4.5 w-4.5" />, tone: "red", label: "Despesas da Bolsa", value: formatBRL(summary.bolsaExpenses) },
    { icon: <ArrowDownToLine className="h-4.5 w-4.5" />, tone: "neutral", label: "Sangrias", value: formatBRL(summary.withdrawals) },
    { icon: <Store className="h-4.5 w-4.5" />, tone: "neutral", label: "Caixas abertos", value: String(openRegisters) },
    { icon: <CheckCircle2 className="h-4.5 w-4.5" />, tone: "neutral", label: "Turnos fechados", value: String(closedToday) },
    { icon: <Clock className="h-4.5 w-4.5" />, tone: "gold", label: "Aguardando fechamento", value: String(awaitingClose) },
    { icon: <Clock className="h-4.5 w-4.5" />, tone: "gold", label: "PIX aguardando conciliação", value: String(pixByStatus("Aguardando conciliação").length) },
    { icon: <AlertTriangle className="h-4.5 w-4.5" />, tone: "red", label: "PIX divergente", value: String(pixByStatus("Divergente").length) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Store className="h-5 w-5 text-brand-navy-900 dark:text-brand-navy-700/90" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink dark:text-ink-dark tracking-tight">
            Caixa da Padaria — Visão administrativa
          </h1>
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark leading-relaxed">
            Turnos, despesas, sangrias e vendas no PIX de {activeCompany.tradeName}.
          </p>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {cards.map((card) => (
          <MetricCard
            key={card.label}
            icon={card.icon}
            label={card.label}
            value={card.value}
            tone={card.tone}
          />
        ))}
      </div>

      {/* Filters */}
      <Card className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-ink-soft dark:text-ink-soft-dark text-xs font-semibold pr-1">
          <Filter className="h-3.5 w-3.5" /> Filtros
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={(event) => setDateFilter(event.target.value)}
          className={FILTER_SELECT_CLASS}
        />
        <button
          onClick={() => setDateFilter("")}
          className="text-[11px] font-semibold text-ink-soft dark:text-ink-soft-dark hover:text-brand-navy-900 dark:hover:text-brand-navy-700/90 cursor-pointer"
        >
          (todas as datas)
        </button>
        <select
          value={registerFilter}
          onChange={(event) => setRegisterFilter(event.target.value)}
          className={FILTER_SELECT_CLASS}
        >
          <option value="ALL">Todos os caixas</option>
          {registers.map((register) => (
            <option key={register.id} value={register.id}>
              {register.name}
            </option>
          ))}
        </select>
        <select
          value={shiftLabelFilter}
          onChange={(event) => setShiftLabelFilter(event.target.value)}
          className={FILTER_SELECT_CLASS}
        >
          <option value="ALL">Todos os turnos</option>
          {shiftLabels.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={operatorFilter}
          onChange={(event) => setOperatorFilter(event.target.value)}
          className={FILTER_SELECT_CLASS}
        >
          <option value="ALL">Todas as operadoras</option>
          {operators.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={bankFilter}
          onChange={(event) => setBankFilter(event.target.value)}
          className={FILTER_SELECT_CLASS}
        >
          <option value="ALL">Todos os bancos (PIX)</option>
          {pixBanks.map((bank) => (
            <option key={bank.id} value={bank.id}>
              {bank.bankName}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className={FILTER_SELECT_CLASS}
        >
          <option value="ALL">Status do turno</option>
          {SHIFT_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          value={pixStatusFilter}
          onChange={(event) => setPixStatusFilter(event.target.value)}
          className={FILTER_SELECT_CLASS}
        >
          <option value="ALL">Status do PIX</option>
          {PIX_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </Card>

      {/* Shifts table */}
      <Card padding={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-canvas/70 dark:bg-white/[0.03] border-b border-line dark:border-line-dark text-left text-[10px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Caixa</th>
                <th className="px-4 py-3">Turno</th>
                <th className="px-4 py-3">Operadora</th>
                <th className="px-4 py-3 text-right">Saldo inicial</th>
                <th className="px-4 py-3 text-right">Desp. Caixa</th>
                <th className="px-4 py-3 text-right">Desp. Bolsa</th>
                <th className="px-4 py-3 text-right">Sangrias</th>
                <th className="px-4 py-3 text-right">PIX</th>
                <th className="px-4 py-3 text-right">Maquininhas</th>
                <th className="px-4 py-3 text-right">Saldo final</th>
                <th className="px-4 py-3 text-right">Receita espécie</th>
                <th className="px-4 py-3 text-right">Receita total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line dark:divide-line-dark">
              {shiftRows.map(({ shift, totals }) => (
                <tr
                  key={shift.id}
                  className="hover:bg-canvas/60 dark:hover:bg-white/[0.03] transition-colors"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-ink dark:text-ink-dark">
                    {new Date(shift.openedAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink dark:text-ink-dark">
                    {shift.registerName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink dark:text-ink-dark">
                    {shift.shiftLabel}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink dark:text-ink-dark">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-full bg-brand-navy-900 text-white text-[9px] font-semibold flex items-center justify-center shrink-0">
                        {getInitials(shift.operatorName)}
                      </span>
                      {shift.operatorName}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap text-ink dark:text-ink-dark">
                    <span className="inline-flex items-center gap-1 justify-end">
                      {formatBRL(shift.initialBalance)}
                      {shift.previousShiftFinalBalance !== undefined &&
                        shift.previousShiftFinalBalance !== shift.initialBalance && (
                          <span
                            title={`Diferente do saldo final do turno anterior (${formatBRL(shift.previousShiftFinalBalance)})${shift.initialBalanceJustification ? ` — ${shift.initialBalanceJustification}` : ""}`}
                          >
                            <AlertTriangle
                              aria-hidden="true"
                              className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 shrink-0"
                            />
                          </span>
                        )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap text-ink dark:text-ink-dark">
                    {formatBRL(totals.caixaExpenses)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap text-ink dark:text-ink-dark">
                    {formatBRL(totals.bolsaExpenses)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap text-ink dark:text-ink-dark">
                    {formatBRL(totals.withdrawalsTotal)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap text-ink dark:text-ink-dark">
                    {formatBRL(totals.pixTotal)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap text-ink dark:text-ink-dark">
                    {shift.status === "Fechado" ? formatBRL(totals.cardMachineTotal) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap text-ink dark:text-ink-dark">
                    {shift.finalBalanceCounted !== undefined
                      ? formatBRL(shift.finalBalanceCounted)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-brand-green-600 dark:text-emerald-400">
                    {shift.status === "Fechado" ? formatBRL(shift.estimatedCashRevenue || 0) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-ink dark:text-ink-dark">
                    {shift.status === "Fechado" ? formatBRL(shift.totalRevenue || 0) : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge tone={SHIFT_STATUS_TONE[shift.status]} dot>
                      {shift.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {shift.status === "Fechado" && (
                      <button
                        onClick={() => {
                          setReopenTarget(shift);
                          setReopenReason("");
                          setReopenError("");
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-navy-900 dark:text-brand-navy-700/90 hover:underline cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Reabrir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {shiftRows.length === 0 && (
                <tr>
                  <td
                    colSpan={15}
                    className="px-4 py-10 text-center text-ink-soft dark:text-ink-soft-dark italic"
                  >
                    Nenhum turno encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* PIX sales list with reconciliation controls */}
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line dark:border-line-dark">
          <h3 className="text-sm font-bold text-ink dark:text-ink-dark">
            Vendas no PIX
          </h3>
        </div>
        <div className="divide-y divide-line dark:divide-line-dark">
          {filteredPixSales.length === 0 && (
            <p className="px-4 py-8 text-center text-ink-soft dark:text-ink-soft-dark italic text-xs">
              Nenhuma venda no PIX encontrada com os filtros selecionados.
            </p>
          )}
          {filteredPixSales.map((sale) => (
            <div
              key={sale.id}
              className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 ${sale.canceled ? "opacity-50" : ""}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink dark:text-ink-dark">
                  {formatBRL(sale.amount)}{" "}
                  <span className="text-ink-soft dark:text-ink-soft-dark font-normal">
                    · {sale.bankAccountName} · {sale.createdByName}
                  </span>
                </p>
                <p className="text-[11px] text-ink-soft dark:text-ink-soft-dark">
                  {new Date(sale.createdAt).toLocaleString("pt-BR")}
                  {sale.customerName ? ` · ${sale.customerName}` : ""}
                  {sale.canceled ? " · Cancelada" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge tone={PIX_STATUS_TONE[sale.reconciliationStatus]} dot>
                  {sale.reconciliationStatus}
                </Badge>
                {!sale.canceled && (
                  <select
                    value={sale.reconciliationStatus}
                    onChange={(event) =>
                      bakery.setPixReconciliationStatus(
                        sale.id,
                        event.target.value as BakeryPixReconciliationStatus,
                      )
                    }
                    className="text-[11px] font-semibold text-ink dark:text-ink-dark bg-canvas dark:bg-white/5 border border-line dark:border-line-dark rounded-lg px-2 py-1 dark:[color-scheme:dark]"
                  >
                    {PIX_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Reopen modal */}
      <Modal
        open={Boolean(reopenTarget)}
        onClose={() => setReopenTarget(null)}
        title="Reabrir turno"
        size="sm"
        footer={
          <button
            onClick={confirmReopen}
            className="w-full bg-brand-red-600 hover:bg-brand-red-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer transition-colors"
          >
            Confirmar reabertura
          </button>
        }
      >
        {reopenTarget && (
          <div className="space-y-3 text-xs">
            <p className="text-ink dark:text-ink-dark">
              {reopenTarget.registerName} · {reopenTarget.shiftLabel} ·{" "}
              {reopenTarget.operatorName}
            </p>
            {reopenError && (
              <p className="text-brand-red-600 dark:text-red-400 font-semibold">
                {reopenError}
              </p>
            )}
            <label className="block space-y-1.5">
              <span className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide">
                Justificativa da reabertura
              </span>
              <textarea
                className="w-full bg-canvas dark:bg-white/5 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30 placeholder:text-ink-soft dark:placeholder:text-ink-soft-dark"
                rows={3}
                value={reopenReason}
                onChange={(event) => setReopenReason(event.target.value)}
                placeholder="Ex.: Operadora informou saldo final errado"
              />
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
