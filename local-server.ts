// Local development/production server. Vercel uses the functions in /api.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import {
  checkDatabaseConnection,
  disconnectDatabase,
  hasDatabaseConfiguration,
} from './backend/database.js';
import { getAuth } from './backend/auth.js';
import { getAuthenticatedProfile } from './backend/auth-profile.js';
import { ApiAuthenticationError, requireApiCompanyPermission } from './backend/api-auth.js';
import {
  CompanyApiError,
  createCompany,
  deactivateCompany,
  listAccessibleCompanies,
  updateCompany,
} from './backend/companies.js';
import { AccountApiError, changeOwnPassword } from './backend/account.js';
import {
  UserApiError,
  createManagedUser,
  deactivateManagedUser,
  listManagedUsers,
  resetManagedUserPassword,
  updateManagedUser,
} from './backend/users.js';
import {
  FinancialSetupApiError,
  adjustBankAccountBalance,
  adjustBankAccountBalances,
  createBankAccount,
  createMasterData,
  deactivateBankAccount,
  deactivateMasterData,
  ensureBolsaBankAccount,
  listFinancialSetup,
  updateBankAccount,
  updateMasterData,
} from './backend/financial-setup.js';
import {
  FinancialEntriesApiError,
  cancelPayable,
  cancelReceivable,
  createPayables,
  createReceivables,
  decidePaymentApproval,
  deletePayables,
  deleteReceivables,
  importFinancialEntries,
  listFinancialEntries,
  payPayable,
  receiveReceivable,
  schedulePayable,
  updatePayable,
  updateReceivable,
} from './backend/financial-entries.js';
import {
  DocumentRecordApiError,
  createDocument as createDocumentRecord,
  decideDocumentApproval,
  deleteDocument as deleteDocumentRecord,
  deleteDocuments as deleteDocumentRecords,
  listDocuments as listDocumentRecords,
  submitDocumentApproval,
  updateDocument as updateDocumentRecord,
} from './backend/document-records.js';
import {
  ReconciliationApiError,
  autoReconcileStatementEntries,
  ignoreStatementEntry,
  importStatementEntries,
  listStatementEntries,
  reconcileStatementEntry,
} from './backend/reconciliation.js';
import {
  analyzeDocument,
  createDocumentUploadSession,
  DocumentAssistantError,
  getGeminiModel,
  hasConfiguredGeminiKey,
} from './backend/document-assistant.js';
import {
  DocumentFileError,
  authorizeLegacyDocumentFile,
  authorizeLegacyFileUpload,
  readDocumentFile,
  storeDocumentFileChunk,
} from './backend/document-files.js';
import { AuditLogApiError, listAuditLogs } from './backend/audit-logs.js';
import {
  NotificationApiError,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './backend/notifications.js';
import {
  BakeryCashApiError,
  addExpense as addBakeryExpense,
  addPixSale as addBakeryPixSale,
  addWithdrawal as addBakeryWithdrawal,
  cancelExpense as cancelBakeryExpense,
  cancelPendingClose as cancelBakeryPendingClose,
  cancelPixSale as cancelBakeryPixSale,
  cancelShift as cancelBakeryShift,
  cancelWithdrawal as cancelBakeryWithdrawal,
  closeShift as closeBakeryShift,
  listBakeryCash,
  markAwaitingClose as markBakeryAwaitingClose,
  openShift as openBakeryShift,
  reopenShift as reopenBakeryShift,
  setPixReconciliationStatus as setBakeryPixReconciliationStatus,
} from './backend/bakery-cash.js';
import {
  ReportApiError,
  createReport,
  createReportTemplate,
  deleteReport,
  deleteReportTemplate,
  duplicateReportTemplate,
  listReports,
  listReportTemplates,
  updateReportTemplate,
} from './backend/reports.js';
import {
  SupportTicketApiError,
  addSupportMessage,
  createSupportTicket,
  deleteSupportTicket,
  listSupportTickets,
  updateSupportTicket,
} from './backend/support-tickets.js';

// `.env.local` is intentionally gitignored and takes precedence over `.env`.
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false, quiet: true });

const app = express();
const port = Number(process.env.PORT || 3000);
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(rootDir, '.data', 'uploads');
await mkdir(uploadDir, { recursive: true });

if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

const auth = getAuth();
app.all('/api/auth/*', toNodeHandler(auth));

const requireAuthentication: express.RequestHandler = async (request, response, next) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    if (!session) {
      response.status(401).json({ error: 'Não autenticado.' });
      return;
    }

    const profile = await getAuthenticatedProfile(session.user.id);
    if (!profile) {
      response.status(401).json({ error: 'Sessão sem acesso ativo.' });
      return;
    }
    response.locals.authProfile = profile;
    response.locals.authSession = session;
    next();
  } catch (error) {
    console.error('Authentication check failed:', error instanceof Error ? error.message : error);
    response.status(503).json({ error: 'Não foi possível validar a sessão.' });
  }
};

const requireCompletedPasswordChange: express.RequestHandler = (_request, response, next) => {
  if (response.locals.authProfile?.mustChangePassword) {
    response.status(403).json({ error: 'Troque a senha temporária para continuar.' });
    return;
  }
  next();
};

// Base64 increases the payload by roughly 33%; this safely accommodates a 20 MB file.
app.use(express.json({ limit: '30mb' }));
app.get(
  '/uploads/:fileName',
  requireAuthentication,
  requireCompletedPasswordChange,
  async (request, response) => {
    const objectKey = `/uploads/${request.params.fileName}`;
    try {
      await authorizeLegacyDocumentFile(response.locals.authProfile, objectKey);
      response.setHeader('Cache-Control', 'private, no-store');
      response.sendFile(path.join(uploadDir, request.params.fileName));
    } catch (error) {
      const status = error instanceof DocumentFileError ? error.status : 500;
      response.status(status).json({
        error: error instanceof DocumentFileError ? error.message : 'Não foi possível abrir o arquivo.',
      });
    }
  },
);

app.get('/api/me', requireAuthentication, (_request, response) => {
  response.json(response.locals.authProfile);
});

app.get('/api/database/status', async (_request, response) => {
  const configured = hasDatabaseConfiguration();

  if (!configured) {
    response.json({ configured: false, available: false });
    return;
  }

  try {
    await checkDatabaseConnection();
    response.json({ configured: true, available: true });
  } catch (error) {
    console.error('Database health check failed:', error instanceof Error ? error.message : error);
    response.status(503).json({ configured: true, available: false });
  }
});

app.use('/api/companies', requireAuthentication, requireCompletedPasswordChange);

app.get('/api/companies', async (_request, response) => {
  try {
    response.json(await listAccessibleCompanies(response.locals.authProfile));
  } catch (error) {
    console.error('Company listing failed:', error instanceof Error ? error.message : error);
    response.status(500).json({ error: 'Não foi possível carregar as empresas.' });
  }
});

app.post('/api/companies', async (request, response) => {
  try {
    response.status(201).json(
      await createCompany(response.locals.authProfile, request.body),
    );
  } catch (error) {
    const status = error instanceof CompanyApiError ? error.status : 500;
    if (status === 500) {
      console.error('Company creation failed:', error instanceof Error ? error.message : error);
    }
    response.status(status).json({
      error: error instanceof CompanyApiError ? error.message : 'Não foi possível cadastrar a empresa.',
    });
  }
});

app.patch('/api/companies/:companyId', async (request, response) => {
  try {
    response.json(
      await updateCompany(
        response.locals.authProfile,
        request.params.companyId,
        request.body,
      ),
    );
  } catch (error) {
    const status = error instanceof CompanyApiError ? error.status : 500;
    if (status === 500) {
      console.error('Company update failed:', error instanceof Error ? error.message : error);
    }
    response.status(status).json({
      error: error instanceof CompanyApiError ? error.message : 'Não foi possível atualizar a empresa.',
    });
  }
});

app.delete('/api/companies/:companyId', async (request, response) => {
  try {
    await deactivateCompany(response.locals.authProfile, request.params.companyId);
    response.status(204).end();
  } catch (error) {
    const status = error instanceof CompanyApiError ? error.status : 500;
    if (status === 500) {
      console.error('Company deactivation failed:', error instanceof Error ? error.message : error);
    }
    response.status(status).json({
      error: error instanceof CompanyApiError ? error.message : 'Não foi possível desativar a empresa.',
    });
  }
});

const financialSetupError = (
  response: express.Response,
  error: unknown,
  fallback: string,
) => {
  const status = error instanceof FinancialSetupApiError ? error.status : 500;
  if (status === 500) {
    console.error('Financial setup operation failed:', error instanceof Error ? error.message : error);
  }
  response.status(status).json({
    error: error instanceof FinancialSetupApiError ? error.message : fallback,
  });
};

app.use('/api/financial-setup', requireAuthentication, requireCompletedPasswordChange);
app.get('/api/financial-setup', async (_request, response) => {
  try {
    response.json(await listFinancialSetup(response.locals.authProfile));
  } catch (error) {
    financialSetupError(response, error, 'Não foi possível carregar os dados financeiros.');
  }
});

app.use('/api/bank-accounts', requireAuthentication, requireCompletedPasswordChange);
app.post('/api/bank-accounts', async (request, response) => {
  try {
    response.status(201).json(await createBankAccount(response.locals.authProfile, request.body));
  } catch (error) {
    financialSetupError(response, error, 'Não foi possível cadastrar a conta bancária.');
  }
});

app.patch('/api/bank-accounts/:accountId', async (request, response) => {
  try {
    response.json(
      await updateBankAccount(response.locals.authProfile, request.params.accountId, request.body),
    );
  } catch (error) {
    financialSetupError(response, error, 'Não foi possível atualizar a conta bancária.');
  }
});

app.delete('/api/bank-accounts/:accountId', async (request, response) => {
  try {
    await deactivateBankAccount(response.locals.authProfile, request.params.accountId);
    response.status(204).end();
  } catch (error) {
    financialSetupError(response, error, 'Não foi possível desativar a conta bancária.');
  }
});

app.post('/api/bank-accounts/bolsa/:companyId', async (request, response) => {
  try {
    response.json(
      await ensureBolsaBankAccount(response.locals.authProfile, request.params.companyId),
    );
  } catch (error) {
    financialSetupError(response, error, 'Não foi possível preparar a conta Bolsa.');
  }
});

app.post('/api/bank-accounts/:accountId/adjust-balance', async (request, response) => {
  try {
    response.json(
      await adjustBankAccountBalance(
        response.locals.authProfile,
        request.params.accountId,
        request.body,
      ),
    );
  } catch (error) {
    financialSetupError(response, error, 'Não foi possível atualizar o saldo bancário.');
  }
});

app.post('/api/bank-accounts/batch-adjust', async (request, response) => {
  try {
    response.json(
      await adjustBankAccountBalances(response.locals.authProfile, request.body),
    );
  } catch (error) {
    financialSetupError(response, error, 'Não foi possível atualizar os saldos bancários.');
  }
});

app.use('/api/master-data', requireAuthentication, requireCompletedPasswordChange);
app.post('/api/master-data', async (request, response) => {
  try {
    response.status(201).json(await createMasterData(response.locals.authProfile, request.body));
  } catch (error) {
    financialSetupError(response, error, 'Não foi possível criar o cadastro.');
  }
});

app.patch('/api/master-data/:itemId', async (request, response) => {
  try {
    response.json(
      await updateMasterData(response.locals.authProfile, request.params.itemId, request.body),
    );
  } catch (error) {
    financialSetupError(response, error, 'Não foi possível atualizar o cadastro.');
  }
});

app.delete('/api/master-data/:itemId', async (request, response) => {
  try {
    await deactivateMasterData(response.locals.authProfile, request.params.itemId);
    response.status(204).end();
  } catch (error) {
    financialSetupError(response, error, 'Não foi possível desativar o cadastro.');
  }
});

const financialEntriesError = (
  response: express.Response,
  error: unknown,
  fallback: string,
) => {
  const status = error instanceof FinancialEntriesApiError ? error.status : 500;
  if (status === 500) {
    console.error('Financial entries operation failed:', error instanceof Error ? error.message : error);
  }
  response.status(status).json({
    error: error instanceof FinancialEntriesApiError ? error.message : fallback,
  });
};

app.use('/api/financial-entries', requireAuthentication, requireCompletedPasswordChange);
app.get('/api/financial-entries', async (_request, response) => {
  try {
    response.json(await listFinancialEntries(response.locals.authProfile));
  } catch (error) {
    financialEntriesError(response, error, 'Não foi possível carregar os títulos financeiros.');
  }
});
app.post('/api/financial-entries/import', async (request, response) => {
  try {
    response.status(201).json(await importFinancialEntries(response.locals.authProfile, request.body));
  } catch (error) {
    financialEntriesError(response, error, 'Não foi possível importar os lançamentos.');
  }
});

app.use('/api/payables', requireAuthentication, requireCompletedPasswordChange);
app.post('/api/payables', async (request, response) => {
  try {
    response.status(201).json(await createPayables(response.locals.authProfile, request.body));
  } catch (error) {
    financialEntriesError(response, error, 'Não foi possível cadastrar a conta a pagar.');
  }
});
app.post('/api/payables/batch-delete', async (request, response) => {
  try {
    response.json(await deletePayables(response.locals.authProfile, request.body));
  } catch (error) {
    financialEntriesError(response, error, 'Não foi possível excluir as contas a pagar selecionadas.');
  }
});
app.patch('/api/payables/:payableId', async (request, response) => {
  try {
    response.json(await updatePayable(response.locals.authProfile, request.params.payableId, request.body));
  } catch (error) {
    financialEntriesError(response, error, 'Não foi possível atualizar a conta a pagar.');
  }
});
app.post('/api/payables/:payableId/cancel', async (request, response) => {
  try {
    response.json(await cancelPayable(response.locals.authProfile, request.params.payableId));
  } catch (error) {
    financialEntriesError(response, error, 'Não foi possível cancelar a conta a pagar.');
  }
});
app.post('/api/payables/:payableId/schedule', async (request, response) => {
  try {
    response.json(await schedulePayable(response.locals.authProfile, request.params.payableId));
  } catch (error) {
    financialEntriesError(response, error, 'Não foi possível agendar a conta a pagar.');
  }
});
app.post('/api/payables/:payableId/pay', async (request, response) => {
  try {
    response.json(await payPayable(response.locals.authProfile, request.params.payableId, request.body));
  } catch (error) {
    financialEntriesError(response, error, 'Não foi possível registrar o pagamento.');
  }
});

app.use('/api/receivables', requireAuthentication, requireCompletedPasswordChange);
app.post('/api/receivables', async (request, response) => {
  try {
    response.status(201).json(await createReceivables(response.locals.authProfile, request.body));
  } catch (error) {
    financialEntriesError(response, error, 'Não foi possível cadastrar a conta a receber.');
  }
});
app.post('/api/receivables/batch-delete', async (request, response) => {
  try {
    response.json(await deleteReceivables(response.locals.authProfile, request.body));
  } catch (error) {
    financialEntriesError(response, error, 'Não foi possível excluir as contas a receber selecionadas.');
  }
});
app.patch('/api/receivables/:receivableId', async (request, response) => {
  try {
    response.json(await updateReceivable(response.locals.authProfile, request.params.receivableId, request.body));
  } catch (error) {
    financialEntriesError(response, error, 'Não foi possível atualizar a conta a receber.');
  }
});
app.post('/api/receivables/:receivableId/cancel', async (request, response) => {
  try {
    response.json(await cancelReceivable(response.locals.authProfile, request.params.receivableId));
  } catch (error) {
    financialEntriesError(response, error, 'Não foi possível cancelar a conta a receber.');
  }
});
app.post('/api/receivables/:receivableId/receive', async (request, response) => {
  try {
    response.json(await receiveReceivable(response.locals.authProfile, request.params.receivableId, request.body));
  } catch (error) {
    financialEntriesError(response, error, 'Não foi possível registrar o recebimento.');
  }
});

app.post('/api/payment-approvals/:approvalId/decision', requireAuthentication, requireCompletedPasswordChange, async (request, response) => {
  try {
    response.json(await decidePaymentApproval(response.locals.authProfile, request.params.approvalId, request.body));
  } catch (error) {
    financialEntriesError(response, error, 'Não foi possível decidir a aprovação.');
  }
});

const documentRecordError = (
  response: express.Response,
  error: unknown,
  fallback: string,
) => {
  const status = error instanceof DocumentRecordApiError ? error.status : 500;
  if (status === 500) {
    console.error('Document record operation failed:', error instanceof Error ? error.message : error);
  }
  response.status(status).json({
    error: error instanceof DocumentRecordApiError ? error.message : fallback,
  });
};

app.get('/api/document-records', requireAuthentication, requireCompletedPasswordChange, async (_request, response) => {
  try {
    response.json(await listDocumentRecords(response.locals.authProfile));
  } catch (error) {
    documentRecordError(response, error, 'Não foi possível carregar os documentos.');
  }
});
app.post('/api/document-records', requireAuthentication, requireCompletedPasswordChange, async (request, response) => {
  try {
    response.status(201).json(await createDocumentRecord(response.locals.authProfile, request.body));
  } catch (error) {
    documentRecordError(response, error, 'Não foi possível registrar o documento.');
  }
});
app.patch('/api/document-records/:documentId', requireAuthentication, requireCompletedPasswordChange, async (request, response) => {
  try {
    response.json(await updateDocumentRecord(response.locals.authProfile, request.params.documentId, request.body));
  } catch (error) {
    documentRecordError(response, error, 'Não foi possível atualizar o documento.');
  }
});
app.delete('/api/document-records/:documentId', requireAuthentication, requireCompletedPasswordChange, async (request, response) => {
  try {
    response.json(await deleteDocumentRecord(response.locals.authProfile, request.params.documentId));
  } catch (error) {
    documentRecordError(response, error, 'Não foi possível excluir o documento.');
  }
});
app.post('/api/document-records/batch-delete', requireAuthentication, requireCompletedPasswordChange, async (request, response) => {
  try {
    response.json(await deleteDocumentRecords(response.locals.authProfile, request.body));
  } catch (error) {
    documentRecordError(response, error, 'Não foi possível excluir os lançamentos selecionados.');
  }
});
app.post('/api/document-records/:documentId/request-approval', requireAuthentication, requireCompletedPasswordChange, async (request, response) => {
  try {
    response.json(await submitDocumentApproval(response.locals.authProfile, request.params.documentId, request.body));
  } catch (error) {
    documentRecordError(response, error, 'Não foi possível solicitar a aprovação.');
  }
});
app.post('/api/document-approvals/:approvalId/decision', requireAuthentication, requireCompletedPasswordChange, async (request, response) => {
  try {
    response.json(await decideDocumentApproval(response.locals.authProfile, request.params.approvalId, request.body));
  } catch (error) {
    documentRecordError(response, error, 'Não foi possível decidir a aprovação do documento.');
  }
});

const reconciliationError = (response: express.Response, error: unknown, fallback: string) => {
  const status = error instanceof ReconciliationApiError ? error.status : 500;
  if (status === 500) console.error('Reconciliation operation failed:', error instanceof Error ? error.message : error);
  response.status(status).json({ error: error instanceof ReconciliationApiError ? error.message : fallback });
};

app.get('/api/reconciliation', requireAuthentication, requireCompletedPasswordChange, async (_request, response) => {
  try {
    response.json(await listStatementEntries(response.locals.authProfile));
  } catch (error) {
    reconciliationError(response, error, 'Não foi possível carregar os extratos bancários.');
  }
});
app.post('/api/reconciliation/:bankAccountId/import', requireAuthentication, requireCompletedPasswordChange, async (request, response) => {
  try {
    response.status(201).json(await importStatementEntries(response.locals.authProfile, request.params.bankAccountId, request.body));
  } catch (error) {
    reconciliationError(response, error, 'Não foi possível importar o extrato bancário.');
  }
});
app.post('/api/reconciliation/:bankAccountId/auto', requireAuthentication, requireCompletedPasswordChange, async (request, response) => {
  try {
    response.json(await autoReconcileStatementEntries(response.locals.authProfile, request.params.bankAccountId));
  } catch (error) {
    reconciliationError(response, error, 'Não foi possível executar a conciliação automática.');
  }
});
app.post('/api/reconciliation/:bankAccountId/items/:statementItemId/reconcile', requireAuthentication, requireCompletedPasswordChange, async (request, response) => {
  try {
    response.json(await reconcileStatementEntry(response.locals.authProfile, request.params.bankAccountId, request.params.statementItemId, request.body));
  } catch (error) {
    reconciliationError(response, error, 'Não foi possível conciliar o item.');
  }
});
app.post('/api/reconciliation/:bankAccountId/items/:statementItemId/ignore', requireAuthentication, requireCompletedPasswordChange, async (request, response) => {
  try {
    response.json(await ignoreStatementEntry(response.locals.authProfile, request.params.bankAccountId, request.params.statementItemId, request.body));
  } catch (error) {
    reconciliationError(response, error, 'Não foi possível ignorar o item.');
  }
});

app.get('/api/audit-logs', requireAuthentication, requireCompletedPasswordChange, async (_request, response) => {
  try {
    response.json(await listAuditLogs(response.locals.authProfile));
  } catch (error) {
    const status = error instanceof AuditLogApiError ? error.status : 500;
    if (status === 500) console.error('Audit log listing failed:', error instanceof Error ? error.message : error);
    response.status(status).json({ error: error instanceof AuditLogApiError ? error.message : 'Não foi possível carregar a auditoria.' });
  }
});

const notificationError = (response: express.Response, error: unknown, fallback: string) => {
  const status = error instanceof NotificationApiError ? error.status : 500;
  if (status === 500) console.error('Notification operation failed:', error instanceof Error ? error.message : error);
  response.status(status).json({ error: error instanceof NotificationApiError ? error.message : fallback });
};
app.use('/api/notifications', requireAuthentication, requireCompletedPasswordChange);
app.get('/api/notifications', async (_request, response) => {
  try {
    response.json(await listNotifications(response.locals.authProfile));
  } catch (error) {
    notificationError(response, error, 'Não foi possível carregar as notificações.');
  }
});
app.post('/api/notifications/:notificationId/read', async (request, response) => {
  try {
    response.json(await markNotificationRead(response.locals.authProfile, request.params.notificationId));
  } catch (error) {
    notificationError(response, error, 'Não foi possível marcar a notificação como lida.');
  }
});
app.post('/api/notifications/read-all', async (_request, response) => {
  try {
    response.json(await markAllNotificationsRead(response.locals.authProfile));
  } catch (error) {
    notificationError(response, error, 'Não foi possível marcar as notificações como lidas.');
  }
});

const bakeryCashError = (response: express.Response, error: unknown, fallback: string) => {
  const status = error instanceof BakeryCashApiError ? error.status : 500;
  if (status === 500) console.error('Bakery cash operation failed:', error instanceof Error ? error.message : error);
  response.status(status).json({ error: error instanceof BakeryCashApiError ? error.message : fallback });
};
app.use('/api/bakery-cash', requireAuthentication, requireCompletedPasswordChange);
app.get('/api/bakery-cash', async (_request, response) => {
  try {
    response.json(await listBakeryCash(response.locals.authProfile));
  } catch (error) {
    bakeryCashError(response, error, 'Não foi possível carregar o caixa da padaria.');
  }
});
app.post('/api/bakery-cash/shifts', async (request, response) => {
  try {
    response.status(201).json(await openBakeryShift(response.locals.authProfile, request.body));
  } catch (error) {
    bakeryCashError(response, error, 'Não foi possível abrir o turno.');
  }
});
app.post('/api/bakery-cash/shifts/:shiftId/await-close', async (request, response) => {
  try {
    response.json(await markBakeryAwaitingClose(response.locals.authProfile, request.params.shiftId));
  } catch (error) {
    bakeryCashError(response, error, 'Não foi possível preparar o fechamento do turno.');
  }
});
app.post('/api/bakery-cash/shifts/:shiftId/cancel-pending-close', async (request, response) => {
  try {
    response.json(await cancelBakeryPendingClose(response.locals.authProfile, request.params.shiftId));
  } catch (error) {
    bakeryCashError(response, error, 'Não foi possível voltar o turno para aberto.');
  }
});
app.post('/api/bakery-cash/shifts/:shiftId/close', async (request, response) => {
  try {
    response.json(await closeBakeryShift(response.locals.authProfile, { ...request.body, shiftId: request.params.shiftId }));
  } catch (error) {
    bakeryCashError(response, error, 'Não foi possível fechar o turno.');
  }
});
app.post('/api/bakery-cash/shifts/:shiftId/reopen', async (request, response) => {
  try {
    response.json(await reopenBakeryShift(response.locals.authProfile, { ...request.body, shiftId: request.params.shiftId }));
  } catch (error) {
    bakeryCashError(response, error, 'Não foi possível reabrir o turno.');
  }
});
app.post('/api/bakery-cash/shifts/:shiftId/cancel', async (request, response) => {
  try {
    response.json(await cancelBakeryShift(response.locals.authProfile, request.params.shiftId));
  } catch (error) {
    bakeryCashError(response, error, 'Não foi possível cancelar o turno.');
  }
});
app.post('/api/bakery-cash/expenses', async (request, response) => {
  try {
    response.status(201).json(await addBakeryExpense(response.locals.authProfile, request.body));
  } catch (error) {
    bakeryCashError(response, error, 'Não foi possível lançar a despesa.');
  }
});
app.post('/api/bakery-cash/expenses/:expenseId/cancel', async (request, response) => {
  try {
    response.json(await cancelBakeryExpense(response.locals.authProfile, request.params.expenseId));
  } catch (error) {
    bakeryCashError(response, error, 'Não foi possível cancelar a despesa.');
  }
});
app.post('/api/bakery-cash/withdrawals', async (request, response) => {
  try {
    response.status(201).json(await addBakeryWithdrawal(response.locals.authProfile, request.body));
  } catch (error) {
    bakeryCashError(response, error, 'Não foi possível lançar a sangria.');
  }
});
app.post('/api/bakery-cash/withdrawals/:withdrawalId/cancel', async (request, response) => {
  try {
    response.json(await cancelBakeryWithdrawal(response.locals.authProfile, request.params.withdrawalId));
  } catch (error) {
    bakeryCashError(response, error, 'Não foi possível cancelar a sangria.');
  }
});
app.post('/api/bakery-cash/pix-sales', async (request, response) => {
  try {
    response.status(201).json(await addBakeryPixSale(response.locals.authProfile, request.body));
  } catch (error) {
    bakeryCashError(response, error, 'Não foi possível lançar a venda no PIX.');
  }
});
app.post('/api/bakery-cash/pix-sales/:pixSaleId/cancel', async (request, response) => {
  try {
    response.json(await cancelBakeryPixSale(response.locals.authProfile, request.params.pixSaleId));
  } catch (error) {
    bakeryCashError(response, error, 'Não foi possível cancelar a venda no PIX.');
  }
});
app.post('/api/bakery-cash/pix-sales/:pixSaleId/reconciliation', async (request, response) => {
  try {
    response.json(await setBakeryPixReconciliationStatus(response.locals.authProfile, request.params.pixSaleId, request.body?.status));
  } catch (error) {
    bakeryCashError(response, error, 'Não foi possível atualizar a conciliação da venda.');
  }
});

const reportError = (response: express.Response, error: unknown, fallback: string) => {
  const status = error instanceof ReportApiError ? error.status : 500;
  if (status === 500) console.error('Report operation failed:', error instanceof Error ? error.message : error);
  response.status(status).json({ error: error instanceof ReportApiError ? error.message : fallback });
};
app.use('/api/reports', requireAuthentication, requireCompletedPasswordChange);
app.get('/api/reports', async (_request, response) => {
  try {
    response.json(await listReports(response.locals.authProfile));
  } catch (error) {
    reportError(response, error, 'Não foi possível carregar os relatórios.');
  }
});
app.post('/api/reports', async (request, response) => {
  try {
    response.status(201).json(await createReport(response.locals.authProfile, request.body));
  } catch (error) {
    reportError(response, error, 'Não foi possível salvar o relatório.');
  }
});
app.delete('/api/reports/:reportId', async (request, response) => {
  try {
    await deleteReport(response.locals.authProfile, request.params.reportId);
    response.status(204).end();
  } catch (error) {
    reportError(response, error, 'Não foi possível excluir o relatório.');
  }
});

app.use('/api/report-templates', requireAuthentication, requireCompletedPasswordChange);
app.get('/api/report-templates', async (_request, response) => {
  try {
    response.json(await listReportTemplates(response.locals.authProfile));
  } catch (error) {
    reportError(response, error, 'Não foi possível carregar os modelos de relatório.');
  }
});
app.post('/api/report-templates', async (request, response) => {
  try {
    response.status(201).json(await createReportTemplate(response.locals.authProfile, request.body));
  } catch (error) {
    reportError(response, error, 'Não foi possível salvar o modelo de relatório.');
  }
});
app.patch('/api/report-templates/:templateId', async (request, response) => {
  try {
    response.json(await updateReportTemplate(response.locals.authProfile, request.params.templateId, request.body));
  } catch (error) {
    reportError(response, error, 'Não foi possível atualizar o modelo de relatório.');
  }
});
app.post('/api/report-templates/:templateId/duplicate', async (request, response) => {
  try {
    response.status(201).json(await duplicateReportTemplate(response.locals.authProfile, request.params.templateId));
  } catch (error) {
    reportError(response, error, 'Não foi possível duplicar o modelo de relatório.');
  }
});
app.delete('/api/report-templates/:templateId', async (request, response) => {
  try {
    await deleteReportTemplate(response.locals.authProfile, request.params.templateId);
    response.status(204).end();
  } catch (error) {
    reportError(response, error, 'Não foi possível excluir o modelo de relatório.');
  }
});

const supportTicketError = (response: express.Response, error: unknown, fallback: string) => {
  const status = error instanceof SupportTicketApiError ? error.status : 500;
  if (status === 500) console.error('Support ticket operation failed:', error instanceof Error ? error.message : error);
  response.status(status).json({ error: error instanceof SupportTicketApiError ? error.message : fallback });
};
app.use('/api/support-tickets', requireAuthentication, requireCompletedPasswordChange);
app.get('/api/support-tickets', async (_request, response) => {
  try {
    response.json(await listSupportTickets(response.locals.authProfile));
  } catch (error) {
    supportTicketError(response, error, 'Não foi possível carregar os chamados.');
  }
});
app.post('/api/support-tickets', async (request, response) => {
  try {
    response.status(201).json(await createSupportTicket(response.locals.authProfile, request.body));
  } catch (error) {
    supportTicketError(response, error, 'Não foi possível abrir o chamado.');
  }
});
app.patch('/api/support-tickets/:ticketId', async (request, response) => {
  try {
    response.json(await updateSupportTicket(response.locals.authProfile, request.params.ticketId, request.body));
  } catch (error) {
    supportTicketError(response, error, 'Não foi possível atualizar o chamado.');
  }
});
app.delete('/api/support-tickets/:ticketId', async (request, response) => {
  try {
    await deleteSupportTicket(response.locals.authProfile, request.params.ticketId);
    response.status(204).end();
  } catch (error) {
    supportTicketError(response, error, 'Não foi possível excluir o chamado.');
  }
});
app.post('/api/support-tickets/:ticketId/messages', async (request, response) => {
  try {
    response.status(201).json(await addSupportMessage(response.locals.authProfile, request.params.ticketId, request.body));
  } catch (error) {
    supportTicketError(response, error, 'Não foi possível enviar a mensagem.');
  }
});

app.post('/api/account/change-password', requireAuthentication, async (request, response) => {
  try {
    await changeOwnPassword({
      userId: response.locals.authProfile.id,
      currentSessionId: response.locals.authSession.session.id,
      currentPassword: request.body?.currentPassword,
      newPassword: request.body?.newPassword,
    });
    response.status(204).end();
  } catch (error) {
    const status = error instanceof AccountApiError ? error.status : 500;
    if (status === 500) {
      console.error('Password change failed:', error instanceof Error ? error.message : error);
    }
    response.status(status).json({
      error: error instanceof AccountApiError ? error.message : 'Não foi possível alterar a senha.',
    });
  }
});

app.use('/api/users', requireAuthentication, requireCompletedPasswordChange);

app.get('/api/users', async (_request, response) => {
  try {
    response.json({ users: await listManagedUsers(response.locals.authProfile) });
  } catch (error) {
    console.error('User listing failed:', error instanceof Error ? error.message : error);
    response.status(500).json({ error: 'Não foi possível carregar os usuários.' });
  }
});

app.post('/api/users', async (request, response) => {
  try {
    response.status(201).json(
      await createManagedUser(response.locals.authProfile, request.body),
    );
  } catch (error) {
    const status = error instanceof UserApiError ? error.status : 500;
    if (status === 500) {
      console.error('User creation failed:', error instanceof Error ? error.message : error);
    }
    response.status(status).json({
      error: error instanceof UserApiError ? error.message : 'Não foi possível criar o usuário.',
    });
  }
});

app.patch('/api/users/:userId', async (request, response) => {
  try {
    response.json(
      await updateManagedUser(
        response.locals.authProfile,
        request.params.userId,
        request.body,
      ),
    );
  } catch (error) {
    const status = error instanceof UserApiError ? error.status : 500;
    if (status === 500) {
      console.error('User update failed:', error instanceof Error ? error.message : error);
    }
    response.status(status).json({
      error: error instanceof UserApiError ? error.message : 'Não foi possível atualizar o usuário.',
    });
  }
});

app.post('/api/users/:userId/reset-password', async (request, response) => {
  try {
    response.json(
      await resetManagedUserPassword(
        response.locals.authProfile,
        request.params.userId,
      ),
    );
  } catch (error) {
    const status = error instanceof UserApiError ? error.status : 500;
    if (status === 500) {
      console.error('Password reset failed:', error instanceof Error ? error.message : error);
    }
    response.status(status).json({
      error: error instanceof UserApiError ? error.message : 'Não foi possível redefinir a senha.',
    });
  }
});

app.delete('/api/users/:userId', async (request, response) => {
  try {
    await deactivateManagedUser(
      response.locals.authProfile,
      request.params.userId,
    );
    response.status(204).end();
  } catch (error) {
    const status = error instanceof UserApiError ? error.status : 500;
    if (status === 500) {
      console.error('User deactivation failed:', error instanceof Error ? error.message : error);
    }
    response.status(status).json({
      error: error instanceof UserApiError ? error.message : 'Não foi possível desativar o usuário.',
    });
  }
});

app.use('/api/documents', requireAuthentication, requireCompletedPasswordChange);

app.use('/api/document-files', requireAuthentication, requireCompletedPasswordChange);
app.post('/api/document-files', async (request, response) => {
  try {
    response.json(await storeDocumentFileChunk(response.locals.authProfile, request.body));
  } catch (error) {
    const status = error instanceof DocumentFileError ? error.status : 500;
    response.status(status).json({
      error: error instanceof DocumentFileError ? error.message : 'Não foi possível armazenar o documento.',
    });
  }
});
app.get('/api/document-files/:fileId', async (request, response) => {
  try {
    const file = await readDocumentFile(response.locals.authProfile, request.params.fileId);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', String(file.data.byteLength));
    response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(file.data);
  } catch (error) {
    const status = error instanceof DocumentFileError ? error.status : 500;
    response.status(status).json({
      error: error instanceof DocumentFileError ? error.message : 'Não foi possível abrir o documento.',
    });
  }
});

app.post('/api/documents/upload', async (request, response) => {
  const { data, fileName } = request.body as { data?: string; fileName?: string };
  if (!data || !fileName) {
    response.status(400).json({ error: 'Arquivo ausente.' });
    return;
  }
  try {
    await authorizeLegacyFileUpload(response.locals.authProfile, request.body);
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data)) {
      throw new DocumentFileError('Conteúdo do arquivo inválido.');
    }
    const contents = Buffer.from(data, 'base64');
    if (contents.byteLength === 0 || contents.byteLength > 20 * 1024 * 1024) {
      throw new DocumentFileError('O arquivo deve ter no máximo 20 MB.');
    }
    const extension = path.extname(fileName).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10);
    const storedName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    await writeFile(path.join(uploadDir, storedName), contents);
    response.json({ url: `/uploads/${storedName}` });
  } catch (error) {
    if (error instanceof DocumentFileError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    console.error('Document upload failed:', error instanceof Error ? error.message : error);
    response.status(500).json({ error: 'Não foi possível armazenar o documento.' });
  }
});

app.get('/api/documents/status', (_request, response) => {
  response.json({
    available: hasConfiguredGeminiKey(),
    model: getGeminiModel(),
    maxFileSize: 20 * 1024 * 1024,
    environment: 'local',
    persistentUploads: true
  });
});

app.post('/api/documents/upload-url', async (request, response) => {
  try {
    await requireApiCompanyPermission(
      response.locals.authProfile,
      request.body?.companyId,
      'documents.upload',
    );
    const session = await createDocumentUploadSession(request.body);
    response.json(session);
  } catch (error) {
    const status = error instanceof DocumentAssistantError || error instanceof ApiAuthenticationError
      ? error.status
      : 500;
    response.status(status).json({
      error:
        error instanceof Error
          ? error.message
          : 'Não foi possível preparar o documento para análise.',
    });
  }
});

app.post('/api/documents/analyze', async (request, response) => {
  try {
    await requireApiCompanyPermission(
      response.locals.authProfile,
      request.body?.companyId,
      'documents.upload',
    );
    const analysis = await analyzeDocument(request.body);
    response.json({ analysis, source: 'gemini' });
  } catch (error) {
    const status = error instanceof DocumentAssistantError || error instanceof ApiAuthenticationError
      ? error.status
      : 500;
    response.status(status).json({
      error:
        error instanceof Error
          ? error.message
          : 'Não foi possível analisar o documento agora.',
    });
  }
});

const production = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
if (production) {
  app.use(express.static(path.join(rootDir, 'dist')));
  app.get('*', (_request, response) => response.sendFile(path.join(rootDir, 'dist', 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

const server = app.listen(port, '0.0.0.0', () =>
  console.log(`Idex Finance disponível em http://localhost:${port}`),
);

const shutdown = async (signal: string) => {
  console.log(`${signal} recebido; encerrando o Idex Finance.`);
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
