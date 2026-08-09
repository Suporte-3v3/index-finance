/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import QuickAddSelect from "../components/QuickAddSelect";
import CurrencyInput from "../components/CurrencyInput";
import {
  Button,
  Card,
  MetricCard,
  SearchField,
  StatusBadge,
  ConfirmDialog,
} from "../components/ui";
import {
  Plus,
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
  { icon: Clock, tone: "navy" },
  { icon: CalendarClock, tone: "gold" },
  { icon: AlertTriangle, tone: "red" },
  { icon: CheckCircle, tone: "green" },
  { icon: TrendingDown, tone: "red" },
  { icon: Wallet, tone: "navy" },
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
  const [receivedAmountVal, setReceivedAmountVal] = useState(0);

  // Creation Form Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (!isFormOpen && !receivingId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsFormOpen(false);
      setReceivingId(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isFormOpen, receivingId]);

  // Form Fields
  const [description, setDescription] = useState("");
  const [customer, setCustomer] = useState("");
  const [category, setCategory] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [competenceMonth, setCompetenceMonth] = useState("2026-07");
  const [issueDate, setIssueDate] = useState("2026-07-13");
  const [dueDate, setDueDate] = useState("2026-07-30");
  const [amount, setAmount] = useState(0);
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


  const resetForm = () => {
    setDescription("");
    setCustomer("");
    setCategory("");
    setCostCenter("");
    setCompetenceMonth("2026-07");
    setIssueDate("2026-07-13");
    setDueDate("2026-07-30");
    setAmount(0);
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
    if (receivedAmountVal <= 0) {
      alert("Digite um valor positivo válido.");
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    receiveAccountReceivable(receivingId, receivedAmountVal, today);
    setReceivingId(null);
    setReceivedAmountVal(0);
  };

  const handleCancel = (id: string) => {
    setCancelTargetId(id);
  };

  const confirmCancel = () => {
    if (!cancelTargetId) return;
    cancelAccountReceivable(cancelTargetId);
    setCancelTargetId(null);
  };

  return (
    <div id="accounts-receivable-root" className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2
            id="receivable-title"
            className="text-xl font-semibold text-ink dark:text-ink-dark tracking-tight font-sans"
          >
            Contas a Receber
          </h2>
          <p className="text-ink-soft dark:text-ink-soft-dark text-xs font-sans">
            Controle de faturamentos, geração de boletos, fluxos de recebimento
            parcial e baixas no banco.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission("accounts-receivable.create") && onNavigate && (
            <Button variant="outline" icon={<ArrowUpRight className="h-4 w-4" />} onClick={onNavigate}>
              Ir para Lançamentos
            </Button>
          )}
          {hasPermission("accounts-receivable.create") && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setIsFormOpen(true)}>
              Nova conta a receber
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {receivableMetrics.map(([label, value], index) => {
          const visual = AR_METRIC_VISUALS[index];
          return (
            <MetricCard
              key={label}
              icon={<visual.icon strokeWidth={2.25} />}
              label={String(label)}
              value={
                label === "Recebimento previsto"
                  ? `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                  : String(value)
              }
              tone={visual.tone}
            />
          );
        })}
      </div>

      {/* Grid Filtering / Searching */}
      <Card className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <SearchField
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por Descrição, Cliente ou Número..."
          containerClassName="w-full md:w-96"
        />

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 bg-canvas dark:bg-white/5 px-3 py-1.5 rounded-lg border border-line dark:border-line-dark text-xs text-ink dark:text-ink-dark">
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
      </Card>

      {/* Creation Step Form Modal */}
      {isFormOpen && (
        <div
          className="fixed inset-0 bg-brand-navy-950/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans"
          onClick={resetForm}
        >
          <div
            className="bg-surface dark:bg-surface-dark rounded-2xl border border-line dark:border-line-dark shadow-2xl max-w-xl w-full overflow-hidden motion-safe:animate-[modalIn_180ms_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-line dark:border-line-dark bg-brand-navy-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">
                  Lançar Nova Conta a Receber
                </h3>
                <p className="text-[10px] text-brand-gold-300">
                  Dividido em 2 etapas estruturadas de faturamento BPO.
                </p>
              </div>
              <button
                onClick={resetForm}
                className="text-brand-gold-300 hover:text-white font-semibold text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <div className="flex bg-brand-navy-900 border-b border-brand-navy-900/20 px-5 py-3.5 text-xs justify-between font-medium">
              <span
                className={`flex items-center gap-1.5 ${formStep >= 1 ? "text-white font-semibold" : "text-white/40"}`}
              >
                <span className="h-5 w-5 rounded bg-brand-red-600 text-white flex items-center justify-center text-[10px] font-semibold">
                  1
                </span>{" "}
                Cliente & Classificação
              </span>
              <span
                className={`flex items-center gap-1.5 ${formStep >= 2 ? "text-white font-semibold" : "text-white/40"}`}
              >
                <span
                  className={`h-5 w-5 rounded flex items-center justify-center text-[10px] font-semibold ${formStep >= 2 ? "bg-brand-red-600 text-white" : "bg-brand-navy-950 text-white/40"}`}
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
                    <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark block">
                      Descrição do Faturamento *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Mensalidade Desenvolvimento de Software Julho"
                      className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <QuickAddSelect
                    label="Cliente / Sacado"
                    required
                    labelClassName="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark block"
                    value={customer}
                    onChange={setCustomer}
                    options={masterOptions("CUSTOMER")}
                    onAdd={(name) => addMasterData("CUSTOMER", name)}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <QuickAddSelect
                      label="Categoria Receita"
                      required
                      labelClassName="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark block"
                      value={category}
                      onChange={setCategory}
                      options={masterOptions("CATEGORY")}
                      onAdd={(name) => addMasterData("CATEGORY", name)}
                    />

                    <QuickAddSelect
                      label="Centro de Custo"
                      required
                      labelClassName="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark block"
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
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark block">
                        Mês Competência
                      </label>
                      <input
                        type="month"
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg"
                        value={competenceMonth}
                        onChange={(e) => setCompetenceMonth(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark block">
                        Data Emissão
                      </label>
                      <input
                        type="date"
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark block">
                        Vencimento *
                      </label>
                      <input
                        type="date"
                        required
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark block">
                        Valor Principal (R$) *
                      </label>
                      <CurrencyInput
                        required
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg focus:outline-none"
                        value={amount}
                        onChange={setAmount}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark block">
                        Cobrar por Qual Banco *
                      </label>
                      <select
                        required
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg cursor-pointer"
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
                      labelClassName="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark block"
                      value={paymentMethod}
                      onChange={setPaymentMethod}
                      options={masterOptions("PAYMENT_METHOD")}
                      onAdd={(name) => addMasterData("PAYMENT_METHOD", name)}
                    />

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark block">
                        Número do Documento / NFe
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: NFe-40291"
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg focus:outline-none"
                        value={documentNumber}
                        onChange={(e) => setDocumentNumber(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark block">
                      Recorrência
                    </label>
                    <select
                      className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg cursor-pointer"
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
                    <div className="p-3 bg-brand-navy-900/5 dark:bg-brand-navy-700/20 border border-brand-navy-900/20 dark:border-brand-navy-700/40 rounded-lg space-y-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">
                          Quantidade de parcelas
                        </label>
                        <input
                          type="number"
                          min={2}
                          step={1}
                          className="w-full p-2 text-xs bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg focus:outline-none"
                          value={installmentCount}
                          onChange={(e) => setInstallmentCount(e.target.value)}
                        />
                      </div>
                      {Number(installmentCount) >= 2 && (
                        <p className="text-[10px] text-brand-navy-900 dark:text-blue-100 font-semibold">
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
                    <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark block">
                      Fatura PDF Anexa
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Nome do arquivo faturado..."
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg focus:outline-none"
                        value={attachmentName}
                        onChange={(e) => setAttachmentName(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setAttachmentName("nota_faturamento_alfa.pdf")
                        }
                        className="text-xs bg-zinc-100 dark:bg-zinc-800 border border-line dark:border-line-dark p-2 rounded-lg cursor-pointer text-zinc-700 dark:text-zinc-200 font-semibold flex items-center gap-1 shrink-0"
                      >
                        <Paperclip className="h-3.5 w-3.5" /> Simular
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark block">
                      Instruções de Cobrança / Notas
                    </label>
                    <textarea
                      placeholder="Ex: Juros de 2% ao mês após vencimento."
                      rows={2}
                      className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-between border-t border-line dark:border-line-dark pt-4 mt-6">
                {formStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setFormStep(1)}
                    className="text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-semibold px-4 py-2 rounded-lg cursor-pointer text-zinc-800 dark:text-zinc-200"
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
                    className="text-xs text-ink-soft dark:text-ink-soft-dark hover:text-zinc-950 dark:hover:text-white font-medium px-3 py-2 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="text-xs font-semibold bg-brand-red-600 hover:bg-brand-red-500 text-white px-4 py-2 rounded-lg shadow-xs cursor-pointer"
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
        <div
          className="fixed inset-0 bg-brand-navy-950/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans"
          onClick={() => setReceivingId(null)}
        >
          <div
            className="bg-surface dark:bg-surface-dark rounded-2xl border border-line dark:border-line-dark shadow-2xl max-w-sm w-full p-6 space-y-4 motion-safe:animate-[modalIn_180ms_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-sm font-semibold text-ink dark:text-ink-dark">
                Registrar Entrada / Baixa Parcial
              </h3>
              <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark mt-1">
                Insira o valor creditado no banco para esta conta.
              </p>
            </div>

            <form onSubmit={handlePartialReceiptSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">
                  Valor Creditado (R$)
                </label>
                <CurrencyInput
                  required
                  autoFocus
                  placeholder="0,00"
                  className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg focus:outline-none"
                  value={receivedAmountVal}
                  onChange={setReceivedAmountVal}
                />
              </div>

              <div className="flex justify-end gap-2 text-xs pt-2">
                <button
                  type="button"
                  onClick={() => setReceivingId(null)}
                  className="text-ink-soft dark:text-ink-soft-dark font-semibold px-3 py-1.5 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 font-semibold text-white px-3 py-1.5 rounded-lg cursor-pointer shadow-xs"
                >
                  Confirmar Baixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Table view of receivables */}
      <div className="bg-surface dark:bg-surface-dark rounded-lg border border-line dark:border-line-dark shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-surface-dark/60 border-b border-line dark:border-line-dark">
                <th className="p-4 w-6"></th>
                <th className="p-4 text-xs font-semibold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider">
                  Descrição Lançamento
                </th>
                <th className="p-4 text-xs font-semibold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider">
                  Cliente
                </th>
                <th className="p-4 text-xs font-semibold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider">
                  Vencimento
                </th>
                <th className="p-4 text-xs font-semibold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider text-right">
                  Valor Faturado
                </th>
                <th className="p-4 text-xs font-semibold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider text-right">
                  Valor Creditado
                </th>
                <th className="p-4 text-xs font-semibold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider text-center">
                  Status
                </th>
                <th className="p-4 text-xs font-semibold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line dark:divide-line-dark text-xs">
              {filteredReceivables.map((ar) => {
                const isExpanded = expandedId === ar.id;
                const outstanding = ar.amount - ar.receivedAmount;
                const isOverdue =
                  new Date(ar.dueDate) < new Date() &&
                  !["Recebido", "Cancelado"].includes(ar.status);

                return (
                  <React.Fragment key={ar.id}>
                    <tr
                      className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer ${isExpanded ? "bg-zinc-50/30 dark:bg-zinc-800/30" : ""} ${isOverdue ? "shadow-[inset_3px_0_0_0_#C8102E] dark:shadow-[inset_3px_0_0_0_#E20D35]" : ""}`}
                      onClick={() => setExpandedId(isExpanded ? null : ar.id)}
                    >
                      <td className="p-4 text-center">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-ink-soft dark:text-ink-soft-dark" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-ink-soft dark:text-ink-soft-dark" />
                        )}
                      </td>
                      <td className="p-4 font-semibold text-ink dark:text-ink-dark">
                        {ar.description}
                        {ar.installmentCount && (
                          <span className="ml-1.5 text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/25 px-1.5 py-0.5 rounded align-middle">
                            {ar.installmentNumber}/{ar.installmentCount}
                          </span>
                        )}
                        <div className="text-[10px] text-ink-soft dark:text-ink-soft-dark font-normal font-sans">
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
                      <td className="p-4 text-right font-semibold text-ink dark:text-ink-dark font-mono">
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
                        <StatusBadge status={ar.status} />
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
                                className="text-[10px] bg-zinc-50 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 font-semibold px-2 py-1 rounded border border-line dark:border-line-dark cursor-pointer"
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
                          className="p-4 bg-zinc-50/50 dark:bg-surface-dark/40 border-t border-b border-line dark:border-line-dark"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-zinc-600 dark:text-zinc-300 font-sans">
                            {/* Value details */}
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider flex items-center gap-1.5">
                                <span className="h-5 w-5 rounded bg-brand-navy-900/5 text-brand-navy-900 dark:bg-brand-navy-700/25 dark:text-blue-200 flex items-center justify-center shrink-0">
                                  <DollarSign className="h-3 w-3" strokeWidth={2.25} />
                                </span>
                                Lançamento de Caixa
                              </h4>
                              <div className="space-y-1 bg-surface dark:bg-surface-dark p-3 rounded-lg border border-zinc-200/60 dark:border-zinc-800 font-mono">
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
                                <div className="flex justify-between font-semibold text-ink dark:text-ink-dark border-t border-line dark:border-line-dark pt-1 text-sm">
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
                              <h4 className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider flex items-center gap-1.5">
                                <span className="h-5 w-5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300 flex items-center justify-center shrink-0">
                                  <Clock className="h-3 w-3" strokeWidth={2.25} />
                                </span>
                                Classificação Operacional
                              </h4>
                              <div className="space-y-1.5 bg-surface dark:bg-surface-dark p-3 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
                                <div>
                                  <span className="text-ink-soft dark:text-ink-soft-dark font-medium block text-[9px] uppercase">
                                    Forma Recebimento
                                  </span>
                                  <span className="font-bold text-zinc-800">
                                    {ar.paymentMethod}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-ink-soft dark:text-ink-soft-dark font-medium block text-[9px] uppercase">
                                    Centro de Custo
                                  </span>
                                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                    {ar.costCenter}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-ink-soft dark:text-ink-soft-dark font-medium block text-[9px] uppercase">
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
                                    <span className="text-ink-soft dark:text-ink-soft-dark font-medium block text-[9px] uppercase">
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
                              <h4 className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider flex items-center gap-1.5">
                                <span className="h-5 w-5 rounded bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300 flex items-center justify-center shrink-0">
                                  <Paperclip className="h-3 w-3" strokeWidth={2.25} />
                                </span>
                                Faturas e Conciliação
                              </h4>
                              <div className="space-y-2 bg-surface dark:bg-surface-dark p-3 rounded-lg border border-zinc-200/60 dark:border-zinc-800 font-sans">
                                <div>
                                  <span className="text-ink-soft dark:text-ink-soft-dark font-medium block text-[9px] uppercase">
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
                                      className="font-semibold text-ink dark:text-ink-dark hover:underline flex items-center gap-1 mt-0.5"
                                    >
                                      <Paperclip className="h-3.5 w-3.5 text-ink-soft dark:text-ink-soft-dark shrink-0" />
                                      {ar.attachmentName}{" "}
                                      <ExternalLink className="h-3 w-3 text-ink-soft dark:text-ink-soft-dark" />
                                    </a>
                                  ) : (
                                    <span className="text-ink-soft dark:text-ink-soft-dark italic">
                                      Nota Fiscal não anexada
                                    </span>
                                  )}
                                </div>

                                {ar.status === "Recebido" && (
                                  <div>
                                    <span className="text-ink-soft dark:text-ink-soft-dark font-medium block text-[9px] uppercase">
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

                                <div className="border-t border-line dark:border-line-dark pt-1.5 text-[10px] text-ink-soft dark:text-ink-soft-dark font-mono leading-tight">
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
                    className="p-8 text-center text-ink-soft dark:text-ink-soft-dark italic"
                  >
                    Nenhuma conta a receber correspondente à busca.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={cancelTargetId !== null}
        onClose={() => setCancelTargetId(null)}
        onConfirm={confirmCancel}
        title="Cancelar este recebível?"
        description="O registro histórico será preservado para auditoria."
        confirmLabel="Cancelar recebível"
        cancelLabel="Voltar"
      />
    </div>
  );
}
