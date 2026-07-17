/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useBPOState } from '../hooks/useBPOState';
import { UserRole } from '../types';
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
  const [role, setRole] = useState<UserRole>('BPO_TEAM');
  const [title, setTitle] = useState('');
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);

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
    if (role !== 'BPO_ADMIN' && selectedCompanyIds.length === 0) {
      alert(role === 'CLIENT' ? 'Selecione a empresa deste usuário cliente.' : 'Selecione pelo menos uma empresa para este usuário.');
      return;
    }

    const permissionsByRole: Record<UserRole, string[]> = {
      BPO_ADMIN: [],
      BPO_TEAM: ['accounts-payable.view', 'accounts-payable.create', 'accounts-receivable.view', 'documents.upload', 'documents.download'],
      ACCOUNTANT: ['dashboard.view', 'documents.download', 'reports.view', 'reports.generate'],
      CLIENT: ['dashboard.view', 'approvals.approve', 'documents.upload', 'documents.download', 'reports.view', 'reports.generate']
    };

    const defaultTitles: Record<UserRole, string> = {
      BPO_ADMIN: 'Administrador do BPO', BPO_TEAM: 'Analista de BPO', ACCOUNTANT: 'Contador responsável', CLIENT: 'Usuário do cliente'
    };

    addTeamMember({
      name,
      email,
      role,
      title: title || defaultTitles[role],
      status: 'ACTIVE',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      companies: role === 'BPO_ADMIN' ? companies.map(company => company.id) : selectedCompanyIds,
      permissions: permissionsByRole[role]
    });

    setName('');
    setEmail('');
    setRole('BPO_TEAM');
    setTitle('');
    setSelectedCompanyIds([]);
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

  const handleUserCompanyToggle = (companyId: string) => {
    if (!selectedUser || selectedUser.role === 'BPO_ADMIN') return;
    const currentCompanies = selectedUser.companies || [];
    const updatedCompanies = selectedUser.role === 'CLIENT'
      ? [companyId]
      : currentCompanies.includes(companyId)
        ? currentCompanies.filter(id => id !== companyId)
        : [...currentCompanies, companyId];
    if (updatedCompanies.length === 0) {
      alert('Este perfil precisa permanecer vinculado a pelo menos uma empresa.');
      return;
    }
    updateTeamMemberPermissions(selectedUser.id, selectedUser.permissions, undefined, updatedCompanies);
  };

  return (
    <div id="team-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-sans">
        <div>
          <h2 id="team-title" className="text-xl font-bold text-zinc-900 tracking-tight">Usuários e Controle de Acesso (RBAC)</h2>
          <p className="text-zinc-500 text-xs">Cadastre a equipe BPO, contadores e usuários dos clientes com acesso restrito às empresas vinculadas.</p>
        </div>

        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#C8102E] hover:bg-[#8F071B] px-3.5 py-2.5 rounded-lg transition-colors cursor-pointer shadow-xs"
        >
          <UserPlus className="h-4 w-4" /> Cadastrar usuário
        </button>
      </div>

      {/* Invite Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans text-xs">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-5 border-b border-zinc-100 bg-gradient-to-r from-[#0B2C52] to-[#C8102E] text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Cadastrar usuário na plataforma</h3>
                <p className="text-[10px] text-[#F2D3A0] mt-0.5">Defina o perfil e as empresas que poderão ser acessadas.</p>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="text-[#F2D3A0] hover:text-white font-bold cursor-pointer">Fechar</button>
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
                    onChange={(e) => {
                      const nextRole = e.target.value as UserRole;
                      setRole(nextRole);
                      if (nextRole === 'BPO_ADMIN') setSelectedCompanyIds(companies.map(company => company.id));
                      if (nextRole === 'CLIENT' && selectedCompanyIds.length > 1) setSelectedCompanyIds(selectedCompanyIds.slice(0, 1));
                    }}
                  >
                    <option value="BPO_TEAM">Analista BPO</option>
                    <option value="BPO_ADMIN">Admin BPO</option>
                    <option value="ACCOUNTANT">Contador</option>
                    <option value="CLIENT">Usuário do cliente</option>
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

              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 block">Empresas vinculadas *</label>
                  <p className="text-[9px] text-zinc-400 mt-0.5">{role === 'CLIENT' ? 'Selecione a empresa à qual este usuário pertence.' : role === 'ACCOUNTANT' ? 'Selecione uma ou várias empresas atendidas pelo contador.' : role === 'BPO_ADMIN' ? 'Administradores possuem acesso global.' : 'Selecione as empresas operadas por este colaborador.'}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto border border-zinc-200 rounded-lg p-2 bg-zinc-50">
                  {companies.map(company => {
                    const checked = role === 'BPO_ADMIN' || selectedCompanyIds.includes(company.id);
                    return <label key={company.id} className="flex items-center gap-2 bg-white border border-zinc-200 rounded-lg p-2 cursor-pointer">
                      <input type={role === 'CLIENT' ? 'radio' : 'checkbox'} name="linked-company" checked={checked} disabled={role === 'BPO_ADMIN'} onChange={() => setSelectedCompanyIds(role === 'CLIENT' ? [company.id] : checked ? selectedCompanyIds.filter(id => id !== company.id) : [...selectedCompanyIds, company.id])} />
                      <span className="text-[10px] font-semibold text-zinc-700 truncate">{company.tradeName}</span>
                    </label>;
                  })}
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
                  className="bg-[#C8102E] hover:bg-[#8F071B] text-white font-bold px-4 py-2 rounded-lg cursor-pointer"
                >
                  Cadastrar usuário
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
            <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wide">Usuários cadastrados</h3>
            <p className="text-[10px] text-zinc-400">Equipe BPO, contadores e usuários vinculados aos clientes.</p>
          </div>

          <div className="divide-y divide-zinc-200">
            {users.map(user => {
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
                        <span className="text-[9px] text-[#0B2C52] font-semibold block font-normal">{user.role === 'BPO_ADMIN' ? 'Todas as empresas' : `${user.companies?.length || 0} empresa(s) vinculada(s)`}</span>
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

                <div className="space-y-3">
                  <div>
                    <h4 className="font-bold text-zinc-900 uppercase">Empresas permitidas</h4>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {selectedUser.role === 'CLIENT' ? 'O usuário cliente deve permanecer vinculado a uma única empresa.' : selectedUser.role === 'ACCOUNTANT' ? 'O contador pode atender uma ou várias empresas clientes.' : selectedUser.role === 'BPO_ADMIN' ? 'Administradores BPO possuem acesso global a todas as empresas.' : 'Defina quais operações este colaborador pode acessar.'}
                    </p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {companies.map(company => {
                      const checked = selectedUser.role === 'BPO_ADMIN' || selectedUser.companies?.includes(company.id);
                      return <label key={company.id} className={`flex items-center gap-2 border rounded-lg p-2.5 ${selectedUser.role === 'BPO_ADMIN' ? 'bg-zinc-50 cursor-not-allowed' : 'bg-white cursor-pointer hover:border-[#0B2C52]/40'}`}>
                        <input
                          type={selectedUser.role === 'CLIENT' ? 'radio' : 'checkbox'}
                          name={`company-${selectedUser.id}`}
                          checked={Boolean(checked)}
                          disabled={selectedUser.role === 'BPO_ADMIN'}
                          onChange={() => handleUserCompanyToggle(company.id)}
                        />
                        <span className="text-[10px] font-semibold text-zinc-700">{company.tradeName}</span>
                      </label>;
                    })}
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

                <div className="bg-[#0B2C52] border-l-4 border-[#C8102E] border-y border-r border-white/10 p-3.5 rounded-lg text-[10px] text-white/90 leading-normal font-sans flex items-start gap-2 font-semibold shadow-xs">
                  <ShieldAlert className="h-4 w-4 text-[#C8102E] shrink-0 mt-0.5" />
                  <span>As políticas de segurança corporativa do Grupo Idex Finance exigem a checagem dupla do IP de origem para auditoria contínua de modificações de contas.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
