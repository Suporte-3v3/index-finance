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
  DollarSign
} from 'lucide-react';

export default function OperationsCenter({ onEnterCompany }: { onEnterCompany: () => void }) {
  const { companies, bankAccounts, accountsPayable, accountsReceivable, approvals, documents, switchCompany, currentUser } = useBPOState();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [segmentFilter, setSegmentFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'balance' | 'pending' | 'overdue'>('name');

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

    return {
      balance,
      pendingPayables,
      overduePayables,
      pendingReceivables,
      overdueReceivables,
      pendingApprovalsCount: approvalList.length,
      pendingDocsCount: docList.length,
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
        </div>
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {filteredCompanies.length === 0 ? (
          <div className="col-span-full bg-zinc-50 border border-zinc-200 border-dashed py-12 rounded-xl text-center space-y-3">
            <Building2 className="h-10 w-10 text-zinc-300 mx-auto" />
            <p className="text-zinc-500 text-sm font-medium">Nenhuma empresa encontrada com os filtros selecionados.</p>
          </div>
        ) : (
          filteredCompanies.map(company => {
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
                <div className="p-5 space-y-4 flex-grow bg-zinc-50/50">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-zinc-400 text-[10px] font-medium uppercase tracking-wider block">Saldo em Conta</span>
                      <span className="text-sm font-bold text-zinc-800">
                        R$ {stats.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
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
                </div>

                {/* Company Footer Action */}
                <div className="p-4 bg-white border-t border-zinc-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <UserCheck2 className="h-3.5 w-3.5 text-zinc-400" />
                    <span className="truncate max-w-[120px]">BPO Resp: Pedro</span>
                  </div>

                  <button
                    onClick={() => handleEnterCompany(company.id)}
                    className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#00304c] hover:bg-[#d20010] px-3.5 py-2 rounded-lg transition-colors cursor-pointer group shadow-2xs"
                  >
                    Entrar no Ambiente
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
