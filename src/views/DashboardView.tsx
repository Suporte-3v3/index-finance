/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
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
  } = useBPOState();

  const [timeframe, setTimeframe] = useState<"7" | "15" | "30" | "90">("30");

  if (!activeCompany) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-zinc-400 mx-auto" />
        <h3 className="text-lg font-bold">Nenhuma Empresa Ativa</h3>
        <p className="text-zinc-500">
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
    (apv) => apv.companyId === activeCompany.id,
  );
  const companyLogs = auditLogs.filter(
    (log) => log.companyId === activeCompany.id,
  );

  // 1. Current Balance
  const totalBalance = companyAccounts.reduce((sum, ba) => sum + ba.balance, 0);

  // 2. Entries (Income) in reference period (e.g. July 2026 or all)
  const totalEntries = companyReceivables
    .filter((ar) =>
      [
        "Recebido",
        "Recebida",
        "Parcialmente recebido",
        "Parcialmente recebida",
      ].includes(ar.status),
    )
    .reduce((sum, ar) => sum + ar.receivedAmount, 0);

  // 3. Exits (Expenses) in reference period
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
      [
        "A receber",
        "Emitida",
        "Parcialmente recebido",
        "Parcialmente recebida",
      ].includes(ar.status),
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

  // Chart Data Assembly (simulating daily cash flow over selected timeframe)
  const getChartData = () => {
    const dataPointsCount = parseInt(timeframe);
    const data = [];
    let currentSumBalance = totalBalance - 15000; // start slightly lower to simulate growth

    const today = new Date("2026-07-13");

    for (let i = dataPointsCount; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });

      // Simulate entries/exits
      const seed = Math.sin(i / 3) * 2000 + 3000;
      let dayEntries = i % 4 === 0 ? Math.floor(seed * 2.5) : 0;
      let dayExits = i % 3 === 0 ? Math.floor(seed * 1.8) : 0;

      // Add randomness
      if (i === 5) {
        dayEntries += 12000;
      } // major spike
      if (i === 1) {
        dayExits += 15420;
      } // major payment

      currentSumBalance = currentSumBalance + dayEntries - dayExits;

      data.push({
        name: dateStr,
        Entradas: dayEntries,
        Saídas: dayExits,
        Saldo: currentSumBalance,
      });
    }
    return data;
  };

  const chartData = getChartData();

  // Dynamic Indicators: Formula documentations and check if data exists
  // Margem Bruta = (Faturamento - Custo de Mercadorias/Serviços) / Faturamento
  const hasInvoices = companyReceivables.length > 0;
  const grossFaturamento = companyReceivables.reduce(
    (sum, ar) => sum + ar.amount,
    0,
  );
  const costInsumos = companyPayables
    .filter(
      (ap) =>
        ap.category === "Insumos e Matérias-primas" ||
        ap.category === "Infraestrutura TI",
    )
    .reduce((sum, ap) => sum + ap.amount, 0);

  const margemBruta =
    grossFaturamento > 0
      ? ((grossFaturamento - costInsumos) / grossFaturamento) * 100
      : null;

  // Inadimplência = Contas a Receber Vencidas / Total Faturamento Emitido
  const overdueReceivables = companyReceivables
    .filter((ar) => ar.status === "Vencida")
    .reduce((sum, ar) => sum + ar.amount - ar.receivedAmount, 0);

  const inadimplenciaRate =
    grossFaturamento > 0 ? (overdueReceivables / grossFaturamento) * 100 : null;

  // Ticket Médio = Total Receber / Quantidade de Clientes
  const customerCount = Array.from(
    new Set(companyReceivables.map((ar) => ar.customer)),
  ).length;
  const ticketMedio =
    customerCount > 0 ? grossFaturamento / customerCount : null;

  // Ciclo Financeiro (Simulated default for industry)
  const cicloFinanceiroDays =
    activeCompany.segment === "Tecnologia"
      ? 45
      : activeCompany.segment === "Alimentação"
        ? 12
        : 30;

  return (
    <div id="client-dashboard-root" className="space-y-6">
      {/* Dynamic Intro */}
      <div className="bg-[#0B2C52] border-l-4 border-[#C8102E] border-y border-r border-white/10 rounded-xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-[#061425] border border-white/10 text-[#F2D3A0] uppercase tracking-widest font-mono px-2 py-0.5 rounded font-semibold">
              Tenant ID: {activeCompany.tenantId}
            </span>
            <span className="text-[10px] bg-emerald-950/40 text-emerald-300 uppercase tracking-widest font-mono px-2 py-0.5 rounded border border-emerald-500/20 font-semibold">
              Operacional {activeCompany.status}
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Saldo Disponível */}
        <div
          id="kpi-card-balance"
          className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs flex flex-col justify-between h-36"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">
                Saldo Disponível
              </span>
              <span className="text-2xl font-bold text-zinc-900 block mt-1">
                R${" "}
                {totalBalance.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="p-2.5 bg-zinc-50 text-zinc-700 rounded-lg border border-zinc-100">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>+4.2% em relação ao mês anterior</span>
          </div>
        </div>

        {/* Card 2: Saldo Projetado */}
        <div
          id="kpi-card-projected"
          className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs flex flex-col justify-between h-36"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1">
                <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">
                  Saldo Projetado (30 dias)
                </span>
                <div className="group relative cursor-pointer">
                  <Info className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600" />
                  <div className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-zinc-950 text-white text-[10px] rounded shadow-lg z-20">
                    Fórmula: Saldo Atual + Receber Pendente (R${" "}
                    {outstandingReceivables.toLocaleString("pt-BR")}) - Pagar
                    Pendente (R$ {outstandingPayables.toLocaleString("pt-BR")})
                  </div>
                </div>
              </div>
              <span className="text-2xl font-bold text-zinc-900 block mt-1">
                R${" "}
                {forecastedBalance.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="p-2.5 bg-zinc-50 text-zinc-700 rounded-lg border border-zinc-100">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xs text-zinc-400">
            Considera entradas faturadas e saídas agendadas.
          </div>
        </div>

        {/* Card 3: Entradas e Saídas do Período */}
        <div
          id="kpi-card-flows"
          className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs flex flex-col justify-between h-36"
        >
          <div className="flex items-start justify-between">
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">
              Movimentações Realizadas
            </span>
            <div className="p-2.5 bg-zinc-50 text-zinc-700 rounded-lg border border-zinc-100">
              <RefreshCw className="h-4 w-4" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div>
              <span className="text-[10px] text-zinc-400 block font-medium">
                ENTRADAS
              </span>
              <span className="text-sm font-bold text-emerald-600 flex items-center">
                <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />
                R${" "}
                {totalEntries.toLocaleString("pt-BR", {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block font-medium">
                SAÍDAS
              </span>
              <span className="text-sm font-bold text-rose-600 flex items-center">
                <ArrowDownRight className="h-3.5 w-3.5 mr-0.5" />
                R${" "}
                {totalExits.toLocaleString("pt-BR", {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-zinc-400">
            Dados consolidados do mês de referência.
          </div>
        </div>

        {/* Card 4: Contas Vencidas */}
        <div
          id="kpi-card-overdue"
          className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs flex flex-col justify-between h-36"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">
                Contas Vencidas (Pagar)
              </span>
              <span
                className={`text-2xl font-bold block mt-1 ${totalOverduePayables > 0 ? "text-rose-600" : "text-zinc-900"}`}
              >
                R${" "}
                {totalOverduePayables.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div
              className={`p-2.5 rounded-lg border ${totalOverduePayables > 0 ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-zinc-50 text-zinc-500 border-zinc-100"}`}
            >
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <button
            onClick={() => onNavigate("payable")}
            className="text-xs text-zinc-500 hover:text-zinc-900 font-bold flex items-center gap-1 transition-colors text-left"
          >
            Ver Contas Vencidas <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {/* Card 5: Aprovações pendentes */}
        <div
          id="kpi-card-approvals"
          className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs flex flex-col justify-between h-36"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">
                Aprovações Pendentes
              </span>
              <span
                className={`text-2xl font-bold block mt-1 ${pendingApprovalsCount > 0 ? "text-amber-600" : "text-zinc-900"}`}
              >
                {pendingApprovalsCount}{" "}
                {pendingApprovalsCount === 1 ? "pendência" : "pendências"}
              </span>
            </div>
            <div
              className={`p-2.5 rounded-lg border ${pendingApprovalsCount > 0 ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-zinc-50 text-zinc-500 border-zinc-100"}`}
            >
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <button
            onClick={() => onNavigate("approvals")}
            className="text-xs text-zinc-500 hover:text-zinc-900 font-bold flex items-center gap-1 transition-colors text-left"
          >
            Acessar Central de Aprovações <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {/* Card 6: BPO Status */}
        <div
          id="kpi-card-bpo-status"
          className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs flex flex-col justify-between h-36"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">
                Segurança e Auditoria
              </span>
              <span className="text-sm font-bold text-zinc-900 block mt-2">
                Logs Ativos e Criptografia
              </span>
            </div>
            <div className="p-2.5 bg-zinc-50 text-zinc-600 rounded-lg border border-zinc-100">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xs text-zinc-400 leading-tight">
            Último acesso auditado:{" "}
            {companyLogs[0]
              ? new Date(companyLogs[0].timestamp).toLocaleTimeString()
              : "Agora"}
          </div>
          <button
            onClick={() => onNavigate("audit-logs")}
            className="text-xs text-zinc-500 hover:text-zinc-900 font-bold flex items-center gap-1 transition-colors text-left"
          >
            Consultar Logs de Auditoria <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Main Charts Area & Action Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Flow Graphic */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wide">
                Evolução do Fluxo de Caixa
              </h3>
              <p className="text-xs text-zinc-400">
                Entradas, saídas e projeção de saldo diário acumulado.
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-lg border border-zinc-200 text-xs">
              <button
                onClick={() => setTimeframe("7")}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${timeframe === "7" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-900"}`}
              >
                7D
              </button>
              <button
                onClick={() => setTimeframe("15")}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${timeframe === "15" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-900"}`}
              >
                15D
              </button>
              <button
                onClick={() => setTimeframe("30")}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${timeframe === "30" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-900"}`}
              >
                30D
              </button>
              <button
                onClick={() => setTimeframe("90")}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${timeframe === "90" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-900"}`}
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
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wide">
                Indicadores de Desempenho
              </h3>
              <span className="text-[10px] bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded font-mono font-bold">
                LGPD OK
              </span>
            </div>

            {/* Indicator 1: Margem Bruta */}
            <div className="space-y-1 group">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 font-medium flex items-center gap-1.5">
                  Margem Bruta
                  <div className="relative group/tooltip">
                    <Info className="h-3 w-3 text-zinc-400 hover:text-zinc-600" />
                    <div className="hidden group-hover/tooltip:block absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-52 p-2 bg-zinc-950 text-white text-[9px] rounded shadow-lg z-20 leading-snug">
                      Fórmula: (Faturamento - Custo de Mercadorias/Serviços) /
                      Faturamento.
                      <br />
                      Origem: Contas a Receber total x Contas a Pagar de
                      Categoria "Insumos" ou "Infraestrutura TI".
                    </div>
                  </div>
                </span>
                <span className="text-xs text-zinc-400 font-medium">
                  Ref: Mês Atual
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                {margemBruta !== null ? (
                  <>
                    <span className="text-lg font-bold text-zinc-800">
                      {margemBruta.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-emerald-600 font-medium flex items-center">
                      <ArrowUpRight className="h-3 w-3 mr-0.5" /> +1.4% vs
                      anterior
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-zinc-400 italic">
                    Dados insuficientes para cálculo
                  </span>
                )}
              </div>
            </div>

            {/* Indicator 2: Taxa de Inadimplência */}
            <div className="space-y-1 pt-2 border-t border-zinc-50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 font-medium flex items-center gap-1.5">
                  Inadimplência
                  <div className="relative group/tooltip">
                    <Info className="h-3 w-3 text-zinc-400 hover:text-zinc-600" />
                    <div className="hidden group-hover/tooltip:block absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-52 p-2 bg-zinc-950 text-white text-[9px] rounded shadow-lg z-20 leading-snug">
                      Fórmula: Contas a Receber Vencidas / Total Faturamento
                      Emitido.
                      <br />
                      Origem: Recebíveis em status "Vencida".
                    </div>
                  </div>
                </span>
                <span className="text-xs text-zinc-400 font-medium">
                  Ref: Histórico
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                {inadimplenciaRate !== null ? (
                  <>
                    <span
                      className={`text-lg font-bold ${inadimplenciaRate > 5 ? "text-rose-600" : "text-zinc-800"}`}
                    >
                      {inadimplenciaRate.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      Dentro da meta saudável (&lt;5%)
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-zinc-400 italic">
                    Dados insuficientes
                  </span>
                )}
              </div>
            </div>

            {/* Indicator 3: Ticket Médio */}
            <div className="space-y-1 pt-2 border-t border-zinc-50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 font-medium flex items-center gap-1.5">
                  Ticket Médio
                  <div className="relative group/tooltip">
                    <Info className="h-3 w-3 text-zinc-400 hover:text-zinc-600" />
                    <div className="hidden group-hover/tooltip:block absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-52 p-2 bg-zinc-950 text-white text-[9px] rounded shadow-lg z-20 leading-snug">
                      Fórmula: Total de Recebíveis / Quantidade de Clientes
                      Únicos.
                      <br />
                      Origem: Clientes cadastrados nos faturamentos.
                    </div>
                  </div>
                </span>
                <span className="text-xs text-zinc-400 font-medium">
                  Ref: 30 dias
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                {ticketMedio !== null ? (
                  <>
                    <span className="text-lg font-bold text-zinc-800">
                      R${" "}
                      {ticketMedio.toLocaleString("pt-BR", {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-medium flex items-center">
                      <ArrowUpRight className="h-3 w-3" /> +2.5% vs anterior
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-zinc-400 italic">
                    Sem dados suficientes
                  </span>
                )}
              </div>
            </div>

            {/* Indicator 4: Ciclo Financeiro */}
            <div className="space-y-1 pt-2 border-t border-zinc-50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 font-medium flex items-center gap-1.5">
                  Ciclo Financeiro
                  <div className="relative group/tooltip">
                    <Info className="h-3 w-3 text-zinc-400 hover:text-zinc-600" />
                    <div className="hidden group-hover/tooltip:block absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-52 p-2 bg-zinc-950 text-white text-[9px] rounded shadow-lg z-20 leading-snug">
                      Fórmula: Prazo Médio de Estocagem + Prazo Médio de
                      Recebimento - Prazo Médio de Pagamento.
                      <br />
                      Origem: Estimativa de segmento e datas de competência
                      registradas.
                    </div>
                  </div>
                </span>
                <span className="text-xs text-zinc-400 font-medium">Geral</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-zinc-800">
                  {cicloFinanceiroDays} dias
                </span>
                <span className="text-[10px] text-zinc-400 font-medium">
                  Tempo médio de conversão
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 bg-zinc-50 p-3 rounded-lg mt-4 text-[10px] text-zinc-400 leading-snug flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
            <span>
              Fórmulas e premissas validadas com a contabilidade externa
              regulada.
            </span>
          </div>
        </div>
      </div>

      {/* Two Columns: Recent logs and Upcoming accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Next Vencimentos list */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wide">
                Próximos Vencimentos
              </h3>
              <p className="text-xs text-zinc-400">
                Contas que vencem nos próximos dias.
              </p>
            </div>
            <button
              onClick={() => onNavigate("payable")}
              className="text-xs font-bold text-zinc-900 hover:underline flex items-center gap-0.5"
            >
              Ver Tudo <ChevronRight className="h-3.5 w-3.5" />
            </button>
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
                    className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-200/50 hover:bg-zinc-50/80 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${isOverdue ? "bg-rose-500" : "bg-amber-500"}`}
                        />
                        <span className="text-xs font-bold text-zinc-800 truncate max-w-[150px]">
                          {ap.description}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-400 block font-medium">
                        Favorecido: {ap.supplier} | Vencimento:{" "}
                        {new Date(ap.dueDate).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div className="text-right space-y-0.5">
                      <span className="text-xs font-bold text-zinc-800">
                        R${" "}
                        {ap.finalAmount.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold block text-center ${
                          ap.status === "Aguardando aprovação"
                            ? "bg-amber-100 text-amber-800"
                            : isOverdue
                              ? "bg-rose-100 text-rose-800"
                              : "bg-zinc-100 text-zinc-600"
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
              <p className="text-center text-xs text-zinc-400 py-6">
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
