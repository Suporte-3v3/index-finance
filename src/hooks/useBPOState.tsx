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
  AccountPayablePayment,
  AccountReceivable,
  Approval,
  Document,
  AuditLog,
  Notification,
  ReportRecord,
  ReportGenerationOptions,
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
import {
  createReportArtifact,
  ReportCell,
  ReportTableData,
} from "../services/reportFiles";
import { getDocumentsVisibleToUser } from "../services/documentVisibility";

const PRIMARY_USER_ID = "u-client-admin";
const USER_STORAGE_VERSION = "professional-users-v2";
const LEGACY_DEMO_USER_IDS = new Set([
  "u-bpo-admin",
  "u-bpo-analyst",
  "u-client-sabor",
  "u-accountant",
]);

// Soma meses a uma data "YYYY-MM-DD" preservando o dia quando possível
// (ex.: 31/01 + 1 mês -> 28 ou 29/02, nunca estoura para março).
const addMonthsToDateString = (dateStr: string, months: number): string => {
  const date = new Date(`${dateStr}T00:00:00`);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDayOfMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();
  date.setDate(Math.min(day, lastDayOfMonth));
  return date.toISOString().slice(0, 10);
};

interface InstallmentSlice {
  amount: number;
  dueDate: string;
  competenceMonth: string;
  descriptionSuffix: string;
  installmentGroupId?: string;
  installmentNumber?: number;
  installmentCount?: number;
}

// Divide um valor total em N parcelas mensais a partir do vencimento
// informado. Usa centavos para não perder/sobrar dinheiro por arredondamento
// — o resto (se houver) fica nas primeiras parcelas. Quando a recorrência
// não é "Parcelada" (ou não há quantidade válida), devolve uma única fatia
// idêntica ao valor total, sem nenhum metadado de parcelamento.
const buildInstallmentSlices = (
  totalAmount: number,
  dueDate: string,
  competenceMonth: string,
  recurrence: string,
  installmentCountInput?: number,
): InstallmentSlice[] => {
  const isPlan = recurrence === "Parcelada" && Number(installmentCountInput) > 1;
  const count = isPlan ? Math.floor(Number(installmentCountInput)) : 1;
  if (!isPlan) {
    return [
      {
        amount: totalAmount,
        dueDate,
        competenceMonth,
        descriptionSuffix: "",
      },
    ];
  }

  const groupId = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents - baseCents * count;

  return Array.from({ length: count }, (_, index) => {
    const sliceDueDate = addMonthsToDateString(dueDate, index);
    return {
      amount: (baseCents + (index < remainderCents ? 1 : 0)) / 100,
      dueDate: sliceDueDate,
      competenceMonth: sliceDueDate.slice(0, 7),
      descriptionSuffix: ` (Parcela ${index + 1}/${count})`,
      installmentGroupId: groupId,
      installmentNumber: index + 1,
      installmentCount: count,
    };
  });
};

const createDocumentApproval = (
  document: Document,
  requesterRole?: UserRole,
): Approval => {
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
    requesterRole,
    recipientId: document.recipientId,
    recipientName: document.recipientName,
    recipientRole: document.recipientRole,
    dueDateApproval: approvalDeadline.toISOString(),
    status: "Pendente",
    attachmentName: document.name,
    attachmentUrl: document.signedUrl,
    createdAt: document.uploadedAt,
    history: [],
  };
};

const DEFAULT_COMPANY_MASTER_DATA: Partial<
  Record<MasterDataType, string[]>
> = {
  CATEGORY: ["Aluguel", "Energia", "Marketing", "Fornecedores"],
  COST_CENTER: ["Administrativo", "Comercial", "Operacional"],
  PAYMENT_METHOD: ["PIX", "Transferência", "Boleto", "Débito automático"],
  DOCUMENT_TYPE: [
    "Nota fiscal",
    "Boleto",
    "Comprovante",
    "Recibo",
    "Contrato",
    "Extrato",
    "Outros",
  ],
  SUPPLIER: [],
  CUSTOMER: [],
};

const createCompanyMasterData = (
  companyId: string,
  values: Partial<Record<MasterDataType, string[]>> =
    DEFAULT_COMPANY_MASTER_DATA,
): MasterDataOption[] => {
  const createdAt = new Date().toISOString();
  const types = Object.keys(values) as MasterDataType[];

  return types.flatMap((type) => {
    const uniqueNames = Array.from(
      new Map(
        (values[type] || [])
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => [name.toLocaleLowerCase("pt-BR"), name]),
      ).values(),
    );

    return uniqueNames.map((name, index) => ({
      id: `md-${companyId}-${type.toLowerCase()}-${index}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      companyId,
      type,
      name,
      active: true,
      createdAt,
    }));
  });
};

export interface CompanyOnboardingData {
  initialBankAccount: Omit<BankAccount, "id" | "companyId">;
  masterData: Partial<Record<MasterDataType, string[]>>;
}

export interface CompanyCreationResult {
  success: boolean;
  error?: string;
}

export interface ReconciliationResult {
  success: boolean;
  error?: string;
  partial?: boolean;
}

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
  isApprovalVisibleToCurrentUser: (approval: Approval) => boolean;
  canDecideApproval: (approval: Approval) => boolean;
  addMasterData: (
    type: MasterDataType,
    name: string,
    parentId?: string,
  ) => MasterDataOption | undefined;
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
  ensureBolsaAccount: (companyId: string) => void;
  applyBakeryBankMovement: (
    bankAccountId: string,
    delta: number,
    meta: { action: string; entityType: string; entityId: string },
  ) => void;

  // Actions
  addAccountPayable: (
    data: Omit<
      AccountPayable,
      | "id"
      | "companyId"
      | "createdAt"
      | "updatedAt"
      | "finalAmount"
      | "status"
      | "installmentGroupId"
      | "installmentNumber"
    >,
  ) => void;
  updateAccountPayable: (
    id: string,
    updates: Partial<AccountPayable>,
  ) => { success: boolean; error?: string };
  cancelAccountPayable: (id: string) => { success: boolean; error?: string };
  payAccountPayable: (data: {
    id: string;
    date: string;
    bankAccountId: string;
    amount: number;
    interest?: number;
    penalty?: number;
    discount?: number;
    notes?: string;
    receiptUrl?: string;
  }) => { success: boolean; error?: string };
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
      | "installmentGroupId"
      | "installmentNumber"
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
    recipientId?: string;
    approvalRecipientId?: string;
  }) => void;
  deleteDocument: (id: string) => void;
  updateDocument: (id: string, updates: Partial<Document>) => boolean;
  launchDocument: (id: string, updates?: Partial<Document>) => void;
  submitDocumentForApproval: (
    id: string,
    updates?: Partial<Document>,
    recipientId?: string,
  ) => boolean;
  cancelDocument: (id: string) => boolean;
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
  ) => ReconciliationResult;
  autoReconcileBank: (bankAccountId: string) => void;
  ignoreStatementItem: (
    bankAccountId: string,
    statementItemId: string,
    reason: string,
  ) => void;

  generateReport: (
    name: string,
    type: string,
    filters: string,
    options?: ReportGenerationOptions,
  ) => ReportRecord | null;

  addCompany: (
    data: Omit<Company, "id" | "createdAt" | "status">,
    onboarding: CompanyOnboardingData,
  ) => CompanyCreationResult;
  updateCompany: (
    id: string,
    updates: Partial<Omit<Company, "id" | "createdAt" | "tenantId">>,
  ) => CompanyCreationResult;
  deleteCompany: (id: string) => CompanyCreationResult;
  updateCompanyStatus: (id: string, status: Company["status"]) => void;

  addTeamMember: (data: Omit<User, "id">) => void;
  updateTeamMemberPermissions: (
    id: string,
    permissions: string[],
    status?: "ACTIVE" | "INACTIVE",
    companies?: string[],
    clientOperator?: boolean,
  ) => void;
  updateTeamMember: (
    id: string,
    updates: {
      name?: string;
      email?: string;
      title?: string;
      role?: UserRole;
      password?: string;
    },
  ) => { success: boolean; error?: string };
  deleteTeamMember: (id: string) => { success: boolean; error?: string };

  addNotification: (
    title: string,
    message: string,
    type: Notification["type"],
    userId?: string,
    companyId?: string,
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
  deleteSupportTicket: (ticketId: string) => boolean;
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
      companies.flatMap((company) => createCompanyMasterData(company.id)),
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
    loadState<Document[]>("documents", INITIAL_DOCUMENTS).map((document) => {
      const normalizedStatus =
        (
          {
            Pendente: "Aguardando Análise",
            Validado: "Lançado",
            Rejeitado: "Cancelado",
            Arquivado: "Cancelado",
          } as Record<string, Document["status"]>
        )[document.status] || document.status;
      const previousDirectApproval = approvals.find(
        (approval) =>
          approval.type === "DOCUMENTO" &&
          approval.relatedId === document.id &&
          approval.recipientId === document.recipientId &&
          document.purpose !== "PROCESSING" &&
          ((approval.id === `apv-doc-${document.id}` &&
            approval.requesterId === document.uploadedById) ||
            approval.recipientRole === "ACCOUNTANT"),
      );
      const bpoDeliveryApproval = approvals.find((approval) => {
        const requesterRole =
          approval.requesterRole ||
          users.find((user) => user.id === approval.requesterId)?.role;
        return (
          approval.type === "DOCUMENTO" &&
          approval.relatedId === document.id &&
          approval.recipientId === document.recipientId &&
          ["BPO_ADMIN", "BPO_TEAM"].includes(requesterRole || "")
        );
      });
      const bpoDeliveryRequesterRole =
        bpoDeliveryApproval?.requesterRole ||
        users.find((user) => user.id === bpoDeliveryApproval?.requesterId)?.role;
      const wasDirectApprovalFromPreviousRule = Boolean(previousDirectApproval);
      return {
        ...document,
        status: wasDirectApprovalFromPreviousRule
          ? "Compartilhado"
          : normalizedStatus,
        purpose:
          document.purpose ||
          (wasDirectApprovalFromPreviousRule ? "VIEW_ONLY" : "PROCESSING"),
        sharedById:
          document.sharedById ||
          bpoDeliveryApproval?.requesterId ||
          (wasDirectApprovalFromPreviousRule
            ? previousDirectApproval?.requesterId
            : undefined),
        sharedByName:
          document.sharedByName ||
          bpoDeliveryApproval?.requesterName ||
          (wasDirectApprovalFromPreviousRule
            ? previousDirectApproval?.requesterName
            : undefined),
        sharedByRole:
          document.sharedByRole ||
          (bpoDeliveryApproval
            ? (bpoDeliveryRequesterRole as Document["sharedByRole"])
            : wasDirectApprovalFromPreviousRule
            ? (previousDirectApproval?.requesterRole as Document["sharedByRole"])
            : undefined),
        sharedAt:
          document.sharedAt ||
          (bpoDeliveryApproval
            ? bpoDeliveryApproval.createdAt
            : wasDirectApprovalFromPreviousRule
            ? previousDirectApproval?.createdAt
            : undefined),
        signedUrl: document.signedUrl?.includes("bpo-storage.com")
          ? undefined
          : document.signedUrl,
      };
    }),
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
    const viewOnlyDocumentIds = new Set(
      documents
        .filter((document) => document.purpose === "VIEW_ONLY")
        .map((document) => document.id),
    );
    setApprovals((current) => {
      const cleaned = current.filter(
        (approval) =>
          !(
            viewOnlyDocumentIds.has(approval.relatedId) &&
            approval.type === "DOCUMENTO"
          ),
      );
      return cleaned.length === current.length ? current : cleaned;
    });
  }, [documents]);

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
            Boolean(document.recipientId) &&
            !linkedDocumentIds.has(document.id),
        )
        .map((document) =>
          createDocumentApproval(
            document,
            users.find((user) => user.id === document.uploadedById)?.role,
          ),
        );
      let changed = missingApprovals.length > 0;
      const synchronized = current.map((approval) => {
        if (approval.type !== "DOCUMENTO") return approval;
        const document = documents.find(
          (item) => item.id === approval.relatedId,
        );
        if (!document) return approval;
        const attachmentName = document.name;
        const attachmentUrl = document.signedUrl;
        const requesterRole =
          approval.requesterRole ||
          users.find((user) => user.id === approval.requesterId)?.role;
        if (
          approval.attachmentName === attachmentName &&
          approval.attachmentUrl === attachmentUrl &&
          approval.requesterRole === requesterRole &&
          approval.recipientId === document.recipientId &&
          approval.recipientName === document.recipientName &&
          approval.recipientRole === document.recipientRole
        )
          return approval;
        changed = true;
        return {
          ...approval,
          attachmentName,
          attachmentUrl,
          requesterRole,
          recipientId: document.recipientId,
          recipientName: document.recipientName,
          recipientRole: document.recipientRole,
        };
      });
      return changed ? [...missingApprovals, ...synchronized] : current;
    });
  }, [documents, users]);

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
  const documentsVisibleToCurrentUser = getDocumentsVisibleToUser(
    documents,
    currentUser,
  );

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

  const isApprovalVisibleToCurrentUser = (approval: Approval): boolean => {
    if (approval.companyId !== activeCompany?.id) return false;
    if (approval.type !== "DOCUMENTO")
      return (
        ["BPO_ADMIN", "BPO_TEAM"].includes(currentUser.role) ||
        hasPermission("approvals.approve")
      );
    return (
      approval.requesterId === currentUser.id ||
      approval.recipientId === currentUser.id
    );
  };

  const canDecideApproval = (approval: Approval): boolean => {
    if (
      approval.status !== "Pendente" ||
      approval.companyId !== activeCompany?.id
    )
      return false;
    if (approval.type !== "DOCUMENTO")
      return hasPermission("approvals.approve");

    const requesterRole =
      approval.requesterRole ||
      users.find((user) => user.id === approval.requesterId)?.role;
    const relatedDocument = documents.find(
      (document) => document.id === approval.relatedId,
    );
    return (
      Boolean(relatedDocument) &&
      relatedDocument?.purpose !== "VIEW_ONLY" &&
      relatedDocument?.status !== "Compartilhado" &&
      ["BPO_ADMIN", "BPO_TEAM"].includes(requesterRole || "") &&
      currentUser.role === "CLIENT" &&
      approval.recipientId === currentUser.id &&
      approval.recipientRole === currentUser.role
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
    const expectedPassword = targetUser.password || ACCESS_PASSWORD;
    if (password !== expectedPassword) {
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
    userId?: string,
    companyId: string = activeCompanyId,
  ) => {
    const notif: Notification = {
      id: `not-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      companyId,
      userId,
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
      prev.map((notification) =>
        notification.id === id &&
        (!notification.userId || notification.userId === currentUser.id) &&
        (!notification.companyId || notification.companyId === activeCompany?.id)
          ? { ...notification, isRead: true }
          : notification,
      ),
    );
  };

  const clearNotifications = () => {
    setNotifications((prev) =>
      prev.map((notification) =>
        (!notification.userId || notification.userId === currentUser.id) &&
        (!notification.companyId || notification.companyId === activeCompany?.id)
          ? { ...notification, isRead: true }
          : notification,
      ),
    );
  };

  const addMasterData = (
    type: MasterDataType,
    name: string,
    parentId?: string,
  ) => {
    if (!["BPO_ADMIN", "BPO_TEAM"].includes(currentUser.role) || !name.trim())
      return undefined;
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
    return item;
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

  // Conta interna "Bolsa" usada pelo módulo Caixa da Padaria — criada sob
  // demanda, uma por empresa, sem depender das telas de cadastro de bancos.
  const ensureBolsaAccount = (companyId: string) => {
    setBankAccounts((prev) => {
      if (prev.some((ba) => ba.companyId === companyId && ba.isBolsaAccount))
        return prev;
      const account: BankAccount = {
        id: `ba-bolsa-${companyId}`,
        companyId,
        bankName: "Bolsa",
        agency: "-",
        accountNumber: "-",
        type: "Corrente",
        balance: 0,
        isBolsaAccount: true,
      };
      return [...prev, account];
    });
  };

  // Ajusta o saldo de uma conta bancária a partir de ações do módulo Caixa da
  // Padaria (sangria, despesa paga pela Bolsa, venda no PIX). Diferente de
  // updateBankAccount, não é restrito a BPO_ADMIN/BPO_TEAM: a operadora
  // (usuário CLIENT) também precisa poder disparar essas movimentações, do
  // mesmo jeito que payAccountPayable/receiveAccountReceivable já mexem no
  // saldo bancário diretamente sem passar pela tela de edição de bancos.
  const applyBakeryBankMovement = (
    bankAccountId: string,
    delta: number,
    meta: { action: string; entityType: string; entityId: string },
  ) => {
    setBankAccounts((prev) => {
      const existing = prev.find((account) => account.id === bankAccountId);
      if (!existing) return prev;
      const updated = { ...existing, balance: existing.balance + delta };
      createAuditLog(
        meta.action,
        meta.entityType,
        meta.entityId,
        existing.companyId,
        { balance: existing.balance },
        { balance: updated.balance },
      );
      return prev.map((account) =>
        account.id === bankAccountId ? updated : account,
      );
    });
  };

  // --- ACCOUNTS PAYABLE ACTIONS ---
  const addAccountPayable: BPOContextType["addAccountPayable"] = (data) => {
    if (!hasPermission("accounts-payable.create")) return;

    const baseFinalAmount =
      Number(data.amount) +
      Number(data.interest) +
      Number(data.penalty) -
      Number(data.discount);
    const limit = activeCompany?.approvalLimit || 5000;

    const slices = buildInstallmentSlices(
      baseFinalAmount,
      data.dueDate,
      data.competenceMonth,
      data.recurrence,
      data.installmentCount,
    );
    const isInstallmentPlan = slices.length > 1;

    const newPayables: AccountPayable[] = [];
    const newApprovals: Approval[] = [];

    slices.forEach((slice, index) => {
      const description = `${data.description}${slice.descriptionSuffix}`;
      const id = `ap-${Date.now()}-${index}`;
      const needsApproval = isInstallmentPlan
        ? slice.amount >= limit
        : data.needsApproval || baseFinalAmount >= limit;
      const status = needsApproval ? "Aguardando aprovação" : "A vencer";

      const newPayable: AccountPayable = {
        ...data,
        id,
        companyId: activeCompanyId,
        description,
        dueDate: slice.dueDate,
        competenceMonth: slice.competenceMonth,
        amount: isInstallmentPlan ? slice.amount : Number(data.amount),
        interest: isInstallmentPlan ? 0 : Number(data.interest),
        penalty: isInstallmentPlan ? 0 : Number(data.penalty),
        discount: isInstallmentPlan ? 0 : Number(data.discount),
        finalAmount: slice.amount,
        status,
        needsApproval,
        installmentGroupId: slice.installmentGroupId,
        installmentNumber: slice.installmentNumber,
        installmentCount: slice.installmentCount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      newPayables.push(newPayable);

      if (needsApproval) {
        const approvalId = `apv-${Date.now()}-${index}`;
        newApprovals.push({
          id: approvalId,
          companyId: activeCompanyId,
          type: "PAGAMENTO",
          relatedId: id,
          description,
          amount: slice.amount,
          dueDate: slice.dueDate,
          requesterId: currentUser.id,
          requesterName: currentUser.name,
          dueDateApproval: slice.dueDate,
          status: "Pendente",
          attachmentName: data.attachmentName,
          attachmentUrl: data.attachmentUrl,
          createdAt: new Date().toISOString(),
          history: [],
        });
      }
    });

    setAccountsPayable((prev) => [...prev, ...newPayables]);
    newPayables.forEach((payable) =>
      createAuditLog(
        "CRIAR_CONTA_PAGAR",
        "AccountPayable",
        payable.id,
        activeCompanyId,
        null,
        payable,
      ),
    );

    if (newApprovals.length > 0) {
      setApprovals((prev) => [...prev, ...newApprovals]);
      newApprovals.forEach((approval) =>
        createAuditLog(
          "SOLICITAR_APROVACAO",
          "Approval",
          approval.id,
          activeCompanyId,
          null,
          approval,
        ),
      );
    }

    if (isInstallmentPlan) {
      addNotification(
        "Compra Parcelada Cadastrada",
        `${slices.length}x cadastradas para "${data.supplier}" — total de R$ ${baseFinalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}, 1ª parcela em ${new Date(data.dueDate).toLocaleDateString("pt-BR")}.${newApprovals.length > 0 ? ` ${newApprovals.length} parcela(s) aguardam aprovação.` : ""}`,
        newApprovals.length > 0 ? "ALERT" : "INFO",
      );
    } else if (newApprovals.length > 0) {
      addNotification(
        "Solicitação de Aprovação",
        `Novo pagamento de R$ ${baseFinalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} cadastrado para "${data.supplier}" necessita de aprovação.`,
        "ALERT",
      );
    } else {
      addNotification(
        "Conta a Pagar Cadastrada",
        `Nova conta para "${data.supplier}" no valor de R$ ${baseFinalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} cadastrada como Pendente.`,
        "INFO",
      );
    }
  };

  const updateAccountPayable: BPOContextType["updateAccountPayable"] = (
    id,
    updates,
  ) => {
    if (!hasPermission("accounts-payable.update"))
      return { success: false, error: "Você não tem permissão para editar contas a pagar." };

    const existing = accountsPayable.find((p) => p.id === id);
    if (!existing) return { success: false, error: "Título não encontrado." };
    if (["Paga", "Parcialmente paga", "Cancelada"].includes(existing.status))
      return {
        success: false,
        error: `Não é possível editar um título com status "${existing.status}". Use a aba de pagamento para lançar novas baixas.`,
      };

    setAccountsPayable((prev) => {
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
    return { success: true };
  };

  const cancelAccountPayable = (id: string) => {
    if (!hasPermission("accounts-payable.cancel"))
      return { success: false, error: "Você não tem permissão para cancelar contas a pagar." };

    const existing = accountsPayable.find((p) => p.id === id);
    if (!existing) return { success: false, error: "Título não encontrado." };
    if (existing.paymentHistory && existing.paymentHistory.length > 0)
      return {
        success: false,
        error:
          "Este título já teve baixas registradas e não pode ser cancelado. Reverta os pagamentos com o BPO antes de cancelar.",
      };

    setAccountsPayable((prev) => {
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
    return { success: true };
  };

  const payAccountPayable: BPOContextType["payAccountPayable"] = (data) => {
    const existing = accountsPayable.find((p) => p.id === data.id);
    if (!existing) return { success: false, error: "Título não encontrado." };
    if (["Paga", "Cancelada"].includes(existing.status))
      return { success: false, error: `Este título já está com status "${existing.status}".` };
    const bank = bankAccounts.find((ba) => ba.id === data.bankAccountId);
    if (!bank) return { success: false, error: "Selecione uma conta bancária válida." };
    if (!(data.amount > 0))
      return { success: false, error: "Informe um valor de pagamento válido." };

    const extraInterest = Number(data.interest) || 0;
    const extraPenalty = Number(data.penalty) || 0;
    const extraDiscount = Number(data.discount) || 0;
    const previouslyPaid = existing.paidAmount || 0;
    const adjustedFinalAmount =
      existing.finalAmount + extraInterest + extraPenalty - extraDiscount;
    const outstandingBefore = adjustedFinalAmount - previouslyPaid;
    const amountPaidNow = Math.min(Number(data.amount), Math.max(outstandingBefore, 0));
    const remaining = outstandingBefore - amountPaidNow;
    const isFullySettled = remaining <= 0.01;

    const payment: AccountPayablePayment = {
      id: `appay-${Date.now()}`,
      date: data.date,
      amount: amountPaidNow,
      bankAccountId: bank.id,
      bankAccountName: bank.bankName,
      interest: extraInterest,
      penalty: extraPenalty,
      discount: extraDiscount,
      notes: data.notes,
      receiptUrl: data.receiptUrl,
      registeredById: currentUser.id,
      registeredByName: currentUser.name,
      createdAt: new Date().toISOString(),
    };

    const updated: AccountPayable = {
      ...existing,
      interest: existing.interest + extraInterest,
      penalty: existing.penalty + extraPenalty,
      discount: existing.discount + extraDiscount,
      finalAmount: adjustedFinalAmount,
      status: isFullySettled ? "Paga" : "Parcialmente paga",
      bankAccountId: bank.id,
      paymentDate: isFullySettled ? data.date : existing.paymentDate,
      paymentReceiptUrl: data.receiptUrl || existing.paymentReceiptUrl,
      paidAmount: previouslyPaid + amountPaidNow,
      paymentHistory: [...(existing.paymentHistory || []), payment],
      updatedAt: new Date().toISOString(),
    };

    setAccountsPayable((prev) => prev.map((p) => (p.id === data.id ? updated : p)));

    // Deduct only the amount that actually left the bank in this settlement
    setBankAccounts((accounts) =>
      accounts.map((ba) =>
        ba.id === bank.id ? { ...ba, balance: ba.balance - amountPaidNow } : ba,
      ),
    );

    createAuditLog(
      "CONFIRMAR_PAGAMENTO",
      "AccountPayable",
      data.id,
      existing.companyId,
      existing,
      updated,
    );

    addNotification(
      isFullySettled ? "Pagamento Confirmado" : "Pagamento Parcial Registrado",
      isFullySettled
        ? `Pagamento de conta registrado e deduzido do saldo de ${bank.bankName}.`
        : `Baixa parcial de R$ ${amountPaidNow.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} registrada. Restam R$ ${remaining.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em aberto.`,
      "SUCCESS",
    );
    return { success: true };
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
  const addAccountReceivable: BPOContextType["addAccountReceivable"] = (
    data,
  ) => {
    if (!hasPermission("accounts-receivable.create")) return;

    const totalAmount = Number(data.amount);
    const slices = buildInstallmentSlices(
      totalAmount,
      data.dueDate,
      data.competenceMonth,
      data.recurrence,
      data.installmentCount,
    );
    const isInstallmentPlan = slices.length > 1;

    const newReceivables: AccountReceivable[] = slices.map((slice, index) => ({
      ...data,
      id: `ar-${Date.now()}-${index}`,
      companyId: activeCompanyId,
      description: `${data.description}${slice.descriptionSuffix}`,
      dueDate: slice.dueDate,
      competenceMonth: slice.competenceMonth,
      amount: isInstallmentPlan ? slice.amount : totalAmount,
      interest: isInstallmentPlan ? 0 : Number(data.interest),
      penalty: isInstallmentPlan ? 0 : Number(data.penalty),
      discount: isInstallmentPlan ? 0 : Number(data.discount),
      receivedAmount: 0,
      status: "A receber",
      installmentGroupId: slice.installmentGroupId,
      installmentNumber: slice.installmentNumber,
      installmentCount: slice.installmentCount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    setAccountsReceivable((prev) => [...prev, ...newReceivables]);
    newReceivables.forEach((receivable) =>
      createAuditLog(
        "CRIAR_CONTA_RECEBER",
        "AccountReceivable",
        receivable.id,
        activeCompanyId,
        null,
        receivable,
      ),
    );

    addNotification(
      isInstallmentPlan ? "Faturamento Parcelado Lançado" : "Conta a Receber Lançada",
      isInstallmentPlan
        ? `${slices.length}x lançadas para "${data.customer}" — total de R$ ${totalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}, 1ª parcela em ${new Date(data.dueDate).toLocaleDateString("pt-BR")}.`
        : `Faturamento para "${data.customer}" no valor de R$ ${totalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} lançado.`,
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

      if (existing.status === "Recebido") {
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
      if (!canDecideApproval(existing)) return prev;

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
        existing.type === "DOCUMENTO" ? existing.requesterId : undefined,
        existing.companyId,
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
    recipientId?: string;
    approvalRecipientId?: string;
  }) => {
    if (!hasPermission("documents.upload")) return;

    const {
      recipientId: requestedShareRecipientId,
      approvalRecipientId: requestedApprovalRecipientId,
      ...documentData
    } = data;
    const id = `doc-${Date.now()}`;
    const targetCompanyId =
      data.companyId &&
      (currentUser.role === "BPO_ADMIN" ||
        currentUser.companies?.includes(data.companyId))
        ? data.companyId
        : activeCompanyId;
    const shareRecipient = ["BPO_ADMIN", "BPO_TEAM"].includes(currentUser.role)
      ? users.find(
          (user) =>
            user.id === requestedShareRecipientId &&
            user.status === "ACTIVE" &&
            ["CLIENT", "ACCOUNTANT"].includes(user.role) &&
            user.companies?.includes(targetCompanyId),
        )
      : undefined;
    const approvalRecipient =
      !shareRecipient &&
      ["BPO_ADMIN", "BPO_TEAM"].includes(currentUser.role)
        ? users.find(
            (user) =>
              user.id === requestedApprovalRecipientId &&
              user.status === "ACTIVE" &&
              user.role === "CLIENT" &&
              user.companies?.includes(targetCompanyId),
          )
        : undefined;
    const recipient = shareRecipient || approvalRecipient;
    const newDoc: Document = {
      ...documentData,
      id,
      companyId: targetCompanyId,
      uploadedAt: new Date().toISOString(),
      uploadedById: currentUser.id,
      uploadedByName: currentUser.name,
      recipientId: recipient?.id,
      recipientName: recipient?.name,
      recipientRole: recipient?.role as Document["recipientRole"],
      sharedById: recipient ? currentUser.id : undefined,
      sharedByName: recipient ? currentUser.name : undefined,
      sharedByRole: recipient
        ? (currentUser.role as Document["sharedByRole"])
        : undefined,
      sharedAt: recipient ? new Date().toISOString() : undefined,
      hash: Math.random().toString(16).substr(2, 32),
      status: shareRecipient
        ? "Compartilhado"
        : approvalRecipient
          ? "Aguardando Aprovação"
          : "Aguardando Análise",
      purpose: shareRecipient ? "VIEW_ONLY" : "PROCESSING",
      origin: "Documento",
      signedUrl: data.previewUrl,
    };

    setDocuments((prev) => [...prev, newDoc]);
    if (shareRecipient) {
      createAuditLog(
        "COMPARTILHAR_DOCUMENTO_VISUALIZACAO",
        "Document",
        newDoc.id,
        targetCompanyId,
        null,
        newDoc,
      );
      addNotification(
        "Documento recebido do BPO",
        `${currentUser.name} compartilhou "${newDoc.name}" somente para visualização.`,
        "INFO",
        shareRecipient.id,
        targetCompanyId,
      );
    }
    if (approvalRecipient) {
      const approval = createDocumentApproval(newDoc, currentUser.role);
      setApprovals((prev) => [...prev, approval]);
      createAuditLog(
        "ENVIAR_DOCUMENTO_APROVACAO",
        "Approval",
        approval.id,
        targetCompanyId,
        null,
        approval,
      );
      addNotification(
        "Documento analisado para aprovação",
        `${currentUser.name} enviou "${newDoc.name}" para sua aprovação documental.`,
        "ALERT",
        approvalRecipient.id,
        targetCompanyId,
      );
    }
    createAuditLog(
      "UPLOAD_DOCUMENTO",
      "Document",
      id,
      targetCompanyId,
      null,
      newDoc,
    );

    addNotification(
      shareRecipient
        ? "Documento compartilhado"
        : approvalRecipient
          ? "Documento enviado para aprovação"
          : "Documento enviado",
      shareRecipient
        ? `O arquivo "${data.name}" foi compartilhado para visualização com ${shareRecipient.name}.`
        : approvalRecipient
          ? `O arquivo "${data.name}" foi analisado e enviado para aprovação de ${approvalRecipient.name}.`
          : `O arquivo "${data.name}" foi incluído com sucesso na categoria ${data.category}.`,
      "SUCCESS",
      currentUser.id,
      targetCompanyId,
    );
  };

  const deleteDocument = (id: string) => {
    const existing = documents.find((document) => document.id === id);
    if (
      !existing ||
      existing.companyId !== activeCompany?.id ||
      existing.uploadedById !== currentUser.id
    )
      return;

    createAuditLog(
      "DELETAR_DOCUMENTO",
      "Document",
      id,
      existing.companyId,
      existing,
      null,
    );
    setApprovals((items) =>
      items.map((approval) =>
        approval.relatedId === id && approval.status === "Pendente"
          ? { ...approval, status: "Cancelada" }
          : approval,
      ),
    );
    setDocuments((prev) => prev.filter((document) => document.id !== id));

    addNotification(
      "Documento Removido",
      "Um documento foi excluído do repositório da empresa.",
      "INFO",
      currentUser.id,
      existing.companyId,
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
  ): ReconciliationResult => {
    if (!hasPermission("reconciliation.execute")) {
      return { success: false, error: "Usuário sem permissão para conciliar." };
    }

    const bankAccount = bankAccounts.find(
      (account) =>
        account.id === bankAccountId && account.companyId === activeCompanyId,
    );
    if (!bankAccount) {
      return {
        success: false,
        error: "A conta bancária não pertence à empresa ativa.",
      };
    }
    const statementItem = (statementItems[bankAccountId] || []).find(
      (item) => item.id === statementItemId,
    );
    if (!statementItem) {
      return { success: false, error: "Item do extrato não encontrado." };
    }
    if (statementItem.isReconciled) {
      return { success: false, error: "Este item do extrato já foi conciliado." };
    }
    if (statementItem.amount === 0) {
      return {
        success: false,
        error: "Um item de valor zero não pode ser conciliado.",
      };
    }
    if (
      (type === "A_PAGAR" && statementItem.amount >= 0) ||
      (type === "A_RECEBER" && statementItem.amount <= 0)
    ) {
      return {
        success: false,
        error:
          statementItem.amount < 0
            ? "Uma saída bancária somente pode ser vinculada a uma conta a pagar."
            : "Uma entrada bancária somente pode ser vinculada a uma conta a receber.",
      };
    }

    const toCents = (value: number) =>
      Math.round((Number(value) + Number.EPSILON) * 100);
    const formatMoney = (value: number) =>
      value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    const statementValue = Math.abs(statementItem.amount);
    const statementCents = toCents(statementValue);
    const today = new Date().toISOString().split("T")[0];
    let expectedValue = 0;
    let isPartial = false;

    if (type === "A_PAGAR") {
      const record = accountsPayable.find((item) => item.id === financialRecordId);
      if (!record || record.companyId !== activeCompanyId) {
        return { success: false, error: "Conta a pagar não encontrada." };
      }
      if (record.bankAccountId !== bankAccountId) {
        return {
          success: false,
          error: "A conta a pagar utiliza uma conta bancária diferente do extrato.",
        };
      }
      const eligibleStatuses: AccountPayable["status"][] = [
        "Pendente",
        "A vencer",
        "Aprovada",
        "Agendada",
        "Vencida",
      ];
      if (!eligibleStatuses.includes(record.status)) {
        return {
          success: false,
          error: `A conta a pagar está com status "${record.status}" e não pode ser conciliada.`,
        };
      }
      expectedValue = record.finalAmount;
      if (statementCents !== toCents(expectedValue)) {
        return {
          success: false,
          error: `Valor incompatível: o extrato possui ${formatMoney(statementValue)} e a conta a pagar exige ${formatMoney(expectedValue)}. Nenhuma alteração foi realizada.`,
        };
      }
      payAccountPayable({
        id: financialRecordId,
        date: today,
        bankAccountId,
        amount: expectedValue,
      });
    } else {
      const record = accountsReceivable.find(
        (item) => item.id === financialRecordId,
      );
      if (!record || record.companyId !== activeCompanyId) {
        return { success: false, error: "Conta a receber não encontrada." };
      }
      if (record.bankAccountId !== bankAccountId) {
        return {
          success: false,
          error:
            "A conta a receber utiliza uma conta bancária diferente do extrato.",
        };
      }
      if (["Recebido", "Cancelado"].includes(record.status)) {
        return {
          success: false,
          error: `A conta a receber está com status "${record.status}" e não pode ser conciliada.`,
        };
      }
      expectedValue = Math.max(
        0,
        record.amount +
          record.interest +
          record.penalty -
          record.discount -
          record.receivedAmount,
      );
      if (statementCents > toCents(expectedValue)) {
        return {
          success: false,
          error: `Valor incompatível: o extrato possui ${formatMoney(statementValue)}, acima do saldo de ${formatMoney(expectedValue)} da conta a receber. Nenhuma alteração foi realizada.`,
        };
      }
      isPartial = statementCents < toCents(expectedValue);
      receiveAccountReceivable(financialRecordId, statementValue, today);
    }

    setStatementItems((prev) => {
      const items = prev[bankAccountId] || [];
      return {
        ...prev,
        [bankAccountId]: items.map((item) =>
          item.id === statementItemId
            ? {
                ...item,
                isReconciled: true,
                reconciliationStatus: isPartial
                  ? ("Parcialmente conciliada" as const)
                  : ("Conciliada" as const),
                matchedTransactionId: financialRecordId,
              }
            : item,
        ),
      };
    });

    createAuditLog(
      "CONCILIACAO_MANUAL",
      "StatementItem",
      statementItemId,
      activeCompanyId,
      null,
      {
        financialRecordId,
        type,
        notes,
        statementAmount: statementValue,
        expectedAmount: expectedValue,
        partial: isPartial,
        bankAccountId,
      },
    );
    addNotification(
      isPartial ? "Recebimento Parcial Conciliado" : "Conciliação Concluída",
      isPartial
        ? `A entrada de ${formatMoney(statementValue)} foi registrada sem quitar integralmente a conta a receber.`
        : "Transação e lançamento bancário associados com sucesso.",
      "SUCCESS",
    );
    return { success: true, partial: isPartial };
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
            Math.abs(ap.finalAmount - (ap.paidAmount || 0) - absoluteAmount) < 0.01 &&
            !["Paga", "Cancelada"].includes(ap.status),
        );

        if (match) {
          matchedCount++;
          // Immediately pay
          const today = new Date().toISOString().split("T")[0];
          setTimeout(
            () =>
              payAccountPayable({
                id: match.id,
                date: today,
                bankAccountId,
                amount: absoluteAmount,
              }),
            0,
          );
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
            ar.status !== "Recebido",
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
  const generateReport = (
    name: string,
    type: string,
    filters: string,
    options: ReportGenerationOptions = { format: "PDF" },
  ): ReportRecord | null => {
    if (!hasPermission("reports.generate") || !activeCompany) return null;

    const matchesPeriod = (date?: string) =>
      Boolean(
        date &&
          (!options.startDate || date >= options.startDate) &&
          (!options.endDate || date <= options.endDate),
      );
    const companyPayables = accountsPayable.filter(
      (item) =>
        item.companyId === activeCompanyId &&
        matchesPeriod(
          type === "Fluxo de Caixa"
            ? item.paymentDate || item.dueDate
            : type === "DRE"
              ? item.issueDate
              : item.dueDate,
        ) &&
        (!options.bankAccountId ||
          item.bankAccountId === options.bankAccountId) &&
        (!options.category || item.category === options.category) &&
        (!options.costCenter || item.costCenter === options.costCenter),
    );
    const companyReceivables = accountsReceivable.filter(
      (item) =>
        item.companyId === activeCompanyId &&
        matchesPeriod(
          type === "Fluxo de Caixa"
            ? item.receiptDate || item.dueDate
            : type === "DRE"
              ? item.issueDate
              : item.dueDate,
        ) &&
        (!options.bankAccountId ||
          item.bankAccountId === options.bankAccountId) &&
        (!options.category || item.category === options.category) &&
        (!options.costCenter || item.costCenter === options.costCenter),
    );
    let columns: string[] = [];
    let rows: ReportCell[][] = [];

    if (type === "Contas a Pagar") {
      columns = [
        "Vencimento",
        "Fornecedor",
        "Descrição",
        "Categoria",
        "Centro de custo",
        "Status",
        "Valor",
        "Pagamento",
      ];
      rows = companyPayables
        .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
        .map((item) => [
          item.dueDate,
          item.supplier,
          item.description,
          item.category,
          item.costCenter,
          item.status,
          item.finalAmount,
          item.paymentDate || "—",
        ]);
    } else if (type === "Contas a Receber") {
      columns = [
        "Vencimento",
        "Cliente",
        "Descrição",
        "Categoria",
        "Centro de custo",
        "Status",
        "Valor",
        "Recebido",
      ];
      rows = companyReceivables
        .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
        .map((item) => [
          item.dueDate,
          item.customer,
          item.description,
          item.category,
          item.costCenter,
          item.status,
          item.amount,
          item.receivedAmount,
        ]);
    } else if (type === "Inadimplência") {
      const today = new Date().toISOString().slice(0, 10);
      columns = [
        "Vencimento",
        "Cliente",
        "Documento",
        "Descrição",
        "Status",
        "Valor original",
        "Saldo em aberto",
      ];
      rows = companyReceivables
        .filter(
          (item) =>
            item.dueDate < today &&
            item.receivedAmount < item.amount &&
            !item.status.toLocaleLowerCase("pt-BR").startsWith("cancel"),
        )
        .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
        .map((item) => [
          item.dueDate,
          item.customer,
          item.documentNumber,
          item.description,
          item.status,
          item.amount,
          Math.max(0, item.amount - item.receivedAmount),
        ]);
    } else if (type === "DRE") {
      const grouped = new Map<string, { revenue: number; expense: number }>();
      companyReceivables
        .filter(
          (item) =>
            !item.status.toLocaleLowerCase("pt-BR").startsWith("cancel"),
        )
        .forEach((item) => {
          const current = grouped.get(item.category) || {
            revenue: 0,
            expense: 0,
          };
          current.revenue += item.amount;
          grouped.set(item.category, current);
        });
      companyPayables
        .filter(
          (item) =>
            !item.status.toLocaleLowerCase("pt-BR").startsWith("cancel"),
        )
        .forEach((item) => {
          const current = grouped.get(item.category) || {
            revenue: 0,
            expense: 0,
          };
          current.expense += item.finalAmount;
          grouped.set(item.category, current);
        });
      columns = ["Categoria", "Receitas", "Despesas", "Resultado"];
      rows = Array.from(grouped.entries())
        .sort(([left], [right]) => left.localeCompare(right, "pt-BR"))
        .map(([category, values]) => [
          category,
          values.revenue,
          values.expense,
          values.revenue - values.expense,
        ]);
      const revenueTotal = rows.reduce(
        (total, row) => total + Number(row[1]),
        0,
      );
      const expenseTotal = rows.reduce(
        (total, row) => total + Number(row[2]),
        0,
      );
      rows.push([
        "TOTAL",
        revenueTotal,
        expenseTotal,
        revenueTotal - expenseTotal,
      ]);
    } else if (type === "Conciliação") {
      const companyAccounts = bankAccounts.filter(
        (account) =>
          account.companyId === activeCompanyId &&
          (!options.bankAccountId || account.id === options.bankAccountId),
      );
      columns = [
        "Data",
        "Conta bancária",
        "Descrição",
        "Documento",
        "Tipo",
        "Valor",
        "Conciliação",
      ];
      rows = companyAccounts
        .flatMap((account) =>
          (statementItems[account.id] || [])
            .filter((item) => matchesPeriod(item.date))
            .map(
              (item): ReportCell[] => [
                item.date,
                `${account.bankName} - ${account.accountNumber}`,
                item.description,
                item.documentNumber || "—",
                item.amount >= 0 ? "Entrada" : "Saída",
                item.amount,
                item.reconciliationStatus,
              ],
            ),
        )
        .sort((left, right) => String(left[0]).localeCompare(String(right[0])));
    } else {
      columns = [
        "Data",
        "Movimento",
        "Descrição",
        "Entidade",
        "Status",
        "Previsto",
        "Realizado",
      ];
      const payableRows: ReportCell[][] = companyPayables
        .filter(
          (item) =>
            !item.status.toLocaleLowerCase("pt-BR").startsWith("cancel"),
        )
        .map((item) => [
          item.paymentDate || item.dueDate,
          "Saída",
          item.description,
          item.supplier,
          item.status,
          -item.finalAmount,
          item.status === "Paga" ? -item.finalAmount : 0,
        ]);
      const receivableRows: ReportCell[][] = companyReceivables
        .filter(
          (item) =>
            !item.status.toLocaleLowerCase("pt-BR").startsWith("cancel"),
        )
        .map((item) => [
          item.receiptDate || item.dueDate,
          "Entrada",
          item.description,
          item.customer,
          item.status,
          item.amount,
          item.receivedAmount,
        ]);
      rows = [...payableRows, ...receivableRows].sort((left, right) =>
        String(left[0]).localeCompare(String(right[0])),
      );
    }

    const generatedAt = new Date().toISOString();
    const table: ReportTableData = {
      title: name,
      companyName: activeCompany.tradeName,
      filters,
      generatedAt,
      generatedBy: currentUser.name,
      columns,
      rows,
    };
    const artifact = createReportArtifact(table, options.format);
    const id = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newReport: ReportRecord = {
      id,
      companyId: activeCompanyId,
      name,
      type,
      filters,
      generatedAt,
      generatedById: currentUser.id,
      generatedByName: currentUser.name,
      ...artifact,
    };

    setReports((prev) => [newReport, ...prev]);
    const { fileContent: _fileContent, ...auditMetadata } = newReport;
    void _fileContent;
    createAuditLog(
      "GERAR_RELATORIO",
      "Report",
      id,
      activeCompanyId,
      null,
      { ...auditMetadata, rowCount: rows.length },
    );
    addNotification(
      "Relatório Pronto",
      `O relatório "${name}" foi gerado em ${options.format} com ${rows.length} registro(s).`,
      "SUCCESS",
    );
    return newReport;
  };

  // --- ADMINISTRATION: COMPANIES & CLIENTS ---
  const addCompany = (
    data: Omit<Company, "id" | "createdAt" | "status">,
    onboarding: CompanyOnboardingData,
  ): CompanyCreationResult => {
    if (currentUser.role !== "BPO_ADMIN") {
      return {
        success: false,
        error: "Apenas administradores do BPO podem cadastrar empresas.",
      };
    }
    if (!data.clientModules?.length) {
      return {
        success: false,
        error: "Selecione pelo menos um módulo para o acesso do cliente.",
      };
    }

    const normalizedCnpj = data.cnpj.replace(/\D/g, "");
    if (
      companies.some(
        (company) => company.cnpj.replace(/\D/g, "") === normalizedCnpj,
      )
    ) {
      return { success: false, error: "Já existe uma empresa com este CNPJ." };
    }

    const bpoResponsible = users.find(
      (user) =>
        user.id === data.bpoResponsibleId &&
        user.status === "ACTIVE" &&
        ["BPO_ADMIN", "BPO_TEAM"].includes(user.role),
    );
    if (!bpoResponsible) {
      return {
        success: false,
        error: "Selecione um responsável BPO ativo para a nova empresa.",
      };
    }

    const primaryContactName = data.primaryContactName.trim();
    const primaryContactEmail = data.primaryContactEmail.trim().toLowerCase();
    if (!primaryContactName || !primaryContactEmail) {
      return {
        success: false,
        error: "Informe o nome e o e-mail do contato principal.",
      };
    }

    const accountantName = data.accountantName.trim();
    const accountantEmail = data.accountantEmail.trim().toLowerCase();
    if (Boolean(accountantName) !== Boolean(accountantEmail)) {
      return {
        success: false,
        error: "Para cadastrar o contador, informe o nome e o e-mail.",
      };
    }
    if (accountantEmail && accountantEmail === primaryContactEmail) {
      return {
        success: false,
        error: "O contato principal e o contador devem usar e-mails diferentes.",
      };
    }

    const existingPrimaryContact = users.find(
      (user) => user.email.trim().toLowerCase() === primaryContactEmail,
    );
    if (existingPrimaryContact && existingPrimaryContact.role !== "CLIENT") {
      return {
        success: false,
        error:
          "O e-mail do contato principal já pertence a um perfil que não é cliente.",
      };
    }

    const existingAccountant = accountantEmail
      ? users.find(
          (user) => user.email.trim().toLowerCase() === accountantEmail,
        )
      : undefined;
    if (existingAccountant && existingAccountant.role !== "ACCOUNTANT") {
      return {
        success: false,
        error:
          "O e-mail do contador já pertence a um perfil de acesso diferente.",
      };
    }

    const bank = onboarding.initialBankAccount;
    if (
      !bank.bankName.trim() ||
      !bank.agency.trim() ||
      !bank.accountNumber.trim() ||
      !Number.isFinite(Number(bank.balance))
    ) {
      return {
        success: false,
        error: "Preencha corretamente os dados da conta bancária inicial.",
      };
    }

    const createdAt = new Date().toISOString();
    const id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newCompany: Company = {
      ...data,
      cnpj: data.cnpj.trim(),
      corporateName: data.corporateName.trim(),
      tradeName: data.tradeName.trim(),
      segment: data.segment.trim(),
      accountantName,
      accountantEmail,
      primaryContactName,
      primaryContactEmail,
      bpoResponsibleId: bpoResponsible.id,
      approvalLimit: Number(data.approvalLimit) || 0,
      clientModules: Array.from(new Set(data.clientModules)),
      id,
      status: "Em dia",
      createdAt,
    };
    const newBank: BankAccount = {
      ...bank,
      id: `ba-${id}-${Math.random().toString(36).slice(2, 7)}`,
      companyId: id,
      bankName: bank.bankName.trim(),
      agency: bank.agency.trim(),
      accountNumber: bank.accountNumber.trim(),
      balance: Number(bank.balance),
    };

    const configuredMasterData = Object.fromEntries(
      (Object.keys(DEFAULT_COMPANY_MASTER_DATA) as MasterDataType[]).map(
        (type) => {
          const suppliedValues = onboarding.masterData[type] || [];
          const fallbackValues = DEFAULT_COMPANY_MASTER_DATA[type] || [];
          return [type, suppliedValues.length ? suppliedValues : fallbackValues];
        },
      ),
    ) as Partial<Record<MasterDataType, string[]>>;
    const newMasterData = createCompanyMasterData(id, configuredMasterData);

    const clientPermissions = [
      "dashboard.view",
      "approvals.approve",
      "documents.upload",
      "documents.download",
      "reports.view",
      "reports.generate",
    ];
    const accountantPermissions = [
      "dashboard.view",
      "documents.download",
      "reports.view",
      "reports.generate",
    ];

    setCompanies((previous) => [...previous, newCompany]);
    setBankAccounts((previous) => [...previous, newBank]);
    setMasterData((previous) => [...previous, ...newMasterData]);
    setUsers((previous) => {
      const linkCompany = (companyIds: string[] | undefined) =>
        Array.from(new Set([...(companyIds || []), id]));
      const mergePermissions = (current: string[], defaults: string[]) =>
        Array.from(new Set([...current, ...defaults]));

      let nextUsers = previous.map((user) => {
        if (user.id === existingPrimaryContact?.id) {
          return {
            ...user,
            name: primaryContactName,
            status: "ACTIVE" as const,
            companies: linkCompany(user.companies),
            permissions: mergePermissions(user.permissions, clientPermissions),
          };
        }
        if (user.id === existingAccountant?.id) {
          return {
            ...user,
            name: accountantName,
            status: "ACTIVE" as const,
            companies: linkCompany(user.companies),
            permissions: mergePermissions(
              user.permissions,
              accountantPermissions,
            ),
          };
        }
        if (user.id === bpoResponsible.id) {
          return { ...user, companies: linkCompany(user.companies) };
        }
        return user;
      });

      if (!existingPrimaryContact) {
        nextUsers = [
          ...nextUsers,
          {
            id: `u-client-${id}`,
            name: primaryContactName,
            email: primaryContactEmail,
            role: "CLIENT",
            status: "ACTIVE",
            title: `Contato principal - ${newCompany.tradeName}`,
            companies: [id],
            permissions: clientPermissions,
          },
        ];
      }
      if (accountantEmail && !existingAccountant) {
        nextUsers = [
          ...nextUsers,
          {
            id: `u-accountant-${id}`,
            name: accountantName,
            email: accountantEmail,
            role: "ACCOUNTANT",
            status: "ACTIVE",
            title: `Contador responsável - ${newCompany.tradeName}`,
            companies: [id],
            permissions: accountantPermissions,
          },
        ];
      }
      return nextUsers;
    });

    createAuditLog("PROVISIONAR_EMPRESA", "Company", id, id, null, {
      company: newCompany,
      bankAccount: newBank,
      masterDataCount: newMasterData.length,
      primaryContactUserId: existingPrimaryContact?.id || `u-client-${id}`,
      accountantUserId: accountantEmail
        ? existingAccountant?.id || `u-accountant-${id}`
        : undefined,
      bpoResponsibleId: bpoResponsible.id,
    });
    addNotification(
      "Empresa pronta para operar",
      `A empresa "${newCompany.tradeName}" recebeu conta bancária, cadastros iniciais e acessos dos responsáveis.`,
      "SUCCESS",
      undefined,
      id,
    );

    return { success: true };
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
  ): CompanyCreationResult => {
    if (currentUser.role !== "BPO_ADMIN") {
      return {
        success: false,
        error: "Apenas administradores do BPO podem editar empresas.",
      };
    }

    const existing = companies.find((company) => company.id === id);
    if (!existing) {
      return { success: false, error: "Empresa não encontrada." };
    }
    if (updates.clientModules && updates.clientModules.length === 0) {
      return {
        success: false,
        error: "Selecione pelo menos um módulo para o acesso do cliente.",
      };
    }
    if (updates.cnpj) {
      const normalizedCnpj = updates.cnpj.replace(/\D/g, "");
      if (
        companies.some(
          (company) =>
            company.id !== id &&
            company.cnpj.replace(/\D/g, "") === normalizedCnpj,
        )
      ) {
        return { success: false, error: "Já existe uma empresa com este CNPJ." };
      }
    }

    const updated: Company = {
      ...existing,
      ...updates,
      clientModules: updates.clientModules
        ? Array.from(new Set(updates.clientModules))
        : existing.clientModules,
      approvalLimit:
        updates.approvalLimit === undefined
          ? existing.approvalLimit
          : Number(updates.approvalLimit),
    };
    setCompanies((previous) =>
      previous.map((company) => (company.id === id ? updated : company)),
    );
    createAuditLog(
      "ATUALIZAR_EMPRESA_CLIENTE",
      "Company",
      id,
      id,
      existing,
      updated,
    );
    return { success: true };
  };

  const deleteCompany = (id: string): CompanyCreationResult => {
    if (currentUser.role !== "BPO_ADMIN") {
      return {
        success: false,
        error: "Apenas administradores do BPO podem excluir empresas.",
      };
    }

    const company = companies.find((item) => item.id === id);
    if (!company) {
      return { success: false, error: "Empresa não encontrada." };
    }

    const companyBankAccountIds = new Set(
      bankAccounts
        .filter((account) => account.companyId === id)
        .map((account) => account.id),
    );
    const remainingCompanies = companies.filter((item) => item.id !== id);

    createAuditLog(
      "EXCLUIR_EMPRESA_CLIENTE",
      "Company",
      id,
      id,
      company,
      null,
    );
    setCompanies(remainingCompanies);
    setBankAccounts((previous) =>
      previous.filter((account) => account.companyId !== id),
    );
    setMasterData((previous) =>
      previous.filter((item) => item.companyId !== id),
    );
    setAccountsPayable((previous) =>
      previous.filter((account) => account.companyId !== id),
    );
    setAccountsReceivable((previous) =>
      previous.filter((account) => account.companyId !== id),
    );
    setApprovals((previous) =>
      previous.filter((approval) => approval.companyId !== id),
    );
    setDocuments((previous) =>
      previous.filter((document) => document.companyId !== id),
    );
    setReports((previous) =>
      previous.filter((report) => report.companyId !== id),
    );
    setNotifications((previous) =>
      previous.filter((notification) => notification.companyId !== id),
    );
    setSupportTickets((previous) =>
      previous.filter((ticket) => ticket.companyId !== id),
    );
    setStatementItems((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(
          ([bankAccountId]) => !companyBankAccountIds.has(bankAccountId),
        ),
      ),
    );
    setUsers((previous) =>
      previous.flatMap((user) => {
        if (!user.companies?.includes(id)) return [user];
        const remainingAccess = user.companies.filter(
          (companyId) => companyId !== id,
        );
        if (
          remainingAccess.length === 0 &&
          ["CLIENT", "ACCOUNTANT"].includes(user.role)
        ) {
          return [];
        }
        return [{ ...user, companies: remainingAccess }];
      }),
    );
    if (activeCompanyId === id) {
      setActiveCompanyId(remainingCompanies[0]?.id || "");
    }

    return { success: true };
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
      { ...newUser, password: newUser.password ? "••••••••" : undefined },
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
    clientOperator?: boolean,
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
        clientOperator: clientOperator ?? existing.clientOperator,
      };

      createAuditLog(
        "ALTERAR_PERMISSOES_USUARIO",
        "User",
        id,
        undefined,
        { ...existing, password: existing.password ? "••••••••" : undefined },
        { ...updated, password: updated.password ? "••••••••" : undefined },
      );
      return prev.map((u) => (u.id === id ? updated : u));
    });

    addNotification(
      "Permissões Atualizadas",
      "As permissões de RBAC foram salvas no perfil do colaborador.",
      "SUCCESS",
    );
  };

  const updateTeamMember: BPOContextType["updateTeamMember"] = (
    id,
    updates,
  ) => {
    if (currentUser.role !== "BPO_ADMIN")
      return { success: false, error: "Apenas o Admin do BPO pode editar usuários." };

    const existing = users.find((u) => u.id === id);
    if (!existing) return { success: false, error: "Usuário não encontrado." };
    if (updates.name !== undefined && !updates.name.trim())
      return { success: false, error: "Informe o nome do usuário." };
    if (updates.email !== undefined && !updates.email.trim())
      return { success: false, error: "Informe o e-mail do usuário." };
    if (
      updates.email &&
      users.some(
        (u) => u.id !== id && u.email.toLowerCase() === updates.email!.trim().toLowerCase(),
      )
    )
      return { success: false, error: "Já existe um usuário com este e-mail." };
    if (updates.password !== undefined && updates.password.trim().length < 6)
      return { success: false, error: "A senha deve ter pelo menos 6 caracteres." };

    const updated: User = {
      ...existing,
      name: updates.name?.trim() ?? existing.name,
      email: updates.email?.trim() ?? existing.email,
      title: updates.title !== undefined ? updates.title : existing.title,
      role: updates.role ?? existing.role,
      password: updates.password ? updates.password.trim() : existing.password,
    };

    setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
    createAuditLog(
      "EDITAR_COLABORADOR",
      "User",
      id,
      undefined,
      { ...existing, password: existing.password ? "••••••••" : undefined },
      { ...updated, password: updated.password ? "••••••••" : undefined },
    );
    addNotification(
      "Usuário Atualizado",
      `Os dados de ${updated.name} foram atualizados.`,
      "SUCCESS",
    );
    return { success: true };
  };

  const deleteTeamMember: BPOContextType["deleteTeamMember"] = (id) => {
    if (currentUser.role !== "BPO_ADMIN")
      return { success: false, error: "Apenas o Admin do BPO pode excluir usuários." };
    if (id === currentUser.id)
      return { success: false, error: "Você não pode excluir o seu próprio usuário." };

    const existing = users.find((u) => u.id === id);
    if (!existing) return { success: false, error: "Usuário não encontrado." };
    if (
      existing.role === "BPO_ADMIN" &&
      users.filter((u) => u.role === "BPO_ADMIN" && u.status === "ACTIVE").length <= 1
    )
      return {
        success: false,
        error: "Não é possível excluir o último Admin do BPO ativo.",
      };

    setUsers((prev) => prev.filter((u) => u.id !== id));
    createAuditLog(
      "EXCLUIR_COLABORADOR",
      "User",
      id,
      undefined,
      { ...existing, password: existing.password ? "••••••••" : undefined },
      null,
    );
    addNotification(
      "Usuário Removido",
      `${existing.name} foi removido da plataforma.`,
      "WARNING",
    );
    return { success: true };
  };

  const updateDocument = (id: string, updates: Partial<Document>) => {
    const document = documents.find((item) => item.id === id);
    if (
      !document ||
      document.companyId !== activeCompany?.id ||
      document.purpose === "VIEW_ONLY" ||
      document.status === "Compartilhado" ||
      !["BPO_ADMIN", "BPO_TEAM"].includes(currentUser.role)
    )
      return false;

    const isManualLaunch =
      document.origin === "Manual" ||
      document.mimeType === "application/x-manual-entry";
    const safeUpdates =
      isManualLaunch && document.status === "Lançado"
        ? { ...updates, entryType: document.entryType }
        : updates;
    const updated: Document = {
      ...document,
      ...safeUpdates,
      amount:
        safeUpdates.amount === undefined
          ? document.amount
          : Number(safeUpdates.amount),
    };

    if (isManualLaunch && document.status === "Lançado") {
      if (document.entryType === "Conta a Receber") {
        const linked = accountsReceivable.find(
          (item) => item.id === document.relatedEntityId,
        );
        if (
          !linked ||
          linked.receivedAmount > 0 ||
          ["Recebido", "Cancelado"].includes(linked.status)
        )
          return false;
        setAccountsReceivable((current) =>
          current.map((item) =>
            item.id === linked.id
              ? {
                  ...item,
                  description: updated.description,
                  customer: updated.supplier || "Cliente a confirmar",
                  category: updated.expenseType || updated.category,
                  costCenter: updated.costCenter || "A classificar",
                  competenceMonth: updated.competenceMonth,
                  dueDate: updated.dueDate || item.dueDate,
                  amount: updated.amount || 0,
                  paymentMethod: updated.paymentMethod || "A definir",
                  bankAccountId: updated.bankAccountId || "",
                  recurrence: updated.recurrence || "Nenhuma",
                  documentNumber: updated.documentNumber || "",
                  notes: updated.notes || "Lançamento avulso.",
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
        );
      } else if (document.entryType === "Transferência") {
        if (
          !document.bankAccountId ||
          !document.destinationBankAccountId ||
          !updated.bankAccountId ||
          !updated.destinationBankAccountId ||
          updated.bankAccountId === updated.destinationBankAccountId ||
          !bankAccounts.some(
            (account) =>
              account.id === document.bankAccountId &&
              account.companyId === document.companyId,
          ) ||
          !bankAccounts.some(
            (account) =>
              account.id === document.destinationBankAccountId &&
              account.companyId === document.companyId,
          ) ||
          !bankAccounts.some(
            (account) =>
              account.id === updated.bankAccountId &&
              account.companyId === document.companyId,
          ) ||
          !bankAccounts.some(
            (account) =>
              account.id === updated.destinationBankAccountId &&
              account.companyId === document.companyId,
          )
        )
          return false;
        setBankAccounts((current) =>
          current.map((account) => {
            let balance = account.balance;
            if (account.id === document.bankAccountId)
              balance += document.amount || 0;
            if (account.id === document.destinationBankAccountId)
              balance -= document.amount || 0;
            if (account.id === updated.bankAccountId)
              balance -= updated.amount || 0;
            if (account.id === updated.destinationBankAccountId)
              balance += updated.amount || 0;
            return balance === account.balance ? account : { ...account, balance };
          }),
        );
      } else {
        const linked = accountsPayable.find(
          (item) => item.id === document.relatedEntityId,
        );
        if (!linked || ["Paga", "Cancelada"].includes(linked.status))
          return false;
        setAccountsPayable((current) =>
          current.map((item) => {
            if (item.id !== linked.id) return item;
            const amount = updated.amount || 0;
            return {
              ...item,
              description: updated.description,
              supplier: updated.supplier || "Fornecedor a confirmar",
              category: updated.expenseType || updated.category,
              costCenter: updated.costCenter || "A classificar",
              competenceMonth: updated.competenceMonth,
              dueDate: updated.dueDate || item.dueDate,
              amount,
              finalAmount:
                amount + item.interest + item.penalty - item.discount,
              paymentMethod: updated.paymentMethod || "A definir",
              bankAccountId: updated.bankAccountId || "",
              recurrence: updated.recurrence || "Nenhuma",
              documentNumber: updated.documentNumber || "",
              notes: updated.notes || "Lançamento avulso.",
              updatedAt: new Date().toISOString(),
            };
          }),
        );
      }
    }

    setDocuments((current) =>
      current.map((item) => (item.id === id ? updated : item)),
    );
    createAuditLog(
      isManualLaunch && document.status === "Lançado"
        ? "EDITAR_LANCAMENTO_AVULSO"
        : "AJUSTAR_PRE_LANCAMENTO",
      "Document",
      id,
      document.companyId,
      document,
      updated,
    );
    return true;
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
    if (
      !document ||
      document.relatedEntityId ||
      document.purpose === "VIEW_ONLY" ||
      document.status === "Compartilhado"
    )
      return;

    const dueDate = document.dueDate || document.uploadedAt.slice(0, 10);
    const slices = buildInstallmentSlices(
      document.amount || 0,
      dueDate,
      document.competenceMonth,
      document.recurrence || "Nenhuma",
      document.installmentCount,
    );
    const baseDescription =
      document.description || document.aiSummary || document.name;

    const payables: AccountPayable[] = slices.map((slice, index) => ({
      id: `ap-doc-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      companyId: document.companyId,
      description: `${baseDescription}${slice.descriptionSuffix}`,
      supplier: document.supplier || "Fornecedor a confirmar",
      category: document.expenseType || document.category,
      costCenter: document.costCenter || "A classificar",
      competenceMonth: slice.competenceMonth,
      issueDate: document.uploadedAt.slice(0, 10),
      dueDate: slice.dueDate,
      amount: slice.amount,
      interest: 0,
      penalty: 0,
      discount: 0,
      finalAmount: slice.amount,
      paymentMethod: document.paymentMethod || "A definir",
      bankAccountId: document.bankAccountId || "",
      recurrence: document.recurrence || "Nenhuma",
      installmentGroupId: slice.installmentGroupId,
      installmentNumber: slice.installmentNumber,
      installmentCount: slice.installmentCount,
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
    }));

    setAccountsPayable((prev) => [...prev, ...payables]);
    setDocuments((prev) =>
      prev.map((item) =>
        item.id === documentId
          ? {
              ...item,
              ...updates,
              status: "Lançado",
              relatedEntityId: payables[0].id,
              launchedById: currentUser.id,
              launchedByName: currentUser.name,
              launchedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
    payables.forEach((payable) =>
      createAuditLog(
        "LANCAR_DOCUMENTO_FINANCEIRO",
        "AccountPayable",
        payable.id,
        document.companyId,
        null,
        payable,
      ),
    );
  };

  // Constrói uma ou várias (se recurrence === "Parcelada") AccountReceivable
  // a partir de um documento/lançamento avulso do tipo "Conta a Receber".
  // Compartilhado por launchDocument e createStandaloneLaunch.
  const buildReceivablesFromDocumentLike = (
    document: Document,
    defaultNotes = "Lançamento originado pela Central de Documentos.",
  ): AccountReceivable[] => {
    const now = new Date().toISOString();
    const dueDate = document.dueDate || now.slice(0, 10);
    const slices = buildInstallmentSlices(
      document.amount || 0,
      dueDate,
      document.competenceMonth,
      document.recurrence || "Nenhuma",
      document.installmentCount,
    );
    return slices.map((slice, index) => ({
      id: `ar-doc-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      companyId: document.companyId,
      description: `${document.description}${slice.descriptionSuffix}`,
      customer: document.supplier || "Cliente a confirmar",
      category: document.expenseType || document.category,
      costCenter: document.costCenter || "A classificar",
      competenceMonth: slice.competenceMonth,
      issueDate: now.slice(0, 10),
      dueDate: slice.dueDate,
      amount: slice.amount,
      interest: 0,
      penalty: 0,
      discount: 0,
      receivedAmount: 0,
      paymentMethod: document.paymentMethod || "A definir",
      bankAccountId: document.bankAccountId || "",
      recurrence: document.recurrence || "Nenhuma",
      installmentGroupId: slice.installmentGroupId,
      installmentNumber: slice.installmentNumber,
      installmentCount: slice.installmentCount,
      documentNumber: document.documentNumber || "",
      notes: document.notes || defaultNotes,
      status: "A receber",
      responsibleId: currentUser.id,
      createdAt: now,
      updatedAt: now,
    }));
  };

  const launchDocument = (id: string, updates: Partial<Document> = {}) => {
    const current = documents.find((item) => item.id === id);
    if (
      !current ||
      current.purpose === "VIEW_ONLY" ||
      current.status === "Compartilhado"
    )
      return;
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
      const receivables = buildReceivablesFromDocumentLike(document);
      const now = new Date().toISOString();
      setAccountsReceivable((prev) => [...prev, ...receivables]);
      setDocuments((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                ...updates,
                status: "Lançado",
                relatedEntityId: receivables[0].id,
                launchedById: currentUser.id,
                launchedByName: currentUser.name,
                launchedAt: now,
              }
            : item,
        ),
      );
      receivables.forEach((receivable) =>
        createAuditLog(
          "LANCAR_DOCUMENTO_RECEBER",
          "AccountReceivable",
          receivable.id,
          document.companyId,
          null,
          receivable,
        ),
      );
      return;
    }
    createPayableFromDocument(id, updates);
  };

  const submitDocumentForApproval = (
    id: string,
    updates: Partial<Document> = {},
    recipientId?: string,
  ) => {
    const currentDocument = documents.find((item) => item.id === id);
    const document = currentDocument
      ? { ...currentDocument, ...updates }
      : undefined;
    const recipient = users.find(
      (user) =>
        user.id === recipientId &&
        user.status === "ACTIVE" &&
        user.role === "CLIENT" &&
        user.companies?.includes(document?.companyId || ""),
    );
    if (
      !document ||
      document.status !== "Aguardando Análise" ||
      document.origin === "Manual" ||
      document.mimeType === "application/x-manual-entry" ||
      document.purpose === "VIEW_ONLY" ||
      document.companyId !== activeCompany?.id ||
      !["BPO_ADMIN", "BPO_TEAM"].includes(currentUser.role) ||
      !recipient
    )
      return false;
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
      requesterRole: currentUser.role,
      recipientId: recipient.id,
      recipientName: recipient.name,
      recipientRole: recipient.role as Approval["recipientRole"],
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
        item.id === id
          ? {
              ...item,
              ...updates,
              status: "Aguardando Aprovação",
              recipientId: recipient.id,
              recipientName: recipient.name,
              recipientRole: recipient.role as Document["recipientRole"],
              sharedById: currentUser.id,
              sharedByName: currentUser.name,
              sharedByRole: currentUser.role as Document["sharedByRole"],
              sharedAt: approval.createdAt,
            }
          : item,
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
      "Documento recebido do BPO",
      `${currentUser.name} enviou "${document.name}" para sua aprovação.`,
      "ALERT",
      recipient.id,
      document.companyId,
    );
    addNotification(
      "Documento enviado para aprovação",
      `O pré-lançamento de "${document.name}" foi enviado para ${recipient.name}.`,
      "SUCCESS",
      currentUser.id,
      document.companyId,
    );
    return true;
  };

  const cancelDocument = (id: string) => {
    const document = documents.find((item) => item.id === id);
    if (
      !document ||
      document.companyId !== activeCompany?.id ||
      document.status === "Cancelado" ||
      document.purpose === "VIEW_ONLY" ||
      document.status === "Compartilhado" ||
      !["BPO_ADMIN", "BPO_TEAM"].includes(currentUser.role)
    )
      return false;

    const isManualLaunch =
      document.origin === "Manual" ||
      document.mimeType === "application/x-manual-entry";
    if (isManualLaunch && document.status === "Lançado") {
      if (document.entryType === "Conta a Receber") {
        const linked = accountsReceivable.find(
          (item) => item.id === document.relatedEntityId,
        );
        if (!linked || linked.receivedAmount > 0) return false;
        setAccountsReceivable((current) =>
          current.map((item) =>
            item.id === linked.id
              ? {
                  ...item,
                  status: "Cancelado",
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
        );
      } else if (document.entryType === "Transferência") {
        if (
          !document.bankAccountId ||
          !document.destinationBankAccountId ||
          !bankAccounts.some(
            (account) => account.id === document.bankAccountId,
          ) ||
          !bankAccounts.some(
            (account) => account.id === document.destinationBankAccountId,
          )
        )
          return false;
        setBankAccounts((current) =>
          current.map((account) =>
            account.id === document.bankAccountId
              ? { ...account, balance: account.balance + (document.amount || 0) }
              : account.id === document.destinationBankAccountId
                ? {
                    ...account,
                    balance: account.balance - (document.amount || 0),
                  }
                : account,
          ),
        );
      } else {
        const linked = accountsPayable.find(
          (item) => item.id === document.relatedEntityId,
        );
        if (!linked || linked.status === "Paga") return false;
        setAccountsPayable((current) =>
          current.map((item) =>
            item.id === linked.id
              ? {
                  ...item,
                  status: "Cancelada",
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
        );
      }
    }

    setDocuments((current) =>
      current.map((item) =>
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
    createAuditLog(
      isManualLaunch
        ? "CANCELAR_LANCAMENTO_AVULSO"
        : "CANCELAR_PRE_LANCAMENTO",
      "Document",
      id,
      document.companyId,
      document,
      { ...document, status: "Cancelado" },
    );
    addNotification(
      isManualLaunch ? "Lançamento avulso cancelado" : "Documento cancelado",
      `O registro "${document.description || document.name}" foi cancelado.`,
      "WARNING",
      currentUser.id,
      document.companyId,
    );
    return true;
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
      installmentCount: data.installmentCount,
      notes: data.notes,
      origin: "Manual",
      launchedById: currentUser.id,
      launchedByName: currentUser.name,
      launchedAt: now,
    };
    setDocuments((prev) => [...prev, document]);
    if (document.entryType === "Conta a Receber") {
      const receivables = buildReceivablesFromDocumentLike(
        document,
        "Lançamento avulso.",
      );
      setAccountsReceivable((prev) => [...prev, ...receivables]);
      setDocuments((prev) =>
        prev.map((item) =>
          item.id === documentId
            ? { ...item, relatedEntityId: receivables[0].id }
            : item,
        ),
      );
      receivables.forEach((receivable) =>
        createAuditLog(
          "CRIAR_CONTA_RECEBER_AVULSA",
          "AccountReceivable",
          receivable.id,
          activeCompanyId,
          null,
          receivable,
        ),
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

  const deleteSupportTicket = (ticketId: string): boolean => {
    if (currentUser.role !== "BPO_ADMIN") return false;

    const ticket = supportTickets.find((item) => item.id === ticketId);
    if (!ticket) return false;

    createAuditLog(
      "EXCLUIR_REQUERIMENTO_BPO",
      "SupportTicket",
      ticketId,
      ticket.companyId,
      {
        protocol: ticket.protocol,
        subject: ticket.subject,
        requesterId: ticket.requesterId,
        status: ticket.status,
        messageCount: ticket.messages.length,
        attachmentCount: ticket.messages.reduce(
          (total, message) => total + (message.attachments?.length || 0),
          0,
        ),
      },
      null,
    );
    setSupportTickets((previous) =>
      previous.filter((item) => item.id !== ticketId),
    );
    return true;
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
        documents: documentsVisibleToCurrentUser,
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
        isApprovalVisibleToCurrentUser,
        canDecideApproval,
        addMasterData,
        updateMasterData,
        deleteMasterData,
        addBankAccount,
        updateBankAccount,
        deleteBankAccount,
        ensureBolsaAccount,
        applyBakeryBankMovement,
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
        deleteCompany,
        updateCompanyStatus,
        addTeamMember,
        updateTeamMemberPermissions,
        updateTeamMember,
        deleteTeamMember,
        addNotification,
        markNotificationRead,
        clearNotifications,
        createSupportTicket,
        addSupportMessage,
        updateSupportTicket,
        deleteSupportTicket,
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
