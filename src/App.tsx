/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { BPOProvider, useBPOState } from "./hooks/useBPOState";
import { BakeryCashProvider } from "./hooks/useBakeryCashState";
import { ClientModule, Company } from "./types";
import {
  ALL_CLIENT_MODULES,
  getEffectiveClientModules,
} from "./config/clientModules";
import { searchAll, GlobalSearchResult } from "./services/globalSearch";
import { resolveCompanyLogo } from "./services/companyBranding";
import idexLogo from "../assets/idex-finance-logo-transparent.png";
import {
  ToastProvider,
  IconButton,
  Dropdown,
  SearchField,
  Drawer,
  cn,
} from "./components/ui";

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
import BakeryCashView from "./views/BakeryCashView";

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
  Menu,
  X,
  Bell,
  Coins,
  LogOut,
  HardDriveDownload,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquareText,
  Headphones,
  Store,
  Sun,
  Moon,
  ChevronDown,
  Search,
  UserRound,
  ArrowUpCircle,
  ArrowDownCircle,
  UsersRound,
  FolderOpen,
  Wallet,
  ClipboardList,
  ReceiptText,
} from "lucide-react";

const APP_THEME_STORAGE_KEY = "idex_finance_theme";

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
  | "bakery-cash"
  | "service-desk";

// Agrupamento visual dos itens do menu lateral (spec: Visão geral / Operação
// financeira / Gestão). "operations-center" e "support" têm apresentação
// própria e não passam por este mapa.
const NAV_GROUP: Record<string, string> = {
  dashboard: "Visão Geral",
  "documents-received": "Operação Financeira",
  approvals: "Operação Financeira",
  documents: "Operação Financeira",
  "cash-flow": "Operação Financeira",
  payable: "Operação Financeira",
  receivable: "Operação Financeira",
  reconciliation: "Operação Financeira",
  "bakery-cash": "Operação Financeira",
  reports: "Gestão",
  "master-data": "Gestão",
};

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

const SEARCH_CATEGORY_ICON: Record<string, typeof Building2> = {
  company: Building2,
  supplier: ArrowDownCircle,
  customer: ArrowUpCircle,
  payable: ArrowDownCircle,
  receivable: ArrowUpCircle,
  document: FolderOpen,
  report: ReceiptText,
};

// Interruptor de tema claro/escuro, aplicado em <html> (não apenas na área de
// conteúdo) para que o menu lateral, o cabeçalho e a tela de login sigam a
// mesma preferência salva no navegador.
function useThemeMode() {
  const [isDarkMode, setIsDarkMode] = useState(
    () => localStorage.getItem(APP_THEME_STORAGE_KEY) === "dark",
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);
  const toggleTheme = () =>
    setIsDarkMode((previous) => {
      const next = !previous;
      localStorage.setItem(APP_THEME_STORAGE_KEY, next ? "dark" : "light");
      return next;
    });
  return { isDarkMode, toggleTheme };
}

function CompanySwitcher({
  companies,
  activeCompany,
  onSelect,
}: {
  companies: Company[];
  activeCompany: Company;
  onSelect: (companyId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const needle = query.trim().toLocaleLowerCase("pt-BR");
  const filtered = companies.filter(
    (company) =>
      !needle ||
      company.tradeName.toLocaleLowerCase("pt-BR").includes(needle) ||
      company.cnpj.includes(needle),
  );

  return (
    <div ref={containerRef} className="relative">
      <label className="text-[10px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider block mb-1 px-0.5">
        Empresa operada
      </label>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center gap-2 rounded-lg border border-line dark:border-line-dark bg-canvas dark:bg-white/5 px-2.5 py-2 text-left hover:border-brand-navy-700/40 dark:hover:border-brand-navy-700/50 transition-colors cursor-pointer"
      >
        <span className="h-7 w-7 rounded-full bg-brand-navy-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
          {getInitials(activeCompany.tradeName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold text-ink dark:text-ink-dark truncate">
            {activeCompany.tradeName}
          </span>
          <span className="block text-[10px] text-ink-soft dark:text-ink-soft-dark truncate">
            {activeCompany.cnpj}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-ink-soft dark:text-ink-soft-dark transition-transform shrink-0",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="absolute z-30 mt-1.5 w-full min-w-64 rounded-xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark shadow-lg p-2 space-y-1.5 motion-safe:animate-[popIn_120ms_ease-out] origin-top">
          {companies.length > 5 && (
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Buscar empresa..."
              className="h-8 text-xs"
              autoFocus
            />
          )}
          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {filtered.map((company) => (
              <button
                key={company.id}
                type="button"
                onClick={() => {
                  onSelect(company.id);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors cursor-pointer",
                  company.id === activeCompany.id
                    ? "bg-brand-blue-50 dark:bg-brand-navy-700/20 text-brand-navy-900 dark:text-white font-bold"
                    : "hover:bg-canvas dark:hover:bg-white/5 text-ink dark:text-ink-dark",
                )}
              >
                <span className="h-6 w-6 rounded-full bg-zinc-200 dark:bg-white/10 text-[9px] font-bold flex items-center justify-center shrink-0 text-ink-soft dark:text-ink-soft-dark">
                  {getInitials(company.tradeName)}
                </span>
                <span className="truncate">{company.tradeName}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-[11px] text-ink-soft dark:text-ink-soft-dark text-center py-3">
                Nenhuma empresa encontrada.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GlobalSearch({
  onNavigate,
}: {
  onNavigate: (result: GlobalSearchResult) => void;
}) {
  const {
    companies,
    masterData,
    accountsPayable,
    accountsReceivable,
    documents,
    reports,
    reportTemplates,
    currentUser,
    activeCompany,
  } = useBPOState();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setFocused(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocused(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const groups = useMemo(
    () =>
      activeCompany
        ? searchAll(
            query,
            {
              companies,
              masterData,
              accountsPayable,
              accountsReceivable,
              documents,
              reports,
              reportTemplates,
            },
            { currentUser, activeCompanyId: activeCompany.id },
          )
        : [],
    [
      query,
      companies,
      masterData,
      accountsPayable,
      accountsReceivable,
      documents,
      reports,
      reportTemplates,
      currentUser,
      activeCompany,
    ],
  );

  const showPanel = focused && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <SearchField
        value={query}
        onChange={setQuery}
        onFocus={() => setFocused(true)}
        placeholder="Buscar empresas, contas, documentos..."
        aria-label="Busca global"
      />
      {showPanel && (
        <div className="absolute z-30 mt-1.5 w-full min-w-80 max-h-96 overflow-y-auto rounded-xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark shadow-lg p-2 motion-safe:animate-[popIn_120ms_ease-out] origin-top">
          {groups.length === 0 ? (
            <p className="text-xs text-ink-soft dark:text-ink-soft-dark text-center py-6">
              Nenhum resultado para "{query}".
            </p>
          ) : (
            groups.map((group) => {
              const Icon = SEARCH_CATEGORY_ICON[group.category] || Search;
              return (
                <div key={group.category} className="mb-1.5 last:mb-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-soft dark:text-ink-soft-dark px-2 py-1">
                    {group.label}
                  </p>
                  {group.results.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => {
                        onNavigate(result);
                        setQuery("");
                        setFocused(false);
                      }}
                      className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-canvas dark:hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <Icon className="h-3.5 w-3.5 text-ink-soft dark:text-ink-soft-dark shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-ink dark:text-ink-dark truncate">
                          {result.title}
                        </span>
                        {result.subtitle && (
                          <span className="block text-[10px] text-ink-soft dark:text-ink-soft-dark truncate">
                            {result.subtitle}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function BPOWorkspaceShell({
  theme,
}: {
  theme: { isDarkMode: boolean; toggleTheme: () => void };
}) {
  const {
    currentUser,
    activeCompany,
    companies,
    switchCompany,
    hasPermission,
    isApprovalVisibleToCurrentUser,
    approvals,
    supportTickets,
    notifications,
    markNotificationRead,
    clearNotifications,
    logout,
  } = useBPOState();
  const { isDarkMode, toggleTheme } = theme;

  const enabledClientModules = getEffectiveClientModules(
    activeCompany,
    currentUser,
  );
  const isClientViewAllowed = (view: ViewType) =>
    currentUser.role !== "CLIENT" ||
    (ALL_CLIENT_MODULES.includes(view as ClientModule) &&
      enabledClientModules.includes(view as ClientModule));
  const clientFallbackView: ViewType = currentUser.clientOperator
    ? "support"
    : "dashboard";
  const getDefaultView = (role: string): ViewType =>
    role === "BPO_ADMIN"
      ? "operations-center"
      : role === "CLIENT"
        ? enabledClientModules[0] || clientFallbackView
        : "dashboard";

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

  useEffect(() => {
    if (currentUser.role === "CLIENT" && !isClientViewAllowed(activeView)) {
      setActiveView(enabledClientModules[0] || clientFallbackView);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompany?.id, activeCompany?.clientModules, activeView, currentUser.role]);

  // Fecha o menu mobile com Esc, mesmo sem clicar no scrim.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  if (!activeCompany) {
    return (
      <div className="min-h-screen bg-brand-navy-950 text-white flex items-center justify-center font-sans p-6 text-center">
        <div className="space-y-4 max-w-sm">
          <Building2 className="h-12 w-12 mx-auto text-white/40 animate-pulse" />
          <h2 className="text-lg font-bold">Nenhuma Empresa Ativa</h2>
          <p className="text-xs text-white/60">
            Por favor, reinicie os dados locais para provisionar os inquilinos
            iniciais de BPO.
          </p>
        </div>
      </div>
    );
  }

  const activeBrandLogo = isBpoGlobalMode
    ? idexLogo
    : resolveCompanyLogo(activeCompany.logoDataUrl, idexLogo);
  const activeBrandAlt = activeBrandLogo === idexLogo
    ? "Idex Finance - Gestão que move resultados"
    : `Logo de ${activeCompany.tradeName}`;

  // Pending approvals count badge
  const pendingApprovalsCount = approvals.filter(
    (a) =>
      a.status === "Pendente" &&
      a.companyId === activeCompany.id &&
      isApprovalVisibleToCurrentUser(a),
  ).length;

  // Unread notifications count
  const visibleNotifications = notifications.filter(
    (notification) =>
      (!notification.userId || notification.userId === currentUser.id) &&
      (!notification.companyId || notification.companyId === activeCompany.id),
  );
  const unreadNotifications = visibleNotifications.filter((n) => !n.isRead);

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
      icon: FolderOpen,
      view: "documents" as const,
      permission: null,
    },
    ...(["BPO_ADMIN", "BPO_TEAM"].includes(currentUser.role)
      ? [
          {
            id: "documents-received",
            label: "Lançamentos",
            icon: ClipboardList,
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
    {
      id: "bakery-cash",
      label: "Caixa Padaria",
      icon: Store,
      view: "bakery-cash" as const,
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
    "bakery-cash",
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
      icon: UsersRound,
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
    if (!isClientViewAllowed(activeView)) return null;
    switch (activeView) {
      case "dashboard":
        return <DashboardView onNavigate={handleSwitchView} />;
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
      case "bakery-cash":
        return <BakeryCashView />;
      case "service-desk":
        return <ServiceDeskView />;
      default:
        return <DashboardView onNavigate={setActiveView} />;
    }
  };

  const handleSwitchView = (view: ViewType) => {
    if (!isClientViewAllowed(view)) return;
    setActiveView(view);
    setMobileMenuOpen(false);
    // Returning to the operations center exits the single-company workspace back to the global BPO view.
    if (view === "operations-center") {
      setBpoInCompanyContext(false);
    }
  };

  const handleSearchNavigate = (result: GlobalSearchResult) => {
    if (result.companyId && result.companyId !== activeCompany.id) {
      switchCompany(result.companyId);
      if (currentUser.role === "BPO_ADMIN") setBpoInCompanyContext(true);
    }
    handleSwitchView(result.view as ViewType);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((previous) => {
      const next = !previous;
      localStorage.setItem("bpo_saas_sidebar_collapsed", String(next));
      return next;
    });
  };

  let previousNavGroup: string | null = null;

  return (
    <div className="min-h-screen flex bg-canvas dark:bg-canvas-dark text-ink dark:text-ink-dark font-sans">
      {/* Scrim de fundo do menu mobile — fecha ao tocar fora */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-brand-navy-950/50 z-40 md:hidden motion-safe:animate-[fadeIn_150ms_ease-out]"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Responsive Left Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 transform md:sticky md:top-0 md:h-screen md:translate-x-0 transition-[width,transform] duration-200 ease-in-out",
          "w-64",
          sidebarCollapsed ? "md:w-20" : "md:w-64",
          "bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark border-r border-line dark:border-line-dark flex flex-col justify-between z-50 shrink-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
          className="hidden md:flex absolute -right-3 top-8 h-7 w-7 items-center justify-center rounded-full bg-surface dark:bg-surface-dark text-brand-navy-900 dark:text-ink-dark border border-line dark:border-line-dark shadow-md hover:bg-brand-gold-300/30 dark:hover:bg-white/10 transition-colors cursor-pointer z-10"
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>

        <div className="flex flex-1 min-h-0 flex-col overflow-y-auto scrollbar-thin">
          {/* Brand Logo & Switchers */}
          <div
            className={cn(
              sidebarCollapsed ? "md:p-3" : "md:p-5",
              "p-5 border-b border-line dark:border-line-dark space-y-4",
            )}
          >
            <div className="flex flex-col items-center">
              {sidebarCollapsed ? (
                <div className="hidden md:flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-line dark:border-line-dark bg-white p-1.5">
                  <img
                    src={activeBrandLogo}
                    alt={activeBrandAlt}
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : null}
              <img
                src={activeBrandLogo}
                alt={activeBrandAlt}
                className={cn(sidebarCollapsed ? "md:hidden" : "", "h-16 w-full object-contain")}
              />
              <div
                className={cn(
                  sidebarCollapsed ? "md:hidden" : "",
                  "w-12 h-0.5 bg-brand-red-600 mt-1 rounded-full",
                )}
              />
            </div>

            {/* Client / Tenant switcher — hidden in BPO global mode; use the Operations Center to enter a company instead */}
            {!isBpoGlobalMode && (
              <div className={sidebarCollapsed ? "md:hidden" : ""}>
                <CompanySwitcher
                  companies={companies.filter(
                    (c) =>
                      currentUser.role === "BPO_ADMIN" ||
                      currentUser.companies?.includes(c.id),
                  )}
                  activeCompany={activeCompany}
                  onSelect={(companyId) => {
                    switchCompany(companyId);
                    if (currentUser.role === "BPO_ADMIN")
                      setBpoInCompanyContext(true);
                  }}
                />
              </div>
            )}
          </div>

          {/* Navigation Links List */}
          <nav
            className={cn(sidebarCollapsed ? "md:px-3" : "md:px-4", "p-4 space-y-1 grow")}
          >
            {hasPermission("operations-center.view") && (
              <div className="pb-3 mb-3 border-b border-line dark:border-line-dark">
                <button
                  onClick={() => handleSwitchView("operations-center")}
                  title={sidebarCollapsed ? "Centro de Operação" : undefined}
                  className={cn(
                    "w-full flex items-center justify-between px-3",
                    sidebarCollapsed ? "md:justify-center md:px-2" : "",
                    "py-2.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer",
                    activeView === "operations-center"
                      ? "bg-brand-blue-50 dark:bg-brand-navy-700/20 text-brand-navy-900 dark:text-white border-l-4 border-brand-red-600"
                      : "text-ink-soft dark:text-ink-soft-dark hover:bg-canvas dark:hover:bg-white/5 hover:text-ink dark:hover:text-ink-dark",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="h-4 w-4" />
                    <span className={sidebarCollapsed ? "md:hidden" : ""}>
                      Centro de Operação
                    </span>
                  </div>
                </button>
              </div>
            )}

            {orderedNavigationItems.map((item) => {
              if (item.id === "operations-center") return null;
              if (item.permission && !hasPermission(item.permission))
                return null;
              if (!isClientViewAllowed(item.view)) return null;
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

              if (item.id === "support") {
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSwitchView(item.view)}
                    title={sidebarCollapsed ? "Fale com o BPO" : undefined}
                    aria-label="Precisa de ajuda? Fale com o BPO"
                    className={cn(
                      "mt-4 w-full rounded-xl border text-left transition-all cursor-pointer",
                      sidebarCollapsed
                        ? "md:flex md:h-11 md:items-center md:justify-center md:p-0 p-3"
                        : "p-3",
                      isSelected
                        ? "border-brand-red-600 bg-brand-red-50 dark:bg-brand-red-600/10 ring-2 ring-brand-red-600/20"
                        : "border-line dark:border-line-dark bg-canvas dark:bg-white/5 hover:border-brand-red-600/50",
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center",
                        sidebarCollapsed ? "md:justify-center" : "",
                        "gap-3",
                      )}
                    >
                      <MessageSquareText
                        className="h-6 w-6 shrink-0 text-brand-red-600"
                        strokeWidth={1.8}
                      />
                      <div className={sidebarCollapsed ? "md:hidden" : ""}>
                        <span className="block text-xs font-extrabold leading-tight text-ink dark:text-ink-dark">
                          Precisa de ajuda?
                        </span>
                        <span className="mt-1 block text-xs font-medium leading-tight text-ink-soft dark:text-ink-soft-dark">
                          Fale com o BPO
                        </span>
                      </div>
                    </div>
                  </button>
                );
              }

              const group = NAV_GROUP[item.id] ?? null;
              const showGroupHeader = group !== null && group !== previousNavGroup;
              previousNavGroup = group;

              return (
                <React.Fragment key={item.id}>
                  {showGroupHeader && (
                    <span
                      className={cn(
                        sidebarCollapsed ? "md:hidden" : "",
                        "text-[10px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider px-3 block pt-4 pb-1",
                      )}
                    >
                      {group}
                    </span>
                  )}
                  <button
                    onClick={() => handleSwitchView(item.view)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={cn(
                      "relative w-full flex items-center justify-between px-3",
                      sidebarCollapsed ? "md:justify-center md:px-2" : "",
                      "py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer",
                      isSelected
                        ? "bg-brand-blue-50 dark:bg-brand-navy-700/20 text-brand-navy-900 dark:text-white border-l-4 border-brand-red-600 font-bold"
                        : "text-ink-soft dark:text-ink-soft-dark hover:bg-canvas dark:hover:bg-white/5 hover:text-ink dark:hover:text-ink-dark",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className={sidebarCollapsed ? "md:hidden" : ""}>
                        {item.label}
                      </span>
                    </div>
                    {item.badge && (
                      <span
                        className={cn(
                          sidebarCollapsed
                            ? "md:absolute md:translate-x-3 md:-translate-y-3"
                            : "",
                          "h-4 min-w-4 px-1 font-black text-[9px] rounded-full flex items-center justify-center bg-brand-red-600 text-white",
                        )}
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
                className={cn(
                  sidebarCollapsed ? "md:pt-2 md:border-t md:border-line-dark" : "pt-4",
                  "space-y-1",
                )}
              >
                <span
                  className={cn(
                    sidebarCollapsed ? "md:hidden" : "",
                    "text-[10px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider px-3 block mb-2",
                  )}
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
                      className={cn(
                        "w-full flex items-center justify-between px-3",
                        sidebarCollapsed ? "md:justify-center md:px-2" : "",
                        "py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer",
                        isSelected
                          ? "bg-brand-blue-50 dark:bg-brand-navy-700/20 text-brand-navy-900 dark:text-white border-l-4 border-brand-red-600 font-bold"
                          : "text-ink-soft dark:text-ink-soft-dark hover:bg-canvas dark:hover:bg-white/5 hover:text-ink dark:hover:text-ink-dark",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className={sidebarCollapsed ? "md:hidden" : ""}>
                          {item.label}
                        </span>
                      </div>
                      {"badge" in item && item.badge && (
                        <span
                          className={cn(
                            sidebarCollapsed
                              ? "md:absolute md:translate-x-3 md:-translate-y-3"
                              : "",
                            "h-4 min-w-4 px-1 font-black text-[9px] rounded-full flex items-center justify-center bg-brand-red-600 text-white",
                          )}
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
          className={cn(
            sidebarCollapsed ? "md:p-3" : "md:p-4",
            "p-4 border-t border-line dark:border-line-dark space-y-3 bg-canvas/60 dark:bg-white/2",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-3 p-2.5",
              sidebarCollapsed ? "md:justify-center md:gap-0 md:p-2" : "",
              "bg-surface dark:bg-white/5 rounded-lg border border-line dark:border-line-dark",
            )}
          >
            <span className="h-8 w-8 rounded-full bg-brand-navy-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
              {getInitials(currentUser.name)}
            </span>
            <div className={cn(sidebarCollapsed ? "md:hidden" : "", "space-y-0.5 truncate grow")}>
              <span className="text-[11px] font-bold text-ink dark:text-ink-dark block truncate leading-tight">
                {currentUser.name}
              </span>
              <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark font-medium block truncate">
                {currentUser.title || "Membro do Time"}
              </span>
            </div>
            <IconButton
              icon={<LogOut className="h-4 w-4" />}
              label="Sair"
              variant="ghost"
              size="sm"
              onClick={logout}
              className={cn(sidebarCollapsed ? "md:hidden" : "", "shrink-0")}
            />
          </div>
          {sidebarCollapsed && (
            <IconButton
              icon={<LogOut className="h-4 w-4" />}
              label="Sair"
              variant="ghost"
              size="sm"
              onClick={logout}
              className="hidden md:flex mx-auto"
            />
          )}
          <p
            className={cn(
              sidebarCollapsed ? "md:hidden" : "",
              "text-center text-[9px] uppercase tracking-wider text-ink-soft/70 dark:text-ink-soft-dark/60",
            )}
          >
            Desenvolvido por{" "}
            <span className="text-ink-soft dark:text-ink-soft-dark font-bold">
              NFlow Analytics
            </span>
          </p>
        </div>
      </aside>

      {/* Main column: unified header + content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-8 h-17 bg-surface dark:bg-surface-dark border-b border-line dark:border-line-dark shrink-0 shadow-[0_1px_2px_rgba(23,32,51,0.04)]">
          <IconButton
            icon={mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            variant="ghost"
            onClick={() => setMobileMenuOpen((value) => !value)}
            className="md:hidden shrink-0"
          />

          <img src={activeBrandLogo} alt={activeBrandAlt} className="h-8 w-16 object-contain md:hidden" />

          <div className="hidden md:flex items-center gap-2 min-w-0">
            <span className="text-brand-navy-900 dark:text-ink-soft-dark font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shrink-0">
              <LayoutDashboard className="h-3.5 w-3.5 text-brand-red-600" /> Idex
              Finance Workspace
            </span>
            <span className="text-line dark:text-line-dark">/</span>
            <span className="text-brand-navy-900 dark:text-ink-dark font-semibold text-xs flex items-center gap-1.5 bg-brand-blue-50 dark:bg-white/5 border-l-2 border-brand-red-600 px-3 py-1.5 rounded-md truncate">
              <Building2 className="h-3.5 w-3.5 text-brand-navy-700 dark:text-ink-soft-dark shrink-0" />{" "}
              <span className="truncate">
                {activeCompany.tradeName} ({activeCompany.cnpj})
              </span>
            </span>
          </div>

          <div className="flex-1 flex justify-end md:justify-center">
            <GlobalSearch onNavigate={handleSearchNavigate} />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <IconButton
              icon={isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              label={isDarkMode ? "Usar tema claro" : "Usar tema escuro"}
              variant="ghost"
              onClick={toggleTheme}
            />
            <div className="relative">
              <IconButton
                icon={<Bell className="h-4 w-4" />}
                label="Notificações"
                variant="ghost"
                onClick={() => setNotificationsOpen(true)}
              />
              {unreadNotifications.length > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 bg-brand-red-600 text-white rounded-full flex items-center justify-center text-[9px] font-bold pointer-events-none">
                  {unreadNotifications.length}
                </span>
              )}
            </div>
            <Dropdown
              align="right"
              trigger={
                <button
                  type="button"
                  className="hidden sm:flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-canvas dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <span className="h-8 w-8 rounded-full bg-brand-navy-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {getInitials(currentUser.name)}
                  </span>
                  <span className="text-left hidden lg:block">
                    <span className="text-xs font-semibold text-ink dark:text-ink-dark block leading-tight">
                      {currentUser.name}
                    </span>
                    <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark block font-medium">
                      {currentUser.role.replace(/_/g, " ")}
                    </span>
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-ink-soft dark:text-ink-soft-dark hidden lg:block" />
                </button>
              }
              items={[
                ...(["CLIENT", "ACCOUNTANT"].includes(currentUser.role)
                  ? [
                      {
                        label: "Central de Ajuda",
                        icon: <MessageSquareText className="h-3.5 w-3.5" />,
                        onClick: () => handleSwitchView("support"),
                      },
                    ]
                  : []),
                { label: "Sair", icon: <LogOut className="h-3.5 w-3.5" />, onClick: logout, danger: true },
              ]}
            />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl w-full mx-auto p-4 md:p-8 motion-safe:animate-[fadeIn_180ms_ease-out]">
            {renderActiveView()}
          </div>
        </main>
      </div>

      {/* Painel de notificações */}
      <Drawer
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        title={
          <span className="flex items-center gap-1.5">
            <Bell className="h-4 w-4 text-brand-red-600" /> Alertas e Notificações
          </span>
        }
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              onClick={clearNotifications}
              className="text-[11px] text-ink dark:text-ink-dark font-semibold hover:underline cursor-pointer"
            >
              Marcar todas como lidas
            </button>
            <span
              className="text-[10px] text-amber-700 dark:text-brand-gold-300 font-mono"
              title="Os dados deste ambiente ainda ficam somente neste navegador."
            >
              Dados locais · sem sincronização
            </span>
          </div>
        }
      >
        <div className="divide-y divide-line dark:divide-line-dark">
          {visibleNotifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => markNotificationRead(notif.id)}
              className={cn(
                "p-4 hover:bg-canvas dark:hover:bg-white/5 transition-colors cursor-pointer border-l-4",
                notif.isRead
                  ? "border-transparent opacity-60"
                  : "border-brand-red-600 bg-brand-gold-300/10 dark:bg-brand-gold-300/5 font-semibold",
              )}
            >
              <div className="flex justify-between items-start gap-1.5 mb-1 text-[10px] text-ink-soft dark:text-ink-soft-dark">
                <span className="font-mono">
                  {new Date(notif.createdAt).toLocaleTimeString("pt-BR")}
                </span>
                <span className="uppercase font-semibold tracking-wider">{notif.type}</span>
              </div>
              <h4 className="text-xs font-semibold text-ink dark:text-ink-dark mb-0.5">
                {notif.title}
              </h4>
              <p className="text-ink-soft dark:text-ink-soft-dark leading-normal text-[11px]">
                {notif.message}
              </p>
            </div>
          ))}
          {visibleNotifications.length === 0 && (
            <div className="p-8 text-center text-ink-soft dark:text-ink-soft-dark italic text-xs">
              Nenhum alerta recente.
            </div>
          )}
        </div>
      </Drawer>
    </div>
  );
}

function AppGate() {
  const { isAuthenticated } = useBPOState();
  const theme = useThemeMode();
  return isAuthenticated ? (
    <BPOWorkspaceShell theme={theme} />
  ) : (
    <LoginView theme={theme} />
  );
}

export default function App() {
  return (
    <BPOProvider>
      <BakeryCashProvider>
        <ToastProvider>
          <AppGate />
        </ToastProvider>
      </BakeryCashProvider>
    </BPOProvider>
  );
}
