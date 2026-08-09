import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
  override: false,
  quiet: true,
});

const localDatabaseUrl =
  "postgresql://idex_app:idex_local_dev_only@localhost:5432/idex_finance?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL || localDatabaseUrl,
  },
});
