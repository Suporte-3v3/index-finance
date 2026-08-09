/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FolderOutput,
  GripVertical,
  Play,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useBPOState } from "../../hooks/useBPOState";
import { Button, IconButton, Card, SectionLabel } from "../../components/ui";
import {
  CashFlowReportGrouping,
  CashFlowReportView,
  DreReportOptions,
  MasterDataType,
  ReportBlockConfig,
  ReportBlockKey,
  ReportDateBasis,
  ReportExportFormat,
  ReportFilters,
  ReportModelType,
  ReportRecord,
  ReportTemplate,
} from "../../types";
import {
  getBlockDefinition,
  REPORT_BLOCKS,
} from "../../config/reportBlocks";
import {
  computeDreSections,
  computeReportSections,
} from "../../services/reportComputations";
import { ReportSectionData, downloadReportFile } from "../../services/reportFiles";
import { ChartDefs, ChartTooltip, CHART_SHADOW } from "../../components/charts";

const PALETTE = ["#0B2C52", "#C8102E", "#E7B967", "#15996F", "#174E83", "#8F071B"];

const AP_STATUSES = [
  "Rascunho", "Pendente", "Aguardando aprovação", "A vencer", "Aprovada",
  "Agendada", "Paga", "Parcialmente paga", "Vencida", "Rejeitada", "Cancelada",
];
const AR_STATUSES = [
  "Rascunho", "Pendente", "A receber", "Parcialmente recebido", "Recebido",
  "Vencido", "Em cobrança", "Negociada", "Cancelado",
];

const DATE_BASIS_LABEL: Record<ReportDateBasis, string> = {
  due: "Vencimento",
  payment: "Pagamento/Recebimento",
  competence: "Competência",
};

const LABEL_CLASS = "text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block";
const INPUT_CLASS = "w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-navy-900 dark:[color-scheme:dark]";

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Todos",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className={LABEL_CLASS}>{label}</label>
      <select className={INPUT_CLASS} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function SectionPreview({ section, showTitle = true }: { section: ReportSectionData; showTitle?: boolean }) {
  if (section.kind === "kpis") {
    return (
      <div className="space-y-2">
        {showTitle && section.title && (
          <h4 className="text-[10px] font-semibold uppercase text-ink-soft dark:text-ink-soft-dark">{section.title}</h4>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {section.items.map((item, index) => (
            <div
              key={index}
              className="rounded-lg border border-line dark:border-line-dark bg-zinc-50 dark:bg-zinc-800/40 p-2.5"
            >
              <div className="text-[9px] uppercase text-ink-soft dark:text-ink-soft-dark">{item.label}</div>
              <div className="text-xs font-semibold text-ink dark:text-ink-dark truncate" title={item.value}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section.kind === "table") {
    return (
      <div className="space-y-2">
        {showTitle && (
          <h4 className="text-[10px] font-semibold uppercase text-ink-soft dark:text-ink-soft-dark">{section.title}</h4>
        )}
        <div className="overflow-x-auto rounded-lg border border-line dark:border-line-dark">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-line dark:border-line-dark">
                {section.columns.map((column) => (
                  <th key={column} className="p-2 text-ink-soft dark:text-ink-soft-dark font-semibold uppercase whitespace-nowrap">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {section.rows.slice(0, 30).map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="p-2 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
              {section.rows.length === 0 && (
                <tr>
                  <td colSpan={section.columns.length} className="p-4 text-center text-ink-soft dark:text-ink-soft-dark italic">
                    Nenhum registro no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {section.rows.length > 30 && (
            <div className="px-2 py-1.5 text-[10px] text-ink-soft dark:text-ink-soft-dark border-t border-line dark:border-line-dark">
              Exibindo 30 de {section.rows.length} registros na prévia. O arquivo exportado traz a lista completa.
            </div>
          )}
        </div>
      </div>
    );
  }

  const seriesKeys = section.columns.slice(1);
  const data = section.rows.map((row) => {
    const entry: Record<string, string | number> = { name: String(row[0]) };
    seriesKeys.forEach((key, index) => {
      entry[key] = Number(row[index + 1]) || 0;
    });
    return entry;
  });

  return (
    <div className="space-y-2">
      {showTitle && (
        <h4 className="text-[10px] font-semibold uppercase text-ink-soft dark:text-ink-soft-dark">{section.title}</h4>
      )}
      {data.length === 0 ? (
        <p className="text-[11px] text-ink-soft dark:text-ink-soft-dark italic p-4 text-center border border-line dark:border-line-dark rounded-lg">
          Nenhum registro no período.
        </p>
      ) : (
        <div className="idex-chart-card h-56 border p-3">
          <ResponsiveContainer width="100%" height="100%">
            {section.chartType === "pie" ? (
              <PieChart>
                <ChartDefs />
                <Pie
                  data={data}
                  dataKey={seriesKeys[0]}
                  nameKey="name"
                  outerRadius={80}
                  paddingAngle={2}
                  filter={CHART_SHADOW}
                  label
                >
                  {data.map((_, index) => (
                    <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            ) : (
              <BarChart data={data}>
                <ChartDefs />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-line dark:text-line-dark" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "#0B2C52", fillOpacity: 0.045 }} content={<ChartTooltip />} />
                {seriesKeys.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />}
                {seriesKeys.map((key, index) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={PALETTE[index % PALETTE.length]}
                    filter={CHART_SHADOW}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

interface ReportBuilderViewProps {
  modelType: ReportModelType;
  template?: ReportTemplate;
  onClose: () => void;
}

export default function ReportBuilderView({ modelType, template, onClose }: ReportBuilderViewProps) {
  const {
    activeCompany,
    masterData,
    bankAccounts,
    accountsPayable,
    accountsReceivable,
    users,
    hasPermission,
    generateBuiltReport,
    saveReportTemplate,
    sendReportToDocumentCenter,
  } = useBPOState();

  const monthLabel = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const [name, setName] = useState(template?.name || `${modelType} — ${monthLabel}`);
  const [startDate, setStartDate] = useState(`${new Date().toISOString().slice(0, 7)}-01`);
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [dateBasis, setDateBasis] = useState<ReportDateBasis>(template?.filters.dateBasis || "due");
  const [compare, setCompare] = useState(Boolean(template?.filters.compareWithPreviousPeriod));
  const [supplier, setSupplier] = useState(template?.filters.supplier || "");
  const [customer, setCustomer] = useState(template?.filters.customer || "");
  const [category, setCategory] = useState(template?.filters.category || "");
  const [costCenter, setCostCenter] = useState(template?.filters.costCenter || "");
  const [bankAccountId, setBankAccountId] = useState(template?.filters.bankAccountId || "");
  const [status, setStatus] = useState(template?.filters.status || "");
  const [paymentMethod, setPaymentMethod] = useState(template?.filters.paymentMethod || "");
  const [cashFlowView, setCashFlowView] = useState<CashFlowReportView>(template?.filters.cashFlowView || "realized");
  const [cashFlowGrouping, setCashFlowGrouping] = useState<CashFlowReportGrouping>(template?.filters.cashFlowGrouping || "daily");

  const [blocks, setBlocks] = useState<ReportBlockConfig[]>(template?.blocks || []);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(blocks[0]?.instanceId || null);
  const [dragId, setDragId] = useState<string | null>(null);

  const [dreCompare, setDreCompare] = useState(Boolean(template?.dreOptions?.compareWithPreviousPeriod));
  const [drePercent, setDrePercent] = useState(Boolean(template?.dreOptions?.showPercent));
  const [dreDetailed, setDreDetailed] = useState(template?.dreOptions?.detailed ?? true);
  const [dreCostCenter, setDreCostCenter] = useState(template?.dreOptions?.costCenter || "");
  const [dreComment, setDreComment] = useState(template?.dreOptions?.comment || "");

  const [format, setFormat] = useState<ReportExportFormat>("PDF");
  const [savedTemplateId, setSavedTemplateId] = useState(template?.id);
  const [generatedReport, setGeneratedReport] = useState<ReportRecord | null>(null);
  const [recipientId, setRecipientId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!activeCompany) return null;

  const masterOptions = (type: MasterDataType) =>
    masterData
      .filter((item) => item.companyId === activeCompany.id && item.type === type && item.active)
      .map((item) => item.name);
  const accounts = bankAccounts.filter((account) => account.companyId === activeCompany.id);
  const recipients = users.filter(
    (user) =>
      user.status === "ACTIVE" &&
      ["CLIENT", "ACCOUNTANT"].includes(user.role) &&
      user.companies?.includes(activeCompany.id),
  );

  const filters: ReportFilters = {
    startDate,
    endDate,
    dateBasis,
    compareWithPreviousPeriod: compare,
    supplier: supplier || undefined,
    customer: customer || undefined,
    category: category || undefined,
    costCenter: costCenter || undefined,
    bankAccountId: bankAccountId || undefined,
    status: status || undefined,
    paymentMethod: paymentMethod || undefined,
    cashFlowView,
    cashFlowGrouping,
  };
  const dreOptions: DreReportOptions = {
    compareWithPreviousPeriod: dreCompare,
    showPercent: drePercent,
    detailed: dreDetailed,
    costCenter: dreCostCenter || undefined,
    comment: dreComment || undefined,
  };

  const dataSource = {
    accountsPayable: accountsPayable.filter((item) => item.companyId === activeCompany.id),
    accountsReceivable: accountsReceivable.filter((item) => item.companyId === activeCompany.id),
    bankAccounts: accounts,
  };
  const previewSections: ReportSectionData[] =
    modelType === "DRE Gerencial"
      ? computeDreSections(filters, dreOptions, dataSource)
      : computeReportSections(modelType, blocks, filters, dataSource);

  const addedKeys = blocks.map((block) => block.blockKey);
  const availableBlocks = REPORT_BLOCKS[modelType].filter((block) => !addedKeys.includes(block.key));

  const addBlock = (blockKey: ReportBlockKey) => {
    const definition = getBlockDefinition(modelType, blockKey);
    if (!definition) return;
    const instanceId = `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const config: ReportBlockConfig = {
      instanceId,
      blockKey,
      visualization: definition.visualizations[0],
      limit: definition.supportsLimit ? 10 : undefined,
      showPercent: definition.supportsPercent ? false : undefined,
      compareWithPreviousPeriod: false,
      columns: definition.availableColumns ? definition.defaultColumns || definition.availableColumns : undefined,
    };
    setBlocks((prev) => [...prev, config]);
    setSelectedBlockId(instanceId);
  };

  const updateBlock = (instanceId: string, patch: Partial<ReportBlockConfig>) => {
    setBlocks((prev) => prev.map((block) => (block.instanceId === instanceId ? { ...block, ...patch } : block)));
  };

  const removeBlock = (instanceId: string) => {
    setBlocks((prev) => prev.filter((block) => block.instanceId !== instanceId));
    if (selectedBlockId === instanceId) setSelectedBlockId(null);
  };

  const moveBlock = (instanceId: string, direction: "up" | "down") => {
    setBlocks((prev) => {
      const index = prev.findIndex((block) => block.instanceId === instanceId);
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const reorderBlocks = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    setBlocks((prev) => {
      const draggedIndex = prev.findIndex((block) => block.instanceId === draggedId);
      const targetIndex = prev.findIndex((block) => block.instanceId === targetId);
      if (draggedIndex < 0 || targetIndex < 0) return prev;
      const next = [...prev];
      const [dragged] = next.splice(draggedIndex, 1);
      next.splice(targetIndex, 0, dragged);
      return next;
    });
  };

  const selectedBlock = blocks.find((block) => block.instanceId === selectedBlockId) || null;
  const selectedDefinition = selectedBlock ? getBlockDefinition(modelType, selectedBlock.blockKey) : undefined;

  const handleGenerate = () => {
    setError("");
    setMessage("");
    setGeneratedReport(null);
    if (!hasPermission("reports.generate")) {
      setError("Seu perfil não possui autorização para gerar relatórios.");
      return;
    }
    if (!startDate || !endDate || startDate > endDate) {
      setError("Informe um período válido para gerar o relatório.");
      return;
    }
    if (modelType !== "DRE Gerencial" && blocks.length === 0) {
      setError("Adicione ao menos um bloco à estrutura do relatório.");
      return;
    }
    const report = generateBuiltReport({
      modelType,
      name: name.trim() || modelType,
      blocks,
      filters,
      dreOptions: modelType === "DRE Gerencial" ? dreOptions : undefined,
      format,
      templateId: savedTemplateId,
      templateName: savedTemplateId ? name.trim() : undefined,
    });
    if (!report) {
      setError("Não foi possível gerar o relatório.");
      return;
    }
    setGeneratedReport(report);
    setMessage(`${report.fileName} foi gerado e já está disponível no histórico.`);
  };

  const handleSaveTemplate = () => {
    setError("");
    setMessage("");
    if (!hasPermission("reports.generate")) {
      setError("Seu perfil não possui autorização para salvar modelos.");
      return;
    }
    if (!name.trim()) {
      setError("Informe um nome para o modelo.");
      return;
    }
    const { startDate: _s, endDate: _e, ...templateFilters } = filters;
    void _s;
    void _e;
    const saved = saveReportTemplate({
      id: savedTemplateId,
      name: name.trim(),
      modelType,
      blocks,
      filters: templateFilters,
      dreOptions: modelType === "DRE Gerencial" ? dreOptions : undefined,
    });
    if (!saved) {
      setError("Não foi possível salvar o modelo.");
      return;
    }
    setSavedTemplateId(saved.id);
    setMessage(`Modelo "${saved.name}" salvo em Meus modelos.`);
  };

  const handleSend = () => {
    if (!generatedReport || !recipientId) return;
    const recipient = recipients.find((user) => user.id === recipientId);
    if (!recipient) return;
    sendReportToDocumentCenter(generatedReport, recipient.id);
    setMessage(`Relatório enviado para ${recipient.name}.`);
  };

  const handleSaveToDocumentCenter = () => {
    if (!generatedReport) return;
    if (sendReportToDocumentCenter(generatedReport)) {
      setMessage("Relatório salvo na Central de Documentos.");
    } else {
      setError("Não foi possível salvar o relatório na Central de Documentos.");
    }
  };

  return (
    <div className="space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconButton
            icon={<ArrowLeft className="h-4 w-4" />}
            label="Voltar para a Central de Relatórios"
            variant="solid"
            onClick={onClose}
          />
          <div>
            <h2 className="text-lg font-bold text-ink dark:text-ink-dark tracking-tight">{modelType}</h2>
            <p className="text-ink-soft dark:text-ink-soft-dark text-[11px]">Monte o conteúdo, os filtros e a apresentação deste relatório.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" icon={<Save className="h-3.5 w-3.5" />} onClick={handleSaveTemplate}>
            Salvar como modelo
          </Button>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as ReportExportFormat)}
            className={`${INPUT_CLASS} w-auto`}
          >
            <option value="PDF">PDF</option>
            <option value="EXCEL">Excel</option>
          </select>
          <Button
            icon={<Play className="h-3.5 w-3.5 fill-white" />}
            onClick={handleGenerate}
            disabled={!hasPermission("reports.generate")}
          >
            Gerar relatório
          </Button>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/25 px-4 py-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          {message}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/25 px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Cabeçalho: nome, período e filtros */}
      <div className="bg-surface dark:bg-surface-dark rounded-lg border border-line dark:border-line-dark shadow-xs p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1 space-y-1">
            <label className={LABEL_CLASS}>Nome do relatório</label>
            <input className={INPUT_CLASS} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={LABEL_CLASS}>Período</label>
            <div className="flex items-center gap-2">
              <input type="date" className={INPUT_CLASS} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <span className="text-zinc-400 text-xs">a</span>
              <input type="date" className={INPUT_CLASS} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <label className={LABEL_CLASS}>Base da data</label>
            <select className={INPUT_CLASS} value={dateBasis} onChange={(e) => setDateBasis(e.target.value as ReportDateBasis)}>
              {(Object.keys(DATE_BASIS_LABEL) as ReportDateBasis[]).map((basis) => (
                <option key={basis} value={basis}>
                  {DATE_BASIS_LABEL[basis]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {modelType !== "DRE Gerencial" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {modelType === "Contas a Pagar" && (
                <FilterSelect label="Fornecedor" value={supplier} onChange={setSupplier} options={masterOptions("SUPPLIER")} />
              )}
              {modelType === "Contas a Receber" && (
                <FilterSelect label="Cliente" value={customer} onChange={setCustomer} options={masterOptions("CUSTOMER")} />
              )}
              <FilterSelect label="Categoria" value={category} onChange={setCategory} options={masterOptions("CATEGORY")} />
              <FilterSelect label="Centro de custo" value={costCenter} onChange={setCostCenter} options={masterOptions("COST_CENTER")} />
              <FilterSelect
                label="Conta bancária"
                value={bankAccountId}
                onChange={setBankAccountId}
                options={accounts.map((account) => account.id)}
              />
              {modelType !== "Fluxo de Caixa" && (
                <FilterSelect
                  label="Status"
                  value={status}
                  onChange={setStatus}
                  options={modelType === "Contas a Pagar" ? AP_STATUSES : AR_STATUSES}
                />
              )}
              <FilterSelect
                label={modelType === "Contas a Receber" ? "Forma de recebimento" : "Forma de pagamento"}
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={masterOptions("PAYMENT_METHOD")}
              />
              <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300 self-end pb-2">
                <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
                Comparar com período anterior
              </label>
            </div>
            {modelType === "Fluxo de Caixa" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={LABEL_CLASS}>Tipo de visão</label>
                  <div className="flex gap-3">
                    {([
                      ["realized", "Realizado"],
                      ["projected", "Previsto"],
                      ["both", "Realizado e previsto"],
                    ] as [CashFlowReportView, string][]).map(([value, labelText]) => (
                      <label key={value} className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                        <input type="radio" checked={cashFlowView === value} onChange={() => setCashFlowView(value)} /> {labelText}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className={LABEL_CLASS}>Agrupamento</label>
                  <div className="flex gap-3">
                    {([
                      ["daily", "Diário"],
                      ["weekly", "Semanal"],
                      ["monthly", "Mensal"],
                    ] as [CashFlowReportGrouping, string][]).map(([value, labelText]) => (
                      <label key={value} className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                        <input type="radio" checked={cashFlowGrouping === value} onChange={() => setCashFlowGrouping(value)} /> {labelText}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Corpo: construtor por blocos ou estrutura fixa da DRE */}
      {modelType === "DRE Gerencial" ? (
        <div className="bg-surface dark:bg-surface-dark rounded-lg border border-line dark:border-line-dark shadow-xs p-4">
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
            <div className="space-y-3">
              <SectionLabel>Estrutura</SectionLabel>
              <div className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed border border-line dark:border-line-dark rounded-lg p-3 space-y-1 font-mono bg-zinc-50 dark:bg-zinc-800/40">
                <div>Receita Bruta</div>
                <div>(-) Despesas por Categoria</div>
                <div className="font-semibold border-t border-line dark:border-line-dark pt-1 mt-1">(=) Resultado Líquido</div>
              </div>
              <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark leading-relaxed">
                Estrutura simplificada — sem plano de contas configurável nesta versão.
              </p>
              <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                <input type="checkbox" checked={dreCompare} onChange={(e) => setDreCompare(e.target.checked)} /> Comparar com período anterior
              </label>
              <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                <input type="checkbox" checked={drePercent} onChange={(e) => setDrePercent(e.target.checked)} /> Exibir percentuais
              </label>
              <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                <input type="checkbox" checked={dreDetailed} onChange={(e) => setDreDetailed(e.target.checked)} /> Detalhar despesas por categoria
              </label>
              <FilterSelect label="Centro de custo" value={dreCostCenter} onChange={setDreCostCenter} options={masterOptions("COST_CENTER")} />
              <div className="space-y-1">
                <label className={LABEL_CLASS}>Comentário</label>
                <textarea
                  className={INPUT_CLASS}
                  rows={3}
                  value={dreComment}
                  onChange={(e) => setDreComment(e.target.value)}
                  placeholder="Observação opcional para quem for ler o relatório..."
                />
              </div>
            </div>
            <div className="space-y-4">
              {previewSections.map((section, index) => (
                <SectionPreview key={index} section={section} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_280px] gap-4">
          <div className="bg-surface dark:bg-surface-dark rounded-lg border border-line dark:border-line-dark shadow-xs p-4 space-y-2 lg:max-h-[70vh] lg:overflow-y-auto">
            <SectionLabel>Blocos disponíveis</SectionLabel>
            <div className="space-y-1.5">
              {availableBlocks.map((block) => (
                <button
                  key={block.key}
                  onClick={() => addBlock(block.key)}
                  className="w-full text-left p-2.5 rounded-lg border border-line dark:border-line-dark hover:border-brand-navy-900 dark:hover:border-brand-navy-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">{block.label}</span>
                    <Plus className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  </div>
                  <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark mt-0.5 leading-relaxed">{block.description}</p>
                </button>
              ))}
              {availableBlocks.length === 0 && (
                <p className="text-[11px] text-ink-soft dark:text-ink-soft-dark italic p-2">Todos os blocos já foram adicionados.</p>
              )}
            </div>
          </div>

          <div className="bg-surface dark:bg-surface-dark rounded-lg border border-line dark:border-line-dark shadow-xs p-4 space-y-3 lg:max-h-[70vh] lg:overflow-y-auto">
            <SectionLabel>Estrutura do relatório</SectionLabel>
            {blocks.length === 0 && (
              <p className="text-[11px] text-ink-soft dark:text-ink-soft-dark italic border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-6 text-center">
                Adicione blocos à esquerda para montar o relatório.
              </p>
            )}
            {blocks.map((block, index) => {
              const definition = getBlockDefinition(modelType, block.blockKey);
              const section = previewSections[index];
              return (
                <div
                  key={block.instanceId}
                  draggable
                  onDragStart={() => setDragId(block.instanceId)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragId) reorderBlocks(dragId, block.instanceId);
                    setDragId(null);
                  }}
                  onClick={() => setSelectedBlockId(block.instanceId)}
                  className={`rounded-lg border p-3 space-y-2 cursor-pointer transition-colors ${
                    selectedBlockId === block.instanceId
                      ? "border-brand-navy-900 dark:border-brand-navy-700 bg-brand-navy-900/5 dark:bg-brand-navy-700/10"
                      : "border-line dark:border-line-dark hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <GripVertical className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-600 cursor-grab shrink-0" />
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                        {index + 1}. {block.title || definition?.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveBlock(block.instanceId, "up");
                        }}
                        disabled={index === 0}
                        className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                        title="Mover para cima"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveBlock(block.instanceId, "down");
                        }}
                        disabled={index === blocks.length - 1}
                        className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                        title="Mover para baixo"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBlock(block.instanceId);
                        }}
                        className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 cursor-pointer"
                        title="Remover bloco"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {section && <SectionPreview section={section} showTitle={false} />}
                </div>
              );
            })}
          </div>

          <div className="bg-surface dark:bg-surface-dark rounded-lg border border-line dark:border-line-dark shadow-xs p-4 space-y-3 lg:max-h-[70vh] lg:overflow-y-auto">
            <SectionLabel>Configurações do bloco</SectionLabel>
            {!selectedBlock || !selectedDefinition ? (
              <p className="text-[11px] text-ink-soft dark:text-ink-soft-dark italic">Selecione um bloco na estrutura para configurá-lo.</p>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className={LABEL_CLASS}>Título do bloco</label>
                  <input
                    className={INPUT_CLASS}
                    value={selectedBlock.title ?? selectedDefinition.label}
                    onChange={(e) => updateBlock(selectedBlock.instanceId, { title: e.target.value })}
                  />
                </div>
                {selectedDefinition.visualizations.length > 1 && (
                  <div className="space-y-1">
                    <label className={LABEL_CLASS}>Visualização</label>
                    <div className="space-y-1">
                      {selectedDefinition.visualizations.map((visualization) => (
                        <label key={visualization} className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                          <input
                            type="radio"
                            checked={(selectedBlock.visualization || selectedDefinition.visualizations[0]) === visualization}
                            onChange={() => updateBlock(selectedBlock.instanceId, { visualization })}
                          />
                          {visualization === "bar" ? "Gráfico de barras" : visualization === "pie" ? "Gráfico de pizza" : "Tabela"}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {selectedDefinition.supportsLimit && (
                  <div className="space-y-1">
                    <label className={LABEL_CLASS}>Quantidade</label>
                    <input
                      type="number"
                      min={1}
                      className={INPUT_CLASS}
                      value={selectedBlock.limit ?? 10}
                      onChange={(e) => updateBlock(selectedBlock.instanceId, { limit: Number(e.target.value) || undefined })}
                    />
                  </div>
                )}
                {selectedDefinition.supportsPercent && (
                  <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedBlock.showPercent)}
                      onChange={(e) => updateBlock(selectedBlock.instanceId, { showPercent: e.target.checked })}
                    />
                    Exibir percentual
                  </label>
                )}
                {selectedDefinition.supportsCompare && (
                  <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedBlock.compareWithPreviousPeriod)}
                      onChange={(e) => updateBlock(selectedBlock.instanceId, { compareWithPreviousPeriod: e.target.checked })}
                    />
                    Comparar com período anterior
                  </label>
                )}
                {selectedDefinition.availableColumns && (
                  <div className="space-y-1">
                    <label className={LABEL_CLASS}>Colunas selecionadas</label>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {selectedDefinition.availableColumns.map((column) => {
                        const current =
                          selectedBlock.columns || selectedDefinition.defaultColumns || selectedDefinition.availableColumns || [];
                        const checked = current.includes(column);
                        return (
                          <label key={column} className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked ? [...current, column] : current.filter((c) => c !== column);
                                const ordered = (selectedDefinition.availableColumns || []).filter((c) => next.includes(c));
                                updateBlock(selectedBlock.instanceId, { columns: ordered });
                              }}
                            />
                            {column}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Destino do relatório */}
      {generatedReport && (
        <Card className="space-y-3">
          <h3 className="text-xs font-bold uppercase text-ink-soft dark:text-ink-soft-dark">O que deseja fazer com "{generatedReport.fileName}"?</h3>
          <div className="flex flex-wrap gap-2">
            {generatedReport.format === "PDF" && (
              <Button
                variant="outline"
                icon={<Eye className="h-3.5 w-3.5" />}
                onClick={() =>
                  window.open(`data:${generatedReport.mimeType};base64,${generatedReport.fileContent}`, "_blank")
                }
              >
                Visualizar
              </Button>
            )}
            <Button variant="outline" icon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadReportFile(generatedReport)}>
              Baixar {generatedReport.format === "EXCEL" ? "Excel" : "PDF"}
            </Button>
            <Button variant="outline" icon={<FolderOutput className="h-3.5 w-3.5" />} onClick={handleSaveToDocumentCenter}>
              Salvar na Central de Documentos
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className={LABEL_CLASS}>Enviar para cliente ou contador</label>
              <select className={`${INPUT_CLASS} w-64`} value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
                <option value="">Selecione um destinatário...</option>
                {recipients.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {user.role === "CLIENT" ? "Cliente" : "Contador"}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="secondary" icon={<Send className="h-3.5 w-3.5" />} onClick={handleSend} disabled={!recipientId}>
              Enviar
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
