/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useBPOState } from '../hooks/useBPOState';
import { User } from '../types';
import { 
  Plus, 
  ShieldAlert, 
  Check, 
  UserPlus, 
  Key, 
  Building, 
  Layers, 
  Mail, 
  UserCheck2,
  Trash2,
  Lock
} from 'lucide-react';

export default function TeamView() {
  const { 
    users, 
    companies, 
    addTeamMember, 
    updateTeamMemberPermissions, 
    currentUser 
  } = useBPOState();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Invitation Form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'BPO_ADMIN' | 'BPO_TEAM' | 'ACCOUNTANT'>('BPO_TEAM');
  const [title, setTitle] = useState('');

  if (currentUser.role !== 'BPO_ADMIN') {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-zinc-500 text-xs italic">
        Apenas "Administradores do BPO" podem editar permissões e convidar novos analistas/colaboradores.
      </div>
    );
  }

  const selectedUser = users.find(u => u.id === selectedUserId);

  const availablePermissions = [
    { id: 'operations-center.view', name: 'Visualizar Centro de Operações', cat: 'BPO Admin' },
    { id: 'companies.manage', name: 'Cadastrar/Modificar Empresas Clientes', cat: 'BPO Admin' },
    { id: 'team.manage', name: 'Gerenciar Equipe e Permissões (RBAC)', cat: 'BPO Admin' },
    { id: 'audit-logs.view', name: 'Visualizar Logs Globais de Auditoria', cat: 'Auditoria' },
    { id: 'accounts-payable.view', name: 'Consultar Contas a Pagar', cat: 'Operações' },
    { id: 'accounts-payable.create', name: 'Lançar Nova Conta a Pagar', cat: 'Operações' },
    { id: 'accounts-payable.update', name: 'Editar Lançamento a Pagar', cat: 'Operações' },
    { id: 'accounts-payable.cancel', name: 'Cancelar Contas a Pagar', cat: 'Operações' },
    { id: 'accounts-receivable.view', name: 'Consultar Faturamentos', cat: 'Operações' },
    { id: 'accounts-receivable.create', name: 'Lançar Novo Faturamento', cat: 'Operações' },
    { id: 'accounts-receivable.update', name: 'Editar Faturamento', cat: 'Operações' },
    { id: 'accounts-receivable.cancel', name: 'Cancelar Faturamento', cat: 'Operações' },
    { id: 'approvals.request', name: 'Solicitar Aprovações de Fatura', cat: 'Operações' },
    { id: 'approvals.approve', name: 'Aprovar / Rejeitar Pagamentos', cat: 'Cliente' },
    { id: 'documents.upload', name: 'Realizar Upload de Documentos', cat: 'Documentos' },
    { id: 'documents.download', name: 'Baixar Documentos via URL Assinada', cat: 'Documentos' },
    { id: 'reports.generate', name: 'Gerar e Exportar Relatórios/DRE', cat: 'Documentos' },
    { id: 'reconciliation.execute', name: 'Executar Conciliação Bancária (OFX)', cat: 'Operações' },
  ];

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      alert('Preencha os campos obrigatórios.');
      return;
    }

    addTeamMember({
      name,
      email,
      role,
      title: title || 'Analista de BPO',
      status: 'ACTIVE',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      companies: ['c-101', 'c-102'], // Assigned default companies
      permissions: [
        'accounts-payable.view',
        'accounts-payable.create',
        'accounts-receivable.view',
        'documents.upload',
        'documents.download'
      ]
    });

    setName('');
    setEmail('');
    setRole('BPO_TEAM');
    setTitle('');
    setIsFormOpen(false);
  };

  const handleTogglePermission = (permissionId: string) => {
    if (!selectedUserId) return;
    const currentPerms = selectedUser?.permissions || [];
    
    let updatedPerms;
    if (currentPerms.includes(permissionId)) {
      updatedPerms = currentPerms.filter(p => p !== permissionId);
    } else {
      updatedPerms = [...currentPerms, permissionId];
    }

    updateTeamMemberPermissions(selectedUserId, updatedPerms);
  };

  const handleStatusToggle = (userId: string, isCurrentlyActive: boolean) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    updateTeamMemberPermissions(userId, target.permissions, isCurrentlyActive ? 'INACTIVE' : 'ACTIVE');
  };

  return (
    <div id="team-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-sans">
        <div>
          <h2 id="team-title" className="text-xl font-bold text-zinc-900 tracking-tight">Equipe BPO e Controle de Acesso (RBAC)</h2>
          <p className="text-zinc-500 text-xs">Adicione analistas de BPO, limite os acessos por empresa e gerencie detalhadamente as chaves de segurança de cada colaborador.</p>
        </div>

        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#d20010] hover:bg-[#850000] px-3.5 py-2.5 rounded-lg transition-colors cursor-pointer shadow-xs"
        >
          <UserPlus className="h-4 w-4" /> Convidar Colaborador
        </button>
      </div>

      {/* Invite Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans text-xs">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-5 border-b border-zinc-100 bg-gradient-to-r from-[#00304c] to-[#d20010] text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Enviar Convite à Plataforma</h3>
                <p className="text-[10px] text-[#ffefd1] mt-0.5">Defina alçadas operacionais do Index Finance.</p>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="text-[#ffefd1] hover:text-white font-bold cursor-pointer">Fechar</button>
            </div>

            <form onSubmit={handleInvite} className="p-5 space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 block">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome do analista..."
                  className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 block">E-mail Corporativo *</label>
                <input
                  type="email"
                  required
                  placeholder="analista@gruponobre.com"
                  className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono focus:outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 block">Perfil Padrão</label>
                  <select
                    className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs cursor-pointer"
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                  >
                    <option value="BPO_TEAM">Analista BPO</option>
                    <option value="BPO_ADMIN">Admin BPO</option>
                    <option value="ACCOUNTANT">Contador</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 block">Cargo / Cargo</label>
                  <input
                    type="text"
                    placeholder="Ex: Analista Jr."
                    className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-zinc-500 font-bold px-3 py-2 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#d20010] hover:bg-[#850000] text-white font-bold px-4 py-2 rounded-lg cursor-pointer"
                >
                  Enviar Convite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
        
        {/* Left Column: Team list */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-xs lg:col-span-1 overflow-hidden">
          <div className="p-4 bg-zinc-50/50 border-b border-zinc-100">
            <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wide">Colaboradores de BPO</h3>
            <p className="text-[10px] text-zinc-400">Clique em um perfil para abrir e configurar chaves de segurança (RBAC) à direita.</p>
          </div>

          <div className="divide-y divide-zinc-200">
            {users
              .filter(u => u.role !== 'CLIENT') // only display internal BPO analysts/accountants here
              .map(user => {
                const isSelected = selectedUserId === user.id;
                const isActive = user.status === 'ACTIVE';

                return (
                  <div 
                    key={user.id}
                    onClick={() => setSelectedUserId(isSelected ? null : user.id)}
                    className={`p-4 hover:bg-zinc-50/50 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                      isSelected ? 'bg-zinc-50/70 border-r-2 border-zinc-900 font-bold' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img src={user.avatar} className="h-9 w-9 rounded-full object-cover border border-zinc-200 shrink-0" alt={user.name} />
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-zinc-900 leading-tight">{user.name}</h4>
                        <span className="text-[10px] text-zinc-400 block font-normal">{user.title || 'Membro do Time'}</span>
                        <span className="text-[9px] font-mono text-zinc-400 font-normal">{user.email}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                      <span className={`text-[9px] font-bold block ${
                        user.role === 'BPO_ADMIN' ? 'text-zinc-800' : 'text-zinc-500'
                      }`}>
                        {user.role.replace(/_/g, ' ')}
                      </span>

                      <button
                        onClick={() => handleStatusToggle(user.id, isActive)}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded cursor-pointer ${
                          isActive ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        {isActive ? 'Ativo' : 'Inativo'}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Right Column: Permission Matrix Control */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-xs lg:col-span-2 overflow-hidden">
          <div className="p-4 bg-zinc-50/50 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wide">Painel de Acesso Granular (RBAC)</h3>
            {selectedUser && (
              <span className="text-[10px] font-bold text-zinc-600 font-mono">
                Ativo: {selectedUser.name}
              </span>
            )}
          </div>

          <div className="p-5">
            {!selectedUser ? (
              <div className="py-24 text-center text-zinc-400 text-xs italic space-y-2">
                <Lock className="h-8 w-8 mx-auto text-zinc-300" />
                <p>Selecione um colaborador na coluna à esquerda para gerenciar o perfil de segurança e acessos de banco.</p>
              </div>
            ) : (
              <div className="space-y-6 text-xs animate-in fade-in duration-150">
                <div className="flex items-start gap-4 p-4 bg-zinc-50 rounded-xl border border-zinc-200/50">
                  <Key className="h-6 w-6 text-zinc-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-zinc-900 uppercase">Perfil de Regulação de Acessos</h4>
                    <p className="text-zinc-500">As marcações abaixo representam as permissões vigentes que controlam a renderização dinâmica de botões e ações no faturamento deste colaborador.</p>
                  </div>
                </div>

                {/* Permissions categories lists */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Category BPO Admin & Auditoria */}
                  <div className="space-y-4">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block border-b border-zinc-100 pb-1.5">Ações Administrativas / Auditoria</span>
                    <div className="space-y-3">
                      {availablePermissions
                        .filter(p => p.cat === 'BPO Admin' || p.cat === 'Auditoria')
                        .map(p => {
                          const isChecked = selectedUser.permissions.includes(p.id);
                          const isDisabled = selectedUser.role === 'BPO_ADMIN'; // Admin has implicit access to all

                          return (
                            <label key={p.id} className="flex items-start gap-2.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                disabled={isDisabled}
                                checked={isChecked || isDisabled}
                                onChange={() => handleTogglePermission(p.id)}
                                className="mt-0.5 rounded cursor-pointer text-zinc-950 focus:ring-0"
                              />
                              <div className="space-y-0.5">
                                <span className={`font-semibold block ${isDisabled ? 'text-zinc-400' : 'text-zinc-800'}`}>{p.name}</span>
                                {isDisabled && <span className="text-[8px] bg-zinc-100 text-zinc-500 px-1 py-0.2 rounded font-mono">Implicitamente cedido (BPO Admin)</span>}
                              </div>
                            </label>
                          );
                        })}
                    </div>
                  </div>

                  {/* Category Operações & Documentos */}
                  <div className="space-y-4">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block border-b border-zinc-100 pb-1.5">Gestão Financeira & Documental</span>
                    <div className="space-y-3">
                      {availablePermissions
                        .filter(p => p.cat === 'Operações' || p.cat === 'Documentos' || p.cat === 'Cliente')
                        .map(p => {
                          const isChecked = selectedUser.permissions.includes(p.id);
                          const isDisabled = selectedUser.role === 'BPO_ADMIN';

                          return (
                            <label key={p.id} className="flex items-start gap-2.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                disabled={isDisabled}
                                checked={isChecked || isDisabled}
                                onChange={() => handleTogglePermission(p.id)}
                                className="mt-0.5 rounded cursor-pointer text-zinc-950 focus:ring-0"
                              />
                              <div className="space-y-0.5">
                                <span className={`font-semibold block ${isDisabled ? 'text-zinc-400' : 'text-zinc-800'}`}>{p.name}</span>
                                {isDisabled && <span className="text-[8px] bg-zinc-100 text-zinc-500 px-1 py-0.2 rounded font-mono">Implicitamente cedido (BPO Admin)</span>}
                              </div>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                </div>

                <div className="bg-[#00304c] border-l-4 border-[#d20010] border-y border-r border-white/10 p-3.5 rounded-lg text-[10px] text-white/90 leading-normal font-sans flex items-start gap-2 font-semibold shadow-xs">
                  <ShieldAlert className="h-4 w-4 text-[#d20010] shrink-0 mt-0.5" />
                  <span>As políticas de segurança corporativa do Grupo Index Finance exigem a checagem dupla do IP de origem para auditoria contínua de modificações de contas.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
