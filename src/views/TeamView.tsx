/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useBPOState } from '../hooks/useBPOState';
import { UserRole } from '../types';
import { Badge, Button, Card, EmptyState, IconButton, Modal } from '../components/ui';
import {
  ShieldAlert,
  Check,
  UserPlus,
  Key,
  KeyRound,
  Trash2,
  Lock,
  Pencil,
  X,
  Copy,
} from 'lucide-react';

const getInitials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();

export default function TeamView() {
  const {
    users,
    companies,
    addTeamMember,
    updateTeamMemberPermissions,
    updateTeamMember,
    deleteTeamMember,
    resetTeamMemberPassword,
    setTeamMemberPassword,
    currentUser
  } = useBPOState();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('CLIENT');
  const [editError, setEditError] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [temporaryPasswordEmail, setTemporaryPasswordEmail] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isSetPasswordOpen, setIsSetPasswordOpen] = useState(false);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [confirmPasswordValue, setConfirmPasswordValue] = useState('');
  const [setPasswordError, setSetPasswordError] = useState('');
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  // Invitation Form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('BPO_TEAM');
  const [title, setTitle] = useState('');
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [clientOperator, setClientOperator] = useState(false);

  if (currentUser.role !== 'BPO_ADMIN') {
    return (
      <Card className="text-center text-ink-soft dark:text-ink-soft-dark text-xs italic">
        Apenas "Administradores do BPO" podem editar permissões e convidar novos analistas/colaboradores.
      </Card>
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

  const handleInvite = async (e: React.FormEvent) => {
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

    const isOperator = role === 'CLIENT' && clientOperator;

    setIsSavingUser(true);
    const result = await addTeamMember({
      name,
      email,
      role,
      title: title || defaultTitles[role],
      status: 'ACTIVE',
      companies: role === 'BPO_ADMIN' ? companies.map(company => company.id) : selectedCompanyIds,
      permissions: isOperator
        ? permissionsByRole[role].filter(p => p !== 'approvals.approve')
        : permissionsByRole[role],
      clientOperator: isOperator,
    });
    setIsSavingUser(false);
    if (!result.success || !result.temporaryPassword) {
      alert(result.error || 'Não foi possível criar o usuário.');
      return;
    }

    setName('');
    setEmail('');
    setRole('BPO_TEAM');
    setTitle('');
    setSelectedCompanyIds([]);
    setClientOperator(false);
    setIsFormOpen(false);
    setTemporaryPasswordEmail(email.trim().toLowerCase());
    setTemporaryPassword(result.temporaryPassword);
  };

  const handleTogglePermission = async (permissionId: string) => {
    if (!selectedUserId) return;
    const currentPerms = selectedUser?.permissions || [];

    let updatedPerms;
    if (currentPerms.includes(permissionId)) {
      updatedPerms = currentPerms.filter(p => p !== permissionId);
    } else {
      updatedPerms = [...currentPerms, permissionId];
    }

    const result = await updateTeamMemberPermissions(selectedUserId, updatedPerms);
    if (!result.success) alert(result.error || 'Não foi possível atualizar a permissão.');
  };

  const handleStatusToggle = async (userId: string, isCurrentlyActive: boolean) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    const result = await updateTeamMemberPermissions(userId, target.permissions, isCurrentlyActive ? 'INACTIVE' : 'ACTIVE');
    if (!result.success) alert(result.error || 'Não foi possível atualizar o status.');
  };

  const handleUserCompanyToggle = async (companyId: string) => {
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
    const result = await updateTeamMemberPermissions(selectedUser.id, selectedUser.permissions, undefined, updatedCompanies);
    if (!result.success) alert(result.error || 'Não foi possível atualizar as empresas.');
  };

  const handleClientOperatorToggle = async () => {
    if (!selectedUser || selectedUser.role !== 'CLIENT') return;
    const nextIsOperator = !selectedUser.clientOperator;
    const result = await updateTeamMemberPermissions(
      selectedUser.id,
      nextIsOperator
        ? selectedUser.permissions.filter(p => p !== 'approvals.approve')
        : selectedUser.permissions,
      undefined,
      undefined,
      nextIsOperator
    );
    if (!result.success) alert(result.error || 'Não foi possível atualizar o perfil.');
  };

  const startEditingProfile = () => {
    if (!selectedUser) return;
    setEditName(selectedUser.name);
    setEditEmail(selectedUser.email);
    setEditTitle(selectedUser.title || '');
    setEditRole(selectedUser.role);
    setEditError('');
    setIsEditingProfile(true);
  };

  const cancelEditingProfile = () => {
    setIsEditingProfile(false);
    setEditError('');
  };

  const handleSaveProfile = async () => {
    if (!selectedUser) return;
    const result = await updateTeamMember(selectedUser.id, {
      name: editName,
      email: editEmail,
      title: editTitle,
      role: editRole,
    });
    if (!result.success) {
      setEditError(result.error || 'Não foi possível salvar as alterações.');
      return;
    }
    setIsEditingProfile(false);
    setEditError('');
  };

  const handleDeleteUser = async (id: string, userName: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir "${userName}"? Esta ação não pode ser desfeita.`)) return;
    const result = await deleteTeamMember(id);
    if (!result.success) {
      alert(result.error || 'Não foi possível excluir este usuário.');
      return;
    }
    if (selectedUserId === id) setSelectedUserId(null);
  };

  const handleResetPassword = async (userId: string, userEmail: string) => {
    if (!window.confirm(`Gerar uma nova senha temporária para ${userEmail}? Todas as sessões atuais serão encerradas.`)) return;
    const result = await resetTeamMemberPassword(userId);
    if (!result.success || !result.temporaryPassword) {
      alert(result.error || 'Não foi possível redefinir a senha.');
      return;
    }
    setTemporaryPasswordEmail(userEmail);
    setTemporaryPassword(result.temporaryPassword);
  };

  const openSetPassword = () => {
    setNewPasswordValue('');
    setConfirmPasswordValue('');
    setSetPasswordError('');
    setIsSetPasswordOpen(true);
  };

  const closeSetPassword = () => {
    setIsSetPasswordOpen(false);
    setNewPasswordValue('');
    setConfirmPasswordValue('');
    setSetPasswordError('');
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (newPasswordValue.length < 12 || newPasswordValue.length > 128) {
      setSetPasswordError('A senha deve ter entre 12 e 128 caracteres.');
      return;
    }
    if (newPasswordValue !== confirmPasswordValue) {
      setSetPasswordError('As senhas informadas não coincidem.');
      return;
    }
    setIsSettingPassword(true);
    const result = await setTeamMemberPassword(selectedUser.id, newPasswordValue);
    setIsSettingPassword(false);
    if (!result.success) {
      setSetPasswordError(result.error || 'Não foi possível definir a senha.');
      return;
    }
    closeSetPassword();
  };

  return (
    <div id="team-root" className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 id="team-title" className="text-2xl sm:text-3xl font-bold text-ink dark:text-ink-dark tracking-tight">Usuários e Controle de Acesso (RBAC)</h1>
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark leading-relaxed">Cadastre a equipe BPO, contadores e usuários dos clientes com acesso restrito às empresas vinculadas.</p>
        </div>

        <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setIsFormOpen(true)}>
          Adicionar perfil
        </Button>
      </div>

      {/* Invite Modal */}
      <Modal
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Criar usuário"
        description="Defina o perfil e as empresas. A credencial será criada no PostgreSQL."
        footer={
          <>
            <Button
              variant="text"
              onClick={() => setIsFormOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" form="team-invite-form" loading={isSavingUser} disabled={isSavingUser}>
              Criar usuário e credencial
            </Button>
          </>
        }
      >
        <form id="team-invite-form" onSubmit={handleInvite} className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">Nome Completo *</label>
            <input
              type="text"
              required
              placeholder="Nome do analista..."
              className="w-full p-2 bg-canvas dark:bg-white/5 border border-line dark:border-line-dark text-ink dark:text-ink-dark rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">E-mail Corporativo *</label>
            <input
              type="email"
              required
              placeholder="analista@gruponobre.com"
              className="w-full p-2 bg-canvas dark:bg-white/5 border border-line dark:border-line-dark text-ink dark:text-ink-dark rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="rounded-lg border border-brand-navy-700/20 bg-brand-blue-50 p-3 text-[10px] leading-relaxed text-brand-navy-900 dark:bg-brand-navy-900/20 dark:text-brand-blue-100">
            O servidor gerará uma senha temporária, exibida uma única vez. O
            usuário deverá alterá-la no primeiro acesso.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">Perfil Padrão</label>
              <select
                className="w-full p-2 bg-canvas dark:bg-white/5 border border-line dark:border-line-dark text-ink dark:text-ink-dark rounded-lg text-xs cursor-pointer dark:[color-scheme:dark]"
                value={role}
                onChange={(e) => {
                  const nextRole = e.target.value as UserRole;
                  setRole(nextRole);
                  if (nextRole === 'BPO_ADMIN') setSelectedCompanyIds(companies.map(company => company.id));
                  if (nextRole === 'CLIENT' && selectedCompanyIds.length > 1) setSelectedCompanyIds(selectedCompanyIds.slice(0, 1));
                  if (nextRole !== 'CLIENT') setClientOperator(false);
                }}
              >
                <option value="BPO_TEAM">Analista BPO</option>
                <option value="BPO_ADMIN">Admin BPO</option>
                <option value="ACCOUNTANT">Contador</option>
                <option value="CLIENT">Usuário do cliente</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">Cargo / Cargo</label>
              <input
                type="text"
                placeholder="Ex: Analista Jr."
                className="w-full p-2 bg-canvas dark:bg-white/5 border border-line dark:border-line-dark text-ink dark:text-ink-dark rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">Empresas vinculadas *</label>
              <p className="text-[9px] text-ink-soft dark:text-ink-soft-dark mt-0.5">{role === 'CLIENT' ? 'Selecione a empresa à qual este usuário pertence.' : role === 'ACCOUNTANT' ? 'Selecione uma ou várias empresas atendidas pelo contador.' : role === 'BPO_ADMIN' ? 'Administradores possuem acesso global.' : 'Selecione as empresas operadas por este colaborador.'}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto border border-line dark:border-line-dark rounded-lg p-2 bg-canvas dark:bg-white/5">
              {companies.map(company => {
                const checked = role === 'BPO_ADMIN' || selectedCompanyIds.includes(company.id);
                return <label key={company.id} className="flex items-center gap-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark text-ink dark:text-ink-dark rounded-lg p-2 cursor-pointer">
                  <input type={role === 'CLIENT' ? 'radio' : 'checkbox'} name="linked-company" checked={checked} disabled={role === 'BPO_ADMIN'} onChange={() => setSelectedCompanyIds(role === 'CLIENT' ? [company.id] : checked ? selectedCompanyIds.filter(id => id !== company.id) : [...selectedCompanyIds, company.id])} />
                  <span className="text-[10px] font-semibold text-ink dark:text-ink-dark truncate">{company.tradeName}</span>
                </label>;
              })}
            </div>
          </div>

          {role === 'CLIENT' && (
            <label className="flex items-start gap-2.5 bg-canvas dark:bg-white/5 border border-line dark:border-line-dark text-ink dark:text-ink-dark rounded-lg p-3 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-0.5 rounded cursor-pointer text-brand-navy-900 focus:ring-0"
                checked={clientOperator}
                onChange={(e) => setClientOperator(e.target.checked)}
              />
              <div className="space-y-0.5">
                <span className="font-semibold text-ink dark:text-ink-dark block">Operador do cliente</span>
                <span className="text-[9px] text-ink-soft dark:text-ink-soft-dark block">No Caixa da Padaria, este usuário só verá o saldo diário da Bolsa (movimentações do dia), sem acesso ao saldo acumulado.</span>
              </div>
            </label>
          )}
        </form>
      </Modal>

      <Modal
        open={Boolean(temporaryPassword)}
        onClose={() => {
          setTemporaryPassword('');
          setTemporaryPasswordEmail('');
        }}
        title="Senha temporária criada"
        description={`Copie e entregue com segurança para ${temporaryPasswordEmail}. Ela não será exibida novamente.`}
        footer={
          <Button
            onClick={() => {
              setTemporaryPassword('');
              setTemporaryPasswordEmail('');
            }}
          >
            Entendi
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas p-3 dark:border-line-dark dark:bg-white/5">
            <code className="min-w-0 flex-1 select-all break-all text-sm font-bold text-ink dark:text-ink-dark">
              {temporaryPassword}
            </code>
            <IconButton
              icon={<Copy />}
              label="Copiar senha temporária"
              onClick={() => void navigator.clipboard.writeText(temporaryPassword)}
            />
          </div>
          <p className="text-[10px] leading-relaxed text-ink-soft dark:text-ink-soft-dark">
            No primeiro login, o usuário precisará trocar esta senha antes de acessar qualquer empresa.
          </p>
        </div>
      </Modal>

      {/* Set Specific Password Modal */}
      <Modal
        open={isSetPasswordOpen}
        onClose={closeSetPassword}
        title="Definir senha"
        description={selectedUser ? `Escolha a nova senha de acesso de ${selectedUser.email}.` : undefined}
        footer={
          <>
            <Button variant="text" onClick={closeSetPassword}>
              Cancelar
            </Button>
            <Button type="submit" form="team-set-password-form" loading={isSettingPassword} disabled={isSettingPassword}>
              Salvar senha
            </Button>
          </>
        }
      >
        <form id="team-set-password-form" onSubmit={handleSetPassword} className="space-y-3 text-xs">
          {setPasswordError && <p className="text-brand-red-600 font-semibold">{setPasswordError}</p>}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">Nova senha *</label>
            <input
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              className="w-full p-2 bg-canvas dark:bg-white/5 border border-line dark:border-line-dark text-ink dark:text-ink-dark rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30"
              value={newPasswordValue}
              onChange={(e) => setNewPasswordValue(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">Confirmar nova senha *</label>
            <input
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              className="w-full p-2 bg-canvas dark:bg-white/5 border border-line dark:border-line-dark text-ink dark:text-ink-dark rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30"
              value={confirmPasswordValue}
              onChange={(e) => setConfirmPasswordValue(e.target.value)}
            />
          </div>
          <div className="rounded-lg border border-brand-navy-700/20 bg-brand-blue-50 p-3 text-[10px] leading-relaxed text-brand-navy-900 dark:bg-brand-navy-900/20 dark:text-brand-blue-100">
            Mínimo de 12 caracteres. A senha entra em vigor imediatamente e todas as sessões atuais deste usuário serão encerradas.
          </div>
        </form>
      </Modal>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left Column: Team list */}
        <Card padding={false} className="lg:col-span-1 overflow-hidden">
          <div className="p-4 bg-canvas/60 dark:bg-white/[0.02] border-b border-line dark:border-line-dark">
            <h3 className="text-xs font-bold text-ink dark:text-ink-dark uppercase tracking-wide">Usuários cadastrados</h3>
            <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark">Equipe BPO, contadores e usuários vinculados aos clientes.</p>
          </div>

          <div className="divide-y divide-line dark:divide-line-dark">
            {users.map(user => {
                const isSelected = selectedUserId === user.id;
                const isActive = user.status === 'ACTIVE';

                return (
                  <div
                    key={user.id}
                    onClick={() => {
                      setSelectedUserId(isSelected ? null : user.id);
                      setIsEditingProfile(false);
                    }}
                    className={`p-4 hover:bg-canvas/60 dark:hover:bg-white/[0.03] cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                      isSelected ? 'bg-canvas/70 dark:bg-white/[0.04] border-r-2 border-brand-navy-900 dark:border-brand-navy-700 font-semibold' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-7 w-7 rounded-full bg-brand-navy-900 text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
                        {getInitials(user.name)}
                      </span>
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-semibold text-ink dark:text-ink-dark leading-tight">{user.name}</h4>
                        <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark block font-normal">{user.title || 'Membro do Time'}</span>
                        <span className="text-[9px] font-mono text-ink-soft dark:text-ink-soft-dark font-normal">{user.email}</span>
                        <span className="text-[9px] text-brand-navy-900 dark:text-brand-navy-700/90 font-semibold block font-normal">{user.role === 'BPO_ADMIN' ? 'Todas as empresas' : `${user.companies?.length || 0} empresa(s) vinculada(s)`}</span>
                        {user.role === 'CLIENT' && user.clientOperator && (
                          <Badge tone="gold" className="mt-0.5">Operador</Badge>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                      <span className={`text-[9px] font-semibold block ${
                        user.role === 'BPO_ADMIN' ? 'text-ink dark:text-ink-dark' : 'text-ink-soft dark:text-ink-soft-dark'
                      }`}>
                        {user.role.replace(/_/g, ' ')}
                      </span>

                      <button
                        onClick={() => handleStatusToggle(user.id, isActive)}
                        className="cursor-pointer"
                      >
                        <Badge tone={isActive ? 'green' : 'red'}>
                          {isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </button>

                      {user.id !== currentUser.id && (
                        <button
                          onClick={() => handleDeleteUser(user.id, user.name)}
                          title="Excluir usuário"
                          className="text-[9px] font-semibold text-ink-soft dark:text-ink-soft-dark hover:text-brand-red-600 cursor-pointer inline-flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" /> Excluir
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>

        {/* Right Column: Permission Matrix Control */}
        <Card padding={false} className="lg:col-span-2 overflow-hidden">
          <div className="p-4 bg-canvas/60 dark:bg-white/[0.02] border-b border-line dark:border-line-dark flex items-center justify-between">
            <h3 className="text-xs font-bold text-ink dark:text-ink-dark uppercase tracking-wide">Painel de Acesso Granular (RBAC)</h3>
            {selectedUser && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-ink dark:text-ink-dark font-mono">
                  Ativo: {selectedUser.name}
                </span>
                {!isEditingProfile && (
                  <IconButton
                    icon={<Pencil />}
                    label="Editar dados do usuário"
                    variant="default"
                    size="sm"
                    onClick={startEditingProfile}
                  />
                )}
                {selectedUser.id !== currentUser.id && (
                  <>
                    <IconButton
                      icon={<Key />}
                      label="Gerar nova senha temporária"
                      size="sm"
                      onClick={() => void handleResetPassword(selectedUser.id, selectedUser.email)}
                    />
                    <IconButton
                      icon={<KeyRound />}
                      label="Definir senha específica"
                      size="sm"
                      onClick={openSetPassword}
                    />
                    <IconButton
                      icon={<Trash2 />}
                      label="Desativar usuário"
                      variant="danger"
                      size="sm"
                      onClick={() => void handleDeleteUser(selectedUser.id, selectedUser.name)}
                    />
                  </>
                )}
              </div>
            )}
          </div>

          <div className="p-5">
            {!selectedUser ? (
              <EmptyState
                icon={<Lock />}
                title="Nenhum colaborador selecionado"
                description="Selecione um colaborador na coluna à esquerda para gerenciar o perfil de segurança e acessos de banco."
                className="py-24"
              />
            ) : (
              <div className="space-y-6 text-xs">
                {isEditingProfile ? (
                  <div className="space-y-3 p-4 bg-canvas dark:bg-white/5 rounded-lg border border-line dark:border-line-dark">
                    <div className="flex items-center gap-2 text-ink dark:text-ink-dark font-bold uppercase">
                      <Pencil className="h-4 w-4" /> Editar dados do usuário
                    </div>
                    {editError && <p className="text-brand-red-600 font-semibold">{editError}</p>}
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">Nome</label>
                        <input
                          type="text"
                          className="w-full p-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark text-ink dark:text-ink-dark rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">E-mail</label>
                        <input
                          type="email"
                          className="w-full p-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark text-ink dark:text-ink-dark rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">Cargo</label>
                        <input
                          type="text"
                          className="w-full p-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark text-ink dark:text-ink-dark rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">Perfil</label>
                        <select
                          className="w-full p-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark text-ink dark:text-ink-dark rounded-lg text-xs cursor-pointer dark:[color-scheme:dark]"
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as UserRole)}
                        >
                          <option value="BPO_TEAM">Analista BPO</option>
                          <option value="BPO_ADMIN">Admin BPO</option>
                          <option value="ACCOUNTANT">Contador</option>
                          <option value="CLIENT">Usuário do cliente</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="text" icon={<X className="h-3.5 w-3.5" />} onClick={cancelEditingProfile}>
                        Cancelar
                      </Button>
                      <Button icon={<Check className="h-3.5 w-3.5" />} onClick={handleSaveProfile}>
                        Salvar alterações
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-4 p-4 bg-canvas dark:bg-white/5 rounded-lg border border-line dark:border-line-dark">
                    <Key className="h-6 w-6 text-ink dark:text-ink-dark shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="font-bold text-ink dark:text-ink-dark uppercase">Perfil de Regulação de Acessos</h4>
                      <p className="text-ink-soft dark:text-ink-soft-dark">As marcações abaixo representam as permissões vigentes que controlam a renderização dinâmica de botões e ações no faturamento deste colaborador.</p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <h4 className="font-bold text-ink dark:text-ink-dark uppercase">Empresas permitidas</h4>
                    <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark mt-0.5">
                      {selectedUser.role === 'CLIENT' ? 'O usuário cliente deve permanecer vinculado a uma única empresa.' : selectedUser.role === 'ACCOUNTANT' ? 'O contador pode atender uma ou várias empresas clientes.' : selectedUser.role === 'BPO_ADMIN' ? 'Administradores BPO possuem acesso global a todas as empresas.' : 'Defina quais operações este colaborador pode acessar.'}
                    </p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {companies.map(company => {
                      const checked = selectedUser.role === 'BPO_ADMIN' || selectedUser.companies?.includes(company.id);
                      return <label key={company.id} className={`flex items-center gap-2 border dark:border-line-dark rounded-lg p-2.5 ${selectedUser.role === 'BPO_ADMIN' ? 'bg-canvas dark:bg-white/5 cursor-not-allowed' : 'bg-surface dark:bg-surface-dark cursor-pointer hover:border-brand-navy-700/40 dark:hover:border-brand-navy-700/50'}`}>
                        <input
                          type={selectedUser.role === 'CLIENT' ? 'radio' : 'checkbox'}
                          name={`company-${selectedUser.id}`}
                          checked={Boolean(checked)}
                          disabled={selectedUser.role === 'BPO_ADMIN'}
                          onChange={() => handleUserCompanyToggle(company.id)}
                        />
                        <span className="text-[10px] font-semibold text-ink dark:text-ink-dark">{company.tradeName}</span>
                      </label>;
                    })}
                  </div>
                </div>

                {selectedUser.role === 'CLIENT' && (
                  <label className="flex items-start gap-2.5 bg-canvas dark:bg-white/5 border border-line dark:border-line-dark text-ink dark:text-ink-dark rounded-lg p-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded cursor-pointer text-brand-navy-900 focus:ring-0"
                      checked={Boolean(selectedUser.clientOperator)}
                      onChange={handleClientOperatorToggle}
                    />
                    <div className="space-y-0.5">
                      <span className="font-semibold text-ink dark:text-ink-dark block">Operador do cliente</span>
                      <span className="text-[9px] text-ink-soft dark:text-ink-soft-dark block">No Caixa da Padaria, este usuário só verá o saldo diário da Bolsa (movimentações do dia), sem acesso ao saldo acumulado.</span>
                    </div>
                  </label>
                )}

                {/* Permissions categories lists */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Category BPO Admin & Auditoria */}
                  <div className="space-y-4">
                    <span className="text-[10px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider block border-b border-line dark:border-line-dark pb-1.5">Ações Administrativas / Auditoria</span>
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
                                className="mt-0.5 rounded cursor-pointer text-brand-navy-900 focus:ring-0"
                              />
                              <div className="space-y-0.5">
                                <span className={`font-semibold block ${isDisabled ? 'text-ink-soft dark:text-ink-soft-dark' : 'text-ink dark:text-ink-dark'}`}>{p.name}</span>
                                {isDisabled && <span className="text-[8px] bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-ink-soft-dark px-1 py-0.2 rounded font-mono">Implicitamente cedido (BPO Admin)</span>}
                              </div>
                            </label>
                          );
                        })}
                    </div>
                  </div>

                  {/* Category Operações & Documentos */}
                  <div className="space-y-4">
                    <span className="text-[10px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider block border-b border-line dark:border-line-dark pb-1.5">Gestão Financeira & Documental</span>
                    <div className="space-y-3">
                      {availablePermissions
                        .filter(p => p.cat === 'Operações' || p.cat === 'Documentos' || p.cat === 'Cliente')
                        .map(p => {
                          const isChecked = selectedUser.permissions.includes(p.id);
                          const isBlockedForOperator =
                            p.id === 'approvals.approve' && Boolean(selectedUser.clientOperator);
                          const isDisabled = selectedUser.role === 'BPO_ADMIN' || isBlockedForOperator;

                          return (
                            <label key={p.id} className="flex items-start gap-2.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                disabled={isDisabled}
                                checked={(isChecked && !isBlockedForOperator) || (isDisabled && !isBlockedForOperator)}
                                onChange={() => handleTogglePermission(p.id)}
                                className="mt-0.5 rounded cursor-pointer text-brand-navy-900 focus:ring-0"
                              />
                              <div className="space-y-0.5">
                                <span className={`font-semibold block ${isDisabled ? 'text-ink-soft dark:text-ink-soft-dark' : 'text-ink dark:text-ink-dark'}`}>{p.name}</span>
                                {selectedUser.role === 'BPO_ADMIN' && <span className="text-[8px] bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-ink-soft-dark px-1 py-0.2 rounded font-mono">Implicitamente cedido (BPO Admin)</span>}
                                {isBlockedForOperator && <span className="text-[8px] bg-brand-gold-300/20 text-amber-700 dark:bg-brand-gold-600/10 dark:text-brand-gold-300 px-1 py-0.2 rounded font-mono">Bloqueado para Operador do cliente</span>}
                              </div>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                </div>

                <div className="bg-brand-navy-900 border-l-4 border-brand-red-600 border-y border-r border-white/10 p-3.5 rounded-lg text-[10px] text-white/90 leading-normal flex items-start gap-2 font-semibold shadow-sm">
                  <ShieldAlert className="h-4 w-4 text-brand-red-600 shrink-0 mt-0.5" />
                  <span>As políticas de segurança corporativa do Grupo Idex Finance exigem a checagem dupla do IP de origem para auditoria contínua de modificações de contas.</span>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
