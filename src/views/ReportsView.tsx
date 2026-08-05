/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import { downloadReportFile } from "../services/reportFiles";
import { REPORT_MODEL_INFO, REPORT_MODEL_TYPES } from "../config/reportBlocks";
import { ReportModelType, ReportRecord, ReportTemplate } from "../types";
import ReportBuilderView from "./reports/ReportBuilderView";
import {
  Archive,
  ArchiveRestore,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Copy,
  Download,
  FileText,
  Pencil,
  Star,
  Wallet,
} from "lucide-react";

const formatDateTime = (value: string) => new Date(value).toLocaleString("pt-BR");

const MODEL_ICONS: Record<ReportModelType, React.ComponentType<{ className?: string }>> = {
  "Contas a Pagar": ArrowUpRight,
  "Contas a Receber": ArrowDownRight,
  "Fluxo de Caixa": Wallet,
  "DRE Gerencial": BarChart3,
};

const REPORT_AVATAR_PALETTE = [
  "bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-sky-500", "bg-purple-500", "bg-teal-500",
];

const getInitials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

const getAvatarTint = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return REPORT_AVATAR_PALETTE[Math.abs(hash) % REPORT_AVATAR_PALETTE.length];
};

function IconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="p-1.5 rounded-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer transition-colors"
    >
      {children}
    </button>
  );
}

export default function ReportsView() {
  const {
    activeCompany,
    reports,
    reportTemplates,
    hasPermission,
    duplicateReportTemplate,
    archiveReportTemplate,
    toggleReportTemplateFavorite,
    saveReportTemplate,
  } = useBPOState();

  const [builderModel, setBuilderModel] = useState<ReportModelType | null>(null);
  const [builderTemplate, setBuilderTemplate] = useState<ReportTemplate | undefined>(undefined);
  const [showArchived, setShowArchived] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState("");

  if (!activeCompany) return null;

  if (builderModel) {
    return (
      <ReportBuilderView
        modelType={builderModel}
        template={builderTemplate}
        onClose={() => {
          setBuilderModel(null);
          setBuilderTemplate(undefined);
        }}
      />
    );
  }

  const openBuilder = (modelType: ReportModelType, template?: ReportTemplate) => {
    setBuilderModel(modelType);
    setBuilderTemplate(template);
  };

  const companyTemplates = reportTemplates
    .filter((template) => template.companyId === activeCompany.id && template.archived === showArchived)
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt));

  const companyReports = reports.filter((r) => r.companyId === activeCompany.id);

  const confirmRename = (template: ReportTemplate) => {
    const name = renameValue.trim();
    if (!name) {
      setRenamingId(null);
      return;
    }
    saveReportTemplate({
      id: template.id,
      name,
      modelType: template.modelType,
      blocks: template.blocks,
      filters: template.filters,
      dreOptions: template.dreOptions,
    });
    setRenamingId(null);
  };

  const handleDownload = (report: ReportRecord) => {
    setError("");
    if (!downloadReportFile(report)) {
      setError(`O arquivo de "${report.name}" não está armazenado. Gere novamente este relatório.`);
    }
  };

  return (
    <div id="reports-root" className="space-y-5">
      <div>
        <h2 id="reports-title" className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight font-sans">
          Central de Relatórios
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-xs font-sans">
          Escolha um modelo confiável e personalize quais informações deseja apresentar.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-sm border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/25 px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Modelos do sistema */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {REPORT_MODEL_TYPES.map((modelType) => {
          const Icon = MODEL_ICONS[modelType];
          return (
            <button
              key={modelType}
              onClick={() => openBuilder(modelType)}
              className="text-left bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 p-4 space-y-2 hover:border-[#0B2C52] dark:hover:border-[#3E6DA6] hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="h-9 w-9 flex items-center justify-center rounded-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 group-hover:bg-[#0B2C52] group-hover:text-white dark:group-hover:bg-[#3E6DA6] transition-colors">
                <Icon className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{modelType}</h3>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">{REPORT_MODEL_INFO[modelType].description}</p>
            </button>
          );
        })}
      </div>

      {/* Meus modelos */}
      <div className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 uppercase tracking-wide font-sans">Meus modelos</h3>
          <div className="flex gap-1 text-[11px] font-semibold">
            <button
              onClick={() => setShowArchived(false)}
              className={`px-2.5 py-1 rounded-sm cursor-pointer ${!showArchived ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
            >
              Ativos
            </button>
            <button
              onClick={() => setShowArchived(true)}
              className={`px-2.5 py-1 rounded-sm cursor-pointer ${showArchived ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
            >
              Arquivados
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {companyTemplates.map((template) => (
            <div
              key={template.id}
              onClick={() => renamingId !== template.id && openBuilder(template.modelType, template)}
              className="bg-zinc-50/60 dark:bg-zinc-800/30 rounded-sm border border-zinc-200 dark:border-zinc-800 p-3.5 space-y-2 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {renamingId === template.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmRename(template);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="w-full text-xs font-semibold border border-zinc-300 dark:border-zinc-700 rounded-sm px-1.5 py-1 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                    />
                  ) : (
                    <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-50 truncate">{template.name}</h4>
                  )}
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                    {template.modelType}
                    {template.modelType !== "DRE Gerencial" && ` · ${template.blocks.length} bloco(s)`}
                  </p>
                </div>
                <IconButton title="Favoritar" onClick={() => toggleReportTemplateFavorite(template.id)}>
                  <Star className={`h-4 w-4 ${template.favorite ? "fill-amber-400 text-amber-400" : ""}`} />
                </IconButton>
              </div>
              <div className="flex items-center gap-0.5 pt-1.5 border-t border-zinc-200/70 dark:border-zinc-800">
                {renamingId === template.id ? (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmRename(template);
                      }}
                      className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 px-2 py-1 cursor-pointer"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingId(null);
                      }}
                      className="text-[10px] font-semibold text-zinc-400 px-2 py-1 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <IconButton
                      title="Renomear"
                      onClick={() => {
                        setRenamingId(template.id);
                        setRenameValue(template.name);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton title="Duplicar" onClick={() => duplicateReportTemplate(template.id)}>
                      <Copy className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      title={template.archived ? "Reativar" : "Arquivar"}
                      onClick={() => archiveReportTemplate(template.id, !template.archived)}
                    >
                      {template.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                    </IconButton>
                  </>
                )}
              </div>
            </div>
          ))}
          {companyTemplates.length === 0 && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 italic col-span-full py-6 text-center">
              {showArchived
                ? "Nenhum modelo arquivado."
                : "Nenhum modelo salvo ainda. Monte um relatório em um dos modelos acima e salve como modelo para reutilizar todo mês."}
            </p>
          )}
        </div>
      </div>

      {/* Histórico de relatórios gerados */}
      <div className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs p-5 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 uppercase tracking-wide font-sans">Histórico de Relatórios Compilados</h3>

        <div className="overflow-x-auto font-sans text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-[#091320]/60 border-b border-zinc-200 dark:border-zinc-800">
                <th className="p-3 text-zinc-500 dark:text-zinc-400 font-semibold uppercase">Relatório</th>
                <th className="p-3 text-zinc-500 dark:text-zinc-400 font-semibold uppercase">Tipo</th>
                <th className="p-3 text-zinc-500 dark:text-zinc-400 font-semibold uppercase">Formato</th>
                <th className="p-3 text-zinc-500 dark:text-zinc-400 font-semibold uppercase">Gerado por</th>
                <th className="p-3 text-zinc-500 dark:text-zinc-400 font-semibold uppercase">Enviado para</th>
                <th className="p-3 text-zinc-500 dark:text-zinc-400 font-semibold uppercase">Data Compilação</th>
                <th className="p-3 text-zinc-500 dark:text-zinc-400 font-semibold uppercase text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {companyReports.map((rep) => (
                <tr key={rep.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors font-sans">
                  <td className="p-3 font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                    {rep.name}
                  </td>
                  <td className="p-3 font-medium text-zinc-600 dark:text-zinc-300">{rep.type}</td>
                  <td className="p-3 font-semibold text-zinc-600 dark:text-zinc-300">{rep.format || "Legado"}</td>
                  <td className="p-3 text-zinc-500 dark:text-zinc-400 font-medium">
                    <div className="flex items-center gap-2">
                      <span className={`h-6 w-6 rounded-full ${getAvatarTint(rep.generatedByName)} text-white text-[9px] font-semibold flex items-center justify-center shrink-0`}>
                        {getInitials(rep.generatedByName)}
                      </span>
                      {rep.generatedByName}
                    </div>
                  </td>
                  <td className="p-3 text-zinc-500 dark:text-zinc-400">
                    {rep.recipientName ? `${rep.recipientName} (${rep.recipientRole === "CLIENT" ? "Cliente" : "Contador"})` : "—"}
                  </td>
                  <td className="p-3 text-zinc-500 dark:text-zinc-400">{formatDateTime(rep.generatedAt)}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleDownload(rep)}
                      disabled={!rep.fileContent}
                      title={rep.fileContent ? `Baixar ${rep.fileName}` : "Relatório legado sem arquivo armazenado"}
                      className="text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-950 dark:hover:bg-zinc-100 hover:text-white dark:hover:text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-800 dark:text-zinc-200 px-3 py-1.5 rounded-sm font-semibold border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer flex items-center gap-1 inline-flex"
                    >
                      <Download className="h-3.5 w-3.5" /> Baixar ({rep.fileSize})
                    </button>
                  </td>
                </tr>
              ))}
              {companyReports.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-400 dark:text-zinc-500 italic">
                    {hasPermission("reports.generate")
                      ? "Nenhum relatório compilado ainda. Escolha um modelo acima para começar."
                      : "Nenhum relatório compilado na sessão recente."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
