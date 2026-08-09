/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { useBPOState } from '../hooks/useBPOState';
import { AuditLog, UserRole } from '../types';
import { Button, Card, MetricCard, Modal, SearchField } from '../components/ui';
import { MetricTone } from '../components/ui/MetricCard';
import { Table, TableHead, TableBody, Tr, Th, Td } from '../components/ui/Table';
import {
  Activity,
  ArrowDownToLine,
  Eye,
  Filter,
  Lock,
  LogIn,
  PencilLine,
  ShieldCheck,
} from 'lucide-react';

const ROLE_LABELS: Record<UserRole, string> = {
  BPO_ADMIN: 'Administrador BPO',
  BPO_TEAM: 'Equipe BPO',
  CLIENT: 'Cliente',
  ACCOUNTANT: 'Contador'
};

const AUDIT_METRIC_VISUALS: { icon: typeof Activity; tone: MetricTone }[] = [
  { icon: Activity, tone: 'navy' },
  { icon: Filter, tone: 'navy' },
  { icon: LogIn, tone: 'gold' },
  { icon: PencilLine, tone: 'gold' },
];

const AVATAR_PALETTE = ['bg-brand-navy-900'];

const getInitials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();

function escapeCsv(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function eventIdentifier(log: AuditLog): string {
  let hash = 2166136261;
  const source = `${log.id}|${log.timestamp}|${log.userId}|${log.action}|${log.entityId}`;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `EVT-${(hash >>> 0).toString(16).padStart(8, '0').toUpperCase()}`;
}

function formatJson(value?: string): string {
  if (!value) return 'Não informado';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export default function AuditLogsView() {
  const { auditLogs, currentUser, companies } = useBPOState();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const filteredLogs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase('pt-BR');
    return auditLogs.filter(log => {
      const searchableText = [
        log.action,
        log.userName,
        log.companyName || '',
        log.ipAddress,
        log.entityType,
        log.entityId,
        log.origin
      ].join(' ').toLocaleLowerCase('pt-BR');

      const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);
      const matchesRole = roleFilter === 'ALL' || log.role === roleFilter;
      const matchesCompany = companyFilter === 'ALL' || log.companyId === companyFilter;
      return matchesSearch && matchesRole && matchesCompany;
    });
  }, [auditLogs, companyFilter, roleFilter, searchTerm]);

  if (currentUser.role !== 'BPO_ADMIN') {
    return (
      <Card className="text-center space-y-3">
        <Lock className="h-8 w-8 mx-auto text-ink-soft dark:text-ink-soft-dark" />
        <p className="text-ink dark:text-ink-dark text-xs font-semibold">
          Apenas o proprietário com perfil Administrador BPO pode visualizar os logs de conformidade.
        </p>
      </Card>
    );
  }

  const handleExportCSV = () => {
    const header = [
      'Identificador', 'Data e hora', 'Operador', 'Perfil', 'Empresa', 'Ação',
      'Entidade', 'ID da entidade', 'IP', 'Origem'
    ];
    const rows = filteredLogs.map(log => [
      eventIdentifier(log),
      log.timestamp,
      log.userName,
      ROLE_LABELS[log.role],
      log.companyName || 'Operação global',
      log.action,
      log.entityType,
      log.entityId,
      log.ipAddress,
      log.origin
    ]);
    const csv = '﻿' + [header, ...rows].map(row => row.map(escapeCsv).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `idex-finance-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-navy-900 dark:text-brand-navy-700/90" />
            <h1 className="text-2xl sm:text-3xl font-bold text-ink dark:text-ink-dark tracking-tight">Logs de Conformidade</h1>
          </div>
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark leading-relaxed mt-1">Histórico centralizado de acessos e alterações realizadas no sistema.</p>
        </div>
        <Button
          onClick={handleExportCSV}
          disabled={filteredLogs.length === 0}
          icon={<ArrowDownToLine className="h-4 w-4" />}
        >
          Exportar CSV ({filteredLogs.length})
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Total de eventos', auditLogs.length],
          ['Resultado filtrado', filteredLogs.length],
          ['Acessos', auditLogs.filter(log => log.action.startsWith('SESSAO_')).length],
          ['Alterações operacionais', auditLogs.filter(log => !log.action.startsWith('SESSAO_')).length],
        ].map(([label, value], index) => {
          const visual = AUDIT_METRIC_VISUALS[index];
          return (
            <MetricCard
              key={label as string}
              icon={<visual.icon strokeWidth={2.25} />}
              label={label as string}
              value={String(value)}
              tone={visual.tone}
            />
          );
        })}
      </div>

      <Card className="grid md:grid-cols-[1fr_auto_auto] gap-3">
        <SearchField
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar ação, operador, empresa, entidade ou IP..."
        />
        <div className="flex items-center gap-1.5 bg-canvas dark:bg-white/5 px-3 rounded-lg border border-line dark:border-line-dark text-xs text-ink dark:text-ink-dark">
          <Filter className="h-3.5 w-3.5 text-ink-soft dark:text-ink-soft-dark" />
          <select className="bg-transparent py-2 focus:outline-none cursor-pointer dark:[color-scheme:dark]" value={roleFilter} onChange={event => setRoleFilter(event.target.value as 'ALL' | UserRole)}>
            <option value="ALL">Todos os perfis</option>
            {Object.entries(ROLE_LABELS).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
          </select>
        </div>
        <select className="bg-canvas dark:bg-white/5 px-3 py-2 rounded-lg border border-line dark:border-line-dark text-xs text-ink dark:text-ink-dark focus:outline-none cursor-pointer dark:[color-scheme:dark]" value={companyFilter} onChange={event => setCompanyFilter(event.target.value)}>
          <option value="ALL">Todas as empresas</option>
          {companies.map(company => <option key={company.id} value={company.id}>{company.tradeName}</option>)}
        </select>
      </Card>

      <Table>
        <TableHead>
          <Tr>
            <Th>Data e hora</Th>
            <Th>Operador</Th>
            <Th>Empresa</Th>
            <Th>Evento</Th>
            <Th>Identificador</Th>
            <Th align="right">Detalhes</Th>
          </Tr>
        </TableHead>
        <TableBody>
          {filteredLogs.map(log => (
            <Tr key={log.id}>
              <Td className="whitespace-nowrap text-ink-soft dark:text-ink-soft-dark">{new Date(log.timestamp).toLocaleString('pt-BR')}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <span className={`h-6 w-6 rounded-full ${AVATAR_PALETTE[0]} text-white text-[9px] font-semibold flex items-center justify-center shrink-0`}>
                    {getInitials(log.userName)}
                  </span>
                  <div>
                    <span className="font-semibold text-ink dark:text-ink-dark block">{log.userName}</span>
                    <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark">{ROLE_LABELS[log.role]}</span>
                  </div>
                </div>
              </Td>
              <Td className="text-ink dark:text-ink-dark">{log.companyName || 'Operação global'}</Td>
              <Td>
                <span className="font-semibold text-ink dark:text-ink-dark">{log.action.replace(/_/g, ' ')}</span>
                <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark block mt-0.5">{log.entityType} · {log.entityId}</span>
              </Td>
              <Td className="font-mono text-[10px] text-ink-soft dark:text-ink-soft-dark">{eventIdentifier(log)}</Td>
              <Td align="right">
                <button onClick={() => setSelectedLog(log)} className="inline-flex items-center gap-1 text-brand-navy-900 dark:text-brand-navy-700/90 font-semibold hover:underline cursor-pointer">
                  <Eye className="h-3.5 w-3.5" /> Ver
                </button>
              </Td>
            </Tr>
          ))}
          {filteredLogs.length === 0 && (
            <Tr>
              <Td colSpan={6} className="p-12 text-center text-ink-soft dark:text-ink-soft-dark italic">
                Nenhum evento encontrado para os filtros selecionados.
              </Td>
            </Tr>
          )}
        </TableBody>
      </Table>

      <Modal
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="Detalhes do evento"
        description={selectedLog ? eventIdentifier(selectedLog) : undefined}
        size="lg"
      >
        {selectedLog && (
          <div className="space-y-5 text-xs">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                ['Data e hora', new Date(selectedLog.timestamp).toLocaleString('pt-BR')],
                ['Operador', selectedLog.userName],
                ['Perfil', ROLE_LABELS[selectedLog.role]],
                ['Empresa', selectedLog.companyName || 'Operação global'],
                ['Ação', selectedLog.action],
                ['Origem', selectedLog.origin],
                ['Entidade', `${selectedLog.entityType} · ${selectedLog.entityId}`],
                ['Endereço IP', selectedLog.ipAddress]
              ].map(([label, value]) => (
                <div key={label} className="bg-canvas dark:bg-white/5 border border-line dark:border-line-dark rounded-lg p-3">
                  <span className="text-[10px] uppercase font-semibold text-ink-soft dark:text-ink-soft-dark block">{label}</span>
                  <span className="text-ink dark:text-ink-dark font-semibold mt-1 block break-all">{value}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-ink-soft dark:text-ink-soft-dark mb-1">Dados anteriores</p>
              <pre className="bg-brand-navy-950 text-zinc-200 rounded-lg p-3 overflow-x-auto text-[10px]">{formatJson(selectedLog.previousData)}</pre>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-ink-soft dark:text-ink-soft-dark mb-1">Dados posteriores</p>
              <pre className="bg-brand-navy-950 text-zinc-200 rounded-lg p-3 overflow-x-auto text-[10px]">{formatJson(selectedLog.nextData)}</pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
