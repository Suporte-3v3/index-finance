/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { BPOProvider, useBPOState } from "./hooks/useBPOState";
import idexLogo from "../assets/idex-finance-logo-transparent.png";

// View Imports
import LoginView from "./views/LoginView";
import DashboardView from "./views/DashboardView";
import OperationsCenter from "./views/OperationsCenter";
import CashFlowView from "./views/CashFlowView";
import AccountsPayableView from "./views/AccountsPayableView";
import AccountsReceivableView from "./views/AccountsReceivableView";
import ReconciliationView from "./views/ReconciliationView";
import ApprovalsView from "./views/ApprovalsView";
import DocumentsView from "./views/DocumentsView";
import DocumentsReceivedView from "./views/DocumentsReceivedView";
import MasterDataView from "./views/MasterDataView";
import ReportsView from "./views/ReportsView";
import ClientsView from "./views/ClientsView";
import TeamView from "./views/TeamView";
import AuditLogsView from "./views/AuditLogsView";
import BackupView from "./views/BackupView";
import SupportRequestsView from "./views/SupportRequestsView";
import ServiceDeskView from "./views/ServiceDeskView";

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
  Info,
  Crown,
  Gem,
  LogOut,
  HardDriveDownload,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquareText,
  Headphones,
} from "lucide-react";

type ViewType =
  | "dashboard"
  | "operations-center"
  | "cash-flow"
  | "payable"
  | "receivable"
  | "reconciliation"
  | "approvals"
  | "documents"
  | "documents-received"
  | "master-data"
  | "reports"
  | "clients"
  | "team"
  | "audit-logs"
  | "backup"
  | "support"
  | "service-desk";

function BPOWorkspaceShell() {
  const {
    currentUser,
    activeCompany,
    companies,
    switchCompany,
    hasPermission,
    approvals,
    supportTickets,
    notifications,
    markNotificationRead,
    clearNotifications,
    logout,
  } = useBPOState();

  const getDefaultView = (role: string): ViewType =>
    role === "BPO_ADMIN" ? "operations-center" : "dashboard";

  const [activeView, setActiveView] = useState<ViewType>(() =>
    getDefaultView(currentUser.role),
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("bpo_saas_sidebar_collapsed") === "true",
  );
  // BPO Admin starts in the global multi-company view; per-company modules only surface once a company is entered.
  const [bpoInCompanyContext, setBpoInCompanyContext] = useState(false);
  const isBpoGlobalMode =
    currentUser.role === "BPO_ADMIN" && !bpoInCompanyContext;

  if (!activeCompany) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center font-sans p-6 text-center">
        <div className="space-y-4 max-w-sm">
          <Building2 className="h-12 w-12 mx-auto text-zinc-500 animate-pulse" />
          <h2 className="text-lg font-bold">Nenhuma Empresa Ativa</h2>
          <p className="text-xs text-zinc-400">
            Por favor, reinicie os dados locais para provisionar os inquilinos
            iniciais de BPO.
          </p>
        </div>
      </div>
    );
  }

  // Pending approvals count badge
  const pendingApprovalsCount = approvals.filter(
    (a) => a.status === "Pendente" && a.companyId === activeCompany.id,
  ).length;

  // Unread notifications count
  const unreadNotifications = notifications.filter((n) => !n.isRead);

  // Navigation schema configured with permissions checks
  const navigationItems = [
    {
      id: "dashboard",
      label: "Painel Geral",
      icon: LayoutDashboard,
      view: "dashboard" as const,
      permission: null,
    },
    {
      id: "operations-center",
      label: "Centro de Operação",
      icon: Layers,
      view: "operations-center" as const,
      permission: "operations-center.view",
    },
    {
      id: "cash-flow",
      label: "Fluxo de Caixa",
      icon: LineChart,
      view: "cash-flow" as const,
      permission: null,
    },
    {
      id: "payable",
      label: "Contas a Pagar",
      icon: ArrowDownLeft,
      view: "payable" as const,
      permission: "accounts-payable.view",
    },
    {
      id: "receivable",
      label: "Contas a Receber",
      icon: ArrowUpRight,
      view: "receivable" as const,
      permission: "accounts-receivable.view",
    },
    {
      id: "approvals",
      label: "Central de Aprovações",
      icon: CheckSquare,
      view: "approvals" as const,
      permission: null,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
    },
    {
      id: "reconciliation",
      label: "Conciliação Bancária",
      icon: Coins,
      view: "reconciliation" as const,
      permission: "reconciliation.execute",
    },
    {
      id: "documents",
      label: "Central de Documentos",
      icon: Database,
      view: "documents" as const,
      permission: null,
    },
    ...(currentUser.role !== "CLIENT"
      ? [
          {
            id: "documents-received",
            label: "Lançamentos",
            icon: FileText,
            view: "documents-received" as const,
            permission: null,
          },
        ]
      : []),
    ...(["BPO_ADMIN", "BPO_TEAM"].includes(currentUser.role)
      ? [
          {
            id: "master-data",
            label: "Cadastros",
            icon: Database,
            view: "master-data" as const,
            permission: null,
          },
        ]
      : []),
    {
      id: "reports",
      label: "DRE e Relatórios",
      icon: FileText,
      view: "reports" as const,
      permission: null,
    },
    {
      id: "support",
      label: "Falar com o BPO",
      icon: MessageSquareText,
      view: "support" as const,
      permission: null,
    },
  ];
  const navigationOrder = [
    "dashboard",
    "operations-center",
    "documents-received",
    "approvals",
    "documents",
    "cash-flow",
    "payable",
    "receivable",
    "reconciliation",
    "reports",
    "master-data",
    "support",
  ];
  const orderedNavigationItems = [...navigationItems].sort(
    (a, b) => navigationOrder.indexOf(a.id) - navigationOrder.indexOf(b.id),
  );

  // Admin section schema
  const adminItems = [
    {
      id: "clients",
      label: "Empresas Clientes",
      icon: Building2,
      view: "clients" as const,
      role: "BPO_ADMIN",
    },
    {
      id: "team",
      label: "Colaboradores (RBAC)",
      icon: Users,
      view: "team" as const,
      role: "BPO_ADMIN",
    },
    {
      id: "audit-logs",
      label: "Logs de Conformidade",
      icon: Terminal,
      view: "audit-logs" as const,
      role: "BPO_ADMIN",
    },
    {
      id: "backup",
      label: "Backup de Dados",
      icon: HardDriveDownload,
      view: "backup" as const,
      role: "BPO_ADMIN",
    },
    {
      id: "service-desk",
      label: "Central de Requerimentos",
      icon: Headphones,
      view: "service-desk" as const,
      role: "BPO_ADMIN",
      badge:
        supportTickets.filter((ticket) =>
          ["ABERTO", "EM_ATENDIMENTO"].includes(ticket.status),
        ).length || undefined,
    },
  ];

  // Map view components
  const renderActiveView = () => {
    switch (activeView) {
      case "dashboard":
        return <DashboardView onNavigate={setActiveView} />;
      case "operations-center":
        return (
          <OperationsCenter
            onEnterCompany={() => {
              setBpoInCompanyContext(true);
              setActiveView("dashboard");
            }}
          />
        );
      case "cash-flow":
        return <CashFlowView />;
      case "payable":
        return (
          <AccountsPayableView
            onNavigate={() => setActiveView("documents-received")}
          />
        );
      case "receivable":
        return (
          <AccountsReceivableView
            onNavigate={() => setActiveView("documents-received")}
          />
        );
      case "reconciliation":
        return (
          <ReconciliationView
            onCreateLaunch={() => setActiveView("documents-received")}
          />
        );
      case "approvals":
        return <ApprovalsView />;
      case "documents":
        return <DocumentsView />;
      case "documents-received":
        return <DocumentsReceivedView />;
      case "master-data":
        return <MasterDataView />;
      case "reports":
        return <ReportsView />;
      case "clients":
        return <ClientsView />;
      case "team":
        return <TeamView />;
      case "audit-logs":
        return <AuditLogsView />;
      case "backup":
        return <BackupView />;
      case "support":
        return <SupportRequestsView />;
      case "service-desk":
        return <ServiceDeskView />;
      default:
        return <DashboardView onNavigate={setActiveView} />;
    }
  };

  const handleSwitchView = (view: ViewType) => {
    setActiveView(view);
    setMobileMenuOpen(false);
    // Returning to the operations center exits the single-company workspace back to the global BPO view.
    if (view === "operations-center") {
      setBpoInCompanyContext(false);
    }
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((previous) => {
      const next = !previous;
      localStorage.setItem("bpo_saas_sidebar_collapsed", String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#FDF8F5] flex flex-col md:flex-row font-sans text-zinc-900">
      {/* Mobile Top Navigation Bar */}
      <header className="md:hidden bg-[#061425] text-[#F2D3A0] border-b border-white/10 px-4 py-3 flex items-center justify-end z-40 shrink-0 sticky top-0 relative">
        <img
          src={idexLogo}
          alt="Idex Finance"
          className="absolute left-1/2 -translate-x-1/2 h-10 w-28 object-contain"
        />

        <div className="flex items-center gap-2">
          {/* Notification Button */}
          <button
            onClick={() => setNotificationsOpen(true)}
            className="p-1.5 text-[#F2D3A0]/80 hover:text-white relative cursor-pointer"
          >
            <Bell className="h-5 w-5" />
            {unreadNotifications.length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-[#C8102E] text-white rounded-full flex items-center justify-center text-[9px] font-black border border-[#0B2C52]">
                {unreadNotifications.length}
              </span>
            )}
          </button>

          {/* Hamburger Menu */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-[#F2D3A0]/80 hover:text-white cursor-pointer"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>

          {/* Logout Button */}
          <button
            onClick={logout}
            title="Sair"
            className="p-1.5 text-[#F2D3A0]/80 hover:text-white cursor-pointer"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Responsive Left Sidebar */}
      <aside
        className={`
        fixed inset-y-0 left-0 transform md:sticky md:top-0 md:h-screen md:translate-x-0 transition-[width,transform] duration-200 ease-in-out
        w-64 ${sidebarCollapsed ? "md:w-20" : "md:w-64"} bg-[#061425] text-white/90 border-r border-white/10 flex flex-col justify-between z-50 shrink-0
        ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}
      >
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
          className="hidden md:flex absolute -right-3 top-8 h-7 w-7 items-center justify-center rounded-full bg-white text-[#0B2C52] border border-[#0B2C52]/15 shadow-md hover:bg-[#F2D3A0] transition-colors cursor-pointer z-10"
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>

        <div className="flex flex-1 min-h-0 flex-col overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(242,211,160,0.35)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#F2D3A0]/30 [&::-webkit-scrollbar-track]:bg-transparent">
          {/* Brand Logo & Switchers */}
          <div
            className={`${sidebarCollapsed ? "md:p-3" : "md:p-5"} p-5 border-b border-white/10 space-y-4`}
          >
            <div className="flex flex-col items-center">
              {sidebarCollapsed ? (
                <div className="hidden md:flex h-12 w-12 items-center justify-center rounded-xl bg-[#0B2C52] border border-white/10">
                  <LayoutDashboard className="h-6 w-6 text-[#F2D3A0]" />
                </div>
              ) : null}
              <img
                src={idexLogo}
                alt="Idex Finance — Gestão que move resultados"
                className={`${sidebarCollapsed ? "md:hidden" : ""} h-20 w-full object-contain`}
              />
              <div
                className={`${sidebarCollapsed ? "md:hidden" : ""} w-12 h-0.5 bg-[#C8102E] mt-1 rounded-full`}
              />
            </div>

            {/* Client / Tenant switcher — hidden in BPO global mode; use the Operations Center to enter a company instead */}
            {!isBpoGlobalMode && (
              <div
                className={`${sidebarCollapsed ? "md:hidden" : ""} space-y-1`}
              >
                <label className="text-[9px] font-bold text-[#F2D3A0]/60 uppercase tracking-wider block">
                  Empresa Operada
                </label>
                <div className="relative">
                  <Building2 className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#F2D3A0]/65" />
                  <select
                    className="w-full bg-[#061425] border border-white/10 text-white text-xs pl-8 pr-2 py-2 rounded-lg cursor-pointer focus:outline-none focus:border-[#C8102E] font-bold shadow-2xs"
                    value={activeCompany.id}
                    onChange={(e) => {
                      switchCompany(e.target.value);
                      if (currentUser.role === "BPO_ADMIN")
                        setBpoInCompanyContext(true);
                    }}
                  >
                    {companies
                      .filter(
                        (c) =>
                          currentUser.role === "BPO_ADMIN" ||
                          currentUser.companies?.includes(c.id),
                      )
                      .map((c) => (
                        <option
                          key={c.id}
                          value={c.id}
                          className="bg-[#061425] text-white"
                        >
                          {c.tradeName}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Links List */}
          <nav
            className={`${sidebarCollapsed ? "md:px-3" : "md:px-4"} p-4 space-y-1 flex-grow`}
          >
            {hasPermission("operations-center.view") && (
              <div className="pb-3 mb-3 border-b border-white/10">
                <button
                  onClick={() => handleSwitchView("operations-center")}
                  title={sidebarCollapsed ? "Centro de Operação" : undefined}
                  className={`w-full flex items-center justify-between px-3 ${sidebarCollapsed ? "md:justify-center md:px-2" : ""} py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                    activeView === "operations-center"
                      ? "bg-[#C8102E] text-white border-l-4 border-[#F2D3A0] font-bold"
                      : "bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Layers
                      className={`h-4 w-4 ${activeView === "operations-center" ? "text-[#F2D3A0]" : "text-[#F2D3A0]/75"}`}
                    />
                    <span className={sidebarCollapsed ? "md:hidden" : ""}>
                      Centro de Operação
                    </span>
                  </div>
                </button>
              </div>
            )}

            <span
              className={`${sidebarCollapsed ? "md:hidden" : ""} text-[9px] font-bold text-[#F2D3A0]/40 uppercase tracking-wider px-3 block mb-2`}
            >
              Visão Geral
            </span>
            {orderedNavigationItems.map((item) => {
              if (item.id === "operations-center") return null;
              if (item.permission && !hasPermission(item.permission))
                return null;
              if (
                item.id === "support" &&
                !["CLIENT", "ACCOUNTANT"].includes(currentUser.role)
              )
                return null;
              // In BPO global mode, only the Operations Center is shown until a company is entered.
              if (isBpoGlobalMode && item.id !== "operations-center")
                return null;

              const isSelected = activeView === item.view;
              const Icon = item.icon;
              const section =
                item.id === "documents-received" ||
                (currentUser.role === "CLIENT" && item.id === "approvals")
                  ? "Operação"
                  : item.id === "cash-flow"
                    ? "Financeiro"
                    : item.id === "reports"
                      ? "Gestão"
                      : null;

              if (item.id === "support") {
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSwitchView(item.view)}
                    title={sidebarCollapsed ? "Fale com o BPO" : undefined}
                    aria-label="Precisa de ajuda? Fale com o BPO"
                    className={`mt-4 w-full rounded-xl border bg-white text-left shadow-xs transition-all cursor-pointer ${
                      sidebarCollapsed
                        ? "md:flex md:h-11 md:items-center md:justify-center md:p-0 p-3"
                        : "p-3"
                    } ${
                      isSelected
                        ? "border-[#C8102E] ring-2 ring-[#C8102E]/20"
                        : "border-zinc-200 hover:border-[#C8102E]/60 hover:shadow-md"
                    }`}
                  >
                    <div
                      className={`flex items-center ${sidebarCollapsed ? "md:justify-center" : ""} gap-3`}
                    >
                      <MessageSquareText
                        className="h-6 w-6 shrink-0 text-[#C8102E]"
                        strokeWidth={1.8}
                      />
                      <div className={sidebarCollapsed ? "md:hidden" : ""}>
                        <span className="block text-xs font-extrabold leading-tight text-zinc-900">
                          Precisa de ajuda?
                        </span>
                        <span className="mt-1 block text-xs font-medium leading-tight text-zinc-600">
                          Fale com o BPO
                        </span>
                      </div>
                    </div>
                  </button>
                );
              }

              return (
                <React.Fragment key={item.id}>
                  {section && (
                    <span
                      className={`${sidebarCollapsed ? "md:hidden" : ""} text-[9px] font-bold text-[#F2D3A0]/40 uppercase tracking-wider px-3 block pt-4 pb-1`}
                    >
                      {section}
                    </span>
                  )}
                  <button
                    onClick={() => handleSwitchView(item.view)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`
                    relative w-full flex items-center justify-between px-3 ${sidebarCollapsed ? "md:justify-center md:px-2" : ""} py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer
                    ${
                      isSelected
                        ? "bg-[#C8102E] text-white border-l-4 border-[#F2D3A0] font-bold"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    }
                  `}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`h-4 w-4 ${isSelected ? "text-[#F2D3A0]" : "text-white/60"}`}
                      />
                      <span className={sidebarCollapsed ? "md:hidden" : ""}>
                        {item.label}
                      </span>
                    </div>
                    {item.badge && (
                      <span
                        className={`${sidebarCollapsed ? "md:absolute md:translate-x-3 md:-translate-y-3" : ""} h-4 min-w-4 px-1 font-black text-[9px] rounded-full flex items-center justify-center ${
                          isSelected
                            ? "bg-white text-[#C8102E]"
                            : "bg-[#C8102E] text-white"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                </React.Fragment>
              );
            })}

            {/* Admin BPO Section */}
            {currentUser.role === "BPO_ADMIN" && (
              <div
                className={`${sidebarCollapsed ? "md:pt-2 md:border-t md:border-white/10" : "pt-4"} space-y-1`}
              >
                <span
                  className={`${sidebarCollapsed ? "md:hidden" : ""} text-[9px] font-bold text-[#F2D3A0]/40 uppercase tracking-wider px-3 block mb-2`}
                >
                  Controle Geral BPO
                </span>
                {adminItems.map((item) => {
                  const isSelected = activeView === item.view;
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSwitchView(item.view)}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={`
                        w-full flex items-center justify-between px-3 ${sidebarCollapsed ? "md:justify-center md:px-2" : ""} py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer
                        ${
                          isSelected
                            ? "bg-[#C8102E] text-white border-l-4 border-[#F2D3A0] font-bold"
                            : "text-white/70 hover:bg-white/5 hover:text-white"
                        }
                      `}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`h-4 w-4 ${isSelected ? "text-[#F2D3A0]" : "text-white/60"}`}
                        />
                        <span className={sidebarCollapsed ? "md:hidden" : ""}>
                          {item.label}
                        </span>
                      </div>
                      {"badge" in item && item.badge && (
                        <span
                          className={`${sidebarCollapsed ? "md:absolute md:translate-x-3 md:-translate-y-3" : ""} h-4 min-w-4 px-1 font-black text-[9px] rounded-full flex items-center justify-center ${isSelected ? "bg-white text-[#C8102E]" : "bg-[#C8102E] text-white"}`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </nav>
        </div>

        {/* Signed-in user */}
        <div
          className={`${sidebarCollapsed ? "md:p-3" : "md:p-4"} p-4 border-t border-white/10 space-y-3.5 bg-black/15`}
        >
          <div
            className={`flex items-center gap-3 p-2.5 ${sidebarCollapsed ? "md:justify-center md:gap-0 md:p-2" : ""} bg-white/5 rounded-lg border border-white/10`}
          >
            <img
              src={currentUser.avatar}
              className={`${sidebarCollapsed ? "md:hidden" : ""} h-8 w-8 rounded-full object-cover border border-white/20 shrink-0`}
              alt={currentUser.name}
            />
            <div
              className={`${sidebarCollapsed ? "md:hidden" : ""} space-y-0.5 truncate grow`}
            >
              <span className="text-[10px] font-black text-white block truncate leading-tight">
                {currentUser.name}
              </span>
              <span className="text-[9px] text-[#F2D3A0]/80 font-bold block truncate">
                {currentUser.title || "Membro do Time"}
              </span>
            </div>
            <button
              onClick={logout}
              title="Sair"
              className={`${sidebarCollapsed ? "md:hidden" : ""} p-1.5 text-[#F2D3A0]/70 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer shrink-0`}
            >
              <LogOut className="h-4 w-4" />
            </button>
            {sidebarCollapsed && (
              <button
                onClick={logout}
                title="Sair"
                className="hidden md:flex p-1.5 text-[#F2D3A0]/70 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
          <p
            className={`${sidebarCollapsed ? "md:hidden" : ""} text-center text-[8px] uppercase tracking-wider text-white/35`}
          >
            Desenvolvido por{" "}
            <span className="text-[#F2D3A0]/60 font-bold">NFlow Analytics</span>
          </p>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <main className="flex-grow flex flex-col min-w-0">
        {/* Desktop Top Header Bar */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-white border-b border-[#0B2C52]/10 shrink-0 sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#0B2C52] font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
              <LayoutDashboard className="h-3.5 w-3.5 text-[#C8102E]" /> Idex
              Finance Workspace
            </span>
            <span className="text-zinc-300">/</span>
            <span className="text-[#0B2C52] font-bold text-xs flex items-center gap-1.5 bg-[#0B2C52]/5 border-l-2 border-[#C8102E] border-y border-r border-[#0B2C52]/15 px-3 py-1.5 rounded-lg shadow-2xs">
              <Building2 className="h-3.5 w-3.5 text-[#0B2C52]/70" />{" "}
              {activeCompany.tradeName} ({activeCompany.cnpj})
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Direct Alert Notification Button */}
            <button
              onClick={() => setNotificationsOpen(true)}
              className="p-2 text-[#0B2C52]/70 hover:bg-[#0B2C52]/10 hover:text-[#0B2C52] rounded-lg relative cursor-pointer"
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadNotifications.length > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 bg-[#C8102E] text-white rounded-full flex items-center justify-center text-[9px] font-black">
                  {unreadNotifications.length}
                </span>
              )}
            </button>

            {/* Profile status label */}
            <div className="flex items-center gap-2.5 font-sans">
              <div className="text-right">
                <span className="text-xs font-bold text-zinc-900 block leading-tight">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-zinc-400 block font-semibold">
                  {currentUser.role.replace(/_/g, " ")}
                </span>
              </div>
              <img
                src={currentUser.avatar}
                className="h-8 w-8 rounded-full object-cover border border-zinc-200"
                alt={currentUser.name}
              />
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
            <div className="p-4 bg-[#0B2C52] text-white flex items-center justify-between border-b-2 border-[#C8102E]">
              <div className="flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-[#F2D3A0]" />
                <h3 className="font-bold text-sm">Alertas e Notificações</h3>
              </div>
              <button
                onClick={() => setNotificationsOpen(false)}
                className="text-[#F2D3A0] hover:text-white font-bold cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="divide-y divide-zinc-100 overflow-y-auto flex-grow max-h-[80vh]">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => markNotificationRead(notif.id)}
                  className={`p-4 hover:bg-zinc-50 transition-colors cursor-pointer relative border-l-4 ${
                    notif.isRead
                      ? "border-zinc-200 opacity-60"
                      : "border-[#C8102E] bg-[#F2D3A0]/10 font-semibold"
                  }`}
                >
                  <div className="flex justify-between items-start gap-1.5 mb-1 text-[10px] text-zinc-400">
                    <span className="font-mono">
                      {new Date(notif.createdAt).toLocaleTimeString("pt-BR")}
                    </span>
                    <span className="uppercase font-bold tracking-wider">
                      {notif.type}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-zinc-800 mb-0.5">
                    {notif.title}
                  </h4>
                  <p className="text-zinc-500 leading-normal text-[11px]">
                    {notif.message}
                  </p>
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="p-8 text-center text-zinc-400 italic">
                  Nenhum alerta recente.
                </div>
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
            <span className="text-[10px] text-zinc-400 font-mono">
              Real-time habilitado
            </span>
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
