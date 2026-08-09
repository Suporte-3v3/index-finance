import assert from "node:assert/strict";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
  override: false,
  quiet: true,
});

process.env.DATABASE_URL ||=
  "postgresql://idex_app:idex_local_dev_only@localhost:5432/idex_finance?schema=public";

const { disconnectDatabase, getDatabaseClient } = await import(
  "../backend/database.js"
);

const expectedTables = [
  "accounts_payable",
  "accounts_receivable",
  "audit_logs",
  "companies",
  "company_memberships",
  "documents",
  "tenants",
  "users",
] as const;

try {
  const database = getDatabaseClient();
  const tables = await database.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
  `;
  const availableTables = new Set(tables.map((table) => table.table_name));

  for (const table of expectedTables) {
    assert.ok(availableTables.has(table), `Tabela obrigatória ausente: ${table}`);
  }

  const migrations = await database.$queryRaw<Array<{ migration_name: string }>>`
    SELECT migration_name
    FROM _prisma_migrations
    WHERE finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  `;
  assert.ok(migrations.length > 0, "Nenhuma migração aplicada no PostgreSQL.");

  console.log(
    `PostgreSQL disponível: ${availableTables.size} tabelas e ${migrations.length} migração(ões) aplicada(s).`,
  );
} finally {
  await disconnectDatabase();
}
