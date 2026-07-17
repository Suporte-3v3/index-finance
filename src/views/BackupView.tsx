/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { useBPOState } from '../hooks/useBPOState';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileJson,
  HardDriveDownload,
  Lock,
  RefreshCw,
  ShieldCheck,
  Upload
} from 'lucide-react';

const BACKUP_KEYS = [
  'tenants',
  'companies',
  'users',
  'bankAccounts',
  'accountsPayable',
  'accountsReceivable',
  'approvals',
  'documents',
  'auditLogs',
  'notifications',
  'reports',
  'statementItems',
  'supportTickets',
  'activeCompanyId'
] as const;

interface BackupFile {
  format: 'idex-finance-backup';
  version: 1;
  exportedAt: string;
  exportedBy: string;
  data: Record<string, unknown>;
}

function isValidBackup(value: unknown): value is BackupFile {
  if (!value || typeof value !== 'object') return false;
  const backup = value as Partial<BackupFile>;
  if (
    backup.format !== 'idex-finance-backup' ||
    backup.version !== 1 ||
    !backup.data ||
    typeof backup.data !== 'object'
  ) return false;

  const data = backup.data as Record<string, unknown>;
  return Array.isArray(data.users) && Array.isArray(data.companies);
}

export default function BackupView() {
  const { currentUser } = useBPOState();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedBackup, setSelectedBackup] = useState<BackupFile | null>(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [error, setError] = useState('');
  const [restored, setRestored] = useState(false);

  if (currentUser.role !== 'BPO_ADMIN') {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center space-y-3">
        <Lock className="h-8 w-8 mx-auto text-zinc-400" />
        <p className="text-zinc-600 text-xs font-semibold">
          Apenas o proprietário com perfil Administrador BPO pode acessar backups.
        </p>
      </div>
    );
  }

  const handleDownload = () => {
    const data: Record<string, unknown> = {};
    BACKUP_KEYS.forEach(key => {
      const storedValue = localStorage.getItem(`bpo_saas_${key}`);
      if (storedValue !== null) data[key] = JSON.parse(storedValue);
    });

    const backup: BackupFile = {
      format: 'idex-finance-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      exportedBy: currentUser.email,
      data
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `idex-finance-backup-${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError('');
    setRestored(false);
    setSelectedBackup(null);
    setSelectedFileName('');
    if (!file) return;

    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isValidBackup(parsed)) throw new Error('Formato de backup inválido.');
      setSelectedBackup(parsed);
      setSelectedFileName(file.name);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível ler o arquivo.');
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRestore = () => {
    if (!selectedBackup) return;
    const confirmed = window.confirm(
      'Restaurar este backup substituirá os dados atuais do sistema. Deseja continuar?'
    );
    if (!confirmed) return;

    BACKUP_KEYS.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(selectedBackup.data, key)) {
        localStorage.setItem(`bpo_saas_${key}`, JSON.stringify(selectedBackup.data[key]));
      }
    });
    setRestored(true);
    window.setTimeout(() => window.location.reload(), 700);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <HardDriveDownload className="h-5 w-5 text-[#0B2C52]" />
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Backup de Dados</h2>
        </div>
        <p className="text-zinc-500 text-xs mt-1">
          Exporte uma cópia dos dados operacionais ou restaure um backup anterior.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-[#0B2C52]/15 bg-[#0B2C52]/5 p-4">
        <ShieldCheck className="h-5 w-5 text-[#0B2C52] shrink-0" />
        <div>
          <p className="text-xs font-bold text-[#0B2C52]">Área exclusiva do proprietário BPO</p>
          <p className="text-[11px] text-zinc-600 mt-0.5">
            O arquivo contém informações financeiras e deve ser armazenado em local seguro.
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="bg-white rounded-xl border border-zinc-200 shadow-xs p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700"><Download className="h-5 w-5" /></div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Baixar backup</h3>
              <p className="text-[11px] text-zinc-500">Gera uma cópia completa no formato JSON.</p>
            </div>
          </div>
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 bg-[#0B2C52] hover:bg-[#0B2C52]/90 text-white text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer"
          >
            <HardDriveDownload className="h-4 w-4" /> Gerar e baixar backup
          </button>
        </section>

        <section className="bg-white rounded-xl border border-zinc-200 shadow-xs p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-50 text-amber-700"><Upload className="h-5 w-5" /></div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Restaurar backup</h3>
              <p className="text-[11px] text-zinc-500">Selecione um arquivo gerado pelo Idex Finance.</p>
            </div>
          </div>

          <input ref={inputRef} type="file" accept="application/json,.json" onChange={handleFile} className="hidden" />
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 border border-zinc-300 hover:bg-zinc-50 text-zinc-800 text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer"
          >
            <FileJson className="h-4 w-4" /> Selecionar arquivo de backup
          </button>

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {selectedBackup && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-2 text-[11px]">
              <div className="flex items-center gap-2 font-bold text-zinc-800"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Arquivo validado</div>
              <p className="text-zinc-600 truncate">{selectedFileName}</p>
              <p className="text-zinc-500">Gerado em {new Date(selectedBackup.exportedAt).toLocaleString('pt-BR')}</p>
              <button
                onClick={handleRestore}
                className="mt-2 w-full flex items-center justify-center gap-2 bg-[#C8102E] hover:bg-[#A90D25] text-white text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" /> Confirmar restauração
              </button>
            </div>
          )}

          {restored && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 font-bold">
              <CheckCircle2 className="h-4 w-4" /> Backup restaurado. Recarregando o sistema...
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
