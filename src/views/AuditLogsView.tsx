/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useBPOState } from '../hooks/useBPOState';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Terminal, 
  RefreshCw, 
  Eye, 
  KeyRound, 
  Calendar,
  Layers,
  ArrowDownToLine,
  Database,
  Lock
} from 'lucide-react';

export default function AuditLogsView() {
  const { 
    activeCompany, 
    auditLogs, 
    currentUser 
  } = useBPOState();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  if (currentUser.role !== 'BPO_ADMIN') {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-zinc-500 text-xs italic">
        Apenas "Administradores do BPO" possuem permissão de auditoria para visualizar registros de logs de conformidade.
      </div>
    );
  }

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.ipAddress.includes(searchTerm);
    
    const matchesRole = roleFilter === 'ALL' || log.userRole === roleFilter;

    return matchesSearch && matchesRole;
  });

  const handleExportCSV = () => {
    alert('Preparando dump seguro dos dados criptografados em CSV...\n\nExportando ' + filteredLogs.length + ' logs para contabilidade em conformidade com a LGPD.');
  };

  return (
    <div id="audit-logs-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-sans">
        <div>
          <h2 id="audit-title" className="text-xl font-bold text-zinc-900 tracking-tight">Rastro de Auditoria e Conformidade</h2>
          <p className="text-zinc-500 text-xs">Padrão SOX/LGPD. Registros imutáveis de todas as operações financeiras, acessos, exportações e alterações de faturamento.</p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 text-xs font-bold text-zinc-950 bg-white hover:bg-zinc-100 border border-zinc-200 px-3 py-2 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowDownToLine className="h-4 w-4" /> Exportar Logs para CSV
        </button>
      </div>

      {/* Grid Filtering / Searching */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96 font-sans">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por Ação, Colaborador, IP ou Empresa..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 hover:bg-zinc-100/50 focus:bg-white rounded-lg border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto font-sans">
          <div className="flex items-center gap-1.5 bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs text-zinc-600">
            <Filter className="h-3.5 w-3.5" />
            <select
              className="bg-transparent font-medium focus:outline-none cursor-pointer"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="ALL">Todos os Perfis</option>
              <option value="BPO_ADMIN">Administradores BPO</option>
              <option value="BPO_TEAM">Analistas BPO</option>
              <option value="CLIENT">Inquilinos / Clientes</option>
              <option value="ACCOUNTANT">Contadores Externos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Immutability Ledger list representation */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto font-mono text-[11px] leading-relaxed">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="p-4 text-zinc-500 font-bold uppercase tracking-wider w-48">Registro de Data/Hora</th>
                <th className="p-4 text-zinc-500 font-bold uppercase tracking-wider w-40">Operador</th>
                <th className="p-4 text-zinc-500 font-bold uppercase tracking-wider w-36">Cargo / Perfil</th>
                <th className="p-4 text-zinc-500 font-bold uppercase tracking-wider w-44">Inquilino / Empresa</th>
                <th className="p-4 text-zinc-500 font-bold uppercase tracking-wider">Ação / Evento Crítico</th>
                <th className="p-4 text-zinc-500 font-bold uppercase tracking-wider text-right w-40">Chave de Assinatura (MD5/SHA)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-zinc-50/60 transition-colors">
                  <td className="p-4 text-zinc-500">
                    {new Date(log.timestamp).toLocaleString('pt-BR')}
                  </td>
                  <td className="p-4 font-bold text-zinc-900 font-sans">
                    {log.userName}
                  </td>
                  <td className="p-4 text-zinc-600">
                    {log.userRole.replace(/_/g, ' ')}
                  </td>
                  <td className="p-4 font-semibold text-zinc-800 font-sans">
                    {log.companyName}
                  </td>
                  <td className="p-4 text-zinc-900 font-sans font-medium">
                    {log.action}
                    <div className="text-[10px] text-zinc-400 font-mono mt-0.5">Dispositivo IP: {log.ipAddress} | {log.userAgent.substring(0, 70)}...</div>
                  </td>
                  <td className="p-4 text-right text-zinc-400 font-bold font-mono">
                    {log.hash.substring(0, 16).toUpperCase()}
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-zinc-400 italic font-sans text-xs">
                    Nenhum registro de log correspondente aos filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
