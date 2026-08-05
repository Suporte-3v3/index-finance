/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = "BPO_ADMIN" | "BPO_TEAM" | "CLIENT" | "ACCOUNTANT";

export type ClientModule =
  | "dashboard"
  | "approvals"
  | "documents"
  | "cash-flow"
  | "reports"
  | "support"
  | "bakery-cash";

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
  clientModules?: ClientModule[]; // Modules enabled in the client workspace for this company
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "ACTIVE" | "INACTIVE";
  title?: string;
  companies?: string[]; // Allowed company IDs
  permissions: string[]; // Granular permission list
  // Quando role === "CLIENT": restringe o usuário a "Operador do cliente",
  // com acesso apenas ao saldo diário da Bolsa (não ao saldo acumulado).
  clientOperator?: boolean;
  // Senha individual definida na criação do usuário. Usuários sem senha
  // própria (contas seed) continuam autenticando com a senha de acesso
  // padrão da plataforma.
  password?: string;
}

export interface BankAccount {
  id: string;
  companyId: string;
  bankName: string;
  agency: string;
  accountNumber: string;
  type: "Corrente" | "Poupança" | "Investimento";
  balance: number;
  isBolsaAccount?: boolean; // Conta interna "Bolsa" do módulo Caixa da Padaria
}

export type MasterDataType =
  | "CATEGORY"
  | "SUBCATEGORY"
  | "PAYMENT_METHOD"
  | "COST_CENTER"
  | "DOCUMENT_TYPE"
  | "SUPPLIER"
  | "CUSTOMER"
  | "BAKERY_REGISTER";
export interface MasterDataOption {
  id: string;
  companyId: string;
  type: MasterDataType;
  name: string;
  parentId?: string;
  active: boolean;
  createdAt: string;
}

export interface AccountPayablePayment {
  id: string;
  date: string;
  amount: number; // valor efetivamente debitado do banco nesta baixa
  bankAccountId: string;
  bankAccountName: string;
  interest: number; // juros lançados nesta baixa (além dos já previstos no título)
  penalty: number; // multa lançada nesta baixa
  discount: number; // desconto concedido nesta baixa
  notes?: string;
  receiptUrl?: string;
  registeredById: string;
  registeredByName: string;
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
  recurrence: "Nenhuma" | "Semanal" | "Mensal" | "Trimestral" | "Anual" | "Parcelada";
  // Preenchidos quando recurrence === "Parcelada": ligam as parcelas da
  // mesma compra e identificam a posição de cada uma.
  installmentGroupId?: string;
  installmentNumber?: number;
  installmentCount?: number;
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
    | "Parcialmente paga"
    | "Vencida"
    | "Rejeitada"
    | "Cancelada";
  responsibleId: string;
  needsApproval: boolean;
  paymentDate?: string;
  paymentReceiptUrl?: string;
  paidAmount?: number; // soma de tudo já baixado (paymentHistory)
  paymentHistory?: AccountPayablePayment[];
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
  recurrence: "Nenhuma" | "Semanal" | "Mensal" | "Trimestral" | "Anual" | "Parcelada";
  // Preenchidos quando recurrence === "Parcelada": ligam as parcelas da
  // mesma venda/fatura e identificam a posição de cada uma.
  installmentGroupId?: string;
  installmentNumber?: number;
  installmentCount?: number;
  documentNumber: string;
  notes: string;
  attachmentUrl?: string;
  attachmentName?: string;
  // Forma única e canônica por status (mesmo princípio do AccountPayable acima):
  // o carregamento em useBPOState normaliza qualquer variante legada ("Emitida",
  // "Recebida", "Vencida", "Cancelada", "Parcialmente recebida") para estas.
  status:
    | "Rascunho"
    | "Pendente"
    | "A receber"
    | "Parcialmente recebido"
    | "Recebido"
    | "Vencido"
    | "Em cobrança"
    | "Negociada"
    | "Cancelado";
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
  requesterRole?: UserRole;
  recipientId?: string;
  recipientName?: string;
  recipientRole?: Extract<UserRole, "CLIENT" | "ACCOUNTANT">;
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
  recipientId?: string;
  recipientName?: string;
  recipientRole?: Extract<UserRole, "CLIENT" | "ACCOUNTANT">;
  sharedById?: string;
  sharedByName?: string;
  sharedByRole?: Extract<UserRole, "BPO_ADMIN" | "BPO_TEAM">;
  sharedAt?: string;
  fileSize: string;
  mimeType: string;
  hash: string;
  relatedEntityId?: string; // e.g. payable or receivable ID
  status:
    | "Aguardando Análise"
    | "Aguardando Aprovação"
    | "Compartilhado"
    | "Lançado"
    | "Cancelado";
  purpose?: "PROCESSING" | "VIEW_ONLY";
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
  recurrence?: "Nenhuma" | "Semanal" | "Mensal" | "Trimestral" | "Anual" | "Parcelada";
  installmentCount?: number;
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
  format?: ReportExportFormat;
  fileName?: string;
  mimeType?: string;
  fileContent?: string;
  fileUrl?: string;
  fileSize: string;
  // Preenchidos quando o relatório foi montado pelo construtor por blocos
  // (Central de Relatórios) a partir de um modelo salvo.
  templateId?: string;
  templateName?: string;
  // Preenchidos quando o relatório foi enviado a um cliente ou contador via
  // Central de Documentos.
  recipientId?: string;
  recipientName?: string;
  recipientRole?: Extract<UserRole, "CLIENT" | "ACCOUNTANT">;
}

export type ReportExportFormat = "PDF" | "EXCEL";

export interface ReportGenerationOptions {
  format: ReportExportFormat;
  startDate?: string;
  endDate?: string;
  bankAccountId?: string;
  category?: string;
  costCenter?: string;
}

// --- Central de Relatórios: construtor por blocos ---

export type ReportModelType =
  | "Contas a Pagar"
  | "Contas a Receber"
  | "Fluxo de Caixa"
  | "DRE Gerencial";

export type ReportBlockKey =
  // Contas a Pagar
  | "AP_SUMMARY"
  | "AP_OVERDUE"
  | "AP_UPCOMING"
  | "AP_BY_CATEGORY"
  | "AP_BY_COST_CENTER"
  | "AP_BY_SUPPLIER"
  | "AP_DETAIL_LIST"
  // Contas a Receber
  | "AR_SUMMARY"
  | "AR_OVERDUE"
  | "AR_BY_CUSTOMER"
  | "AR_BY_CATEGORY"
  | "AR_BY_COST_CENTER"
  | "AR_MONTHLY_EVOLUTION"
  | "AR_DETAIL_LIST"
  // Fluxo de Caixa
  | "CF_BALANCE_SUMMARY"
  | "CF_REALIZED_IN_OUT"
  | "CF_FORECAST_VS_REALIZED"
  | "CF_BY_PERIOD"
  | "CF_BY_CATEGORY"
  | "CF_DETAIL_LIST";

export type ReportBlockVisualization = "bar" | "pie" | "table";

export interface ReportBlockConfig {
  instanceId: string;
  blockKey: ReportBlockKey;
  title?: string;
  visualization?: ReportBlockVisualization;
  limit?: number;
  showPercent?: boolean;
  compareWithPreviousPeriod?: boolean;
  // Usado apenas pelos blocos de lista detalhada (*_DETAIL_LIST).
  columns?: string[];
}

export type ReportDateBasis = "due" | "payment" | "competence";
export type CashFlowReportView = "realized" | "projected" | "both";
export type CashFlowReportGrouping = "daily" | "weekly" | "monthly";

export interface ReportFilters {
  startDate: string;
  endDate: string;
  dateBasis: ReportDateBasis;
  compareWithPreviousPeriod?: boolean;
  supplier?: string;
  customer?: string;
  category?: string;
  costCenter?: string;
  bankAccountId?: string;
  status?: string;
  paymentMethod?: string;
  cashFlowView?: CashFlowReportView;
  cashFlowGrouping?: CashFlowReportGrouping;
}

// DRE gerencial simplificada (Receita Bruta -> Despesas por Categoria ->
// Resultado Líquido). Sem plano de contas configurável nesta versão.
export interface DreReportOptions {
  compareWithPreviousPeriod?: boolean;
  showPercent?: boolean;
  detailed?: boolean;
  costCenter?: string;
  comment?: string;
}

export interface ReportTemplate {
  id: string;
  companyId: string;
  name: string;
  modelType: ReportModelType;
  blocks: ReportBlockConfig[];
  // Filtros padrão do modelo salvo (sem período, que é escolhido a cada
  // geração).
  filters: Omit<ReportFilters, "startDate" | "endDate">;
  dreOptions?: DreReportOptions;
  favorite: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  createdByName: string;
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

// --- Módulo Caixa da Padaria ---

export type BakeryShiftStatus =
  | "Aberto"
  | "Aguardando fechamento"
  | "Fechado"
  | "Reaberto"
  | "Cancelado";

export interface BakeryCardMachineEntry {
  id: string;
  bankAccountId: string; // A maquininha é da conta bancária que recebe o repasse
  bankAccountName: string;
  amount: number;
}

export interface BakeryShiftCloseSnapshot {
  closedAt: string;
  finalBalanceCounted: number;
  estimatedCashRevenue: number;
  pixRevenueTotal: number;
  cardMachineTotal: number;
  cardMachineEntries: BakeryCardMachineEntry[];
  totalRevenue: number;
  changedById: string;
  changedByName: string;
  reason?: string;
}

export interface BakeryShift {
  id: string;
  companyId: string;
  registerId: string;
  registerName: string;
  shiftLabel: string; // "Manhã" | "Tarde" | "Noite" | personalizado
  operatorId: string;
  operatorName: string;
  status: BakeryShiftStatus;
  openedAt: string;
  initialBalance: number;
  openNote?: string;
  initialBalanceJustification?: string;
  // Saldo final do último turno fechado deste caixa, capturado no momento da
  // abertura — usado para apontar a diferença no fechamento deste turno.
  previousShiftFinalBalance?: number;
  closedAt?: string;
  finalBalanceCounted?: number;
  closeNote?: string;
  estimatedCashRevenue?: number;
  pixRevenueTotal?: number;
  cardMachineEntries?: BakeryCardMachineEntry[];
  cardMachineTotal?: number;
  totalRevenue?: number;
  reopenedAt?: string;
  reopenedById?: string;
  reopenedByName?: string;
  reopenReason?: string;
  closeHistory: BakeryShiftCloseSnapshot[];
}

export interface BakeryExpense {
  id: string;
  companyId: string;
  shiftId: string;
  description: string;
  supplier?: string;
  amount: number;
  source: "CAIXA" | "BOLSA";
  category?: string;
  note?: string;
  receiptUrl?: string;
  createdAt: string;
  createdById: string;
  createdByName: string;
  canceled?: boolean;
  canceledAt?: string;
  canceledById?: string;
}

export interface BakeryWithdrawal {
  id: string;
  companyId: string;
  shiftId: string;
  amount: number;
  note?: string;
  receiptUrl?: string;
  createdAt: string;
  createdById: string;
  createdByName: string;
  canceled?: boolean;
  canceledAt?: string;
  canceledById?: string;
}

export type BakeryPixReconciliationStatus =
  | "Aguardando conciliação"
  | "Conciliado"
  | "Divergente";

export interface BakeryPixSale {
  id: string;
  companyId: string;
  shiftId: string;
  amount: number;
  bankAccountId: string;
  bankAccountName: string;
  customerName?: string;
  description?: string;
  note?: string;
  receiptUrl?: string;
  createdAt: string;
  createdById: string;
  createdByName: string;
  reconciliationStatus: BakeryPixReconciliationStatus;
  reconciledAt?: string;
  reconciledById?: string;
  canceled?: boolean;
  canceledAt?: string;
  canceledById?: string;
}
