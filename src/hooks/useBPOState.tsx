/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  UserRole
} from '../types';
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
  BANK_STATEMENTS_TO_IMPORT
} from '../services/mockData';

interface BPOContextType {
  tenants: Tenant[];
  companies: Company[];
  users: User[];
  bankAccounts: BankAccount[];
  accountsPayable: AccountPayable[];
  accountsReceivable: AccountReceivable[];
  approvals: Approval[];
  documents: Document[];
  auditLogs: AuditLog[];
  notifications: Notification[];
  reports: ReportRecord[];
  statementItems: Record<string, BankStatementItem[]>;
  
  currentUser: User;
  activeCompany: Company | null;
  activeTenant: Tenant | null;
  
  // Controls
  switchUser: (userId: string) => void;
  switchCompany: (companyId: string) => void;
  hasPermission: (permission: string) => boolean;
  
  // Actions
  addAccountPayable: (data: Omit<AccountPayable, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'finalAmount' | 'status'>) => void;
  updateAccountPayable: (id: string, updates: Partial<AccountPayable>) => void;
  cancelAccountPayable: (id: string) => void;
  payAccountPayable: (id: string, date: string, receiptUrl?: string) => void;
  
  addAccountReceivable: (data: Omit<AccountReceivable, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'receivedAmount' | 'status'>) => void;
  updateAccountReceivable: (id: string, updates: Partial<AccountReceivable>) => void;
  cancelAccountReceivable: (id: string) => void;
  receiveAccountReceivable: (id: string, amount: number, date: string) => void;
  
  approveOrReject: (approvalId: string, decision: 'Aprovada' | 'Rejeitada', comment: string) => void;
  
  uploadDocument: (data: {
    name: string;
    description: string;
    category: Document['category'];
    competenceMonth: string;
    fileSize: string;
    mimeType: string;
    relatedEntityId?: string;
  }) => void;
  deleteDocument: (id: string) => void;
  
  importStatement: (bankAccountId: string) => void;
  reconcileItemManually: (bankAccountId: string, statementItemId: string, financialRecordId: string, type: 'A_PAGAR' | 'A_RECEBER', notes: string) => void;
  autoReconcileBank: (bankAccountId: string) => void;
  ignoreStatementItem: (bankAccountId: string, statementItemId: string, reason: string) => void;
  
  generateReport: (name: string, type: string, filters: string) => void;
  
  addCompany: (data: Omit<Company, 'id' | 'createdAt' | 'status'>) => void;
  updateCompanyStatus: (id: string, status: Company['status']) => void;
  
  addTeamMember: (data: Omit<User, 'id'>) => void;
  updateTeamMemberPermissions: (id: string, permissions: string[], status?: 'ACTIVE' | 'INACTIVE') => void;
  
  addNotification: (title: string, message: string, type: Notification['type']) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
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

  const [tenants, setTenants] = useState<Tenant[]>(() => loadState('tenants', INITIAL_TENANTS));
  const [companies, setCompanies] = useState<Company[]>(() => loadState('companies', INITIAL_COMPANIES));
  const [users, setUsers] = useState<User[]>(() => loadState('users', INITIAL_USERS));
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => loadState('bankAccounts', INITIAL_BANK_ACCOUNTS));
  const [accountsPayable, setAccountsPayable] = useState<AccountPayable[]>(() => loadState('accountsPayable', INITIAL_ACCOUNTS_PAYABLE));
  const [accountsReceivable, setAccountsReceivable] = useState<AccountReceivable[]>(() => loadState('accountsReceivable', INITIAL_ACCOUNTS_RECEIVABLE));
  const [approvals, setApprovals] = useState<Approval[]>(() => loadState('approvals', INITIAL_APPROVALS));
  const [documents, setDocuments] = useState<Document[]>(() => loadState('documents', INITIAL_DOCUMENTS));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => loadState('auditLogs', INITIAL_AUDIT_LOGS));
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const raw = loadState('notifications', INITIAL_NOTIFICATIONS);
    const seen = new Set<string>();
    const deduped: Notification[] = [];
    raw.forEach(notif => {
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
  const [reports, setReports] = useState<ReportRecord[]>(() => loadState('reports', []));
  const [statementItems, setStatementItems] = useState<Record<string, BankStatementItem[]>>(() => loadState('statementItems', BANK_STATEMENTS_TO_IMPORT));

  const [currentUserId, setCurrentUserId] = useState<string>(() => loadState('currentUserId', 'u-client-admin')); // Default to Naylton Nobre
  const [activeCompanyId, setActiveCompanyId] = useState<string>(() => loadState('activeCompanyId', 'c-101'));

  // Sync to local storage on changes
  useEffect(() => {
    localStorage.setItem('bpo_saas_tenants', JSON.stringify(tenants));
    localStorage.setItem('bpo_saas_companies', JSON.stringify(companies));
    localStorage.setItem('bpo_saas_users', JSON.stringify(users));
    localStorage.setItem('bpo_saas_bankAccounts', JSON.stringify(bankAccounts));
    localStorage.setItem('bpo_saas_accountsPayable', JSON.stringify(accountsPayable));
    localStorage.setItem('bpo_saas_accountsReceivable', JSON.stringify(accountsReceivable));
    localStorage.setItem('bpo_saas_approvals', JSON.stringify(approvals));
    localStorage.setItem('bpo_saas_documents', JSON.stringify(documents));
    localStorage.setItem('bpo_saas_auditLogs', JSON.stringify(auditLogs));
    localStorage.setItem('bpo_saas_notifications', JSON.stringify(notifications));
    localStorage.setItem('bpo_saas_reports', JSON.stringify(reports));
    localStorage.setItem('bpo_saas_statementItems', JSON.stringify(statementItems));
    localStorage.setItem('bpo_saas_currentUserId', JSON.stringify(currentUserId));
    localStorage.setItem('bpo_saas_activeCompanyId', JSON.stringify(activeCompanyId));
  }, [tenants, companies, users, bankAccounts, accountsPayable, accountsReceivable, approvals, documents, auditLogs, notifications, reports, statementItems, currentUserId, activeCompanyId]);

  // Derived current user, active company, and tenant
  const currentUser = users.find(u => u.id === currentUserId) || users[0];
  const activeCompany = companies.find(c => c.id === activeCompanyId) || null;
  const activeTenant = activeCompany ? (tenants.find(t => t.id === activeCompany.tenantId) || null) : null;

  // Handle switching users
  const switchUser = (userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (targetUser) {
      setCurrentUserId(userId);
      // Switch active company to the first available company for this user
      if (targetUser.role === 'BPO_ADMIN' || targetUser.role === 'ACCOUNTANT') {
        // Admin and Accountant have access to all companies
        setActiveCompanyId('c-101');
      } else if (targetUser.companies && targetUser.companies.length > 0) {
        setActiveCompanyId(targetUser.companies[0]);
      }
      
      // Log access switch
      const logId = `log-${Date.now()}`;
      const newLog: AuditLog = {
        id: logId,
        tenantId: targetUser.role === 'BPO_ADMIN' ? 't-1111-1111' : (companies.find(c => targetUser.companies?.includes(c.id))?.tenantId || 't-1111-1111'),
        userId: targetUser.id,
        userName: targetUser.name,
        role: targetUser.role,
        action: 'SESSAO_LOGIN_SIMULADO',
        entityType: 'User',
        entityId: targetUser.id,
        timestamp: new Date().toISOString(),
        ipAddress: '189.23.41.221',
        userAgent: navigator.userAgent,
        origin: 'Simulador RBAC'
      };
      setAuditLogs(prev => [newLog, ...prev]);
    }
  };

  const switchCompany = (companyId: string) => {
    // Check if current user is authorized to view this company
    const isAuthorized = 
      currentUser.role === 'BPO_ADMIN' || 
      currentUser.role === 'ACCOUNTANT' || 
      (currentUser.companies && currentUser.companies.includes(companyId));
    
    if (isAuthorized) {
      setActiveCompanyId(companyId);
    }
  };

  const hasPermission = (permission: string): boolean => {
    return currentUser.permissions.includes(permission) || currentUser.role === 'BPO_ADMIN';
  };

  // Create an audit log entry helper
  const createAuditLog = (action: string, entityType: string, entityId: string, companyId?: string, prevData?: any, nextData?: any) => {
    const targetCompany = companies.find(c => c.id === (companyId || activeCompanyId));
    const log: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      tenantId: targetCompany?.tenantId || activeTenant?.id || 't-1111-1111',
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
      ipAddress: '177.34.82.109',
      userAgent: navigator.userAgent,
      origin: 'BPO Dashboard Core'
    };
    setAuditLogs(prev => [log, ...prev]);
  };

  // Add Notification helper
  const addNotification = (title: string, message: string, type: Notification['type']) => {
    const notif: Notification = {
      id: `not-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      companyId: activeCompanyId,
      title,
      message,
      type,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications(prev => [notif, ...prev]);
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const clearNotifications = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  // --- ACCOUNTS PAYABLE ACTIONS ---
  const addAccountPayable = (data: Omit<AccountPayable, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'finalAmount' | 'status'>) => {
    if (!hasPermission('accounts-payable.create')) return;

    const id = `ap-${Date.now()}`;
    const finalAmount = Number(data.amount) + Number(data.interest) + Number(data.penalty) - Number(data.discount);
    
    // Check if it requires approval (either explicitly set or if final amount exceeds active company approval limit)
    const limit = activeCompany?.approvalLimit || 5000;
    const needsApproval = data.needsApproval || finalAmount >= limit;
    const status = needsApproval ? 'Aguardando aprovação' : 'Pendente';

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

    setAccountsPayable(prev => [...prev, newPayable]);
    createAuditLog('CRIAR_CONTA_PAGAR', 'AccountPayable', id, activeCompanyId, null, newPayable);

    if (needsApproval) {
      // Create an approval request
      const approvalId = `apv-${Date.now()}`;
      const newApproval: Approval = {
        id: approvalId,
        companyId: activeCompanyId,
        type: 'PAGAMENTO',
        relatedId: id,
        description: data.description,
        amount: finalAmount,
        dueDate: data.dueDate,
        requesterId: currentUser.id,
        requesterName: currentUser.name,
        dueDateApproval: data.dueDate,
        status: 'Pendente',
        attachmentName: data.attachmentName,
        attachmentUrl: data.attachmentUrl,
        createdAt: new Date().toISOString(),
        history: []
      };
      setApprovals(prev => [...prev, newApproval]);
      createAuditLog('SOLICITAR_APROVACAO', 'Approval', approvalId, activeCompanyId, null, newApproval);
      
      addNotification(
        'Solicitação de Aprovação',
        `Novo pagamento de R$ ${finalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} cadastrado para "${data.supplier}" necessita de aprovação.`,
        'ALERT'
      );
    } else {
      addNotification(
        'Conta a Pagar Cadastrada',
        `Nova conta para "${data.supplier}" no valor de R$ ${finalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} cadastrada como Pendente.`,
        'INFO'
      );
    }
  };

  const updateAccountPayable = (id: string, updates: Partial<AccountPayable>) => {
    if (!hasPermission('accounts-payable.update')) return;

    setAccountsPayable(prev => {
      const existing = prev.find(p => p.id === id);
      if (!existing) return prev;

      // Cannot update if paid
      if (existing.status === 'Paga') {
        console.error("Cannot modify paid accounts without special audit overrides.");
        return prev;
      }

      const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      
      // Recompute final amount
      merged.amount = Number(merged.amount);
      merged.interest = Number(merged.interest);
      merged.penalty = Number(merged.penalty);
      merged.discount = Number(merged.discount);
      merged.finalAmount = merged.amount + merged.interest + merged.penalty - merged.discount;

      createAuditLog('ATUALIZAR_CONTA_PAGAR', 'AccountPayable', id, existing.companyId, existing, merged);
      return prev.map(p => p.id === id ? merged : p);
    });
  };

  const cancelAccountPayable = (id: string) => {
    if (!hasPermission('accounts-payable.cancel')) return;

    setAccountsPayable(prev => {
      const existing = prev.find(p => p.id === id);
      if (!existing) return prev;

      const updated = { ...existing, status: 'Cancelada' as const, updatedAt: new Date().toISOString() };
      createAuditLog('CANCELAR_CONTA_PAGAR', 'AccountPayable', id, existing.companyId, existing, updated);
      
      // Also cancel associated approval if any
      setApprovals(apvs => apvs.map(a => (a.relatedId === id && a.status === 'Pendente') ? { ...a, status: 'Cancelada' } : a));

      return prev.map(p => p.id === id ? updated : p);
    });

    addNotification('Conta a Pagar Cancelada', 'Um registro financeiro a pagar foi cancelado e auditado.', 'WARNING');
  };

  const payAccountPayable = (id: string, date: string, receiptUrl?: string) => {
    setAccountsPayable(prev => {
      const existing = prev.find(p => p.id === id);
      if (!existing) return prev;

      const updated: AccountPayable = {
        ...existing,
        status: 'Paga',
        paymentDate: date,
        paymentReceiptUrl: receiptUrl || '#',
        updatedAt: new Date().toISOString()
      };

      // Deduct balance of the bank account
      setBankAccounts(accounts => accounts.map(ba => {
        if (ba.id === existing.bankAccountId) {
          return { ...ba, balance: ba.balance - existing.finalAmount };
        }
        return ba;
      }));

      createAuditLog('CONFIRMAR_PAGAMENTO', 'AccountPayable', id, existing.companyId, existing, updated);
      return prev.map(p => p.id === id ? updated : p);
    });

    addNotification('Pagamento Confirmado', `Pagamento de conta registrado e deduzido do saldo.`, 'SUCCESS');
  };

  // --- ACCOUNTS RECEIVABLE ACTIONS ---
  const addAccountReceivable = (data: Omit<AccountReceivable, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'receivedAmount' | 'status'>) => {
    if (!hasPermission('accounts-receivable.create')) return;

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
      status: 'Emitida',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setAccountsReceivable(prev => [...prev, newReceivable]);
    createAuditLog('CRIAR_CONTA_RECEBER', 'AccountReceivable', id, activeCompanyId, null, newReceivable);

    addNotification(
      'Conta a Receber Lançada',
      `Faturamento para "${data.customer}" no valor de R$ ${Number(data.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} lançado.`,
      'SUCCESS'
    );
  };

  const updateAccountReceivable = (id: string, updates: Partial<AccountReceivable>) => {
    if (!hasPermission('accounts-receivable.update')) return;

    setAccountsReceivable(prev => {
      const existing = prev.find(r => r.id === id);
      if (!existing) return prev;

      if (existing.status === 'Recebida') {
        console.error("Cannot modify received invoice.");
        return prev;
      }

      const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      merged.amount = Number(merged.amount);
      merged.interest = Number(merged.interest);
      merged.penalty = Number(merged.penalty);
      merged.discount = Number(merged.discount);

      createAuditLog('ATUALIZAR_CONTA_RECEBER', 'AccountReceivable', id, existing.companyId, existing, merged);
      return prev.map(r => r.id === id ? merged : r);
    });
  };

  const cancelAccountReceivable = (id: string) => {
    if (!hasPermission('accounts-receivable.cancel')) return;

    setAccountsReceivable(prev => {
      const existing = prev.find(r => r.id === id);
      if (!existing) return prev;

      const updated = { ...existing, status: 'Cancelada' as const, updatedAt: new Date().toISOString() };
      createAuditLog('CANCELAR_CONTA_RECEBER', 'AccountReceivable', id, existing.companyId, existing, updated);
      return prev.map(r => r.id === id ? updated : r);
    });

    addNotification('Conta a Receber Cancelada', 'O faturamento foi cancelado no sistema.', 'WARNING');
  };

  const receiveAccountReceivable = (id: string, amount: number, date: string) => {
    setAccountsReceivable(prev => {
      const existing = prev.find(r => r.id === id);
      if (!existing) return prev;

      const isFull = amount >= (existing.amount + existing.interest + existing.penalty - existing.discount);
      const updatedStatus = isFull ? 'Recebida' : 'Parcialmente recebida';

      const updated: AccountReceivable = {
        ...existing,
        receivedAmount: existing.receivedAmount + amount,
        status: updatedStatus,
        receiptDate: date,
        updatedAt: new Date().toISOString()
      };

      // Add balance of the bank account
      setBankAccounts(accounts => accounts.map(ba => {
        if (ba.id === existing.bankAccountId) {
          return { ...ba, balance: ba.balance + amount };
        }
        return ba;
      }));

      createAuditLog('RECEBER_CONTA_RECEBER', 'AccountReceivable', id, existing.companyId, existing, updated);
      return prev.map(r => r.id === id ? updated : r);
    });

    addNotification('Recebimento Confirmado', `Recebimento no valor de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} compensado com sucesso.`, 'SUCCESS');
  };

  // --- APPROVALS FLOW ---
  const approveOrReject = (approvalId: string, decision: 'Aprovada' | 'Rejeitada', comment: string) => {
    if (!hasPermission('approvals.approve')) return;

    setApprovals(prev => {
      const existing = prev.find(a => a.id === approvalId);
      if (!existing) return prev;

      const step = {
        id: `step-${Date.now()}`,
        userId: currentUser.id,
        userName: currentUser.name,
        role: currentUser.role,
        decision,
        comment,
        timestamp: new Date().toISOString(),
        ipAddress: '186.20.103.54',
        userAgent: navigator.userAgent
      };

      const updated: Approval = {
        ...existing,
        status: decision,
        justification: comment,
        history: [...existing.history, step]
      };

      // Cascade to the underlying account payable
      setAccountsPayable(payables => payables.map(ap => {
        if (ap.id === existing.relatedId) {
          const finalStatus = decision === 'Aprovada' ? 'Aprovada' : 'Rejeitada';
          return { ...ap, status: finalStatus, updatedAt: new Date().toISOString() };
        }
        return ap;
      }));

      createAuditLog(
        decision === 'Aprovada' ? 'APROVAR_PAGAMENTO' : 'REJEITAR_PAGAMENTO',
        'Approval',
        approvalId,
        existing.companyId,
        existing,
        updated
      );

      addNotification(
        decision === 'Aprovada' ? 'Pagamento Aprovado' : 'Pagamento Rejeitado',
        `Aprovação "${existing.description}" de R$ ${existing.amount.toLocaleString('pt-BR')} foi ${decision.toLowerCase()} por ${currentUser.name}.`,
        decision === 'Aprovada' ? 'SUCCESS' : 'WARNING'
      );

      return prev.map(a => a.id === approvalId ? updated : a);
    });
  };

  // --- DOCUMENTS MANAGEMENT ---
  const uploadDocument = (data: {
    name: string;
    description: string;
    category: Document['category'];
    competenceMonth: string;
    fileSize: string;
    mimeType: string;
    relatedEntityId?: string;
  }) => {
    if (!hasPermission('documents.upload')) return;

    const id = `doc-${Date.now()}`;
    const newDoc: Document = {
      ...data,
      id,
      companyId: activeCompanyId,
      uploadedAt: new Date().toISOString(),
      uploadedById: currentUser.id,
      uploadedByName: currentUser.name,
      hash: Math.random().toString(16).substr(2, 32),
      status: 'Pendente',
      signedUrl: `https://bpo-storage.com/${activeCompanyId}/doc-${id}?token=auto_${Math.random().toString(36).substr(2, 8)}`
    };

    setDocuments(prev => [...prev, newDoc]);
    createAuditLog('UPLOAD_DOCUMENTO', 'Document', id, activeCompanyId, null, newDoc);
    
    addNotification('Documento Enviado', `O arquivo "${data.name}" foi enviado com sucesso para a categoria ${data.category}.`, 'SUCCESS');
  };

  const deleteDocument = (id: string) => {
    setDocuments(prev => {
      const existing = prev.find(d => d.id === id);
      if (!existing) return prev;

      createAuditLog('DELETAR_DOCUMENTO', 'Document', id, existing.companyId, existing, null);
      return prev.filter(d => d.id !== id);
    });

    addNotification('Documento Removido', 'Um documento foi excluído do repositório da empresa.', 'INFO');
  };

  // --- BANK RECONCILIATION ---
  const importStatement = (bankAccountId: string) => {
    if (!hasPermission('reconciliation.execute')) return;

    // Simulate file import by copying items from BANK_STATEMENTS_TO_IMPORT if not already present
    const sourceItems = BANK_STATEMENTS_TO_IMPORT[bankAccountId] || [];
    
    setStatementItems(prev => {
      const current = prev[bankAccountId] || [];
      const nonDuplicate = sourceItems.filter(s => !current.some(c => c.id === s.id));
      
      const updated = [...current, ...nonDuplicate];
      createAuditLog('IMPORTAR_EXTRATO', 'BankAccount', bankAccountId, activeCompanyId, null, { importedCount: nonDuplicate.length });
      return { ...prev, [bankAccountId]: updated };
    });

    addNotification('Extrato Importado', 'O extrato bancário (OFX) foi importado e está pronto para conciliação.', 'SUCCESS');
  };

  const reconcileItemManually = (
    bankAccountId: string,
    statementItemId: string,
    financialRecordId: string,
    type: 'A_PAGAR' | 'A_RECEBER',
    notes: string
  ) => {
    if (!hasPermission('reconciliation.execute')) return;

    // Update statement item status
    setStatementItems(prev => {
      const items = prev[bankAccountId] || [];
      const updated = items.map(item => {
        if (item.id === statementItemId) {
          return {
            ...item,
            isReconciled: true,
            reconciliationStatus: 'Conciliada' as const,
            matchedTransactionId: financialRecordId
          };
        }
        return item;
      });
      return { ...prev, [bankAccountId]: updated };
    });

    // Update financial record and change status to PAID / RECEIVED
    const today = new Date().toISOString().split('T')[0];
    if (type === 'A_PAGAR') {
      const record = accountsPayable.find(ap => ap.id === financialRecordId);
      if (record && record.status !== 'Paga') {
        payAccountPayable(financialRecordId, today);
      }
    } else {
      const record = accountsReceivable.find(ar => ar.id === financialRecordId);
      if (record && record.status !== 'Recebida') {
        receiveAccountReceivable(financialRecordId, record.amount, today);
      }
    }

    createAuditLog('CONCILIACAO_MANUAL', 'StatementItem', statementItemId, activeCompanyId, null, { financialRecordId, type, notes });
    addNotification('Conciliação Concluída', 'Transação e lançamento bancário associados com sucesso.', 'SUCCESS');
  };

  const autoReconcileBank = (bankAccountId: string) => {
    if (!hasPermission('reconciliation.execute')) return;

    const items = statementItems[bankAccountId] || [];
    let matchedCount = 0;

    const updatedItems = items.map(item => {
      if (item.isReconciled) return item;

      // Try matching accounts payable (negative statement amount)
      if (item.amount < 0) {
        const absoluteAmount = Math.abs(item.amount);
        const match = accountsPayable.find(
          ap => ap.bankAccountId === bankAccountId && 
          Math.abs(ap.finalAmount - absoluteAmount) < 0.01 && 
          ap.status !== 'Paga'
        );

        if (match) {
          matchedCount++;
          // Immediately pay
          const today = new Date().toISOString().split('T')[0];
          setTimeout(() => payAccountPayable(match.id, today), 0);
          return {
            ...item,
            isReconciled: true,
            reconciliationStatus: 'Conciliada' as const,
            matchedTransactionId: match.id
          };
        }
      } else {
        // Try matching accounts receivable (positive statement amount)
        const match = accountsReceivable.find(
          ar => ar.bankAccountId === bankAccountId && 
          Math.abs(ar.amount - item.amount) < 0.01 && 
          ar.status !== 'Recebida'
        );

        if (match) {
          matchedCount++;
          const today = new Date().toISOString().split('T')[0];
          setTimeout(() => receiveAccountReceivable(match.id, match.amount, today), 0);
          return {
            ...item,
            isReconciled: true,
            reconciliationStatus: 'Conciliada' as const,
            matchedTransactionId: match.id
          };
        }
      }

      return item;
    });

    setStatementItems(prev => ({ ...prev, [bankAccountId]: updatedItems }));
    createAuditLog('AUTO_CONCILIACAO', 'BankAccount', bankAccountId, activeCompanyId, null, { matchedCount });
    addNotification('Conciliação Automática', `O sistema analisou os lançamentos e conciliou ${matchedCount} itens de forma inteligente.`, 'SUCCESS');
  };

  const ignoreStatementItem = (bankAccountId: string, statementItemId: string, reason: string) => {
    setStatementItems(prev => {
      const items = prev[bankAccountId] || [];
      const updated = items.map(item => {
        if (item.id === statementItemId) {
          return {
            ...item,
            isReconciled: true,
            reconciliationStatus: 'Ignorada' as const
          };
        }
        return item;
      });
      return { ...prev, [bankAccountId]: updated };
    });

    createAuditLog('IGNORAR_ITEM_EXTRATO', 'StatementItem', statementItemId, activeCompanyId, null, { reason });
    addNotification('Item de Extrato Ignorado', 'Lançamento bancário marcado como ignorado na conciliação.', 'INFO');
  };

  // --- REPORT GENERATION ---
  const generateReport = (name: string, type: string, filters: string) => {
    if (!hasPermission('reports.generate')) return;

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
      fileSize: `${Math.floor(Math.random() * 400) + 100} KB`
    };

    setReports(prev => [newReport, ...prev]);
    createAuditLog('GERAR_RELATORIO', 'Report', id, activeCompanyId, null, newReport);
    addNotification('Relatório Pronto', `O relatório "${name}" foi compilado e está pronto para visualização.`, 'SUCCESS');
  };

  // --- ADMINISTRATION: COMPANIES & CLIENTS ---
  const addCompany = (data: Omit<Company, 'id' | 'createdAt' | 'status'>) => {
    if (currentUser.role !== 'BPO_ADMIN') return;

    const id = `c-${Date.now()}`;
    const newCompany: Company = {
      ...data,
      id,
      status: 'Implantação',
      createdAt: new Date().toISOString()
    };

    setCompanies(prev => [...prev, newCompany]);
    
    // Auto add default bank account for new company
    const newBank: BankAccount = {
      id: `ba-${id}-itau`,
      companyId: id,
      bankName: 'Banco Itaú S.A.',
      agency: '0001',
      accountNumber: '10001-1',
      type: 'Corrente',
      balance: 0
    };
    setBankAccounts(prev => [...prev, newBank]);

    createAuditLog('CRIAR_EMPRESA', 'Company', id, id, null, newCompany);
    addNotification('Nova Empresa Cadastrada', `A empresa "${data.tradeName}" foi integrada em modo de implantação.`, 'SUCCESS');
  };

  const updateCompanyStatus = (id: string, status: Company['status']) => {
    if (currentUser.role !== 'BPO_ADMIN') return;

    setCompanies(prev => {
      const existing = prev.find(c => c.id === id);
      if (!existing) return prev;

      const updated = { ...existing, status };
      createAuditLog('ALTERAR_STATUS_EMPRESA', 'Company', id, id, existing, updated);
      return prev.map(c => c.id === id ? updated : c);
    });

    addNotification('Status de Empresa Atualizado', `A empresa mudou seu status operacional para ${status}.`, 'INFO');
  };

  // --- TEAM MANAGEMENT ---
  const addTeamMember = (data: Omit<User, 'id'>) => {
    if (currentUser.role !== 'BPO_ADMIN') return;

    const id = `u-${Date.now()}`;
    const newUser: User = {
      ...data,
      id
    };

    setUsers(prev => [...prev, newUser]);
    createAuditLog('CONVIDAR_COLABORADOR', 'User', id, undefined, null, newUser);
    addNotification('Membro de Equipe Convidado', `O convite foi enviado para o email: ${data.email}.`, 'SUCCESS');
  };

  const updateTeamMemberPermissions = (id: string, permissions: string[], status?: 'ACTIVE' | 'INACTIVE') => {
    if (currentUser.role !== 'BPO_ADMIN') return;

    setUsers(prev => {
      const existing = prev.find(u => u.id === id);
      if (!existing) return prev;

      const updated = {
        ...existing,
        permissions,
        status: status || existing.status
      };
      
      createAuditLog('ALTERAR_PERMISSOES_USUARIO', 'User', id, undefined, existing, updated);
      return prev.map(u => u.id === id ? updated : u);
    });

    addNotification('Permissões Atualizadas', 'As permissões de RBAC foram salvas no perfil do colaborador.', 'SUCCESS');
  };

  return (
    <BPOContext.Provider
      value={{
        tenants,
        companies,
        users,
        bankAccounts,
        accountsPayable,
        accountsReceivable,
        approvals,
        documents,
        auditLogs,
        notifications,
        reports,
        statementItems,
        currentUser,
        activeCompany,
        activeTenant,
        switchUser,
        switchCompany,
        hasPermission,
        addAccountPayable,
        updateAccountPayable,
        cancelAccountPayable,
        payAccountPayable,
        addAccountReceivable,
        updateAccountReceivable,
        cancelAccountReceivable,
        receiveAccountReceivable,
        approveOrReject,
        uploadDocument,
        deleteDocument,
        importStatement,
        reconcileItemManually,
        autoReconcileBank,
        ignoreStatementItem,
        generateReport,
        addCompany,
        updateCompanyStatus,
        addTeamMember,
        updateTeamMemberPermissions,
        addNotification,
        markNotificationRead,
        clearNotifications
      }}
    >
      {children}
    </BPOContext.Provider>
  );
}

export function useBPOState() {
  const context = useContext(BPOContext);
  if (context === undefined) {
    throw new Error('useBPOState must be used within a BPOProvider');
  }
  return context;
}
