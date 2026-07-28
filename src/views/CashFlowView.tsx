/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import { downloadReportFile } from "../services/reportFiles";
import {
  BarChart3,
  TableProperties,
  Calendar,
  Filter,
  Download,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  TrendingUp,
  Briefcase,
  Layers,
  ArrowRight,
  Wallet,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export default function CashFlowView() {
  const {
    activeCompany,
    bankAccounts,
    accountsPayable,
    accountsReceivable,
    generateReport,
  } = useBPOState();

  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [periodType, setPeriodType] = useState<"daily" | "weekly" | "monthly">(
    "daily",
  );
  const [selectedAccount, setSelectedAccount] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>("ALL");
  const [periodRange, setPeriodRange] = useState<"7" | "15" | "30" | "MONTH" | "QUARTER" | "CUSTOM">("30");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  if (!activeCompany) return null;

  // Filters setup
  const accounts = bankAccounts.filter(
    (ba) => ba.companyId === activeCompany.id,
  );
  const inSelectedPeriod = (date: string) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(`${date}T12:00:00`);
    if (periodRange === "CUSTOM") return (!customStart || date >= customStart) && (!customEnd || date <= customEnd);
    if (periodRange === "MONTH") return date.slice(0, 7) === today.toISOString().slice(0, 7);
    const days = periodRange === "QUARTER" ? 90 : Number(periodRange);
    const start = new Date(today); start.setDate(start.getDate() - days);
    const limit = new Date(today); limit.setDate(limit.getDate() + days);
    return target >= start && target <= limit;
  };
  const payables = accountsPayable.filter(
    (ap) => ap.companyId === activeCompany.id && ap.status !== "Cancelada" && inSelectedPeriod(ap.paymentDate || ap.dueDate),
  );
  const receivables = accountsReceivable.filter(
    (ar) =>
      ar.companyId === activeCompany.id &&
      ar.status !== "Cancelado" && inSelectedPeriod(ar.receiptDate || ar.dueDate),
  );

  const categories = Array.from(
    new Set([
      ...payables.map((p) => p.category),
      ...receivables.map((r) => r.category),
    ]),
  );

  const costCenters = Array.from(
    new Set([
      ...payables.map((p) => p.costCenter),
      ...receivables.map((r) => r.costCenter),
    ]),
  );

  // Sum active bank accounts balance
  const initialCash = accounts
    .filter((ba) => selectedAccount === "ALL" || ba.id === selectedAccount)
    .reduce((sum, ba) => sum + ba.balance, 0);

  // Filtros de conta/categoria/centro de custo, compartilhados entre a linha
  // do tempo e os gráficos de composição por categoria.
  const matchesExtraFilters = (item: {
    bankAccountId: string;
    category: string;
    costCenter: string;
  }) =>
    (selectedAccount === "ALL" || item.bankAccountId === selectedAccount) &&
    (selectedCategory === "ALL" || item.category === selectedCategory) &&
    (selectedCostCenter === "ALL" || item.costCenter === selectedCostCenter);

  // Compile flows chronologically
  const getTimelineData = () => {
    const data: Record<
      string,
      {
        date: string;
        incomingRealized: number;
        incomingProjected: number;
        outgoingRealized: number;
        outgoingProjected: number;
      }
    > = {};

    // Add receivables
    receivables.filter(matchesExtraFilters).forEach((ar) => {
      const date = ar.receiptDate || ar.dueDate;
      if (!data[date]) {
        data[date] = {
          date,
          incomingRealized: 0,
          incomingProjected: 0,
          outgoingRealized: 0,
          outgoingProjected: 0,
        };
      }

      // Recebimentos parciais já têm uma parte realizada (o que entrou) e
      // uma parte ainda prevista (o saldo em aberto) — as duas contam.
      if (ar.status === "Recebido" || ar.status === "Parcialmente recebido") {
        data[date].incomingRealized += ar.receivedAmount;
      }
      if (ar.status !== "Recebido") {
        data[date].incomingProjected += ar.amount - ar.receivedAmount;
      }
    });

    // Add payables
    payables.filter(matchesExtraFilters).forEach((ap) => {
      const date = ap.paymentDate || ap.dueDate;
      if (!data[date]) {
        data[date] = {
          date,
          incomingRealized: 0,
          incomingProjected: 0,
          outgoingRealized: 0,
          outgoingProjected: 0,
        };
      }

      // Idem para pagamentos parciais: o que já saiu é realizado, o
      // restante do valor final continua previsto — nunca o valor cheio nos dois.
      const paid = ap.paidAmount || 0;
      if (ap.status === "Paga" || ap.status === "Parcialmente paga") {
        data[date].outgoingRealized += paid || ap.finalAmount;
      }
      if (ap.status !== "Paga") {
        data[date].outgoingProjected += ap.finalAmount - paid;
      }
    });

    // Convert to sorted array
    const sortedDays = Object.keys(data).sort();
    let cumulativeBalance = initialCash;
    let cumulativeRealized = initialCash;

    return sortedDays.map((day) => {
      const item = data[day];
      const totalIn = item.incomingRealized + item.incomingProjected;
      const totalOut = item.outgoingRealized + item.outgoingProjected;
      cumulativeBalance = cumulativeBalance + totalIn - totalOut;
      cumulativeRealized =
        cumulativeRealized + item.incomingRealized - item.outgoingRealized;

      return {
        date: new Date(day).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        rawDate: day,
        "Entradas Realizadas": item.incomingRealized,
        "Entradas Previstas": item.incomingProjected,
        "Saídas Realizadas": item.outgoingRealized,
        "Saídas Previstas": item.outgoingProjected,
        "Saldo Acumulado": cumulativeBalance,
        "Saldo Realizado": cumulativeRealized,
        totalIn,
        totalOut,
      };
    });
  };

  const cashFlowTimeline = getTimelineData();
  const incomingProjected = cashFlowTimeline.reduce(
    (sum, item) => sum + item["Entradas Previstas"],
    0,
  );
  const outgoingProjected = cashFlowTimeline.reduce(
    (sum, item) => sum + item["Saídas Previstas"],
    0,
  );
  const incomingRealized = cashFlowTimeline.reduce(
    (sum, item) => sum + item["Entradas Realizadas"],
    0,
  );
  const outgoingRealized = cashFlowTimeline.reduce(
    (sum, item) => sum + item["Saídas Realizadas"],
    0,
  );
  const projectedBalance = initialCash + incomingProjected - outgoingProjected;

  // Composição por categoria (top 6 + "Outros"), para os gráficos de barras
  // horizontais de entradas e saídas do período filtrado.
  const buildCategoryBreakdown = <T,>(
    items: T[],
    amountOf: (item: T) => number,
    categoryOf: (item: T) => string,
  ) => {
    const totals: Record<string, number> = {};
    items.forEach((item) => {
      const category = categoryOf(item);
      totals[category] = (totals[category] || 0) + amountOf(item);
    });
    const sorted = Object.entries(totals)
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1]);
    const TOP_N = 6;
    const top = sorted
      .slice(0, TOP_N)
      .map(([category, value]) => ({ category, value }));
    const restTotal = sorted
      .slice(TOP_N)
      .reduce((sum, [, value]) => sum + value, 0);
    return restTotal > 0 ? [...top, { category: "Outros", value: restTotal }] : top;
  };

  const entradasPorCategoria = buildCategoryBreakdown(
    receivables.filter(matchesExtraFilters),
    (ar) => ar.amount,
    (ar) => ar.category,
  );
  const saidasPorCategoria = buildCategoryBreakdown(
    payables.filter(matchesExtraFilters),
    (ap) => ap.finalAmount,
    (ap) => ap.category,
  );

  // Aggregate monthly flows for table presentation
  const getGroupedPeriods = () => {
    // If weekly or monthly, group them
    if (periodType === "monthly") {
      const groups: Record<
        string,
        {
          period: string;
          inRealized: number;
          inProjected: number;
          outRealized: number;
          outProjected: number;
        }
      > = {};

      cashFlowTimeline.forEach((item) => {
        const monthYear = item.rawDate.substring(0, 7); // YYYY-MM
        if (!groups[monthYear]) {
          groups[monthYear] = {
            period: monthYear,
            inRealized: 0,
            inProjected: 0,
            outRealized: 0,
            outProjected: 0,
          };
        }
        groups[monthYear].inRealized += item["Entradas Realizadas"];
        groups[monthYear].inProjected += item["Entradas Previstas"];
        groups[monthYear].outRealized += item["Saídas Realizadas"];
        groups[monthYear].outProjected += item["Saídas Previstas"];
      });

      return Object.values(groups).sort((a, b) =>
        a.period.localeCompare(b.period),
      );
    }

    // Default daily items
    return cashFlowTimeline.map((item) => ({
      period: item.rawDate,
      inRealized: item["Entradas Realizadas"],
      inProjected: item["Entradas Previstas"],
      outRealized: item["Saídas Realizadas"],
      outProjected: item["Saídas Previstas"],
    }));
  };

  const tableRows = getGroupedPeriods();

  const handleExport = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let exportStart = customStart;
    let exportEnd = customEnd;
    if (periodRange === "MONTH") {
      exportStart = `${today.toISOString().slice(0, 7)}-01`;
      exportEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        .toISOString()
        .slice(0, 10);
    } else if (periodRange !== "CUSTOM") {
      const days = periodRange === "QUARTER" ? 90 : Number(periodRange);
      const start = new Date(today);
      start.setDate(start.getDate() - days);
      const end = new Date(today);
      end.setDate(end.getDate() + days);
      exportStart = start.toISOString().slice(0, 10);
      exportEnd = end.toISOString().slice(0, 10);
    }
    const filterSummary = `Período: ${exportStart || "início"} a ${exportEnd || "fim"} | Conta: ${selectedAccount}, Categoria: ${selectedCategory}, Centro de Custo: ${selectedCostCenter}`;
    const report = generateReport(
      `Fluxo de Caixa Realizado vs Projetado`,
      "Fluxo de Caixa",
      filterSummary,
      {
        format: "CSV",
        startDate: exportStart || undefined,
        endDate: exportEnd || undefined,
        bankAccountId:
          selectedAccount === "ALL" ? undefined : selectedAccount,
        category: selectedCategory === "ALL" ? undefined : selectedCategory,
        costCenter:
          selectedCostCenter === "ALL" ? undefined : selectedCostCenter,
      },
    );
    if (report) downloadReportFile(report);
  };

  return (
    <div id="cash-flow-root" className="space-y-4">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2
            id="cashflow-title"
            className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight font-sans"
          >
            Fluxo de Caixa Operacional
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs font-sans">
            Visão integrada das movimentações financeiras executadas e previsões
            futuras de caixa.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-sm border border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => setViewMode("chart")}
              className={`p-1.5 rounded-sm cursor-pointer transition-colors ${viewMode === "chart" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 shadow-xs" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"}`}
              title="Visualização em Gráfico"
            >
              <BarChart3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-sm cursor-pointer transition-colors ${viewMode === "table" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 shadow-xs" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"}`}
              title="Tabela de Fluxos"
            >
              <TableProperties className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-950 dark:text-zinc-100 bg-white dark:bg-[#091320] border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 px-3 py-2 rounded-sm transition-colors cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Multi-Filter Bar */}
      <div className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {/* Account selection */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
            Conta Bancária
          </label>
          <div className="relative">
            <Building2 className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
            <select
              className="w-full pl-8 pr-2 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 cursor-pointer dark:[color-scheme:dark]"
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
            >
              <option value="ALL">Todas as Contas</option>
              {accounts.map((ba) => (
                <option key={ba.id} value={ba.id}>
                  {ba.bankName} (Ag. {ba.agency})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category selection */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
            Categoria
          </label>
          <div className="relative">
            <Layers className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
            <select
              className="w-full pl-8 pr-2 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 cursor-pointer dark:[color-scheme:dark]"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="ALL">Todas as Categorias</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cost center selection */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
            Centro de Custo
          </label>
          <div className="relative">
            <Briefcase className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
            <select
              className="w-full pl-8 pr-2 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 cursor-pointer dark:[color-scheme:dark]"
              value={selectedCostCenter}
              onChange={(e) => setSelectedCostCenter(e.target.value)}
            >
              <option value="ALL">Todos os Centros</option>
              {costCenters.map((cc) => (
                <option key={cc} value={cc}>
                  {cc}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
            Período
          </label>
          <select
            value={periodRange}
            onChange={(event) => setPeriodRange(event.target.value as typeof periodRange)}
            className="w-full px-2 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm dark:[color-scheme:dark]"
          >
            <option value="7">7 dias</option>
            <option value="15">15 dias</option>
            <option value="30">30 dias</option>
            <option value="MONTH">Mês atual</option>
            <option value="QUARTER">Trimestre</option>
            <option value="CUSTOM">Personalizado</option>
          </select>
          {periodRange === "CUSTOM" && (
            <div className="flex gap-1">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-1/2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 rounded-sm px-1 text-[9px] dark:[color-scheme:dark]"
              />
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-1/2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 rounded-sm px-1 text-[9px] dark:[color-scheme:dark]"
              />
            </div>
          )}
        </div>

        {/* Temporal Grouping (available when viewing table) */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
            Agrupamento
          </label>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
            <select
              className="w-full pl-8 pr-2 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 cursor-pointer dark:[color-scheme:dark]"
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as any)}
            >
              <option value="daily">Visão Diária</option>
              <option value="monthly">Visão Mensal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Aggregate Overview for the chosen filters */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        <Metric label="Saldo atual" value={initialCash} tone="zinc" icon={Wallet} />
        <Metric
          label="Entradas previstas"
          value={incomingProjected}
          tone="emerald"
          icon={ArrowUpRight}
        />
        <Metric
          label="Saídas previstas"
          value={outgoingProjected}
          tone="rose"
          icon={ArrowDownRight}
        />
        <Metric label="Saldo projetado" value={projectedBalance} tone="blue" icon={TrendingUp} />
        <Metric
          label="Entradas realizadas"
          value={incomingRealized}
          tone="emerald"
          icon={ArrowUpRight}
        />
        <Metric
          label="Saídas realizadas"
          value={outgoingRealized}
          tone="rose"
          icon={ArrowDownRight}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-emerald-50/50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/25 p-4 rounded-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold uppercase tracking-wider">
              Entradas do Período
            </span>
            <span className="text-lg font-semibold text-emerald-800 dark:text-emerald-300 block">
              R${" "}
              {cashFlowTimeline
                .reduce(
                  (sum, item) =>
                    sum +
                    item["Entradas Realizadas"] +
                    item["Entradas Previstas"],
                  0,
                )
                .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium block">
              Total faturado + previsões
            </span>
          </div>
          <ArrowUpRight className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
        </div>

        <div className="bg-rose-50/50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/25 p-4 rounded-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-rose-700 dark:text-rose-300 font-semibold uppercase tracking-wider">
              Saídas do Período
            </span>
            <span className="text-lg font-semibold text-rose-800 dark:text-rose-300 block">
              R${" "}
              {cashFlowTimeline
                .reduce(
                  (sum, item) =>
                    sum + item["Saídas Realizadas"] + item["Saídas Previstas"],
                  0,
                )
                .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] text-rose-600 dark:text-rose-400 font-medium block">
              Total liquidado + agendamentos
            </span>
          </div>
          <ArrowDownRight className="h-6 w-6 text-rose-600 dark:text-rose-400 shrink-0" />
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 p-4 rounded-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-600 dark:text-zinc-400 font-semibold uppercase tracking-wider">
              Saldo Final Previsto
            </span>
            <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 block">
              R${" "}
              {(
                cashFlowTimeline[cashFlowTimeline.length - 1]?.[
                  "Saldo Acumulado"
                ] || initialCash
              ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-medium block">
              Projeção estimada de fechamento
            </span>
          </div>
          <TrendingUp className="h-6 w-6 text-zinc-600 dark:text-zinc-400 shrink-0" />
        </div>
      </div>

      {/* Main Mode Output */}
      {viewMode === "chart" ? (
        <div className="bg-white dark:bg-[#091320] p-5 rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider">
              Simulação do Fluxo de Caixa no Período
            </h3>
            <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium px-2 py-0.5 rounded">
              Filtros Aplicados
            </span>
          </div>

          {cashFlowTimeline.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 dark:text-zinc-500 text-xs italic border border-zinc-100 dark:border-zinc-800 border-dashed rounded-sm">
              Sem movimentações financeiras correspondentes para o filtro atual.
            </div>
          ) : (
            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={cashFlowTimeline}
                  margin={{ top: 10, right: 10, bottom: 0, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                  <XAxis
                    dataKey="date"
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
                    dataKey="Entradas Realizadas"
                    stackId="a"
                    fill="#10b981"
                  />
                  <Bar
                    dataKey="Entradas Previstas"
                    stackId="a"
                    fill="#a7f3d0"
                  />
                  <Bar dataKey="Saídas Realizadas" stackId="b" fill="#f43f5e" />
                  <Bar dataKey="Saídas Previstas" stackId="b" fill="#fecdd3" />
                  <Line
                    type="monotone"
                    dataKey="Saldo Acumulado"
                    stroke="#09090b"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-[#091320]/60 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="p-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Período / Data
                  </th>
                  <th className="p-4 text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider text-right">
                    Entradas Realizadas
                  </th>
                  <th className="p-4 text-xs font-semibold text-emerald-500 dark:text-emerald-300 uppercase tracking-wider text-right">
                    Entradas Previstas
                  </th>
                  <th className="p-4 text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider text-right">
                    Saídas Realizadas
                  </th>
                  <th className="p-4 text-xs font-semibold text-rose-400 dark:text-rose-300 uppercase tracking-wider text-right">
                    Saídas Previstas
                  </th>
                  <th className="p-4 text-xs font-semibold text-zinc-800 dark:text-zinc-100 uppercase tracking-wider text-right">
                    Resultado Período
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                {tableRows.map((row, idx) => {
                  const totalIn = row.inRealized + row.inProjected;
                  const totalOut = row.outRealized + row.outProjected;
                  const diff = totalIn - totalOut;

                  return (
                    <tr
                      key={row.period || idx}
                      className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors font-mono"
                    >
                      <td className="p-4 font-sans font-semibold text-zinc-900 dark:text-zinc-50">
                        {periodType === "monthly"
                          ? new Date(row.period + "-02").toLocaleDateString(
                              "pt-BR",
                              { month: "long", year: "numeric" },
                            )
                          : new Date(row.period).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                      </td>
                      <td className="p-4 text-emerald-700 dark:text-emerald-400 text-right font-medium">
                        R${" "}
                        {row.inRealized.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-4 text-emerald-500 dark:text-emerald-300 text-right">
                        R${" "}
                        {row.inProjected.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-4 text-rose-700 dark:text-rose-400 text-right font-medium">
                        R${" "}
                        {row.outRealized.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-4 text-rose-400 dark:text-rose-300 text-right">
                        R${" "}
                        {row.outProjected.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td
                        className={`p-4 text-right font-semibold ${diff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                      >
                        R${" "}
                        {diff.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  );
                })}
                {tableRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-8 text-center text-zinc-400 dark:text-zinc-500 italic"
                    >
                      Nenhum fluxo registrado para os filtros especificados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Gráficos complementares */}
      <div className="bg-white dark:bg-[#091320] p-5 rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider">
            Saldo Realizado x Saldo com Previsto
          </h3>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Compara o saldo já confirmado (recebido/pago) com o saldo somando
            também os lançamentos ainda previstos no período.
          </p>
        </div>
        {cashFlowTimeline.length === 0 ? (
          <div className="py-10 text-center text-zinc-400 dark:text-zinc-500 text-xs italic border border-zinc-100 dark:border-zinc-800 border-dashed rounded-sm">
            Sem movimentações financeiras correspondentes para o filtro atual.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={cashFlowTimeline}
                margin={{ top: 10, right: 10, bottom: 0, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} />
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
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                <Line
                  type="monotone"
                  dataKey="Saldo Realizado"
                  stroke="#09090b"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Saldo Acumulado"
                  stroke="#0B2C52"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#091320] p-5 rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider">
            Entradas por Categoria
          </h3>
          {entradasPorCategoria.length === 0 ? (
            <div className="py-10 text-center text-zinc-400 dark:text-zinc-500 text-xs italic border border-zinc-100 dark:border-zinc-800 border-dashed rounded-sm">
              Sem entradas para o filtro atual.
            </div>
          ) : (
            <div
              className="w-full"
              style={{ height: Math.max(entradasPorCategoria.length * 34, 90) }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={entradasPorCategoria}
                  layout="vertical"
                  margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f4f4f5"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(val) =>
                      `R$ ${val >= 1000 ? (val / 1000).toFixed(0) + "k" : val}`
                    }
                    tick={{ fontSize: 10, fill: "#71717a" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={130}
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
                  <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#091320] p-5 rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider">
            Saídas por Categoria
          </h3>
          {saidasPorCategoria.length === 0 ? (
            <div className="py-10 text-center text-zinc-400 dark:text-zinc-500 text-xs italic border border-zinc-100 dark:border-zinc-800 border-dashed rounded-sm">
              Sem saídas para o filtro atual.
            </div>
          ) : (
            <div
              className="w-full"
              style={{ height: Math.max(saidasPorCategoria.length * 34, 90) }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={saidasPorCategoria}
                  layout="vertical"
                  margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f4f4f5"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(val) =>
                      `R$ ${val >= 1000 ? (val / 1000).toFixed(0) + "k" : val}`
                    }
                    tick={{ fontSize: 10, fill: "#71717a" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={130}
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
                  <Bar dataKey="value" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "zinc" | "emerald" | "rose" | "blue";
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  const colors = {
    zinc: "text-zinc-800 dark:text-zinc-200",
    emerald: "text-emerald-700 dark:text-emerald-400",
    rose: "text-rose-700 dark:text-rose-400",
    blue: "text-blue-700 dark:text-blue-400",
  };
  const chipTones = {
    zinc: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    emerald:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
    blue: "bg-[#0B2C52]/5 text-[#0B2C52] dark:bg-[#123B6B]/25 dark:text-[#9DB8D9]",
  };
  return (
    <div className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 p-2.5 flex flex-col gap-2">
      <div
        className={`h-7 w-7 rounded-sm flex items-center justify-center ${chipTones[tone]}`}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      </div>
      <div>
        <p className="text-[9px] text-zinc-500 dark:text-zinc-400 font-semibold uppercase">
          {label}
        </p>
        <p className={`text-base font-semibold mt-0.5 ${colors[tone]}`}>
          R$ {value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
}
