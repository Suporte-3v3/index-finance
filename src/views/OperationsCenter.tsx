/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useBPOState } from '../hooks/useBPOState';
import { Company, CompanyStatus } from '../types';
import {
  Building2,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  ArrowRight,
  Search,
  Filter,
  ArrowUpDown,
  CalendarDays,
  FileText,
  UserCheck2,
  DollarSign,
  LayoutGrid,
  List,
  Eye,
  X,
  ArrowUpRight,
  ArrowDownRight,
  History
} from 'lucide-react';

type ViewMode = 'card' | 'list';

export default function OperationsCenter({ onEnterCompany }: { onEnterCompany: () => void }) {
  const { companies, bankAccounts, accountsPayable, accountsReceivable, approvals, documents, auditLogs, users, switchCompany, currentUser } = useBPOState();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [segmentFilter, setSegmentFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'balance' | 'pending' | 'overdue'>('name');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem('bpo_saas_opsViewMode') as ViewMode) || 'card';
    } catch {
      return 'card';
    }
  });

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('bpo_saas_opsViewMode', mode);
    } catch {
      // ignore storage errors (e.g. private browsing)
    }
  };

  const [previewCompanyId, setPreviewCompanyId] = useState<string | null>(null);
  const previewCompany = previewCompanyId ? companies.find(c => c.id === previewCompanyId) || null : null;

  // Find unique segments
  const segments = Array.from(new Set(companies.map(c => c.segment)));

  // Helper to compute company finance stats
  const getCompanyStats = (companyId: string) => {
    const activeAccounts = bankAccounts.filter(ba => ba.companyId === companyId);
    const balance = activeAccounts.reduce((sum, ba) => sum + ba.balance, 0);

    const payableList = accountsPayable.filter(ap => ap.companyId === companyId);
    const receivableList = accountsReceivable.filter(ar => ar.companyId === companyId);
    const approvalList = approvals.filter(apv => apv.companyId === companyId && apv.status === 'Pendente');
    const docList = documents.filter(doc => doc.companyId === companyId && doc.status === 'Pendente');

    const pendingPayables = payableList.filter(ap => ap.status === 'Pendente' || ap.status === 'Aguardando aprovação').reduce((sum, ap) => sum + ap.finalAmount, 0);
    const overduePayables = payableList.filter(ap => ap.status === 'Vencida').reduce((sum, ap) => sum + ap.finalAmount, 0);

    const pendingReceivables = receivableList.filter(ar => ar.status === 'Emitida' || ar.status === 'Parcialmente recebida').reduce((sum, ar) => sum + ar.amount - ar.receivedAmount, 0);
    const overdueReceivables = receivableList.filter(ar => ar.status === 'Vencida').reduce((sum, ar) => sum + ar.amount - ar.receivedAmount, 0);

    // Fluxo de caixa: entradas recebidas x saídas pagas no período de referência
    const cashIn = receivableList
      .filter(ar => ar.status === 'Recebida' || ar.status === 'Parcialmente recebida')
      .reduce((sum, ar) => sum + ar.receivedAmount, 0);
    const cashOut = payableList
      .filter(ap => ap.status === 'Paga')
      .reduce((sum, ap) => sum + ap.finalAmount, 0);
    const netCashFlow = cashIn - cashOut;

    // Próximo vencimento em aberto
    const openPayables = payableList
      .filter(ap => ap.status !== 'Paga' && ap.status !== 'Cancelada' && ap.status !== 'Rejeitada')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const nextDuePayable = openPayables[0] || null;

    // Contas a receber em aberto (ainda não totalmente recebidas nem canceladas)
    const openReceivablesCount = receivableList
      .filter(ar => ar.status !== 'Recebida' && ar.status !== 'Cancelada').length;

    // Última movimentação registrada (log de auditoria mais recente)
    const companyLogs = auditLogs
      .filter(log => log.companyId === companyId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const lastMovement = companyLogs[0] || null;

    const bpoResponsible = users.find(u => u.id === companies.find(c => c.id === companyId)?.bpoResponsibleId);

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
      bpoResponsibleName: bpoResponsible?.name.split(' (')[0] || 'Não atribuído',
      upcomingPayables: openPayables.slice(0, 3),
    };
  };

  // Filter & sort companies
  const filteredCompanies = companies
    .filter(company => {
      // BPO team user can only see companies assigned to them
      if (currentUser.role === 'BPO_TEAM' && currentUser.companies && !currentUser.companies.includes(company.id)) {
        return false;
      }

      const matchesSearch = 
        company.tradeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.corporateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.cnpj.includes(searchTerm);
      
      const matchesStatus = statusFilter === 'ALL' || company.status === statusFilter;
      const matchesSegment = segmentFilter === 'ALL' || company.segment === segmentFilter;

      return matchesSearch && matchesStatus && matchesSegment;
    })
    .sort((a, b) => {
      const statsA = getCompanyStats(a.id);
      const statsB = getCompanyStats(b.id);

      if (sortBy === 'name') {
        return a.tradeName.localeCompare(b.tradeName);
      } else if (sortBy === 'balance') {
        return statsB.balance - statsA.balance;
      } else if (sortBy === 'pending') {
        return statsB.pendingApprovalsCount - statsA.pendingApprovalsCount;
      } else if (sortBy === 'overdue') {
        return statsB.overduePayables - statsA.overduePayables;
      }
      return 0;
    });

  // Calculate totals for summary cards
  const summaryTotals = filteredCompanies.reduce((totals, company) => {
    const stats = getCompanyStats(company.id);
    return {
      totalBalance: totals.totalBalance + stats.balance,
      totalOverduePayables: totals.totalOverduePayables + stats.overduePayables,
      totalPendingApprovals: totals.totalPendingApprovals + stats.pendingApprovalsCount,
      totalPendingDocs: totals.totalPendingDocs + stats.pendingDocsCount,
    };
  }, { totalBalance: 0, totalOverduePayables: 0, totalPendingApprovals: 0, totalPendingDocs: 0 });

  const getStatusColor = (status: CompanyStatus) => {
    switch (status) {
      case 'Em dia':
      case 'OK':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Atenção':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Atraso':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Sem movimentação':
        return 'bg-zinc-100 text-zinc-600 border-zinc-200';
      case 'Implantação':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'Inativo':
        return 'bg-zinc-200 text-zinc-800 border-zinc-300';
      default:
        return 'bg-zinc-50 text-zinc-600 border-zinc-200';
    }
  };

  const handleEnterCompany = (companyId: string) => {
    switchCompany(companyId);
    onEnterCompany();
  };

  const formatRelativeTime = (timestamp: string) => {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'agora mesmo';
    if (diffMin < 60) return `há ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `há ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `há ${diffDays}d`;
  };

  return (
    <div id="operations-center-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 id="ops-title" className="text-2xl font-bold text-zinc-900 tracking-tight">Centro de Operações BPO</h1>
          <p className="text-zinc-500 text-sm">Visão geral consolidada de saúde operacional e financeira de todos os clientes.</p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-zinc-100 text-zinc-600 px-3 py-1.5 rounded-lg border border-zinc-200 font-mono">
          <CalendarDays className="h-3.5 w-3.5" />
          <span>Filtro Geral: Mês de Referência (Julho 2026)</span>
        </div>
      </div>

      {/* Aggregate Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div id="ops-card-balance" className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Saldo Consolidado</span>
            <div className="text-xl font-bold text-zinc-900">
              R$ {summaryTotals.totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-3 bg-zinc-50 rounded-lg text-zinc-600">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>

        <div id="ops-card-overdue" className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Contas Vencidas</span>
            <div className="text-xl font-bold text-rose-600">
              R$ {summaryTotals.totalOverduePayables.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-3 bg-rose-50 rounded-lg text-rose-500">
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>

        <div id="ops-card-approvals" className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Aprovações Pendentes</span>
            <div className="text-xl font-bold text-amber-600">
              {summaryTotals.totalPendingApprovals}
            </div>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg text-amber-500">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div id="ops-card-docs" className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Documentos Pendentes</span>
            <div className="text-xl font-bold text-zinc-700">
              {summaryTotals.totalPendingDocs}
            </div>
          </div>
          <div className="p-3 bg-zinc-50 rounded-lg text-zinc-500">
            <FileText className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filtering and Search Dashboard */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por Empresa, CNPJ ou Segmento..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-50 hover:bg-zinc-100/50 focus:bg-white rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs text-zinc-600">
            <Filter className="h-3.5 w-3.5" />
            <select
              className="bg-transparent font-medium focus:outline-none cursor-pointer"
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
          <div className="flex items-center gap-1.5 bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs text-zinc-600">
            <Building2 className="h-3.5 w-3.5" />
            <select
              className="bg-transparent font-medium focus:outline-none cursor-pointer"
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value)}
            >
              <option value="ALL">Todos os Segmentos</option>
              {segments.map(seg => (
                <option key={seg} value={seg}>{seg}</option>
              ))}
            </select>
          </div>

          {/* Sorter */}
          <div className="flex items-center gap-1.5 bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs text-zinc-600">
            <ArrowUpDown className="h-3.5 w-3.5" />
            <select
              className="bg-transparent font-medium focus:outline-none cursor-pointer"
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
          <div className="flex items-center gap-0.5 bg-zinc-50 p-1 rounded-lg border border-zinc-200">
            <button
              type="button"
              onClick={() => changeViewMode('card')}
              title="Visualização em cards"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'card' ? 'bg-white text-[#00304c] shadow-2xs border border-zinc-200' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              type="button"
              onClick={() => changeViewMode('list')}
              title="Visualização em lista"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-white text-[#00304c] shadow-2xs border border-zinc-200' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lista</span>
            </button>
          </div>
        </div>
      </div>

      {/* Companies — empty state */}
      {filteredCompanies.length === 0 && (
        <div className="bg-zinc-50 border border-zinc-200 border-dashed py-12 rounded-xl text-center space-y-3">
          <Building2 className="h-10 w-10 text-zinc-300 mx-auto" />
          <p className="text-zinc-500 text-sm font-medium">Nenhuma empresa encontrada com os filtros selecionados.</p>
        </div>
      )}

      {/* Companies List View */}
      {filteredCompanies.length > 0 && viewMode === 'list' && (
        <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-left text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="px-5 py-3">Cliente / Empresa</th>
                  <th className="px-4 py-3">Status Geral</th>
                  <th className="px-4 py-3 text-center">Contas a Pagar</th>
                  <th className="px-4 py-3 text-center">Contas a Receber</th>
                  <th className="px-4 py-3">Próximos Vencimentos</th>
                  <th className="px-4 py-3 text-center">Aprovações Pendentes</th>
                  <th className="px-4 py-3 text-center">Documentos Pendentes</th>
                  <th className="px-4 py-3">Última Movimentação</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredCompanies.map(company => {
                  const stats = getCompanyStats(company.id);
                  const isNextDueOverdue = stats.nextDuePayable && new Date(stats.nextDuePayable.dueDate) < new Date();
                  return (
                    <tr key={company.id} id={`company-row-${company.id}`} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-zinc-900">{company.tradeName}</span>
                          <span className="text-[10px] bg-zinc-50 text-zinc-500 border border-zinc-200 px-1.5 py-0.5 rounded font-medium">
                            {company.segment}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-zinc-400">{company.cnpj}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${getStatusColor(company.status)}`}>
                          {company.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[11px] font-bold ${
                          stats.openPayablesCount > 0 ? 'bg-zinc-100 text-zinc-700 border border-zinc-200' : 'text-zinc-400'
                        }`}>
                          {stats.openPayablesCount}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[11px] font-bold ${
                          stats.openReceivablesCount > 0 ? 'bg-zinc-100 text-zinc-700 border border-zinc-200' : 'text-zinc-400'
                        }`}>
                          {stats.openReceivablesCount}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {stats.nextDuePayable ? (
                          <>
                            <div className={`font-semibold ${isNextDueOverdue ? 'text-rose-600' : 'text-zinc-800'}`}>
                              {new Date(stats.nextDuePayable.dueDate).toLocaleDateString('pt-BR')}
                            </div>
                            <div className="text-[10px] text-zinc-400 truncate max-w-40">
                              {stats.nextDuePayable.supplier}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-zinc-400 italic">Em dia</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[11px] font-bold ${
                          stats.pendingApprovalsCount > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'text-zinc-400'
                        }`}>
                          {stats.pendingApprovalsCount}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[11px] font-bold ${
                          stats.pendingDocsCount > 0 ? 'bg-zinc-100 text-zinc-600 border border-zinc-200' : 'text-zinc-400'
                        }`}>
                          {stats.pendingDocsCount}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {stats.lastMovement ? (
                          <>
                            <div className="text-xs font-semibold text-zinc-700">{formatRelativeTime(stats.lastMovement.timestamp)}</div>
                            <div className="text-[10px] text-zinc-400 truncate max-w-40">
                              {stats.lastMovement.action.replace(/_/g, ' ')} · {stats.lastMovement.userName.split(' ')[0]}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-zinc-400 italic">Sem registros</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setPreviewCompanyId(company.id)}
                            title="Visualizar resumo"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 bg-white border border-zinc-200 hover:border-[#00304c]/40 hover:text-[#00304c] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span className="hidden xl:inline">Visualizar</span>
                          </button>
                          <button
                            onClick={() => handleEnterCompany(company.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#00304c] hover:bg-[#d20010] px-3 py-1.5 rounded-lg transition-colors cursor-pointer group shadow-2xs whitespace-nowrap"
                          >
                            Entrar
                            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Companies Card Grid View */}
      {filteredCompanies.length > 0 && viewMode === 'card' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {filteredCompanies.map(company => {
            const stats = getCompanyStats(company.id);
            return (
              <div 
                key={company.id}
                id={`company-card-${company.id}`}
                className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                {/* Company Header */}
                <div className="p-5 border-b border-zinc-100 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-mono text-zinc-400">{company.cnpj}</span>
                      <h3 className="text-base font-bold text-zinc-900 line-clamp-1">{company.tradeName}</h3>
                      <p className="text-xs text-zinc-500 line-clamp-1">{company.corporateName}</p>
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${getStatusColor(company.status)}`}>
                      {company.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] bg-zinc-50 text-zinc-500 border border-zinc-200 px-2 py-0.5 rounded font-medium">
                      {company.segment}
                    </span>
                    <span className="text-[10px] bg-zinc-50 text-zinc-500 border border-zinc-200 px-2 py-0.5 rounded font-medium">
                      {company.taxRegime}
                    </span>
                  </div>
                </div>

                {/* Company Health Dashboard Metrics */}
                <div className="p-5 space-y-4 grow bg-zinc-50/50">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-zinc-400 text-[10px] font-medium uppercase tracking-wider block">Saldo em Conta</span>
                      <span className="text-sm font-bold text-zinc-800">
                        R$ {stats.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-zinc-400 text-[10px] font-medium uppercase tracking-wider block">Fluxo de Caixa</span>
                      <span className={`text-sm font-bold flex items-center gap-1 ${stats.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {stats.netCashFlow >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                        R$ {Math.abs(stats.netCashFlow).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-zinc-400 text-[10px] font-medium uppercase tracking-wider block">Contas a Pagar</span>
                      <span className="text-sm font-bold text-zinc-800">
                        R$ {stats.pendingPayables.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-zinc-400 text-[10px] font-medium uppercase tracking-wider block">Contas a Receber</span>
                      <span className="text-sm font-bold text-zinc-800">
                        R$ {stats.pendingReceivables.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-zinc-400 text-[10px] font-medium uppercase tracking-wider block">Próximo Vencimento</span>
                      {stats.nextDuePayable ? (
                        <span className={`text-sm font-bold ${new Date(stats.nextDuePayable.dueDate) < new Date() ? 'text-rose-600' : 'text-zinc-800'}`}>
                          {new Date(stats.nextDuePayable.dueDate).toLocaleDateString('pt-BR')}
                        </span>
                      ) : (
                        <span className="text-sm font-bold text-zinc-400">Em dia</span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-zinc-400 text-[10px] font-medium uppercase tracking-wider block">Contas Vencidas</span>
                      <span className={`text-sm font-bold ${stats.overduePayables > 0 ? 'text-rose-600' : 'text-zinc-500'}`}>
                        R$ {stats.overduePayables.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-100">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-amber-500" />
                      <span className="text-xs text-zinc-600 font-medium">
                        {stats.pendingApprovalsCount} Aprovações
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-zinc-400" />
                      <span className="text-xs text-zinc-600 font-medium">
                        {stats.pendingDocsCount} Docs Pendentes
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 pt-2 border-t border-zinc-100">
                    <History className="h-3 w-3 shrink-0" />
                    {stats.lastMovement ? (
                      <span className="truncate">
                        Última movimentação: {stats.lastMovement.action.replace(/_/g, ' ')} · {formatRelativeTime(stats.lastMovement.timestamp)}
                      </span>
                    ) : (
                      <span>Sem movimentações registradas</span>
                    )}
                  </div>
                </div>

                {/* Company Footer Action */}
                <div className="p-4 bg-white border-t border-zinc-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 min-w-0">
                    <UserCheck2 className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate max-w-32" title={`BPO Resp: ${stats.bpoResponsibleName}`}>BPO Resp: {stats.bpoResponsibleName}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setPreviewCompanyId(company.id)}
                      title="Visualizar resumo"
                      className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 bg-white border border-zinc-200 hover:border-[#00304c]/40 hover:text-[#00304c] px-3 py-2 rounded-lg transition-colors cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleEnterCompany(company.id)}
                      className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#00304c] hover:bg-[#d20010] px-3.5 py-2 rounded-lg transition-colors cursor-pointer group shadow-2xs"
                    >
                      Entrar
                      <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick View Drawer */}
      {previewCompany && (() => {
        const previewStats = getCompanyStats(previewCompany.id);
        return (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
              onClick={() => setPreviewCompanyId(null)}
            />
            <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 font-sans text-xs">
              <div className="p-5 bg-[#00304c] text-white flex items-start justify-between border-b-2 border-[#d20010]">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-[#ffefd1]/70">{previewCompany.cnpj}</span>
                  <h3 className="font-bold text-base">{previewCompany.tradeName}</h3>
                  <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${getStatusColor(previewCompany.status)}`}>
                    {previewCompany.status}
                  </span>
                </div>
                <button onClick={() => setPreviewCompanyId(null)} className="text-[#ffefd1] hover:text-white cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grow overflow-y-auto p-5 space-y-5">
                {/* Key figures */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 space-y-1">
                    <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider block">Saldo em Conta</span>
                    <span className="text-sm font-bold text-zinc-900">R$ {previewStats.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 space-y-1">
                    <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider block">Fluxo de Caixa</span>
                    <span className={`text-sm font-bold ${previewStats.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {previewStats.netCashFlow >= 0 ? '+' : '-'} R$ {Math.abs(previewStats.netCashFlow).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <div className="text-[9px] text-zinc-400 flex items-center gap-2">
                      <span className="flex items-center text-emerald-600"><ArrowUpRight className="h-3 w-3" />R$ {previewStats.cashIn.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                      <span className="flex items-center text-rose-500"><ArrowDownRight className="h-3 w-3" />R$ {previewStats.cashOut.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 space-y-1">
                    <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider block">Contas Vencidas</span>
                    <span className={`text-sm font-bold ${previewStats.overduePayables > 0 ? 'text-rose-600' : 'text-zinc-500'}`}>
                      R$ {previewStats.overduePayables.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 space-y-1">
                    <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider block">Aprovações Pendentes</span>
                    <span className={`text-sm font-bold ${previewStats.pendingApprovalsCount > 0 ? 'text-amber-600' : 'text-zinc-500'}`}>
                      {previewStats.pendingApprovalsCount}
                    </span>
                  </div>
                </div>

                {/* Upcoming due dates */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider">Próximos Vencimentos</h4>
                  {previewStats.upcomingPayables.length > 0 ? (
                    <div className="space-y-2">
                      {previewStats.upcomingPayables.map(ap => {
                        const isOverdue = new Date(ap.dueDate) < new Date();
                        return (
                          <div key={ap.id} className="flex items-center justify-between bg-zinc-50 border border-zinc-200/60 rounded-lg p-2.5">
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isOverdue ? 'bg-rose-500' : 'bg-amber-500'}`} />
                                <span className="font-bold text-zinc-800 truncate">{ap.description}</span>
                              </div>
                              <span className="text-[10px] text-zinc-400 block">{ap.supplier} · {new Date(ap.dueDate).toLocaleDateString('pt-BR')}</span>
                            </div>
                            <span className="font-bold text-zinc-800 shrink-0">R$ {ap.finalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-zinc-400 italic py-2">Nenhum vencimento em aberto.</p>
                  )}
                </div>

                {/* Last movement */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider">Última Movimentação</h4>
                  {previewStats.lastMovement ? (
                    <div className="bg-zinc-50 border border-zinc-200/60 rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-800 uppercase bg-zinc-100 px-1.5 py-0.5 rounded font-mono text-[10px]">
                          {previewStats.lastMovement.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-zinc-400">{formatRelativeTime(previewStats.lastMovement.timestamp)}</span>
                      </div>
                      <p className="text-zinc-500">
                        Por <strong>{previewStats.lastMovement.userName}</strong> ({previewStats.lastMovement.role.replace(/_/g, ' ')})
                      </p>
                    </div>
                  ) : (
                    <p className="text-zinc-400 italic py-2">Nenhuma atividade registrada ainda.</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-zinc-500 pt-2 border-t border-zinc-100">
                  <UserCheck2 className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Responsável BPO: <strong className="text-zinc-700">{previewStats.bpoResponsibleName}</strong></span>
                </div>
              </div>

              <div className="p-4 bg-zinc-50 border-t border-zinc-200">
                <button
                  onClick={() => { handleEnterCompany(previewCompany.id); setPreviewCompanyId(null); }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-[#00304c] hover:bg-[#d20010] px-4 py-2.5 rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  Entrar no Ambiente Completo
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
