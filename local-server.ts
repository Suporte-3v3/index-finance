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
  listFinancialEntries,
  payPayable,
  receiveReceivable,
  schedulePayable,
  updatePayable,
  updateReceivable,
} from './backend/financial-entries.js';
import {
  analyzeDocument,
  createDocumentUploadSession,
  DocumentAssistantError,
  getGeminiModel,
  hasConfiguredGeminiKey,
} from './backend/document-assistant.js';

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
app.use(
  '/uploads',
  requireAuthentication,
  requireCompletedPasswordChange,
  express.static(uploadDir, { fallthrough: false }),
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

app.use('/api/payables', requireAuthentication, requireCompletedPasswordChange);
app.post('/api/payables', async (request, response) => {
  try {
    response.status(201).json(await createPayables(response.locals.authProfile, request.body));
  } catch (error) {
    financialEntriesError(response, error, 'Não foi possível cadastrar a conta a pagar.');
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

app.post('/api/documents/upload', async (request, response) => {
  const { data, fileName } = request.body as { data?: string; fileName?: string };
  if (!data || !fileName) {
    response.status(400).json({ error: 'Arquivo ausente.' });
    return;
  }
  try {
    const extension = path.extname(fileName).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10);
    const storedName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    await writeFile(path.join(uploadDir, storedName), Buffer.from(data, 'base64'));
    response.json({ url: `/uploads/${storedName}` });
  } catch (error) {
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
    const session = await createDocumentUploadSession(request.body);
    response.json(session);
  } catch (error) {
    const status = error instanceof DocumentAssistantError ? error.status : 500;
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
    const analysis = await analyzeDocument(request.body);
    response.json({ analysis, source: 'gemini' });
  } catch (error) {
    const status = error instanceof DocumentAssistantError ? error.status : 500;
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
