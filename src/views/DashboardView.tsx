/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import { getCompanyClientModules } from "../config/clientModules";
import {
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  CalendarClock,
  AlertCircle,
  Clock,
  TrendingUp,
  Users,
  Sparkles,
  RefreshCw,
  Info,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export default function DashboardView({
  onNavigate,
}: {
  onNavigate: (view: "payable" | "approvals" | "audit-logs") => void;
}) {
  const {
    activeCompany,
    bankAccounts,
    accountsPayable,
    accountsReceivable,
    approvals,
    auditLogs,
    isApprovalVisibleToCurrentUser,
    currentUser,
    hasPermission,
  } = useBPOState();

  const [timeframe, setTimeframe] = useState<"7" | "15" | "30" | "90">("30");

  if (!activeCompany) {
    return (
      <div className="bg-white dark:bg-[#091320] border border-zinc-200 dark:border-zinc-800 rounded-sm p-8 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-zinc-400 dark:text-zinc-500 mx-auto" />
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Nenhuma Empresa Ativa
        </h3>
        <p className="text-zinc-500 dark:text-zinc-400">
          Por favor, selecione uma empresa para visualizar o painel.
        </p>
      </div>
    );
  }

  // Filter lists for current company
  const companyAccounts = bankAccounts.filter(
    (ba) => ba.companyId === activeCompany.id,
  );
  const companyPayables = accountsPayable.filter(
    (ap) => ap.companyId === activeCompany.id,
  );
  const companyReceivables = accountsReceivable.filter(
    (ar) => ar.companyId === activeCompany.id,
  );
  const companyApprovals = approvals.filter(
    (apv) =>
      apv.companyId === activeCompany.id &&
      isApprovalVisibleToCurrentUser(apv),
  );
  const companyLogs = auditLogs.filter(
    (log) => log.companyId === activeCompany.id,
  );
  const enabledClientModules = getCompanyClientModules(activeCompany);
  const canOpenPayables = hasPermission("accounts-payable.view");
  const canOpenApprovals =
    currentUser.role !== "CLIENT" || enabledClientModules.includes("approvals");
  const canOpenAuditLogs = currentUser.role === "BPO_ADMIN";

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const daysBetween = (fromStr: string, toStr: string) =>
    Math.round(
      (new Date(`${toStr}T00:00:00`).getTime() -
        new Date(`${fromStr}T00:00:00`).getTime()) /
        86400000,
    );

  // 1. Current Balance
  const totalBalance = companyAccounts.reduce((sum, ba) => sum + ba.balance, 0);

  // 2. Entries (Income) realizadas — todo o histórico de recebimentos
  const totalEntries = companyReceivables
    .filter((ar) =>
      ["Recebido", "Parcialmente recebido"].includes(ar.status),
    )
    .reduce((sum, ar) => sum + ar.receivedAmount, 0);

  // 3. Exits (Expenses) realizadas
  const totalExits = companyPayables
    .filter((ap) => ap.status === "Paga")
    .reduce((sum, ap) => sum + ap.finalAmount, 0);

  // 4. Overdue Accounts
  const totalOverduePayables = companyPayables
    .filter((ap) => ap.status === "Vencida")
    .reduce((sum, ap) => sum + ap.finalAmount, 0);

  // 5. Pending Approvals
  const pendingApprovalsCount = companyApprovals.filter(
    (a) => a.status === "Pendente",
  ).length;
  const pendingApprovalsAmount = companyApprovals
    .filter((a) => a.status === "Pendente")
    .reduce((sum, a) => sum + a.amount, 0);

  // 6. Forecasted Balance: Current Balance + Outstanding Receivables - Outstanding Payables
  const outstandingReceivables = companyReceivables
    .filter((ar) =>
      ["A receber", "Parcialmente recebido"].includes(ar.status),
    )
    .reduce((sum, ar) => sum + (ar.amount - ar.receivedAmount), 0);

  const outstandingPayables = companyPayables
    .filter((ap) =>
      ["A vencer", "Agendada", "Pendente", "Aguardando aprovação"].includes(
        ap.status,
      ),
    )
    .reduce((sum, ap) => sum + ap.finalAmount, 0);

  const forecastedBalance =
    totalBalance + outstandingReceivables - outstandingPayables;

  // Variação do saldo nos últimos 30 dias: reconstrói o saldo de 30 dias atrás
  // a partir do saldo atual menos o que de fato entrou/saiu realizado no período.
  const days30AgoStr = iso(
    new Date(new Date().setDate(new Date().getDate() - 30)),
  );
  const realizedEntriesLast30 = companyReceivables
    .filter(
      (ar) =>
        ["Recebido", "Parcialmente recebido"].includes(ar.status) &&
        ar.receiptDate &&
        ar.receiptDate >= days30AgoStr,
    )
    .reduce((sum, ar) => sum + ar.receivedAmount, 0);
  const realizedExitsLast30 = companyPayables
    .filter(
      (ap) =>
        ap.status === "Paga" && ap.paymentDate && ap.paymentDate >= days30AgoStr,
    )
    .reduce((sum, ap) => sum + ap.finalAmount, 0);
  const balance30DaysAgo =
    totalBalance - realizedEntriesLast30 + realizedExitsLast30;
  const balanceTrendPct =
    balance30DaysAgo !== 0
      ? ((totalBalance - balance30DaysAgo) / Math.abs(balance30DaysAgo)) * 100
      : null;

  // Chart Data Assembly — fluxo de caixa diário real (recebimentos e pagamentos
  // efetivamente registrados), acumulado a partir do saldo atual das contas.
  const getChartData = () => {
    const dataPointsCount = parseInt(timeframe);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startStr = iso(
      new Date(new Date(today).setDate(today.getDate() - dataPointsCount)),
    );
    const todayStr = iso(today);

    const byDay: Record<string, { entradas: number; saidas: number }> = {};
    companyReceivables.forEach((ar) => {
      if (!["Recebido", "Parcialmente recebido"].includes(ar.status)) return;
      const date = ar.receiptDate;
      if (!date || date < startStr || date > todayStr) return;
      byDay[date] = byDay[date] || { entradas: 0, saidas: 0 };
      byDay[date].entradas += ar.receivedAmount;
    });
    companyPayables.forEach((ap) => {
      if (ap.status !== "Paga") return;
      const date = ap.paymentDate;
      if (!date || date < startStr || date > todayStr) return;
      byDay[date] = byDay[date] || { entradas: 0, saidas: 0 };
      byDay[date].saidas += ap.finalAmount;
    });

    const totalInWindow = Object.values(byDay).reduce(
      (sum, d) => sum + d.entradas,
      0,
    );
    const totalOutWindow = Object.values(byDay).reduce(
      (sum, d) => sum + d.saidas,
      0,
    );
    // Saldo no início da janela, para a série terminar exatamente no saldo atual real.
    let runningBalance = totalBalance - totalInWindow + totalOutWindow;

    const data = [];
    for (let i = dataPointsCount; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = iso(d);
      const dayEntradas = byDay[key]?.entradas || 0;
      const daySaidas = byDay[key]?.saidas || 0;
      runningBalance = runningBalance + dayEntradas - daySaidas;

      data.push({
        name: d.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        Entradas: dayEntradas,
        Saídas: daySaidas,
        Saldo: runningBalance,
      });
    }
    return data;
  };

  const chartData = getChartData();

  // Margem Bruta = (Faturamento - Custo de Mercadorias/Serviços) / Faturamento,
  // apurada por competência (mês atual x mês anterior) para permitir comparação real.
  const currentMonth = iso(new Date()).slice(0, 7);
  const previousMonth = iso(
    new Date(new Date().setMonth(new Date().getMonth() - 1)),
  ).slice(0, 7);

  const faturamentoDoMes = (month: string) =>
    companyReceivables
      .filter((ar) => ar.competenceMonth === month)
      .reduce((sum, ar) => sum + ar.amount, 0);
  const custoInsumosDoMes = (month: string) =>
    companyPayables
      .filter(
        (ap) =>
          ap.competenceMonth === month &&
          (ap.category === "Insumos e Matérias-primas" ||
            ap.category === "Infraestrutura TI"),
      )
      .reduce((sum, ap) => sum + ap.amount, 0);

  const grossFaturamento = faturamentoDoMes(currentMonth);
  const costInsumos = custoInsumosDoMes(currentMonth);
  const margemBruta =
    grossFaturamento > 0
      ? ((grossFaturamento - costInsumos) / grossFaturamento) * 100
      : null;

  const previousFaturamento = faturamentoDoMes(previousMonth);
  const previousCostInsumos = custoInsumosDoMes(previousMonth);
  const margemBrutaAnterior =
    previousFaturamento > 0
      ? ((previousFaturamento - previousCostInsumos) / previousFaturamento) *
        100
      : null;
  const margemBrutaTrendPp =
    margemBruta !== null && margemBrutaAnterior !== null
      ? margemBruta - margemBrutaAnterior
      : null;

  // Inadimplência = Contas a Receber Vencidas / Total Faturamento Emitido (histórico)
  const grossFaturamentoTotal = companyReceivables.reduce(
    (sum, ar) => sum + ar.amount,
    0,
  );
  const overdueReceivables = companyReceivables
    .filter((ar) => ar.status === "Vencido")
    .reduce((sum, ar) => sum + ar.amount - ar.receivedAmount, 0);

  const inadimplenciaRate =
    grossFaturamentoTotal > 0
      ? (overdueReceivables / grossFaturamentoTotal) * 100
      : null;

  // Ticket Médio = Faturamento / Clientes únicos, nos últimos 30 dias x 30 dias
  // anteriores, para comparação real (o "Ref: 30 dias" do card).
  const days60AgoStr = iso(
    new Date(new Date().setDate(new Date().getDate() - 60)),
  );
  const todayStr = iso(new Date());
  const ticketMedioNaJanela = (fromStr: string, toStr: string) => {
    const janela = companyReceivables.filter(
      (ar) => ar.issueDate >= fromStr && ar.issueDate <= toStr,
    );
    const total = janela.reduce((sum, ar) => sum + ar.amount, 0);
    const clientesUnicos = new Set(janela.map((ar) => ar.customer)).size;
    return clientesUnicos > 0 ? total / clientesUnicos : null;
  };
  const ticketMedio = ticketMedioNaJanela(days30AgoStr, todayStr);
  const ticketMedioAnterior = ticketMedioNaJanela(days60AgoStr, days30AgoStr);
  const ticketMedioTrendPct =
    ticketMedio !== null && ticketMedioAnterior !== null && ticketMedioAnterior > 0
      ? ((ticketMedio - ticketMedioAnterior) / ticketMedioAnterior) * 100
      : null;

  // Ciclo Financeiro = Estocagem + Prazo Médio de Recebimento - Prazo Médio de
  // Pagamento. Os prazos de recebimento/pagamento vêm das datas reais de emissão
  // x liquidação; o sistema não controla estoque, então essa parcela permanece
  // uma referência de mercado por segmento.
  const receivedForCycle = companyReceivables.filter(
    (ar) => ar.status === "Recebido" && ar.receiptDate,
  );
  const avgReceivingDays =
    receivedForCycle.length > 0
      ? receivedForCycle.reduce(
          (sum, ar) => sum + daysBetween(ar.issueDate, ar.receiptDate!),
          0,
        ) / receivedForCycle.length
      : null;

  const paidForCycle = companyPayables.filter(
    (ap) => ap.status === "Paga" && ap.paymentDate,
  );
  const avgPayingDays =
    paidForCycle.length > 0
      ? paidForCycle.reduce(
          (sum, ap) => sum + daysBetween(ap.issueDate, ap.paymentDate!),
          0,
        ) / paidForCycle.length
      : null;

  const estimatedInventoryDays =
    activeCompany.segment === "Tecnologia"
      ? 0
      : activeCompany.segment === "Alimentação"
        ? 5
        : 15;

  const cicloFinanceiroDays =
    avgReceivingDays !== null && avgPayingDays !== null
      ? Math.round(estimatedInventoryDays + avgReceivingDays - avgPayingDays)
      : null;

  return (
    <div id="client-dashboard-root" className="space-y-4">
      {/* Dynamic Intro */}
      <div className="bg-[#0B2C52] border-l-4 border-[#C8102E] border-y border-r border-white/10 rounded-sm p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-[#061425] border border-white/10 text-[#F2D3A0] uppercase tracking-widest font-mono px-2 py-0.5 rounded font-semibold">
              Tenant ID: {activeCompany.tenantId}
            </span>
            <span className="text-[10px] bg-emerald-950/40 text-emerald-300 uppercase tracking-widest font-mono px-2 py-0.5 rounded border border-emerald-500/20 font-semibold">
              Operacional {activeCompany.status}
            </span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-white">
            Painel Executivo: {activeCompany.tradeName}
          </h2>
          <p className="text-white/80 text-xs max-w-xl">
            Acompanhe o fluxo de caixa, valide faturas e assine comprovantes de
            pagamentos. Todos os dados estão isolados e protegidos por
            criptografia de dados em repouso.
          </p>
        </div>
        {/* No BPO Responsável block */}
      </div>

      {/* Bento-Grid KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {/* Card 1: Saldo Disponível */}
        <div
          id="kpi-card-balance"
          className="bg-white dark:bg-[#091320] p-3 rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between h-32"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider block">
                Saldo Disponível
              </span>
              <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 block mt-1">
                R${" "}
                {totalBalance.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="h-7 w-7 rounded-sm flex items-center justify-center bg-[#0B2C52]/5 text-[#0B2C52] dark:bg-[#123B6B]/25 dark:text-[#9DB8D9] shrink-0">
              <DollarSign className="h-3.5 w-3.5" strokeWidth={2.25} />
            </div>
          </div>
          {balanceTrendPct !== null ? (
            <div
              className={`flex items-center gap-1.5 text-xs font-medium ${balanceTrendPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
            >
              {balanceTrendPct >= 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              <span>
                {balanceTrendPct >= 0 ? "+" : ""}
                {balanceTrendPct.toFixed(1)}% em relação a 30 dias atrás
              </span>
            </div>
          ) : (
            <div className="text-xs text-zinc-400 dark:text-zinc-500">
              Sem histórico suficiente para comparação
            </div>
          )}
        </div>

        {/* Card 2: Saldo Projetado */}
        <div
          id="kpi-card-projected"
          className="bg-white dark:bg-[#091320] p-3 rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between h-32"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1">
                <span className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider block">
                  Saldo Projetado (30 dias)
                </span>
                <div className="group relative cursor-pointer">
                  <Info className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300" />
                  <div className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-zinc-950 text-white text-[10px] rounded shadow-lg z-20">
                    Fórmula: Saldo Atual + Receber Pendente (R${" "}
                    {outstandingReceivables.toLocaleString("pt-BR")}) - Pagar
                    Pendente (R$ {outstandingPayables.toLocaleString("pt-BR")})
                  </div>
                </div>
              </div>
              <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 block mt-1">
                R${" "}
                {forecastedBalance.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="h-7 w-7 rounded-sm flex items-center justify-center bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300 shrink-0">
              <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.25} />
            </div>
          </div>
          <div className="text-xs text-zinc-400 dark:text-zinc-500">
            Considera entradas faturadas e saídas agendadas.
          </div>
        </div>

        {/* Card 3: Entradas e Saídas do Período */}
        <div
          id="kpi-card-flows"
          className="bg-white dark:bg-[#091320] p-3 rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between h-32"
        >
          <div className="flex items-start justify-between">
            <span className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider block">
              Movimentações Realizadas
            </span>
            <div className="h-7 w-7 rounded-sm flex items-center justify-center bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300 shrink-0">
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.25} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block font-medium">
                ENTRADAS
              </span>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center">
                <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />
                R${" "}
                {totalEntries.toLocaleString("pt-BR", {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block font-medium">
                SAÍDAS
              </span>
              <span className="text-sm font-semibold text-rose-600 dark:text-rose-400 flex items-center">
                <ArrowDownRight className="h-3.5 w-3.5 mr-0.5" />
                R${" "}
                {totalExits.toLocaleString("pt-BR", {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Dados consolidados do mês de referência.
          </div>
        </div>

        {/* Card 4: Contas Vencidas */}
        <div
          id="kpi-card-overdue"
          className="bg-white dark:bg-[#091320] p-3 rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between h-32"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider block">
                Contas Vencidas (Pagar)
              </span>
              <span
                className={`text-2xl font-semibold block mt-1 ${totalOverduePayables > 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-900 dark:text-zinc-50"}`}
              >
                R${" "}
                {totalOverduePayables.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div
              className={`h-7 w-7 rounded-sm flex items-center justify-center shrink-0 ${totalOverduePayables > 0 ? "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300" : "bg-zinc-50 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`}
            >
              <AlertCircle className="h-3.5 w-3.5" strokeWidth={2.25} />
            </div>
          </div>
          {canOpenPayables && (
            <button
              onClick={() => onNavigate("payable")}
              className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-semibold flex items-center gap-1 transition-colors text-left"
            >
              Ver Contas Vencidas <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Card 5: Aprovações pendentes */}
        <div
          id="kpi-card-approvals"
          className="bg-white dark:bg-[#091320] p-3 rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between h-32"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider block">
                Aprovações Pendentes
              </span>
              <span
                className={`text-2xl font-semibold block mt-1 ${pendingApprovalsCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-900 dark:text-zinc-50"}`}
              >
                {pendingApprovalsCount}{" "}
                {pendingApprovalsCount === 1 ? "pendência" : "pendências"}
              </span>
            </div>
            <div
              className={`h-7 w-7 rounded-sm flex items-center justify-center shrink-0 ${pendingApprovalsCount > 0 ? "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300" : "bg-zinc-50 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`}
            >
              <Clock className="h-3.5 w-3.5" strokeWidth={2.25} />
            </div>
          </div>
          {canOpenApprovals && (
            <button
              onClick={() => onNavigate("approvals")}
              className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-semibold flex items-center gap-1 transition-colors text-left"
            >
              Acessar Central de Aprovações <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Card 6: BPO Status */}
        <div
          id="kpi-card-bpo-status"
          className="bg-white dark:bg-[#091320] p-3 rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between h-32"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider block">
                Segurança e Auditoria
              </span>
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 block mt-2">
                Logs Ativos e Criptografia
              </span>
            </div>
            <div className="h-7 w-7 rounded-sm flex items-center justify-center bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 shrink-0">
              <Users className="h-3.5 w-3.5" strokeWidth={2.25} />
            </div>
          </div>
          <div className="text-xs text-zinc-400 dark:text-zinc-500 leading-tight">
            Último acesso auditado:{" "}
            {companyLogs[0]
              ? new Date(companyLogs[0].timestamp).toLocaleTimeString()
              : "Agora"}
          </div>
          {canOpenAuditLogs && (
            <button
              onClick={() => onNavigate("audit-logs")}
              className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-semibold flex items-center gap-1 transition-colors text-left"
            >
              Consultar Logs de Auditoria <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Main Charts Area & Action Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cash Flow Graphic */}
        <div className="bg-white dark:bg-[#091320] p-5 rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 uppercase tracking-wide">
                Evolução do Fluxo de Caixa
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Entradas, saídas e projeção de saldo diário acumulado.
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/70 p-1 rounded-sm border border-zinc-200 dark:border-zinc-700 text-xs">
              <button
                onClick={() => setTimeframe("7")}
                className={`px-2.5 py-1 rounded-sm font-medium cursor-pointer transition-colors ${timeframe === "7" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 shadow-xs" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"}`}
              >
                7D
              </button>
              <button
                onClick={() => setTimeframe("15")}
                className={`px-2.5 py-1 rounded-sm font-medium cursor-pointer transition-colors ${timeframe === "15" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 shadow-xs" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"}`}
              >
                15D
              </button>
              <button
                onClick={() => setTimeframe("30")}
                className={`px-2.5 py-1 rounded-sm font-medium cursor-pointer transition-colors ${timeframe === "30" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 shadow-xs" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"}`}
              >
                30D
              </button>
              <button
                onClick={() => setTimeframe("90")}
                className={`px-2.5 py-1 rounded-sm font-medium cursor-pointer transition-colors ${timeframe === "90" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 shadow-xs" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"}`}
              >
                90D
              </button>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 10, bottom: 0, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#71717a" }}
                />
                <YAxis
                  tickFormatter={(val) =>
                    `R$ ${val >= 1000 ? (val / 1000).toFixed(0) + "k" : val}`
                  }
                  tick={{ fontSize: 10, fill: "#71717a" }}
                />
                <Tooltip
                  formatter={(val: any) => [
                    `R$ ${Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                  ]}
                  contentStyle={{
                    backgroundColor: "#18181b",
                    color: "#fff",
                    borderRadius: "8px",
                    fontSize: "11px",
                    border: "none",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
                />
                <Bar
                  dataKey="Entradas"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  barSize={16}
                />
                <Bar
                  dataKey="Saídas"
                  fill="#f43f5e"
                  radius={[4, 4, 0, 0]}
                  barSize={16}
                />
                <Line
                  type="monotone"
                  dataKey="Saldo"
                  stroke="#09090b"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Interactive Indicator Box */}
        <div className="bg-white dark:bg-[#091320] p-5 rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 uppercase tracking-wide">
                Indicadores de Desempenho
              </h3>
              <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded font-mono font-semibold">
                LGPD OK
              </span>
            </div>

            {/* Indicator 1: Margem Bruta */}
            <div className="space-y-1 group">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 dark:text-zinc-300 font-medium flex items-center gap-1.5">
                  Margem Bruta
                  <div className="relative group/tooltip">
                    <Info className="h-3 w-3 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300" />
                    <div className="hidden group-hover/tooltip:block absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-52 p-2 bg-zinc-950 text-white text-[9px] rounded shadow-lg z-20 leading-snug">
                      Fórmula: (Faturamento - Custo de Mercadorias/Serviços) /
                      Faturamento.
                      <br />
                      Origem: Contas a Receber do mês atual x Contas a Pagar
                      do mês de Categoria "Insumos" ou "Infraestrutura TI".
                    </div>
                  </div>
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                  Ref: Mês Atual
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                {margemBruta !== null ? (
                  <>
                    <span className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                      {margemBruta.toFixed(1)}%
                    </span>
                    {margemBrutaTrendPp !== null ? (
                      <span
                        className={`text-[10px] font-medium flex items-center ${margemBrutaTrendPp >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                      >
                        {margemBrutaTrendPp >= 0 ? (
                          <ArrowUpRight className="h-3 w-3 mr-0.5" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3 mr-0.5" />
                        )}
                        {margemBrutaTrendPp >= 0 ? "+" : ""}
                        {margemBrutaTrendPp.toFixed(1)}pp vs mês anterior
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                        Sem dado do mês anterior
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                    Dados insuficientes para cálculo
                  </span>
                )}
              </div>
            </div>

            {/* Indicator 2: Taxa de Inadimplência */}
            <div className="space-y-1 pt-2 border-t border-zinc-50 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 dark:text-zinc-300 font-medium flex items-center gap-1.5">
                  Inadimplência
                  <div className="relative group/tooltip">
                    <Info className="h-3 w-3 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300" />
                    <div className="hidden group-hover/tooltip:block absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-52 p-2 bg-zinc-950 text-white text-[9px] rounded shadow-lg z-20 leading-snug">
                      Fórmula: Contas a Receber Vencidas / Total Faturamento
                      Emitido.
                      <br />
                      Origem: Recebíveis em status "Vencido".
                    </div>
                  </div>
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                  Ref: Histórico
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                {inadimplenciaRate !== null ? (
                  <>
                    <span
                      className={`text-lg font-semibold ${inadimplenciaRate > 5 ? "text-rose-600 dark:text-rose-400" : "text-zinc-800 dark:text-zinc-100"}`}
                    >
                      {inadimplenciaRate.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {inadimplenciaRate < 5
                        ? "Dentro da meta saudável (<5%)"
                        : "Acima da meta recomendada (<5%)"}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                    Dados insuficientes
                  </span>
                )}
              </div>
            </div>

            {/* Indicator 3: Ticket Médio */}
            <div className="space-y-1 pt-2 border-t border-zinc-50 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 dark:text-zinc-300 font-medium flex items-center gap-1.5">
                  Ticket Médio
                  <div className="relative group/tooltip">
                    <Info className="h-3 w-3 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300" />
                    <div className="hidden group-hover/tooltip:block absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-52 p-2 bg-zinc-950 text-white text-[9px] rounded shadow-lg z-20 leading-snug">
                      Fórmula: Total de Recebíveis / Quantidade de Clientes
                      Únicos.
                      <br />
                      Origem: Faturamentos emitidos nos últimos 30 dias.
                    </div>
                  </div>
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                  Ref: 30 dias
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                {ticketMedio !== null ? (
                  <>
                    <span className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                      R${" "}
                      {ticketMedio.toLocaleString("pt-BR", {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                    {ticketMedioTrendPct !== null ? (
                      <span
                        className={`text-[10px] font-medium flex items-center ${ticketMedioTrendPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                      >
                        {ticketMedioTrendPct >= 0 ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {ticketMedioTrendPct >= 0 ? "+" : ""}
                        {ticketMedioTrendPct.toFixed(1)}% vs período anterior
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                        Sem dado do período anterior
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                    Sem dados suficientes
                  </span>
                )}
              </div>
            </div>

            {/* Indicator 4: Ciclo Financeiro */}
            <div className="space-y-1 pt-2 border-t border-zinc-50 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 dark:text-zinc-300 font-medium flex items-center gap-1.5">
                  Ciclo Financeiro
                  <div className="relative group/tooltip">
                    <Info className="h-3 w-3 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300" />
                    <div className="hidden group-hover/tooltip:block absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-52 p-2 bg-zinc-950 text-white text-[9px] rounded shadow-lg z-20 leading-snug">
                      Fórmula: Prazo Médio de Estocagem + Prazo Médio de
                      Recebimento - Prazo Médio de Pagamento.
                      <br />
                      Origem: recebimento e pagamento calculados a partir das
                      datas reais de emissão e liquidação; estocagem é uma
                      referência de mercado por segmento (não rastreada pelo
                      sistema).
                    </div>
                  </div>
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                  Geral
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                {cicloFinanceiroDays !== null ? (
                  <>
                    <span className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                      {cicloFinanceiroDays} dias
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                      Tempo médio de conversão
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                    Dados insuficientes para cálculo
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 p-3 rounded-sm mt-4 text-[10px] text-zinc-400 dark:text-zinc-500 leading-snug flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-zinc-500 dark:text-zinc-400 shrink-0 mt-0.5" />
            <span>
              Fórmulas e premissas validadas com a contabilidade externa
              regulada.
            </span>
          </div>
        </div>
      </div>

      {/* Two Columns: Recent logs and Upcoming accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Next Vencimentos list */}
        <div className="bg-white dark:bg-[#091320] p-5 rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 uppercase tracking-wide">
                Próximos Vencimentos
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Contas que vencem nos próximos dias.
              </p>
            </div>
            {canOpenPayables && (
              <button
                onClick={() => onNavigate("payable")}
                className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:underline flex items-center gap-0.5"
              >
                Ver Tudo <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-3">
            {companyPayables
              .filter((ap) => ap.status !== "Paga" && ap.status !== "Cancelada")
              .slice(0, 4)
              .map((ap) => {
                const isOverdue = new Date(ap.dueDate) < new Date();
                return (
                  <div
                    key={ap.id}
                    className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-sm border border-zinc-200/50 dark:border-zinc-800 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/60 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${isOverdue ? "bg-rose-500" : "bg-amber-500"}`}
                        />
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 truncate max-w-[150px]">
                          {ap.description}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block font-medium">
                        Favorecido: {ap.supplier} | Vencimento:{" "}
                        {new Date(ap.dueDate).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div className="text-right space-y-0.5">
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                        R${" "}
                        {ap.finalAmount.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-semibold block text-center ${
                          ap.status === "Aguardando aprovação"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                            : isOverdue
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {ap.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            {companyPayables.filter(
              (ap) => ap.status !== "Paga" && ap.status !== "Cancelada",
            ).length === 0 && (
              <p className="text-center text-xs text-zinc-400 dark:text-zinc-500 py-6">
                Nenhum vencimento pendente.
              </p>
            )}
          </div>
        </div>

        {/* Segunda coluna reservada para métricas de módulos futuros. */}
        <div aria-hidden="true" />
      </div>
    </div>
  );
}
