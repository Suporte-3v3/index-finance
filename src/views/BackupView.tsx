/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import { Button, Card } from "../components/ui";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileJson,
  HardDriveDownload,
  Lock,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";

// Auditoria, notificações, relatórios, chamados de suporte e o caixa da
// padaria já são 100% Postgres — não fazem mais parte deste backup local.
const BACKUP_KEYS = [
  "tenants",
  "companies",
  "users",
  "bankAccounts",
  "masterData",
  "accountsPayable",
  "accountsReceivable",
  "approvals",
  "documents",
  "statementItems",
  "activeCompanyId",
] as const;

const ARRAY_BACKUP_KEYS = [
  "tenants",
  "companies",
  "users",
  "bankAccounts",
  "masterData",
  "accountsPayable",
  "accountsReceivable",
  "approvals",
  "documents",
] as const;

interface EmbeddedBackupFile {
  sourceUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
  sha256: string;
  data: string;
}

interface BackupFile {
  format: "idex-finance-backup";
  version: 2;
  exportedAt: string;
  exportedBy: string;
  data: Record<string, unknown>;
  files: EmbeddedBackupFile[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isManagedUploadReference(value: string): boolean {
  try {
    return new URL(value, window.location.origin).pathname.startsWith(
      "/uploads/",
    );
  } catch {
    return false;
  }
}

function collectManagedUploadReferences(value: unknown, result = new Set<string>()) {
  if (typeof value === "string") {
    if (isManagedUploadReference(value)) result.add(value);
    return result;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectManagedUploadReferences(item, result));
    return result;
  }
  if (isRecord(value)) {
    Object.values(value).forEach((item) =>
      collectManagedUploadReferences(item, result),
    );
  }
  return result;
}

function replaceFileReferences(
  value: unknown,
  restoredUrls: Map<string, string>,
): unknown {
  if (typeof value === "string") return restoredUrls.get(value) || value;
  if (Array.isArray(value)) {
    return value.map((item) => replaceFileReferences(item, restoredUrls));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        replaceFileReferences(item, restoredUrls),
      ]),
    );
  }
  return value;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Não foi possível ler um anexo."));
    reader.readAsDataURL(blob);
  });
}

function base64ToArrayBuffer(data: string): ArrayBuffer {
  const binary = window.atob(data);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return buffer;
}

async function calculateSha256(buffer: ArrayBuffer): Promise<string> {
  const hash = await window.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fileNameFromUrl(sourceUrl: string): string {
  try {
    const pathName = new URL(sourceUrl, window.location.origin).pathname;
    return decodeURIComponent(pathName.split("/").pop() || "arquivo");
  } catch {
    return "arquivo";
  }
}

function validateBackup(value: unknown): BackupFile {
  if (!isRecord(value) || value.format !== "idex-finance-backup") {
    throw new Error("Formato de backup inválido.");
  }
  if (value.version === 1) {
    throw new Error(
      "Este backup foi gerado no formato antigo e não contém cadastros e arquivos suficientes para uma restauração segura.",
    );
  }
  if (value.version !== 2 || !isRecord(value.data) || !Array.isArray(value.files)) {
    throw new Error("Versão de backup inválida ou não suportada.");
  }
  if (
    typeof value.exportedAt !== "string" ||
    typeof value.exportedBy !== "string" ||
    !ARRAY_BACKUP_KEYS.every((key) => Array.isArray(value.data[key])) ||
    !isRecord(value.data.statementItems) ||
    typeof value.data.activeCompanyId !== "string"
  ) {
    throw new Error("O backup está incompleto ou possui dados inválidos.");
  }

  const files = value.files as unknown[];
  const validFiles = files.every(
    (file) =>
      isRecord(file) &&
      typeof file.sourceUrl === "string" &&
      typeof file.fileName === "string" &&
      typeof file.mimeType === "string" &&
      typeof file.size === "number" &&
      file.size >= 0 &&
      typeof file.sha256 === "string" &&
      /^[a-f0-9]{64}$/.test(file.sha256) &&
      typeof file.data === "string",
  );
  if (!validFiles) throw new Error("O backup contém anexos inválidos.");

  const typedBackup = value as unknown as BackupFile;
  const embeddedUrls = new Set(typedBackup.files.map((file) => file.sourceUrl));
  if (embeddedUrls.size !== typedBackup.files.length) {
    throw new Error("O backup contém anexos duplicados.");
  }
  const missingFile = Array.from(
    collectManagedUploadReferences(typedBackup.data),
  ).find((url) => !embeddedUrls.has(url));
  if (missingFile) {
    throw new Error(
      `O backup referencia um arquivo que não foi incluído: ${fileNameFromUrl(missingFile)}.`,
    );
  }

  return typedBackup;
}

function persistRestoredData(data: Record<string, unknown>) {
  const serialized = new Map<string, string>();
  const previousValues = new Map<string, string | null>();

  BACKUP_KEYS.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(data, key)) {
      throw new Error(`O conjunto de dados ${key} está ausente no backup.`);
    }
    const storageKey = `bpo_saas_${key}`;
    serialized.set(storageKey, JSON.stringify(data[key]));
    previousValues.set(storageKey, localStorage.getItem(storageKey));
  });

  try {
    serialized.forEach((value, key) => localStorage.setItem(key, value));
  } catch (reason) {
    previousValues.forEach((value, key) => {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    });
    throw reason;
  }
}

export default function BackupView() {
  const {
    tenants,
    companies,
    users,
    bankAccounts,
    masterData,
    accountsPayable,
    accountsReceivable,
    approvals,
    documents,
    statementItems,
    currentUser,
    activeCompany,
  } = useBPOState();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedBackup, setSelectedBackup] = useState<BackupFile | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [error, setError] = useState("");
  const [restored, setRestored] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [progress, setProgress] = useState("");

  if (currentUser.role !== "BPO_ADMIN") {
    return (
      <Card className="text-center space-y-3">
        <Lock className="h-8 w-8 mx-auto text-ink-soft dark:text-ink-soft-dark" />
        <p className="text-ink dark:text-ink-dark text-xs font-semibold">
          Apenas o proprietário com perfil Administrador BPO pode acessar
          backups.
        </p>
      </Card>
    );
  }

  const buildLiveBackupData = (): Record<string, unknown> => ({
    tenants,
    companies,
    users,
    bankAccounts,
    masterData,
    accountsPayable,
    accountsReceivable,
    approvals,
    documents,
    statementItems,
    activeCompanyId: activeCompany?.id || companies[0]?.id || "",
  });

  const handleDownload = async () => {
    setError("");
    setRestored(false);
    setIsExporting(true);
    try {
      const data = buildLiveBackupData();
      const sourceUrls = Array.from(collectManagedUploadReferences(data));
      const files: EmbeddedBackupFile[] = [];

      for (let index = 0; index < sourceUrls.length; index += 1) {
        const sourceUrl = sourceUrls[index];
        setProgress(`Incluindo arquivo ${index + 1} de ${sourceUrls.length}...`);
        const response = await fetch(sourceUrl);
        if (!response.ok) {
          throw new Error(
            `Não foi possível incluir o arquivo ${fileNameFromUrl(sourceUrl)}. O backup não foi gerado para evitar uma cópia incompleta.`,
          );
        }
        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        files.push({
          sourceUrl,
          fileName: fileNameFromUrl(sourceUrl),
          mimeType: blob.type || "application/octet-stream",
          size: blob.size,
          sha256: await calculateSha256(buffer),
          data: await blobToBase64(blob),
        });
      }

      const backup: BackupFile = {
        format: "idex-finance-backup",
        version: 2,
        exportedAt: new Date().toISOString(),
        exportedBy: currentUser.email,
        data,
        files,
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `idex-finance-backup-${date}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível gerar o backup.",
      );
    } finally {
      setProgress("");
      setIsExporting(false);
    }
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError("");
    setRestored(false);
    setSelectedBackup(null);
    setSelectedFileName("");
    if (!file) return;

    try {
      const parsed: unknown = JSON.parse(await file.text());
      const backup = validateBackup(parsed);
      setSelectedBackup(backup);
      setSelectedFileName(file.name);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível ler o arquivo.",
      );
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup) return;
    const confirmed = window.confirm(
      "Restaurar este backup substituirá os dados e arquivos atuais do sistema. Deseja continuar?",
    );
    if (!confirmed) return;

    setError("");
    setRestored(false);
    setIsRestoring(true);
    try {
      const restoredUrls = new Map<string, string>();
      for (let index = 0; index < selectedBackup.files.length; index += 1) {
        const file = selectedBackup.files[index];
        setProgress(
          `Restaurando arquivo ${index + 1} de ${selectedBackup.files.length}...`,
        );
        let buffer: ArrayBuffer;
        try {
          buffer = base64ToArrayBuffer(file.data);
        } catch {
          throw new Error(`O arquivo ${file.fileName} possui conteúdo inválido.`);
        }
        if (buffer.byteLength !== file.size) {
          throw new Error(`O arquivo ${file.fileName} está incompleto.`);
        }
        if ((await calculateSha256(buffer)) !== file.sha256) {
          throw new Error(`A integridade do arquivo ${file.fileName} é inválida.`);
        }

        const response = await fetch("/api/documents/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: file.data,
            fileName: file.fileName,
            mimeType: file.mimeType,
          }),
        });
        const result = (await response.json().catch(() => ({}))) as {
          url?: string;
          error?: string;
        };
        if (!response.ok || !result.url) {
          throw new Error(
            result.error || `Não foi possível restaurar ${file.fileName}.`,
          );
        }
        restoredUrls.set(file.sourceUrl, result.url);
      }

      setProgress("Aplicando os dados restaurados...");
      const restoredData = replaceFileReferences(
        selectedBackup.data,
        restoredUrls,
      ) as Record<string, unknown>;
      persistRestoredData(restoredData);
      setRestored(true);
      window.setTimeout(() => window.location.reload(), 900);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível restaurar o backup.",
      );
    } finally {
      setProgress("");
      setIsRestoring(false);
    }
  };

  const embeddedSize =
    selectedBackup?.files.reduce((total, file) => total + file.size, 0) || 0;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <HardDriveDownload className="h-5 w-5 text-brand-navy-900 dark:text-brand-navy-700/90" />
          <h1 className="text-2xl sm:text-3xl font-bold text-ink dark:text-ink-dark tracking-tight">
            Backup de Dados
          </h1>
        </div>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark leading-relaxed mt-1">
          Exporte e restaure dados operacionais, cadastros auxiliares e os
          arquivos originais enviados. Auditoria, notificações, relatórios,
          chamados de suporte e o caixa da padaria já ficam salvos direto no
          banco de dados e não fazem parte deste backup.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-brand-navy-700/20 dark:border-brand-navy-700/25 bg-brand-blue-50 dark:bg-brand-navy-700/15 p-4">
        <ShieldCheck className="h-5 w-5 text-brand-navy-900 dark:text-brand-navy-700/90 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-brand-navy-900 dark:text-brand-navy-700/90">
            Área exclusiva do proprietário BPO
          </p>
          <p className="text-[11px] text-ink-soft dark:text-ink-soft-dark mt-0.5">
            O arquivo contém informações financeiras e anexos em Base64. Ele
            pode ficar grande e deve ser armazenado em local seguro.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-brand-red-600 dark:text-red-300 bg-brand-red-50 dark:bg-brand-red-600/10 border border-brand-red-600/25 rounded-lg p-3">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-brand-green-50 text-brand-green-600 dark:bg-brand-green-600/15 dark:text-emerald-300">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink dark:text-ink-dark">
                Baixar backup completo
              </h3>
              <p className="text-[11px] text-ink-soft dark:text-ink-soft-dark">
                Inclui masterData e uma cópia verificável de cada anexo.
              </p>
            </div>
          </div>
          <Button
            fullWidth
            variant="secondary"
            onClick={() => void handleDownload()}
            disabled={isExporting || isRestoring}
            icon={<HardDriveDownload className="h-4 w-4" />}
          >
            {isExporting ? progress || "Preparando backup..." : "Gerar e baixar backup"}
          </Button>
        </Card>

        <Card className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-brand-gold-300/20 text-amber-700 dark:bg-brand-gold-600/15 dark:text-brand-gold-300">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink dark:text-ink-dark">
                Restaurar backup
              </h3>
              <p className="text-[11px] text-ink-soft dark:text-ink-soft-dark">
                Valida dados, anexos e integridade antes de substituir o estado atual.
              </p>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFile}
            disabled={isExporting || isRestoring}
            className="hidden"
          />
          <Button
            fullWidth
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={isExporting || isRestoring}
            icon={<FileJson className="h-4 w-4" />}
          >
            Selecionar arquivo de backup
          </Button>

          {selectedBackup && (
            <div className="rounded-lg border border-line dark:border-line-dark bg-canvas dark:bg-white/5 p-3 space-y-2 text-[11px]">
              <div className="flex items-center gap-2 font-semibold text-ink dark:text-ink-dark">
                <CheckCircle2 className="h-4 w-4 text-brand-green-600 dark:text-emerald-400" /> Arquivo
                validado
              </div>
              <p className="text-ink dark:text-ink-dark truncate">{selectedFileName}</p>
              <p className="text-ink-soft dark:text-ink-soft-dark">
                Gerado em {new Date(selectedBackup.exportedAt).toLocaleString("pt-BR")}
              </p>
              <p className="text-ink-soft dark:text-ink-soft-dark">
                {selectedBackup.files.length} arquivo(s) físico(s) — {" "}
                {(embeddedSize / 1024 / 1024).toLocaleString("pt-BR", {
                  maximumFractionDigits: 2,
                })}{" "}
                MB
              </p>
              <p className="text-ink-soft dark:text-ink-soft-dark">
                {(selectedBackup.data.masterData as unknown[]).length} cadastro(s)
                auxiliar(es)
              </p>
              <Button
                fullWidth
                className="mt-2"
                onClick={() => void handleRestore()}
                disabled={isRestoring || isExporting}
                icon={<RefreshCw className="h-4 w-4" />}
              >
                {isRestoring ? progress || "Restaurando..." : "Confirmar restauração"}
              </Button>
            </div>
          )}

          {restored && (
            <div className="flex items-center gap-2 text-xs text-brand-green-600 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="h-4 w-4" /> Backup restaurado.
              Recarregando o sistema...
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
