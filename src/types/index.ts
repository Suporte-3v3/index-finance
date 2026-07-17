/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = "BPO_ADMIN" | "BPO_TEAM" | "CLIENT" | "ACCOUNTANT";

export type CompanyStatus =
  | "Em dia"
  | "OK"
  | "Atenção"
  | "Atraso"
  | "Sem movimentação"
  | "Implantação"
  | "Inativo";

export interface Tenant {
  id: string; // UUID
  name: string; // Tenant name (e.g. "Grupo Nobre")
  createdAt: string;
  plan: string; // Premium, Basic, Custom
  status: "ACTIVE" | "INACTIVE";
}

export interface Company {
  id: string; // UUID
  tenantId: string;
  cnpj: string;
  corporateName: string;
  tradeName: string;
  segment: string;
  taxRegime: string; // Simples Nacional, Lucro Presumido, Lucro Real
  accountantName: string;
  accountantEmail: string;
  primaryContactName: string;
  primaryContactEmail: string;
  bpoResponsibleId: string; // User ID of BPO analyst
  createdAt: string;
  status: CompanyStatus;
  approvalLimit: number; // Max amount before requiring multi-level BPO admin approval
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  status: "ACTIVE" | "INACTIVE";
  title?: string;
  companies?: string[]; // Allowed company IDs
  permissions: string[]; // Granular permission list
}

export interface BankAccount {
  id: string;
  companyId: string;
  bankName: string;
  agency: string;
  accountNumber: string;
  type: "Corrente" | "Poupança" | "Investimento";
  balance: number;
}

export type MasterDataType =
  | "CATEGORY"
  | "SUBCATEGORY"
  | "PAYMENT_METHOD"
  | "COST_CENTER"
  | "DOCUMENT_TYPE"
  | "SUPPLIER"
  | "CUSTOMER";
export interface MasterDataOption {
  id: string;
  companyId: string;
  type: MasterDataType;
  name: string;
  parentId?: string;
  active: boolean;
  createdAt: string;
}

export interface AccountPayable {
  id: string;
  companyId: string;
  description: string;
  supplier: string;
  category: string;
  costCenter: string;
  competenceMonth: string; // YYYY-MM
  issueDate: string;
  dueDate: string;
  amount: number;
  interest: number;
  penalty: number;
  discount: number;
  finalAmount: number;
  paymentMethod: string;
  bankAccountId: string;
  recurrence: "Nenhuma" | "Semanal" | "Mensal" | "Trimestral" | "Anual";
  documentNumber: string;
  notes: string;
  attachmentUrl?: string;
  attachmentName?: string;
  status:
    | "Rascunho"
    | "Pendente"
    | "Aguardando aprovação"
    | "A vencer"
    | "Aprovada"
    | "Agendada"
    | "Paga"
    | "Vencida"
    | "Rejeitada"
    | "Cancelada";
  responsibleId: string;
  needsApproval: boolean;
  paymentDate?: string;
  paymentReceiptUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountReceivable {
  id: string;
  companyId: string;
  description: string;
  customer: string;
  category: string;
  costCenter: string;
  competenceMonth: string; // YYYY-MM
  issueDate: string;
  dueDate: string;
  amount: number;
  interest: number;
  penalty: number;
  discount: number;
  receivedAmount: number;
  paymentMethod: string;
  bankAccountId: string;
  recurrence: "Nenhuma" | "Semanal" | "Mensal" | "Trimestral" | "Anual";
  documentNumber: string;
  notes: string;
  attachmentUrl?: string;
  attachmentName?: string;
  status:
    | "Rascunho"
    | "Pendente"
    | "Emitida"
    | "A receber"
    | "Parcialmente recebido"
    | "Parcialmente recebida"
    | "Recebido"
    | "Recebida"
    | "Vencido"
    | "Vencida"
    | "Em cobrança"
    | "Negociada"
    | "Cancelado"
    | "Cancelada";
  responsibleId: string;
  receiptDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Approval {
  id: string;
  companyId: string;
  type: "PAGAMENTO" | "DOCUMENTO" | "SENSIVEL";
  relatedId: string; // Reference to AccountPayable or Document
  description: string;
  amount: number;
  dueDate: string;
  requesterId: string;
  requesterName: string;
  dueDateApproval: string;
  status:
    | "Pendente"
    | "Aprovada"
    | "Rejeitada"
    | "Ajuste solicitado"
    | "Cancelada"
    | "Expirada";
  justification?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  createdAt: string;
  history: ApprovalStep[];
}

export interface ApprovalStep {
  id: string;
  userId: string;
  userName: string;
  role: UserRole;
  decision: "Aprovada" | "Rejeitada" | "Ajuste solicitado" | "Cancelada";
  comment: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
}

export interface Document {
  id: string;
  companyId: string;
  category:
    | "Nota fiscal"
    | "Boleto"
    | "Comprovante"
    | "Extrato"
    | "Contrato"
    | "Recibo"
    | "Relatório"
    | "Documento contábil"
    | "Outros";
  name: string;
  description: string;
  competenceMonth: string; // YYYY-MM
  uploadedAt: string;
  uploadedById: string;
  uploadedByName: string;
  fileSize: string;
  mimeType: string;
  hash: string;
  relatedEntityId?: string; // e.g. payable or receivable ID
  status:
    "Aguardando Análise" | "Aguardando Aprovação" | "Lançado" | "Cancelado";
  signedUrl?: string;
  aiSummary?: string;
  extractedData?: Record<string, string>;
  processingConfidence?: number;
  supplier?: string;
  dueDate?: string;
  expenseType?: string;
  documentNumber?: string;
  amount?: number;
  analysisWarnings?: string[];
  entryType?: "Conta a Pagar" | "Conta a Receber" | "Transferência";
  costCenter?: string;
  bankAccountId?: string;
  destinationBankAccountId?: string;
  paymentMethod?: string;
  recurrence?: "Nenhuma" | "Semanal" | "Mensal" | "Trimestral" | "Anual";
  notes?: string;
  origin?: "Manual" | "Documento";
  launchedById?: string;
  launchedByName?: string;
  launchedAt?: string;
}

export interface BankStatementItem {
  id: string;
  date: string;
  description: string;
  amount: number; // positive for income, negative for expense
  documentNumber?: string;
  isReconciled: boolean;
  reconciliationStatus:
    | "Pendente"
    | "Conciliada"
    | "Parcialmente conciliada"
    | "Divergente"
    | "Ignorada";
  matchedTransactionId?: string;
}

export interface ReconciliationRecord {
  id: string;
  companyId: string;
  bankAccountId: string;
  statementItemId: string;
  financialRecordId: string; // AccountPayable or AccountReceivable
  type: "A_PAGAR" | "A_RECEBER";
  reconciledAt: string;
  reconciledById: string;
  reconciledByName: string;
  notes: string;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  companyId?: string;
  companyName?: string;
  userId: string;
  userName: string;
  role: UserRole;
  action: string; // e.g. "CRIAR_CONTA_PAGAR", "APROVAR_PAGAMENTO", "ALTERAR_VALOR"
  entityType: string;
  entityId: string;
  previousData?: string; // JSON string
  nextData?: string; // JSON string
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  origin: string; // e.g., "Web App"
}

export interface Notification {
  id: string;
  companyId?: string;
  userId?: string; // if targeted, otherwise global
  title: string;
  message: string;
  type: "INFO" | "WARNING" | "SUCCESS" | "ALERT";
  isRead: boolean;
  createdAt: string;
  relatedLink?: string;
}

export interface ReportRecord {
  id: string;
  companyId: string;
  name: string;
  type: string;
  filters: string;
  generatedAt: string;
  generatedById: string;
  generatedByName: string;
  fileUrl: string;
  fileSize: string;
}

export type SupportTicketStatus =
  | "ABERTO"
  | "EM_ATENDIMENTO"
  | "AGUARDANDO_SOLICITANTE"
  | "RESOLVIDO"
  | "ENCERRADO";
export type SupportTicketPriority = "BAIXA" | "NORMAL" | "ALTA" | "URGENTE";

export interface SupportAttachment {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface SupportMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  createdAt: string;
  attachments?: SupportAttachment[];
}

export interface SupportTicket {
  id: string;
  protocol: string;
  companyId: string;
  requesterId: string;
  requesterName: string;
  requesterRole: UserRole;
  category:
    | "FINANCEIRO"
    | "DOCUMENTOS"
    | "PAGAMENTOS"
    | "RECEBIMENTOS"
    | "CONTABIL"
    | "ACESSO"
    | "OUTROS";
  subject: string;
  description: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  assignedToId?: string;
  assignedToName?: string;
  createdAt: string;
  updatedAt: string;
  messages: SupportMessage[];
}
