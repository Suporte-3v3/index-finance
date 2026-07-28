/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import { AccountPayable, MasterDataType } from "../types";
import QuickAddSelect from "../components/QuickAddSelect";
import {
  Plus,
  Search,
  Filter,
  Check,
  AlertCircle,
  AlertTriangle,
  Paperclip,
  CheckCircle,
  Ban,
  Clock,
  CalendarClock,
  Wallet,
  Hourglass,
  ExternalLink,
  ChevronRight,
  X,
  Pencil,
  Landmark,
  History,
  Info,
} from "lucide-react";

const formatBRL = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const getRemaining = (ap: AccountPayable) =>
  Math.max(ap.finalAmount - (ap.paidAmount || 0), 0);

type PanelTab = "info" | "payment" | "attachments" | "history";

const AP_METRIC_VISUALS = [
  {
    icon: AlertTriangle,
    tint: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  },
  {
    icon: CalendarClock,
    tint: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  },
  {
    icon: Clock,
    tint: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  },
  {
    icon: Hourglass,
    tint: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  },
  {
    icon: CheckCircle,
    tint: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    icon: Wallet,
    tint: "bg-[#0B2C52]/5 text-[#0B2C52] dark:bg-[#123B6B]/25 dark:text-[#9DB8D9]",
  },
] as const;

const AP_AVATAR_PALETTE = [
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
  return AP_AVATAR_PALETTE[Math.abs(hash) % AP_AVATAR_PALETTE.length];
};

export default function AccountsPayableView({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const {
    activeCompany,
    bankAccounts,
    accountsPayable,
    addAccountPayable,
    updateAccountPayable,
    payAccountPayable,
    scheduleAccountPayable,
    cancelAccountPayable,
    currentUser,
    hasPermission,
    masterData,
    addMasterData,
  } = useBPOState();
  const masterOptions = (type: MasterDataType) =>
    masterData.filter(
      (item) =>
        item.companyId === activeCompany?.id &&
        item.type === type &&
        item.active,
    );

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Side panel state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>("info");
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [panelError, setPanelError] = useState("");

  // Edit form state (Informações tab)
  const [editDescription, setEditDescription] = useState("");
  const [editSupplier, setEditSupplier] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editCostCenter, setEditCostCenter] = useState("");
  const [editCompetenceMonth, setEditCompetenceMonth] = useState("");
  const [editIssueDate, setEditIssueDate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editAmount, setEditAmount] = useState("0");
  const [editInterest, setEditInterest] = useState("0");
  const [editPenalty, setEditPenalty] = useState("0");
  const [editDiscount, setEditDiscount] = useState("0");
  const [editPaymentMethod, setEditPaymentMethod] = useState("");
  const [editBankAccountId, setEditBankAccountId] = useState("");
  const [editDocumentNumber, setEditDocumentNumber] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Payment form state (Pagamento tab)
  const [payBankAccountId, setPayBankAccountId] = useState("");
  const [payAmount, setPayAmount] = useState("0");
  const [payInterest, setPayInterest] = useState("0");
  const [payPenalty, setPayPenalty] = useState("0");
  const [payDiscount, setPayDiscount] = useState("0");
  const [payDate, setPayDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [payNotes, setPayNotes] = useState("");
  const [payReceiptUrl, setPayReceiptUrl] = useState<string | undefined>();

  // Registration Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2 | 3>(1);

  // Form Fields
  const [description, setDescription] = useState("");
  const [supplier, setSupplier] = useState("");
  const [category, setCategory] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [competenceMonth, setCompetenceMonth] = useState("2026-07");
  const [issueDate, setIssueDate] = useState("2026-07-13");
  const [dueDate, setDueDate] = useState("2026-07-25");
  const [amount, setAmount] = useState<string>("0");
  const [interest, setInterest] = useState<string>("0");
  const [penalty, setPenalty] = useState<string>("0");
  const [discount, setDiscount] = useState<string>("0");
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
  const companyPayables = accountsPayable.filter(
    (ap) => ap.companyId === activeCompany.id,
  );
  const selected = companyPayables.find((ap) => ap.id === selectedId) || null;
  // Baseado no saldo em aberto (não no campo "Valor a pagar") para não compor
  // os juros/multa/desconto a cada clique em "Usar este valor".
  const payFinalTotal =
    (selected ? getRemaining(selected) : 0) +
    (Number(payInterest) || 0) +
    (Number(payPenalty) || 0) -
    (Number(payDiscount) || 0);
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);

  const openPayables = companyPayables.filter(
    (item) => !["Paga", "Cancelada"].includes(item.status),
  );
  const overduePayables = openPayables.filter((item) => item.dueDate < today);
  const dueTodayPayables = openPayables.filter((item) => item.dueDate === today);
  const upcomingPayables = openPayables.filter((item) => item.dueDate > today);
  const paidThisMonthPayments = companyPayables.flatMap((item) =>
    (item.paymentHistory || []).filter((p) => p.date.startsWith(currentMonth)),
  );

  const sumRemaining = (items: AccountPayable[]) =>
    items.reduce((total, item) => total + getRemaining(item), 0);

  const payableMetrics = [
    {
      label: "Em Atraso",
      amount: sumRemaining(overduePayables),
      count: overduePayables.length,
    },
    {
      label: "A vencer hoje",
      amount: sumRemaining(dueTodayPayables),
      count: dueTodayPayables.length,
    },
    {
      label: "A vencer",
      amount: sumRemaining(upcomingPayables),
      count: upcomingPayables.length,
    },
    {
      label: "Aguardando aprovação",
      amount: sumRemaining(
        companyPayables.filter((item) => item.status === "Aguardando aprovação"),
      ),
      count: companyPayables.filter((item) => item.status === "Aguardando aprovação")
        .length,
    },
    {
      label: "Pagos (mês)",
      amount: paidThisMonthPayments.reduce((sum, p) => sum + p.amount, 0),
      count: paidThisMonthPayments.length,
    },
    {
      label: "Total em aberto",
      amount: sumRemaining(openPayables),
      count: openPayables.length,
    },
  ] as const;

  // Filter lists
  const filteredPayables = companyPayables.filter((ap) => {
    const matchesSearch =
      ap.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ap.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ap.documentNumber.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || ap.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: AccountPayable["status"]) => {
    switch (status) {
      case "Rascunho":
        return "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";
      case "Pendente":
      case "A vencer":
        return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/25";
      case "Aguardando aprovação":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25";
      case "Aprovada":
        return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/25";
      case "Agendada":
        return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/25";
      case "Paga":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25";
      case "Parcialmente paga":
        return "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/25";
      case "Vencida":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/25";
      case "Rejeitada":
        return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-500/30";
      case "Cancelada":
        return "bg-zinc-200 text-zinc-800 border-zinc-300 line-through dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700";
      default:
        return "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";
    }
  };

  const canEdit = (ap: AccountPayable) =>
    hasPermission("accounts-payable.update") &&
    !["Paga", "Parcialmente paga", "Cancelada"].includes(ap.status);
  const canPay = (ap: AccountPayable) =>
    hasPermission("reconciliation.execute") &&
    !["Paga", "Cancelada", "Aguardando aprovação"].includes(ap.status);
  const canCancel = (ap: AccountPayable) =>
    hasPermission("accounts-payable.cancel") &&
    !["Paga", "Cancelada"].includes(ap.status) &&
    !(ap.paymentHistory && ap.paymentHistory.length > 0);

  const resetForm = () => {
    setDescription("");
    setSupplier("");
    setCategory("");
    setCostCenter("");
    setCompetenceMonth("2026-07");
    setIssueDate("2026-07-13");
    setDueDate("2026-07-25");
    setAmount("0");
    setInterest("0");
    setPenalty("0");
    setDiscount("0");
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
    if (formStep === 1) {
      if (!description || !supplier || !category || !costCenter) {
        alert("Por favor, preencha todos os campos obrigatórios.");
        return;
      }
      setFormStep(2);
    } else if (formStep === 2) {
      if (Number(amount) <= 0) {
        alert("O valor da conta deve ser maior que zero.");
        return;
      }
      setFormStep(3);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (recurrence === "Parcelada" && Number(installmentCount) < 2) {
      alert("Informe pelo menos 2 parcelas ou escolha outra recorrência.");
      return;
    }
    addAccountPayable({
      description,
      supplier,
      category,
      costCenter,
      competenceMonth,
      issueDate,
      dueDate,
      amount: Number(amount),
      interest: Number(interest),
      penalty: Number(penalty),
      discount: Number(discount),
      paymentMethod,
      bankAccountId: bankAccountId || accounts[0]?.id,
      recurrence,
      installmentCount: recurrence === "Parcelada" ? Number(installmentCount) : undefined,
      documentNumber,
      notes,
      attachmentName: attachmentName || undefined,
      attachmentUrl: attachmentName ? "#" : undefined,
      responsibleId: currentUser.id,
      needsApproval: Number(amount) >= activeCompany.approvalLimit,
    });
    resetForm();
  };

  const closePanel = () => {
    setSelectedId(null);
    setIsEditingInfo(false);
    setPanelTab("info");
    setPanelError("");
  };

  const openPanel = (ap: AccountPayable, tab: PanelTab, editMode = false) => {
    setSelectedId(ap.id);
    setPanelTab(tab);
    setIsEditingInfo(editMode);
    setPanelError("");
    if (editMode) {
      setEditDescription(ap.description);
      setEditSupplier(ap.supplier);
      setEditCategory(ap.category);
      setEditCostCenter(ap.costCenter);
      setEditCompetenceMonth(ap.competenceMonth);
      setEditIssueDate(ap.issueDate);
      setEditDueDate(ap.dueDate);
      setEditAmount(String(ap.amount));
      setEditInterest(String(ap.interest));
      setEditPenalty(String(ap.penalty));
      setEditDiscount(String(ap.discount));
      setEditPaymentMethod(ap.paymentMethod);
      setEditBankAccountId(ap.bankAccountId);
      setEditDocumentNumber(ap.documentNumber);
      setEditNotes(ap.notes);
    }
    if (tab === "payment") {
      const remaining = getRemaining(ap);
      setPayBankAccountId(ap.bankAccountId || accounts[0]?.id || "");
      setPayAmount(remaining.toFixed(2));
      setPayInterest("0");
      setPayPenalty("0");
      setPayDiscount("0");
      setPayDate(new Date().toISOString().slice(0, 10));
      setPayNotes("");
      setPayReceiptUrl(undefined);
    }
  };

  const handleRowClick = (ap: AccountPayable) => {
    if (selectedId === ap.id) {
      closePanel();
    } else {
      openPanel(ap, "info", false);
    }
  };

  const startEditFromPanel = () => {
    if (!selected) return;
    openPanel(selected, "info", true);
  };

  const handleSaveEdit = () => {
    if (!selected) return;
    setPanelError("");
    if (!editDescription || !editSupplier || !editCategory || !editCostCenter) {
      setPanelError("Preencha os campos obrigatórios.");
      return;
    }
    if (Number(editAmount) <= 0) {
      setPanelError("O valor da conta deve ser maior que zero.");
      return;
    }
    const result = updateAccountPayable(selected.id, {
      description: editDescription,
      supplier: editSupplier,
      category: editCategory,
      costCenter: editCostCenter,
      competenceMonth: editCompetenceMonth,
      issueDate: editIssueDate,
      dueDate: editDueDate,
      amount: Number(editAmount),
      interest: Number(editInterest),
      penalty: Number(editPenalty),
      discount: Number(editDiscount),
      paymentMethod: editPaymentMethod,
      bankAccountId: editBankAccountId,
      documentNumber: editDocumentNumber,
      notes: editNotes,
    });
    if (!result.success) {
      setPanelError(result.error || "Não foi possível salvar as alterações.");
      return;
    }
    setIsEditingInfo(false);
  };

  const handleConfirmPayment = () => {
    if (!selected) return;
    setPanelError("");
    if (!payBankAccountId) {
      setPanelError("Selecione o banco que fará o pagamento.");
      return;
    }
    if (!(Number(payAmount) > 0)) {
      setPanelError("Informe um valor de pagamento válido.");
      return;
    }
    const result = payAccountPayable({
      id: selected.id,
      date: payDate,
      bankAccountId: payBankAccountId,
      amount: Number(payAmount),
      interest: Number(payInterest) || 0,
      penalty: Number(payPenalty) || 0,
      discount: Number(payDiscount) || 0,
      notes: payNotes || undefined,
      receiptUrl: payReceiptUrl,
    });
    if (!result.success) {
      setPanelError(result.error || "Não foi possível registrar o pagamento.");
      return;
    }
    setPanelTab("history");
  };

  const handleCancel = (id: string) => {
    if (
      !window.confirm(
        "Deseja realmente cancelar este lançamento? O registro histórico será preservado para auditoria.",
      )
    )
      return;
    const result = cancelAccountPayable(id);
    if (!result.success) {
      alert(result.error || "Não foi possível cancelar este lançamento.");
      return;
    }
    if (selectedId === id) closePanel();
  };

  const handleAttachSimulated = () => {
    if (!selected) return;
    const result = updateAccountPayable(selected.id, {
      attachmentName: "boleto_upload_simulado.pdf",
      attachmentUrl: "#",
    });
    if (!result.success) {
      setPanelError(result.error || "Não foi possível anexar o documento.");
    }
  };

  const dueLabel = (ap: AccountPayable) => {
    const diffDays = Math.round(
      (new Date(ap.dueDate).getTime() - new Date(today).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (["Paga", "Cancelada"].includes(ap.status)) return null;
    if (diffDays < 0)
      return { text: `${Math.abs(diffDays)} dia${Math.abs(diffDays) === 1 ? "" : "s"} vencido`, tone: "text-rose-600 dark:text-rose-400" };
    if (diffDays === 0) return { text: "Vence hoje", tone: "text-amber-600 dark:text-amber-400" };
    return { text: `Vence em ${diffDays} dia${diffDays === 1 ? "" : "s"}`, tone: "text-zinc-500 dark:text-zinc-400" };
  };

  return (
    <div id="accounts-payable-root" className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2
            id="payable-title"
            className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight"
          >
            Contas a Pagar
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">
            Gestão de compromissos, agendamentos, validação de boletos e
            histórico de liquidações.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission("accounts-payable.create") && onNavigate && (
            <button
              onClick={onNavigate}
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-[#091320] hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 px-4 py-2.5 rounded-sm transition-colors cursor-pointer shadow-xs"
            >
              <ChevronRight className="h-4 w-4" />
              Ir para Lançamentos
            </button>
          )}
          {hasPermission("accounts-payable.create") && (
            <button
              onClick={() => setIsFormOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#C8102E] hover:bg-[#8F071B] px-4 py-2.5 rounded-sm transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="h-4 w-4" />
              Nova conta a pagar
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {payableMetrics.map((metric, index) => {
          const visual = AP_METRIC_VISUALS[index];
          const VisualIcon = visual.icon;
          return (
            <div
              key={metric.label}
              className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 p-2.5 flex flex-col gap-2"
            >
              <div
                className={`h-7 w-7 rounded-sm flex items-center justify-center ${visual.tint}`}
              >
                <VisualIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-[9px] text-zinc-500 dark:text-zinc-400 font-semibold uppercase">
                  {metric.label}
                </p>
                <p className="text-base font-semibold mt-0.5 text-zinc-900 dark:text-zinc-50">
                  {formatBRL(metric.amount)}
                </p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  {metric.count} título{metric.count === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid Filtering / Searching */}
      <div className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por Descrição, Fornecedor ou Doc..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 hover:bg-zinc-100/50 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 rounded-sm border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#C8102E] transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/70 px-3 py-1.5 rounded-sm border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-300">
            <Filter className="h-3.5 w-3.5" />
            <select
              className="bg-transparent font-medium focus:outline-none cursor-pointer dark:[color-scheme:dark]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Todos os Status</option>
              <option value="A vencer">A vencer</option>
              <option value="Aguardando aprovação">Aguardando Aprovação</option>
              <option value="Agendada">Agendadas</option>
              <option value="Parcialmente paga">Parcialmente pagas</option>
              <option value="Paga">Pagas</option>
              <option value="Vencida">Vencidas</option>
              <option value="Cancelada">Canceladas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Step-by-Step Step Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-gradient-to-r from-[#0B2C52] to-[#C8102E] text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">
                  Lançar Nova Conta a Pagar
                </h3>
                <p className="text-[10px] text-[#F2D3A0]">
                  Dividido em 3 etapas de verificação operacional para BPO.
                </p>
              </div>
              <button
                onClick={resetForm}
                className="text-[#F2D3A0] hover:text-white font-semibold text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>

            {/* Steps Indicator bar */}
            <div className="flex bg-[#0B2C52] border-b border-[#0B2C52]/20 px-5 py-3.5 text-xs justify-between font-medium">
              <span
                className={`flex items-center gap-1.5 ${formStep >= 1 ? "text-white font-semibold" : "text-white/40"}`}
              >
                <span className="h-5 w-5 rounded bg-[#C8102E] text-white flex items-center justify-center text-[10px] font-semibold">
                  1
                </span>{" "}
                Fornecedor
              </span>
              <span
                className={`flex items-center gap-1.5 ${formStep >= 2 ? "text-white font-semibold" : "text-white/40"}`}
              >
                <span
                  className={`h-5 w-5 rounded flex items-center justify-center text-[10px] font-semibold ${formStep >= 2 ? "bg-[#C8102E] text-white" : "bg-[#061425] text-white/40"}`}
                >
                  2
                </span>{" "}
                Valores
              </span>
              <span
                className={`flex items-center gap-1.5 ${formStep >= 3 ? "text-white font-semibold" : "text-white/40"}`}
              >
                <span
                  className={`h-5 w-5 rounded flex items-center justify-center text-[10px] font-semibold ${formStep >= 3 ? "bg-[#C8102E] text-white" : "bg-[#061425] text-white/40"}`}
                >
                  3
                </span>{" "}
                Liquidação
              </span>
            </div>

            <form
              onSubmit={formStep === 3 ? handleSubmit : handleNextStep}
              className="p-6 space-y-4"
            >
              {/* STEP 1: Fornecedor e Classificação */}
              {formStep === 1 && (
                <div className="space-y-4 animate-in slide-in-from-right-5 duration-150">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                      Descrição da Conta *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Licença mensal Softwares ERP"
                      className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <QuickAddSelect
                    label="Fornecedor / Beneficiário"
                    required
                    value={supplier}
                    onChange={setSupplier}
                    options={masterOptions("SUPPLIER")}
                    onAdd={(name) => addMasterData("SUPPLIER", name)}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <QuickAddSelect
                      label="Categoria de Plano"
                      required
                      value={category}
                      onChange={setCategory}
                      options={masterOptions("CATEGORY")}
                      onAdd={(name) => addMasterData("CATEGORY", name)}
                    />

                    <QuickAddSelect
                      label="Centro de Custo"
                      required
                      value={costCenter}
                      onChange={setCostCenter}
                      options={masterOptions("COST_CENTER")}
                      onAdd={(name) => addMasterData("COST_CENTER", name)}
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: Datas e Valores */}
              {formStep === 2 && (
                <div className="space-y-4 animate-in slide-in-from-right-5 duration-150">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
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
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
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
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                        Data Vencimento *
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
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
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
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                        Desconto (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm focus:outline-none"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                        Juros (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm focus:outline-none"
                        value={interest}
                        onChange={(e) => setInterest(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                        Multa (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm focus:outline-none"
                        value={penalty}
                        onChange={(e) => setPenalty(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Informational Limit warning */}
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800/70 rounded-sm text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                    Previsão de Valor Líquido Final:{" "}
                    <strong className="text-zinc-700 dark:text-zinc-200">
                      {formatBRL(
                        Number(amount) +
                          Number(interest) +
                          Number(penalty) -
                          Number(discount),
                      )}
                    </strong>
                    .<br />
                    {Number(amount) >= activeCompany.approvalLimit && (
                      <span className="text-amber-600 dark:text-amber-400">
                        Este valor atinge ou excede o limite de aprovação (
                        {formatBRL(activeCompany.approvalLimit)}) e exigirá
                        autorização do cliente.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: Conta, Método e Anexo */}
              {formStep === 3 && (
                <div className="space-y-4 animate-in slide-in-from-right-5 duration-150">
                  <div className="grid grid-cols-2 gap-4">
                    <QuickAddSelect
                      label="Método Pagamento"
                      value={paymentMethod}
                      onChange={setPaymentMethod}
                      options={masterOptions("PAYMENT_METHOD")}
                      onAdd={(name) => addMasterData("PAYMENT_METHOD", name)}
                    />

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                        Debitar de Qual Conta *
                      </label>
                      <select
                        required
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm cursor-pointer"
                        value={bankAccountId}
                        onChange={(e) => setBankAccountId(e.target.value)}
                      >
                        {accounts.map((ba) => (
                          <option key={ba.id} value={ba.id}>
                            {ba.bankName} - Saldo {formatBRL(ba.balance)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
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

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                        Número do Documento / NF
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: NF-12042"
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm focus:outline-none"
                        value={documentNumber}
                        onChange={(e) => setDocumentNumber(e.target.value)}
                      />
                    </div>
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
                          {formatBRL(
                            (Number(amount) +
                              Number(interest) +
                              Number(penalty) -
                              Number(discount)) /
                              Number(installmentCount),
                          )}{" "}
                          — 1ª parcela em{" "}
                          {new Date(dueDate).toLocaleDateString("pt-BR")}, as
                          demais nos meses seguintes.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                      Anexar Fatura / Boleto (PDF/Imagem)
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
                          setAttachmentName("boleto_upload_simulado.pdf")
                        }
                        className="text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 p-2 rounded-sm cursor-pointer text-zinc-700 dark:text-zinc-200 font-semibold flex items-center gap-1 shrink-0"
                      >
                        <Paperclip className="h-3.5 w-3.5" /> Simular
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                      Observações adicionais
                    </label>
                    <textarea
                      placeholder="Alguma instrução de pagamento..."
                      rows={2}
                      className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm focus:outline-none"
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
                    onClick={() => setFormStep((prev) => (prev - 1) as any)}
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
                    {formStep === 3 ? "Finalizar Lançamento" : "Próxima Etapa"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main content: table + side panel */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Table */}
        <div className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden flex-1 min-w-0 w-full">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-[#091320]/60 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="p-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Lançamento
                  </th>
                  <th className="p-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Fornecedor
                  </th>
                  <th className="p-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Vencimento
                  </th>
                  <th className="p-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-right">
                    Valor
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
                {filteredPayables.map((ap) => {
                  const isSelected = selectedId === ap.id;
                  const isOverdue =
                    new Date(ap.dueDate) < new Date() &&
                    !["Paga", "Cancelada"].includes(ap.status);
                  const remaining = getRemaining(ap);

                  return (
                    <tr
                      key={ap.id}
                      className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer ${isSelected ? "bg-zinc-50/70 dark:bg-zinc-800/40" : ""}`}
                      onClick={() => handleRowClick(ap)}
                    >
                      <td className="p-4 font-semibold text-zinc-900 dark:text-zinc-50">
                        {ap.description}
                        {ap.installmentCount && (
                          <span className="ml-1.5 text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/25 px-1.5 py-0.5 rounded align-middle">
                            {ap.installmentNumber}/{ap.installmentCount}
                          </span>
                        )}
                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">
                          Nº: {ap.documentNumber || "N/A"} | Cat: {ap.category}
                        </div>
                      </td>
                      <td className="p-4 text-zinc-600 dark:text-zinc-300 font-medium">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-6 w-6 rounded-full ${getAvatarTint(ap.supplier)} text-white text-[9px] font-semibold flex items-center justify-center shrink-0`}
                          >
                            {getInitials(ap.supplier)}
                          </span>
                          {ap.supplier}
                        </div>
                      </td>
                      <td
                        className={`p-4 font-medium ${isOverdue ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-zinc-600 dark:text-zinc-300"}`}
                      >
                        {new Date(ap.dueDate).toLocaleDateString("pt-BR")}
                        {isOverdue && (
                          <span className="text-[9px] bg-rose-50 border border-rose-100 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/25 dark:text-rose-400 px-1.5 py-0.5 rounded ml-2 font-semibold uppercase tracking-wider">
                            Atrasado
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right font-mono">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-50">
                          {formatBRL(ap.finalAmount)}
                        </div>
                        {ap.status === "Parcialmente paga" && (
                          <div className="text-[10px] text-cyan-700 dark:text-cyan-400 font-semibold">
                            Restam {formatBRL(remaining)}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded border ${getStatusBadge(ap.status)}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
                          {ap.status}
                        </span>
                      </td>
                      <td
                        className="p-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          {canPay(ap) && (
                            <button
                              onClick={() => openPanel(ap, "payment")}
                              className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:text-emerald-300 font-semibold px-2 py-1 rounded border border-emerald-200 dark:border-emerald-500/25 cursor-pointer flex items-center gap-1"
                              title="Registrar pagamento (baixa)"
                            >
                              <Check className="h-3 w-3" /> Pagar
                            </button>
                          )}
                          {canEdit(ap) && (
                            <button
                              onClick={() => openPanel(ap, "info", true)}
                              className="text-[10px] bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:hover:bg-sky-500/20 dark:text-sky-300 font-semibold px-2 py-1 rounded border border-sky-200 dark:border-sky-500/25 cursor-pointer flex items-center gap-1"
                              title="Editar lançamento"
                            >
                              <Pencil className="h-3 w-3" /> Editar
                            </button>
                          )}
                          {canCancel(ap) && (
                            <button
                              onClick={() => handleCancel(ap.id)}
                              className="text-[10px] bg-zinc-50 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 font-semibold px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 cursor-pointer flex items-center gap-1"
                              title="Cancelar Registro"
                            >
                              <Ban className="h-3 w-3" /> Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredPayables.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-8 text-center text-zinc-400 dark:text-zinc-500 italic"
                    >
                      Nenhuma conta a pagar encontrada correspondente aos termos
                      de busca.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side panel */}
        {selected && (
          <div className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs w-full lg:w-[380px] shrink-0 lg:sticky lg:top-4 overflow-hidden">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                Detalhes do título
              </h3>
              <button
                onClick={closePanel}
                className="p-1 rounded-sm text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-1 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded border ${getStatusBadge(selected.status)}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
                  {selected.status}
                </span>
                {dueLabel(selected) && (
                  <span className={`text-[10px] font-semibold ${dueLabel(selected)!.tone}`}>
                    {dueLabel(selected)!.text}
                  </span>
                )}
              </div>
              <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {formatBRL(
                  selected.status === "Parcialmente paga"
                    ? getRemaining(selected)
                    : selected.finalAmount,
                )}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold">
                {selected.supplier}
              </p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-100 dark:border-zinc-800 text-[11px] font-semibold">
              {(
                [
                  { id: "info", label: "Informações", icon: Info },
                  { id: "payment", label: "Pagamento", icon: Landmark },
                  { id: "attachments", label: "Anexos", icon: Paperclip },
                  { id: "history", label: "Histórico", icon: History },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setPanelTab(tab.id);
                    setPanelError("");
                    if (tab.id !== "info") setIsEditingInfo(false);
                    if (tab.id === "payment") openPanel(selected, "payment");
                  }}
                  className={`flex-1 flex items-center justify-center gap-1 py-2.5 border-b-2 cursor-pointer transition-colors ${
                    panelTab === tab.id
                      ? "border-[#0B2C52] dark:border-[#9DB8D9] text-[#0B2C52] dark:text-[#9DB8D9]"
                      : "border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" /> {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4 space-y-3 text-xs max-h-[60vh] overflow-y-auto">
              {panelError && (
                <div className="flex items-start gap-2 text-xs text-[#C8102E] bg-[#C8102E]/5 dark:bg-[#C8102E]/10 border border-[#C8102E]/20 dark:border-[#C8102E]/30 rounded-sm p-3">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {panelError}
                </div>
              )}

              {/* INFORMAÇÕES */}
              {panelTab === "info" && !isEditingInfo && (
                <div className="space-y-3">
                  <div className="bg-zinc-50 dark:bg-zinc-800/70 rounded-sm border border-zinc-200/70 dark:border-zinc-700 divide-y divide-zinc-200/70 dark:divide-zinc-700">
                    {[
                      ["Fornecedor", selected.supplier],
                      ["Nº Documento", selected.documentNumber || "N/A"],
                      ["Descrição", selected.description],
                      ...(selected.installmentCount
                        ? ([["Parcela", `${selected.installmentNumber} de ${selected.installmentCount}`]] as [string, string][])
                        : []),
                      ["Vencimento", new Date(selected.dueDate).toLocaleDateString("pt-BR")],
                      ["Emissão", new Date(selected.issueDate).toLocaleDateString("pt-BR")],
                      ["Categoria", selected.category],
                      ["Centro de Custo", selected.costCenter],
                      ["Forma de Pagamento", selected.paymentMethod],
                      ["Valor Original", formatBRL(selected.amount)],
                      ["Acréscimos", formatBRL(selected.interest + selected.penalty)],
                      ["Descontos", formatBRL(selected.discount)],
                      ["Valor Total", formatBRL(selected.finalAmount)],
                      ...(selected.paidAmount
                        ? ([["Valor Pago", formatBRL(selected.paidAmount)], ["Saldo em aberto", formatBRL(getRemaining(selected))]] as [string, string][])
                        : []),
                      ["Observação", selected.notes || "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between px-3 py-2">
                        <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-right">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {canPay(selected) && (
                      <button
                        onClick={() => {
                          setPanelTab("payment");
                          openPanel(selected, "payment");
                        }}
                        className="w-full text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-[#091320] hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 py-2.5 rounded-sm cursor-pointer"
                      >
                        Marcar como pago
                      </button>
                    )}
                    {selected.status === "A vencer" && (
                      <button
                        onClick={() => scheduleAccountPayable(selected.id)}
                        className="w-full text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/25 py-2.5 rounded-sm cursor-pointer"
                      >
                        Agendar pagamento
                      </button>
                    )}
                    {canEdit(selected) && (
                      <button
                        onClick={startEditFromPanel}
                        className="w-full text-xs font-semibold bg-[#0B2C52] hover:bg-[#0B2C52]/90 text-white py-2.5 rounded-sm cursor-pointer"
                      >
                        Editar título
                      </button>
                    )}
                  </div>
                </div>
              )}

              {panelTab === "info" && isEditingInfo && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">Descrição *</label>
                    <input
                      type="text"
                      className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm focus:outline-none"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                  </div>
                  <QuickAddSelect
                    label="Fornecedor"
                    required
                    value={editSupplier}
                    onChange={setEditSupplier}
                    options={masterOptions("SUPPLIER")}
                    onAdd={(name) => addMasterData("SUPPLIER", name)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <QuickAddSelect
                      label="Categoria"
                      required
                      value={editCategory}
                      onChange={setEditCategory}
                      options={masterOptions("CATEGORY")}
                      onAdd={(name) => addMasterData("CATEGORY", name)}
                    />
                    <QuickAddSelect
                      label="Centro de Custo"
                      required
                      value={editCostCenter}
                      onChange={setEditCostCenter}
                      options={masterOptions("COST_CENTER")}
                      onAdd={(name) => addMasterData("COST_CENTER", name)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">Emissão</label>
                      <input
                        type="date"
                        className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm"
                        value={editIssueDate}
                        onChange={(e) => setEditIssueDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">Vencimento *</label>
                      <input
                        type="date"
                        className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">Valor (R$) *</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">Desconto (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm"
                        value={editDiscount}
                        onChange={(e) => setEditDiscount(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">Juros (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm"
                        value={editInterest}
                        onChange={(e) => setEditInterest(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">Multa (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm"
                        value={editPenalty}
                        onChange={(e) => setEditPenalty(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">Conta bancária de origem</label>
                    <select
                      className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm cursor-pointer"
                      value={editBankAccountId}
                      onChange={(e) => setEditBankAccountId(e.target.value)}
                    >
                      {accounts.map((ba) => (
                        <option key={ba.id} value={ba.id}>{ba.bankName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">Nº Documento</label>
                    <input
                      type="text"
                      className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm"
                      value={editDocumentNumber}
                      onChange={(e) => setEditDocumentNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">Observação</label>
                    <textarea
                      rows={2}
                      className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditingInfo(false)}
                      className="text-zinc-500 dark:text-zinc-400 font-semibold px-3 py-2 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="bg-[#C8102E] hover:bg-[#8F071B] text-white font-semibold px-4 py-2 rounded-sm cursor-pointer"
                    >
                      Salvar alterações
                    </button>
                  </div>
                </div>
              )}

              {/* PAGAMENTO */}
              {panelTab === "payment" && (
                <div className="space-y-3">
                  {["Paga", "Cancelada"].includes(selected.status) ? (
                    <p className="text-zinc-400 dark:text-zinc-500 italic py-6 text-center">
                      {selected.status === "Paga"
                        ? "Este título já está totalmente pago."
                        : "Este título foi cancelado e não pode receber pagamentos."}
                    </p>
                  ) : (
                    <>
                      <div className="bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 rounded-sm p-3 flex items-center justify-between">
                        <span className="text-zinc-500 dark:text-zinc-400 font-semibold">Saldo em aberto</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-50">{formatBRL(getRemaining(selected))}</span>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">Banco de origem *</label>
                        <select
                          className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm cursor-pointer"
                          value={payBankAccountId}
                          onChange={(e) => setPayBankAccountId(e.target.value)}
                        >
                          <option value="">Selecione...</option>
                          {accounts.map((ba) => (
                            <option key={ba.id} value={ba.id}>
                              {ba.bankName} - Saldo {formatBRL(ba.balance)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">Valor a pagar (R$) *</label>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm"
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                        />
                        {Number(payAmount) > 0 && Number(payAmount) < getRemaining(selected) && (
                          <p className="text-[10px] text-cyan-700 dark:text-cyan-400 font-semibold">
                            Pagamento parcial
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">Juros (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm"
                            value={payInterest}
                            onChange={(e) => setPayInterest(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">Multa (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm"
                            value={payPenalty}
                            onChange={(e) => setPayPenalty(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">Desconto (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm"
                            value={payDiscount}
                            onChange={(e) => setPayDiscount(e.target.value)}
                          />
                        </div>
                      </div>

                      {(Number(payInterest) > 0 || Number(payPenalty) > 0 || Number(payDiscount) > 0) && (
                        <div className="bg-[#0B2C52]/5 dark:bg-[#123B6B]/20 border border-[#0B2C52]/20 dark:border-[#3E6DA6]/40 rounded-sm p-3 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-semibold text-[#0B2C52] dark:text-[#9DB8D9] uppercase block">
                              Valor final (com juros/multa/desconto)
                            </span>
                            <span className="text-lg font-semibold text-[#0B2C52] dark:text-[#9DB8D9]">
                              {formatBRL(payFinalTotal)}
                            </span>
                          </div>
                          {Number(payAmount) !== payFinalTotal && (
                            <button
                              type="button"
                              onClick={() => setPayAmount(payFinalTotal.toFixed(2))}
                              className="text-[10px] font-semibold text-[#0B2C52] dark:text-[#9DB8D9] hover:underline cursor-pointer shrink-0"
                            >
                              Usar este valor
                            </button>
                          )}
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">Data do pagamento</label>
                        <input
                          type="date"
                          className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm"
                          value={payDate}
                          onChange={(e) => setPayDate(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">Comprovante</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Nenhum comprovante anexado"
                            readOnly
                            className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 rounded-sm text-zinc-500 dark:text-zinc-400"
                            value={payReceiptUrl ? "comprovante_upload_simulado.pdf" : ""}
                          />
                          <button
                            type="button"
                            onClick={() => setPayReceiptUrl("#")}
                            className="text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 p-2 rounded-sm cursor-pointer text-zinc-700 dark:text-zinc-200 font-semibold flex items-center gap-1 shrink-0"
                          >
                            <Paperclip className="h-3.5 w-3.5" /> Simular
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">Observação</label>
                        <textarea
                          rows={2}
                          className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm"
                          value={payNotes}
                          onChange={(e) => setPayNotes(e.target.value)}
                        />
                      </div>

                      <button
                        onClick={handleConfirmPayment}
                        className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-sm cursor-pointer"
                      >
                        <CheckCircle className="h-4 w-4" /> Confirmar pagamento
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* ANEXOS */}
              {panelTab === "attachments" && (
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase block mb-1">Anexo do título</span>
                    {selected.attachmentName ? (
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          alert("Abrindo documento com token seguro assinado por S3...");
                        }}
                        className="font-semibold text-zinc-900 dark:text-zinc-100 hover:underline flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 rounded-sm p-3"
                      >
                        <Paperclip className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                        {selected.attachmentName}
                        <ExternalLink className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
                      </a>
                    ) : (
                      <p className="text-zinc-400 dark:text-zinc-500 italic bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 rounded-sm p-3">
                        Nenhum anexo enviado.
                      </p>
                    )}
                    {canEdit(selected) && (
                      <button
                        onClick={handleAttachSimulated}
                        className="mt-2 text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 px-3 py-2 rounded-sm cursor-pointer text-zinc-700 dark:text-zinc-200 font-semibold flex items-center gap-1.5"
                      >
                        <Paperclip className="h-3.5 w-3.5" /> Substituir anexo (simular)
                      </button>
                    )}
                  </div>

                  {(selected.paymentHistory || []).some((p) => p.receiptUrl) && (
                    <div>
                      <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase block mb-1">Comprovantes de pagamento</span>
                      <div className="space-y-1.5">
                        {(selected.paymentHistory || [])
                          .filter((p) => p.receiptUrl)
                          .map((p) => (
                            <a
                              key={p.id}
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                alert("Abrindo comprovante com token seguro assinado por S3...");
                              }}
                              className="font-semibold text-zinc-800 dark:text-zinc-200 hover:underline flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 rounded-sm p-2.5"
                            >
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                              Comprovante de {new Date(p.date).toLocaleDateString("pt-BR")} — {formatBRL(p.amount)}
                            </a>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* HISTÓRICO */}
              {panelTab === "history" && (
                <div className="space-y-2">
                  {(selected.paymentHistory || []).length === 0 ? (
                    <p className="text-zinc-400 dark:text-zinc-500 italic py-6 text-center">
                      Nenhum pagamento registrado ainda.
                    </p>
                  ) : (
                    [...(selected.paymentHistory || [])]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((p) => (
                        <div key={p.id} className="bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 rounded-sm p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-zinc-900 dark:text-zinc-50">{formatBRL(p.amount)}</span>
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                              {new Date(p.date).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                            <Landmark className="h-3 w-3" /> {p.bankAccountName}
                          </div>
                          {(p.interest > 0 || p.penalty > 0 || p.discount > 0) && (
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                              {p.interest > 0 && <>Juros: {formatBRL(p.interest)} · </>}
                              {p.penalty > 0 && <>Multa: {formatBRL(p.penalty)} · </>}
                              {p.discount > 0 && <>Desconto: {formatBRL(p.discount)}</>}
                            </div>
                          )}
                          {p.notes && (
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 italic">"{p.notes}"</p>
                          )}
                          <div className="text-[9px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1 pt-1 border-t border-zinc-200/70 dark:border-zinc-700">
                            <Clock className="h-3 w-3" /> Registrado por {p.registeredByName}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
