import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

type DatabaseGlobal = typeof globalThis & {
  __idexDatabaseClient?: PrismaClient;
};

const databaseGlobal = globalThis as DatabaseGlobal;

export function hasDatabaseConfiguration(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getDatabaseClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não configurada. Copie .env.example para .env.local e configure o PostgreSQL.",
    );
  }

  if (!databaseGlobal.__idexDatabaseClient) {
    const adapter = new PrismaPg({ connectionString });
    databaseGlobal.__idexDatabaseClient = new PrismaClient({ adapter });
  }

  return databaseGlobal.__idexDatabaseClient;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  if (!hasDatabaseConfiguration()) return false;

  const database = getDatabaseClient();
  await database.$queryRaw`SELECT 1`;
  return true;
}

export async function disconnectDatabase(): Promise<void> {
  if (!databaseGlobal.__idexDatabaseClient) return;

  await databaseGlobal.__idexDatabaseClient.$disconnect();
  databaseGlobal.__idexDatabaseClient = undefined;
}
