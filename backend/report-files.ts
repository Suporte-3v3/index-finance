import { unlink } from "node:fs/promises";
import path from "node:path";
import { getDatabaseClient } from "./database.js";

const LEGACY_REPORT_FILE = /^\/uploads\/([0-9]+-[0-9a-f-]{36}(?:\.[a-z0-9]{1,9})?)$/i;
const PERSISTED_REPORT_FILE = /^\/api\/document-files\/([0-9a-f-]{36})$/i;

async function hasActiveReference(objectKey: string) {
  const database = getDatabaseClient();
  const [reports, documents] = await Promise.all([
    database.report.count({ where: { objectKey } }),
    database.document.count({ where: { objectKey, deletedAt: null } }),
  ]);
  return reports > 0 || documents > 0;
}

export async function removeReportFileIfUnreferenced(objectKey: string) {
  if (await hasActiveReference(objectKey)) return false;

  const persisted = objectKey.match(PERSISTED_REPORT_FILE);
  if (persisted) {
    await getDatabaseClient().documentFile.deleteMany({ where: { id: persisted[1] } });
    return true;
  }

  const legacy = objectKey.match(LEGACY_REPORT_FILE);
  if (!legacy) return false;
  const uploadDirectory = path.resolve(process.cwd(), ".data", "uploads");
  const target = path.resolve(uploadDirectory, legacy[1]);
  if (path.dirname(target) !== uploadDirectory) return false;
  try {
    await unlink(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return true;
}
