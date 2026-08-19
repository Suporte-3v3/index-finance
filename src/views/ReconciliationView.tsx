/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import { BankStatementItem } from "../types";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Modal,
  Table,
  TableHead,
  TableBody,
  Tr,
  Th,
  Td,
  Tooltip,
} from "../components/ui";
import {
  parseOfxFile,
  OfxImportError,
  type ParsedStatementRow,
  type StatementFieldKey,
} from "../services/ofxImport";
import {
  parseStatementExcelFile,
  downloadStatementImportTemplate,
  ReconciliationImportError,
  toStatementImportPayload,
  validateStatementRow,
} from "../services/reconciliationImport";
import { formatDate } from "../services/dateFormatters";
import {
  Building2,
  Upload,
  Sparkles,
  HelpCircle,
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  ChevronDown,
  ChevronUp,
  Pencil,
  Search,
} from "lucide-react";

const IMPORT_INPUT_CLASS = "mt-1 w-full rounded-lg border bg-surface px-3 py-2 text-xs text-ink outline-none transition-colors dark:bg-surface-dark dark:text-ink-dark";

function importInputClass(hasError: boolean) {
  return `${IMPORT_INPUT_CLASS} ${
    hasError
      ? "border-brand-red-600 focus:ring-1 focus:ring-brand-red-600 dark:border-red-500"
      : "border-line focus:ring-1 focus:ring-brand-navy-700 dark:border-line-dark"
  }`;
}

function ImportEditableField({
  label,
  errors = [],
  children,
  className = "",
}: {
  label: string;
  errors?: string[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[10px] font-bold uppercase tracking-wide text-ink-soft dark:text-ink-soft-dark">
        {label}
      </span>
      {children}
      {errors.map((message) => (
        <span key={message} className="mt-1 flex items-start gap-1 text-[10px] font-semibold text-brand-red-600 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /> {message}
        </span>
      ))}
    </label>
  );
}

export default function ReconciliationView({
  onCreateLaunch,
}: {
  onCreateLaunch?: () => void;
}) {
  const {
    activeCompany,
    bankAccounts,
    accountsPayable,
    accountsReceivable,
    statementItems,
    importStatement,
    reconcileItemManually,
    autoReconcileBank,
    reverseStatementItem,
    ignoreStatementItem,
    hasPermission,
  } = useBPOState();

  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedStatementItem, setSelectedStatementItem] =
    useState<BankStatementItem | null>(null);

  // Ledger selection search filters for manual matching
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState("");
  const [ledgerType, setLedgerType] = useState<"A_PAGAR" | "A_RECEBER">(
    "A_PAGAR",
  );
  const [reconciliationError, setReconciliationError] = useState("");
  const [isReconciling, setIsReconciling] = useState(false);
  const [itemToReverse, setItemToReverse] = useState<BankStatementItem | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [isReversing, setIsReversing] = useState(false);

  // Statement file import (OFX/Excel)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [importParseError, setImportParseError] = useState("");
  const [parsedStatementRows, setParsedStatementRows] = useState<ParsedStatementRow[]>([]);
  const [editingImportRows, setEditingImportRows] = useState<Set<number>>(new Set());
  const [accountNumberHint, setAccountNumberHint] = useState<string | undefined>(undefined);

  if (!activeCompany) return null;

  const accounts = bankAccounts.filter(
    (ba) => ba.companyId === activeCompany.id,
  );

  // Default to first account if none selected
  const activeAccount =
    accounts.find((ba) => ba.id === selectedAccountId) || accounts[0];
  if (accounts.length > 0 && !selectedAccountId) {
    setSelectedAccountId(accounts[0].id);
  }

  const statementList = activeAccount
    ? statementItems[activeAccount.id] || []
    : [];

  const unReconciledStatementItems = statementList.filter(
    (item) => !item.isReconciled,
  );
  const reconciledStatementItems = statementList.filter(
    (item) => item.reconciliationStatus === "Conciliada" || item.reconciliationStatus === "Parcialmente conciliada",
  );

  // Filter financial options for manual match in accordance with the transaction amount direction
  const payablesOptions = accountsPayable.filter(
    (ap) =>
      ap.companyId === activeCompany.id &&
      ap.bankAccountId === activeAccount?.id &&
      ["Pendente", "A vencer", "Aprovada", "Agendada", "Vencida"].includes(
        ap.status,
      ) &&
      ap.description.toLowerCase().includes(ledgerSearchTerm.toLowerCase()),
  );

  const receivablesOptions = accountsReceivable.filter(
    (ar) =>
      ar.companyId === activeCompany.id &&
      ar.bankAccountId === activeAccount?.id &&
      !["Recebido", "Cancelado"].includes(ar.status) &&
      ar.description.toLowerCase().includes(ledgerSearchTerm.toLowerCase()),
  );

  const parsedValidRows = parsedStatementRows.filter((row) => row.errors.length === 0);
  const parsedInvalidRows = parsedStatementRows.filter((row) => row.errors.length > 0);
  const accountDigits = activeAccount?.accountNumber.replace(/\D/g, "") || "";
  const hintDigits = accountNumberHint?.replace(/\D/g, "") || "";
  const accountNumberMismatch =
    Boolean(accountDigits) &&
    Boolean(hintDigits) &&
    !accountDigits.endsWith(hintDigits) &&
    !hintDigits.endsWith(accountDigits);

  const openImportModal = () => {
    setImportParseError("");
    setParsedStatementRows([]);
    setEditingImportRows(new Set());
    setAccountNumberHint(undefined);
    setIsImportModalOpen(true);
  };

  const closeImportModal = () => {
    setIsImportModalOpen(false);
    setImportParseError("");
    setParsedStatementRows([]);
    setEditingImportRows(new Set());
    setAccountNumberHint(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownloadTemplate = () => {
    if (!activeAccount) return;
    void downloadStatementImportTemplate(`${activeAccount.bankName}-${activeAccount.accountNumber}`);
  };

  const handleFileSelected = async (file: File) => {
    setImportParseError("");
    setParsedStatementRows([]);
    setAccountNumberHint(undefined);
    setIsParsingFile(true);
    try {
      const extension = file.name.toLowerCase().split(".").pop();
      if (extension === "ofx" || extension === "qfx") {
        const { rows, accountNumberHint: hint } = await parseOfxFile(file);
        setParsedStatementRows(rows);
        setEditingImportRows(new Set(rows.filter((row) => row.errors.length > 0).map((row) => row.row)));
        setAccountNumberHint(hint);
      } else if (extension === "xlsx" || extension === "xls") {
        const rows = await parseStatementExcelFile(file);
        setParsedStatementRows(rows);
        setEditingImportRows(new Set(rows.filter((row) => row.errors.length > 0).map((row) => row.row)));
      } else {
        throw new Error("Formato de arquivo não suportado. Envie um arquivo .ofx, .qfx, .xlsx ou .xls.");
      }
    } catch (error) {
      setParsedStatementRows([]);
      setEditingImportRows(new Set());
      setImportParseError(
        error instanceof OfxImportError || error instanceof ReconciliationImportError || error instanceof Error
          ? error.message
          : "Não foi possível ler o arquivo enviado.",
      );
    } finally {
      setIsParsingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmImport = () => {
    if (!activeAccount || !parsedValidRows.length || parsedInvalidRows.length > 0) return;
    const entries: BankStatementItem[] = parsedValidRows.map(toStatementImportPayload);
    importStatement(activeAccount.id, entries);
    closeImportModal();
  };

  const updateStatementRow = (
    rowNumber: number,
    update: (row: ParsedStatementRow) => ParsedStatementRow,
  ) => {
    setParsedStatementRows((current) => current.map((row) => (
      row.row === rowNumber ? validateStatementRow(update(row)) : row
    )));
  };

  const toggleImportRowEditor = (rowNumber: number) => {
    setEditingImportRows((current) => {
      const next = new Set(current);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  };

  const handleAutoReconcile = () => {
    if (!activeAccount) return;
    autoReconcileBank(activeAccount.id);
  };

  const handleManualReconcile = async (recordId: string) => {
    if (!activeAccount || !selectedStatementItem) return;

    setIsReconciling(true);
    const result = await reconcileItemManually(
        activeAccount.id,
        selectedStatementItem.id,
        recordId,
        ledgerType,
        "Conciliado manualmente no painel BPO",
      );
    setIsReconciling(false);
    if (!result.success) {
      setReconciliationError(
        result.error || "Não foi possível realizar a conciliação.",
      );
      return;
    }
    setReconciliationError("");
    setSelectedStatementItem(null);
  };

  const handleReverseReconciliation = async () => {
    if (!activeAccount || !itemToReverse || !reversalReason.trim()) return;
    setIsReversing(true);
    const result = await reverseStatementItem(activeAccount.id, itemToReverse.id, reversalReason.trim());
    setIsReversing(false);
    if (!result.success) {
      setReconciliationError(result.error || "NÃ£o foi possÃ­vel estornar a conciliaÃ§Ã£o.");
      return;
    }
    setItemToReverse(null);
    setReversalReason("");
    setReconciliationError("");
  };

  const handleIgnore = (itemId: string) => {
    if (!activeAccount) return;
    const reason = prompt("Insira o motivo para ignorar este item do extrato:");
    if (reason) {
      ignoreStatementItem(activeAccount.id, itemId, reason);
    }
  };

  const openManualMatch = (item: BankStatementItem) => {
    setSelectedStatementItem(item);
    setLedgerType(item.amount < 0 ? "A_PAGAR" : "A_RECEBER");
    setLedgerSearchTerm("");
    setReconciliationError("");
  };

  return (
    <div id="reconciliation-root" className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            id="recon-title"
            className="text-2xl sm:text-3xl font-bold text-ink dark:text-ink-dark tracking-tight"
          >
            Conciliação Bancária
          </h1>
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark leading-relaxed">
            Confronte o extrato importado do banco (OFX) com os faturamentos e
            contas a pagar do sistema.
          </p>
        </div>
        <Button variant="secondary" onClick={onCreateLaunch}>
          Criar lançamento
        </Button>
      </div>

      {/* Account Selector and Import/Auto Action */}
      <Card className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-96">
          <Building2 className="h-5 w-5 text-ink-soft dark:text-ink-soft-dark shrink-0" />
          <select
            className="w-full p-2 bg-canvas dark:bg-white/5 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30 font-semibold cursor-pointer text-xs dark:[color-scheme:dark]"
            value={selectedAccountId}
            onChange={(e) => {
              setSelectedAccountId(e.target.value);
              setSelectedStatementItem(null);
              setReconciliationError("");
            }}
          >
            {accounts.map((ba) => (
              <option key={ba.id} value={ba.id}>
                {ba.bankName} - Ag. {ba.agency} - C/C: {ba.accountNumber}
              </option>
            ))}
          </select>
        </div>

        {activeAccount && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-soft dark:text-ink-soft-dark font-mono font-medium bg-canvas dark:bg-white/5 px-3 py-1.5 border border-line dark:border-line-dark rounded-lg">
              Saldo no Sistema:{" "}
              <strong className="text-ink dark:text-ink-dark">
                R${" "}
                {activeAccount.balance.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </strong>
            </span>

            {hasPermission("reconciliation.execute") && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Upload className="h-4 w-4" />}
                  onClick={openImportModal}
                >
                  Importar Extrato (OFX/Excel)
                </Button>

                <Button
                  size="sm"
                  icon={<Sparkles className="h-4 w-4" />}
                  onClick={handleAutoReconcile}
                >
                  Auto-Conciliar Inteligente
                </Button>
              </>
            )}
          </div>
        )}
      </Card>

      {/* Import Statement Modal (OFX/Excel) */}
      <Modal
        open={isImportModalOpen}
        onClose={closeImportModal}
        title="Importar Extrato"
        description={
          activeAccount
            ? `Envie o extrato de ${activeAccount.bankName} - Ag. ${activeAccount.agency} - C/C: ${activeAccount.accountNumber} em .ofx/.qfx ou .xlsx/.xls.`
            : undefined
        }
        size="xl"
        footer={
          <>
            <Button variant="text" onClick={closeImportModal}>
              Cancelar
            </Button>
            <Button
              icon={<Upload className="h-4 w-4" />}
              disabled={!parsedValidRows.length || parsedInvalidRows.length > 0}
              title={parsedInvalidRows.length > 0 ? "Corrija todas as linhas com erro antes de importar." : undefined}
              onClick={handleConfirmImport}
            >
              Importar {parsedValidRows.length} transação(ões)
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".ofx,.qfx,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFileSelected(file);
              }}
            />
            <Button
              variant="outline"
              icon={<Upload className="h-4 w-4" />}
              loading={isParsingFile}
              onClick={() => fileInputRef.current?.click()}
            >
              Selecionar arquivo
            </Button>
            <Button
              variant="text"
              icon={<Download className="h-4 w-4" />}
              onClick={handleDownloadTemplate}
            >
              Baixar planilha modelo
            </Button>
          </div>

          {importParseError && (
            <p className="text-brand-red-600 dark:text-red-400 font-semibold flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {importParseError}
            </p>
          )}

          {accountNumberMismatch && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-brand-gold-300/10 p-3 font-semibold text-amber-700 dark:text-brand-gold-300"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Este arquivo parece ser de outra conta bancária — confira antes de importar.
            </div>
          )}

          {parsedStatementRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-ink-soft dark:text-ink-soft-dark">
                  Edite os campos destacados. Datas devem usar DD-MM-AAAA e cada linha é revalidada automaticamente.
                </p>
                <div className="flex items-center gap-2">
                  <Badge tone="green" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                    {parsedValidRows.length} válida(s)
                  </Badge>
                  {parsedInvalidRows.length > 0 && (
                    <Badge tone="red" icon={<XCircle className="h-3.5 w-3.5" />}>
                      {parsedInvalidRows.length} com erro
                    </Badge>
                  )}
                </div>
              </div>
              <div className="max-h-[460px] overflow-y-auto border border-line dark:border-line-dark rounded-lg">
                <Table>
                  <TableHead>
                    <Tr>
                      <Th>Status</Th>
                      <Th>Data</Th>
                      <Th>Descrição</Th>
                      <Th align="right">Valor</Th>
                      <Th>Nº Doc.</Th>
                      <Th align="right">Ação</Th>
                    </Tr>
                  </TableHead>
                  <TableBody>
                    {parsedStatementRows.map((row) => {
                      const hasErrors = row.errors.length > 0;
                      const isEditing = editingImportRows.has(row.row);
                      const errorsFor = (field: StatementFieldKey) => row.fieldErrors[field] ?? [];
                      return (
                        <React.Fragment key={row.row}>
                          <Tr className={hasErrors ? "bg-brand-red-50/50 dark:bg-brand-red-600/5" : undefined}>
                            <Td>
                              <Tooltip
                                content={
                                  hasErrors ? (
                                    <ul className="space-y-0.5">
                                      {row.errors.map((message, index) => (
                                        <li key={index}>{message}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    "Linha pronta para importação."
                                  )
                                }
                              >
                                <span className="inline-flex items-center gap-1.5 cursor-help">
                                  {hasErrors ? (
                                    <XCircle className="h-4 w-4 text-brand-red-600" />
                                  ) : (
                                    <CheckCircle2 className="h-4 w-4 text-brand-green-600" />
                                  )}
                                  <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark">Linha {row.row}</span>
                                </span>
                              </Tooltip>
                            </Td>
                            <Td>{row.date || "-"}</Td>
                            <Td className="max-w-64 truncate">{row.description || "-"}</Td>
                            <Td align="right">
                              {Number.isFinite(row.amount)
                                ? row.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
                                : "-"}
                            </Td>
                            <Td>{row.documentNumber || "-"}</Td>
                            <Td align="right">
                              <Button
                                size="sm"
                                variant={hasErrors ? "secondary" : "outline"}
                                icon={isEditing ? <ChevronUp className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                                iconRight={!isEditing ? <ChevronDown className="h-3.5 w-3.5" /> : undefined}
                                onClick={() => toggleImportRowEditor(row.row)}
                              >
                                {isEditing ? "Ocultar" : "Editar"}
                              </Button>
                            </Td>
                          </Tr>
                          {isEditing && (
                            <Tr className="bg-canvas/70 hover:bg-canvas/70 dark:bg-white/[0.025] dark:hover:bg-white/[0.025]">
                              <Td colSpan={6} className="p-4 align-top">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <div>
                                    <p className="font-bold text-ink dark:text-ink-dark">Editar linha {row.row}</p>
                                    <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark">
                                      Use valor negativo para saída e positivo para entrada.
                                    </p>
                                  </div>
                                  {hasErrors ? (
                                    <Badge tone="red" icon={<XCircle className="h-3.5 w-3.5" />}>
                                      {row.errors.length} erro(s)
                                    </Badge>
                                  ) : (
                                    <Badge tone="green" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                                      Linha válida
                                    </Badge>
                                  )}
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                  <ImportEditableField label="Data (DD-MM-AAAA)" errors={errorsFor("date")}>
                                    <input
                                      className={importInputClass(errorsFor("date").length > 0)}
                                      inputMode="numeric"
                                      placeholder="01-08-2026"
                                      value={row.date}
                                      onChange={(event) => updateStatementRow(row.row, (current) => ({
                                        ...current,
                                        date: event.target.value,
                                      }))}
                                    />
                                  </ImportEditableField>
                                  <ImportEditableField
                                    label="Descrição"
                                    errors={errorsFor("description")}
                                    className="sm:col-span-2"
                                  >
                                    <input
                                      className={importInputClass(errorsFor("description").length > 0)}
                                      value={row.description}
                                      onChange={(event) => updateStatementRow(row.row, (current) => ({
                                        ...current,
                                        description: event.target.value,
                                      }))}
                                    />
                                  </ImportEditableField>
                                  <ImportEditableField label="Valor" errors={errorsFor("amount")}>
                                    <input
                                      type="number"
                                      step="0.01"
                                      className={importInputClass(errorsFor("amount").length > 0)}
                                      value={Number.isFinite(row.amount) ? row.amount : ""}
                                      onChange={(event) => updateStatementRow(row.row, (current) => ({
                                        ...current,
                                        amount: event.target.value === "" ? Number.NaN : Number(event.target.value),
                                      }))}
                                    />
                                  </ImportEditableField>
                                  <ImportEditableField label="Nº do documento" errors={errorsFor("documentNumber")}>
                                    <input
                                      className={importInputClass(errorsFor("documentNumber").length > 0)}
                                      value={row.documentNumber ?? ""}
                                      onChange={(event) => updateStatementRow(row.row, (current) => ({
                                        ...current,
                                        documentNumber: event.target.value || undefined,
                                      }))}
                                    />
                                  </ImportEditableField>
                                  <ImportEditableField
                                    label="Identificador"
                                    errors={errorsFor("externalId")}
                                    className="sm:col-span-2 lg:col-span-3"
                                  >
                                    <input
                                      className={importInputClass(errorsFor("externalId").length > 0)}
                                      value={row.externalId}
                                      onChange={(event) => updateStatementRow(row.row, (current) => ({
                                        ...current,
                                        externalId: event.target.value,
                                      }))}
                                    />
                                  </ImportEditableField>
                                </div>
                              </Td>
                            </Tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Side-by-side reconciliation zone */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left column: Statement items list */}
        <Card padding={false} className="overflow-hidden flex flex-col">
          <div className="p-4 border-b border-line dark:border-line-dark bg-canvas/60 dark:bg-white/[0.02] flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-ink dark:text-ink-dark uppercase tracking-wide">
                Lançamentos do Extrato Bancário
              </h3>
              <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark">
                Clique em qualquer item pendente para realizar o de-para manual
                com o contas a pagar/receber.
              </p>
            </div>
            <Badge tone="neutral">
              {unReconciledStatementItems.length} Pendentes
            </Badge>
          </div>

          <div className="divide-y divide-line dark:divide-line-dark overflow-y-auto max-h-[500px]">
            {unReconciledStatementItems.map((item) => {
              const isSelected = selectedStatementItem?.id === item.id;
              const isExpense = item.amount < 0;

              return (
                <div
                  key={item.id}
                  onClick={() => openManualMatch(item)}
                  className={`p-4 hover:bg-canvas/60 dark:hover:bg-white/[0.03] cursor-pointer transition-all flex items-center justify-between border-l-4 ${
                    isSelected
                      ? "border-brand-navy-900 dark:border-brand-navy-700 bg-canvas/70 dark:bg-white/[0.04]"
                      : isExpense
                        ? "border-red-300 dark:border-red-500/50"
                        : "border-emerald-300 dark:border-emerald-500/50"
                  }`}
                >
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark font-mono font-semibold">
                        {formatDate(item.date)}
                      </span>
                      <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark font-mono">
                        Nº: {item.documentNumber || "N/A"}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-ink dark:text-ink-dark uppercase leading-snug">
                      {item.description}
                    </p>
                  </div>

                  <div
                    className="text-right shrink-0 space-y-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span
                      className={`text-sm font-bold font-mono block ${isExpense ? "text-brand-red-600 dark:text-red-400" : "text-brand-green-600 dark:text-emerald-400"}`}
                    >
                      {isExpense ? "-" : "+"} R${" "}
                      {Math.abs(item.amount).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openManualMatch(item)}
                        className="text-[9px] bg-zinc-100 dark:bg-white/10 hover:bg-brand-navy-900 dark:hover:bg-brand-navy-700 hover:text-white text-ink dark:text-ink-dark px-1.5 py-0.5 border border-line dark:border-line-dark font-semibold rounded cursor-pointer transition-colors"
                      >
                        Vincular
                      </button>
                      <button
                        onClick={() => handleIgnore(item.id)}
                        className="text-[9px] bg-canvas dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 text-ink-soft dark:text-ink-soft-dark px-1.5 py-0.5 font-semibold rounded cursor-pointer"
                        title="Ignorar lançamentos (ex: tarifas)"
                      >
                        Ignorar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {statementList.length === 0 && (
              <EmptyState
                icon={<AlertCircle />}
                title="Nenhum extrato importado para este banco."
                action={
                  <Button variant="outline" size="sm" onClick={openImportModal}>
                    Importar Extrato
                  </Button>
                }
              />
            )}

            {statementList.length > 0 &&
              unReconciledStatementItems.length === 0 && (
                <EmptyState
                  icon={<CheckCircle className="text-brand-green-600 dark:text-emerald-400" />}
                  title="Todos os itens deste extrato foram conciliados com sucesso!"
                  description="O saldo em conta foi atualizado na contabilidade de BPO."
                />
              )}
          </div>
        </Card>

        {/* Right column: Interactive matchmaking details */}
        <Card padding={false} className="flex flex-col">
          <div className="p-4 border-b border-line dark:border-line-dark bg-canvas/60 dark:bg-white/[0.02] flex items-center justify-between">
            <h3 className="text-xs font-bold text-ink dark:text-ink-dark uppercase tracking-wide">
              De-Para e Associação Manual
            </h3>
            {selectedStatementItem && (
              <Badge tone="gold">Item Selecionado Ativo</Badge>
            )}
          </div>

          <div className="p-5 grow space-y-5 flex flex-col justify-between">
            {!selectedStatementItem ? (
              <div className="my-auto py-12 text-center space-y-3 text-ink-soft dark:text-ink-soft-dark text-xs italic">
                <HelpCircle className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mx-auto animate-bounce duration-1000" />
                <p className="font-medium">
                  Selecione um lançamento do extrato bancário na coluna da
                  esquerda para realizar o cruzamento manual de contas.
                </p>
              </div>
            ) : (
              <div className="space-y-4 grow flex flex-col justify-between h-full motion-safe:animate-[fadeIn_150ms_ease-out]">
                {/* Active Statement Item info */}
                <div className="p-4 bg-canvas dark:bg-white/5 rounded-lg border border-line dark:border-line-dark space-y-2">
                  <span className="text-[9px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider block">
                    Transação Bancária Selecionada
                  </span>
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <h4 className="font-bold text-ink dark:text-ink-dark uppercase">
                        {selectedStatementItem.description}
                      </h4>
                      <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark font-mono">
                        Vencimento Extrato:{" "}
                        {formatDate(selectedStatementItem.date)}
                      </span>
                    </div>
                    <span
                      className={`text-base font-bold font-mono ${selectedStatementItem.amount < 0 ? "text-brand-red-600 dark:text-red-400" : "text-brand-green-600 dark:text-emerald-400"}`}
                    >
                      R${" "}
                      {Math.abs(selectedStatementItem.amount).toLocaleString(
                        "pt-BR",
                        { minimumFractionDigits: 2 },
                      )}
                    </span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-ink-soft dark:text-ink-soft-dark">
                    Saídas somente quitam contas a pagar com o mesmo valor e
                    banco. Entradas menores que o saldo são registradas como
                    recebimento parcial, sem quitar o restante.
                  </p>
                </div>

                {reconciliationError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-brand-red-600/25 bg-brand-red-50 dark:bg-brand-red-600/10 p-3 text-xs font-semibold text-brand-red-600 dark:text-red-300"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {reconciliationError}
                  </div>
                )}

                {/* Ledger selector & search */}
                <div className="space-y-3 grow flex flex-col">
                  <div className="flex items-center justify-between gap-4 border-b border-line dark:border-line-dark pb-2">
                    <span className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider">
                      Lançamentos em Aberto no Sistema
                    </span>
                    <div className="flex bg-canvas dark:bg-white/5 p-0.5 rounded-lg border border-line dark:border-line-dark text-[10px] font-semibold">
                      <button
                        disabled={selectedStatementItem.amount >= 0}
                        onClick={() => {
                          setLedgerType("A_PAGAR");
                          setReconciliationError("");
                        }}
                        className={`px-2 py-1 rounded disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer ${ledgerType === "A_PAGAR" ? "bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark shadow-sm" : "text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark"}`}
                      >
                        Contas a Pagar
                      </button>
                      <button
                        disabled={selectedStatementItem.amount <= 0}
                        onClick={() => {
                          setLedgerType("A_RECEBER");
                          setReconciliationError("");
                        }}
                        className={`px-2 py-1 rounded disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer ${ledgerType === "A_RECEBER" ? "bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark shadow-sm" : "text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark"}`}
                      >
                        Contas a Receber
                      </button>
                    </div>
                  </div>

                  {/* Ledger Search */}
                  <div className="relative">
                    <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-ink-soft dark:text-ink-soft-dark" />
                    <input
                      type="text"
                      placeholder={`Buscar lançamentos em aberto em ${ledgerType === "A_PAGAR" ? "Contas a Pagar" : "Contas a Receber"}...`}
                      className="w-full pl-8 pr-2 py-1.5 text-xs bg-canvas dark:bg-white/5 focus:bg-surface dark:focus:bg-surface-dark text-ink dark:text-ink-dark rounded-lg border border-line dark:border-line-dark focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30"
                      value={ledgerSearchTerm}
                      onChange={(e) => setLedgerSearchTerm(e.target.value)}
                    />
                  </div>

                  {/* Filtered Ledger list */}
                  <div className="overflow-y-auto max-h-[220px] divide-y divide-line dark:divide-line-dark border border-line dark:border-line-dark rounded-lg grow">
                    {ledgerType === "A_PAGAR"
                      ? payablesOptions.map((ap) => {
                          const amountMatches =
                            Math.abs(
                              ap.finalAmount -
                                Math.abs(selectedStatementItem.amount),
                            ) < 0.01;
                          return (
                            <div
                              key={ap.id}
                              onClick={() => {
                                if (amountMatches && !isReconciling) void handleManualReconcile(ap.id);
                              }}
                              className={`p-3 flex items-center justify-between text-xs transition-colors ${
                                amountMatches
                                  ? "hover:bg-canvas/60 dark:hover:bg-white/[0.03] cursor-pointer"
                                  : "cursor-not-allowed bg-canvas/60 dark:bg-white/[0.02] opacity-60"
                              }`}
                            >
                              <div className="space-y-0.5 pr-2">
                                <span className="font-semibold text-ink dark:text-ink-dark block truncate max-w-50">
                                  {ap.description}
                                </span>
                                <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark font-medium">
                                  Favorecido: {ap.supplier} | Venc:{" "}
                                  {formatDate(ap.dueDate)}
                                </span>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="font-semibold text-ink dark:text-ink-dark font-mono block">
                                  R${" "}
                                  {ap.finalAmount.toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                  })}
                                </span>
                                <Badge
                                  tone={amountMatches ? "green" : "red"}
                                  className="text-[8px] font-mono uppercase"
                                >
                                  {amountMatches
                                    ? "Quitação exata"
                                    : "Valor incompatível"}
                                </Badge>
                              </div>
                            </div>
                          );
                        })
                      : receivablesOptions.map((ar) => {
                          const remaining = Math.max(
                            0,
                            ar.amount +
                              ar.interest +
                              ar.penalty -
                              ar.discount -
                              ar.receivedAmount,
                          );
                          const statementAmount = Math.abs(
                            selectedStatementItem.amount,
                          );
                          const toCents = (value: number) =>
                            Math.round((value + Number.EPSILON) * 100);
                          const amountMatches =
                            toCents(statementAmount) === toCents(remaining);
                          const isPartial =
                            toCents(statementAmount) < toCents(remaining);
                          const isCompatible = amountMatches || isPartial;
                          return (
                            <div
                              key={ar.id}
                              onClick={() => {
                                if (isCompatible && !isReconciling) void handleManualReconcile(ar.id);
                              }}
                              className={`p-3 flex items-center justify-between text-xs transition-colors ${
                                isCompatible
                                  ? "hover:bg-canvas/60 dark:hover:bg-white/[0.03] cursor-pointer"
                                  : "cursor-not-allowed bg-canvas/60 dark:bg-white/[0.02] opacity-60"
                              }`}
                            >
                              <div className="space-y-0.5 pr-2">
                                <span className="font-semibold text-ink dark:text-ink-dark block truncate max-w-50">
                                  {ar.description}
                                </span>
                                <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark font-medium">
                                  Cliente: {ar.customer} | Venc:{" "}
                                  {formatDate(ar.dueDate)}
                                </span>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="font-semibold text-ink dark:text-ink-dark font-mono block">
                                  R${" "}
                                  {remaining.toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                  })}
                                </span>
                                <Badge
                                  tone={
                                    amountMatches
                                      ? "green"
                                      : isPartial
                                        ? "gold"
                                        : "red"
                                  }
                                  className="text-[8px] font-mono uppercase"
                                >
                                  {amountMatches
                                    ? "Quitação exata"
                                    : isPartial
                                      ? "Recebimento parcial"
                                      : "Valor incompatível"}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}

                    {ledgerType === "A_PAGAR" &&
                      payablesOptions.length === 0 && (
                        <p className="p-6 text-center text-ink-soft dark:text-ink-soft-dark italic text-xs">
                          Nenhuma conta a pagar encontrada em aberto.
                        </p>
                      )}

                    {ledgerType === "A_RECEBER" &&
                      receivablesOptions.length === 0 && (
                        <p className="p-6 text-center text-ink-soft dark:text-ink-soft-dark italic text-xs">
                          Nenhum faturamento a receber em aberto.
                        </p>
                      )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs text-ink-soft dark:text-ink-soft-dark pt-2 border-t border-line dark:border-line-dark">
                  <span>
                    Selecione a conta correta acima para vincular e confirmar a
                    conciliação.
                  </span>
                  <button
                    onClick={() => {
                      setSelectedStatementItem(null);
                      setReconciliationError("");
                    }}
                    className="text-ink-soft dark:text-ink-soft-dark font-semibold hover:underline cursor-pointer"
                  >
                    Fechar painel
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {reconciledStatementItems.length > 0 && (
        <Card padding={false} className="overflow-hidden">
          <CardHeader
            title="Conciliações realizadas"
            subtitle="Estorne uma conciliação somente quando houver erro confirmado. O lançamento retorna para a fila."
          />
          <div className="divide-y divide-line dark:divide-line-dark">
            {reconciledStatementItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-ink dark:text-ink-dark">{item.description}</p>
                  <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark">
                    {formatDate(item.date)} · {item.reconciliationStatus} · R$ {Math.abs(item.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {hasPermission("reconciliation.execute") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setItemToReverse(item);
                      setReversalReason("");
                      setReconciliationError("");
                    }}
                  >
                    Desfazer
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(itemToReverse)}
        onClose={() => !isReversing && setItemToReverse(null)}
        title="Desfazer conciliação"
        description="A baixa financeira e o saldo da conta serão revertidos; o item voltará a ficar pendente."
        footer={
          <>
            <Button variant="outline" disabled={isReversing} onClick={() => setItemToReverse(null)}>Cancelar</Button>
            <Button loading={isReversing} disabled={!reversalReason.trim()} onClick={() => void handleReverseReconciliation()}>
              Confirmar estorno
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          {itemToReverse && (
            <p className="rounded-lg border border-line bg-canvas p-3 text-ink dark:border-line-dark dark:bg-white/5 dark:text-ink-dark">
              {itemToReverse.description} · R$ {Math.abs(itemToReverse.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          )}
          <label className="block">
            <span className="mb-1 block font-semibold text-ink dark:text-ink-dark">Motivo do estorno</span>
            <textarea
              className="min-h-20 w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:ring-2 focus:ring-brand-navy-700/30 dark:border-line-dark dark:bg-surface-dark dark:text-ink-dark"
              value={reversalReason}
              onChange={(event) => setReversalReason(event.target.value)}
              placeholder="Descreva o motivo para manter a rastreabilidade."
            />
          </label>
          {reconciliationError && <p role="alert" className="text-brand-red-600 dark:text-red-400">{reconciliationError}</p>}
        </div>
      </Modal>
    </div>
  );
}
