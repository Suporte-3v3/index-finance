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
import { parseOfxFile, OfxImportError, type ParsedStatementRow } from "../services/ofxImport";
import {
  parseStatementExcelFile,
  downloadStatementImportTemplate,
  ReconciliationImportError,
} from "../services/reconciliationImport";
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
  Search,
} from "lucide-react";

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

  // Statement file import (OFX/Excel)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [importParseError, setImportParseError] = useState("");
  const [parsedStatementRows, setParsedStatementRows] = useState<ParsedStatementRow[]>([]);
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
    setAccountNumberHint(undefined);
    setIsImportModalOpen(true);
  };

  const closeImportModal = () => {
    setIsImportModalOpen(false);
    setImportParseError("");
    setParsedStatementRows([]);
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
        setAccountNumberHint(hint);
      } else if (extension === "xlsx" || extension === "xls") {
        const rows = await parseStatementExcelFile(file);
        setParsedStatementRows(rows);
      } else {
        throw new Error("Formato de arquivo não suportado. Envie um arquivo .ofx, .qfx, .xlsx ou .xls.");
      }
    } catch (error) {
      setParsedStatementRows([]);
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
    if (!activeAccount || !parsedValidRows.length) return;
    const entries: BankStatementItem[] = parsedValidRows.map((row) => ({
      id: row.externalId,
      date: row.date,
      description: row.description,
      amount: row.amount,
      documentNumber: row.documentNumber,
      isReconciled: false,
      reconciliationStatus: "Pendente",
    }));
    importStatement(activeAccount.id, entries);
    closeImportModal();
  };

  const handleAutoReconcile = () => {
    if (!activeAccount) return;
    autoReconcileBank(activeAccount.id);
  };

  const handleManualReconcile = (recordId: string) => {
    if (!activeAccount || !selectedStatementItem) return;

    const result = reconcileItemManually(
      activeAccount.id,
      selectedStatementItem.id,
      recordId,
      ledgerType,
      "Conciliado manualmente no painel BPO",
    );
    if (!result.success) {
      setReconciliationError(
        result.error || "Não foi possível realizar a conciliação.",
      );
      return;
    }
    setReconciliationError("");
    setSelectedStatementItem(null);
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
        size="lg"
        footer={
          <>
            <Button variant="text" onClick={closeImportModal}>
              Cancelar
            </Button>
            <Button
              icon={<Upload className="h-4 w-4" />}
              disabled={!parsedValidRows.length}
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
              <div className="max-h-[320px] overflow-y-auto border border-line dark:border-line-dark rounded-lg">
                <Table>
                  <TableHead>
                    <Tr>
                      <Th>Status</Th>
                      <Th>Data</Th>
                      <Th>Descrição</Th>
                      <Th align="right">Valor</Th>
                      <Th>Nº Doc.</Th>
                    </Tr>
                  </TableHead>
                  <TableBody>
                    {parsedStatementRows.map((row) => {
                      const hasErrors = row.errors.length > 0;
                      return (
                        <Tr key={`${row.row}-${row.externalId}`}>
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
                        </Tr>
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
                        {new Date(item.date).toLocaleDateString("pt-BR")}
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
                        {new Date(
                          selectedStatementItem.date,
                        ).toLocaleDateString("pt-BR")}
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
                              onClick={() =>
                                amountMatches && handleManualReconcile(ap.id)
                              }
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
                                  {new Date(ap.dueDate).toLocaleDateString(
                                    "pt-BR",
                                  )}
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
                              onClick={() =>
                                isCompatible && handleManualReconcile(ar.id)
                              }
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
                                  {new Date(ar.dueDate).toLocaleDateString(
                                    "pt-BR",
                                  )}
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
    </div>
  );
}
