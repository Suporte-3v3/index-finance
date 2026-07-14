/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BPOProvider, useBPOState } from './hooks/useBPOState';

// View Imports
import LoginView from './views/LoginView';
import DashboardView from './views/DashboardView';
import OperationsCenter from './views/OperationsCenter';
import CashFlowView from './views/CashFlowView';
import AccountsPayableView from './views/AccountsPayableView';
import AccountsReceivableView from './views/AccountsReceivableView';
import ReconciliationView from './views/ReconciliationView';
import ApprovalsView from './views/ApprovalsView';
import DocumentsView from './views/DocumentsView';
import ReportsView from './views/ReportsView';
import ClientsView from './views/ClientsView';
import TeamView from './views/TeamView';
import AuditLogsView from './views/AuditLogsView';

// Icon Imports
import { 
  Building2, 
  LayoutDashboard, 
  LineChart, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CheckSquare, 
  FileText, 
  Database, 
  Layers, 
  Users, 
  Terminal, 
  User, 
  Menu, 
  X, 
  Bell, 
  Coins, 
  Lock,
  Sparkles,
  Info,
  Crown,
  Gem,
  LogOut
} from 'lucide-react';

type ViewType = 
  | 'dashboard' 
  | 'operations-center' 
  | 'cash-flow' 
  | 'payable' 
  | 'receivable' 
  | 'reconciliation' 
  | 'approvals' 
  | 'documents' 
  | 'reports' 
  | 'clients' 
  | 'team' 
  | 'audit-logs';

function BPOWorkspaceShell() {
  const {
    currentUser,
    activeCompany,
    companies,
    users,
    switchUser,
    switchCompany,
    hasPermission,
    approvals,
    notifications,
    markNotificationRead,
    clearNotifications,
    logout
  } = useBPOState();

  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  if (!activeCompany) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center font-sans p-6 text-center">
        <div className="space-y-4 max-w-sm">
          <Building2 className="h-12 w-12 mx-auto text-zinc-500 animate-pulse" />
          <h2 className="text-lg font-bold">Nenhuma Empresa Ativa</h2>
          <p className="text-xs text-zinc-400">Por favor, reinicie os dados locais para provisionar os inquilinos iniciais de BPO.</p>
        </div>
      </div>
    );
  }

  // Pending approvals count badge
  const pendingApprovalsCount = approvals.filter(
    a => a.status === 'Pendente' && a.companyId === activeCompany.id
  ).length;

  // Unread notifications count
  const unreadNotifications = notifications.filter(n => !n.isRead);

  // Navigation schema configured with permissions checks
  const navigationItems = [
    { id: 'dashboard', label: 'Painel Geral', icon: LayoutDashboard, view: 'dashboard' as const, permission: null },
    { id: 'operations-center', label: 'Cockpit Multiempresas', icon: Layers, view: 'operations-center' as const, permission: 'operations-center.view' },
    { id: 'cash-flow', label: 'Fluxo de Caixa', icon: LineChart, view: 'cash-flow' as const, permission: null },
    { id: 'payable', label: 'Contas a Pagar', icon: ArrowDownLeft, view: 'payable' as const, permission: 'accounts-payable.view' },
    { id: 'receivable', label: 'Contas a Receber', icon: ArrowUpRight, view: 'receivable' as const, permission: 'accounts-receivable.view' },
    { id: 'approvals', label: 'Central de Aprovações', icon: CheckSquare, view: 'approvals' as const, permission: null, badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined },
    { id: 'reconciliation', label: 'Conciliação Bancária', icon: Coins, view: 'reconciliation' as const, permission: 'reconciliation.execute' },
    { id: 'documents', label: 'Gestor Documental', icon: Database, view: 'documents' as const, permission: null },
    { id: 'reports', label: 'DRE e Relatórios', icon: FileText, view: 'reports' as const, permission: null },
  ];

  // Admin section schema
  const adminItems = [
    { id: 'clients', label: 'Empresas Clientes', icon: Building2, view: 'clients' as const, role: 'BPO_ADMIN' },
    { id: 'team', label: 'Colaboradores (RBAC)', icon: Users, view: 'team' as const, role: 'BPO_ADMIN' },
    { id: 'audit-logs', label: 'Logs de Conformidade', icon: Terminal, view: 'audit-logs' as const, role: 'BPO_ADMIN' },
  ];

  // Map view components
  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView onNavigate={(view) => setActiveView(view as any)} />;
      case 'operations-center':
        return <OperationsCenter onEnterCompany={() => setActiveView('dashboard')} />;
      case 'cash-flow':
        return <CashFlowView />;
      case 'payable':
        return <AccountsPayableView />;
      case 'receivable':
        return <AccountsReceivableView />;
      case 'reconciliation':
        return <ReconciliationView />;
      case 'approvals':
        return <ApprovalsView />;
      case 'documents':
        return <DocumentsView />;
      case 'reports':
        return <ReportsView />;
      case 'clients':
        return <ClientsView />;
      case 'team':
        return <TeamView />;
      case 'audit-logs':
        return <AuditLogsView />;
      default:
        return <DashboardView onNavigate={(view) => setActiveView(view as any)} />;
    }
  };

  const handleSwitchView = (view: ViewType) => {
    setActiveView(view);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row font-sans text-zinc-900">
      
      {/* Mobile Top Navigation Bar */}
      <header className="md:hidden bg-[#00304c] text-[#ffefd1] border-b border-white/10 px-4 py-3 flex items-center justify-between z-40 shrink-0 sticky top-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#d20010] text-white rounded-lg">
            <LayoutDashboard className="h-5 w-5 text-[#ffefd1]" />
          </div>
          <span className="font-bold text-sm tracking-tight text-[#ffefd1]">Idex Finance</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Button */}
          <button 
            onClick={() => setNotificationsOpen(true)}
            className="p-1.5 text-[#ffefd1]/80 hover:text-white relative cursor-pointer"
          >
            <Bell className="h-5 w-5" />
            {unreadNotifications.length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-[#d20010] text-white rounded-full flex items-center justify-center text-[9px] font-black border border-[#00304c]">
                {unreadNotifications.length}
              </span>
            )}
          </button>

          {/* Hamburger Menu */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-[#ffefd1]/80 hover:text-white cursor-pointer"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          {/* Logout Button */}
          <button
            onClick={logout}
            title="Sair"
            className="p-1.5 text-[#ffefd1]/80 hover:text-white cursor-pointer"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Responsive Left Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 transform md:relative md:translate-x-0 transition-transform duration-200 ease-in-out
        w-64 bg-[#00304c] text-white/90 border-r border-white/10 flex flex-col justify-between z-50 shrink-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex flex-col overflow-y-auto max-h-[85vh]">
          {/* Brand Logo & Switchers */}
          <div className="p-5 border-b border-white/10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#d20010] text-white rounded-xl shadow-xs shrink-0">
                <LayoutDashboard className="h-5 w-5 text-[#ffefd1]" />
              </div>
              <div>
                <h1 className="font-black text-white text-sm tracking-tight leading-none flex items-center gap-1">
                  Idex Finance
                </h1>
                <span className="text-[9px] text-[#ffefd1] font-bold uppercase tracking-wider block mt-1">Gestão que move resultados</span>
              </div>
            </div>

            {/* Client / Tenant switcher */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-[#ffefd1]/60 uppercase tracking-wider block">Empresa Operada</label>
              <div className="relative">
                <Building2 className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#ffefd1]/65" />
                <select
                  className="w-full bg-[#002236] border border-white/10 text-white text-xs pl-8 pr-2 py-2 rounded-lg cursor-pointer focus:outline-none focus:border-[#d20010] font-bold shadow-2xs"
                  value={activeCompany.id}
                  onChange={(e) => switchCompany(e.target.value)}
                >
                  {companies
                    .filter(c => currentUser.role === 'BPO_ADMIN' || currentUser.role === 'ACCOUNTANT' || currentUser.companies?.includes(c.id))
                    .map(c => (
                      <option key={c.id} value={c.id} className="bg-[#002236] text-white">{c.tradeName}</option>
                    ))
                  }
                </select>
              </div>
            </div>
          </div>

          {/* Navigation Links List */}
          <nav className="p-4 space-y-1 flex-grow">
            <span className="text-[9px] font-bold text-[#ffefd1]/40 uppercase tracking-wider px-3 block mb-2">Painéis Operacionais</span>
            {navigationItems.map(item => {
              if (item.permission && !hasPermission(item.permission)) return null;

              const isSelected = activeView === item.view;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => handleSwitchView(item.view)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer
                    ${isSelected 
                      ? 'bg-[#d20010] text-white border-l-4 border-[#ffefd1] font-bold' 
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }
                  `}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`h-4 w-4 ${isSelected ? 'text-[#ffefd1]' : 'text-white/60'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`h-4 min-w-4 px-1 font-black text-[9px] rounded-full flex items-center justify-center ${
                      isSelected ? 'bg-white text-[#d20010]' : 'bg-[#d20010] text-white'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Admin BPO Section */}
            {currentUser.role === 'BPO_ADMIN' && (
              <div className="pt-4 space-y-1">
                <span className="text-[9px] font-bold text-[#ffefd1]/40 uppercase tracking-wider px-3 block mb-2">Controle Geral BPO</span>
                {adminItems.map(item => {
                  const isSelected = activeView === item.view;
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSwitchView(item.view)}
                      className={`
                        w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer
                        ${isSelected 
                          ? 'bg-[#d20010] text-white border-l-4 border-[#ffefd1] font-bold' 
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                        }
                      `}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`h-4 w-4 ${isSelected ? 'text-[#ffefd1]' : 'text-white/60'}`} />
                        <span>{item.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </nav>
        </div>

        {/* Dynamic Sandbox Role Simulator Controls */}
        <div className="p-4 border-t border-white/10 space-y-3.5 bg-black/15">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-[#ffefd1]/75 uppercase tracking-wider block flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-[#ffefd1] animate-pulse" /> Simulador de Perfil (RBAC)
            </label>
            <select
              className="w-full bg-[#002236] border border-white/10 text-white text-[10px] py-1.5 px-2 rounded cursor-pointer font-bold focus:outline-none"
              value={currentUser.id}
              onChange={(e) => {
                switchUser(e.target.value);
                setActiveView('dashboard');
              }}
            >
              {users.map(u => (
                <option key={u.id} value={u.id} className="bg-[#002236] text-white">{u.name} ({u.role.replace(/_/g, ' ')})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 bg-white/5 p-2.5 rounded-lg border border-white/10">
            <img src={currentUser.avatar} className="h-8 w-8 rounded-full object-cover border border-white/20 shrink-0" alt={currentUser.name} />
            <div className="space-y-0.5 truncate grow">
              <span className="text-[10px] font-black text-white block truncate leading-tight">{currentUser.name}</span>
              <span className="text-[9px] text-[#ffefd1]/80 font-bold block truncate">{currentUser.title || 'Membro do Time'}</span>
            </div>
            <button
              onClick={logout}
              title="Sair"
              className="p-1.5 text-[#ffefd1]/70 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <main className="flex-grow flex flex-col min-w-0">
        
        {/* Desktop Top Header Bar */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-white border-b border-[#00304c]/10 shrink-0 sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#00304c] font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
              <LayoutDashboard className="h-3.5 w-3.5 text-[#d20010]" /> Idex Finance Workspace
            </span>
            <span className="text-zinc-300">/</span>
            <span className="text-[#00304c] font-bold text-xs flex items-center gap-1.5 bg-[#00304c]/5 border-l-2 border-[#d20010] border-y border-r border-[#00304c]/15 px-3 py-1.5 rounded-lg shadow-2xs">
              <Building2 className="h-3.5 w-3.5 text-[#00304c]/70" /> {activeCompany.tradeName} ({activeCompany.cnpj})
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Direct Alert Notification Button */}
            <button
              onClick={() => setNotificationsOpen(true)}
              className="p-2 text-[#00304c]/70 hover:bg-[#00304c]/10 hover:text-[#00304c] rounded-lg relative cursor-pointer"
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadNotifications.length > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 bg-[#d20010] text-white rounded-full flex items-center justify-center text-[9px] font-black">
                  {unreadNotifications.length}
                </span>
              )}
            </button>

            {/* Profile status label */}
            <div className="flex items-center gap-2.5 font-sans">
              <div className="text-right">
                <span className="text-xs font-bold text-zinc-900 block leading-tight">{currentUser.name}</span>
                <span className="text-[10px] text-zinc-400 block font-semibold">{currentUser.role.replace(/_/g, ' ')}</span>
              </div>
              <img src={currentUser.avatar} className="h-8 w-8 rounded-full object-cover border border-zinc-200" alt={currentUser.name} />
            </div>
          </div>
        </header>

        {/* View Content Port */}
        <div className="flex-grow p-4 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto animate-in fade-in duration-150">
          {renderActiveView()}
        </div>
      </main>

      {/* Side Slide-out Notification Drawer Panel */}
      {notificationsOpen && (
        <div className="fixed inset-y-0 right-0 w-80 bg-white border-l border-zinc-200 shadow-2xl z-50 flex flex-col justify-between animate-in slide-in-from-right duration-200 font-sans text-xs">
          <div className="flex flex-col flex-grow">
            <div className="p-4 bg-[#00304c] text-white flex items-center justify-between border-b-2 border-[#d20010]">
              <div className="flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-[#ffefd1]" />
                <h3 className="font-bold text-sm">Alertas e Notificações</h3>
              </div>
              <button onClick={() => setNotificationsOpen(false)} className="text-[#ffefd1] hover:text-white font-bold cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="divide-y divide-zinc-100 overflow-y-auto flex-grow max-h-[80vh]">
              {notifications.map(notif => (
                <div 
                  key={notif.id}
                  onClick={() => markNotificationRead(notif.id)}
                  className={`p-4 hover:bg-zinc-50 transition-colors cursor-pointer relative border-l-4 ${
                    notif.isRead ? 'border-zinc-200 opacity-60' : 'border-[#d20010] bg-[#ffefd1]/10 font-semibold'
                  }`}
                >
                  <div className="flex justify-between items-start gap-1.5 mb-1 text-[10px] text-zinc-400">
                    <span className="font-mono">{new Date(notif.createdAt).toLocaleTimeString('pt-BR')}</span>
                    <span className="uppercase font-bold tracking-wider">{notif.type}</span>
                  </div>
                  <h4 className="text-xs font-bold text-zinc-800 mb-0.5">{notif.title}</h4>
                  <p className="text-zinc-500 leading-normal text-[11px]">{notif.message}</p>
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="p-8 text-center text-zinc-400 italic">Nenhum alerta recente.</div>
              )}
            </div>
          </div>

          <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
            <button 
              onClick={clearNotifications}
              className="text-[11px] text-zinc-900 font-bold hover:underline cursor-pointer"
            >
              Marcar todas como lidas
            </button>
            <span className="text-[10px] text-zinc-400 font-mono">Real-time habilitado</span>
          </div>
        </div>
      )}

    </div>
  );
}

function AppGate() {
  const { isAuthenticated } = useBPOState();
  return isAuthenticated ? <BPOWorkspaceShell /> : <LoginView />;
}

export default function App() {
  return (
    <BPOProvider>
      <AppGate />
    </BPOProvider>
  );
}
