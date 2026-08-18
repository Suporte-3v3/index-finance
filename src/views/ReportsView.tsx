/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import { downloadReportFile } from "../services/reportFiles";
import { hasDownloadableReportFile } from "../services/reportDownload";
import { formatDateTime } from "../services/dateFormatters";
import { REPORT_MODEL_INFO, REPORT_MODEL_TYPES } from "../config/reportBlocks";
import { ReportModelType, ReportRecord, ReportTemplate } from "../types";
import ReportBuilderView from "./reports/ReportBuilderView";
import {
  Card,
  IconButton,
  Tabs,
  Table,
  TableHead,
  TableBody,
  Tr,
  Th,
  Td,
  EmptyState,
} from "../components/ui";
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

  const confirmRename = async (template: ReportTemplate) => {
    const name = renameValue.trim();
    if (!name) {
      setRenamingId(null);
      return;
    }
    setError("");
    try {
      const saved = await saveReportTemplate({
        id: template.id,
        name,
        modelType: template.modelType,
        blocks: template.blocks,
        filters: template.filters,
        dreOptions: template.dreOptions,
      });
      if (!saved) throw new Error("Não foi possível renomear o modelo.");
      setRenamingId(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível renomear o modelo.");
    }
  };

  const runTemplateAction = async (operation: () => Promise<unknown>, fallback: string) => {
    setError("");
    try {
      await operation();
    } catch (error) {
      setError(error instanceof Error ? error.message : fallback);
    }
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
        <h2 id="reports-title" className="text-xl font-semibold text-ink dark:text-ink-dark tracking-tight font-sans">
          Central de Relatórios
        </h2>
        <p className="text-ink-soft dark:text-ink-soft-dark text-xs font-sans">
          Escolha um modelo confiável e personalize quais informações deseja apresentar.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/25 px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300">
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
              className="text-left bg-surface dark:bg-surface-dark rounded-lg border border-line dark:border-line-dark p-4 space-y-2 hover:border-brand-navy-900 dark:hover:border-brand-navy-700 hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 group-hover:bg-brand-navy-900 group-hover:text-white dark:group-hover:bg-brand-navy-700 transition-colors">
                <Icon className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-ink dark:text-ink-dark">{modelType}</h3>
              <p className="text-[11px] text-ink-soft dark:text-ink-soft-dark leading-relaxed">{REPORT_MODEL_INFO[modelType].description}</p>
            </button>
          );
        })}
      </div>

      {/* Meus modelos */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink dark:text-ink-dark uppercase tracking-wide">Meus modelos</h3>
          <Tabs
            items={[
              { id: "active", label: "Ativos" },
              { id: "archived", label: "Arquivados" },
            ]}
            value={showArchived ? "archived" : "active"}
            onChange={(id) => setShowArchived(id === "archived")}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {companyTemplates.map((template) => (
            <div
              key={template.id}
              onClick={() => renamingId !== template.id && openBuilder(template.modelType, template)}
              className="bg-zinc-50/60 dark:bg-zinc-800/30 rounded-lg border border-line dark:border-line-dark p-3.5 space-y-2 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer"
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
                        if (e.key === "Enter") void confirmRename(template);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="w-full text-xs font-semibold border border-zinc-300 dark:border-zinc-700 rounded-lg px-1.5 py-1 bg-white dark:bg-zinc-900 text-ink dark:text-ink-dark"
                    />
                  ) : (
                    <h4 className="text-xs font-semibold text-ink dark:text-ink-dark truncate">{template.name}</h4>
                  )}
                  <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark mt-0.5">
                    {template.modelType}
                    {template.modelType !== "DRE Gerencial" && ` · ${template.blocks.length} bloco(s)`}
                  </p>
                </div>
                <IconButton
                  icon={<Star className={template.favorite ? "fill-brand-gold-600 text-brand-gold-600" : ""} />}
                  label="Favoritar"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    void runTemplateAction(
                      () => toggleReportTemplateFavorite(template.id),
                      "Não foi possível atualizar o favorito.",
                    );
                  }}
                />
              </div>
              <div className="flex items-center gap-0.5 pt-1.5 border-t border-zinc-200/70 dark:border-zinc-800">
                {renamingId === template.id ? (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void confirmRename(template);
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
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      label="Renomear"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingId(template.id);
                        setRenameValue(template.name);
                      }}
                    />
                    <IconButton
                      icon={<Copy className="h-3.5 w-3.5" />}
                      label="Duplicar"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        void runTemplateAction(
                          () => duplicateReportTemplate(template.id),
                          "Não foi possível duplicar o modelo.",
                        );
                      }}
                    />
                    <IconButton
                      icon={template.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                      label={template.archived ? "Reativar" : "Arquivar"}
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        void runTemplateAction(
                          () => archiveReportTemplate(template.id, !template.archived),
                          "Não foi possível atualizar o arquivamento.",
                        );
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          ))}
          {companyTemplates.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                icon={<FileText />}
                title={showArchived ? "Nenhum modelo arquivado." : "Nenhum modelo salvo ainda"}
                description={
                  showArchived
                    ? undefined
                    : "Monte um relatório em um dos modelos acima e salve como modelo para reutilizar todo mês."
                }
              />
            </div>
          )}
        </div>
      </Card>

      {/* Histórico de relatórios gerados */}
      <Card className="space-y-4">
        <h3 className="text-sm font-bold text-ink dark:text-ink-dark uppercase tracking-wide">Histórico de Relatórios Compilados</h3>

        <Table>
          <TableHead>
            <Tr>
              <Th>Relatório</Th>
              <Th>Tipo</Th>
              <Th>Formato</Th>
              <Th>Gerado por</Th>
              <Th>Enviado para</Th>
              <Th>Data Compilação</Th>
              <Th align="right">Ação</Th>
            </Tr>
          </TableHead>
          <TableBody>
            {companyReports.map((rep) => {
              const canDownload = hasDownloadableReportFile(rep);
              return (
              <Tr key={rep.id}>
                <Td className="font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-ink-soft dark:text-ink-soft-dark shrink-0" />
                  {rep.name}
                </Td>
                <Td>{rep.type}</Td>
                <Td className="font-semibold">{rep.format || "Legado"}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <span className={`h-6 w-6 rounded-full ${getAvatarTint(rep.generatedByName)} text-white text-[9px] font-semibold flex items-center justify-center shrink-0`}>
                      {getInitials(rep.generatedByName)}
                    </span>
                    {rep.generatedByName}
                  </div>
                </Td>
                <Td className="text-ink-soft dark:text-ink-soft-dark">
                  {rep.recipientName ? `${rep.recipientName} (${rep.recipientRole === "CLIENT" ? "Cliente" : "Contador"})` : "—"}
                </Td>
                <Td className="text-ink-soft dark:text-ink-soft-dark">{formatDateTime(rep.generatedAt)}</Td>
                <Td align="right">
                  <button
                    onClick={() => handleDownload(rep)}
                    disabled={!canDownload}
                    title={canDownload ? `Baixar ${rep.fileName}` : "Relatório sem arquivo armazenado"}
                    className="text-xs bg-canvas dark:bg-white/5 hover:bg-brand-navy-900 dark:hover:bg-brand-navy-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed text-ink dark:text-ink-dark px-3 py-1.5 rounded-lg font-semibold border border-line dark:border-line-dark transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    <Download className="h-3.5 w-3.5" /> Baixar ({rep.fileSize})
                  </button>
                </Td>
              </Tr>
              );
            })}
            {companyReports.length === 0 && (
              <Tr>
                <Td colSpan={7}>
                  <EmptyState
                    icon={<FileText />}
                    title={
                      hasPermission("reports.generate")
                        ? "Nenhum relatório compilado ainda"
                        : "Nenhum relatório compilado na sessão recente"
                    }
                    description={
                      hasPermission("reports.generate")
                        ? "Escolha um modelo acima para começar."
                        : undefined
                    }
                  />
                </Td>
              </Tr>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
