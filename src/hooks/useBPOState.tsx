/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  User,
  Company,
  Tenant,
  BankAccount,
  AccountPayable,
  AccountReceivable,
  Approval,
  Document,
  AuditLog,
  Notification,
  ReportRecord,
  BankStatementItem,
  UserRole,
  SupportTicket,
  SupportAttachment,
  SupportTicketPriority,
  SupportTicketStatus,
  MasterDataOption,
  MasterDataType,
} from "../types";
import {
  INITIAL_TENANTS,
  INITIAL_COMPANIES,
  INITIAL_USERS,
  INITIAL_BANK_ACCOUNTS,
  INITIAL_ACCOUNTS_PAYABLE,
  INITIAL_ACCOUNTS_RECEIVABLE,
  INITIAL_APPROVALS,
  INITIAL_DOCUMENTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_NOTIFICATIONS,
  BANK_STATEMENTS_TO_IMPORT,
  ACCESS_PASSWORD,
} from "../services/mockData";

const PRIMARY_USER_ID = "u-client-admin";
const USER_STORAGE_VERSION = "professional-users-v2";
const LEGACY_DEMO_USER_IDS = new Set([
  "u-bpo-admin",
  "u-bpo-analyst",
  "u-client-sabor",
  "u-accountant",
]);

const createDocumentApproval = (document: Document): Approval => {
  const approvalDeadline = new Date();
  approvalDeadline.setDate(approvalDeadline.getDate() + 2);
  return {
    id: `apv-doc-${document.id}`,
    companyId: document.companyId,
    type: "DOCUMENTO",
    relatedId: document.id,
    description: `Validar documento: ${document.name}`,
    amount: document.amount || 0,
    dueDate: document.dueDate || document.uploadedAt.slice(0, 10),
    requesterId: document.uploadedById,
    requesterName: document.uploadedByName,
    dueDateApproval: approvalDeadline.toISOString(),
    status: "Pendente",
    attachmentName: document.name,
    attachmentUrl: document.signedUrl,
    createdAt: document.uploadedAt,
    history: [],
  };
};

interface BPOContextType {
  tenants: Tenant[];
  companies: Company[];
  users: User[];
  bankAccounts: BankAccount[];
  masterData: MasterDataOption[];
  accountsPayable: AccountPayable[];
  accountsReceivable: AccountReceivable[];
  approvals: Approval[];
  documents: Document[];
  auditLogs: AuditLog[];
  notifications: Notification[];
  reports: ReportRecord[];
  statementItems: Record<string, BankStatementItem[]>;
  supportTickets: SupportTicket[];
  isUserOnline: (userId: string) => boolean;

  currentUser: User;
  activeCompany: Company | null;
  activeTenant: Tenant | null;
  isAuthenticated: boolean;

  // Controls
  login: (
    email: string,
    password: string,
  ) => { success: boolean; error?: string };
  logout: () => void;
  switchCompany: (companyId: string) => void;
  hasPermission: (permission: string) => boolean;
  addMasterData: (
    type: MasterDataType,
    name: string,
    parentId?: string,
  ) => void;
  updateMasterData: (
    id: string,
    updates: Partial<Pick<MasterDataOption, "name" | "parentId" | "active">>,
  ) => void;
  deleteMasterData: (id: string) => void;
  addBankAccount: (data: Omit<BankAccount, "id" | "companyId">) => void;
  updateBankAccount: (
    id: string,
    updates: Partial<Omit<BankAccount, "id" | "companyId">>,
  ) => void;
  deleteBankAccount: (id: string) => void;

  // Actions
  addAccountPayable: (
    data: Omit<
      AccountPayable,
      "id" | "companyId" | "createdAt" | "updatedAt" | "finalAmount" | "status"
    >,
  ) => void;
  updateAccountPayable: (id: string, updates: Partial<AccountPayable>) => void;
  cancelAccountPayable: (id: string) => void;
  payAccountPayable: (id: string, date: string, receiptUrl?: string) => void;
  scheduleAccountPayable: (id: string) => void;

  addAccountReceivable: (
    data: Omit<
      AccountReceivable,
      | "id"
      | "companyId"
      | "createdAt"
      | "updatedAt"
      | "receivedAmount"
      | "status"
    >,
  ) => void;
  updateAccountReceivable: (
    id: string,
    updates: Partial<AccountReceivable>,
  ) => void;
  cancelAccountReceivable: (id: string) => void;
  receiveAccountReceivable: (id: string, amount: number, date: string) => void;

  decideApproval: (
    approvalId: string,
    decision: "Aprovada" | "Rejeitada" | "Ajuste solicitado",
    comment: string,
  ) => void;

  uploadDocument: (data: {
    name: string;
    description: string;
    category: Document["category"];
    competenceMonth: string;
    fileSize: string;
    mimeType: string;
    relatedEntityId?: string;
    aiSummary?: string;
    extractedData?: Record<string, string>;
    processingConfidence?: number;
    companyId?: string;
    supplier?: string;
    dueDate?: string;
    expenseType?: string;
    documentNumber?: string;
    amount?: number;
    analysisWarnings?: string[];
    previewUrl?: string;
  }) => void;
  deleteDocument: (id: string) => void;
  updateDocument: (id: string, updates: Partial<Document>) => void;
  launchDocument: (id: string, updates?: Partial<Document>) => void;
  submitDocumentForApproval: (id: string, updates?: Partial<Document>) => void;
  cancelDocument: (id: string) => void;
  createStandaloneLaunch: (
    data: Partial<Document> &
      Pick<Document, "description" | "supplier" | "dueDate" | "amount">,
  ) => void;

  importStatement: (bankAccountId: string) => void;
  reconcileItemManually: (
    bankAccountId: string,
    statementItemId: string,
    financialRecordId: string,
    type: "A_PAGAR" | "A_RECEBER",
    notes: string,
  ) => void;
  autoReconcileBank: (bankAccountId: string) => void;
  ignoreStatementItem: (
    bankAccountId: string,
    statementItemId: string,
    reason: string,
  ) => void;

  generateReport: (name: string, type: string, filters: string) => void;

  addCompany: (data: Omit<Company, "id" | "createdAt" | "status">) => void;
  updateCompany: (
    id: string,
    updates: Partial<Omit<Company, "id" | "createdAt" | "tenantId">>,
  ) => void;
  updateCompanyStatus: (id: string, status: Company["status"]) => void;

  addTeamMember: (data: Omit<User, "id">) => void;
  updateTeamMemberPermissions: (
    id: string,
    permissions: string[],
    status?: "ACTIVE" | "INACTIVE",
    companies?: string[],
  ) => void;

  addNotification: (
    title: string,
    message: string,
    type: Notification["type"],
  ) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  createSupportTicket: (
    data: Pick<
      SupportTicket,
      "category" | "subject" | "description" | "priority"
    >,
  ) => string;
  addSupportMessage: (
    ticketId: string,
    content: string,
    attachments?: SupportAttachment[],
  ) => void;
  updateSupportTicket: (
    ticketId: string,
    updates: {
      status?: SupportTicketStatus;
      priority?: SupportTicketPriority;
      assignedToId?: string;
    },
  ) => void;
}

const BPOContext = createContext<BPOContextType | undefined>(undefined);

export function BPOProvider({ children }: { children: ReactNode }) {
  // Helper to load from local storage
  const loadState = <T,>(key: string, defaultValue: T): T => {
    try {
      const stored = localStorage.getItem(`bpo_saas_${key}`);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const [tenants, setTenants] = useState<Tenant[]>(() =>
    loadState("tenants", INITIAL_TENANTS),
  );
  const [companies, setCompanies] = useState<Company[]>(() =>
    loadState("companies", INITIAL_COMPANIES),
  );
  const [users, setUsers] = useState<User[]>(() => {
    const storedUsers = loadState<User[]>("users", INITIAL_USERS);
    const migratedUsers = storedUsers.filter(
      (user) => !LEGACY_DEMO_USER_IDS.has(user.id),
    );
    const provisionedUsers = INITIAL_USERS.map(
      (initialUser) =>
        migratedUsers.find((user) => user.id === initialUser.id) || initialUser,
    );
    const additionalUsers = migratedUsers.filter(
      (user) =>
        !INITIAL_USERS.some((initialUser) => initialUser.id === user.id),
    );
    localStorage.setItem("bpo_saas_user_storage_version", USER_STORAGE_VERSION);
    return [...provisionedUsers, ...additionalUsers];
  });
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() =>
    loadState("bankAccounts", INITIAL_BANK_ACCOUNTS),
  );
  const [masterData, setMasterData] = useState<MasterDataOption[]>(() =>
    loadState(
      "masterData",
      companies.flatMap((company) => {
        const defaults: Array<[MasterDataType, string]> = [
          ["CATEGORY", "Aluguel"],
          ["CATEGORY", "Energia"],
          ["CATEGORY", "Marketing"],
          ["CATEGORY", "Fornecedores"],
          ["COST_CENTER", "Administrativo"],
          ["COST_CENTER", "Comercial"],
          ["COST_CENTER", "Operacional"],
          ["PAYMENT_METHOD", "PIX"],
          ["PAYMENT_METHOD", "Transferência"],
          ["PAYMENT_METHOD", "Boleto"],
          ["PAYMENT_METHOD", "Débito automático"],
          ["DOCUMENT_TYPE", "Nota fiscal"],
          ["DOCUMENT_TYPE", "Boleto"],
          ["DOCUMENT_TYPE", "Comprovante"],
          ["DOCUMENT_TYPE", "Recibo"],
          ["DOCUMENT_TYPE", "Contrato"],
          ["DOCUMENT_TYPE", "Extrato"],
          ["DOCUMENT_TYPE", "Outros"],
        ];
        return defaults.map(([type, name], index) => ({
          id: `md-default-${company.id}-${index}`,
          companyId: company.id,
          type,
          name,
          active: true,
          createdAt: new Date().toISOString(),
        }));
      }),
    ),
  );
  const [accountsPayable, setAccountsPayable] = useState<AccountPayable[]>(() =>
    loadState<AccountPayable[]>(
      "accountsPayable",
      INITIAL_ACCOUNTS_PAYABLE,
    ).map((item) => {
      const mapped =
        (
          { Pendente: "A vencer", Aprovada: "A vencer" } as Record<
            string,
            AccountPayable["status"]
          >
        )[item.status] || item.status;
      return {
        ...item,
        status:
          mapped === "A vencer" &&
          item.dueDate < new Date().toISOString().slice(0, 10)
            ? "Vencida"
            : mapped,
      };
    }),
  );
  const [accountsReceivable, setAccountsReceivable] = useState<
    AccountReceivable[]
  >(() =>
    loadState<AccountReceivable[]>(
      "accountsReceivable",
      INITIAL_ACCOUNTS_RECEIVABLE,
    ).map((item) => {
      const mapped =
        (
          {
            Emitida: "A receber",
            "Parcialmente recebida": "Parcialmente recebido",
            Recebida: "Recebido",
            Vencida: "Vencido",
            Cancelada: "Cancelado",
          } as Record<string, AccountReceivable["status"]>
        )[item.status] || item.status;
      return {
        ...item,
        status:
          ["A receber", "Parcialmente recebido"].includes(mapped) &&
          item.dueDate < new Date().toISOString().slice(0, 10)
            ? "Vencido"
            : mapped,
      };
    }),
  );
  const [approvals, setApprovals] = useState<Approval[]>(() =>
    loadState<Approval[]>("approvals", INITIAL_APPROVALS).map((approval) => ({
      ...approval,
      attachmentUrl: approval.attachmentUrl?.includes("bpo-storage.com")
        ? undefined
        : approval.attachmentUrl,
    })),
  );
  const [documents, setDocuments] = useState<Document[]>(() =>
    loadState<Document[]>("documents", INITIAL_DOCUMENTS).map((document) => ({
      ...document,
      status:
        (
          {
            Pendente: "Aguardando Análise",
            Validado: "Lançado",
            Rejeitado: "Cancelado",
            Arquivado: "Cancelado",
          } as Record<string, Document["status"]>
        )[document.status] || document.status,
      signedUrl: document.signedUrl?.includes("bpo-storage.com")
        ? undefined
        : document.signedUrl,
    })),
  );
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() =>
    loadState<AuditLog[]>("auditLogs", INITIAL_AUDIT_LOGS).filter(
      (log) => !LEGACY_DEMO_USER_IDS.has(log.userId),
    ),
  );
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const raw = loadState("notifications", INITIAL_NOTIFICATIONS);
    const seen = new Set<string>();
    const deduped: Notification[] = [];
    raw.forEach((notif) => {
      if (!seen.has(notif.id)) {
        seen.add(notif.id);
        deduped.push(notif);
      } else {
        const newId = `${notif.id}-dup-${Math.random().toString(36).substring(2, 9)}`;
        seen.add(newId);
        deduped.push({ ...notif, id: newId });
      }
    });
    return deduped;
  });
  const [reports, setReports] = useState<ReportRecord[]>(() =>
    loadState("reports", []),
  );
  const [statementItems, setStatementItems] = useState<
    Record<string, BankStatementItem[]>
  >(() => loadState("statementItems", BANK_STATEMENTS_TO_IMPORT));
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(() =>
    loadState("supportTickets", []),
  );

  useEffect(() => {
    setApprovals((current) => {
      const linkedDocumentIds = new Set(
        current
          .filter((approval) => approval.type === "DOCUMENTO")
          .map((approval) => approval.relatedId),
      );
      const missingApprovals = documents
        .filter(
          (document) =>
            document.status === "Aguardando Aprovação" &&
            !linkedDocumentIds.has(document.id),
        )
        .map(createDocumentApproval);
      let changed = missingApprovals.length > 0;
      const synchronized = current.map((approval) => {
        if (approval.type !== "DOCUMENTO") return approval;
        const document = documents.find(
          (item) => item.id === approval.relatedId,
        );
        if (!document) return approval;
        const attachmentName = document.name;
        const attachmentUrl = document.signedUrl;
        if (
          approval.attachmentName === attachmentName &&
          approval.attachmentUrl === attachmentUrl
        )
          return approval;
        changed = true;
        return { ...approval, attachmentName, attachmentUrl };
      });
      return changed ? [...missingApprovals, ...synchronized] : current;
    });
  }, [documents]);

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    const storedUserId = loadState("currentUserId", PRIMARY_USER_ID);
    return users.some((user) => user.id === storedUserId)
      ? storedUserId
      : PRIMARY_USER_ID;
  });
  const [activeCompanyId, setActiveCompanyId] = useState<string>(() =>
    loadState("activeCompanyId", "c-101"),
  );
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const storedUserId = loadState("currentUserId", PRIMARY_USER_ID);
    return (
      users.some((user) => user.id === storedUserId) &&
      loadState("isAuthenticated", false)
    );
  });

  // Sync to local storage on changes
  useEffect(() => {
    localStorage.setItem("bpo_saas_tenants", JSON.stringify(tenants));
    localStorage.setItem("bpo_saas_companies", JSON.stringify(companies));
    localStorage.setItem("bpo_saas_users", JSON.stringify(users));
    localStorage.setItem("bpo_saas_bankAccounts", JSON.stringify(bankAccounts));
    localStorage.setItem("bpo_saas_masterData", JSON.stringify(masterData));
    localStorage.setItem(
      "bpo_saas_accountsPayable",
      JSON.stringify(accountsPayable),
    );
    localStorage.setItem(
      "bpo_saas_accountsReceivable",
      JSON.stringify(accountsReceivable),
    );
    localStorage.setItem("bpo_saas_approvals", JSON.stringify(approvals));
    localStorage.setItem("bpo_saas_documents", JSON.stringify(documents));
    localStorage.setItem("bpo_saas_auditLogs", JSON.stringify(auditLogs));
    localStorage.setItem(
      "bpo_saas_notifications",
      JSON.stringify(notifications),
    );
    localStorage.setItem("bpo_saas_reports", JSON.stringify(reports));
    localStorage.setItem(
      "bpo_saas_statementItems",
      JSON.stringify(statementItems),
    );
    localStorage.setItem(
      "bpo_saas_supportTickets",
      JSON.stringify(supportTickets),
    );
    localStorage.setItem(
      "bpo_saas_currentUserId",
      JSON.stringify(currentUserId),
    );
    localStorage.setItem(
      "bpo_saas_activeCompanyId",
      JSON.stringify(activeCompanyId),
    );
    localStorage.setItem(
      "bpo_saas_isAuthenticated",
      JSON.stringify(isAuthenticated),
    );
  }, [
    tenants,
    companies,
    users,
    bankAccounts,
    masterData,
    accountsPayable,
    accountsReceivable,
    approvals,
    documents,
    auditLogs,
    notifications,
    reports,
    statementItems,
    supportTickets,
    currentUserId,
    activeCompanyId,
    isAuthenticated,
  ]);

  // Derived current user, active company, and tenant
  const currentUser = users.find((u) => u.id === currentUserId) || users[0];
  const [presenceTick, setPresenceTick] = useState(0);
  const presenceKey = "bpo_saas_user_presence";
  const readPresence = (): Record<string, number> => {
    try {
      return JSON.parse(localStorage.getItem(presenceKey) || "{}");
    } catch {
      return {};
    }
  };
  const isUserOnline = (userId: string) =>
    Date.now() - (readPresence()[userId] || 0) < 45000;

  useEffect(() => {
    if (!isAuthenticated) return;
    const heartbeat = () => {
      const presence = readPresence();
      presence[currentUser.id] = Date.now();
      localStorage.setItem(presenceKey, JSON.stringify(presence));
      setPresenceTick((value) => value + 1);
    };
    heartbeat();
    const interval = window.setInterval(heartbeat, 15000);
    return () => window.clearInterval(interval);
  }, [currentUser.id, isAuthenticated]);
  void presenceTick;
  const authorizedCompanies =
    currentUser.role === "BPO_ADMIN"
      ? companies
      : companies.filter((company) =>
          currentUser.companies?.includes(company.id),
        );
  const activeCompany =
    authorizedCompanies.find((c) => c.id === activeCompanyId) ||
    authorizedCompanies[0] ||
    null;
  const activeTenant = activeCompany
    ? tenants.find((t) => t.id === activeCompany.tenantId) || null
    : null;

  const switchCompany = (companyId: string) => {
    // Check if current user is authorized to view this company
    const isAuthorized =
      currentUser.role === "BPO_ADMIN" ||
      (currentUser.companies && currentUser.companies.includes(companyId));

    if (isAuthorized) {
      setActiveCompanyId(companyId);
    }
  };

  const hasPermission = (permission: string): boolean => {
    return (
      currentUser.permissions.includes(permission) ||
      currentUser.role === "BPO_ADMIN"
    );
  };

  // --- AUTHENTICATION ---
  const login = (
    email: string,
    password: string,
  ): { success: boolean; error?: string } => {
    const normalizedEmail = email.trim().toLowerCase();
    const targetUser = users.find(
      (u) => u.email.toLowerCase() === normalizedEmail,
    );

    if (!targetUser) {
      return {
        success: false,
        error: "E-mail não encontrado. Verifique e tente novamente.",
      };
    }
    if (targetUser.status !== "ACTIVE") {
      return {
        success: false,
        error: "Este usuário está inativo. Contate o administrador.",
      };
    }
    if (password !== ACCESS_PASSWORD) {
      return { success: false, error: "Senha incorreta." };
    }

    setCurrentUserId(targetUser.id);
    setIsAuthenticated(true);

    if (targetUser.role === "BPO_ADMIN") {
      setActiveCompanyId("c-101");
    } else if (targetUser.companies && targetUser.companies.length > 0) {
      setActiveCompanyId(targetUser.companies[0]);
    }

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      tenantId:
        targetUser.role === "BPO_ADMIN"
          ? "t-1111-1111"
          : companies.find((c) => targetUser.companies?.includes(c.id))
              ?.tenantId || "t-1111-1111",
      userId: targetUser.id,
      userName: targetUser.name,
      role: targetUser.role,
      action: "SESSAO_LOGIN",
      entityType: "User",
      entityId: targetUser.id,
      timestamp: new Date().toISOString(),
      ipAddress: "189.23.41.221",
      userAgent: navigator.userAgent,
      origin: "Tela de Login",
    };
    setAuditLogs((prev) => [newLog, ...prev]);

    return { success: true };
  };

  const logout = () => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      tenantId: activeTenant?.id || "t-1111-1111",
      userId: currentUser.id,
      userName: currentUser.name,
      role: currentUser.role,
      action: "SESSAO_LOGOUT",
      entityType: "User",
      entityId: currentUser.id,
      timestamp: new Date().toISOString(),
      ipAddress: "189.23.41.221",
      userAgent: navigator.userAgent,
      origin: "Workspace",
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    const presence = readPresence();
    delete presence[currentUser.id];
    localStorage.setItem(presenceKey, JSON.stringify(presence));
    setIsAuthenticated(false);
  };

  // Create an audit log entry helper
  const createAuditLog = (
    action: string,
    entityType: string,
    entityId: string,
    companyId?: string,
    prevData?: any,
    nextData?: any,
  ) => {
    const targetCompany = companies.find(
      (c) => c.id === (companyId || activeCompanyId),
    );
    const log: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      tenantId: targetCompany?.tenantId || activeTenant?.id || "t-1111-1111",
      companyId: companyId || activeCompanyId,
      companyName: targetCompany?.tradeName,
      userId: currentUser.id,
      userName: currentUser.name,
      role: currentUser.role,
      action,
      entityType,
      entityId,
      previousData: prevData ? JSON.stringify(prevData) : undefined,
      nextData: nextData ? JSON.stringify(nextData) : undefined,
      timestamp: new Date().toISOString(),
      ipAddress: "177.34.82.109",
      userAgent: navigator.userAgent,
      origin: "BPO Dashboard Core",
    };
    setAuditLogs((prev) => [log, ...prev]);
  };

  // Add Notification helper
  const addNotification = (
    title: string,
    message: string,
    type: Notification["type"],
  ) => {
    const notif: Notification = {
      id: `not-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      companyId: activeCompanyId,
      title,
      message,
      type,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [notif, ...prev]);
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
  };

  const clearNotifications = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const addMasterData = (
    type: MasterDataType,
    name: string,
    parentId?: string,
  ) => {
    if (!["BPO_ADMIN", "BPO_TEAM"].includes(currentUser.role) || !name.trim())
      return;
    const item: MasterDataOption = {
      id: `md-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      companyId: activeCompanyId,
      type,
      name: name.trim(),
      parentId,
      active: true,
      createdAt: new Date().toISOString(),
    };
    setMasterData((prev) => [...prev, item]);
    createAuditLog(
      "CRIAR_CADASTRO_MESTRE",
      "MasterData",
      item.id,
      activeCompanyId,
      null,
      item,
    );
  };
  const updateMasterData = (
    id: string,
    updates: Partial<Pick<MasterDataOption, "name" | "parentId" | "active">>,
  ) =>
    setMasterData((prev) =>
      prev.map((item) =>
        item.id === id &&
        item.companyId === activeCompanyId &&
        ["BPO_ADMIN", "BPO_TEAM"].includes(currentUser.role)
          ? { ...item, ...updates }
          : item,
      ),
    );
  const deleteMasterData = (id: string) =>
    setMasterData((prev) => {
      const target = prev.find((item) => item.id === id);
      if (
        !target ||
        target.companyId !== activeCompanyId ||
        !["BPO_ADMIN", "BPO_TEAM"].includes(currentUser.role)
      )
        return prev;
      return prev.filter((item) => item.id !== id && item.parentId !== id);
    });
  const addBankAccount = (data: Omit<BankAccount, "id" | "companyId">) => {
    if (!["BPO_ADMIN", "BPO_TEAM"].includes(currentUser.role)) return;
    const account: BankAccount = {
      ...data,
      id: `ba-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      companyId: activeCompanyId,
      balance: Number(data.balance),
    };
    setBankAccounts((prev) => [...prev, account]);
    createAuditLog(
      "CRIAR_CONTA_BANCARIA",
      "BankAccount",
      account.id,
      activeCompanyId,
      null,
      account,
    );
  };
  const deleteBankAccount = (id: string) =>
    setBankAccounts((prev) => {
      const target = prev.find((account) => account.id === id);
      if (
        !target ||
        target.companyId !== activeCompanyId ||
        !["BPO_ADMIN", "BPO_TEAM"].includes(currentUser.role)
      )
        return prev;
      return prev.filter((account) => account.id !== id);
    });
  const updateBankAccount = (
    id: string,
    updates: Partial<Omit<BankAccount, "id" | "companyId">>,
  ) =>
    setBankAccounts((prev) =>
      prev.map((account) =>
        account.id === id &&
        account.companyId === activeCompanyId &&
        ["BPO_ADMIN", "BPO_TEAM"].includes(currentUser.role)
          ? {
              ...account,
              ...updates,
              balance:
                updates.balance === undefined
                  ? account.balance
                  : Number(updates.balance),
            }
          : account,
      ),
    );

  // --- ACCOUNTS PAYABLE ACTIONS ---
  const addAccountPayable = (
    data: Omit<
      AccountPayable,
      "id" | "companyId" | "createdAt" | "updatedAt" | "finalAmount" | "status"
    >,
  ) => {
    if (!hasPermission("accounts-payable.create")) return;

    const id = `ap-${Date.now()}`;
    const finalAmount =
      Number(data.amount) +
      Number(data.interest) +
      Number(data.penalty) -
      Number(data.discount);

    // Check if it requires approval (either explicitly set or if final amount exceeds active company approval limit)
    const limit = activeCompany?.approvalLimit || 5000;
    const needsApproval = data.needsApproval || finalAmount >= limit;
    const status = needsApproval ? "Aguardando aprovação" : "A vencer";

    const newPayable: AccountPayable = {
      ...data,
      id,
      companyId: activeCompanyId,
      amount: Number(data.amount),
      interest: Number(data.interest),
      penalty: Number(data.penalty),
      discount: Number(data.discount),
      finalAmount,
      status,
      needsApproval,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setAccountsPayable((prev) => [...prev, newPayable]);
    createAuditLog(
      "CRIAR_CONTA_PAGAR",
      "AccountPayable",
      id,
      activeCompanyId,
      null,
      newPayable,
    );

    if (needsApproval) {
      // Create an approval request
      const approvalId = `apv-${Date.now()}`;
      const newApproval: Approval = {
        id: approvalId,
        companyId: activeCompanyId,
        type: "PAGAMENTO",
        relatedId: id,
        description: data.description,
        amount: finalAmount,
        dueDate: data.dueDate,
        requesterId: currentUser.id,
        requesterName: currentUser.name,
        dueDateApproval: data.dueDate,
        status: "Pendente",
        attachmentName: data.attachmentName,
        attachmentUrl: data.attachmentUrl,
        createdAt: new Date().toISOString(),
        history: [],
      };
      setApprovals((prev) => [...prev, newApproval]);
      createAuditLog(
        "SOLICITAR_APROVACAO",
        "Approval",
        approvalId,
        activeCompanyId,
        null,
        newApproval,
      );

      addNotification(
        "Solicitação de Aprovação",
        `Novo pagamento de R$ ${finalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} cadastrado para "${data.supplier}" necessita de aprovação.`,
        "ALERT",
      );
    } else {
      addNotification(
        "Conta a Pagar Cadastrada",
        `Nova conta para "${data.supplier}" no valor de R$ ${finalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} cadastrada como Pendente.`,
        "INFO",
      );
    }
  };

  const updateAccountPayable = (
    id: string,
    updates: Partial<AccountPayable>,
  ) => {
    if (!hasPermission("accounts-payable.update")) return;

    setAccountsPayable((prev) => {
      const existing = prev.find((p) => p.id === id);
      if (!existing) return prev;

      // Cannot update if paid
      if (existing.status === "Paga") {
        console.error(
          "Cannot modify paid accounts without special audit overrides.",
        );
        return prev;
      }

      const merged = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      // Recompute final amount
      merged.amount = Number(merged.amount);
      merged.interest = Number(merged.interest);
      merged.penalty = Number(merged.penalty);
      merged.discount = Number(merged.discount);
      merged.finalAmount =
        merged.amount + merged.interest + merged.penalty - merged.discount;

      createAuditLog(
        "ATUALIZAR_CONTA_PAGAR",
        "AccountPayable",
        id,
        existing.companyId,
        existing,
        merged,
      );
      return prev.map((p) => (p.id === id ? merged : p));
    });
  };

  const cancelAccountPayable = (id: string) => {
    if (!hasPermission("accounts-payable.cancel")) return;

    setAccountsPayable((prev) => {
      const existing = prev.find((p) => p.id === id);
      if (!existing) return prev;

      const updated = {
        ...existing,
        status: "Cancelada" as const,
        updatedAt: new Date().toISOString(),
      };
      createAuditLog(
        "CANCELAR_CONTA_PAGAR",
        "AccountPayable",
        id,
        existing.companyId,
        existing,
        updated,
      );

      // Also cancel associated approval if any
      setApprovals((apvs) =>
        apvs.map((a) =>
          a.relatedId === id && a.status === "Pendente"
            ? { ...a, status: "Cancelada" }
            : a,
        ),
      );

      return prev.map((p) => (p.id === id ? updated : p));
    });

    addNotification(
      "Conta a Pagar Cancelada",
      "Um registro financeiro a pagar foi cancelado e auditado.",
      "WARNING",
    );
  };

  const payAccountPayable = (id: string, date: string, receiptUrl?: string) => {
    setAccountsPayable((prev) => {
      const existing = prev.find((p) => p.id === id);
      if (!existing) return prev;

      const updated: AccountPayable = {
        ...existing,
        status: "Paga",
        paymentDate: date,
        paymentReceiptUrl: receiptUrl || "#",
        updatedAt: new Date().toISOString(),
      };

      // Deduct balance of the bank account
      setBankAccounts((accounts) =>
        accounts.map((ba) => {
          if (ba.id === existing.bankAccountId) {
            return { ...ba, balance: ba.balance - existing.finalAmount };
          }
          return ba;
        }),
      );

      createAuditLog(
        "CONFIRMAR_PAGAMENTO",
        "AccountPayable",
        id,
        existing.companyId,
        existing,
        updated,
      );
      return prev.map((p) => (p.id === id ? updated : p));
    });

    addNotification(
      "Pagamento Confirmado",
      `Pagamento de conta registrado e deduzido do saldo.`,
      "SUCCESS",
    );
  };
  const scheduleAccountPayable = (id: string) => {
    setAccountsPayable((prev) =>
      prev.map((item) =>
        item.id === id && !["Paga", "Cancelada"].includes(item.status)
          ? { ...item, status: "Agendada", updatedAt: new Date().toISOString() }
          : item,
      ),
    );
    addNotification(
      "Pagamento Agendado",
      "A obrigação foi marcada como agendada.",
      "INFO",
    );
  };

  // --- ACCOUNTS RECEIVABLE ACTIONS ---
  const addAccountReceivable = (
    data: Omit<
      AccountReceivable,
      | "id"
      | "companyId"
      | "createdAt"
      | "updatedAt"
      | "receivedAmount"
      | "status"
    >,
  ) => {
    if (!hasPermission("accounts-receivable.create")) return;

    const id = `ar-${Date.now()}`;
    const newReceivable: AccountReceivable = {
      ...data,
      id,
      companyId: activeCompanyId,
      amount: Number(data.amount),
      interest: Number(data.interest),
      penalty: Number(data.penalty),
      discount: Number(data.discount),
      receivedAmount: 0,
      status: "A receber",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setAccountsReceivable((prev) => [...prev, newReceivable]);
    createAuditLog(
      "CRIAR_CONTA_RECEBER",
      "AccountReceivable",
      id,
      activeCompanyId,
      null,
      newReceivable,
    );

    addNotification(
      "Conta a Receber Lançada",
      `Faturamento para "${data.customer}" no valor de R$ ${Number(data.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} lançado.`,
      "SUCCESS",
    );
  };

  const updateAccountReceivable = (
    id: string,
    updates: Partial<AccountReceivable>,
  ) => {
    if (!hasPermission("accounts-receivable.update")) return;

    setAccountsReceivable((prev) => {
      const existing = prev.find((r) => r.id === id);
      if (!existing) return prev;

      if (["Recebido", "Recebida"].includes(existing.status)) {
        console.error("Cannot modify received invoice.");
        return prev;
      }

      const merged = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      merged.amount = Number(merged.amount);
      merged.interest = Number(merged.interest);
      merged.penalty = Number(merged.penalty);
      merged.discount = Number(merged.discount);

      createAuditLog(
        "ATUALIZAR_CONTA_RECEBER",
        "AccountReceivable",
        id,
        existing.companyId,
        existing,
        merged,
      );
      return prev.map((r) => (r.id === id ? merged : r));
    });
  };

  const cancelAccountReceivable = (id: string) => {
    if (!hasPermission("accounts-receivable.cancel")) return;

    setAccountsReceivable((prev) => {
      const existing = prev.find((r) => r.id === id);
      if (!existing) return prev;

      const updated = {
        ...existing,
        status: "Cancelado" as const,
        updatedAt: new Date().toISOString(),
      };
      createAuditLog(
        "CANCELAR_CONTA_RECEBER",
        "AccountReceivable",
        id,
        existing.companyId,
        existing,
        updated,
      );
      return prev.map((r) => (r.id === id ? updated : r));
    });

    addNotification(
      "Conta a Receber Cancelada",
      "O faturamento foi cancelado no sistema.",
      "WARNING",
    );
  };

  const receiveAccountReceivable = (
    id: string,
    amount: number,
    date: string,
  ) => {
    setAccountsReceivable((prev) => {
      const existing = prev.find((r) => r.id === id);
      if (!existing) return prev;

      const isFull =
        existing.receivedAmount + amount >=
        existing.amount +
          existing.interest +
          existing.penalty -
          existing.discount;
      const updatedStatus = isFull ? "Recebido" : "Parcialmente recebido";

      const updated: AccountReceivable = {
        ...existing,
        receivedAmount: existing.receivedAmount + amount,
        status: updatedStatus,
        receiptDate: date,
        updatedAt: new Date().toISOString(),
      };

      // Add balance of the bank account
      setBankAccounts((accounts) =>
        accounts.map((ba) => {
          if (ba.id === existing.bankAccountId) {
            return { ...ba, balance: ba.balance + amount };
          }
          return ba;
        }),
      );

      createAuditLog(
        "RECEBER_CONTA_RECEBER",
        "AccountReceivable",
        id,
        existing.companyId,
        existing,
        updated,
      );
      return prev.map((r) => (r.id === id ? updated : r));
    });

    addNotification(
      "Recebimento Confirmado",
      `Recebimento no valor de R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} compensado com sucesso.`,
      "SUCCESS",
    );
  };

  // --- APPROVALS FLOW ---
  const decideApproval = (
    approvalId: string,
    decision: "Aprovada" | "Rejeitada" | "Ajuste solicitado",
    comment: string,
  ) => {
    setApprovals((prev) => {
      const existing = prev.find((a) => a.id === approvalId);
      if (!existing) return prev;
      const canDecide =
        existing.type === "DOCUMENTO"
          ? currentUser.role === "CLIENT"
          : hasPermission("approvals.approve");
      if (!canDecide) return prev;

      const step = {
        id: `step-${Date.now()}`,
        userId: currentUser.id,
        userName: currentUser.name,
        role: currentUser.role,
        decision,
        comment,
        timestamp: new Date().toISOString(),
        ipAddress: "186.20.103.54",
        userAgent: navigator.userAgent,
      };

      const updated: Approval = {
        ...existing,
        status: decision,
        justification: comment,
        history: [...existing.history, step],
      };

      if (existing.type === "DOCUMENTO") {
        setDocuments((items) =>
          items.map((document) =>
            document.id === existing.relatedId
              ? {
                  ...document,
                  status:
                    decision === "Aprovada"
                      ? "Lançado"
                      : decision === "Rejeitada"
                        ? "Cancelado"
                        : "Aguardando Análise",
                }
              : document,
          ),
        );
        if (decision === "Aprovada") launchDocument(existing.relatedId);
      } else {
        setAccountsPayable((payables) =>
          payables.map((ap) => {
            if (ap.id === existing.relatedId) {
              const finalStatus =
                decision === "Aprovada" ? "A vencer" : "Rejeitada";
              return {
                ...ap,
                status: finalStatus,
                updatedAt: new Date().toISOString(),
              };
            }
            return ap;
          }),
        );
      }

      createAuditLog(
        existing.type === "DOCUMENTO"
          ? decision === "Aprovada"
            ? "APROVAR_DOCUMENTO"
            : decision === "Rejeitada"
              ? "REJEITAR_DOCUMENTO"
              : "SOLICITAR_AJUSTE_DOCUMENTO"
          : decision === "Aprovada"
            ? "APROVAR_PAGAMENTO"
            : "REJEITAR_PAGAMENTO",
        existing.type === "DOCUMENTO" ? "Document" : "Approval",
        approvalId,
        existing.companyId,
        existing,
        updated,
      );

      addNotification(
        existing.type === "DOCUMENTO"
          ? decision === "Aprovada"
            ? "Lançamento Aprovado"
            : decision === "Rejeitada"
              ? "Lançamento Rejeitado"
              : "Ajuste Solicitado"
          : decision === "Aprovada"
            ? "Pagamento Aprovado"
            : "Pagamento Rejeitado",
        existing.type === "DOCUMENTO"
          ? `O lançamento "${existing.attachmentName || existing.description}" foi ${decision === "Aprovada" ? "aprovado e lançado" : decision === "Rejeitada" ? "rejeitado e encerrado" : "devolvido ao BPO para ajuste"} por ${currentUser.name}.`
          : `Aprovação "${existing.description}" de R$ ${existing.amount.toLocaleString("pt-BR")} foi ${decision.toLowerCase()} por ${currentUser.name}.`,
        decision === "Aprovada" ? "SUCCESS" : "WARNING",
      );

      return prev.map((a) => (a.id === approvalId ? updated : a));
    });
  };

  // --- DOCUMENTS MANAGEMENT ---
  const uploadDocument = (data: {
    name: string;
    description: string;
    category: Document["category"];
    competenceMonth: string;
    fileSize: string;
    mimeType: string;
    relatedEntityId?: string;
    aiSummary?: string;
    extractedData?: Record<string, string>;
    processingConfidence?: number;
    companyId?: string;
    supplier?: string;
    dueDate?: string;
    expenseType?: string;
    documentNumber?: string;
    amount?: number;
    analysisWarnings?: string[];
    previewUrl?: string;
  }) => {
    if (!hasPermission("documents.upload")) return;

    const id = `doc-${Date.now()}`;
    const targetCompanyId =
      data.companyId &&
      (currentUser.role === "BPO_ADMIN" ||
        currentUser.companies?.includes(data.companyId))
        ? data.companyId
        : activeCompanyId;
    const newDoc: Document = {
      ...data,
      id,
      companyId: targetCompanyId,
      uploadedAt: new Date().toISOString(),
      uploadedById: currentUser.id,
      uploadedByName: currentUser.name,
      hash: Math.random().toString(16).substr(2, 32),
      status: "Aguardando Análise",
      origin: "Documento",
      signedUrl: data.previewUrl,
    };

    setDocuments((prev) => [...prev, newDoc]);
    createAuditLog(
      "UPLOAD_DOCUMENTO",
      "Document",
      id,
      targetCompanyId,
      null,
      newDoc,
    );

    addNotification(
      "Documento Enviado",
      `O arquivo "${data.name}" foi enviado com sucesso para a categoria ${data.category}.`,
      "SUCCESS",
    );
  };

  const deleteDocument = (id: string) => {
    setDocuments((prev) => {
      const existing = prev.find((d) => d.id === id);
      if (!existing) return prev;

      createAuditLog(
        "DELETAR_DOCUMENTO",
        "Document",
        id,
        existing.companyId,
        existing,
        null,
      );
      return prev.filter((d) => d.id !== id);
    });

    addNotification(
      "Documento Removido",
      "Um documento foi excluído do repositório da empresa.",
      "INFO",
    );
  };

  // --- BANK RECONCILIATION ---
  const importStatement = (bankAccountId: string) => {
    if (!hasPermission("reconciliation.execute")) return;

    // Simulate file import by copying items from BANK_STATEMENTS_TO_IMPORT if not already present
    const sourceItems = BANK_STATEMENTS_TO_IMPORT[bankAccountId] || [];

    setStatementItems((prev) => {
      const current = prev[bankAccountId] || [];
      const nonDuplicate = sourceItems.filter(
        (s) => !current.some((c) => c.id === s.id),
      );

      const updated = [...current, ...nonDuplicate];
      createAuditLog(
        "IMPORTAR_EXTRATO",
        "BankAccount",
        bankAccountId,
        activeCompanyId,
        null,
        { importedCount: nonDuplicate.length },
      );
      return { ...prev, [bankAccountId]: updated };
    });

    addNotification(
      "Extrato Importado",
      "O extrato bancário (OFX) foi importado e está pronto para conciliação.",
      "SUCCESS",
    );
  };

  const reconcileItemManually = (
    bankAccountId: string,
    statementItemId: string,
    financialRecordId: string,
    type: "A_PAGAR" | "A_RECEBER",
    notes: string,
  ) => {
    if (!hasPermission("reconciliation.execute")) return;

    // Update statement item status
    setStatementItems((prev) => {
      const items = prev[bankAccountId] || [];
      const updated = items.map((item) => {
        if (item.id === statementItemId) {
          return {
            ...item,
            isReconciled: true,
            reconciliationStatus: "Conciliada" as const,
            matchedTransactionId: financialRecordId,
          };
        }
        return item;
      });
      return { ...prev, [bankAccountId]: updated };
    });

    // Update financial record and change status to PAID / RECEIVED
    const today = new Date().toISOString().split("T")[0];
    if (type === "A_PAGAR") {
      const record = accountsPayable.find((ap) => ap.id === financialRecordId);
      if (record && record.status !== "Paga") {
        payAccountPayable(financialRecordId, today);
      }
    } else {
      const record = accountsReceivable.find(
        (ar) => ar.id === financialRecordId,
      );
      if (record && !["Recebido", "Recebida"].includes(record.status)) {
        receiveAccountReceivable(
          financialRecordId,
          record.amount - record.receivedAmount,
          today,
        );
      }
    }

    createAuditLog(
      "CONCILIACAO_MANUAL",
      "StatementItem",
      statementItemId,
      activeCompanyId,
      null,
      { financialRecordId, type, notes },
    );
    addNotification(
      "Conciliação Concluída",
      "Transação e lançamento bancário associados com sucesso.",
      "SUCCESS",
    );
  };

  const autoReconcileBank = (bankAccountId: string) => {
    if (!hasPermission("reconciliation.execute")) return;

    const items = statementItems[bankAccountId] || [];
    let matchedCount = 0;

    const updatedItems = items.map((item) => {
      if (item.isReconciled) return item;

      // Try matching accounts payable (negative statement amount)
      if (item.amount < 0) {
        const absoluteAmount = Math.abs(item.amount);
        const match = accountsPayable.find(
          (ap) =>
            ap.bankAccountId === bankAccountId &&
            Math.abs(ap.finalAmount - absoluteAmount) < 0.01 &&
            ap.status !== "Paga",
        );

        if (match) {
          matchedCount++;
          // Immediately pay
          const today = new Date().toISOString().split("T")[0];
          setTimeout(() => payAccountPayable(match.id, today), 0);
          return {
            ...item,
            isReconciled: true,
            reconciliationStatus: "Conciliada" as const,
            matchedTransactionId: match.id,
          };
        }
      } else {
        // Try matching accounts receivable (positive statement amount)
        const match = accountsReceivable.find(
          (ar) =>
            ar.bankAccountId === bankAccountId &&
            Math.abs(ar.amount - ar.receivedAmount - item.amount) < 0.01 &&
            !["Recebido", "Recebida"].includes(ar.status),
        );

        if (match) {
          matchedCount++;
          const today = new Date().toISOString().split("T")[0];
          setTimeout(
            () =>
              receiveAccountReceivable(
                match.id,
                match.amount - match.receivedAmount,
                today,
              ),
            0,
          );
          return {
            ...item,
            isReconciled: true,
            reconciliationStatus: "Conciliada" as const,
            matchedTransactionId: match.id,
          };
        }
      }

      return item;
    });

    setStatementItems((prev) => ({ ...prev, [bankAccountId]: updatedItems }));
    createAuditLog(
      "AUTO_CONCILIACAO",
      "BankAccount",
      bankAccountId,
      activeCompanyId,
      null,
      { matchedCount },
    );
    addNotification(
      "Conciliação Automática",
      `O sistema analisou os lançamentos e conciliou ${matchedCount} itens de forma inteligente.`,
      "SUCCESS",
    );
  };

  const ignoreStatementItem = (
    bankAccountId: string,
    statementItemId: string,
    reason: string,
  ) => {
    setStatementItems((prev) => {
      const items = prev[bankAccountId] || [];
      const updated = items.map((item) => {
        if (item.id === statementItemId) {
          return {
            ...item,
            isReconciled: true,
            reconciliationStatus: "Ignorada" as const,
          };
        }
        return item;
      });
      return { ...prev, [bankAccountId]: updated };
    });

    createAuditLog(
      "IGNORAR_ITEM_EXTRATO",
      "StatementItem",
      statementItemId,
      activeCompanyId,
      null,
      { reason },
    );
    addNotification(
      "Item de Extrato Ignorado",
      "Lançamento bancário marcado como ignorado na conciliação.",
      "INFO",
    );
  };

  // --- REPORT GENERATION ---
  const generateReport = (name: string, type: string, filters: string) => {
    if (!hasPermission("reports.generate")) return;

    const id = `rep-${Date.now()}`;
    const newReport: ReportRecord = {
      id,
      companyId: activeCompanyId,
      name,
      type,
      filters,
      generatedAt: new Date().toISOString(),
      generatedById: currentUser.id,
      generatedByName: currentUser.name,
      fileUrl: `https://bpo-reports.com/${activeCompanyId}/${id}.pdf`,
      fileSize: `${Math.floor(Math.random() * 400) + 100} KB`,
    };

    setReports((prev) => [newReport, ...prev]);
    createAuditLog(
      "GERAR_RELATORIO",
      "Report",
      id,
      activeCompanyId,
      null,
      newReport,
    );
    addNotification(
      "Relatório Pronto",
      `O relatório "${name}" foi compilado e está pronto para visualização.`,
      "SUCCESS",
    );
  };

  // --- ADMINISTRATION: COMPANIES & CLIENTS ---
  const addCompany = (data: Omit<Company, "id" | "createdAt" | "status">) => {
    if (currentUser.role !== "BPO_ADMIN") return;

    const id = `c-${Date.now()}`;
    const newCompany: Company = {
      ...data,
      id,
      status: "Implantação",
      createdAt: new Date().toISOString(),
    };

    setCompanies((prev) => [...prev, newCompany]);

    // Auto add default bank account for new company
    const newBank: BankAccount = {
      id: `ba-${id}-itau`,
      companyId: id,
      bankName: "Banco Itaú S.A.",
      agency: "0001",
      accountNumber: "10001-1",
      type: "Corrente",
      balance: 0,
    };
    setBankAccounts((prev) => [...prev, newBank]);

    createAuditLog("CRIAR_EMPRESA", "Company", id, id, null, newCompany);
    addNotification(
      "Nova Empresa Cadastrada",
      `A empresa "${data.tradeName}" foi integrada em modo de implantação.`,
      "SUCCESS",
    );
  };

  const updateCompanyStatus = (id: string, status: Company["status"]) => {
    if (currentUser.role !== "BPO_ADMIN") return;

    setCompanies((prev) => {
      const existing = prev.find((c) => c.id === id);
      if (!existing) return prev;

      const updated = { ...existing, status };
      createAuditLog(
        "ALTERAR_STATUS_EMPRESA",
        "Company",
        id,
        id,
        existing,
        updated,
      );
      return prev.map((c) => (c.id === id ? updated : c));
    });

    addNotification(
      "Status de Empresa Atualizado",
      `A empresa mudou seu status operacional para ${status}.`,
      "INFO",
    );
  };
  const updateCompany = (
    id: string,
    updates: Partial<Omit<Company, "id" | "createdAt" | "tenantId">>,
  ) => {
    if (currentUser.role !== "BPO_ADMIN") return;
    setCompanies((prev) =>
      prev.map((company) => {
        if (company.id !== id) return company;
        const updated = {
          ...company,
          ...updates,
          approvalLimit:
            updates.approvalLimit === undefined
              ? company.approvalLimit
              : Number(updates.approvalLimit),
        };
        createAuditLog(
          "ATUALIZAR_EMPRESA_CLIENTE",
          "Company",
          id,
          id,
          company,
          updated,
        );
        return updated;
      }),
    );
  };

  // --- TEAM MANAGEMENT ---
  const addTeamMember = (data: Omit<User, "id">) => {
    if (currentUser.role !== "BPO_ADMIN") return;

    const id = `u-${Date.now()}`;
    const newUser: User = {
      ...data,
      id,
    };

    setUsers((prev) => [...prev, newUser]);
    createAuditLog(
      "CONVIDAR_COLABORADOR",
      "User",
      id,
      undefined,
      null,
      newUser,
    );
    addNotification(
      "Membro de Equipe Convidado",
      `O convite foi enviado para o email: ${data.email}.`,
      "SUCCESS",
    );
  };

  const updateTeamMemberPermissions = (
    id: string,
    permissions: string[],
    status?: "ACTIVE" | "INACTIVE",
    assignedCompanies?: string[],
  ) => {
    if (currentUser.role !== "BPO_ADMIN") return;

    setUsers((prev) => {
      const existing = prev.find((u) => u.id === id);
      if (!existing) return prev;

      const updated = {
        ...existing,
        permissions,
        status: status || existing.status,
        companies: assignedCompanies ?? existing.companies,
      };

      createAuditLog(
        "ALTERAR_PERMISSOES_USUARIO",
        "User",
        id,
        undefined,
        existing,
        updated,
      );
      return prev.map((u) => (u.id === id ? updated : u));
    });

    addNotification(
      "Permissões Atualizadas",
      "As permissões de RBAC foram salvas no perfil do colaborador.",
      "SUCCESS",
    );
  };

  const updateDocument = (id: string, updates: Partial<Document>) => {
    setDocuments((prev) =>
      prev.map((document) => {
        if (document.id !== id) return document;
        const updated = { ...document, ...updates };
        createAuditLog(
          "AJUSTAR_PRE_LANCAMENTO",
          "Document",
          id,
          document.companyId,
          document,
          updated,
        );
        return updated;
      }),
    );
  };

  const createPayableFromDocument = (
    documentId: string,
    updates: Partial<Document> = {},
  ) => {
    const currentDocument = documents.find((item) => item.id === documentId);
    const document = currentDocument
      ? { ...currentDocument, ...updates }
      : Object.keys(updates).length
        ? (updates as Document)
        : undefined;
    if (!document || document.relatedEntityId) return;
    const payableId = `ap-doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const payable: AccountPayable = {
      id: payableId,
      companyId: document.companyId,
      description: document.description || document.aiSummary || document.name,
      supplier: document.supplier || "Fornecedor a confirmar",
      category: document.expenseType || document.category,
      costCenter: document.costCenter || "A classificar",
      competenceMonth: document.competenceMonth,
      issueDate: document.uploadedAt.slice(0, 10),
      dueDate: document.dueDate || document.uploadedAt.slice(0, 10),
      amount: document.amount || 0,
      interest: 0,
      penalty: 0,
      discount: 0,
      finalAmount: document.amount || 0,
      paymentMethod: document.paymentMethod || "A definir",
      bankAccountId: document.bankAccountId || "",
      recurrence: document.recurrence || "Nenhuma",
      documentNumber: document.documentNumber || "",
      notes:
        document.notes || "Lançamento originado pela Central de Documentos.",
      attachmentUrl: document.signedUrl,
      attachmentName: document.name,
      status: "A vencer",
      responsibleId: currentUser.id,
      needsApproval: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setAccountsPayable((prev) => [...prev, payable]);
    setDocuments((prev) =>
      prev.map((item) =>
        item.id === documentId
          ? {
              ...item,
              ...updates,
              status: "Lançado",
              relatedEntityId: payableId,
              launchedById: currentUser.id,
              launchedByName: currentUser.name,
              launchedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
    createAuditLog(
      "LANCAR_DOCUMENTO_FINANCEIRO",
      "AccountPayable",
      payableId,
      document.companyId,
      null,
      payable,
    );
  };

  const launchDocument = (id: string, updates: Partial<Document> = {}) => {
    const current = documents.find((item) => item.id === id);
    if (!current) return;
    const document = { ...current, ...updates };
    if (document.entryType === "Transferência") {
      if (
        !document.bankAccountId ||
        !document.destinationBankAccountId ||
        document.bankAccountId === document.destinationBankAccountId
      )
        return;
      setBankAccounts((prev) =>
        prev.map((account) =>
          account.id === document.bankAccountId
            ? { ...account, balance: account.balance - (document.amount || 0) }
            : account.id === document.destinationBankAccountId
              ? {
                  ...account,
                  balance: account.balance + (document.amount || 0),
                }
              : account,
        ),
      );
      setDocuments((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                ...updates,
                status: "Lançado",
                launchedById: currentUser.id,
                launchedByName: currentUser.name,
                launchedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      createAuditLog(
        "TRANSFERENCIA_ENTRE_CONTAS",
        "BankTransfer",
        id,
        document.companyId,
        null,
        document,
      );
      return;
    }
    if (document.entryType === "Conta a Receber") {
      const receivableId = `ar-doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const now = new Date().toISOString();
      const receivable: AccountReceivable = {
        id: receivableId,
        companyId: document.companyId,
        description: document.description,
        customer: document.supplier || "Cliente a confirmar",
        category: document.expenseType || document.category,
        costCenter: document.costCenter || "A classificar",
        competenceMonth: document.competenceMonth,
        issueDate: now.slice(0, 10),
        dueDate: document.dueDate || now.slice(0, 10),
        amount: document.amount || 0,
        interest: 0,
        penalty: 0,
        discount: 0,
        receivedAmount: 0,
        paymentMethod: document.paymentMethod || "A definir",
        bankAccountId: document.bankAccountId || "",
        recurrence: document.recurrence || "Nenhuma",
        documentNumber: document.documentNumber || "",
        notes:
          document.notes || "Lançamento originado pela Central de Documentos.",
        status: "A receber",
        responsibleId: currentUser.id,
        createdAt: now,
        updatedAt: now,
      };
      setAccountsReceivable((prev) => [...prev, receivable]);
      setDocuments((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                ...updates,
                status: "Lançado",
                relatedEntityId: receivableId,
                launchedById: currentUser.id,
                launchedByName: currentUser.name,
                launchedAt: now,
              }
            : item,
        ),
      );
      createAuditLog(
        "LANCAR_DOCUMENTO_RECEBER",
        "AccountReceivable",
        receivableId,
        document.companyId,
        null,
        receivable,
      );
      return;
    }
    createPayableFromDocument(id, updates);
  };

  const submitDocumentForApproval = (
    id: string,
    updates: Partial<Document> = {},
  ) => {
    const currentDocument = documents.find((item) => item.id === id);
    const document = currentDocument
      ? { ...currentDocument, ...updates }
      : undefined;
    if (!document || document.status !== "Aguardando Análise") return;
    const approval: Approval = {
      id: `apv-doc-${Date.now()}`,
      companyId: document.companyId,
      type: "DOCUMENTO",
      relatedId: document.id,
      description: document.description || document.aiSummary || document.name,
      amount: document.amount || 0,
      dueDate: document.dueDate || new Date().toISOString().slice(0, 10),
      requesterId: currentUser.id,
      requesterName: currentUser.name,
      dueDateApproval:
        document.dueDate || new Date().toISOString().slice(0, 10),
      status: "Pendente",
      attachmentUrl: document.signedUrl,
      attachmentName: document.name,
      createdAt: new Date().toISOString(),
      history: [],
    };
    setApprovals((prev) => [...prev, approval]);
    setDocuments((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "Aguardando Aprovação" } : item,
      ),
    );
    createAuditLog(
      "ENVIAR_DOCUMENTO_APROVACAO",
      "Approval",
      approval.id,
      document.companyId,
      null,
      approval,
    );
    addNotification(
      "Lançamento para Aprovação",
      `O pré-lançamento de "${document.name}" foi enviado ao cliente.`,
      "ALERT",
    );
  };

  const cancelDocument = (id: string) => {
    setDocuments((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "Cancelado" } : item,
      ),
    );
    setApprovals((prev) =>
      prev.map((item) =>
        item.relatedId === id && item.status === "Pendente"
          ? { ...item, status: "Cancelada" }
          : item,
      ),
    );
    createAuditLog("CANCELAR_PRE_LANCAMENTO", "Document", id);
  };

  const createStandaloneLaunch = (
    data: Partial<Document> &
      Pick<Document, "description" | "supplier" | "dueDate" | "amount">,
  ) => {
    if (!["BPO_ADMIN", "BPO_TEAM"].includes(currentUser.role)) return;
    const now = new Date().toISOString();
    const documentId = `doc-manual-${Date.now()}`;
    const document: Document = {
      id: documentId,
      companyId: activeCompanyId,
      category: data.category || "Outros",
      name: data.name || `Lançamento avulso - ${data.supplier}`,
      description: data.description,
      competenceMonth: data.competenceMonth || now.slice(0, 7),
      uploadedAt: now,
      uploadedById: currentUser.id,
      uploadedByName: currentUser.name,
      fileSize: "Sem anexo",
      mimeType: "application/x-manual-entry",
      hash: Math.random().toString(16).slice(2),
      status: "Lançado",
      supplier: data.supplier,
      dueDate: data.dueDate,
      amount: Number(data.amount),
      documentNumber: data.documentNumber,
      expenseType: data.expenseType,
      entryType: data.entryType || "Conta a Pagar",
      costCenter: data.costCenter,
      bankAccountId: data.bankAccountId,
      paymentMethod: data.paymentMethod,
      recurrence: data.recurrence || "Nenhuma",
      notes: data.notes,
      origin: "Manual",
      launchedById: currentUser.id,
      launchedByName: currentUser.name,
      launchedAt: now,
    };
    setDocuments((prev) => [...prev, document]);
    if (document.entryType === "Conta a Receber") {
      const receivableId = `ar-manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const receivable: AccountReceivable = {
        id: receivableId,
        companyId: activeCompanyId,
        description: document.description,
        customer: document.supplier || "Cliente a confirmar",
        category: document.expenseType || document.category,
        costCenter: document.costCenter || "A classificar",
        competenceMonth: document.competenceMonth,
        issueDate: now.slice(0, 10),
        dueDate: document.dueDate || now.slice(0, 10),
        amount: document.amount || 0,
        interest: 0,
        penalty: 0,
        discount: 0,
        receivedAmount: 0,
        paymentMethod: document.paymentMethod || "A definir",
        bankAccountId: document.bankAccountId || "",
        recurrence: document.recurrence || "Nenhuma",
        documentNumber: document.documentNumber || "",
        notes: document.notes || "Lançamento avulso.",
        status: "A receber",
        responsibleId: currentUser.id,
        createdAt: now,
        updatedAt: now,
      };
      setAccountsReceivable((prev) => [...prev, receivable]);
      setDocuments((prev) =>
        prev.map((item) =>
          item.id === documentId
            ? { ...item, relatedEntityId: receivableId }
            : item,
        ),
      );
      createAuditLog(
        "CRIAR_CONTA_RECEBER_AVULSA",
        "AccountReceivable",
        receivableId,
        activeCompanyId,
        null,
        receivable,
      );
    } else if (document.entryType === "Transferência") {
      if (
        !document.bankAccountId ||
        !document.destinationBankAccountId ||
        document.bankAccountId === document.destinationBankAccountId
      )
        return;
      setBankAccounts((prev) =>
        prev.map((account) =>
          account.id === document.bankAccountId
            ? { ...account, balance: account.balance - (document.amount || 0) }
            : account.id === document.destinationBankAccountId
              ? {
                  ...account,
                  balance: account.balance + (document.amount || 0),
                }
              : account,
        ),
      );
      createAuditLog(
        "TRANSFERENCIA_ENTRE_CONTAS",
        "BankTransfer",
        documentId,
        activeCompanyId,
        null,
        document,
      );
    } else {
      createPayableFromDocument(documentId, document);
    }
    createAuditLog(
      "CRIAR_LANCAMENTO_AVULSO",
      "Document",
      documentId,
      activeCompanyId,
      null,
      document,
    );
    addNotification(
      "Lançamento Avulso Criado",
      `O lançamento de "${data.supplier}" entrou diretamente no financeiro.`,
      "SUCCESS",
    );
  };

  // --- SUPPORT REQUESTS / BPO SERVICE DESK ---
  const createSupportTicket = (
    data: Pick<
      SupportTicket,
      "category" | "subject" | "description" | "priority"
    >,
  ): string => {
    if (!["CLIENT", "ACCOUNTANT"].includes(currentUser.role) || !activeCompany)
      return "";

    const now = new Date();
    const id = `ticket-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const protocol = `REQ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(Date.now()).slice(-6)}`;
    const ticket: SupportTicket = {
      ...data,
      id,
      protocol,
      companyId: activeCompany.id,
      requesterId: currentUser.id,
      requesterName: currentUser.name,
      requesterRole: currentUser.role,
      status: "ABERTO",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      messages: [],
    };

    setSupportTickets((previous) => [ticket, ...previous]);
    createAuditLog(
      "ABRIR_REQUERIMENTO_BPO",
      "SupportTicket",
      id,
      activeCompany.id,
      null,
      ticket,
    );
    addNotification(
      "Novo requerimento ao BPO",
      `${protocol} — ${data.subject}`,
      "INFO",
    );
    return id;
  };

  const addSupportMessage = (
    ticketId: string,
    content: string,
    attachments: SupportAttachment[] = [],
  ) => {
    const message = content.trim();
    if (!message && attachments.length === 0) return;

    setSupportTickets((previous) =>
      previous.map((ticket) => {
        const isAuthorized =
          currentUser.role === "BPO_ADMIN" ||
          ticket.requesterId === currentUser.id;
        if (ticket.id !== ticketId || !isAuthorized) return ticket;

        const updated: SupportTicket = {
          ...ticket,
          status:
            currentUser.role === "BPO_ADMIN" && ticket.status === "ABERTO"
              ? "EM_ATENDIMENTO"
              : ticket.status,
          updatedAt: new Date().toISOString(),
          messages: [
            ...ticket.messages,
            {
              id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              authorId: currentUser.id,
              authorName: currentUser.name,
              authorRole: currentUser.role,
              content: message,
              attachments,
              createdAt: new Date().toISOString(),
            },
          ],
        };
        createAuditLog(
          "RESPONDER_REQUERIMENTO_BPO",
          "SupportTicket",
          ticketId,
          ticket.companyId,
          undefined,
          { message },
        );
        return updated;
      }),
    );
  };

  const updateSupportTicket = (
    ticketId: string,
    updates: {
      status?: SupportTicketStatus;
      priority?: SupportTicketPriority;
      assignedToId?: string;
    },
  ) => {
    if (currentUser.role !== "BPO_ADMIN") return;

    setSupportTickets((previous) =>
      previous.map((ticket) => {
        if (ticket.id !== ticketId) return ticket;
        const assignee = updates.assignedToId
          ? users.find(
              (user) =>
                user.id === updates.assignedToId &&
                ["BPO_ADMIN", "BPO_TEAM"].includes(user.role),
            )
          : undefined;
        const updated: SupportTicket = {
          ...ticket,
          ...updates,
          assignedToId: assignee?.id,
          assignedToName: assignee?.name,
          updatedAt: new Date().toISOString(),
        };
        createAuditLog(
          "ATUALIZAR_REQUERIMENTO_BPO",
          "SupportTicket",
          ticketId,
          ticket.companyId,
          ticket,
          updated,
        );
        return updated;
      }),
    );
  };

  return (
    <BPOContext.Provider
      value={{
        tenants,
        companies,
        users,
        bankAccounts,
        masterData,
        accountsPayable,
        accountsReceivable,
        approvals,
        documents,
        auditLogs,
        notifications,
        reports,
        statementItems,
        supportTickets,
        isUserOnline,
        currentUser,
        activeCompany,
        activeTenant,
        isAuthenticated,
        login,
        logout,
        switchCompany,
        hasPermission,
        addMasterData,
        updateMasterData,
        deleteMasterData,
        addBankAccount,
        updateBankAccount,
        deleteBankAccount,
        addAccountPayable,
        updateAccountPayable,
        cancelAccountPayable,
        payAccountPayable,
        scheduleAccountPayable,
        addAccountReceivable,
        updateAccountReceivable,
        cancelAccountReceivable,
        receiveAccountReceivable,
        decideApproval,
        uploadDocument,
        deleteDocument,
        updateDocument,
        launchDocument,
        submitDocumentForApproval,
        cancelDocument,
        createStandaloneLaunch,
        importStatement,
        reconcileItemManually,
        autoReconcileBank,
        ignoreStatementItem,
        generateReport,
        addCompany,
        updateCompany,
        updateCompanyStatus,
        addTeamMember,
        updateTeamMemberPermissions,
        addNotification,
        markNotificationRead,
        clearNotifications,
        createSupportTicket,
        addSupportMessage,
        updateSupportTicket,
      }}
    >
      {children}
    </BPOContext.Provider>
  );
}

export function useBPOState() {
  const context = useContext(BPOContext);
  if (context === undefined) {
    throw new Error("useBPOState must be used within a BPOProvider");
  }
  return context;
}
