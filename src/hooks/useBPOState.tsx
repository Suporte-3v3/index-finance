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
  ReportGenerationOptions,
  ReportTemplate,
  ReportModelType,
  ReportBlockConfig,
  ReportFilters,
  ReportExportFormat,
  DreReportOptions,
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
} from "../services/mockData";
import {
  AuthenticationError,
  AuthProfile,
  changeCurrentPassword,
  getCurrentAuthProfile,
  signInWithEmail,
  signOutCurrentSession,
  toApplicationUser,
} from "../services/auth";
import {
  createReportArtifact,
  ReportCell,
  ReportSectionData,
} from "../services/reportFiles";
import { formatBrazilianDate } from "../services/reportFormatters";
import { convertCompanyLogoToPng } from "../services/companyBranding";
import {
  computeReportSections,
  computeDreSections,
  buildFiltersSummary,
} from "../services/reportComputations";
import { getDocumentsVisibleToUser } from "../services/documentVisibility";
import {
  CompanyServiceError,
  createPersistedCompany,
  deactivatePersistedCompany,
  fetchCompanyWorkspace,
  updatePersistedCompany,
} from "../services/companies";
import {
  UserServiceError,
  createPersistedUser,
  deactivatePersistedUser,
  fetchManagedUsers,
  resetPersistedUserPassword,
  updatePersistedUser,
} from "../services/users";
import {
  adjustPersistedBankBalance,
  adjustPersistedBankBalances,
  createPersistedBankAccount,
  createPersistedMasterData,
  deactivatePersistedBankAccount,
  deactivatePersistedMasterData,
  ensurePersistedBolsaAccount,
  fetchFinancialSetup,
  updatePersistedBankAccount,
  updatePersistedMasterData,
} from "../services/financialSetup";
import {
  cancelPersistedPayable,
  cancelPersistedReceivable,
  createPersistedPayables,
  createPersistedReceivables,
  decidePersistedPaymentApproval,
  fetchFinancialEntries,
  payPersistedPayable,
  receivePersistedReceivable,
  schedulePersistedPayable,
  updatePersistedPayable,
  updatePersistedReceivable,
} from "../services/financialEntries";
import {
  ImportEntriesResult,
  submitImportEntries,
} from "../services/financialEntriesImport";
import {
  createPersistedDocument,
  decidePersistedDocumentApproval,
  deletePersistedDocument,
  fetchDocumentRecords,
  requestPersistedDocumentApproval,
  updatePersistedDocument,
} from "../services/documentRecords";
import {
  autoReconcilePersistedStatements,
  fetchStatementEntries,
  ignorePersistedStatementItem,
  importPersistedStatement,
  reconcilePersistedStatementItem,
} from "../services/reconciliation";
import { fetchAuditLogs } from "../services/auditLogs";
import {
  fetchNotifications,
  markAllPersistedNotificationsRead,
  markPersistedNotificationRead,
} from "../services/notifications";
import {
  createPersistedReport,
  createPersistedReportTemplate,
  deletePersistedReport,
  deletePersistedReportTemplate,
  duplicatePersistedReportTemplate,
  fetchReportTemplates,
  fetchReports,
  updatePersistedReportTemplate,
} from "../services/reports";
import {
  addPersistedSupportMessage,
  createPersistedSupportTicket,
  deletePersistedSupportTicket,
  fetchSupportTickets,
  updatePersistedSupportTicket,
} from "../services/supportTickets";

const PRIMARY_USER_ID = "u-client-admin";
const USER_STORAGE_VERSION = "professional-users-v2";
const LEGACY_DEMO_USER_IDS = new Set([
  "u-bpo-admin",
  "u-bpo-analyst",
  "u-client-sabor",
  "u-accountant",
]);

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

const companyAuditSnapshot = (company: Company) => {
  const { logoDataUrl: _logoDataUrl, ...companyData } = company;
  void _logoDataUrl;
  return {
    ...companyData,
    hasCustomLogo: Boolean(company.logoDataUrl),
  };
};

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
  reportTemplates: ReportTemplate[];
  statementItems: Record<string, BankStatementItem[]>;
  supportTickets: SupportTicket[];
  isUserOnline: (userId: string) => boolean;

  currentUser: User;
  activeCompany: Company | null;
  activeTenant: Tenant | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  mustChangePassword: boolean;

  // Controls
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<{ success: boolean; error?: string }>;
  switchCompany: (companyId: string) => void;
  hasPermission: (permission: string) => boolean;
  isApprovalVisibleToCurrentUser: (approval: Approval) => boolean;
  canDecideApproval: (approval: Approval) => boolean;
  addMasterData: (
    type: MasterDataType,
    name: string,
    parentId?: string,
  ) => Promise<MasterDataOption>;
  updateMasterData: (
    id: string,
    updates: Partial<Pick<MasterDataOption, "name" | "parentId" | "active">>,
  ) => Promise<MasterDataOption>;
  deleteMasterData: (id: string) => Promise<void>;
  addBankAccount: (
    data: Omit<BankAccount, "id" | "companyId">,
  ) => Promise<BankAccount>;
  updateBankAccount: (
    id: string,
    updates: Partial<Omit<BankAccount, "id" | "companyId">>,
  ) => Promise<BankAccount>;
  deleteBankAccount: (id: string) => Promise<void>;
  ensureBolsaAccount: (companyId: string) => Promise<BankAccount>;
  applyBakeryBankMovement: (
    bankAccountId: string,
    delta: number,
    meta: { action: string; entityType: string; entityId: string },
  ) => Promise<BankAccount>;

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
  ) => Promise<{ success: boolean; error?: string }>;
  updateAccountPayable: (
    id: string,
    updates: Partial<AccountPayable>,
  ) => Promise<{ success: boolean; error?: string }>;
  cancelAccountPayable: (id: string) => Promise<{ success: boolean; error?: string }>;
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
  }) => Promise<{ success: boolean; error?: string }>;
  scheduleAccountPayable: (id: string) => Promise<{ success: boolean; error?: string }>;

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
  ) => Promise<{ success: boolean; error?: string }>;
  updateAccountReceivable: (
    id: string,
    updates: Partial<AccountReceivable>,
  ) => Promise<{ success: boolean; error?: string }>;
  cancelAccountReceivable: (id: string) => Promise<{ success: boolean; error?: string }>;
  receiveAccountReceivable: (id: string, amount: number, date: string) => Promise<{ success: boolean; error?: string }>;
  importFinancialEntries: (
    companyId: string,
    entries: unknown[],
  ) => Promise<{ success: boolean; result?: ImportEntriesResult; error?: string }>;

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
  }) => Promise<void>;
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

  importStatement: (bankAccountId: string, entries: BankStatementItem[]) => void;
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
  generateBuiltReport: (input: {
    modelType: ReportModelType;
    name: string;
    blocks: ReportBlockConfig[];
    filters: ReportFilters;
    dreOptions?: DreReportOptions;
    notes?: string;
    orientation?: "auto" | "portrait" | "landscape";
    format: ReportExportFormat;
    templateId?: string;
    templateName?: string;
    recipientId?: string;
  }) => ReportRecord | null;
  saveReportTemplate: (input: {
    id?: string;
    name: string;
    modelType: ReportModelType;
    blocks: ReportBlockConfig[];
    filters: Omit<ReportFilters, "startDate" | "endDate">;
    dreOptions?: DreReportOptions;
    notes?: string;
    orientation?: "auto" | "portrait" | "landscape";
  }) => ReportTemplate | null;
  duplicateReportTemplate: (id: string) => void;
  archiveReportTemplate: (id: string, archived: boolean) => void;
  toggleReportTemplateFavorite: (id: string) => void;
  deleteReportTemplate: (id: string) => void;
  sendReportToDocumentCenter: (
    report: ReportRecord,
    recipientId?: string,
  ) => boolean;

  addCompany: (
    data: Omit<Company, "id" | "createdAt" | "status">,
    onboarding: CompanyOnboardingData,
  ) => Promise<CompanyCreationResult>;
  updateCompany: (
    id: string,
    updates: Partial<Omit<Company, "id" | "createdAt" | "tenantId">>,
  ) => Promise<CompanyCreationResult>;
  deleteCompany: (id: string) => Promise<CompanyCreationResult>;
  updateCompanyStatus: (
    id: string,
    status: Company["status"],
  ) => Promise<CompanyCreationResult>;

  addTeamMember: (
    data: Omit<User, "id">,
  ) => Promise<{
    success: boolean;
    error?: string;
    temporaryPassword?: string;
  }>;
  updateTeamMemberPermissions: (
    id: string,
    permissions: string[],
    status?: "ACTIVE" | "INACTIVE",
    companies?: string[],
    clientOperator?: boolean,
  ) => Promise<{ success: boolean; error?: string }>;
  updateTeamMember: (
    id: string,
    updates: {
      name?: string;
      email?: string;
      title?: string;
      role?: UserRole;
    },
  ) => Promise<{ success: boolean; error?: string }>;
  deleteTeamMember: (
    id: string,
  ) => Promise<{ success: boolean; error?: string }>;
  resetTeamMemberPassword: (
    id: string,
  ) => Promise<{
    success: boolean;
    error?: string;
    temporaryPassword?: string;
  }>;
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

  useEffect(() => {
    const legacyLogos = companies.filter((company) =>
      company.logoDataUrl?.startsWith("data:image/webp"),
    );
    if (!legacyLogos.length) return;
    let cancelled = false;
    void Promise.all(
      legacyLogos.map(async (company) => ({
        companyId: company.id,
        original: company.logoDataUrl,
        converted: await convertCompanyLogoToPng(company.logoDataUrl!),
      })),
    )
      .then((convertedLogos) => {
        if (cancelled) return;
        setCompanies((current) =>
          current.map((company) => {
            const conversion = convertedLogos.find(
              (item) => item.companyId === company.id,
            );
            return conversion && company.logoDataUrl === conversion.original
              ? { ...company, logoDataUrl: conversion.converted }
              : company;
          }),
        );
      })
      .catch(() => {
        // A logo antiga continua disponível no menu; o usuário pode reenviá-la
        // caso o navegador não consiga convertê-la automaticamente.
      });
    return () => {
      cancelled = true;
    };
  }, [companies]);
  const [users, setUsers] = useState<User[]>(() => {
    const storedUsers = loadState<Array<User & { password?: string }>>(
      "users",
      INITIAL_USERS,
    ).map(({ password: _legacyPassword, ...user }) => user);
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
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [reportTemplates, setReportTemplates] = useState<ReportTemplate[]>([]);
  const [statementItems, setStatementItems] = useState<
    Record<string, BankStatementItem[]>
  >({});
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authProfile, setAuthProfile] = useState<AuthProfile | null>(null);
  const mustChangePassword = Boolean(authProfile?.mustChangePassword);

  const applyAuthenticatedProfile = (
    profile: AuthProfile,
    authenticatedCompanies = companies,
    authenticatedTenants = tenants,
    authenticatedUsers?: User[],
    authenticatedBankAccounts?: BankAccount[],
    authenticatedMasterData?: MasterDataOption[],
    authenticatedPayables?: AccountPayable[],
    authenticatedReceivables?: AccountReceivable[],
    authenticatedPaymentApprovals?: Approval[],
    authenticatedDocuments?: Document[],
    authenticatedDocumentApprovals?: Approval[],
    authenticatedStatementItems?: Record<string, BankStatementItem[]>,
    authenticatedAuditLogs?: AuditLog[],
    authenticatedNotifications?: Notification[],
    authenticatedReports?: ReportRecord[],
    authenticatedReportTemplates?: ReportTemplate[],
    authenticatedSupportTickets?: SupportTicket[],
  ): User => {
    const unscopedUser = toApplicationUser(profile, authenticatedCompanies);
    const allowedCompanyIds = unscopedUser.companies || [];
    const preferredCompanyId = allowedCompanyIds.includes(activeCompanyId)
      ? activeCompanyId
      : allowedCompanyIds[0] || "";
    const authenticatedUser = toApplicationUser(
      profile,
      authenticatedCompanies,
      preferredCompanyId,
    );

    setCompanies(authenticatedCompanies);
    setTenants(authenticatedTenants);
    if (authenticatedBankAccounts) setBankAccounts(authenticatedBankAccounts);
    if (authenticatedMasterData) setMasterData(authenticatedMasterData);
    if (authenticatedPayables) setAccountsPayable(authenticatedPayables);
    if (authenticatedReceivables) setAccountsReceivable(authenticatedReceivables);
    if (authenticatedDocuments) setDocuments(authenticatedDocuments);
    if (authenticatedStatementItems) setStatementItems(authenticatedStatementItems);
    if (authenticatedAuditLogs) setAuditLogs(authenticatedAuditLogs);
    if (authenticatedNotifications) setNotifications(authenticatedNotifications);
    if (authenticatedReports) setReports(authenticatedReports);
    if (authenticatedReportTemplates) setReportTemplates(authenticatedReportTemplates);
    if (authenticatedSupportTickets) setSupportTickets(authenticatedSupportTickets);
    if (authenticatedPaymentApprovals) {
      setApprovals((current) => [
        ...current.filter((approval) => approval.type !== "PAGAMENTO"),
        ...authenticatedPaymentApprovals,
      ]);
    }
    if (authenticatedDocumentApprovals) {
      setApprovals((current) => [
        ...current.filter((approval) => approval.type !== "DOCUMENTO"),
        ...authenticatedDocumentApprovals,
      ]);
    }
    setAuthProfile(profile);
    setUsers((current) => {
      const source = authenticatedUsers || current;
      const existingIndex = source.findIndex(({ id }) => id === profile.id);
      if (existingIndex < 0) return [...source, authenticatedUser];
      return source.map((user, index) =>
        index === existingIndex ? authenticatedUser : user,
      );
    });
    setCurrentUserId(profile.id);
    if (preferredCompanyId) setActiveCompanyId(preferredCompanyId);
    setIsAuthenticated(true);
    return authenticatedUser;
  };

  const loadWorkspaceForProfile = async (profile: AuthProfile) => {
    if (profile.mustChangePassword) {
      return {
        companies: [] as Company[],
        tenants: [] as Tenant[],
        users: [] as User[],
        bankAccounts: [] as BankAccount[],
        masterData: [] as MasterDataOption[],
        accountsPayable: [] as AccountPayable[],
        accountsReceivable: [] as AccountReceivable[],
        paymentApprovals: [] as Approval[],
        documents: [] as Document[],
        documentApprovals: [] as Approval[],
        statementItems: {} as Record<string, BankStatementItem[]>,
        auditLogs: [] as AuditLog[],
        notifications: [] as Notification[],
        reports: [] as ReportRecord[],
        reportTemplates: [] as ReportTemplate[],
        supportTickets: [] as SupportTicket[],
      };
    }
    const canManageUsers =
      profile.isPlatformAdmin ||
      profile.tenantMemberships.some(({ role }) => role === "BPO_ADMIN");
    const isAuditor =
      profile.isPlatformAdmin ||
      profile.tenantMemberships.some(({ role }) => role === "BPO_ADMIN");
    const [
      workspace,
      managedUsers,
      financialSetup,
      financialEntries,
      documentRecords,
      reconciliation,
      auditLogs,
      notifications,
      reports,
      reportTemplates,
      supportTickets,
    ] = await Promise.all([
      fetchCompanyWorkspace(),
      canManageUsers ? fetchManagedUsers() : Promise.resolve({ users: [] }),
      fetchFinancialSetup(),
      fetchFinancialEntries(),
      fetchDocumentRecords(),
      fetchStatementEntries(),
      isAuditor ? fetchAuditLogs() : Promise.resolve([] as AuditLog[]),
      fetchNotifications(),
      fetchReports(),
      fetchReportTemplates(),
      fetchSupportTickets(),
    ]);
    return {
      ...workspace,
      users: managedUsers.users,
      ...financialSetup,
      ...financialEntries,
      ...documentRecords,
      ...reconciliation,
      auditLogs,
      notifications,
      reports,
      reportTemplates,
      supportTickets,
    };
  };

  useEffect(() => {
    let cancelled = false;
    localStorage.removeItem("bpo_saas_isAuthenticated");

    void getCurrentAuthProfile()
      .then((profile) => {
        if (cancelled) return;
        if (profile) {
          return loadWorkspaceForProfile(profile).then((workspace) => {
            if (!cancelled) {
              applyAuthenticatedProfile(
                profile,
                workspace.companies,
                workspace.tenants,
                workspace.users,
                workspace.bankAccounts,
                workspace.masterData,
                workspace.accountsPayable,
                workspace.accountsReceivable,
                workspace.paymentApprovals,
                workspace.documents,
                workspace.documentApprovals,
                workspace.statementItems,
                workspace.auditLogs,
                workspace.notifications,
                workspace.reports,
                workspace.reportTemplates,
                workspace.supportTickets,
              );
            }
          });
        }
        else {
          setAuthProfile(null);
          setIsAuthenticated(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error(
            "Session restoration failed:",
            error instanceof Error ? error.message : error,
          );
          setAuthProfile(null);
          setIsAuthenticated(false);
        }
      })
      .finally(() => {
        if (!cancelled) setIsAuthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
    localStorage.setItem(
      "bpo_saas_currentUserId",
      JSON.stringify(currentUserId),
    );
    localStorage.setItem(
      "bpo_saas_activeCompanyId",
      JSON.stringify(activeCompanyId),
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
    statementItems,
    currentUserId,
    activeCompanyId,
  ]);

  // Derived current user, active company, and tenant
  const storedCurrentUser =
    users.find((u) => u.id === currentUserId) || users[0];
  const currentUser =
    authProfile && storedCurrentUser.id === authProfile.id
      ? toApplicationUser(authProfile, companies, activeCompanyId)
      : storedCurrentUser;
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
    : authProfile
      ? tenants.find((tenant) =>
          authProfile.tenantMemberships.some(
            ({ tenantId }) => tenantId === tenant.id,
          ),
        ) || tenants[0] || null
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
  const login = async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const profile = await signInWithEmail(email, password);
      const workspace = await loadWorkspaceForProfile(profile);
      const targetUser = applyAuthenticatedProfile(
        profile,
        workspace.companies,
        workspace.tenants,
        workspace.users,
        workspace.bankAccounts,
        workspace.masterData,
        workspace.accountsPayable,
        workspace.accountsReceivable,
        workspace.paymentApprovals,
        workspace.documents,
        workspace.documentApprovals,
        workspace.statementItems,
        workspace.auditLogs,
        workspace.notifications,
        workspace.reports,
        workspace.reportTemplates,
        workspace.supportTickets,
      );

      const newLog: AuditLog = {
        id: `log-${Date.now()}`,
        tenantId:
          companies.find((c) => targetUser.companies?.includes(c.id))
            ?.tenantId || profile.tenantMemberships[0]?.tenantId || "",
        userId: targetUser.id,
        userName: targetUser.name,
        role: targetUser.role,
        action: "SESSAO_LOGIN",
        entityType: "User",
        entityId: targetUser.id,
        timestamp: new Date().toISOString(),
        ipAddress: "Gerenciado pelo servidor",
        userAgent: navigator.userAgent,
        origin: "Tela de Login",
      };
      setAuditLogs((prev) => [newLog, ...prev]);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof AuthenticationError
            ? error.message
            : error instanceof CompanyServiceError
              ? error.message
            : "Não foi possível entrar. Tente novamente.",
      };
    }
  };

  const logout = async () => {
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
      ipAddress: "Gerenciado pelo servidor",
      userAgent: navigator.userAgent,
      origin: "Workspace",
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    const presence = readPresence();
    delete presence[currentUser.id];
    localStorage.setItem(presenceKey, JSON.stringify(presence));
    try {
      await signOutCurrentSession();
    } catch (error) {
      console.error(
        "Sign-out failed:",
        error instanceof Error ? error.message : error,
      );
    } finally {
      setAuthProfile(null);
      setIsAuthenticated(false);
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await changeCurrentPassword(currentPassword, newPassword);
      if (!authProfile) throw new AuthenticationError("Sessão não encontrada.");
      const updatedProfile = { ...authProfile, mustChangePassword: false };
      const workspace = await loadWorkspaceForProfile(updatedProfile);
      applyAuthenticatedProfile(
        updatedProfile,
        workspace.companies,
        workspace.tenants,
        workspace.users,
        workspace.bankAccounts,
        workspace.masterData,
        workspace.accountsPayable,
        workspace.accountsReceivable,
        workspace.paymentApprovals,
        workspace.documents,
        workspace.documentApprovals,
        workspace.statementItems,
        workspace.auditLogs,
        workspace.notifications,
        workspace.reports,
        workspace.reportTemplates,
        workspace.supportTickets,
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof AuthenticationError
            ? error.message
            : "Não foi possível alterar a senha.",
      };
    }
  };

  // The backend now writes the canonical audit trail itself (in the same
  // transaction as the action being audited). This client-side helper is kept
  // as a no-op so the many existing call sites don't need to be touched.
  const createAuditLog = (
    _action: string,
    _entityType: string,
    _entityId: string,
    _companyId?: string,
    _prevData?: any,
    _nextData?: any,
  ) => {};

  const refreshNotifications = () => {
    if (!isAuthenticated) return;
    void fetchNotifications()
      .then(setNotifications)
      .catch((error) =>
        console.error("Failed to refresh notifications:", error instanceof Error ? error.message : error),
      );
  };

  // Business actions that persist server-side already create their
  // notification there too; this helper just re-fetches the up-to-date list
  // instead of fabricating a local-only entry.
  const addNotification = (
    _title: string,
    _message: string,
    _type: Notification["type"],
    _userId?: string,
    _companyId: string = activeCompanyId,
  ) => {
    refreshNotifications();
  };

  const markNotificationRead = (id: string) => {
    void markPersistedNotificationRead(id)
      .then((updated) =>
        setNotifications((prev) =>
          prev.map((notification) => (notification.id === updated.id ? updated : notification)),
        ),
      )
      .catch((error) =>
        console.error("Failed to mark notification as read:", error instanceof Error ? error.message : error),
      );
  };

  const clearNotifications = () => {
    void markAllPersistedNotificationsRead()
      .then(setNotifications)
      .catch((error) =>
        console.error("Failed to mark notifications as read:", error instanceof Error ? error.message : error),
      );
  };

  const addMasterData = (
    type: MasterDataType,
    name: string,
    parentId?: string,
  ) => createPersistedMasterData(activeCompanyId, type, name, parentId).then((item) => {
    setMasterData((prev) => [
      ...prev.filter((existing) => existing.id !== item.id),
      item,
    ]);
    createAuditLog(
      "CRIAR_CADASTRO_MESTRE",
      "MasterData",
      item.id,
      activeCompanyId,
      null,
      item,
    );
    return item;
  });
  const updateMasterData = (
    id: string,
    updates: Partial<Pick<MasterDataOption, "name" | "parentId" | "active">>,
  ) => updatePersistedMasterData(id, updates).then((updated) => {
    setMasterData((prev) =>
      prev.map((item) => (item.id === id ? updated : item)),
    );
    return updated;
  });
  const deleteMasterData = async (id: string) => {
    await deactivatePersistedMasterData(id);
    setMasterData((prev) =>
      prev.map((item) =>
        item.id === id || item.parentId === id ? { ...item, active: false } : item,
      ),
    );
  };
  const addBankAccount = (data: Omit<BankAccount, "id" | "companyId">) =>
    createPersistedBankAccount(activeCompanyId, data).then((account) => {
      setBankAccounts((prev) => [...prev, account]);
      createAuditLog(
        "CRIAR_CONTA_BANCARIA",
        "BankAccount",
        account.id,
        activeCompanyId,
        null,
        account,
      );
      return account;
    });
  const deleteBankAccount = async (id: string) => {
    await deactivatePersistedBankAccount(id);
    setBankAccounts((prev) => prev.filter((account) => account.id !== id));
  };
  const updateBankAccount = (
    id: string,
    updates: Partial<Omit<BankAccount, "id" | "companyId">>,
  ) => updatePersistedBankAccount(id, updates).then((updated) => {
    setBankAccounts((prev) =>
      prev.map((account) => (account.id === id ? updated : account)),
    );
    return updated;
  });

  // Conta interna "Bolsa" usada pelo módulo Caixa da Padaria — criada sob
  // demanda, uma por empresa, sem depender das telas de cadastro de bancos.
  const ensureBolsaAccount = (companyId: string) =>
    ensurePersistedBolsaAccount(companyId).then((account) => {
      setBankAccounts((prev) =>
        prev.some((existing) => existing.id === account.id)
          ? prev.map((existing) => (existing.id === account.id ? account : existing))
          : [...prev, account],
      );
      return account;
    });

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
  ) => adjustPersistedBankBalance(bankAccountId, delta, meta).then((updated) => {
    setBankAccounts((prev) => {
      const existing = prev.find((account) => account.id === bankAccountId);
      if (!existing) return prev;
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
    return updated;
  });

  const persistBankBalanceChanges = (
    movements: Array<{ accountId: string; delta: number }>,
    meta: { action: string; entityType: string; entityId: string },
  ) => {
    void adjustPersistedBankBalances(movements, meta)
      .then((updatedAccounts) => {
        const updates = new Map(updatedAccounts.map((account) => [account.id, account]));
        setBankAccounts((current) =>
          current.map((account) => updates.get(account.id) || account),
        );
      })
      .catch((error) => {
        console.error("Falha ao persistir saldos bancários:", error);
      });
  };

  // --- ACCOUNTS PAYABLE ACTIONS ---
  const addAccountPayable: BPOContextType["addAccountPayable"] = async (data) => {
    if (!hasPermission("accounts-payable.create")) {
      return { success: false, error: "Você não tem permissão para criar contas a pagar." };
    }
    try {
      const result = await createPersistedPayables(activeCompanyId, data);
      setAccountsPayable((current) => [...current, ...result.payables]);
      if (result.approvals.length) {
        setApprovals((current) => [...current, ...result.approvals]);
      }
      addNotification(
        result.payables.length > 1 ? "Compra Parcelada Cadastrada" : "Conta a Pagar Cadastrada",
        `${result.payables.length > 1 ? `${result.payables.length} parcelas cadastradas` : "Novo título cadastrado"} para "${data.supplier}" no PostgreSQL.`,
        result.approvals.length ? "ALERT" : "INFO",
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Não foi possível cadastrar a conta a pagar." };
    }
  };

  const updateAccountPayable: BPOContextType["updateAccountPayable"] = (
    id,
    updates,
  ) => {
    if (!hasPermission("accounts-payable.update"))
      return Promise.resolve({ success: false, error: "Você não tem permissão para editar contas a pagar." });

    const existing = accountsPayable.find((p) => p.id === id);
    if (!existing) return Promise.resolve({ success: false, error: "Título não encontrado." });
    if (["Paga", "Parcialmente paga", "Cancelada"].includes(existing.status))
      return Promise.resolve({
        success: false,
        error: `Não é possível editar um título com status "${existing.status}". Use a aba de pagamento para lançar novas baixas.`,
      });

    return updatePersistedPayable(id, updates)
      .then((updated) => {
        setAccountsPayable((current) => current.map((item) => item.id === id ? updated : item));
        return { success: true };
      })
      .catch((error) => ({ success: false, error: error instanceof Error ? error.message : "Não foi possível atualizar o título." }));
  };

  const cancelAccountPayable = async (id: string) => {
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

    try {
      const updated = await cancelPersistedPayable(id);
      setAccountsPayable((current) => current.map((item) => item.id === id ? updated : item));
      setApprovals((current) => current.map((approval) =>
        approval.relatedId === id && approval.status === "Pendente"
          ? { ...approval, status: "Cancelada" }
          : approval,
      ));

      addNotification(
        "Conta a Pagar Cancelada",
        "Um registro financeiro a pagar foi cancelado e auditado.",
        "WARNING",
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Não foi possível cancelar o título." };
    }
  };

  const payAccountPayable: BPOContextType["payAccountPayable"] = async (data) => {
    const existing = accountsPayable.find((p) => p.id === data.id);
    if (!existing) return { success: false, error: "Título não encontrado." };
    if (["Paga", "Cancelada"].includes(existing.status))
      return { success: false, error: `Este título já está com status "${existing.status}".` };
    const bank = bankAccounts.find((ba) => ba.id === data.bankAccountId);
    if (!bank) return { success: false, error: "Selecione uma conta bancária válida." };
    if (!(data.amount > 0))
      return { success: false, error: "Informe um valor de pagamento válido." };

    try {
      const result = await payPersistedPayable(data.id, data);
      setAccountsPayable((current) => current.map((item) => item.id === data.id ? result.payable : item));
      setBankAccounts((current) => current.map((item) => item.id === result.bankAccount.id ? result.bankAccount : item));
      addNotification(
        result.payable.status === "Paga" ? "Pagamento Confirmado" : "Pagamento Parcial Registrado",
        `Pagamento registrado e deduzido do saldo de ${bank.bankName}.`,
        "SUCCESS",
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Não foi possível registrar o pagamento." };
    }
  };
  const scheduleAccountPayable = async (id: string) => {
    try {
      const updated = await schedulePersistedPayable(id);
      setAccountsPayable((current) => current.map((item) => item.id === id ? updated : item));
      addNotification("Pagamento Agendado", "A obrigação foi marcada como agendada.", "INFO");
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Não foi possível agendar o pagamento." };
    }
  };

  // --- ACCOUNTS RECEIVABLE ACTIONS ---
  const addAccountReceivable: BPOContextType["addAccountReceivable"] = (
    data,
  ) => {
    if (!hasPermission("accounts-receivable.create")) {
      return Promise.resolve({ success: false, error: "Você não tem permissão para criar contas a receber." });
    }
    return createPersistedReceivables(activeCompanyId, data)
      .then((created) => {
        setAccountsReceivable((current) => [...current, ...created]);
        addNotification(
          created.length > 1 ? "Faturamento Parcelado Lançado" : "Conta a Receber Lançada",
          `${created.length > 1 ? `${created.length} parcelas lançadas` : "Novo faturamento lançado"} para "${data.customer}" no PostgreSQL.`,
          "SUCCESS",
        );
        return { success: true };
      })
      .catch((error) => ({ success: false, error: error instanceof Error ? error.message : "Não foi possível cadastrar a conta a receber." }));
  };

  const updateAccountReceivable = (
    id: string,
    updates: Partial<AccountReceivable>,
  ) => {
    if (!hasPermission("accounts-receivable.update")) {
      return Promise.resolve({ success: false, error: "Você não tem permissão para editar contas a receber." });
    }
    return updatePersistedReceivable(id, updates)
      .then((updated) => {
        setAccountsReceivable((current) => current.map((item) => item.id === id ? updated : item));
        return { success: true };
      })
      .catch((error) => ({ success: false, error: error instanceof Error ? error.message : "Não foi possível atualizar o título." }));
  };

  const cancelAccountReceivable = async (id: string) => {
    if (!hasPermission("accounts-receivable.cancel")) {
      return { success: false, error: "Você não tem permissão para cancelar contas a receber." };
    }
    try {
      const updated = await cancelPersistedReceivable(id);
      setAccountsReceivable((current) => current.map((item) => item.id === id ? updated : item));
      addNotification("Conta a Receber Cancelada", "O faturamento foi cancelado no sistema.", "WARNING");
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Não foi possível cancelar o título." };
    }
  };

  const receiveAccountReceivable = (
    id: string,
    amount: number,
    date: string,
  ) => {
    return receivePersistedReceivable(id, amount, date)
      .then((result) => {
        setAccountsReceivable((current) => current.map((item) => item.id === id ? result.receivable : item));
        setBankAccounts((current) => current.map((item) => item.id === result.bankAccount.id ? result.bankAccount : item));
        addNotification(
          "Recebimento Confirmado",
          `Recebimento no valor de R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} compensado com sucesso.`,
          "SUCCESS",
        );
        return { success: true };
      })
      .catch((error) => ({ success: false, error: error instanceof Error ? error.message : "Não foi possível registrar o recebimento." }));
  };

  const importFinancialEntries: BPOContextType["importFinancialEntries"] = async (
    companyId,
    entries,
  ) => {
    if (!hasPermission("accounts-payable.create") && !hasPermission("accounts-receivable.create")) {
      return { success: false, error: "Você não tem permissão para importar lançamentos." };
    }
    try {
      const result = await submitImportEntries(companyId, entries);
      const newPayables = result.results.flatMap((item) =>
        item.success && item.type === "PAGAR" ? [item.payable] : [],
      );
      const newReceivables = result.results.flatMap((item) =>
        item.success && item.type === "RECEBER" ? [item.receivable] : [],
      );
      const newDocuments = result.results.flatMap((item) =>
        item.success && item.document ? [item.document] : [],
      );
      if (newPayables.length) setAccountsPayable((current) => [...current, ...newPayables]);
      if (newReceivables.length) setAccountsReceivable((current) => [...current, ...newReceivables]);
      if (newDocuments.length) setDocuments((current) => [...current, ...newDocuments]);
      addNotification(
        "Importação de Lançamentos",
        result.failedCount
          ? `${result.createdCount} lançamento(s) importado(s), ${result.failedCount} com falha.`
          : `${result.createdCount} lançamento(s) importado(s) com sucesso.`,
        result.failedCount ? "WARNING" : "SUCCESS",
      );
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Não foi possível importar os lançamentos." };
    }
  };

  // --- APPROVALS FLOW ---
  const decideApproval = (
    approvalId: string,
    decision: "Aprovada" | "Rejeitada" | "Ajuste solicitado",
    comment: string,
  ) => {
    const persistedTarget = approvals.find((approval) => approval.id === approvalId);
    if (
      persistedTarget?.type === "PAGAMENTO" &&
      canDecideApproval(persistedTarget)
    ) {
      void decidePersistedPaymentApproval(approvalId, decision, comment)
        .then((result) => {
          setApprovals((current) =>
            current.map((approval) =>
              approval.id === approvalId ? result.approval : approval,
            ),
          );
          setAccountsPayable((current) =>
            current.map((payable) =>
              payable.id === result.payable.id ? result.payable : payable,
            ),
          );
        })
        .catch((error) => {
          console.error("Falha ao persistir decisão de aprovação:", error);
        });
    } else if (
      persistedTarget?.type === "DOCUMENTO" &&
      canDecideApproval(persistedTarget)
    ) {
      void decidePersistedDocumentApproval(approvalId, decision, comment)
        .then((result) => {
          setApprovals((current) =>
            current.map((approval) =>
              approval.id === approvalId ? result.approval : approval,
            ),
          );
          setDocuments((current) =>
            current.map((document) =>
              document.id === result.document.id ? result.document : document,
            ),
          );
          if (decision === "Aprovada") {
            launchDocument(result.document.id);
          }
        })
        .catch((error) => {
          console.error("Falha ao persistir decisão documental:", error);
        });
    }

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
  const uploadDocument = async (data: {
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
  }): Promise<void> => {
    if (!hasPermission("documents.upload")) {
      throw new Error("Você não tem permissão para enviar documentos.");
    }

    const {
      recipientId: requestedShareRecipientId,
      approvalRecipientId: requestedApprovalRecipientId,
      ...documentData
    } = data;
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
    const result = await createPersistedDocument({
      ...documentData,
      companyId: targetCompanyId,
      recipientId: shareRecipient?.id,
      approvalRecipientId: approvalRecipient?.id,
      origin: "Documento",
    });
    setDocuments((previous) => [...previous, result.document]);
    if (result.approval) {
      setApprovals((previous) => [...previous, result.approval!]);
    }
    if (shareRecipient) {
      addNotification(
        "Documento recebido do BPO",
        `${currentUser.name} compartilhou "${result.document.name}" somente para visualização.`,
        "INFO",
        shareRecipient.id,
        targetCompanyId,
      );
    }
    if (approvalRecipient) {
      addNotification(
        "Documento analisado para aprovação",
        `${currentUser.name} enviou "${result.document.name}" para sua aprovação documental.`,
        "ALERT",
        approvalRecipient.id,
        targetCompanyId,
      );
    }
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

    void deletePersistedDocument(id)
      .then(() => {
        setApprovals((items) =>
          items.map((approval) =>
            approval.relatedId === id && approval.status === "Pendente"
              ? { ...approval, status: "Cancelada" }
              : approval,
          ),
        );
        setDocuments((previous) =>
          previous.filter((document) => document.id !== id),
        );
        addNotification(
          "Documento Removido",
          "Um documento foi excluído do repositório da empresa.",
          "INFO",
          currentUser.id,
          existing.companyId,
        );
      })
      .catch((error) => {
        console.error("Falha ao remover documento do banco:", error);
      });
  };

  // --- BANK RECONCILIATION ---
  const importStatement = (bankAccountId: string, entries: BankStatementItem[]) => {
    if (!hasPermission("reconciliation.execute")) return;

    void importPersistedStatement(bankAccountId, entries)
      .then((result) => {
        setStatementItems((previous) => ({
          ...previous,
          [bankAccountId]: result.items,
        }));
        addNotification(
          "Extrato Importado",
          result.importedCount
            ? `${result.importedCount} item(ns) do extrato foram gravados e estão prontos para conciliação.`
            : "Nenhum item novo foi encontrado no extrato.",
          result.importedCount ? "SUCCESS" : "INFO",
        );
      })
      .catch((error) => {
        console.error("Falha ao importar extrato no banco:", error);
      });
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
    }

    void reconcilePersistedStatementItem(
      bankAccountId,
      statementItemId,
      financialRecordId,
      type,
      notes,
    )
      .then((result) => {
        setStatementItems((previous) => ({
          ...previous,
          [bankAccountId]: (previous[bankAccountId] || []).map((item) =>
            item.id === result.item.id ? result.item : item,
          ),
        }));
        return Promise.all([fetchFinancialEntries(), fetchFinancialSetup()]);
      })
      .then(([entries, setup]) => {
        setAccountsPayable(entries.accountsPayable);
        setAccountsReceivable(entries.accountsReceivable);
        setApprovals((current) => [
          ...current.filter((approval) => approval.type !== "PAGAMENTO"),
          ...entries.paymentApprovals,
        ]);
        setBankAccounts(setup.bankAccounts);
      })
      .catch((error) => {
        console.error("Falha ao conciliar item no banco:", error);
        void fetchStatementEntries().then(({ statementItems: saved }) =>
          setStatementItems(saved),
        );
      });

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
    void autoReconcilePersistedStatements(bankAccountId)
      .then((result) => {
        setStatementItems((previous) => ({
          ...previous,
          [bankAccountId]: (previous[bankAccountId] || []).map(
            (item) => result.items.find((saved) => saved.id === item.id) || item,
          ),
        }));
        addNotification(
          "Conciliação Automática",
          `O sistema analisou os lançamentos e conciliou ${result.matchedCount} itens de forma inteligente.`,
          "SUCCESS",
        );
        return Promise.all([fetchFinancialEntries(), fetchFinancialSetup()]);
      })
      .then(([entries, setup]) => {
        setAccountsPayable(entries.accountsPayable);
        setAccountsReceivable(entries.accountsReceivable);
        setBankAccounts(setup.bankAccounts);
      })
      .catch((error) => {
        console.error("Falha na conciliação automática:", error);
      });
  };

  const ignoreStatementItem = (
    bankAccountId: string,
    statementItemId: string,
    reason: string,
  ) => {
    void ignorePersistedStatementItem(bankAccountId, statementItemId, reason)
      .then((saved) => {
        setStatementItems((previous) => ({
          ...previous,
          [bankAccountId]: (previous[bankAccountId] || []).map((item) =>
            item.id === saved.id ? saved : item,
          ),
        }));
        addNotification(
          "Item de Extrato Ignorado",
          "Lançamento bancário marcado como ignorado na conciliação.",
          "INFO",
        );
      })
      .catch((error) => {
        console.error("Falha ao ignorar item do extrato:", error);
      });
  };

  // --- REPORT GENERATION ---
  // Report generation/rendering stays fully client-side (as before); only the
  // record's metadata is persisted, in the background, to Postgres.
  const persistReport = (record: ReportRecord) => {
    const upload = record.fileContent
      ? fetch("/api/documents/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: record.fileContent,
            fileName: record.fileName || `${record.name}.pdf`,
            mimeType: record.mimeType,
          }),
        })
          .then((response) => response.json())
          .catch(() => ({}))
      : Promise.resolve<{ url?: string }>({});
    void upload
      .then((uploaded: { url?: string }) =>
        createPersistedReport({
          companyId: record.companyId,
          name: record.name,
          type: record.type,
          filters: record.filters,
          format: record.format,
          fileName: record.fileName,
          mimeType: record.mimeType,
          objectKey: uploaded.url,
          fileSizeBytes: record.fileContent ? Math.floor((record.fileContent.length * 3) / 4) : undefined,
          templateId: record.templateId,
          templateName: record.templateName,
          recipientId: record.recipientId,
          recipientName: record.recipientName,
          recipientRole: record.recipientRole,
        }),
      )
      .then((persisted) => {
        setReports((prev) => prev.map((item) => (item.id === record.id ? { ...item, id: persisted.id } : item)));
      })
      .catch((error) => console.error("Failed to persist report:", error instanceof Error ? error.message : error));
  };

  const persistReportTemplate = (template: ReportTemplate) => {
    void createPersistedReportTemplate({
      companyId: template.companyId,
      name: template.name,
      modelType: template.modelType,
      blocks: template.blocks,
      filters: template.filters,
      dreOptions: template.dreOptions,
      notes: template.notes,
      orientation: template.orientation,
    })
      .then((persisted) => {
        setReportTemplates((prev) => prev.map((item) => (item.id === template.id ? { ...item, id: persisted.id } : item)));
      })
      .catch((error) => console.error("Failed to persist report template:", error instanceof Error ? error.message : error));
  };

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
    const sections: ReportSectionData[] = [{ kind: "table", title: name, columns, rows }];
    const artifact = createReportArtifact(
      {
        title: name,
        reportType: type,
        companyName: activeCompany.tradeName,
        companyCnpj: activeCompany.cnpj,
        companyLogoDataUrl: activeCompany.logoDataUrl,
        filters,
        period: {
          startDate: options.startDate,
          endDate: options.endDate,
        },
        generatedAt,
        generatedBy: currentUser.name,
        sections,
      },
      options.format,
    );
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
    persistReport(newReport);
    addNotification(
      "Relatório Pronto",
      `O relatório "${name}" foi gerado em ${options.format} com ${rows.length} registro(s).`,
      "SUCCESS",
    );
    return newReport;
  };

  // --- CENTRAL DE RELATÓRIOS: construtor por blocos ---
  const sendReportToDocumentCenter = (
    report: ReportRecord,
    recipientId?: string,
  ): boolean => {
    if (
      !hasPermission("documents.upload") ||
      !report.fileContent ||
      !report.mimeType ||
      !report.fileName
    )
      return false;
    void uploadDocument({
      name: report.fileName,
      description: `Relatório gerado: ${report.name}`,
      category: "Relatório",
      competenceMonth: report.generatedAt.slice(0, 7),
      fileSize: report.fileSize,
      mimeType: report.mimeType,
      previewUrl: `data:${report.mimeType};base64,${report.fileContent}`,
      recipientId,
    }).catch((error) => {
      console.error("Falha ao salvar relatório na Central de Documentos:", error);
    });
    return true;
  };

  const generateBuiltReport: BPOContextType["generateBuiltReport"] = (
    input,
  ) => {
    if (!hasPermission("reports.generate") || !activeCompany) return null;
    const {
      modelType,
      name,
      blocks,
      filters,
      dreOptions,
      notes,
      orientation,
      format,
      templateId,
      templateName,
      recipientId,
    } = input;

    const dataSource = {
      accountsPayable: accountsPayable.filter(
        (item) => item.companyId === activeCompanyId,
      ),
      accountsReceivable: accountsReceivable.filter(
        (item) => item.companyId === activeCompanyId,
      ),
      bankAccounts: bankAccounts.filter(
        (item) => item.companyId === activeCompanyId,
      ),
    };

    const requestedSections =
      modelType === "DRE Gerencial"
        ? computeDreSections(filters, dreOptions || {}, dataSource)
        : computeReportSections(modelType, blocks, filters, dataSource);
    const summaryBlockKey = {
      "Contas a Pagar": "AP_SUMMARY",
      "Contas a Receber": "AR_SUMMARY",
      "Fluxo de Caixa": "CF_BALANCE_SUMMARY",
    } as const;
    const requiredSummary = modelType === "DRE Gerencial"
      ? []
      : blocks.some((block) => block.blockKey === summaryBlockKey[modelType])
        ? []
        : computeReportSections(
            modelType,
            [{
              instanceId: "idex-required-summary",
              blockKey: summaryBlockKey[modelType],
              visualization: "table",
            }],
            filters,
            dataSource,
          );
    const sections = [...requiredSummary, ...requestedSections];

    const filtersSummary = buildFiltersSummary(modelType, filters, dreOptions);
    const generatedAt = new Date().toISOString();
    const dateBasisLabel = {
      due: "Vencimento",
      payment: "Pagamento/Recebimento",
      competence: "Competência",
    }[filters.dateBasis];
    const appliedFilters = [
      { label: "Período", value: `${formatBrazilianDate(filters.startDate)} a ${formatBrazilianDate(filters.endDate)}` },
      { label: "Base da data", value: dateBasisLabel },
      ...(filters.supplier ? [{ label: "Fornecedor", value: filters.supplier }] : []),
      ...(filters.customer ? [{ label: "Cliente", value: filters.customer }] : []),
      ...(filters.category ? [{ label: "Categoria", value: filters.category }] : []),
      ...(filters.costCenter ? [{ label: "Centro de custo", value: filters.costCenter }] : []),
      ...(filters.status ? [{ label: "Status", value: filters.status }] : []),
      ...(filters.paymentMethod ? [{ label: "Forma", value: filters.paymentMethod }] : []),
      ...(filters.bankAccountId
        ? [{
            label: "Conta financeira",
            value: dataSource.bankAccounts.find((account) => account.id === filters.bankAccountId)?.bankName || "Conta selecionada",
          }]
        : []),
      ...(modelType === "Fluxo de Caixa" && filters.cashFlowView
        ? [{
            label: "Visão",
            value: { realized: "Realizado", projected: "Projetado", both: "Realizado e projetado" }[filters.cashFlowView],
          }]
        : []),
      ...(modelType === "Fluxo de Caixa" && filters.cashFlowGrouping
        ? [{
            label: "Agrupamento",
            value: { daily: "Diário", weekly: "Semanal", monthly: "Mensal" }[filters.cashFlowGrouping],
          }]
        : []),
      ...(modelType === "DRE Gerencial" && dreOptions?.costCenter && !filters.costCenter
        ? [{ label: "Centro de custo", value: dreOptions.costCenter }]
        : []),
    ];
    const description = {
      "Contas a Pagar": "Pagamentos, obrigações e despesas do período.",
      "Contas a Receber": "Recebimentos, inadimplência e receitas do período.",
      "Fluxo de Caixa": "Entradas, saídas e saldo das contas financeiras.",
      "DRE Gerencial": "Demonstração gerencial do resultado do período.",
    }[modelType];
    const artifact = createReportArtifact(
      {
        title: name,
        reportType: modelType,
        description,
        companyName: activeCompany.tradeName,
        companyCnpj: activeCompany.cnpj,
        companyLogoDataUrl: activeCompany.logoDataUrl,
        filters: filtersSummary,
        appliedFilters,
        period: {
          startDate: filters.startDate,
          endDate: filters.endDate,
          dateBasis: dateBasisLabel,
          regime: filters.dateBasis === "competence" ? "Competência" : filters.dateBasis === "payment" ? "Caixa" : undefined,
        },
        generatedAt,
        generatedBy: currentUser.name,
        notes: notes || dreOptions?.comment,
        orientation: orientation || "auto",
        sections,
      },
      format,
    );

    const recipient = recipientId
      ? users.find(
          (user) =>
            user.id === recipientId &&
            user.status === "ACTIVE" &&
            ["CLIENT", "ACCOUNTANT"].includes(user.role) &&
            user.companies?.includes(activeCompanyId),
        )
      : undefined;

    const id = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newReport: ReportRecord = {
      id,
      companyId: activeCompanyId,
      name,
      type: modelType,
      filters: filtersSummary,
      generatedAt,
      generatedById: currentUser.id,
      generatedByName: currentUser.name,
      templateId,
      templateName,
      recipientId: recipient?.id,
      recipientName: recipient?.name,
      recipientRole: recipient?.role as ReportRecord["recipientRole"],
      ...artifact,
    };

    setReports((prev) => [newReport, ...prev]);
    persistReport(newReport);
    addNotification(
      "Relatório Pronto",
      `O relatório "${name}" foi gerado em ${format === "EXCEL" ? "Excel" : "PDF"}.`,
      "SUCCESS",
    );

    if (recipient) sendReportToDocumentCenter(newReport, recipient.id);

    return newReport;
  };

  const saveReportTemplate: BPOContextType["saveReportTemplate"] = (
    input,
  ) => {
    if (!hasPermission("reports.generate") || !activeCompany) return null;
    const now = new Date().toISOString();
    if (input.id) {
      let updated: ReportTemplate | null = null;
      setReportTemplates((prev) =>
        prev.map((template) => {
          if (template.id !== input.id) return template;
          updated = {
            ...template,
            name: input.name,
            modelType: input.modelType,
            blocks: input.blocks,
            filters: input.filters,
            dreOptions: input.dreOptions,
            notes: input.notes,
            orientation: input.orientation,
            updatedAt: now,
          };
          return updated;
        }),
      );
      void updatePersistedReportTemplate(input.id, {
        name: input.name,
        modelType: input.modelType,
        blocks: input.blocks,
        filters: input.filters,
        dreOptions: input.dreOptions,
        notes: input.notes,
        orientation: input.orientation,
      }).catch((error) => console.error("Failed to update report template:", error instanceof Error ? error.message : error));
      return updated;
    }
    const newTemplate: ReportTemplate = {
      id: `rpt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      companyId: activeCompanyId,
      name: input.name,
      modelType: input.modelType,
      blocks: input.blocks,
      filters: input.filters,
      dreOptions: input.dreOptions,
      notes: input.notes,
      orientation: input.orientation,
      favorite: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
      createdById: currentUser.id,
      createdByName: currentUser.name,
    };
    setReportTemplates((prev) => [newTemplate, ...prev]);
    persistReportTemplate(newTemplate);
    return newTemplate;
  };

  const duplicateReportTemplate = (id: string) => {
    const original = reportTemplates.find((template) => template.id === id);
    if (!original) return;
    const now = new Date().toISOString();
    const copy: ReportTemplate = {
      ...original,
      id: `rpt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${original.name} (cópia)`,
      favorite: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
      createdById: currentUser.id,
      createdByName: currentUser.name,
    };
    setReportTemplates((prev) => [copy, ...prev]);
    void duplicatePersistedReportTemplate(id)
      .then((persisted) =>
        setReportTemplates((prev) => prev.map((item) => (item.id === copy.id ? { ...item, id: persisted.id } : item))),
      )
      .catch((error) => console.error("Failed to duplicate report template:", error instanceof Error ? error.message : error));
  };

  const archiveReportTemplate = (id: string, archived: boolean) => {
    setReportTemplates((prev) =>
      prev.map((template) =>
        template.id === id
          ? { ...template, archived, updatedAt: new Date().toISOString() }
          : template,
      ),
    );
    void updatePersistedReportTemplate(id, { archived }).catch((error) =>
      console.error("Failed to archive report template:", error instanceof Error ? error.message : error),
    );
  };

  const toggleReportTemplateFavorite = (id: string) => {
    const current = reportTemplates.find((template) => template.id === id);
    setReportTemplates((prev) =>
      prev.map((template) =>
        template.id === id
          ? {
              ...template,
              favorite: !template.favorite,
              updatedAt: new Date().toISOString(),
            }
          : template,
      ),
    );
    if (current) {
      void updatePersistedReportTemplate(id, { favorite: !current.favorite }).catch((error) =>
        console.error("Failed to update report template favorite:", error instanceof Error ? error.message : error),
      );
    }
  };

  const deleteReportTemplate = (id: string) => {
    setReportTemplates((prev) => prev.filter((template) => template.id !== id));
    void deletePersistedReportTemplate(id).catch((error) =>
      console.error("Failed to delete report template:", error instanceof Error ? error.message : error),
    );
  };

  // --- ADMINISTRATION: COMPANIES & CLIENTS ---
  const addCompany = async (
    data: Omit<Company, "id" | "createdAt" | "status">,
    onboarding: CompanyOnboardingData,
  ): Promise<CompanyCreationResult> => {
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

    const configuredMasterData = Object.fromEntries(
      (Object.keys(DEFAULT_COMPANY_MASTER_DATA) as MasterDataType[]).map(
        (type) => {
          const suppliedValues = onboarding.masterData[type] || [];
          const fallbackValues = DEFAULT_COMPANY_MASTER_DATA[type] || [];
          return [type, suppliedValues.length ? suppliedValues : fallbackValues];
        },
      ),
    ) as Partial<Record<MasterDataType, string[]>>;
    let persisted;
    try {
      persisted = await createPersistedCompany(
        {
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
        },
        {
          initialBankAccount: {
            ...bank,
            bankName: bank.bankName.trim(),
            agency: bank.agency.trim(),
            accountNumber: bank.accountNumber.trim(),
            balance: Number(bank.balance),
          },
          masterData: configuredMasterData,
        },
      );
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof CompanyServiceError
            ? error.message
            : "Não foi possível cadastrar a empresa no banco.",
      };
    }
    const newCompany = persisted.company;
    const newBank = persisted.initialBankAccount;
    const newMasterData = persisted.masterData;
    const id = newCompany.id;

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
      company: companyAuditSnapshot(newCompany),
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

  const updateCompanyStatus = async (
    id: string,
    status: Company["status"],
  ): Promise<CompanyCreationResult> => {
    if (currentUser.role !== "BPO_ADMIN") {
      return { success: false, error: "Sem permissão para alterar empresas." };
    }
    const existing = companies.find((company) => company.id === id);
    if (!existing) return { success: false, error: "Empresa não encontrada." };
    let updated: Company;
    try {
      updated = await updatePersistedCompany(id, { status });
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof CompanyServiceError
            ? error.message
            : "Não foi possível atualizar o status.",
      };
    }
    setCompanies((previous) =>
      previous.map((company) => (company.id === id ? updated : company)),
    );
    createAuditLog(
      "ALTERAR_STATUS_EMPRESA",
      "Company",
      id,
      id,
      companyAuditSnapshot(existing),
      companyAuditSnapshot(updated),
    );

    addNotification(
      "Status de Empresa Atualizado",
      `A empresa mudou seu status operacional para ${status}.`,
      "INFO",
    );
    return { success: true };
  };
  const updateCompany = async (
    id: string,
    updates: Partial<Omit<Company, "id" | "createdAt" | "tenantId">>,
  ): Promise<CompanyCreationResult> => {
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

    let updated: Company;
    try {
      updated = await updatePersistedCompany(id, {
        ...updates,
        clientModules: updates.clientModules
          ? Array.from(new Set(updates.clientModules))
          : undefined,
        approvalLimit:
          updates.approvalLimit === undefined
            ? undefined
            : Number(updates.approvalLimit),
      });
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof CompanyServiceError
            ? error.message
            : "Não foi possível atualizar a empresa no banco.",
      };
    }
    setCompanies((previous) =>
      previous.map((company) => (company.id === id ? updated : company)),
    );
    createAuditLog(
      "ATUALIZAR_EMPRESA_CLIENTE",
      "Company",
      id,
      id,
      companyAuditSnapshot(existing),
      companyAuditSnapshot(updated),
    );
    return { success: true };
  };

  const deleteCompany = async (
    id: string,
  ): Promise<CompanyCreationResult> => {
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
    try {
      await deactivatePersistedCompany(id);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof CompanyServiceError
            ? error.message
            : "Não foi possível desativar a empresa no banco.",
      };
    }

    const remainingCompanies = companies.filter((item) => item.id !== id);

    createAuditLog(
      "DESATIVAR_EMPRESA_CLIENTE",
      "Company",
      id,
      id,
      companyAuditSnapshot(company),
      companyAuditSnapshot({ ...company, status: "Inativo" }),
    );
    setCompanies(remainingCompanies);
    if (activeCompanyId === id) {
      setActiveCompanyId(remainingCompanies[0]?.id || "");
    }

    return { success: true };
  };

  // --- TEAM MANAGEMENT ---
  const addTeamMember: BPOContextType["addTeamMember"] = async (data) => {
    if (currentUser.role !== "BPO_ADMIN") {
      return { success: false, error: "Sem permissão para criar usuários." };
    }
    let created;
    try {
      created = await createPersistedUser(data);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof UserServiceError
            ? error.message
            : "Não foi possível criar o usuário no banco.",
      };
    }
    setUsers((previous) => [...previous, created.user]);
    createAuditLog(
      "CONVIDAR_COLABORADOR",
      "User",
      created.user.id,
      undefined,
      null,
      created.user,
    );
    addNotification(
      "Usuário criado",
      `A credencial de ${data.email} foi criada no PostgreSQL.`,
      "SUCCESS",
    );
    return {
      success: true,
      temporaryPassword: created.temporaryPassword,
    };
  };

  const updateTeamMemberPermissions = async (
    id: string,
    permissions: string[],
    status?: "ACTIVE" | "INACTIVE",
    assignedCompanies?: string[],
    clientOperator?: boolean,
  ): Promise<{ success: boolean; error?: string }> => {
    if (currentUser.role !== "BPO_ADMIN") {
      return { success: false, error: "Sem permissão para alterar usuários." };
    }
    const existing = users.find((user) => user.id === id);
    if (!existing) return { success: false, error: "Usuário não encontrado." };
    let updated: User;
    try {
      updated = await updatePersistedUser(id, {
        permissions,
        status,
        companies: assignedCompanies,
        clientOperator,
      });
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof UserServiceError
            ? error.message
            : "Não foi possível atualizar as permissões.",
      };
    }
    setUsers((previous) =>
      previous.map((user) => (user.id === id ? updated : user)),
    );
    createAuditLog(
      "ALTERAR_PERMISSOES_USUARIO",
      "User",
      id,
      undefined,
      existing,
      updated,
    );

    addNotification(
      "Permissões Atualizadas",
      "As permissões de RBAC foram salvas no perfil do colaborador.",
      "SUCCESS",
    );
    return { success: true };
  };

  const updateTeamMember: BPOContextType["updateTeamMember"] = async (
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
    let updated: User;
    try {
      updated = await updatePersistedUser(id, updates);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof UserServiceError
            ? error.message
            : "Não foi possível atualizar o usuário no banco.",
      };
    }

    setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
    createAuditLog(
      "EDITAR_COLABORADOR",
      "User",
      id,
      undefined,
      existing,
      updated,
    );
    addNotification(
      "Usuário Atualizado",
      `Os dados de ${updated.name} foram atualizados.`,
      "SUCCESS",
    );
    return { success: true };
  };

  const deleteTeamMember: BPOContextType["deleteTeamMember"] = async (id) => {
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

    try {
      await deactivatePersistedUser(id);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof UserServiceError
            ? error.message
            : "Não foi possível desativar o usuário no banco.",
      };
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
    createAuditLog(
      "EXCLUIR_COLABORADOR",
      "User",
      id,
      undefined,
      existing,
      null,
    );
    addNotification(
      "Usuário Removido",
      `${existing.name} foi removido da plataforma.`,
      "WARNING",
    );
    return { success: true };
  };

  const resetTeamMemberPassword: BPOContextType["resetTeamMemberPassword"] =
    async (id) => {
      try {
        const result = await resetPersistedUserPassword(id);
        return { success: true, temporaryPassword: result.temporaryPassword };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof UserServiceError
              ? error.message
              : "Não foi possível gerar uma nova senha temporária.",
        };
      }
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
        void updatePersistedReceivable(linked.id, {
          description: updated.description,
          customer: updated.supplier || "Cliente a confirmar",
          category: updated.expenseType || updated.category,
          costCenter: updated.costCenter || "A classificar",
          competenceMonth: updated.competenceMonth,
          dueDate: updated.dueDate || linked.dueDate,
          amount: updated.amount || 0,
          paymentMethod: updated.paymentMethod || "A definir",
          bankAccountId: updated.bankAccountId || "",
          documentNumber: updated.documentNumber || "",
          notes: updated.notes || "Lançamento avulso.",
        }).then((saved) => {
          setAccountsReceivable((current) => current.map((item) => item.id === saved.id ? saved : item));
        }).catch((error) => console.error("Falha ao atualizar conta a receber do documento:", error));
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
        persistBankBalanceChanges(
          [
            { accountId: document.bankAccountId, delta: document.amount || 0 },
            {
              accountId: document.destinationBankAccountId,
              delta: -(document.amount || 0),
            },
            { accountId: updated.bankAccountId, delta: -(updated.amount || 0) },
            {
              accountId: updated.destinationBankAccountId,
              delta: updated.amount || 0,
            },
          ],
          {
            action: "ATUALIZAR_TRANSFERENCIA_ENTRE_CONTAS",
            entityType: "BankTransfer",
            entityId: id,
          },
        );
      } else {
        const linked = accountsPayable.find(
          (item) => item.id === document.relatedEntityId,
        );
        if (!linked || ["Paga", "Cancelada"].includes(linked.status))
          return false;
        void updatePersistedPayable(linked.id, {
          description: updated.description,
          supplier: updated.supplier || "Fornecedor a confirmar",
          category: updated.expenseType || updated.category,
          costCenter: updated.costCenter || "A classificar",
          competenceMonth: updated.competenceMonth,
          dueDate: updated.dueDate || linked.dueDate,
          amount: updated.amount || 0,
          paymentMethod: updated.paymentMethod || "A definir",
          bankAccountId: updated.bankAccountId || "",
          documentNumber: updated.documentNumber || "",
          notes: updated.notes || "Lançamento avulso.",
        }).then((saved) => {
          setAccountsPayable((current) => current.map((item) => item.id === saved.id ? saved : item));
        }).catch((error) => console.error("Falha ao atualizar conta a pagar do documento:", error));
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

    void updatePersistedDocument(id, {
      ...safeUpdates,
      amount: updated.amount,
    })
      .then((saved) => {
        setDocuments((current) =>
          current.map((item) => (item.id === saved.id ? saved : item)),
        );
      })
      .catch((error) => {
        console.error("Falha ao atualizar documento no banco:", error);
      });
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

    const baseDescription =
      document.description || document.aiSummary || document.name;
    void createPersistedPayables(document.companyId, {
      description: baseDescription,
      supplier: document.supplier || "Fornecedor a confirmar",
      category: document.expenseType || document.category,
      costCenter: document.costCenter || "A classificar",
      competenceMonth: document.competenceMonth || document.uploadedAt.slice(0, 7),
      issueDate: document.uploadedAt.slice(0, 10),
      dueDate: document.dueDate || document.uploadedAt.slice(0, 10),
      amount: document.amount || 0,
      interest: 0,
      penalty: 0,
      discount: 0,
      paymentMethod: document.paymentMethod || "A definir",
      bankAccountId: document.bankAccountId || "",
      recurrence: document.recurrence || "Nenhuma",
      installmentCount: document.installmentCount,
      documentNumber: document.documentNumber || "",
      notes: document.notes || "Lançamento originado pela Central de Documentos.",
      attachmentUrl: document.signedUrl,
      attachmentName: document.name,
      responsibleId: currentUser.id,
      needsApproval: false,
    }).then((result) => {
      setAccountsPayable((current) => [...current, ...result.payables]);
      if (result.approvals.length) setApprovals((current) => [...current, ...result.approvals]);
      const launchedAt = new Date().toISOString();
      void updatePersistedDocument(documentId, {
        ...updates,
        status: "Lançado",
        entryType: document.entryType || "Conta a Pagar",
        relatedEntityId: result.payables[0].id,
        launchedById: currentUser.id,
        launchedAt,
      })
        .then((saved) => {
          setDocuments((current) =>
            current.map((item) => (item.id === saved.id ? saved : item)),
          );
        })
        .catch((error) => {
          console.error("Falha ao vincular documento à conta a pagar:", error);
        });
      setDocuments((current) =>
        current.map((item) =>
          item.id === documentId
            ? {
                ...item,
                ...updates,
                status: "Lançado",
                relatedEntityId: result.payables[0].id,
                launchedById: currentUser.id,
                launchedByName: currentUser.name,
                launchedAt,
              }
            : item,
        ),
      );
    }).catch((error) => {
      console.error("Falha ao lançar documento em contas a pagar:", error);
    });
  };

  const persistReceivablesFromDocument = (
    document: Document,
    documentId: string,
    updates: Partial<Document> = {},
    defaultNotes = "Lançamento originado pela Central de Documentos.",
  ) => {
    void createPersistedReceivables(document.companyId, {
      description: document.description,
      customer: document.supplier || "Cliente a confirmar",
      category: document.expenseType || document.category,
      costCenter: document.costCenter || "A classificar",
      competenceMonth: document.competenceMonth || document.uploadedAt.slice(0, 7),
      issueDate: document.uploadedAt.slice(0, 10),
      dueDate: document.dueDate || document.uploadedAt.slice(0, 10),
      amount: document.amount || 0,
      interest: 0,
      penalty: 0,
      discount: 0,
      paymentMethod: document.paymentMethod || "A definir",
      bankAccountId: document.bankAccountId || "",
      recurrence: document.recurrence || "Nenhuma",
      installmentCount: document.installmentCount,
      documentNumber: document.documentNumber || "",
      notes: document.notes || defaultNotes,
      responsibleId: currentUser.id,
    }).then((receivables) => {
      setAccountsReceivable((current) => [...current, ...receivables]);
      const launchedAt = new Date().toISOString();
      void updatePersistedDocument(documentId, {
        ...updates,
        status: "Lançado",
        entryType: "Conta a Receber",
        relatedEntityId: receivables[0].id,
        launchedById: currentUser.id,
        launchedAt,
      })
        .then((saved) => {
          setDocuments((current) =>
            current.map((item) => (item.id === saved.id ? saved : item)),
          );
        })
        .catch((error) => {
          console.error("Falha ao vincular documento à conta a receber:", error);
        });
      setDocuments((current) =>
        current.map((item) =>
          item.id === documentId
            ? {
                ...item,
                ...updates,
                status: "Lançado",
                relatedEntityId: receivables[0].id,
                launchedById: currentUser.id,
                launchedByName: currentUser.name,
                launchedAt,
              }
            : item,
        ),
      );
    }).catch((error) => {
      console.error("Falha ao lançar documento em contas a receber:", error);
    });
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
      persistBankBalanceChanges(
        [
          { accountId: document.bankAccountId, delta: -(document.amount || 0) },
          {
            accountId: document.destinationBankAccountId,
            delta: document.amount || 0,
          },
        ],
        {
          action: "TRANSFERENCIA_ENTRE_CONTAS",
          entityType: "BankTransfer",
          entityId: id,
        },
      );
      const launchedAt = new Date().toISOString();
      void updatePersistedDocument(id, {
        ...updates,
        status: "Lançado",
        entryType: "Transferência",
        launchedById: currentUser.id,
        launchedAt,
      })
        .then((saved) => {
          setDocuments((currentDocuments) =>
            currentDocuments.map((item) =>
              item.id === saved.id ? saved : item,
            ),
          );
        })
        .catch((error) => {
          console.error("Falha ao persistir transferência do documento:", error);
        });
      setDocuments((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                ...updates,
                status: "Lançado",
                launchedById: currentUser.id,
                launchedByName: currentUser.name,
                launchedAt,
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
      persistReceivablesFromDocument(document, id, updates);
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
    void requestPersistedDocumentApproval(id, recipient.id, { ...updates })
      .then((result) => {
        setApprovals((previous) => [...previous, result.approval]);
        setDocuments((previous) =>
          previous.map((item) =>
            item.id === result.document.id ? result.document : item,
          ),
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
      })
      .catch((error) => {
        console.error("Falha ao solicitar aprovação documental:", error);
      });
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
        void cancelPersistedReceivable(linked.id)
          .then((saved) => setAccountsReceivable((current) => current.map((item) => item.id === saved.id ? saved : item)))
          .catch((error) => console.error("Falha ao cancelar conta a receber do documento:", error));
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
        persistBankBalanceChanges(
          [
            { accountId: document.bankAccountId, delta: document.amount || 0 },
            {
              accountId: document.destinationBankAccountId,
              delta: -(document.amount || 0),
            },
          ],
          {
            action: "CANCELAR_TRANSFERENCIA_ENTRE_CONTAS",
            entityType: "BankTransfer",
            entityId: id,
          },
        );
      } else {
        const linked = accountsPayable.find(
          (item) => item.id === document.relatedEntityId,
        );
        if (!linked || linked.status === "Paga") return false;
        void cancelPersistedPayable(linked.id)
          .then((saved) => setAccountsPayable((current) => current.map((item) => item.id === saved.id ? saved : item)))
          .catch((error) => console.error("Falha ao cancelar conta a pagar do documento:", error));
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

    void updatePersistedDocument(id, { status: "Cancelado" })
      .then((saved) => {
        setDocuments((current) =>
          current.map((item) => (item.id === saved.id ? saved : item)),
        );
      })
      .catch((error) => {
        console.error("Falha ao cancelar documento no banco:", error);
      });
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
    const draftDocument: Document = {
      id: "",
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
    void createPersistedDocument({ ...draftDocument })
      .then(({ document: persistedDocument }) => {
    const document = persistedDocument;
    const documentId = persistedDocument.id;
    setDocuments((prev) => [...prev, document]);
    if (document.entryType === "Conta a Receber") {
      persistReceivablesFromDocument(document, documentId, {}, "Lançamento avulso.");
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
      persistBankBalanceChanges(
        [
          { accountId: document.bankAccountId, delta: -(document.amount || 0) },
          {
            accountId: document.destinationBankAccountId,
            delta: document.amount || 0,
          },
        ],
        {
          action: "TRANSFERENCIA_ENTRE_CONTAS",
          entityType: "BankTransfer",
          entityId: documentId,
        },
      );
      createAuditLog(
        "TRANSFERENCIA_ENTRE_CONTAS",
        "BankTransfer",
        documentId,
        activeCompanyId,
        null,
        document,
      );
      void updatePersistedDocument(documentId, {
        status: "Lançado",
        entryType: "Transferência",
        launchedById: currentUser.id,
        launchedAt: now,
      })
        .then((saved) => {
          setDocuments((current) =>
            current.map((item) => (item.id === saved.id ? saved : item)),
          );
        })
        .catch((error) => {
          console.error("Falha ao finalizar lançamento avulso:", error);
        });
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
      })
      .catch((error) => {
        console.error("Falha ao criar lançamento avulso no banco:", error);
      });
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
    void createPersistedSupportTicket({ companyId: activeCompany.id, ...data })
      .then((persisted) =>
        setSupportTickets((prev) => prev.map((item) => (item.id === id ? persisted : item))),
      )
      .catch((error) => console.error("Failed to create support ticket:", error instanceof Error ? error.message : error));
    return id;
  };

  const addSupportMessage = (
    ticketId: string,
    content: string,
    attachments: SupportAttachment[] = [],
  ) => {
    const message = content.trim();
    if (!message && attachments.length === 0) return;
    const ticket = supportTickets.find((item) => item.id === ticketId);
    const isAuthorized =
      ticket && (currentUser.role === "BPO_ADMIN" || ticket.requesterId === currentUser.id);
    if (!ticket || !isAuthorized) return;

    void addPersistedSupportMessage(ticketId, message, attachments)
      .then(({ ticket: updatedTicket }) =>
        setSupportTickets((previous) =>
          previous.map((item) => (item.id === ticketId ? updatedTicket : item)),
        ),
      )
      .catch((error) => console.error("Failed to send support message:", error instanceof Error ? error.message : error));
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
    void updatePersistedSupportTicket(ticketId, updates)
      .then((updated) =>
        setSupportTickets((previous) =>
          previous.map((item) => (item.id === ticketId ? updated : item)),
        ),
      )
      .catch((error) => console.error("Failed to update support ticket:", error instanceof Error ? error.message : error));
  };

  const deleteSupportTicket = (ticketId: string): boolean => {
    if (currentUser.role !== "BPO_ADMIN") return false;

    const ticket = supportTickets.find((item) => item.id === ticketId);
    if (!ticket) return false;

    setSupportTickets((previous) =>
      previous.filter((item) => item.id !== ticketId),
    );
    void deletePersistedSupportTicket(ticketId).catch((error) =>
      console.error("Failed to delete support ticket:", error instanceof Error ? error.message : error),
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
        reportTemplates,
        statementItems,
        supportTickets,
        isUserOnline,
        currentUser,
        activeCompany,
        activeTenant,
        isAuthenticated,
        isAuthLoading,
        mustChangePassword,
        login,
        logout,
        changePassword,
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
        importFinancialEntries,
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
        generateBuiltReport,
        saveReportTemplate,
        duplicateReportTemplate,
        archiveReportTemplate,
        toggleReportTemplateFavorite,
        deleteReportTemplate,
        sendReportToDocumentCenter,
        addCompany,
        updateCompany,
        deleteCompany,
        updateCompanyStatus,
        addTeamMember,
        updateTeamMemberPermissions,
        updateTeamMember,
        deleteTeamMember,
        resetTeamMemberPassword,
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
