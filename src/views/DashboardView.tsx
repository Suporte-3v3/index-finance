/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useBPOState } from "../hooks/useBPOState";
import { getCompanyClientModules } from "../config/clientModules";
import {
  isActiveDashboardPayable,
  isActiveDashboardReceivable,
} from "../services/dashboardMetrics";
import {
  Card,
  SectionLabel,
  MetricCard,
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
  Sparkles,
  Plus,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { ChartDefs, ChartTooltip, CHART_GRADIENT, CHART_SHADOW, CHART_LINE_SHADOW } from "../components/charts";
import FinancialCalendar, {
  FinancialCalendarEvent,
} from "../components/FinancialCalendar";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export default function DashboardView({
  onNavigate,
}: {
  onNavigate: (
    view:
      | "payable"
      | "receivable"
      | "approvals"
      | "audit-logs"
      | "documents-received",
  ) => void;
}) {
  const {
    activeCompany,
    bankAccounts,
    accountsPayable,
    accountsReceivable,
    approvals,
    isApprovalVisibleToCurrentUser,
    currentUser,
    hasPermission,
  } = useBPOState();

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
    (ap) => ap.companyId === activeCompany.id && isActiveDashboardPayable(ap),
  );
  const companyReceivables = accountsReceivable.filter(
    (ar) => ar.companyId === activeCompany.id && isActiveDashboardReceivable(ar),
  );
  const companyApprovals = approvals.filter(
    (apv) =>
      apv.companyId === activeCompany.id &&
      isApprovalVisibleToCurrentUser(apv),
  );
  const enabledClientModules = getCompanyClientModules(activeCompany);
  const canOpenPayables = hasPermission("accounts-payable.view");
  const canOpenReceivables = hasPermission("accounts-receivable.view");
  const canOpenApprovals =
    currentUser.role !== "CLIENT" || enabledClientModules.includes("approvals");

  const calendarEvents: FinancialCalendarEvent[] = [
    ...companyPayables
      .filter((payable) => payable.status !== "Cancelada")
      .map((payable) => ({
        id: payable.id,
        date: payable.dueDate,
        type: "payable" as const,
        title: payable.description,
        subtitle: payable.supplier,
        amount: payable.finalAmount,
        status: payable.status,
        actionable: canOpenPayables,
      })),
    ...companyReceivables
      .filter((receivable) => receivable.status !== "Cancelado")
      .map((receivable) => ({
        id: receivable.id,
        date: receivable.dueDate,
        type: "receivable" as const,
        title: receivable.description,
        subtitle: receivable.customer,
        amount:
          receivable.status === "Recebido"
            ? receivable.receivedAmount
            : Math.max(receivable.amount - receivable.receivedAmount, 0),
        status: receivable.status,
        actionable: canOpenReceivables,
      })),
    ...companyApprovals
      .filter((approval) => approval.status === "Pendente")
      .map((approval) => ({
        id: approval.id,
        date: approval.dueDateApproval || approval.dueDate,
        type: "approval" as const,
        title: approval.description,
        subtitle: `Solicitado por ${approval.requesterName}`,
        amount: approval.amount,
        status: approval.status,
        actionable: canOpenApprovals,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const daysBetween = (fromStr: string, toStr: string) =>
    Math.round(
      (new Date(`${toStr}T00:00:00`).getTime() -
        new Date(`${fromStr}T00:00:00`).getTime()) /
        86400000,
    );

  // 1. Current Balance
  const totalBalance = companyAccounts.reduce((sum, ba) => sum + ba.balance, 0);

  // Contas vencidas
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

  // Visão executiva dos últimos seis meses, baseada somente em liquidações
  // registradas. É mais estável e comparável que a antiga série diária.
  const monthlyMovementData = Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date();
    monthDate.setDate(1);
    monthDate.setMonth(monthDate.getMonth() - (5 - index));
    const key = iso(monthDate).slice(0, 7);

    const receipts = companyReceivables
      .filter(
        (receivable) =>
          receivable.receiptDate?.startsWith(key) &&
          ["Recebido", "Parcialmente recebido"].includes(receivable.status),
      )
      .reduce((sum, receivable) => sum + receivable.receivedAmount, 0);
    const payments = companyPayables
      .filter(
        (payable) =>
          payable.paymentDate?.startsWith(key) && payable.status === "Paga",
      )
      .reduce((sum, payable) => sum + payable.finalAmount, 0);

    return {
      name: monthDate
        .toLocaleDateString("pt-BR", { month: "short" })
        .replace(".", ""),
      Recebimentos: receipts,
      Pagamentos: payments,
    };
  });

  const financialCompositionData = [
    { name: "A receber", value: outstandingReceivables, color: "#15996F" },
    { name: "A pagar", value: outstandingPayables, color: "#C8102E" },
  ];
  const totalOpenCommitments = outstandingReceivables + outstandingPayables;

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          id="kpi-card-balance"
          className="shadow-[0_14px_32px_rgba(6,20,37,0.09)]"
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
          className="shadow-[0_14px_32px_rgba(6,20,37,0.09)]"
          icon={<TrendingUp strokeWidth={2.25} />}
          label="Saldo Projetado (30 dias)"
          value={`R$ ${forecastedBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          tone="gold"
          helpText="Considera entradas faturadas e saídas agendadas."
          tooltip={`Fórmula: Saldo Atual + Receber Pendente (R$ ${outstandingReceivables.toLocaleString("pt-BR")}) - Pagar Pendente (R$ ${outstandingPayables.toLocaleString("pt-BR")})`}
        />

        <MetricCard
          id="kpi-card-overdue"
          className="shadow-[0_14px_32px_rgba(6,20,37,0.09)]"
          icon={<AlertCircle strokeWidth={2.25} />}
          label="Contas Vencidas (Pagar)"
          value={`R$ ${totalOverduePayables.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          tone={totalOverduePayables > 0 ? "red" : "neutral"}
          onClick={canOpenPayables ? () => onNavigate("payable") : undefined}
          helpText={canOpenPayables ? "Ver contas vencidas →" : undefined}
        />

        <MetricCard
          id="kpi-card-approvals"
          className="shadow-[0_14px_32px_rgba(6,20,37,0.09)]"
          icon={<Clock strokeWidth={2.25} />}
          label="Aprovações Pendentes"
          value={`${pendingApprovalsCount} ${pendingApprovalsCount === 1 ? "pendência" : "pendências"}`}
          tone={pendingApprovalsCount > 0 ? "gold" : "neutral"}
          onClick={canOpenApprovals ? () => onNavigate("approvals") : undefined}
          helpText={canOpenApprovals ? "Acessar Central de Aprovações →" : undefined}
        />

      </div>

      {/* Dashboard executivo: gráficos à esquerda e agenda compacta à direita. */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(220px,0.72fr)_minmax(0,1.45fr)]">
            <Card className="idex-chart-card space-y-3">
              <div>
                <h3 className="text-sm font-bold text-ink dark:text-ink-dark">
                  Composição financeira
                </h3>
                <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark">
                  Compromissos atualmente em aberto.
                </p>
              </div>

              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <ChartDefs />
                    <Pie
                      data={financialCompositionData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={53}
                      outerRadius={76}
                      paddingAngle={4}
                      cornerRadius={8}
                      stroke="rgba(255,255,255,0.9)"
                      strokeWidth={3}
                      filter={CHART_SHADOW}
                    >
                      {financialCompositionData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <text
                      x="50%"
                      y="46%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-ink text-[9px] font-bold dark:fill-ink-dark"
                    >
                      EM ABERTO
                    </text>
                    <text
                      x="50%"
                      y="57%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-brand-navy-900 text-[8px] font-black dark:fill-brand-gold-300"
                    >
                      {formatCurrency(totalOpenCommitments)}
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-line pt-3 dark:border-line-dark">
                {financialCompositionData.map((item) => (
                  <div key={item.name} className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[9px] font-semibold text-ink-soft dark:text-ink-soft-dark">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </span>
                    <span className="block text-[10px] font-bold tabular-nums text-ink dark:text-ink-dark">
                      {formatCurrency(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="idex-chart-card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-ink dark:text-ink-dark">
                    Movimentação realizada
                  </h3>
                  <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark">
                    Recebimentos e pagamentos liquidados nos últimos 6 meses.
                  </p>
                </div>
                <Badge tone="neutral">6 meses</Badge>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={monthlyMovementData}
                    margin={{ top: 12, right: 8, bottom: 0, left: 0 }}
                  >
                    <ChartDefs />
                    <CartesianGrid strokeDasharray="4 4" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "#6F7687" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(value) => formatCurrency(Number(value))}
                      tick={{ fontSize: 8, fill: "#6F7687" }}
                      axisLine={false}
                      tickLine={false}
                      width={104}
                    />
                    <Tooltip
                      cursor={{ stroke: "#174E83", strokeOpacity: 0.15 }}
                      content={<ChartTooltip />}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={7}
                      wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Recebimentos"
                      stroke="#174E83"
                      strokeWidth={2.5}
                      fill={CHART_GRADIENT.areaNavy}
                      filter={CHART_LINE_SHADOW}
                      dot={false}
                      activeDot={{ r: 4, fill: "#174E83", stroke: "#fff", strokeWidth: 2 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Pagamentos"
                      stroke="#E7B967"
                      strokeWidth={2.5}
                      fill={CHART_GRADIENT.areaGold}
                      filter={CHART_LINE_SHADOW}
                      dot={false}
                      activeDot={{ r: 4, fill: "#E7B967", stroke: "#fff", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Interactive Indicator Box */}
          <Card className="idex-chart-card flex flex-col justify-between">
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
              <div className="flex flex-wrap items-baseline gap-2">
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
                    <span className="text-base font-bold tabular-nums text-ink dark:text-ink-dark sm:text-lg">
                      {formatCurrency(ticketMedio)}
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

        <FinancialCalendar
          key={activeCompany.id}
          events={calendarEvents}
          onEventClick={(event) => {
            if (event.type === "payable" && canOpenPayables) {
              onNavigate("payable");
            } else if (event.type === "receivable" && canOpenReceivables) {
              onNavigate("receivable");
            } else if (event.type === "approval" && canOpenApprovals) {
              onNavigate("approvals");
            }
          }}
        />
      </div>

    </div>
  );
}
