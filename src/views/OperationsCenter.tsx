/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  IconButton,
  MetricCard,
  SearchField,
  StatusBadge,
} from "../components/ui";
import { MetricTone } from "../components/ui/MetricCard";
import { Table, TableHead, TableBody, Tr, Th, Td } from "../components/ui/Table";
import {
  Building2,
  AlertCircle,
  Clock,
  ArrowRight,
  Filter,
  ArrowUpDown,
  CalendarDays,
  CalendarClock,
  FileText,
  FileWarning,
  UserCheck2,
  DollarSign,
  LayoutGrid,
  List,
  Eye,
  X,
  ArrowUpRight,
  ArrowDownRight,
  History,
  Wallet,
  Receipt,
  AlertTriangle,
  ClipboardCheck,
} from "lucide-react";

type ViewMode = "card" | "list";

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

const DRAWER_TONE_CHIP: Record<MetricTone, string> = {
  neutral: "bg-zinc-100 text-zinc-600 dark:bg-white/5 dark:text-ink-soft-dark",
  navy: "bg-brand-blue-50 text-brand-navy-900 dark:bg-brand-navy-700/20 dark:text-brand-navy-700/90",
  red: "bg-brand-red-50 text-brand-red-600 dark:bg-brand-red-600/15 dark:text-red-300",
  green:
    "bg-brand-green-50 text-brand-green-600 dark:bg-brand-green-600/15 dark:text-emerald-300",
  gold: "bg-brand-gold-300/25 text-amber-700 dark:bg-brand-gold-600/15 dark:text-brand-gold-300",
};

const OPS_DRAWER_VISUALS: { icon: typeof Wallet; tone: MetricTone }[] = [
  { icon: Wallet, tone: "navy" },
  { icon: ArrowUpRight, tone: "green" },
  { icon: Receipt, tone: "navy" },
  { icon: DollarSign, tone: "green" },
  { icon: CalendarClock, tone: "neutral" },
  { icon: AlertTriangle, tone: "red" },
  { icon: ClipboardCheck, tone: "gold" },
  { icon: FileWarning, tone: "neutral" },
];

export default function OperationsCenter({
  onEnterCompany,
}: {
  onEnterCompany: () => void;
}) {
  const {
    companies,
    bankAccounts,
    accountsPayable,
    accountsReceivable,
    approvals,
    documents,
    auditLogs,
    users,
    switchCompany,
    currentUser,
  } = useBPOState();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [segmentFilter, setSegmentFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<
    "name" | "balance" | "pending" | "overdue"
  >("name");
  const [referenceMonth, setReferenceMonth] = useState(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    try {
      return localStorage.getItem("bpo_saas_opsReferenceMonth") || currentMonth;
    } catch {
      return currentMonth;
    }
  });
  const [lastUpdated] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (
        (localStorage.getItem("bpo_saas_opsViewMode") as ViewMode) || "card"
      );
    } catch {
      return "card";
    }
  });

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem("bpo_saas_opsViewMode", mode);
    } catch {
      // ignore storage errors (e.g. private browsing)
    }
  };

  const changeReferenceMonth = (month: string) => {
    if (!month) return;
    setReferenceMonth(month);
    try {
      localStorage.setItem("bpo_saas_opsReferenceMonth", month);
    } catch {
      /* ignore storage errors */
    }
  };

  const referenceLabel = new Date(
    `${referenceMonth}-02T12:00:00`,
  ).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const [previewCompanyId, setPreviewCompanyId] = useState<string | null>(null);
  const previewCompany = previewCompanyId
    ? companies.find((c) => c.id === previewCompanyId) || null
    : null;

  // Find unique segments
  const segments = Array.from(new Set(companies.map((c) => c.segment)));

  // Helper to compute company finance stats
  const getCompanyStats = (companyId: string) => {
    const activeAccounts = bankAccounts.filter(
      (ba) => ba.companyId === companyId,
    );
    const balance = activeAccounts.reduce((sum, ba) => sum + ba.balance, 0);

    const payableList = accountsPayable.filter(
      (ap) =>
        ap.companyId === companyId && ap.competenceMonth === referenceMonth,
    );
    const receivableList = accountsReceivable.filter(
      (ar) =>
        ar.companyId === companyId && ar.competenceMonth === referenceMonth,
    );
    const companyDocuments = documents.filter(
      (doc) => doc.companyId === companyId,
    );
    const approvalList = approvals.filter((approval) => {
      if (approval.companyId !== companyId || approval.status !== "Pendente")
        return false;
      const relatedCompetence =
        approval.type === "DOCUMENTO"
          ? companyDocuments.find((doc) => doc.id === approval.relatedId)
              ?.competenceMonth
          : accountsPayable.find((account) => account.id === approval.relatedId)
              ?.competenceMonth;
      return relatedCompetence
        ? relatedCompetence === referenceMonth
        : approval.createdAt.slice(0, 7) === referenceMonth;
    });
    const docList = companyDocuments.filter(
      (doc) =>
        doc.status === "Aguardando Análise" &&
        doc.competenceMonth === referenceMonth,
    );

    const pendingPayables = payableList
      .filter((ap) =>
        ["A vencer", "Agendada", "Pendente", "Aguardando aprovação"].includes(
          ap.status,
        ),
      )
      .reduce((sum, ap) => sum + ap.finalAmount, 0);
    const overduePayables = payableList
      .filter((ap) => ap.status === "Vencida")
      .reduce((sum, ap) => sum + ap.finalAmount, 0);

    const pendingReceivables = receivableList
      .filter((ar) =>
        ["A receber", "Parcialmente recebido"].includes(ar.status),
      )
      .reduce((sum, ar) => sum + ar.amount - ar.receivedAmount, 0);
    const overdueReceivables = receivableList
      .filter((ar) => ar.status === "Vencido")
      .reduce((sum, ar) => sum + ar.amount - ar.receivedAmount, 0);

    // Fluxo de caixa: entradas recebidas x saídas pagas no período de referência
    const cashIn = receivableList
      .filter((ar) =>
        ["Recebido", "Parcialmente recebido"].includes(ar.status),
      )
      .reduce((sum, ar) => sum + ar.receivedAmount, 0);
    const cashOut = payableList
      .filter((ap) => ap.status === "Paga")
      .reduce((sum, ap) => sum + ap.finalAmount, 0);
    const netCashFlow = cashIn - cashOut;

    // Próximo vencimento em aberto
    const openPayables = payableList
      .filter(
        (ap) =>
          ap.status !== "Paga" &&
          ap.status !== "Cancelada" &&
          ap.status !== "Rejeitada",
      )
      .sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      );
    const nextDuePayable = openPayables[0] || null;

    // Contas a receber em aberto (ainda não totalmente recebidas nem canceladas)
    const openReceivablesCount = receivableList.filter(
      (ar) =>
        !["Recebido", "Cancelado"].includes(ar.status),
    ).length;

    // Última movimentação registrada (log de auditoria mais recente)
    const companyLogs = auditLogs
      .filter(
        (log) =>
          log.companyId === companyId &&
          log.timestamp.slice(0, 7) === referenceMonth,
      )
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
    const lastMovement = companyLogs[0] || null;

    const bpoResponsible = users.find(
      (u) =>
        u.id === companies.find((c) => c.id === companyId)?.bpoResponsibleId,
    );

    return {
      balance,
      pendingPayables,
      overduePayables,
      pendingReceivables,
      overdueReceivables,
      pendingApprovalsCount: approvalList.length,
      pendingDocsCount: docList.length,
      cashIn,
      cashOut,
      netCashFlow,
      openPayablesCount: openPayables.length,
      openReceivablesCount,
      nextDuePayable,
      lastMovement,
      bpoResponsibleName:
        bpoResponsible?.name.split(" (")[0] || "Não atribuído",
      upcomingPayables: openPayables.slice(0, 3),
    };
  };

  // Filter & sort companies
  const filteredCompanies = companies
    .filter((company) => {
      // BPO team user can only see companies assigned to them
      if (
        currentUser.role !== "BPO_ADMIN" &&
        currentUser.companies &&
        !currentUser.companies.includes(company.id)
      ) {
        return false;
      }

      const matchesSearch =
        company.tradeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.corporateName
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        company.cnpj.includes(searchTerm);

      const matchesStatus =
        statusFilter === "ALL" || company.status === statusFilter;
      const matchesSegment =
        segmentFilter === "ALL" || company.segment === segmentFilter;

      return matchesSearch && matchesStatus && matchesSegment;
    })
    .sort((a, b) => {
      const statsA = getCompanyStats(a.id);
      const statsB = getCompanyStats(b.id);

      if (sortBy === "name") {
        return a.tradeName.localeCompare(b.tradeName);
      } else if (sortBy === "balance") {
        return statsB.balance - statsA.balance;
      } else if (sortBy === "pending") {
        return statsB.pendingApprovalsCount - statsA.pendingApprovalsCount;
      } else if (sortBy === "overdue") {
        return statsB.overduePayables - statsA.overduePayables;
      }
      return 0;
    });

  // Calculate totals for summary cards
  const summaryTotals = filteredCompanies.reduce(
    (totals, company) => {
      const stats = getCompanyStats(company.id);
      return {
        totalBalance: totals.totalBalance + stats.balance,
        totalOverduePayables:
          totals.totalOverduePayables + stats.overduePayables,
        totalPendingApprovals:
          totals.totalPendingApprovals + stats.pendingApprovalsCount,
        totalPendingDocs: totals.totalPendingDocs + stats.pendingDocsCount,
      };
    },
    {
      totalBalance: 0,
      totalOverduePayables: 0,
      totalPendingApprovals: 0,
      totalPendingDocs: 0,
    },
  );

  const handleEnterCompany = (companyId: string) => {
    switchCompany(companyId);
    onEnterCompany();
  };

  const formatRelativeTime = (timestamp: string) => {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "agora mesmo";
    if (diffMin < 60) return `há ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `há ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `há ${diffDays}d`;
  };

  const formatCurrency = (value: number) =>
    `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div id="operations-center-root" className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1
            id="ops-title"
            className="text-2xl sm:text-3xl font-bold text-ink dark:text-ink-dark tracking-tight"
          >
            Centro de Operações BPO
          </h1>
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark leading-relaxed">
            Visão geral consolidada de saúde operacional e financeira de todos
            os clientes.
          </p>
        </div>
        <Card padding={false} className="px-3 py-2.5 space-y-1.5 shrink-0">
          <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-soft dark:text-ink-soft-dark">
            <CalendarDays className="h-3.5 w-3.5 text-brand-navy-900 dark:text-brand-navy-700/90" />
            Competência analisada
          </label>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={referenceMonth}
              onChange={(event) => changeReferenceMonth(event.target.value)}
              className="text-xs font-semibold text-ink dark:text-ink-dark bg-canvas dark:bg-white/5 border border-line dark:border-line-dark rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30 dark:[color-scheme:dark]"
            />
            <span className="text-xs capitalize hidden sm:inline text-ink-soft dark:text-ink-soft-dark">
              {referenceLabel}
            </span>
          </div>
          <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark font-mono">
            Posição consultada em {lastUpdated.toLocaleDateString("pt-BR")} às{" "}
            {lastUpdated.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </Card>
      </div>

      {/* Aggregate Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          id="ops-card-balance"
          icon={<DollarSign strokeWidth={2.25} />}
          label="Saldo Consolidado Atual"
          value={formatCurrency(summaryTotals.totalBalance)}
          tone="navy"
        />
        <MetricCard
          id="ops-card-overdue"
          icon={<AlertCircle strokeWidth={2.25} />}
          label="Contas Vencidas"
          value={formatCurrency(summaryTotals.totalOverduePayables)}
          tone="red"
        />
        <MetricCard
          id="ops-card-approvals"
          icon={<Clock strokeWidth={2.25} />}
          label="Aprovações Pendentes"
          value={String(summaryTotals.totalPendingApprovals)}
          tone="gold"
        />
        <MetricCard
          id="ops-card-docs"
          icon={<FileText strokeWidth={2.25} />}
          label="Documentos Pendentes"
          value={String(summaryTotals.totalPendingDocs)}
          tone="neutral"
        />
      </div>

      {/* Filtering and Search Dashboard */}
      <Card className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <SearchField
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por Empresa, CNPJ ou Segmento..."
          containerClassName="w-full md:w-96"
        />

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-canvas dark:bg-white/5 px-3 py-1.5 rounded-lg border border-line dark:border-line-dark text-xs text-ink dark:text-ink-dark">
            <Filter className="h-3.5 w-3.5 text-ink-soft dark:text-ink-soft-dark" />
            <select
              className="bg-transparent font-medium focus:outline-none cursor-pointer dark:[color-scheme:dark]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Todos os Status</option>
              <option value="Em dia">Em dia / OK</option>
              <option value="Atenção">Atenção</option>
              <option value="Atraso">Atraso</option>
              <option value="Sem movimentação">Sem Movimentação</option>
              <option value="Implantação">Implantação</option>
            </select>
          </div>

          {/* Segment Filter */}
          <div className="flex items-center gap-1.5 bg-canvas dark:bg-white/5 px-3 py-1.5 rounded-lg border border-line dark:border-line-dark text-xs text-ink dark:text-ink-dark">
            <Building2 className="h-3.5 w-3.5 text-ink-soft dark:text-ink-soft-dark" />
            <select
              className="bg-transparent font-medium focus:outline-none cursor-pointer dark:[color-scheme:dark]"
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value)}
            >
              <option value="ALL">Todos os Segmentos</option>
              {segments.map((seg) => (
                <option key={seg} value={seg}>
                  {seg}
                </option>
              ))}
            </select>
          </div>

          {/* Sorter */}
          <div className="flex items-center gap-1.5 bg-canvas dark:bg-white/5 px-3 py-1.5 rounded-lg border border-line dark:border-line-dark text-xs text-ink dark:text-ink-dark">
            <ArrowUpDown className="h-3.5 w-3.5 text-ink-soft dark:text-ink-soft-dark" />
            <select
              className="bg-transparent font-medium focus:outline-none cursor-pointer dark:[color-scheme:dark]"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="name">Ordenar por Nome</option>
              <option value="balance">Ordenar por Caixa</option>
              <option value="pending">Mais Pendências</option>
              <option value="overdue">Mais Atrasos</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-0.5 bg-canvas dark:bg-white/5 p-1 rounded-lg border border-line dark:border-line-dark">
            <button
              type="button"
              onClick={() => changeViewMode("card")}
              title="Visualização em cards"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === "card"
                  ? "bg-surface dark:bg-surface-dark text-brand-navy-900 dark:text-ink-dark shadow-sm border border-line dark:border-line-dark"
                  : "text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              type="button"
              onClick={() => changeViewMode("list")}
              title="Visualização em lista"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === "list"
                  ? "bg-surface dark:bg-surface-dark text-brand-navy-900 dark:text-ink-dark shadow-sm border border-line dark:border-line-dark"
                  : "text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lista</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Companies — empty state */}
      {filteredCompanies.length === 0 && (
        <Card className="border-dashed">
          <EmptyState
            icon={<Building2 />}
            title="Nenhuma empresa encontrada"
            description="Ajuste os filtros selecionados para encontrar a empresa desejada."
          />
        </Card>
      )}

      {/* Companies List View */}
      {filteredCompanies.length > 0 && viewMode === "list" && (
        <Table>
          <TableHead>
            <Tr>
              <Th>Cliente / Empresa</Th>
              <Th>Status Geral</Th>
              <Th align="center">Contas a Pagar</Th>
              <Th align="center">Contas a Receber</Th>
              <Th>Próximos Vencimentos</Th>
              <Th align="center">Aprovações Pendentes</Th>
              <Th align="center">Documentos Pendentes</Th>
              <Th>Última Movimentação</Th>
              <Th align="right">Ações</Th>
            </Tr>
          </TableHead>
          <TableBody>
            {filteredCompanies.map((company) => {
              const stats = getCompanyStats(company.id);
              const isNextDueOverdue =
                stats.nextDuePayable &&
                new Date(stats.nextDuePayable.dueDate) < new Date();
              return (
                <Tr key={company.id} id={`company-row-${company.id}`}>
                  <Td>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="h-6 w-6 rounded-full bg-brand-navy-900 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                        {getInitials(company.tradeName)}
                      </span>
                      <span className="font-semibold text-ink dark:text-ink-dark">
                        {company.tradeName}
                      </span>
                      <span className="text-[10px] bg-canvas dark:bg-white/5 text-ink-soft dark:text-ink-soft-dark border border-line dark:border-line-dark px-1.5 py-0.5 rounded font-medium">
                        {company.segment}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-ink-soft dark:text-ink-soft-dark">
                      {company.cnpj}
                    </span>
                  </Td>
                  <Td>
                    <StatusBadge status={company.status} />
                  </Td>
                  <Td align="center">
                    <span
                      className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded text-[11px] font-semibold ${
                        stats.openPayablesCount > 0
                          ? "bg-zinc-100 text-zinc-700 border border-line dark:bg-white/5 dark:text-ink-soft-dark dark:border-line-dark"
                          : "text-ink-soft dark:text-ink-soft-dark"
                      }`}
                    >
                      {stats.openPayablesCount}
                    </span>
                  </Td>
                  <Td align="center">
                    <span
                      className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded text-[11px] font-semibold ${
                        stats.openReceivablesCount > 0
                          ? "bg-zinc-100 text-zinc-700 border border-line dark:bg-white/5 dark:text-ink-soft-dark dark:border-line-dark"
                          : "text-ink-soft dark:text-ink-soft-dark"
                      }`}
                    >
                      {stats.openReceivablesCount}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {stats.nextDuePayable ? (
                      <>
                        <div
                          className={`font-semibold ${isNextDueOverdue ? "text-brand-red-600 dark:text-red-400" : "text-ink dark:text-ink-dark"}`}
                        >
                          {new Date(
                            stats.nextDuePayable.dueDate,
                          ).toLocaleDateString("pt-BR")}
                        </div>
                        <div className="text-[10px] text-ink-soft dark:text-ink-soft-dark truncate max-w-40">
                          {stats.nextDuePayable.supplier}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-ink-soft dark:text-ink-soft-dark italic">
                        Em dia
                      </span>
                    )}
                  </Td>
                  <Td align="center">
                    <span
                      className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded text-[11px] font-semibold ${
                        stats.pendingApprovalsCount > 0
                          ? "bg-brand-gold-300/25 text-amber-700 border border-brand-gold-600/30 dark:bg-brand-gold-600/15 dark:text-brand-gold-300 dark:border-brand-gold-600/25"
                          : "text-ink-soft dark:text-ink-soft-dark"
                      }`}
                    >
                      {stats.pendingApprovalsCount}
                    </span>
                  </Td>
                  <Td align="center">
                    <span
                      className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded text-[11px] font-semibold ${
                        stats.pendingDocsCount > 0
                          ? "bg-zinc-100 text-zinc-600 border border-line dark:bg-white/5 dark:text-ink-soft-dark dark:border-line-dark"
                          : "text-ink-soft dark:text-ink-soft-dark"
                      }`}
                    >
                      {stats.pendingDocsCount}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {stats.lastMovement ? (
                      <>
                        <div className="text-xs font-semibold text-ink dark:text-ink-dark">
                          {formatRelativeTime(stats.lastMovement.timestamp)}
                        </div>
                        <div className="text-[10px] text-ink-soft dark:text-ink-soft-dark truncate max-w-40">
                          {stats.lastMovement.action.replace(/_/g, " ")} ·{" "}
                          {stats.lastMovement.userName.split(" ")[0]}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-ink-soft dark:text-ink-soft-dark italic">
                        Sem registros
                      </span>
                    )}
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-2">
                      <IconButton
                        icon={<Eye />}
                        label="Visualizar resumo"
                        variant="solid"
                        size="sm"
                        onClick={() => setPreviewCompanyId(company.id)}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        iconRight={
                          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                        }
                        onClick={() => handleEnterCompany(company.id)}
                      >
                        Entrar
                      </Button>
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Companies Card Grid View */}
      {filteredCompanies.length > 0 && viewMode === "card" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {filteredCompanies.map((company) => {
            const stats = getCompanyStats(company.id);
            return (
              <Card
                key={company.id}
                id={`company-card-${company.id}`}
                padding={false}
                className="overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                {/* Company Header */}
                <div className="p-5 border-b border-line dark:border-line-dark space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="h-7 w-7 rounded-full bg-brand-navy-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {getInitials(company.tradeName)}
                      </span>
                      <div className="min-w-0">
                        <span className="text-xs font-mono text-ink-soft dark:text-ink-soft-dark">
                          {company.cnpj}
                        </span>
                        <h3 className="text-base font-bold text-ink dark:text-ink-dark line-clamp-1">
                          {company.tradeName}
                        </h3>
                        <p className="text-xs text-ink-soft dark:text-ink-soft-dark line-clamp-1">
                          {company.corporateName}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={company.status} className="shrink-0" />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] bg-canvas dark:bg-white/5 text-ink-soft dark:text-ink-soft-dark border border-line dark:border-line-dark px-2 py-0.5 rounded font-medium">
                      {company.segment}
                    </span>
                    <span className="text-[10px] bg-canvas dark:bg-white/5 text-ink-soft dark:text-ink-soft-dark border border-line dark:border-line-dark px-2 py-0.5 rounded font-medium">
                      {company.taxRegime}
                    </span>
                  </div>
                </div>

                {/* Company Health Dashboard Metrics */}
                <div className="p-5 space-y-4 grow bg-canvas/50 dark:bg-white/[0.02]">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-ink-soft dark:text-ink-soft-dark text-[10px] font-semibold uppercase tracking-wider block">
                        Saldo em Conta
                      </span>
                      <span className="text-sm font-semibold text-ink dark:text-ink-dark">
                        {formatCurrency(stats.balance)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-ink-soft dark:text-ink-soft-dark text-[10px] font-semibold uppercase tracking-wider block">
                        Fluxo de Caixa
                      </span>
                      <span
                        className={`text-sm font-semibold flex items-center gap-1 ${stats.netCashFlow >= 0 ? "text-brand-green-600 dark:text-emerald-400" : "text-brand-red-600 dark:text-red-400"}`}
                      >
                        {stats.netCashFlow >= 0 ? (
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDownRight className="h-3.5 w-3.5" />
                        )}
                        {formatCurrency(Math.abs(stats.netCashFlow))}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-ink-soft dark:text-ink-soft-dark text-[10px] font-semibold uppercase tracking-wider block">
                        Contas a Pagar
                      </span>
                      <span className="text-sm font-semibold text-ink dark:text-ink-dark">
                        {formatCurrency(stats.pendingPayables)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-ink-soft dark:text-ink-soft-dark text-[10px] font-semibold uppercase tracking-wider block">
                        Contas a Receber
                      </span>
                      <span className="text-sm font-semibold text-ink dark:text-ink-dark">
                        {formatCurrency(stats.pendingReceivables)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-ink-soft dark:text-ink-soft-dark text-[10px] font-semibold uppercase tracking-wider block">
                        Próximo Vencimento
                      </span>
                      {stats.nextDuePayable ? (
                        <span
                          className={`text-sm font-semibold ${new Date(stats.nextDuePayable.dueDate) < new Date() ? "text-brand-red-600 dark:text-red-400" : "text-ink dark:text-ink-dark"}`}
                        >
                          {new Date(
                            stats.nextDuePayable.dueDate,
                          ).toLocaleDateString("pt-BR")}
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-ink-soft dark:text-ink-soft-dark">
                          Em dia
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-ink-soft dark:text-ink-soft-dark text-[10px] font-semibold uppercase tracking-wider block">
                        Contas Vencidas
                      </span>
                      <span
                        className={`text-sm font-semibold ${stats.overduePayables > 0 ? "text-brand-red-600 dark:text-red-400" : "text-ink-soft dark:text-ink-soft-dark"}`}
                      >
                        {formatCurrency(stats.overduePayables)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-line dark:border-line-dark">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-brand-gold-600" />
                      <span className="text-xs text-ink dark:text-ink-dark font-medium">
                        {stats.pendingApprovalsCount} Aprovações
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-zinc-400" />
                      <span className="text-xs text-ink dark:text-ink-dark font-medium">
                        {stats.pendingDocsCount} Docs Pendentes
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-ink-soft dark:text-ink-soft-dark pt-2 border-t border-line dark:border-line-dark">
                    <History className="h-3 w-3 shrink-0" />
                    {stats.lastMovement ? (
                      <span className="truncate">
                        Última movimentação:{" "}
                        {stats.lastMovement.action.replace(/_/g, " ")} ·{" "}
                        {formatRelativeTime(stats.lastMovement.timestamp)}
                      </span>
                    ) : (
                      <span>Sem movimentações registradas</span>
                    )}
                  </div>
                </div>

                {/* Company Footer Action */}
                <div className="p-4 border-t border-line dark:border-line-dark flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-ink-soft dark:text-ink-soft-dark min-w-0">
                    <UserCheck2 className="h-3.5 w-3.5 shrink-0" />
                    <span
                      className="truncate max-w-32"
                      title={`BPO Resp: ${stats.bpoResponsibleName}`}
                    >
                      BPO Resp: {stats.bpoResponsibleName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <IconButton
                      icon={<Eye />}
                      label="Visualizar resumo"
                      variant="solid"
                      size="sm"
                      onClick={() => setPreviewCompanyId(company.id)}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      iconRight={
                        <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                      }
                      onClick={() => handleEnterCompany(company.id)}
                    >
                      Entrar
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Quick View Drawer */}
      {previewCompany &&
        (() => {
          const previewStats = getCompanyStats(previewCompany.id);
          return (
            <Drawer
              open
              onClose={() => setPreviewCompanyId(null)}
              widthClassName="w-full max-w-md"
              footer={
                <Button
                  fullWidth
                  iconRight={<ArrowRight className="h-3.5 w-3.5" />}
                  onClick={() => {
                    handleEnterCompany(previewCompany.id);
                    setPreviewCompanyId(null);
                  }}
                >
                  Entrar no Ambiente Completo
                </Button>
              }
            >
              <div className="p-5 bg-brand-navy-900 text-white flex items-start justify-between border-b-2 border-brand-red-600">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-brand-gold-300/70">
                    {previewCompany.cnpj}
                  </span>
                  <h3 className="font-bold text-base">
                    {previewCompany.tradeName}
                  </h3>
                  <StatusBadge status={previewCompany.status} />
                </div>
                <button
                  onClick={() => setPreviewCompanyId(null)}
                  className="text-brand-gold-300 hover:text-white cursor-pointer"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-5 space-y-5 text-xs">
                {/* Key figures */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-canvas dark:bg-white/5 border border-line dark:border-line-dark rounded-lg p-2.5 space-y-1">
                    <div
                      className={`h-6 w-6 rounded-lg flex items-center justify-center mb-0.5 ${DRAWER_TONE_CHIP[OPS_DRAWER_VISUALS[0].tone]}`}
                    >
                      <Wallet className="h-3 w-3" strokeWidth={2.25} />
                    </div>
                    <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark font-semibold uppercase tracking-wider block">
                      Saldo em Conta
                    </span>
                    <span className="text-sm font-semibold text-ink dark:text-ink-dark">
                      {formatCurrency(previewStats.balance)}
                    </span>
                  </div>
                  <div className="bg-canvas dark:bg-white/5 border border-line dark:border-line-dark rounded-lg p-2.5 space-y-1">
                    <div
                      className={`h-6 w-6 rounded-lg flex items-center justify-center mb-0.5 ${DRAWER_TONE_CHIP[OPS_DRAWER_VISUALS[1].tone]}`}
                    >
                      <ArrowUpRight className="h-3 w-3" strokeWidth={2.25} />
                    </div>
                    <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark font-semibold uppercase tracking-wider block">
                      Fluxo de Caixa
                    </span>
                    <span
                      className={`text-sm font-semibold ${previewStats.netCashFlow >= 0 ? "text-brand-green-600 dark:text-emerald-400" : "text-brand-red-600 dark:text-red-400"}`}
                    >
                      {previewStats.netCashFlow >= 0 ? "+" : "-"}{" "}
                      {formatCurrency(Math.abs(previewStats.netCashFlow))}
                    </span>
                    <div className="text-[9px] text-ink-soft dark:text-ink-soft-dark flex items-center gap-2">
                      <span className="flex items-center text-brand-green-600 dark:text-emerald-400">
                        <ArrowUpRight className="h-3 w-3" />
                        R${" "}
                        {previewStats.cashIn.toLocaleString("pt-BR", {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                      <span className="flex items-center text-brand-red-600 dark:text-red-400">
                        <ArrowDownRight className="h-3 w-3" />
                        R${" "}
                        {previewStats.cashOut.toLocaleString("pt-BR", {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="bg-canvas dark:bg-white/5 border border-line dark:border-line-dark rounded-lg p-2.5 space-y-1">
                    <div
                      className={`h-6 w-6 rounded-lg flex items-center justify-center mb-0.5 ${DRAWER_TONE_CHIP[OPS_DRAWER_VISUALS[2].tone]}`}
                    >
                      <Receipt className="h-3 w-3" strokeWidth={2.25} />
                    </div>
                    <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark font-semibold uppercase tracking-wider block">
                      Contas a Pagar
                    </span>
                    <span className="text-sm font-semibold text-ink dark:text-ink-dark">
                      {formatCurrency(previewStats.pendingPayables)}
                    </span>
                    <span className="text-[9px] text-ink-soft dark:text-ink-soft-dark block">
                      {previewStats.openPayablesCount} em aberto
                    </span>
                  </div>
                  <div className="bg-canvas dark:bg-white/5 border border-line dark:border-line-dark rounded-lg p-2.5 space-y-1">
                    <div
                      className={`h-6 w-6 rounded-lg flex items-center justify-center mb-0.5 ${DRAWER_TONE_CHIP[OPS_DRAWER_VISUALS[3].tone]}`}
                    >
                      <DollarSign className="h-3 w-3" strokeWidth={2.25} />
                    </div>
                    <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark font-semibold uppercase tracking-wider block">
                      Contas a Receber
                    </span>
                    <span className="text-sm font-semibold text-ink dark:text-ink-dark">
                      {formatCurrency(previewStats.pendingReceivables)}
                    </span>
                    <span className="text-[9px] text-ink-soft dark:text-ink-soft-dark block">
                      {previewStats.openReceivablesCount} em aberto
                    </span>
                  </div>
                  <div className="bg-canvas dark:bg-white/5 border border-line dark:border-line-dark rounded-lg p-2.5 space-y-1">
                    <div
                      className={`h-6 w-6 rounded-lg flex items-center justify-center mb-0.5 ${DRAWER_TONE_CHIP[OPS_DRAWER_VISUALS[4].tone]}`}
                    >
                      <CalendarClock className="h-3 w-3" strokeWidth={2.25} />
                    </div>
                    <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark font-semibold uppercase tracking-wider block">
                      Próximo Vencimento
                    </span>
                    {previewStats.nextDuePayable ? (
                      <>
                        <span
                          className={`text-sm font-semibold block ${new Date(previewStats.nextDuePayable.dueDate) < new Date() ? "text-brand-red-600 dark:text-red-400" : "text-ink dark:text-ink-dark"}`}
                        >
                          {new Date(
                            previewStats.nextDuePayable.dueDate,
                          ).toLocaleDateString("pt-BR")}
                        </span>
                        <span className="text-[9px] text-ink-soft dark:text-ink-soft-dark truncate block">
                          {previewStats.nextDuePayable.supplier}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-semibold text-ink-soft dark:text-ink-soft-dark">
                        Em dia
                      </span>
                    )}
                  </div>
                  <div className="bg-canvas dark:bg-white/5 border border-line dark:border-line-dark rounded-lg p-2.5 space-y-1">
                    <div
                      className={`h-6 w-6 rounded-lg flex items-center justify-center mb-0.5 ${DRAWER_TONE_CHIP[OPS_DRAWER_VISUALS[5].tone]}`}
                    >
                      <AlertTriangle className="h-3 w-3" strokeWidth={2.25} />
                    </div>
                    <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark font-semibold uppercase tracking-wider block">
                      Contas Vencidas
                    </span>
                    <span
                      className={`text-sm font-semibold ${previewStats.overduePayables > 0 ? "text-brand-red-600 dark:text-red-400" : "text-ink-soft dark:text-ink-soft-dark"}`}
                    >
                      {formatCurrency(previewStats.overduePayables)}
                    </span>
                  </div>
                  <div className="bg-brand-gold-300/15 dark:bg-brand-gold-600/10 border border-brand-gold-600/30 dark:border-brand-gold-600/25 rounded-lg p-2.5 space-y-1">
                    <div
                      className={`h-6 w-6 rounded-lg flex items-center justify-center mb-0.5 ${DRAWER_TONE_CHIP[OPS_DRAWER_VISUALS[6].tone]}`}
                    >
                      <ClipboardCheck className="h-3 w-3" strokeWidth={2.25} />
                    </div>
                    <span className="text-[10px] text-amber-700 dark:text-brand-gold-300 font-semibold uppercase tracking-wider block">
                      Aprovações Pendentes
                    </span>
                    <span className="text-sm font-semibold text-amber-700 dark:text-brand-gold-300">
                      {previewStats.pendingApprovalsCount}
                    </span>
                  </div>
                  <div className="bg-canvas dark:bg-white/5 border border-line dark:border-line-dark rounded-lg p-2.5 space-y-1">
                    <div
                      className={`h-6 w-6 rounded-lg flex items-center justify-center mb-0.5 ${DRAWER_TONE_CHIP[OPS_DRAWER_VISUALS[7].tone]}`}
                    >
                      <FileWarning className="h-3 w-3" strokeWidth={2.25} />
                    </div>
                    <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark font-semibold uppercase tracking-wider block">
                      Documentos Pendentes
                    </span>
                    <span className="text-sm font-semibold text-ink dark:text-ink-dark">
                      {previewStats.pendingDocsCount}
                    </span>
                  </div>
                </div>

                {/* Upcoming due dates */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold text-ink dark:text-ink-dark uppercase tracking-wider">
                    Próximos Vencimentos
                  </h4>
                  {previewStats.upcomingPayables.length > 0 ? (
                    <div className="space-y-2">
                      {previewStats.upcomingPayables.map((ap) => {
                        const isOverdue = new Date(ap.dueDate) < new Date();
                        return (
                          <div
                            key={ap.id}
                            className="flex items-center justify-between bg-canvas dark:bg-white/5 border border-line/60 dark:border-line-dark rounded-lg p-2.5"
                          >
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${isOverdue ? "bg-brand-red-600" : "bg-brand-gold-600"}`}
                                />
                                <span className="font-semibold text-ink dark:text-ink-dark truncate">
                                  {ap.description}
                                </span>
                              </div>
                              <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark block">
                                {ap.supplier} ·{" "}
                                {new Date(ap.dueDate).toLocaleDateString(
                                  "pt-BR",
                                )}
                              </span>
                            </div>
                            <span className="font-semibold text-ink dark:text-ink-dark shrink-0">
                              {formatCurrency(ap.finalAmount)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-ink-soft dark:text-ink-soft-dark italic py-2">
                      Nenhum vencimento em aberto.
                    </p>
                  )}
                </div>

                {/* Last movement */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold text-ink dark:text-ink-dark uppercase tracking-wider">
                    Última Movimentação
                  </h4>
                  {previewStats.lastMovement ? (
                    <div className="bg-canvas dark:bg-white/5 border border-line/60 dark:border-line-dark rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-ink dark:text-ink-dark uppercase bg-zinc-100 dark:bg-white/10 px-1.5 py-0.5 rounded font-mono text-[10px]">
                          {previewStats.lastMovement.action.replace(
                            /_/g,
                            " ",
                          )}
                        </span>
                        <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark">
                          {formatRelativeTime(
                            previewStats.lastMovement.timestamp,
                          )}
                        </span>
                      </div>
                      <p className="text-ink-soft dark:text-ink-soft-dark">
                        Por{" "}
                        <strong className="text-ink dark:text-ink-dark">
                          {previewStats.lastMovement.userName}
                        </strong>{" "}
                        ({previewStats.lastMovement.role.replace(/_/g, " ")})
                      </p>
                    </div>
                  ) : (
                    <p className="text-ink-soft dark:text-ink-soft-dark italic py-2">
                      Nenhuma atividade registrada ainda.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-ink-soft dark:text-ink-soft-dark pt-2 border-t border-line dark:border-line-dark">
                  <UserCheck2 className="h-3.5 w-3.5" />
                  <span>
                    Responsável BPO:{" "}
                    <strong className="text-ink dark:text-ink-dark">
                      {previewStats.bpoResponsibleName}
                    </strong>
                  </span>
                </div>
              </div>
            </Drawer>
          );
        })()}
    </div>
  );
}
