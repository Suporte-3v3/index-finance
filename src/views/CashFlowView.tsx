/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
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
      !["Cancelado", "Cancelada"].includes(ar.status) && inSelectedPeriod(ar.receiptDate || ar.dueDate),
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
    receivables.forEach((ar) => {
      // filters
      if (selectedAccount !== "ALL" && ar.bankAccountId !== selectedAccount)
        return;
      if (selectedCategory !== "ALL" && ar.category !== selectedCategory)
        return;
      if (selectedCostCenter !== "ALL" && ar.costCenter !== selectedCostCenter)
        return;

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

      if (ar.status === "Recebido" || ar.status === "Recebida") {
        data[date].incomingRealized += ar.receivedAmount;
      } else {
        data[date].incomingProjected += ar.amount - ar.receivedAmount;
      }
    });

    // Add payables
    payables.forEach((ap) => {
      // filters
      if (selectedAccount !== "ALL" && ap.bankAccountId !== selectedAccount)
        return;
      if (selectedCategory !== "ALL" && ap.category !== selectedCategory)
        return;
      if (selectedCostCenter !== "ALL" && ap.costCenter !== selectedCostCenter)
        return;

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

      if (ap.status === "Paga") {
        data[date].outgoingRealized += ap.finalAmount;
      } else {
        data[date].outgoingProjected += ap.finalAmount;
      }
    });

    // Convert to sorted array
    const sortedDays = Object.keys(data).sort();
    let cumulativeBalance = initialCash;

    return sortedDays.map((day) => {
      const item = data[day];
      const totalIn = item.incomingRealized + item.incomingProjected;
      const totalOut = item.outgoingRealized + item.outgoingProjected;
      cumulativeBalance = cumulativeBalance + totalIn - totalOut;

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
    const filterSummary = `Conta: ${selectedAccount}, Categoria: ${selectedCategory}, Centro de Custo: ${selectedCostCenter}`;
    generateReport(
      `Fluxo de Caixa Realizado vs Projetado`,
      "Fluxo de Caixa",
      filterSummary,
    );
  };

  return (
    <div id="cash-flow-root" className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2
            id="cashflow-title"
            className="text-xl font-bold text-zinc-900 tracking-tight"
          >
            Fluxo de Caixa Operacional
          </h2>
          <p className="text-zinc-500 text-xs">
            Visão integrada das movimentações financeiras executadas e previsões
            futuras de caixa.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex bg-zinc-100 p-1 rounded-lg border border-zinc-200">
            <button
              onClick={() => setViewMode("chart")}
              className={`p-1.5 rounded-md cursor-pointer transition-colors ${viewMode === "chart" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-900"}`}
              title="Visualização em Gráfico"
            >
              <BarChart3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-md cursor-pointer transition-colors ${viewMode === "table" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-900"}`}
              title="Tabela de Fluxos"
            >
              <TableProperties className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs font-bold text-zinc-950 bg-white border border-zinc-200 hover:bg-zinc-50 px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Multi-Filter Bar */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {/* Account selection */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
            Conta Bancária
          </label>
          <div className="relative">
            <Building2 className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <select
              className="w-full pl-8 pr-2 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 cursor-pointer"
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
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
            Categoria
          </label>
          <div className="relative">
            <Layers className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <select
              className="w-full pl-8 pr-2 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 cursor-pointer"
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
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
            Centro de Custo
          </label>
          <div className="relative">
            <Briefcase className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <select
              className="w-full pl-8 pr-2 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 cursor-pointer"
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

        <div className="space-y-1"><label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Período</label><select value={periodRange} onChange={event => setPeriodRange(event.target.value as typeof periodRange)} className="w-full px-2 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"><option value="7">7 dias</option><option value="15">15 dias</option><option value="30">30 dias</option><option value="MONTH">Mês atual</option><option value="QUARTER">Trimestre</option><option value="CUSTOM">Personalizado</option></select>{periodRange === "CUSTOM" && <div className="flex gap-1"><input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-1/2 border rounded px-1 text-[9px]" /><input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-1/2 border rounded px-1 text-[9px]" /></div>}</div>

        {/* Temporal Grouping (available when viewing table) */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
            Agrupamento
          </label>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <select
              className="w-full pl-8 pr-2 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 cursor-pointer"
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
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Metric label="Saldo atual" value={initialCash} tone="zinc" />
        <Metric
          label="Entradas previstas"
          value={incomingProjected}
          tone="emerald"
        />
        <Metric
          label="Saídas previstas"
          value={outgoingProjected}
          tone="rose"
        />
        <Metric label="Saldo projetado" value={projectedBalance} tone="blue" />
        <Metric
          label="Entradas realizadas"
          value={incomingRealized}
          tone="emerald"
        />
        <Metric
          label="Saídas realizadas"
          value={outgoingRealized}
          tone="rose"
        />
      </div>

      <div className="hidden">
        <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">
              Entradas do Período
            </span>
            <span className="text-lg font-bold text-emerald-800 block">
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
            <span className="text-[9px] text-emerald-600 font-medium block">
              Total faturado + previsões
            </span>
          </div>
          <ArrowUpRight className="h-6 w-6 text-emerald-600 shrink-0" />
        </div>

        <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-rose-700 font-bold uppercase tracking-wider">
              Saídas do Período
            </span>
            <span className="text-lg font-bold text-rose-800 block">
              R${" "}
              {cashFlowTimeline
                .reduce(
                  (sum, item) =>
                    sum + item["Saídas Realizadas"] + item["Saídas Previstas"],
                  0,
                )
                .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] text-rose-600 font-medium block">
              Total liquidado + agendamentos
            </span>
          </div>
          <ArrowDownRight className="h-6 w-6 text-rose-600 shrink-0" />
        </div>

        <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
              Saldo Final Previsto
            </span>
            <span className="text-lg font-bold text-zinc-900 block">
              R${" "}
              {(
                cashFlowTimeline[cashFlowTimeline.length - 1]?.[
                  "Saldo Acumulado"
                ] || initialCash
              ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] text-zinc-500 font-medium block">
              Projeção estimada de fechamento
            </span>
          </div>
          <TrendingUp className="h-6 w-6 text-zinc-600 shrink-0" />
        </div>
      </div>

      {/* Main Mode Output */}
      {viewMode === "chart" ? (
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
              Simulação do Fluxo de Caixa no Período
            </h3>
            <span className="text-[10px] bg-zinc-100 text-zinc-500 font-medium px-2 py-0.5 rounded">
              Filtros Aplicados
            </span>
          </div>

          {cashFlowTimeline.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 text-xs italic border border-zinc-100 border-dashed rounded-lg">
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
        <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Período / Data
                  </th>
                  <th className="p-4 text-xs font-bold text-emerald-700 uppercase tracking-wider text-right">
                    Entradas Realizadas
                  </th>
                  <th className="p-4 text-xs font-bold text-emerald-500 uppercase tracking-wider text-right">
                    Entradas Previstas
                  </th>
                  <th className="p-4 text-xs font-bold text-rose-700 uppercase tracking-wider text-right">
                    Saídas Realizadas
                  </th>
                  <th className="p-4 text-xs font-bold text-rose-400 uppercase tracking-wider text-right">
                    Saídas Previstas
                  </th>
                  <th className="p-4 text-xs font-bold text-zinc-800 uppercase tracking-wider text-right">
                    Resultado Período
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-xs">
                {tableRows.map((row, idx) => {
                  const totalIn = row.inRealized + row.inProjected;
                  const totalOut = row.outRealized + row.outProjected;
                  const diff = totalIn - totalOut;

                  return (
                    <tr
                      key={row.period || idx}
                      className="hover:bg-zinc-50/80 transition-colors font-mono"
                    >
                      <td className="p-4 font-sans font-semibold text-zinc-900">
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
                      <td className="p-4 text-emerald-700 text-right font-medium">
                        R${" "}
                        {row.inRealized.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-4 text-emerald-500 text-right">
                        R${" "}
                        {row.inProjected.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-4 text-rose-700 text-right font-medium">
                        R${" "}
                        {row.outRealized.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-4 text-rose-400 text-right">
                        R${" "}
                        {row.outProjected.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td
                        className={`p-4 text-right font-bold ${diff >= 0 ? "text-emerald-600" : "text-rose-600"}`}
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
                      className="p-8 text-center text-zinc-400 italic"
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
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "zinc" | "emerald" | "rose" | "blue";
}) {
  const colors = {
    zinc: "text-zinc-800",
    emerald: "text-emerald-700",
    rose: "text-rose-700",
    blue: "text-blue-700",
  };
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-3">
      <p className="text-[9px] text-zinc-500 font-bold uppercase">{label}</p>
      <p className={`text-base font-black mt-1 ${colors[tone]}`}>
        R$ {value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}
