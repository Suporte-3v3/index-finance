/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Tenant,
  Company,
  User,
  BankAccount,
  AccountPayable,
  AccountReceivable,
  Approval,
  Document,
  BankStatementItem,
  AuditLog,
  Notification,
  ReportRecord
} from '../types';

export const INITIAL_TENANTS: Tenant[] = [
  {
    id: 't-1111-1111',
    name: 'Index Finance SaaS',
    createdAt: '2026-01-10T10:00:00Z',
    plan: 'Premium Enterprise',
    status: 'ACTIVE',
  },
  {
    id: 't-2222-2222',
    name: 'Index Finance Premium',
    createdAt: '2026-03-15T09:00:00Z',
    plan: 'Professional',
    status: 'ACTIVE',
  }
];

export const INITIAL_COMPANIES: Company[] = [
  {
    id: 'c-101',
    tenantId: 't-1111-1111',
    cnpj: '12.345.678/0001-90',
    corporateName: 'Alfa Tecnologia e Desenvolvimento Ltda',
    tradeName: 'Alfa Tecnologia',
    segment: 'Tecnologia',
    taxRegime: 'Simples Nacional',
    accountantName: 'Contador Geral Silva',
    accountantEmail: 'silva.contabil@exemplo.com.br',
    primaryContactName: 'Carlos Oliveira',
    primaryContactEmail: 'carlos.alfa@exemplo.com.br',
    bpoResponsibleId: 'u-bpo-analyst',
    createdAt: '2026-01-15T14:30:00Z',
    status: 'Em dia',
    approvalLimit: 10000,
  },
  {
    id: 'c-102',
    tenantId: 't-1111-1111',
    cnpj: '98.765.432/0001-21',
    corporateName: 'Sabor Imperial Alimentos e Bebidas S.A.',
    tradeName: 'Restaurante Sabor Imperial',
    segment: 'Alimentação',
    taxRegime: 'Lucro Presumido',
    accountantName: 'Maria Contabilidade',
    accountantEmail: 'maria.contadora@exemplo.com.br',
    primaryContactName: 'Isabella Costa',
    primaryContactEmail: 'isabella.sabor@exemplo.com.br',
    bpoResponsibleId: 'u-bpo-analyst',
    createdAt: '2026-02-10T11:15:00Z',
    status: 'Atraso',
    approvalLimit: 5000,
  },
  {
    id: 'c-103',
    tenantId: 't-1111-1111',
    cnpj: '45.678.901/0001-34',
    corporateName: 'Clínica de Especialidades Saúde e Vida Ltda',
    tradeName: 'Clínica Saúde & Vida',
    segment: 'Saúde',
    taxRegime: 'Lucro Real',
    accountantName: 'Silva & Associados Contabilidade',
    accountantEmail: 'contato@silvaassociados.com.br',
    primaryContactName: 'Dr. Roberto Mendes',
    primaryContactEmail: 'roberto.mendes@saudevida.com.br',
    bpoResponsibleId: 'u-bpo-admin',
    createdAt: '2026-03-01T08:00:00Z',
    status: 'Atenção',
    approvalLimit: 15000,
  }
];

export const INITIAL_USERS: User[] = [
  {
    id: 'u-bpo-admin',
    name: 'Ana Paula (BPO Admin)',
    email: 'anapaula.bpo@exemplo.com.br',
    role: 'BPO_ADMIN',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    status: 'ACTIVE',
    title: 'Diretora de Operações BPO',
    companies: ['c-101', 'c-102', 'c-103'],
    permissions: [
      'operations-center.view',
      'companies.manage',
      'team.manage',
      'audit-logs.view',
      'accounts-payable.view',
      'accounts-payable.create',
      'accounts-payable.update',
      'accounts-payable.cancel',
      'accounts-receivable.view',
      'accounts-receivable.create',
      'accounts-receivable.update',
      'accounts-receivable.cancel',
      'approvals.request',
      'approvals.approve',
      'documents.upload',
      'documents.download',
      'reports.generate',
      'reconciliation.execute',
      'notifications.manage'
    ]
  },
  {
    id: 'u-bpo-analyst',
    name: 'Pedro Analista (BPO Team)',
    email: 'pedro.analista@exemplo.com.br',
    role: 'BPO_TEAM',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    status: 'ACTIVE',
    title: 'Analista Financeiro Pleno',
    companies: ['c-101', 'c-102'], // Assigned only to 2 companies
    permissions: [
      'accounts-payable.view',
      'accounts-payable.create',
      'accounts-payable.update',
      'accounts-payable.cancel',
      'accounts-receivable.view',
      'accounts-receivable.create',
      'accounts-receivable.update',
      'accounts-receivable.cancel',
      'approvals.request',
      'documents.upload',
      'documents.download',
      'reports.generate',
      'reconciliation.execute'
    ]
  },
  {
    id: 'u-client-admin',
    name: 'Naylton Nobre (Cliente Alfa)',
    email: 'nayltonnobre@gmail.com', // Active user
    role: 'CLIENT',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    status: 'ACTIVE',
    title: 'Diretor Financeiro Alfa',
    companies: ['c-101'], // Isolated access
    permissions: [
      'dashboard.view',
      'approvals.approve',
      'documents.upload',
      'documents.download',
      'reports.view',
      'reports.generate'
    ]
  },
  {
    id: 'u-client-sabor',
    name: 'Isabella Costa (Cliente Sabor)',
    email: 'isabella.sabor@exemplo.com.br',
    role: 'CLIENT',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    status: 'ACTIVE',
    title: 'Gerente Geral Sabor',
    companies: ['c-102'], // Isolated access
    permissions: [
      'dashboard.view',
      'approvals.approve',
      'documents.upload',
      'documents.download',
      'reports.view'
    ]
  },
  {
    id: 'u-accountant',
    name: 'Contador Silva (Contador)',
    email: 'silva.contabil@exemplo.com.br',
    role: 'ACCOUNTANT',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    status: 'ACTIVE',
    title: 'Contador Credenciado CRC',
    companies: ['c-101', 'c-102', 'c-103'],
    permissions: [
      'documents.download',
      'reports.view',
      'reports.generate'
    ]
  }
];

export const INITIAL_BANK_ACCOUNTS: BankAccount[] = [
  {
    id: 'ba-101-itau',
    companyId: 'c-101',
    bankName: 'Banco Itaú S.A.',
    agency: '0342',
    accountNumber: '48392-1',
    type: 'Corrente',
    balance: 85430.50,
  },
  {
    id: 'ba-101-santander',
    companyId: 'c-101',
    bankName: 'Banco Santander',
    agency: '1240',
    accountNumber: '99203-8',
    type: 'Corrente',
    balance: 14500.00,
  },
  {
    id: 'ba-102-itau',
    companyId: 'c-102',
    bankName: 'Banco Itaú S.A.',
    agency: '0342',
    accountNumber: '22830-5',
    type: 'Corrente',
    balance: 1205.20, // Low balance, overdue bills
  },
  {
    id: 'ba-103-brasil',
    companyId: 'c-103',
    bankName: 'Banco do Brasil S.A.',
    agency: '4829',
    accountNumber: '10938-2',
    type: 'Corrente',
    balance: 154200.00,
  }
];

export const INITIAL_ACCOUNTS_PAYABLE: AccountPayable[] = [
  {
    id: 'ap-201',
    companyId: 'c-101',
    description: 'Assinatura AWS Cloud Server Hosting',
    supplier: 'Amazon Web Services Inc',
    category: 'Infraestrutura TI',
    costCenter: 'Operações e P&D',
    competenceMonth: '2026-07',
    issueDate: '2026-07-01',
    dueDate: '2026-07-15', // Near due date
    amount: 15420.00,
    interest: 0,
    penalty: 0,
    discount: 0,
    finalAmount: 15420.00,
    paymentMethod: 'Boleto Bancário',
    bankAccountId: 'ba-101-itau',
    recurrence: 'Mensal',
    documentNumber: 'AWS-2026-07-012',
    notes: 'Servidor de Produção Alfa Cloud e backups.',
    attachmentUrl: '#',
    attachmentName: 'fatura_aws_julho.pdf',
    status: 'Aguardando aprovação', // Triggers approval flow
    responsibleId: 'u-bpo-analyst',
    needsApproval: true,
    createdAt: '2026-07-02T10:00:00Z',
    updatedAt: '2026-07-02T10:00:00Z',
  },
  {
    id: 'ap-202',
    companyId: 'c-101',
    description: 'Serviço de Limpeza e Conservação',
    supplier: 'Limpa Tudo Serviços Eireli',
    category: 'Manutenção e Conservação',
    costCenter: 'Administrativo',
    competenceMonth: '2026-07',
    issueDate: '2026-07-01',
    dueDate: '2026-07-10',
    amount: 1200.00,
    interest: 0,
    penalty: 0,
    discount: 50.00,
    finalAmount: 1150.00,
    paymentMethod: 'Pix',
    bankAccountId: 'ba-101-itau',
    recurrence: 'Mensal',
    documentNumber: 'NF-1039',
    notes: 'Valor negociado com desconto por pagamento antecipado.',
    attachmentUrl: '#',
    attachmentName: 'nota_fiscal_limpeza_1039.pdf',
    status: 'Paga', // Paid
    paymentDate: '2026-07-08',
    paymentReceiptUrl: '#',
    responsibleId: 'u-bpo-analyst',
    needsApproval: false,
    createdAt: '2026-07-01T15:00:00Z',
    updatedAt: '2026-07-08T09:30:00Z',
  },
  {
    id: 'ap-203',
    companyId: 'c-101',
    description: 'Assessoria de Marketing Digital',
    supplier: 'Agência Buzz Digital',
    category: 'Publicidade e Propaganda',
    costCenter: 'Comercial e Marketing',
    competenceMonth: '2026-07',
    issueDate: '2026-07-05',
    dueDate: '2026-07-20',
    amount: 3500.00,
    interest: 0,
    penalty: 0,
    discount: 0,
    finalAmount: 3500.00,
    paymentMethod: 'Pix',
    bankAccountId: 'ba-101-santander',
    recurrence: 'Mensal',
    documentNumber: 'NF-409',
    notes: 'Campanha de tráfego pago e mídias sociais.',
    attachmentUrl: '#',
    attachmentName: 'nf_buzz_digital.pdf',
    status: 'Pendente',
    responsibleId: 'u-bpo-analyst',
    needsApproval: true,
    createdAt: '2026-07-05T14:00:00Z',
    updatedAt: '2026-07-05T14:00:00Z',
  },
  {
    id: 'ap-204',
    companyId: 'c-102',
    description: 'Fornecimento de Hortifruti',
    supplier: 'Distribuidora Ceasa Sul',
    category: 'Insumos e Matérias-primas',
    costCenter: 'Cozinha',
    competenceMonth: '2026-06',
    issueDate: '2026-06-25',
    dueDate: '2026-07-05', // Overdue
    amount: 4500.00,
    interest: 90.00,
    penalty: 45.00,
    discount: 0,
    finalAmount: 4635.00,
    paymentMethod: 'Boleto Bancário',
    bankAccountId: 'ba-102-itau',
    recurrence: 'Nenhuma',
    documentNumber: 'BL-98203',
    notes: 'Compra de legumes e verduras.',
    attachmentUrl: '#',
    attachmentName: 'boleto_ceasa_jul.pdf',
    status: 'Vencida', // Overdue status
    responsibleId: 'u-bpo-analyst',
    needsApproval: false,
    createdAt: '2026-06-25T11:00:00Z',
    updatedAt: '2026-07-06T12:00:00Z',
  },
  {
    id: 'ap-205',
    companyId: 'c-102',
    description: 'Aluguel do Imóvel Comercial',
    supplier: 'Imobiliária Nobreak',
    category: 'Aluguel e IPTU',
    costCenter: 'Administrativo',
    competenceMonth: '2026-07',
    issueDate: '2026-07-01',
    dueDate: '2026-07-10', // Overdue!
    amount: 8000.00,
    interest: 160.00,
    penalty: 80.00,
    discount: 0,
    finalAmount: 8240.00,
    paymentMethod: 'Transferência Bancária',
    bankAccountId: 'ba-102-itau',
    recurrence: 'Mensal',
    documentNumber: 'AL-2026-07',
    notes: 'Vencido. Precisa aprovação urgente por parte do cliente para liberar caixa.',
    attachmentUrl: '#',
    attachmentName: 'aluguel_sala_julho.pdf',
    status: 'Aguardando aprovação',
    responsibleId: 'u-bpo-analyst',
    needsApproval: true,
    createdAt: '2026-07-01T09:00:00Z',
    updatedAt: '2026-07-01T09:00:00Z',
  }
];

export const INITIAL_ACCOUNTS_RECEIVABLE: AccountReceivable[] = [
  {
    id: 'ar-301',
    companyId: 'c-101',
    description: 'Mensalidade Desenvolvimento Software - Contrato InterSistemas',
    customer: 'InterSistemas Corporativos S.A.',
    category: 'Serviços de Tecnologia',
    costCenter: 'Comercial e Marketing',
    competenceMonth: '2026-07',
    issueDate: '2026-07-01',
    dueDate: '2026-07-10',
    amount: 45000.00,
    interest: 0,
    penalty: 0,
    discount: 0,
    receivedAmount: 45000.00,
    paymentMethod: 'Boleto Bancário',
    bankAccountId: 'ba-101-itau',
    recurrence: 'Mensal',
    documentNumber: 'NFe-2026042',
    notes: 'Nota emitida e boleto pago em dia.',
    attachmentUrl: '#',
    attachmentName: 'nfe_45000_intersistemas.pdf',
    status: 'Recebida', // Received
    receiptDate: '2026-07-10',
    responsibleId: 'u-bpo-analyst',
    createdAt: '2026-07-01T11:00:00Z',
    updatedAt: '2026-07-10T16:00:00Z',
  },
  {
    id: 'ar-302',
    companyId: 'c-101',
    description: 'Consultoria Devops Especializada - Fintech Link',
    customer: 'Link Soluções de Pagamento',
    category: 'Consultoria TI',
    costCenter: 'Operações e P&D',
    competenceMonth: '2026-07',
    issueDate: '2026-07-05',
    dueDate: '2026-07-25',
    amount: 18500.00,
    interest: 0,
    penalty: 0,
    discount: 0,
    receivedAmount: 0,
    paymentMethod: 'Transferência Bancária',
    bankAccountId: 'ba-101-itau',
    recurrence: 'Nenhuma',
    documentNumber: 'NFe-2026049',
    notes: 'Aguardando vencimento da fatura.',
    attachmentUrl: '#',
    attachmentName: 'nfe_18500_link.pdf',
    status: 'Emitida',
    responsibleId: 'u-bpo-analyst',
    createdAt: '2026-07-05T10:00:00Z',
    updatedAt: '2026-07-05T10:00:00Z',
  },
  {
    id: 'ar-303',
    companyId: 'c-102',
    description: 'Serviço de Buffet - Casamento Privado',
    customer: 'Mariana e Pedro Eventos',
    category: 'Eventos Externos',
    costCenter: 'Eventos',
    competenceMonth: '2026-06',
    issueDate: '2026-06-15',
    dueDate: '2026-07-02', // Overdue
    amount: 12000.00,
    interest: 240.00,
    penalty: 120.00,
    discount: 0,
    receivedAmount: 6000.00, // Partial paid
    paymentMethod: 'Pix',
    bankAccountId: 'ba-102-itau',
    recurrence: 'Nenhuma',
    documentNumber: 'CTR-9428',
    notes: 'Metade paga na contratação. Segunda metade atrasada desde o dia 02.',
    attachmentUrl: '#',
    attachmentName: 'contrato_mariana_pedro.pdf',
    status: 'Parcialmente recebida',
    responsibleId: 'u-bpo-analyst',
    createdAt: '2026-06-15T09:00:00Z',
    updatedAt: '2026-07-03T11:00:00Z',
  }
];

export const INITIAL_APPROVALS: Approval[] = [
  {
    id: 'apv-401',
    companyId: 'c-101',
    type: 'PAGAMENTO',
    relatedId: 'ap-201',
    description: 'Hospedagem Cloud AWS - Julho',
    amount: 15420.00,
    dueDate: '2026-07-15',
    requesterId: 'u-bpo-analyst',
    requesterName: 'Pedro Analista',
    dueDateApproval: '2026-07-14',
    status: 'Pendente',
    createdAt: '2026-07-12T09:15:00Z',
    history: []
  },
  {
    id: 'apv-402',
    companyId: 'c-102',
    type: 'PAGAMENTO',
    relatedId: 'ap-205',
    description: 'Aluguel Comercial Sabor Imperial - Vencimento Atrasado',
    amount: 8000.00,
    dueDate: '2026-07-10',
    requesterId: 'u-bpo-analyst',
    requesterName: 'Pedro Analista',
    dueDateApproval: '2026-07-13',
    status: 'Pendente',
    createdAt: '2026-07-12T10:00:00Z',
    history: []
  }
];

export const INITIAL_DOCUMENTS: Document[] = [
  {
    id: 'doc-501',
    companyId: 'c-101',
    category: 'Nota fiscal',
    name: 'NF-1039 Limpeza de Escritório.pdf',
    description: 'Nota fiscal dos serviços prestados pela Limpa Tudo de faxina e materiais.',
    competenceMonth: '2026-07',
    uploadedAt: '2026-07-01T15:10:00Z',
    uploadedById: 'u-bpo-analyst',
    uploadedByName: 'Pedro Analista',
    fileSize: '342 KB',
    mimeType: 'application/pdf',
    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    relatedEntityId: 'ap-202',
    status: 'Validado',
    signedUrl: 'https://bpo-storage.com/c-101/doc-501?token=xyz987_valid'
  },
  {
    id: 'doc-502',
    companyId: 'c-101',
    category: 'Boleto',
    name: 'Boleto AWS Hosting Julho.pdf',
    description: 'Boleto bancário emitido pelo Itaú de cobrança de serviços AWS cloud.',
    competenceMonth: '2026-07',
    uploadedAt: '2026-07-02T10:05:00Z',
    uploadedById: 'u-bpo-analyst',
    uploadedByName: 'Pedro Analista',
    fileSize: '1.2 MB',
    mimeType: 'application/pdf',
    hash: '5f4dcc3b5aa765d61d8327deb882cf99',
    relatedEntityId: 'ap-201',
    status: 'Pendente',
    signedUrl: 'https://bpo-storage.com/c-101/doc-502?token=abc123_pending'
  },
  {
    id: 'doc-503',
    companyId: 'c-102',
    category: 'Extrato',
    name: 'Extrato Itau - Junho 2026.ofx',
    description: 'Extrato em formato financeiro para conciliação mensal bancária.',
    competenceMonth: '2026-06',
    uploadedAt: '2026-07-01T08:30:00Z',
    uploadedById: 'u-client-sabor',
    uploadedByName: 'Isabella Costa',
    fileSize: '45 KB',
    mimeType: 'text/xml',
    hash: '8f4305dfecba77209',
    status: 'Validado',
    signedUrl: 'https://bpo-storage.com/c-102/doc-503?token=ofx6543'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-601',
    tenantId: 't-1111-1111',
    companyId: 'c-101',
    companyName: 'Alfa Tecnologia',
    userId: 'u-bpo-analyst',
    userName: 'Pedro Analista',
    role: 'BPO_TEAM',
    action: 'CRIAR_CONTA_PAGAR',
    entityType: 'AccountPayable',
    entityId: 'ap-201',
    nextData: '{"description":"Assinatura AWS","supplier":"AWS","amount":15420.00}',
    timestamp: '2026-07-02T10:00:00Z',
    ipAddress: '177.34.82.109',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    origin: 'Web App'
  },
  {
    id: 'log-602',
    tenantId: 't-1111-1111',
    companyId: 'c-101',
    companyName: 'Alfa Tecnologia',
    userId: 'u-bpo-analyst',
    userName: 'Pedro Analista',
    role: 'BPO_TEAM',
    action: 'CONFIRMAR_PAGAMENTO',
    entityType: 'AccountPayable',
    entityId: 'ap-202',
    nextData: '{"status":"Paga","paymentDate":"2026-07-08","finalAmount":1150.00}',
    timestamp: '2026-07-08T09:30:00Z',
    ipAddress: '177.34.82.109',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    origin: 'Web App'
  }
];

export const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 'not-1',
    companyId: 'c-101',
    title: 'Nova Aprovação Pendente',
    message: 'Assinatura AWS Cloud Server Hosting (R$ 15.420,00) foi enviada para sua aprovação.',
    type: 'ALERT',
    isRead: false,
    createdAt: '2026-07-12T09:16:00Z',
  },
  {
    id: 'not-2',
    companyId: 'c-102',
    title: 'Contas Vencidas Detectadas',
    message: 'Aluguel do Imóvel Comercial (R$ 8.000,00) e Fornecimento de Hortifruti (R$ 4.500,00) estão vencidos.',
    type: 'WARNING',
    isRead: false,
    createdAt: '2026-07-11T08:00:00Z',
  },
  {
    id: 'not-3',
    companyId: 'c-101',
    title: 'Documento Validado',
    message: 'O documento NF-1039 Limpeza de Escritório foi validado pelo BPO.',
    type: 'SUCCESS',
    isRead: true,
    createdAt: '2026-07-08T09:35:00Z',
  }
];

export const BANK_STATEMENTS_TO_IMPORT: Record<string, BankStatementItem[]> = {
  'ba-101-itau': [
    {
      id: 'st-001',
      date: '2026-07-08',
      description: 'PIX ENV PAGTO LIMPA TUDO SERVICOS',
      amount: -1150.00, // Matches ap-202 final amount
      documentNumber: '1039',
      isReconciled: true,
      reconciliationStatus: 'Conciliada',
      matchedTransactionId: 'ap-202'
    },
    {
      id: 'st-002',
      date: '2026-07-10',
      description: 'COBRANCA RECEBIDA INTERSISTEMAS SL',
      amount: 45000.00, // Matches ar-301 amount
      documentNumber: '2026042',
      isReconciled: true,
      reconciliationStatus: 'Conciliada',
      matchedTransactionId: 'ar-301'
    },
    {
      id: 'st-003',
      date: '2026-07-12',
      description: 'TARIFA BANCARIA MENSAL CTA CORRENTE',
      amount: -89.90, // Unreconciled, needs manual categorization or ignoring
      isReconciled: false,
      reconciliationStatus: 'Pendente',
    },
    {
      id: 'st-004',
      date: '2026-07-13',
      description: 'PIX REC RECEBIMENTO CLIENTE AVULSO',
      amount: 1500.00, // Matches a potential new or partial receivable
      isReconciled: false,
      reconciliationStatus: 'Pendente',
    }
  ],
  'ba-101-santander': [
    {
      id: 'st-101',
      date: '2026-07-06',
      description: 'PIX ENV AGENCIA BUZZ DIGITAL SA',
      amount: -3500.00, // Matches ap-203
      isReconciled: false,
      reconciliationStatus: 'Pendente',
    }
  ],
  'ba-102-itau': [
    {
      id: 'st-201',
      date: '2026-07-03',
      description: 'PIX REC MARIANA E PEDRO EVENTOS BR',
      amount: 6000.00, // Partial payment for ar-303
      isReconciled: true,
      reconciliationStatus: 'Parcialmente conciliada',
      matchedTransactionId: 'ar-303'
    }
  ],
  'ba-103-brasil': []
};
