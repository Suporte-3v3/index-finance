/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import { BankStatementItem, AccountPayable, AccountReceivable } from "../types";
import {
  Building2,
  Upload,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Check,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Search,
  FileCheck2,
  Trash,
  Ban,
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
    (item) => item.isReconciled,
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

  const handleImport = () => {
    if (!activeAccount) return;
    importStatement(activeAccount.id);
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
    <div id="reconciliation-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-sans">
        <div>
          <h2
            id="recon-title"
            className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight"
          >
            Conciliação Bancária
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">
            Confronte o extrato importado do banco (OFX) com os faturamentos e
            contas a pagar do sistema.
          </p>
        </div>
        <button
          onClick={onCreateLaunch}
          className="text-xs font-semibold text-white bg-[#0B2C52] px-3.5 py-2.5 rounded-sm cursor-pointer"
        >
          Criar lançamento
        </button>
      </div>

      {/* Account Selector and Import/Auto Action */}
      <div className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans text-xs">
        <div className="flex items-center gap-3 w-full md:w-96">
          <Building2 className="h-5 w-5 text-zinc-400 dark:text-zinc-500 shrink-0" />
          <select
            className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-semibold cursor-pointer text-xs"
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
            <span className="text-zinc-500 dark:text-zinc-400 font-mono font-medium bg-zinc-50 dark:bg-zinc-800/70 px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-sm">
              Saldo no Sistema:{" "}
              <strong className="text-zinc-900 dark:text-zinc-100">
                R${" "}
                {activeAccount.balance.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </strong>
            </span>

            {hasPermission("reconciliation.execute") && (
              <>
                <button
                  onClick={handleImport}
                  className="flex items-center gap-1.5 text-zinc-950 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 bg-white dark:bg-[#091320] border border-zinc-200 dark:border-zinc-700 px-3 py-2 rounded-sm font-semibold transition-colors cursor-pointer"
                >
                  <Upload className="h-4 w-4" /> Importar Extrato (OFX)
                </button>

                <button
                  onClick={handleAutoReconcile}
                  className="flex items-center gap-1.5 text-white bg-[#C8102E] hover:bg-[#8F071B] px-3.5 py-2.5 rounded-sm font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" /> Auto-Conciliar Inteligente
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Side-by-side reconciliation zone */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-sans">
        {/* Left column: Statement items list */}
        <div className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 uppercase tracking-wide">
                Lançamentos do Extrato Bancário
              </h3>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                Clique em qualquer item pendente para realizar o de-para manual
                com o contas a pagar/receber.
              </p>
            </div>
            <span className="text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full font-mono">
              {unReconciledStatementItems.length} Pendentes
            </span>
          </div>

          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 overflow-y-auto max-h-[500px]">
            {unReconciledStatementItems.map((item) => {
              const isSelected = selectedStatementItem?.id === item.id;
              const isExpense = item.amount < 0;

              return (
                <div
                  key={item.id}
                  onClick={() => openManualMatch(item)}
                  className={`p-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 cursor-pointer transition-all flex items-center justify-between border-l-4 ${
                    isSelected
                      ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50/70 dark:bg-zinc-800/60"
                      : isExpense
                        ? "border-rose-400 dark:border-rose-500/60"
                        : "border-emerald-400 dark:border-emerald-500/60"
                  }`}
                >
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono font-semibold">
                        {new Date(item.date).toLocaleDateString("pt-BR")}
                      </span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                        Nº: {item.documentNumber || "N/A"}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 uppercase leading-snug">
                      {item.description}
                    </p>
                  </div>

                  <div
                    className="text-right shrink-0 space-y-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span
                      className={`text-sm font-semibold font-mono block ${isExpense ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}
                    >
                      {isExpense ? "-" : "+"} R${" "}
                      {Math.abs(item.amount).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openManualMatch(item)}
                        className="text-[9px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-950 dark:hover:bg-zinc-100 hover:text-white dark:hover:text-zinc-900 text-zinc-800 dark:text-zinc-200 px-1.5 py-0.5 border border-zinc-200 dark:border-zinc-700 font-semibold rounded cursor-pointer"
                      >
                        Vincular
                      </button>
                      <button
                        onClick={() => handleIgnore(item.id)}
                        className="text-[9px] bg-zinc-50 dark:bg-zinc-800/70 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 font-semibold rounded cursor-pointer"
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
              <div className="p-12 text-center text-zinc-400 dark:text-zinc-500 text-xs italic space-y-3">
                <AlertCircle className="h-8 w-8 mx-auto text-zinc-300 dark:text-zinc-600" />
                <p>Nenhum extrato importado para este banco.</p>
                <button
                  onClick={handleImport}
                  className="text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-3 py-1.5 rounded font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer"
                >
                  Importar OFX do Mês
                </button>
              </div>
            )}

            {statementList.length > 0 &&
              unReconciledStatementItems.length === 0 && (
                <div className="p-12 text-center text-zinc-500 dark:text-zinc-400 text-xs italic space-y-1.5">
                  <CheckCircle className="h-8 w-8 text-emerald-500 dark:text-emerald-400 mx-auto" />
                  <p className="font-semibold">
                    Todos os itens deste extrato foram conciliados com sucesso!
                  </p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    O saldo em conta foi atualizado na contabilidade de BPO.
                  </p>
                </div>
              )}
          </div>
        </div>

        {/* Right column: Interactive matchmaking details */}
        <div className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 uppercase tracking-wide">
              De-Para e Associação Manual
            </h3>
            {selectedStatementItem && (
              <span className="text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/25 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded font-mono">
                Item Selecionado Ativo
              </span>
            )}
          </div>

          <div className="p-5 flex-grow space-y-5 flex flex-col justify-between">
            {!selectedStatementItem ? (
              <div className="my-auto py-12 text-center space-y-3 text-zinc-400 dark:text-zinc-500 text-xs italic">
                <HelpCircle className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mx-auto animate-bounce duration-1000" />
                <p className="font-medium font-sans">
                  Selecione um lançamento do extrato bancário na coluna da
                  esquerda para realizar o cruzamento manual de contas.
                </p>
              </div>
            ) : (
              <div className="space-y-4 flex-grow flex flex-col justify-between h-full animate-in fade-in duration-150">
                {/* Active Statement Item info */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-sm border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <span className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                    Transação Bancária Selecionada
                  </span>
                  <div className="flex items-center justify-between text-xs font-sans">
                    <div>
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-50 uppercase">
                        {selectedStatementItem.description}
                      </h4>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                        Vencimento Extrato:{" "}
                        {new Date(
                          selectedStatementItem.date,
                        ).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <span
                      className={`text-base font-semibold font-mono ${selectedStatementItem.amount < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}
                    >
                      R${" "}
                      {Math.abs(selectedStatementItem.amount).toLocaleString(
                        "pt-BR",
                        { minimumFractionDigits: 2 },
                      )}
                    </span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                    Saídas somente quitam contas a pagar com o mesmo valor e
                    banco. Entradas menores que o saldo são registradas como
                    recebimento parcial, sem quitar o restante.
                  </p>
                </div>

                {reconciliationError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-sm border border-red-200 dark:border-red-500/25 bg-red-50 dark:bg-red-500/10 p-3 text-xs font-semibold text-red-700 dark:text-red-300"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {reconciliationError}
                  </div>
                )}

                {/* Ledger selector & search */}
                <div className="space-y-3 flex-grow flex flex-col">
                  <div className="flex items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                    <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Lançamentos em Aberto no Sistema
                    </span>
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-sm border border-zinc-200 dark:border-zinc-700 text-[10px] font-semibold">
                      <button
                        disabled={selectedStatementItem.amount >= 0}
                        onClick={() => {
                          setLedgerType("A_PAGAR");
                          setReconciliationError("");
                        }}
                        className={`px-2 py-1 rounded disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer ${ledgerType === "A_PAGAR" ? "bg-white dark:bg-[#091320] text-zinc-800 dark:text-zinc-100 shadow-xs" : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"}`}
                      >
                        Contas a Pagar
                      </button>
                      <button
                        disabled={selectedStatementItem.amount <= 0}
                        onClick={() => {
                          setLedgerType("A_RECEBER");
                          setReconciliationError("");
                        }}
                        className={`px-2 py-1 rounded disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer ${ledgerType === "A_RECEBER" ? "bg-white dark:bg-[#091320] text-zinc-800 dark:text-zinc-100 shadow-xs" : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"}`}
                      >
                        Contas a Receber
                      </button>
                    </div>
                  </div>

                  {/* Ledger Search */}
                  <div className="relative">
                    <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                    <input
                      type="text"
                      placeholder={`Buscar lançamentos em aberto em ${ledgerType === "A_PAGAR" ? "Contas a Pagar" : "Contas a Receber"}...`}
                      className="w-full pl-8 pr-2 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800/70 hover:bg-zinc-100/50 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 rounded-sm border border-zinc-200 dark:border-zinc-700 focus:outline-none"
                      value={ledgerSearchTerm}
                      onChange={(e) => setLedgerSearchTerm(e.target.value)}
                    />
                  </div>

                  {/* Filtered Ledger list */}
                  <div className="overflow-y-auto max-h-[220px] divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-sm flex-grow">
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
                                  ? "hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 cursor-pointer"
                                  : "cursor-not-allowed bg-zinc-50/60 dark:bg-zinc-800/30 opacity-60"
                              }`}
                            >
                              <div className="space-y-0.5 pr-2">
                                <span className="font-semibold text-zinc-800 dark:text-zinc-100 block truncate max-w-[200px]">
                                  {ap.description}
                                </span>
                                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                                  Favorecido: {ap.supplier} | Venc:{" "}
                                  {new Date(ap.dueDate).toLocaleDateString(
                                    "pt-BR",
                                  )}
                                </span>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="font-semibold text-zinc-950 dark:text-zinc-100 font-mono block">
                                  R${" "}
                                  {ap.finalAmount.toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                  })}
                                </span>
                                <span
                                  className={`text-[8px] border font-semibold font-mono uppercase px-1.5 py-0.5 rounded ${
                                    amountMatches
                                      ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
                                      : "bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/25 text-red-700 dark:text-red-300"
                                  }`}
                                >
                                  {amountMatches
                                    ? "Quitação exata"
                                    : "Valor incompatível"}
                                </span>
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
                                  ? "hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 cursor-pointer"
                                  : "cursor-not-allowed bg-zinc-50/60 dark:bg-zinc-800/30 opacity-60"
                              }`}
                            >
                              <div className="space-y-0.5 pr-2">
                                <span className="font-semibold text-zinc-800 dark:text-zinc-100 block truncate max-w-[200px]">
                                  {ar.description}
                                </span>
                                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                                  Cliente: {ar.customer} | Venc:{" "}
                                  {new Date(ar.dueDate).toLocaleDateString(
                                    "pt-BR",
                                  )}
                                </span>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="font-semibold text-zinc-950 dark:text-zinc-100 font-mono block">
                                  R${" "}
                                  {remaining.toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                  })}
                                </span>
                                <span
                                  className={`text-[8px] border font-semibold font-mono uppercase px-1.5 py-0.5 rounded ${
                                    amountMatches
                                      ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
                                      : isPartial
                                        ? "bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/25 text-amber-700 dark:text-amber-300"
                                        : "bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/25 text-red-700 dark:text-red-300"
                                  }`}
                                >
                                  {amountMatches
                                    ? "Quitação exata"
                                    : isPartial
                                      ? "Recebimento parcial"
                                      : "Valor incompatível"}
                                </span>
                              </div>
                            </div>
                          );
                        })}

                    {ledgerType === "A_PAGAR" &&
                      payablesOptions.length === 0 && (
                        <p className="p-6 text-center text-zinc-400 dark:text-zinc-500 italic font-sans text-xs">
                          Nenhuma conta a pagar encontrada em aberto.
                        </p>
                      )}

                    {ledgerType === "A_RECEBER" &&
                      receivablesOptions.length === 0 && (
                        <p className="p-6 text-center text-zinc-400 dark:text-zinc-500 italic font-sans text-xs">
                          Nenhum faturamento a receber em aberto.
                        </p>
                      )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs text-zinc-400 dark:text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800 font-sans">
                  <span>
                    Selecione a conta correta acima para vincular e confirmar a
                    conciliação.
                  </span>
                  <button
                    onClick={() => {
                      setSelectedStatementItem(null);
                      setReconciliationError("");
                    }}
                    className="text-zinc-500 dark:text-zinc-400 font-semibold hover:underline cursor-pointer"
                  >
                    Fechar painel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
