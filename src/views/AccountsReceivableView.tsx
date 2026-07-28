/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import { AccountReceivable } from "../types";
import QuickAddSelect from "../components/QuickAddSelect";
import {
  Plus,
  Search,
  Filter,
  DollarSign,
  CalendarClock,
  AlertTriangle,
  TrendingDown,
  Wallet,
  ChevronDown,
  ChevronUp,
  Paperclip,
  CheckCircle,
  Clock,
  Ban,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";

const AR_METRIC_VISUALS = [
  {
    icon: Clock,
    tint: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  {
    icon: CalendarClock,
    tint: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  },
  {
    icon: AlertTriangle,
    tint: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  },
  {
    icon: CheckCircle,
    tint: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    icon: TrendingDown,
    tint: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300",
  },
  {
    icon: Wallet,
    tint: "bg-[#0B2C52]/5 text-[#0B2C52] dark:bg-[#123B6B]/25 dark:text-[#9DB8D9]",
  },
] as const;

const AR_AVATAR_PALETTE = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-sky-500",
  "bg-purple-500",
  "bg-teal-500",
];

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

const getAvatarTint = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AR_AVATAR_PALETTE[Math.abs(hash) % AR_AVATAR_PALETTE.length];
};

export default function AccountsReceivableView({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const {
    activeCompany,
    bankAccounts,
    accountsReceivable,
    addAccountReceivable,
    receiveAccountReceivable,
    cancelAccountReceivable,
    currentUser,
    hasPermission,
    masterData,
    addMasterData,
  } = useBPOState();
  const masterOptions = (type: string) =>
    masterData.filter(
      (item) =>
        item.companyId === activeCompany?.id &&
        item.type === type &&
        item.active,
    );

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Expanded detailed panels for receivables
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Partial Receipt Pop-up state
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [receivedAmountVal, setReceivedAmountVal] = useState("");

  // Creation Form Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2>(1);

  // Form Fields
  const [description, setDescription] = useState("");
  const [customer, setCustomer] = useState("");
  const [category, setCategory] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [competenceMonth, setCompetenceMonth] = useState("2026-07");
  const [issueDate, setIssueDate] = useState("2026-07-13");
  const [dueDate, setDueDate] = useState("2026-07-30");
  const [amount, setAmount] = useState<string>("0");
  const [paymentMethod, setPaymentMethod] = useState("Boleto Bancário");
  const [bankAccountId, setBankAccountId] = useState("");
  const [recurrence, setRecurrence] = useState<
    "Nenhuma" | "Semanal" | "Mensal" | "Trimestral" | "Anual" | "Parcelada"
  >("Nenhuma");
  const [installmentCount, setInstallmentCount] = useState("2");
  const [documentNumber, setDocumentNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [attachmentName, setAttachmentName] = useState("");

  if (!activeCompany) return null;

  const accounts = bankAccounts.filter(
    (ba) => ba.companyId === activeCompany.id,
  );
  const companyReceivables = accountsReceivable.filter(
    (ar) => ar.companyId === activeCompany.id,
  );
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const receivableMetrics = [
    [
      "A receber",
      companyReceivables.filter((item) =>
        ["A receber", "Parcialmente recebido"].includes(item.status),
      ).length,
    ],
    [
      "Recebendo hoje",
      companyReceivables.filter(
        (item) =>
          !["Recebido", "Cancelado"].includes(item.status) &&
          item.dueDate === today,
      ).length,
    ],
    [
      "Em Atraso",
      companyReceivables.filter(
        (item) =>
          item.status === "Vencido" ||
          (!["Recebido", "Cancelado"].includes(item.status) &&
            item.dueDate < today),
      ).length,
    ],
    [
      "Recebidos no mês",
      companyReceivables.filter(
        (item) =>
          item.status === "Recebido" &&
          item.receiptDate?.startsWith(currentMonth),
      ).length,
    ],
    [
      "Inadimplentes",
      companyReceivables.filter((item) =>
        ["Vencido", "Em cobrança"].includes(item.status),
      ).length,
    ],
    [
      "Recebimento previsto",
      companyReceivables
        .filter((item) => !["Recebido", "Cancelado"].includes(item.status))
        .reduce((sum, item) => sum + item.amount - item.receivedAmount, 0),
    ],
  ] as const;

  // Filter items
  const filteredReceivables = companyReceivables.filter((ar) => {
    const matchesSearch =
      ar.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ar.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ar.documentNumber.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || ar.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: AccountReceivable["status"]) => {
    switch (status) {
      case "Rascunho":
        return "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";
      case "Pendente":
        return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/25";
      case "A receber":
        return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/25";
      case "Parcialmente recebido":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25";
      case "Recebido":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25";
      case "Vencido":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/25";
      case "Em cobrança":
        return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-500/30";
      case "Negociada":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/25";
      case "Cancelado":
        return "bg-zinc-200 text-zinc-800 border-zinc-300 line-through dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700";
      default:
        return "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";
    }
  };

  const resetForm = () => {
    setDescription("");
    setCustomer("");
    setCategory("");
    setCostCenter("");
    setCompetenceMonth("2026-07");
    setIssueDate("2026-07-13");
    setDueDate("2026-07-30");
    setAmount("0");
    setPaymentMethod("Boleto Bancário");
    setBankAccountId(accounts[0]?.id || "");
    setRecurrence("Nenhuma");
    setInstallmentCount("2");
    setDocumentNumber("");
    setNotes("");
    setAttachmentName("");
    setFormStep(1);
    setIsFormOpen(false);
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !customer || !category || !costCenter) {
      alert("Preencha os campos obrigatórios da primeira etapa.");
      return;
    }
    setFormStep(2);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (recurrence === "Parcelada" && Number(installmentCount) < 2) {
      alert("Informe pelo menos 2 parcelas ou escolha outra recorrência.");
      return;
    }
    addAccountReceivable({
      description,
      customer,
      category,
      costCenter,
      competenceMonth,
      issueDate,
      dueDate,
      amount: Number(amount),
      interest: 0,
      penalty: 0,
      discount: 0,
      paymentMethod,
      bankAccountId: bankAccountId || accounts[0]?.id,
      recurrence,
      installmentCount: recurrence === "Parcelada" ? Number(installmentCount) : undefined,
      documentNumber,
      notes,
      attachmentName: attachmentName || undefined,
      attachmentUrl: attachmentName ? "#" : undefined,
      responsibleId: currentUser.id,
    });
    resetForm();
  };

  const handleFullReceipt = (id: string, amount: number) => {
    const today = new Date().toISOString().split("T")[0];
    receiveAccountReceivable(id, amount, today);
  };

  const handlePartialReceiptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingId) return;
    const amountVal = Number(receivedAmountVal);
    if (amountVal <= 0) {
      alert("Digite um valor positivo válido.");
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    receiveAccountReceivable(receivingId, amountVal, today);
    setReceivingId(null);
    setReceivedAmountVal("");
  };

  const handleCancel = (id: string) => {
    if (window.confirm("Confirmar cancelamento deste recebível?")) {
      cancelAccountReceivable(id);
    }
  };

  return (
    <div id="accounts-receivable-root" className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2
            id="receivable-title"
            className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight font-sans"
          >
            Contas a Receber
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs font-sans">
            Controle de faturamentos, geração de boletos, fluxos de recebimento
            parcial e baixas no banco.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission("accounts-receivable.create") && onNavigate && (
            <button
              onClick={onNavigate}
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-[#091320] hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 px-4 py-2.5 rounded-sm transition-colors cursor-pointer shadow-xs"
            >
              <ArrowUpRight className="h-4 w-4" />
              Ir para Lançamentos
            </button>
          )}
          {hasPermission("accounts-receivable.create") && (
            <button
              onClick={() => setIsFormOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#C8102E] hover:bg-[#8F071B] px-4 py-2.5 rounded-sm transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="h-4 w-4" />
              Nova conta a receber
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {receivableMetrics.map(([label, value], index) => {
          const visual = AR_METRIC_VISUALS[index];
          const VisualIcon = visual.icon;
          return (
            <div
              key={label}
              className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 p-2.5 flex flex-col gap-2"
            >
              <div
                className={`h-7 w-7 rounded-sm flex items-center justify-center ${visual.tint}`}
              >
                <VisualIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold uppercase">
                  {label}
                </p>
                <p className="text-xl font-semibold mt-0.5 text-zinc-900 dark:text-zinc-50">
                  {label === "Recebimento previsto"
                    ? `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                    : value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid Filtering / Searching */}
      <div className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96 font-sans">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por Descrição, Cliente ou Número..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 hover:bg-zinc-100/50 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 rounded-sm border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#C8102E] transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto font-sans">
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/70 px-3 py-1.5 rounded-sm border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-300">
            <Filter className="h-3.5 w-3.5" />
            <select
              className="bg-transparent font-medium focus:outline-none cursor-pointer dark:[color-scheme:dark]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Todos os Status</option>
              <option value="A receber">A receber</option>
              <option value="Parcialmente recebido">
                Parcialmente recebidos
              </option>
              <option value="Recebido">Recebidos</option>
              <option value="Vencido">Vencidos</option>
              <option value="Em cobrança">Em cobrança</option>
              <option value="Cancelado">Cancelados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Creation Step Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-gradient-to-r from-[#0B2C52] to-[#C8102E] text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">
                  Lançar Nova Conta a Receber
                </h3>
                <p className="text-[10px] text-[#F2D3A0]">
                  Dividido em 2 etapas estruturadas de faturamento BPO.
                </p>
              </div>
              <button
                onClick={resetForm}
                className="text-[#F2D3A0] hover:text-white font-semibold text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <div className="flex bg-[#0B2C52] border-b border-[#0B2C52]/20 px-5 py-3.5 text-xs justify-between font-medium">
              <span
                className={`flex items-center gap-1.5 ${formStep >= 1 ? "text-white font-semibold" : "text-white/40"}`}
              >
                <span className="h-5 w-5 rounded bg-[#C8102E] text-white flex items-center justify-center text-[10px] font-semibold">
                  1
                </span>{" "}
                Cliente & Classificação
              </span>
              <span
                className={`flex items-center gap-1.5 ${formStep >= 2 ? "text-white font-semibold" : "text-white/40"}`}
              >
                <span
                  className={`h-5 w-5 rounded flex items-center justify-center text-[10px] font-semibold ${formStep >= 2 ? "bg-[#C8102E] text-white" : "bg-[#061425] text-white/40"}`}
                >
                  2
                </span>{" "}
                Faturamento & Anexos
              </span>
            </div>

            <form
              onSubmit={formStep === 2 ? handleSubmit : handleNextStep}
              className="p-6 space-y-4"
            >
              {/* Step 1 */}
              {formStep === 1 && (
                <div className="space-y-4 animate-in slide-in-from-right-5 duration-150">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block">
                      Descrição do Faturamento *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Mensalidade Desenvolvimento de Software Julho"
                      className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <QuickAddSelect
                    label="Cliente / Sacado"
                    required
                    labelClassName="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block"
                    value={customer}
                    onChange={setCustomer}
                    options={masterOptions("CUSTOMER")}
                    onAdd={(name) => addMasterData("CUSTOMER", name)}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <QuickAddSelect
                      label="Categoria Receita"
                      required
                      labelClassName="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block"
                      value={category}
                      onChange={setCategory}
                      options={masterOptions("CATEGORY")}
                      onAdd={(name) => addMasterData("CATEGORY", name)}
                    />

                    <QuickAddSelect
                      label="Centro de Custo"
                      required
                      labelClassName="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block"
                      value={costCenter}
                      onChange={setCostCenter}
                      options={masterOptions("COST_CENTER")}
                      onAdd={(name) => addMasterData("COST_CENTER", name)}
                    />
                  </div>
                </div>
              )}

              {/* Step 2 */}
              {formStep === 2 && (
                <div className="space-y-4 animate-in slide-in-from-right-5 duration-150">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block">
                        Mês Competência
                      </label>
                      <input
                        type="month"
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm"
                        value={competenceMonth}
                        onChange={(e) => setCompetenceMonth(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block">
                        Data Emissão
                      </label>
                      <input
                        type="date"
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block">
                        Vencimento *
                      </label>
                      <input
                        type="date"
                        required
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block">
                        Valor Principal (R$) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm focus:outline-none"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block">
                        Cobrar por Qual Banco *
                      </label>
                      <select
                        required
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm cursor-pointer"
                        value={bankAccountId}
                        onChange={(e) => setBankAccountId(e.target.value)}
                      >
                        {accounts.map((ba) => (
                          <option key={ba.id} value={ba.id}>
                            {ba.bankName} - Ag. {ba.agency}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <QuickAddSelect
                      label="Forma Recebimento"
                      labelClassName="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block"
                      value={paymentMethod}
                      onChange={setPaymentMethod}
                      options={masterOptions("PAYMENT_METHOD")}
                      onAdd={(name) => addMasterData("PAYMENT_METHOD", name)}
                    />

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block">
                        Número do Documento / NFe
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: NFe-40291"
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm focus:outline-none"
                        value={documentNumber}
                        onChange={(e) => setDocumentNumber(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block">
                      Recorrência
                    </label>
                    <select
                      className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm cursor-pointer"
                      value={recurrence}
                      onChange={(e) => setRecurrence(e.target.value as any)}
                    >
                      <option value="Nenhuma">Nenhuma / Único</option>
                      <option value="Parcelada">Parcelada</option>
                      <option value="Semanal">Semanal</option>
                      <option value="Mensal">Mensal</option>
                      <option value="Trimestral">Trimestral</option>
                      <option value="Anual">Anual</option>
                    </select>
                  </div>

                  {recurrence === "Parcelada" && (
                    <div className="p-3 bg-[#0B2C52]/5 dark:bg-[#123B6B]/20 border border-[#0B2C52]/20 dark:border-[#3E6DA6]/40 rounded-sm space-y-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                          Quantidade de parcelas
                        </label>
                        <input
                          type="number"
                          min={2}
                          step={1}
                          className="w-full p-2 text-xs bg-white dark:bg-[#091320] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm focus:outline-none"
                          value={installmentCount}
                          onChange={(e) => setInstallmentCount(e.target.value)}
                        />
                      </div>
                      {Number(installmentCount) >= 2 && (
                        <p className="text-[10px] text-[#0B2C52] dark:text-[#B9CDE6] font-semibold">
                          {installmentCount}x de aprox.{" "}
                          R${" "}
                          {(Number(amount) / Number(installmentCount)).toLocaleString(
                            "pt-BR",
                            { minimumFractionDigits: 2 },
                          )}{" "}
                          — 1ª parcela em{" "}
                          {new Date(dueDate).toLocaleDateString("pt-BR")}, as
                          demais nos meses seguintes.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block">
                      Fatura PDF Anexa
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Nome do arquivo faturado..."
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm focus:outline-none"
                        value={attachmentName}
                        onChange={(e) => setAttachmentName(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setAttachmentName("nota_faturamento_alfa.pdf")
                        }
                        className="text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-2 rounded-sm cursor-pointer text-zinc-700 dark:text-zinc-200 font-semibold flex items-center gap-1 shrink-0"
                      >
                        <Paperclip className="h-3.5 w-3.5" /> Simular
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block">
                      Instruções de Cobrança / Notas
                    </label>
                    <textarea
                      placeholder="Ex: Juros de 2% ao mês após vencimento."
                      rows={2}
                      className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-6">
                {formStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setFormStep(1)}
                    className="text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-semibold px-4 py-2 rounded-sm cursor-pointer text-zinc-800 dark:text-zinc-200"
                  >
                    Voltar Etapa
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white font-medium px-3 py-2 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="text-xs font-semibold bg-zinc-950 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-white px-4 py-2 rounded-sm shadow-xs cursor-pointer"
                  >
                    {formStep === 2 ? "Lançar Faturamento" : "Próxima Etapa"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Partial Receipt Pop-up Modal */}
      {receivingId && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-100">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Registrar Entrada / Baixa Parcial
              </h3>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
                Insira o valor creditado no banco para esta conta.
              </p>
            </div>

            <form onSubmit={handlePartialReceiptSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                  Valor Creditado (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="Ex: R$ 5.000,00"
                  className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm focus:outline-none"
                  value={receivedAmountVal}
                  onChange={(e) => setReceivedAmountVal(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 text-xs pt-2">
                <button
                  type="button"
                  onClick={() => setReceivingId(null)}
                  className="text-zinc-500 dark:text-zinc-400 font-semibold px-3 py-1.5 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 font-semibold text-white px-3 py-1.5 rounded-sm cursor-pointer shadow-xs"
                >
                  Confirmar Baixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Table view of receivables */}
      <div className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-[#091320]/60 border-b border-zinc-200 dark:border-zinc-800">
                <th className="p-4 w-6"></th>
                <th className="p-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Descrição Lançamento
                </th>
                <th className="p-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="p-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Vencimento
                </th>
                <th className="p-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-right">
                  Valor Faturado
                </th>
                <th className="p-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-right">
                  Valor Creditado
                </th>
                <th className="p-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-center">
                  Status
                </th>
                <th className="p-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
              {filteredReceivables.map((ar) => {
                const isExpanded = expandedId === ar.id;
                const outstanding = ar.amount - ar.receivedAmount;
                const isOverdue =
                  new Date(ar.dueDate) < new Date() &&
                  !["Recebido", "Cancelado"].includes(ar.status);

                return (
                  <React.Fragment key={ar.id}>
                    <tr
                      className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer ${isExpanded ? "bg-zinc-50/30 dark:bg-zinc-800/30" : ""} ${isOverdue ? "shadow-[inset_3px_0_0_0_#fb7185] dark:shadow-[inset_3px_0_0_0_#f43f5e]" : ""}`}
                      onClick={() => setExpandedId(isExpanded ? null : ar.id)}
                    >
                      <td className="p-4 text-center">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                        )}
                      </td>
                      <td className="p-4 font-semibold text-zinc-900 dark:text-zinc-50">
                        {ar.description}
                        {ar.installmentCount && (
                          <span className="ml-1.5 text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/25 px-1.5 py-0.5 rounded align-middle">
                            {ar.installmentNumber}/{ar.installmentCount}
                          </span>
                        )}
                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal font-sans">
                          Nº Doc: {ar.documentNumber || "N/A"} | Categoria:{" "}
                          {ar.category}
                        </div>
                      </td>
                      <td className="p-4 text-zinc-600 dark:text-zinc-300 font-medium">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-6 w-6 rounded-full ${getAvatarTint(ar.customer)} text-white text-[9px] font-semibold flex items-center justify-center shrink-0`}
                          >
                            {getInitials(ar.customer)}
                          </span>
                          {ar.customer}
                        </div>
                      </td>
                      <td
                        className={`p-4 font-medium ${isOverdue ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-zinc-600 dark:text-zinc-300"}`}
                      >
                        {new Date(ar.dueDate).toLocaleDateString("pt-BR")}
                        {isOverdue && (
                          <span className="text-[9px] bg-rose-50 border border-rose-100 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/25 dark:text-rose-400 px-1.5 py-0.5 rounded ml-2 font-semibold uppercase tracking-wider">
                            Atrasado
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right font-semibold text-zinc-900 dark:text-zinc-50 font-mono">
                        R${" "}
                        {ar.amount.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-4 text-right font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                        R${" "}
                        {ar.receivedAmount.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded border ${getStatusBadge(ar.status)}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
                          {ar.status}
                        </span>
                      </td>
                      <td
                        className="p-4 text-right font-sans"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {!["Recebido", "Cancelado"].includes(ar.status) &&
                            hasPermission("reconciliation.execute") && (
                              <>
                                <button
                                  onClick={() =>
                                    handleFullReceipt(ar.id, outstanding)
                                  }
                                  className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:text-emerald-300 font-semibold px-2 py-1 rounded border border-emerald-200 dark:border-emerald-500/25 cursor-pointer"
                                  title="Baixa Total"
                                >
                                  Total
                                </button>
                                <button
                                  onClick={() => setReceivingId(ar.id)}
                                  className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:text-amber-300 font-semibold px-2 py-1 rounded border border-amber-200 dark:border-amber-500/25 cursor-pointer"
                                  title="Baixa Parcial"
                                >
                                  Parcial
                                </button>
                              </>
                            )}
                          {!["Recebido", "Cancelado"].includes(ar.status) &&
                            hasPermission("accounts-receivable.cancel") && (
                              <button
                                onClick={() => handleCancel(ar.id)}
                                className="text-[10px] bg-zinc-50 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 font-semibold px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                                title="Cancelar Lançamento"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>

                    {/* Collapsible details for receivable */}
                    {isExpanded && (
                      <tr>
                        <td
                          colSpan={8}
                          className="p-4 bg-zinc-50/50 dark:bg-[#091320]/40 border-t border-b border-zinc-100 dark:border-zinc-800"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-zinc-600 dark:text-zinc-300 font-sans">
                            {/* Value details */}
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                <span className="h-5 w-5 rounded bg-[#0B2C52]/5 text-[#0B2C52] dark:bg-[#123B6B]/25 dark:text-[#9DB8D9] flex items-center justify-center shrink-0">
                                  <DollarSign className="h-3 w-3" strokeWidth={2.25} />
                                </span>
                                Lançamento de Caixa
                              </h4>
                              <div className="space-y-1 bg-white dark:bg-[#091320] p-3 rounded-sm border border-zinc-200/60 dark:border-zinc-800 font-mono">
                                <div className="flex justify-between">
                                  <span>Total Faturado:</span>
                                  <span>
                                    R${" "}
                                    {ar.amount.toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                                  <span>Creditado / Recebido:</span>
                                  <span>
                                    - R${" "}
                                    {ar.receivedAmount.toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
                                    style={{
                                      width: `${ar.amount > 0 ? Math.min(100, (ar.receivedAmount / ar.amount) * 100) : 0}%`,
                                    }}
                                  />
                                </div>
                                <div className="flex justify-between font-semibold text-zinc-900 dark:text-zinc-50 border-t border-zinc-100 dark:border-zinc-800 pt-1 text-sm">
                                  <span>Saldo Restante:</span>
                                  <span>
                                    R${" "}
                                    {outstanding.toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Faturamento options */}
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                <span className="h-5 w-5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300 flex items-center justify-center shrink-0">
                                  <Clock className="h-3 w-3" strokeWidth={2.25} />
                                </span>
                                Classificação Operacional
                              </h4>
                              <div className="space-y-1.5 bg-white dark:bg-[#091320] p-3 rounded-sm border border-zinc-200/60 dark:border-zinc-800">
                                <div>
                                  <span className="text-zinc-400 dark:text-zinc-500 font-medium block text-[9px] uppercase">
                                    Forma Recebimento
                                  </span>
                                  <span className="font-bold text-zinc-800">
                                    {ar.paymentMethod}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 dark:text-zinc-500 font-medium block text-[9px] uppercase">
                                    Centro de Custo
                                  </span>
                                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                    {ar.costCenter}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 dark:text-zinc-500 font-medium block text-[9px] uppercase">
                                    Compensar na Conta
                                  </span>
                                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                    {bankAccounts.find(
                                      (ba) => ba.id === ar.bankAccountId,
                                    )?.bankName || "Itaú"}
                                  </span>
                                </div>
                                {ar.installmentCount && (
                                  <div>
                                    <span className="text-zinc-400 dark:text-zinc-500 font-medium block text-[9px] uppercase">
                                      Parcela
                                    </span>
                                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                      {ar.installmentNumber} de {ar.installmentCount}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Documents and audit trail */}
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                <span className="h-5 w-5 rounded bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300 flex items-center justify-center shrink-0">
                                  <Paperclip className="h-3 w-3" strokeWidth={2.25} />
                                </span>
                                Faturas e Conciliação
                              </h4>
                              <div className="space-y-2 bg-white dark:bg-[#091320] p-3 rounded-sm border border-zinc-200/60 dark:border-zinc-800 font-sans">
                                <div>
                                  <span className="text-zinc-400 dark:text-zinc-500 font-medium block text-[9px] uppercase">
                                    Fatura / Nota Fiscal
                                  </span>
                                  {ar.attachmentName ? (
                                    <a
                                      href="#"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        alert(
                                          "Visualizando Nota Fiscal via link seguro criptografado...",
                                        );
                                      }}
                                      className="font-semibold text-zinc-900 dark:text-zinc-100 hover:underline flex items-center gap-1 mt-0.5"
                                    >
                                      <Paperclip className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                                      {ar.attachmentName}{" "}
                                      <ExternalLink className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
                                    </a>
                                  ) : (
                                    <span className="text-zinc-400 dark:text-zinc-500 italic">
                                      Nota Fiscal não anexada
                                    </span>
                                  )}
                                </div>

                                {ar.status === "Recebido" && (
                                  <div>
                                    <span className="text-zinc-400 dark:text-zinc-500 font-medium block text-[9px] uppercase">
                                      Comprovante de Entrada
                                    </span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />{" "}
                                      Liquidado em{" "}
                                      {new Date(
                                        ar.receiptDate || "",
                                      ).toLocaleDateString("pt-BR")}
                                    </span>
                                  </div>
                                )}

                                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-1.5 text-[10px] text-zinc-400 dark:text-zinc-500 font-mono leading-tight">
                                  Recebível UUID: {ar.id}
                                  <br />
                                  Competência: {ar.competenceMonth}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filteredReceivables.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="p-8 text-center text-zinc-400 dark:text-zinc-500 italic"
                  >
                    Nenhuma conta a receber correspondente à busca.
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
