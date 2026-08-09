/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import { getCompanyClientModules } from "../config/clientModules";
import {
  Card,
  SectionLabel,
  MetricCard,
  PeriodSelector,
  StatusBadge,
  Badge,
  Tooltip as InfoTooltip,
  Button,
  EmptyState,
} from "../components/ui";
import {
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Clock,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  ChevronRight,
  Plus,
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
import { ChartDefs, ChartTooltip, CHART_GRADIENT, CHART_SHADOW, CHART_LINE_SHADOW } from "../components/charts";

export default function DashboardView({
  onNavigate,
}: {
  onNavigate: (
    view: "payable" | "approvals" | "audit-logs" | "documents-received",
  ) => void;
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
      <Card>
        <EmptyState
          icon={<AlertCircle />}
          title="Nenhuma Empresa Ativa"
          description="Por favor, selecione uma empresa para visualizar o painel."
        />
      </Card>
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

  const canCreateLaunch = ["BPO_ADMIN", "BPO_TEAM"].includes(currentUser.role);

  return (
    <div id="client-dashboard-root" className="space-y-6">
      {/* Page header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <SectionLabel>Painel Financeiro</SectionLabel>
          <Badge tone="neutral">Tenant {activeCompany.tenantId}</Badge>
          <Badge tone="green" dot>
            Operacional {activeCompany.status}
          </Badge>
        </div>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-bold text-ink dark:text-ink-dark tracking-tight">
              Visão geral
            </h1>
            <p className="text-sm text-ink-soft dark:text-ink-soft-dark leading-relaxed">
              Acompanhe o fluxo de caixa, valide faturas e assine comprovantes de
              pagamento de {activeCompany.tradeName}. Todos os dados estão
              isolados e protegidos por criptografia em repouso.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PeriodSelector
              value={timeframe}
              onChange={(value) => value !== "custom" && setTimeframe(value)}
            />
            {canCreateLaunch && (
              <Button
                icon={<Plus className="h-4 w-4" />}
                onClick={() => onNavigate("documents-received")}
              >
                Novo lançamento
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <MetricCard
          id="kpi-card-balance"
          icon={<DollarSign strokeWidth={2.25} />}
          label="Saldo Disponível"
          value={`R$ ${totalBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          tone="navy"
          trend={
            balanceTrendPct !== null
              ? {
                  label: `${balanceTrendPct >= 0 ? "+" : ""}${balanceTrendPct.toFixed(1)}% em relação a 30 dias atrás`,
                  direction: balanceTrendPct >= 0 ? "up" : "down",
                  positive: balanceTrendPct >= 0,
                }
              : undefined
          }
          helpText={balanceTrendPct === null ? "Sem histórico suficiente para comparação" : undefined}
        />

        <MetricCard
          id="kpi-card-projected"
          icon={<TrendingUp strokeWidth={2.25} />}
          label="Saldo Projetado (30 dias)"
          value={`R$ ${forecastedBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          tone="gold"
          helpText="Considera entradas faturadas e saídas agendadas."
          tooltip={`Fórmula: Saldo Atual + Receber Pendente (R$ ${outstandingReceivables.toLocaleString("pt-BR")}) - Pagar Pendente (R$ ${outstandingPayables.toLocaleString("pt-BR")})`}
        />

        <Card id="kpi-card-flows" className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-brand-blue-50 text-brand-navy-900 dark:bg-brand-navy-700/20 dark:text-brand-navy-700/90">
              <RefreshCw className="h-4.5 w-4.5" strokeWidth={2.25} />
            </div>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft dark:text-ink-soft-dark">
            Movimentações Realizadas
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark block font-semibold uppercase">
                Entradas
              </span>
              <span className="text-sm font-bold text-brand-green-600 dark:text-emerald-400 flex items-center">
                <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />
                R$ {totalEntries.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark block font-semibold uppercase">
                Saídas
              </span>
              <span className="text-sm font-bold text-brand-red-600 dark:text-red-400 flex items-center">
                <ArrowDownRight className="h-3.5 w-3.5 mr-0.5" />
                R$ {totalExits.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
          <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark">
            Dados consolidados do mês de referência.
          </p>
        </Card>

        <MetricCard
          id="kpi-card-overdue"
          icon={<AlertCircle strokeWidth={2.25} />}
          label="Contas Vencidas (Pagar)"
          value={`R$ ${totalOverduePayables.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          tone={totalOverduePayables > 0 ? "red" : "neutral"}
          onClick={canOpenPayables ? () => onNavigate("payable") : undefined}
          helpText={canOpenPayables ? "Ver contas vencidas →" : undefined}
        />

        <MetricCard
          id="kpi-card-approvals"
          icon={<Clock strokeWidth={2.25} />}
          label="Aprovações Pendentes"
          value={`${pendingApprovalsCount} ${pendingApprovalsCount === 1 ? "pendência" : "pendências"}`}
          tone={pendingApprovalsCount > 0 ? "gold" : "neutral"}
          onClick={canOpenApprovals ? () => onNavigate("approvals") : undefined}
          helpText={canOpenApprovals ? "Acessar Central de Aprovações →" : undefined}
        />

        <MetricCard
          id="kpi-card-bpo-status"
          icon={<ShieldCheck strokeWidth={2.25} />}
          label="Segurança e Auditoria"
          value="Logs Ativos"
          tone="neutral"
          onClick={canOpenAuditLogs ? () => onNavigate("audit-logs") : undefined}
          helpText={
            canOpenAuditLogs
              ? "Consultar Logs de Auditoria →"
              : `Último acesso: ${companyLogs[0] ? new Date(companyLogs[0].timestamp).toLocaleTimeString() : "Agora"}`
          }
        />
      </div>

      {/* Main Charts Area & Action Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cash Flow Graphic */}
        <Card className="lg:col-span-2 space-y-4 shadow-md hover:shadow-lg transition-shadow">
          <div>
            <h3 className="text-sm font-bold text-ink dark:text-ink-dark uppercase tracking-wide">
              Evolução do Fluxo de Caixa
            </h3>
            <p className="text-xs text-ink-soft dark:text-ink-soft-dark">
              Entradas, saídas e projeção de saldo diário acumulado no período selecionado acima.
            </p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 10, bottom: 0, left: 10 }}
              >
                <ChartDefs />
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="currentColor"
                  className="text-line dark:text-line-dark"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#6F7687" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(val) =>
                    `R$ ${val >= 1000 ? (val / 1000).toFixed(0) + "k" : val}`
                  }
                  tick={{ fontSize: 10, fill: "#6F7687" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "#0B2C52", fillOpacity: 0.045 }}
                  content={<ChartTooltip />}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
                />
                <Bar
                  dataKey="Entradas"
                  fill={CHART_GRADIENT.green}
                  filter={CHART_SHADOW}
                  radius={[6, 6, 0, 0]}
                  barSize={16}
                />
                <Bar
                  dataKey="Saídas"
                  fill={CHART_GRADIENT.red}
                  filter={CHART_SHADOW}
                  radius={[6, 6, 0, 0]}
                  barSize={16}
                />
                <Line
                  type="monotone"
                  dataKey="Saldo"
                  stroke="#0B2C52"
                  strokeWidth={2.5}
                  dot={false}
                  filter={CHART_LINE_SHADOW}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Interactive Indicator Box */}
        <Card className="flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-line dark:border-line-dark pb-3">
              <h3 className="text-sm font-bold text-ink dark:text-ink-dark uppercase tracking-wide">
                Indicadores de Desempenho
              </h3>
              <Badge tone="neutral">LGPD OK</Badge>
            </div>

            {/* Indicator 1: Margem Bruta */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink dark:text-ink-dark font-semibold flex items-center gap-1.5">
                  Margem Bruta
                  <InfoTooltip content='Fórmula: (Faturamento - Custo de Mercadorias/Serviços) / Faturamento. Origem: Contas a Receber do mês atual x Contas a Pagar do mês de Categoria "Insumos" ou "Infraestrutura TI".' />
                </span>
                <span className="text-[11px] text-ink-soft dark:text-ink-soft-dark font-medium">
                  Ref: Mês Atual
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                {margemBruta !== null ? (
                  <>
                    <span className="text-lg font-bold text-ink dark:text-ink-dark">
                      {margemBruta.toFixed(1)}%
                    </span>
                    {margemBrutaTrendPp !== null ? (
                      <span
                        className={`text-[10px] font-semibold flex items-center ${margemBrutaTrendPp >= 0 ? "text-brand-green-600 dark:text-emerald-400" : "text-brand-red-600 dark:text-red-400"}`}
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
                      <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark">
                        Sem dado do mês anterior
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-ink-soft dark:text-ink-soft-dark italic">
                    Dados insuficientes para cálculo
                  </span>
                )}
              </div>
            </div>

            {/* Indicator 2: Taxa de Inadimplência */}
            <div className="space-y-1 pt-2 border-t border-line dark:border-line-dark">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink dark:text-ink-dark font-semibold flex items-center gap-1.5">
                  Inadimplência
                  <InfoTooltip content='Fórmula: Contas a Receber Vencidas / Total Faturamento Emitido. Origem: Recebíveis em status "Vencido".' />
                </span>
                <span className="text-[11px] text-ink-soft dark:text-ink-soft-dark font-medium">
                  Ref: Histórico
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                {inadimplenciaRate !== null ? (
                  <>
                    <span
                      className={`text-lg font-bold ${inadimplenciaRate > 5 ? "text-brand-red-600 dark:text-red-400" : "text-ink dark:text-ink-dark"}`}
                    >
                      {inadimplenciaRate.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark">
                      {inadimplenciaRate < 5
                        ? "Dentro da meta saudável (<5%)"
                        : "Acima da meta recomendada (<5%)"}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-ink-soft dark:text-ink-soft-dark italic">
                    Dados insuficientes
                  </span>
                )}
              </div>
            </div>

            {/* Indicator 3: Ticket Médio */}
            <div className="space-y-1 pt-2 border-t border-line dark:border-line-dark">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink dark:text-ink-dark font-semibold flex items-center gap-1.5">
                  Ticket Médio
                  <InfoTooltip content="Fórmula: Total de Recebíveis / Quantidade de Clientes Únicos. Origem: Faturamentos emitidos nos últimos 30 dias." />
                </span>
                <span className="text-[11px] text-ink-soft dark:text-ink-soft-dark font-medium">
                  Ref: 30 dias
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                {ticketMedio !== null ? (
                  <>
                    <span className="text-lg font-bold text-ink dark:text-ink-dark">
                      R$ {ticketMedio.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                    </span>
                    {ticketMedioTrendPct !== null ? (
                      <span
                        className={`text-[10px] font-semibold flex items-center ${ticketMedioTrendPct >= 0 ? "text-brand-green-600 dark:text-emerald-400" : "text-brand-red-600 dark:text-red-400"}`}
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
                      <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark">
                        Sem dado do período anterior
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-ink-soft dark:text-ink-soft-dark italic">
                    Sem dados suficientes
                  </span>
                )}
              </div>
            </div>

            {/* Indicator 4: Ciclo Financeiro */}
            <div className="space-y-1 pt-2 border-t border-line dark:border-line-dark">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink dark:text-ink-dark font-semibold flex items-center gap-1.5">
                  Ciclo Financeiro
                  <InfoTooltip content="Fórmula: Prazo Médio de Estocagem + Prazo Médio de Recebimento - Prazo Médio de Pagamento. Origem: recebimento e pagamento calculados a partir das datas reais de emissão e liquidação; estocagem é uma referência de mercado por segmento (não rastreada pelo sistema)." />
                </span>
                <span className="text-[11px] text-ink-soft dark:text-ink-soft-dark font-medium">
                  Geral
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                {cicloFinanceiroDays !== null ? (
                  <>
                    <span className="text-lg font-bold text-ink dark:text-ink-dark">
                      {cicloFinanceiroDays} dias
                    </span>
                    <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark font-medium">
                      Tempo médio de conversão
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-ink-soft dark:text-ink-soft-dark italic">
                    Dados insuficientes para cálculo
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-line dark:border-line-dark bg-canvas dark:bg-white/5 p-3 rounded-lg text-[10px] text-ink-soft dark:text-ink-soft-dark leading-snug flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-brand-gold-600 shrink-0 mt-0.5" />
            <span>
              Fórmulas e premissas validadas com a contabilidade externa
              regulada.
            </span>
          </div>
        </Card>
      </div>

      {/* Two Columns: Recent logs and Upcoming accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Next Vencimentos list */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b border-line dark:border-line-dark pb-3">
            <div>
              <h3 className="text-sm font-bold text-ink dark:text-ink-dark uppercase tracking-wide">
                Próximos Vencimentos
              </h3>
              <p className="text-xs text-ink-soft dark:text-ink-soft-dark">
                Contas que vencem nos próximos dias.
              </p>
            </div>
            {canOpenPayables && (
              <button
                onClick={() => onNavigate("payable")}
                className="text-xs font-bold text-ink dark:text-ink-dark hover:underline flex items-center gap-0.5 cursor-pointer shrink-0"
              >
                Ver Tudo <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {companyPayables
              .filter((ap) => ap.status !== "Paga" && ap.status !== "Cancelada")
              .slice(0, 4)
              .map((ap) => {
                const isOverdue = new Date(ap.dueDate) < new Date();
                return (
                  <div
                    key={ap.id}
                    className="flex items-center justify-between gap-3 p-3 bg-canvas dark:bg-white/5 rounded-lg border border-line/60 dark:border-line-dark hover:bg-canvas/70 dark:hover:bg-white/[0.07] transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${isOverdue ? "bg-brand-red-600" : "bg-brand-gold-600"}`}
                        />
                        <span className="text-xs font-semibold text-ink dark:text-ink-dark truncate max-w-37.5">
                          {ap.description}
                        </span>
                      </div>
                      <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark block font-medium truncate">
                        Favorecido: {ap.supplier} | Vencimento:{" "}
                        {new Date(ap.dueDate).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div className="text-right space-y-1 shrink-0">
                      <span className="text-xs font-bold text-ink dark:text-ink-dark block">
                        R${" "}
                        {ap.finalAmount.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                      <StatusBadge status={ap.status} />
                    </div>
                  </div>
                );
              })}
            {companyPayables.filter(
              (ap) => ap.status !== "Paga" && ap.status !== "Cancelada",
            ).length === 0 && (
              <p className="text-center text-xs text-ink-soft dark:text-ink-soft-dark py-6">
                Nenhum vencimento pendente.
              </p>
            )}
          </div>
        </Card>

        {/* Segunda coluna reservada para métricas de módulos futuros. */}
        <div aria-hidden="true" />
      </div>
    </div>
  );
}
