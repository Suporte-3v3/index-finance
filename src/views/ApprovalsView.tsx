/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useBPOState } from '../hooks/useBPOState';
import { Approval } from '../types';
import { 
  Check, 
  X, 
  Clock, 
  AlertCircle, 
  ShieldCheck, 
  FileText, 
  User, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  History,
  MessageSquare
} from 'lucide-react';

export default function ApprovalsView() {
  const { 
    activeCompany, 
    approvals, 
    approveOrReject, 
    currentUser, 
    hasPermission 
  } = useBPOState();

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Decision Modal State
  const [decisionApprovalId, setDecisionApprovalId] = useState<string | null>(null);
  const [decisionType, setDecisionType] = useState<'Aprovada' | 'Rejeitada' | null>(null);
  const [comment, setComment] = useState('');

  if (!activeCompany) return null;

  const companyApprovals = approvals.filter(a => a.companyId === activeCompany.id);

  const pendingApprovals = companyApprovals.filter(a => a.status === 'Pendente');
  const historyApprovals = companyApprovals.filter(a => a.status !== 'Pendente');

  const openDecisionModal = (id: string, type: 'Aprovada' | 'Rejeitada') => {
    setDecisionApprovalId(id);
    setDecisionType(type);
    setComment('');
  };

  const handleDecisionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionApprovalId || !decisionType) return;

    if (decisionType === 'Rejeitada' && !comment.trim()) {
      alert('Justificativa é obrigatória para rejeições de pagamentos.');
      return;
    }

    approveOrReject(decisionApprovalId, decisionType, comment);
    setDecisionApprovalId(null);
    setDecisionType(null);
    setComment('');
  };

  return (
    <div id="approvals-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 id="approvals-title" className="text-xl font-bold text-zinc-900 tracking-tight font-sans">Central de Aprovações</h2>
          <p className="text-zinc-500 text-xs font-sans">Módulo de governança corporativa. Aprove faturas lançadas pelo BPO de forma segura e auditável.</p>
        </div>

        <div className="flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg font-bold font-sans">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
          LGPD & Assinatura Digital Ativos
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 gap-4 font-sans text-xs">
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-3 font-bold border-b-2 cursor-pointer transition-colors ${activeTab === 'pending' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}
        >
          Aprovações Pendentes ({pendingApprovals.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 font-bold border-b-2 cursor-pointer transition-colors ${activeTab === 'history' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}
        >
          Histórico e Decisões ({historyApprovals.length})
        </button>
      </div>

      {/* Decision Dialog Modal */}
      {decisionApprovalId && decisionType && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                Confirmar {decisionType === 'Aprovada' ? 'Aprovação' : 'Rejeição'} do Pagamento
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                {decisionType === 'Aprovada' 
                  ? 'Esta ação autoriza o BPO a agendar e liquidar este débito.' 
                  : 'Descreva detalhadamente o motivo para o BPO providenciar a correção.'}
              </p>
            </div>

            <form onSubmit={handleDecisionSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                  Justificativa / Comentário {decisionType === 'Rejeitada' && '*'}
                </label>
                <textarea
                  required={decisionType === 'Rejeitada'}
                  placeholder="Descreva observações para o BPO..."
                  rows={4}
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 text-xs"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>

              <div className="bg-zinc-50 p-3 rounded-lg text-[10px] text-zinc-400 leading-normal font-mono">
                Assinante: <strong>{currentUser.name}</strong> ({currentUser.role})<br />
                Token de Autenticação: SEC_{Math.random().toString(16).substr(2, 10).toUpperCase()}<br />
                IP do Dispositivo: 186.20.103.54
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setDecisionApprovalId(null); setDecisionType(null); }}
                  className="text-zinc-500 font-bold px-3 py-2 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`font-bold text-white px-4 py-2 rounded-lg cursor-pointer shadow-xs ${decisionType === 'Aprovada' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
                >
                  Confirmar Assinatura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main List */}
      <div className="space-y-4">
        {activeTab === 'pending' ? (
          pendingApprovals.length === 0 ? (
            <div className="bg-zinc-50 border border-zinc-200 border-dashed rounded-xl py-12 text-center space-y-2">
              <ShieldCheck className="h-10 w-10 text-zinc-300 mx-auto" />
              <p className="text-zinc-500 text-sm font-medium">Uau! Nenhuma aprovação pendente para esta empresa.</p>
              <p className="text-zinc-400 text-xs">A equipe do BPO está em dia com os lançamentos.</p>
            </div>
          ) : (
            pendingApprovals.map(apv => {
              const isExpanded = expandedId === apv.id;
              return (
                <div 
                  key={apv.id} 
                  id={`approval-pending-card-${apv.id}`}
                  className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs hover:border-zinc-300 transition-colors"
                >
                  <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Main details */}
                    <div className="space-y-1.5 flex-grow">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-100 font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wider">
                          PAGAMENTO PENDENTE
                        </span>
                        <span className="text-xs text-zinc-400">Solicitado em {new Date(apv.createdAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <h3 className="text-sm font-bold text-zinc-900">{apv.description}</h3>
                      <p className="text-xs text-zinc-500">Solicitante: {apv.requesterName} (Equipe BPO) | Vence em: <strong>{new Date(apv.dueDate).toLocaleDateString('pt-BR')}</strong></p>
                    </div>

                    {/* Amount & Actions */}
                    <div className="flex flex-row md:flex-col items-baseline md:items-end justify-between md:justify-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Valor Solicitado</span>
                        <span className="text-lg font-black text-zinc-900 font-mono">
                          R$ {apv.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {hasPermission('approvals.approve') ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openDecisionModal(apv.id, 'Aprovada')}
                            className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" /> Aprovar
                          </button>
                          <button
                            onClick={() => openDecisionModal(apv.id, 'Rejeitada')}
                            className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" /> Rejeitar
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-rose-500 bg-rose-50 px-2 py-1 rounded">Apenas leitura</span>
                      )}
                    </div>
                  </div>

                  {/* Attachment view */}
                  {apv.attachmentName && (
                    <div className="px-5 py-3 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-zinc-600 font-medium">
                        <FileText className="h-4 w-4 text-zinc-400 shrink-0" />
                        <span>Fatura / Boleto Anexo: <strong>{apv.attachmentName}</strong></span>
                      </div>
                      <a 
                        href="#" 
                        onClick={(e) => { e.preventDefault(); alert('Iniciando transferência direta segura...'); }}
                        className="text-[11px] text-zinc-900 font-bold hover:underline flex items-center gap-1"
                      >
                        Baixar boleto <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : (
          historyApprovals.length === 0 ? (
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl py-12 text-center text-zinc-400 text-xs italic">
              Nenhuma aprovação arquivada no histórico de auditoria.
            </div>
          ) : (
            historyApprovals.map(apv => {
              const isExpanded = expandedId === apv.id;
              const step = apv.history[apv.history.length - 1]; // Latest decision step

              return (
                <div key={apv.id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                          apv.status === 'Aprovada' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {apv.status.toUpperCase()}
                        </span>
                        <span className="text-[11px] text-zinc-400 font-mono">ID: {apv.id}</span>
                      </div>
                      <h3 className="text-sm font-bold text-zinc-800">{apv.description}</h3>
                      <p className="text-xs text-zinc-500">
                        Decidido em {step ? new Date(step.timestamp).toLocaleString('pt-BR') : new Date().toLocaleDateString('pt-BR')} por <strong>{step?.userName || 'Cliente'}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-6 justify-between md:justify-end shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-zinc-400 font-semibold block uppercase">Valor Final</span>
                        <span className="text-sm font-bold text-zinc-800 font-mono">R$ {apv.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <button 
                        onClick={() => setExpandedId(isExpanded ? null : apv.id)}
                        className="p-1.5 hover:bg-zinc-100 rounded-md cursor-pointer text-zinc-500"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expansion for Step audits */}
                  {isExpanded && (
                    <div className="p-5 bg-zinc-50/50 border-t border-zinc-100 space-y-4 text-xs text-zinc-600">
                      <h4 className="font-bold text-zinc-800 flex items-center gap-1">
                        <History className="h-4 w-4" /> Rastro Histórico de Assinatura
                      </h4>

                      <div className="space-y-3 pl-4 border-l-2 border-zinc-200">
                        {apv.history.map((h, i) => (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center justify-between font-mono text-[10px]">
                              <span className="font-bold text-zinc-800">{h.userName} ({h.role.replace(/_/g, ' ')})</span>
                              <span className="text-zinc-400">{new Date(h.timestamp).toLocaleString('pt-BR')}</span>
                            </div>
                            <div className="bg-white p-2.5 rounded-lg border border-zinc-200">
                              <span className={`text-[10px] font-bold uppercase ${h.decision === 'Aprovada' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {h.decision}
                              </span>
                              {h.comment && (
                                <p className="mt-1 text-xs text-zinc-600 flex items-start gap-1">
                                  <MessageSquare className="h-3 w-3 mt-0.5 text-zinc-400 shrink-0" />
                                  <span>"{h.comment}"</span>
                                </p>
                              )}
                            </div>
                            <div className="text-[9px] text-zinc-400 font-mono pl-1">
                              IP Origem: {h.ipAddress} | User Agent: {h.userAgent.substring(0, 50)}...
                            </div>
                          </div>
                        ))}
                        {apv.history.length === 0 && (
                          <div className="space-y-1">
                            <span className="font-bold text-zinc-700 font-mono">Assinatura Automática / Legado</span>
                            <p className="bg-white p-2.5 rounded-lg border border-zinc-200 italic text-zinc-400">Sem rastro adicional de formulário.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
}
