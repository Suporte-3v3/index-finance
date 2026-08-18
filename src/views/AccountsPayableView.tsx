/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import { AccountPayable, MasterDataType } from "../types";
import QuickAddSelect from "../components/QuickAddSelect";
import CurrencyInput from "../components/CurrencyInput";
import { formatDate } from "../services/dateFormatters";
import {
  Button,
  Card,
  MetricCard,
  SearchField,
  StatusBadge,
  ConfirmDialog,
  BrazilianDateInput,
  BrazilianMonthInput,
  useToast,
} from "../components/ui";
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
  Trash2,
} from "lucide-react";

const formatBRL = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const getRemaining = (ap: AccountPayable) =>
  Math.max(ap.finalAmount - (ap.paidAmount || 0), 0);

type PanelTab = "info" | "payment" | "attachments" | "history";

const AP_METRIC_VISUALS = [
  { icon: AlertTriangle, tone: "red" },
  { icon: CalendarClock, tone: "gold" },
  { icon: Clock, tone: "navy" },
  { icon: Hourglass, tone: "navy" },
  { icon: CheckCircle, tone: "green" },
  { icon: Wallet, tone: "navy" },
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
  const { showToast } = useToast();
  const {
    activeCompany,
    bankAccounts,
    accountsPayable,
    addAccountPayable,
    updateAccountPayable,
    payAccountPayable,
    scheduleAccountPayable,
    cancelAccountPayable,
    deleteAccountPayables,
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
  const subCategoryOptions = (categoryName: string) => {
    const parent = masterOptions("CATEGORY").find((item) => item.name === categoryName);
    if (!parent) return [];
    return masterOptions("SUBCATEGORY").filter((item) => item.parentId === parent.id);
  };

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
  const [editSubCategory, setEditSubCategory] = useState("");
  const [editCostCenter, setEditCostCenter] = useState("");
  const [editCompetenceMonth, setEditCompetenceMonth] = useState("");
  const [editIssueDate, setEditIssueDate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editAmount, setEditAmount] = useState(0);
  const [editInterest, setEditInterest] = useState(0);
  const [editPenalty, setEditPenalty] = useState(0);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editPaymentMethod, setEditPaymentMethod] = useState("");
  const [editBankAccountId, setEditBankAccountId] = useState("");
  const [editDocumentNumber, setEditDocumentNumber] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Payment form state (Pagamento tab)
  const [payBankAccountId, setPayBankAccountId] = useState("");
  const [payAmount, setPayAmount] = useState(0);
  const [payInterest, setPayInterest] = useState(0);
  const [payPenalty, setPayPenalty] = useState(0);
  const [payDiscount, setPayDiscount] = useState(0);
  const [payDate, setPayDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [payNotes, setPayNotes] = useState("");
  const [payReceiptUrl, setPayReceiptUrl] = useState<string | undefined>();

  // Registration Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2 | 3>(1);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    if (!isFormOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFormOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isFormOpen]);

  // Form Fields
  const [description, setDescription] = useState("");
  const [supplier, setSupplier] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [competenceMonth, setCompetenceMonth] = useState("2026-07");
  const [issueDate, setIssueDate] = useState("2026-07-13");
  const [dueDate, setDueDate] = useState("2026-07-25");
  const [amount, setAmount] = useState(0);
  const [interest, setInterest] = useState(0);
  const [penalty, setPenalty] = useState(0);
  const [discount, setDiscount] = useState(0);
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
  const canBulkDelete = hasPermission("accounts-payable.cancel");
  const deletablePayables = canBulkDelete
    ? filteredPayables.filter((item) => !(item.paymentHistory && item.paymentHistory.length > 0))
    : [];
  const selectedPayables = deletablePayables.filter((item) => selectedIds.has(item.id));
  const allDeletableSelected =
    deletablePayables.length > 0 && deletablePayables.every((item) => selectedIds.has(item.id));

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
    setSubCategory("");
    setCostCenter("");
    setCompetenceMonth("2026-07");
    setIssueDate("2026-07-13");
    setDueDate("2026-07-25");
    setAmount(0);
    setInterest(0);
    setPenalty(0);
    setDiscount(0);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recurrence === "Parcelada" && Number(installmentCount) < 2) {
      alert("Informe pelo menos 2 parcelas ou escolha outra recorrência.");
      return;
    }
    const result = await addAccountPayable({
      description,
      supplier,
      category,
      subCategory: subCategory || undefined,
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
    if (!result.success) {
      alert(result.error || "Não foi possível cadastrar a conta a pagar.");
      return;
    }
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
      setEditSubCategory(ap.subCategory || "");
      setEditCostCenter(ap.costCenter);
      setEditCompetenceMonth(ap.competenceMonth);
      setEditIssueDate(ap.issueDate);
      setEditDueDate(ap.dueDate);
      setEditAmount(ap.amount);
      setEditInterest(ap.interest);
      setEditPenalty(ap.penalty);
      setEditDiscount(ap.discount);
      setEditPaymentMethod(ap.paymentMethod);
      setEditBankAccountId(ap.bankAccountId);
      setEditDocumentNumber(ap.documentNumber);
      setEditNotes(ap.notes);
    }
    if (tab === "payment") {
      const remaining = getRemaining(ap);
      setPayBankAccountId(ap.bankAccountId || accounts[0]?.id || "");
      setPayAmount(remaining);
      setPayInterest(0);
      setPayPenalty(0);
      setPayDiscount(0);
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

  const handleSaveEdit = async () => {
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
    const result = await updateAccountPayable(selected.id, {
      description: editDescription,
      supplier: editSupplier,
      category: editCategory,
      subCategory: editSubCategory || undefined,
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

  const handleConfirmPayment = async () => {
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
    const result = await payAccountPayable({
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
    setCancelTargetId(id);
  };

  const confirmCancel = async () => {
    if (!cancelTargetId) return;
    const id = cancelTargetId;
    setCancelTargetId(null);
    const result = await cancelAccountPayable(id);
    if (!result.success) {
      alert(result.error || "Não foi possível cancelar este lançamento.");
      return;
    }
    if (selectedId === id) closePanel();
  };

  const toggleBulkSelection = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllDeletable = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      deletablePayables.forEach((item) =>
        allDeletableSelected ? next.delete(item.id) : next.add(item.id),
      );
      return next;
    });
  };

  const confirmBulkDelete = async () => {
    if (!selectedPayables.length) return;
    setBulkDeleting(true);
    const ids = selectedPayables.map((item) => item.id);
    const result = await deleteAccountPayables(ids);
    setBulkDeleting(false);
    if (!result.success) {
      showToast("error", "Não foi possível excluir as contas a pagar.", result.error);
      return;
    }
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    if (selectedId && ids.includes(selectedId)) closePanel();
    showToast("success", `${ids.length} conta(s) a pagar excluída(s).`, "Os lançamentos vinculados também foram removidos.");
  };

  const handleAttachSimulated = async () => {
    if (!selected) return;
    const result = await updateAccountPayable(selected.id, {
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
    return { text: `Vence em ${diffDays} dia${diffDays === 1 ? "" : "s"}`, tone: "text-ink-soft dark:text-ink-soft-dark" };
  };

  return (
    <div id="accounts-payable-root" className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2
            id="payable-title"
            className="text-xl font-semibold text-ink dark:text-ink-dark tracking-tight"
          >
            Contas a Pagar
          </h2>
          <p className="text-ink-soft dark:text-ink-soft-dark text-xs">
            Gestão de compromissos, agendamentos, validação de boletos e
            histórico de liquidações.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission("accounts-payable.create") && onNavigate && (
            <Button variant="outline" icon={<ChevronRight className="h-4 w-4" />} onClick={onNavigate}>
              Ir para Lançamentos
            </Button>
          )}
          {hasPermission("accounts-payable.create") && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setIsFormOpen(true)}>
              Nova conta a pagar
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {payableMetrics.map((metric, index) => {
          const visual = AP_METRIC_VISUALS[index];
          return (
            <MetricCard
              key={metric.label}
              icon={<visual.icon strokeWidth={2.25} />}
              label={metric.label}
              value={formatBRL(metric.amount)}
              helpText={`${metric.count} título${metric.count === 1 ? "" : "s"}`}
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
          placeholder="Buscar por Descrição, Fornecedor ou Doc..."
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
      </Card>

      {selectedPayables.length > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-brand-red-600/25">
          <p className="text-xs font-semibold text-ink dark:text-ink-dark">
            {selectedPayables.length} conta(s) selecionada(s)
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="text" onClick={() => setSelectedIds(new Set())}>
              Limpar seleção
            </Button>
            <Button
              size="sm"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={() => setBulkDeleteOpen(true)}
            >
              Excluir selecionadas
            </Button>
          </div>
        </Card>
      )}

      {/* Step-by-Step Step Form Modal */}
      {isFormOpen && (
        <div
          className="fixed inset-0 bg-brand-navy-950/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={resetForm}
        >
          <div
            className="bg-surface dark:bg-surface-dark rounded-2xl border border-line dark:border-line-dark shadow-2xl max-w-xl w-full overflow-hidden motion-safe:animate-[modalIn_180ms_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-line dark:border-line-dark bg-brand-navy-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">
                  Lançar Nova Conta a Pagar
                </h3>
                <p className="text-[10px] text-brand-gold-300">
                  Dividido em 3 etapas de verificação operacional para BPO.
                </p>
              </div>
              <button
                onClick={resetForm}
                className="text-brand-gold-300 hover:text-white font-semibold text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>

            {/* Steps Indicator bar */}
            <div className="flex bg-brand-navy-900 border-b border-brand-navy-900/20 px-5 py-3.5 text-xs justify-between font-medium">
              <span
                className={`flex items-center gap-1.5 ${formStep >= 1 ? "text-white font-semibold" : "text-white/40"}`}
              >
                <span className="h-5 w-5 rounded bg-brand-red-600 text-white flex items-center justify-center text-[10px] font-semibold">
                  1
                </span>{" "}
                Fornecedor
              </span>
              <span
                className={`flex items-center gap-1.5 ${formStep >= 2 ? "text-white font-semibold" : "text-white/40"}`}
              >
                <span
                  className={`h-5 w-5 rounded flex items-center justify-center text-[10px] font-semibold ${formStep >= 2 ? "bg-brand-red-600 text-white" : "bg-brand-navy-950 text-white/40"}`}
                >
                  2
                </span>{" "}
                Valores
              </span>
              <span
                className={`flex items-center gap-1.5 ${formStep >= 3 ? "text-white font-semibold" : "text-white/40"}`}
              >
                <span
                  className={`h-5 w-5 rounded flex items-center justify-center text-[10px] font-semibold ${formStep >= 3 ? "bg-brand-red-600 text-white" : "bg-brand-navy-950 text-white/40"}`}
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
                    <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">
                      Descrição da Conta *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Licença mensal Softwares ERP"
                      className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-red-600"
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
                      onChange={(value) => {
                        setCategory(value);
                        setSubCategory("");
                      }}
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

                  <QuickAddSelect
                    label="Subcategoria"
                    value={subCategory}
                    onChange={setSubCategory}
                    options={subCategoryOptions(category)}
                    onAdd={(name) =>
                      addMasterData(
                        "SUBCATEGORY",
                        name,
                        masterOptions("CATEGORY").find((item) => item.name === category)?.id,
                      )
                    }
                    canAdd={Boolean(category)}
                    placeholder={category ? "Selecione..." : "Escolha uma categoria primeiro"}
                  />
                </div>
              )}

              {/* STEP 2: Datas e Valores */}
              {formStep === 2 && (
                <div className="space-y-4 animate-in slide-in-from-right-5 duration-150">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">
                        Mês Competência
                      </label>
                      <BrazilianMonthInput
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg"
                        value={competenceMonth}
                        onValueChange={setCompetenceMonth}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">
                        Data Emissão
                      </label>
                      <BrazilianDateInput
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg"
                        value={issueDate}
                        onValueChange={setIssueDate}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">
                        Data Vencimento *
                      </label>
                      <BrazilianDateInput
                        required
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg"
                        value={dueDate}
                        onValueChange={setDueDate}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">
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
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">
                        Desconto (R$)
                      </label>
                      <CurrencyInput
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg focus:outline-none"
                        value={discount}
                        onChange={setDiscount}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">
                        Juros (R$)
                      </label>
                      <CurrencyInput
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg focus:outline-none"
                        value={interest}
                        onChange={setInterest}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">
                        Multa (R$)
                      </label>
                      <CurrencyInput
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg focus:outline-none"
                        value={penalty}
                        onChange={setPenalty}
                      />
                    </div>
                  </div>

                  {/* Informational Limit warning */}
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800/70 rounded-lg text-[10px] text-ink-soft dark:text-ink-soft-dark font-medium">
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
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">
                        Debitar de Qual Conta *
                      </label>
                      <select
                        required
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg cursor-pointer"
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
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">
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

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">
                        Número do Documento / NF
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: NF-12042"
                        className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg focus:outline-none"
                        value={documentNumber}
                        onChange={(e) => setDocumentNumber(e.target.value)}
                      />
                    </div>
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
                          {formatBRL(
                            (Number(amount) +
                              Number(interest) +
                              Number(penalty) -
                              Number(discount)) /
                              Number(installmentCount),
                          )}{" "}
                          — 1ª parcela em{" "}
                          {formatDate(dueDate)}, as
                          demais nos meses seguintes.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">
                      Anexar Fatura / Boleto (PDF/Imagem)
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
                          setAttachmentName("boleto_upload_simulado.pdf")
                        }
                        className="text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-line dark:border-line-dark p-2 rounded-lg cursor-pointer text-zinc-700 dark:text-zinc-200 font-semibold flex items-center gap-1 shrink-0"
                      >
                        <Paperclip className="h-3.5 w-3.5" /> Simular
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">
                      Observações adicionais
                    </label>
                    <textarea
                      placeholder="Alguma instrução de pagamento..."
                      rows={2}
                      className="w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg focus:outline-none"
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
                    onClick={() => setFormStep((prev) => (prev - 1) as any)}
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
        <div className="bg-surface dark:bg-surface-dark rounded-lg border border-line dark:border-line-dark shadow-xs overflow-hidden flex-1 min-w-0 w-full">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-surface-dark/60 border-b border-line dark:border-line-dark">
                  <th className="p-4 w-10">
                    <button
                      type="button"
                      disabled={!canBulkDelete}
                      onClick={toggleAllDeletable}
                      title={canBulkDelete ? "Selecionar contas sem pagamentos registrados" : "Sem permissão para excluir contas"}
                      className={`h-4 w-4 rounded border ${canBulkDelete ? "cursor-pointer" : "cursor-not-allowed opacity-50"} ${allDeletableSelected ? "bg-brand-navy-900 border-brand-navy-900" : "bg-surface dark:bg-surface-dark border-line dark:border-line-dark"}`}
                    >
                      {allDeletableSelected && <Check className="h-3.5 w-3.5 text-white" />}
                    </button>
                  </th>
                  <th className="p-4 text-xs font-semibold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider">
                    Lançamento
                  </th>
                  <th className="p-4 text-xs font-semibold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider">
                    Fornecedor
                  </th>
                  <th className="p-4 text-xs font-semibold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider">
                    Vencimento
                  </th>
                  <th className="p-4 text-xs font-semibold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider text-right">
                    Valor
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
                      <td className="p-4" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          disabled={!canBulkDelete || Boolean(ap.paymentHistory?.length)}
                          title={!canBulkDelete ? "Sem permissão para excluir contas" : ap.paymentHistory?.length ? "Conta com pagamento registrado não pode ser excluída" : "Selecionar conta"}
                          onClick={() => toggleBulkSelection(ap.id)}
                          className={`h-4 w-4 rounded border ${!canBulkDelete || ap.paymentHistory?.length ? "cursor-not-allowed bg-canvas opacity-50 dark:bg-white/5" : "cursor-pointer"} ${selectedIds.has(ap.id) ? "bg-brand-navy-900 border-brand-navy-900" : "bg-surface dark:bg-surface-dark border-line dark:border-line-dark"}`}
                        >
                          {selectedIds.has(ap.id) && <Check className="h-3.5 w-3.5 text-white" />}
                        </button>
                      </td>
                      <td className="p-4 font-semibold text-ink dark:text-ink-dark">
                        {ap.description}
                        {ap.installmentCount && (
                          <span className="ml-1.5 text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/25 px-1.5 py-0.5 rounded align-middle">
                            {ap.installmentNumber}/{ap.installmentCount}
                          </span>
                        )}
                        <div className="text-[10px] text-ink-soft dark:text-ink-soft-dark font-normal">
                          Nº: {ap.documentNumber || "N/A"} | Cat: {ap.category}
                          {ap.subCategory ? ` / ${ap.subCategory}` : ""}
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
                        {formatDate(ap.dueDate)}
                        {isOverdue && (
                          <span className="text-[9px] bg-rose-50 border border-rose-100 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/25 dark:text-rose-400 px-1.5 py-0.5 rounded ml-2 font-semibold uppercase tracking-wider">
                            Atrasado
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right font-mono">
                        <div className="font-semibold text-ink dark:text-ink-dark">
                          {formatBRL(ap.finalAmount)}
                        </div>
                        {ap.status === "Parcialmente paga" && (
                          <div className="text-[10px] text-cyan-700 dark:text-cyan-400 font-semibold">
                            Restam {formatBRL(remaining)}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <StatusBadge status={ap.status} />
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
                              className="text-[10px] bg-zinc-50 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 font-semibold px-2 py-1 rounded border border-line dark:border-line-dark cursor-pointer flex items-center gap-1"
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
                      colSpan={7}
                      className="p-8 text-center text-ink-soft dark:text-ink-soft-dark italic"
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
          <div className="bg-surface dark:bg-surface-dark rounded-lg border border-line dark:border-line-dark shadow-xs w-full lg:w-[380px] shrink-0 lg:sticky lg:top-4 overflow-hidden">
            <div className="p-4 border-b border-line dark:border-line-dark flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                Detalhes do título
              </h3>
              <button
                onClick={closePanel}
                className="p-1 rounded-lg text-ink-soft dark:text-ink-soft-dark hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-1 border-b border-line dark:border-line-dark">
              <div className="flex items-center justify-between">
                <StatusBadge status={selected.status} />
                {dueLabel(selected) && (
                  <span className={`text-[10px] font-semibold ${dueLabel(selected)!.tone}`}>
                    {dueLabel(selected)!.text}
                  </span>
                )}
              </div>
              <p className="text-xl font-semibold text-ink dark:text-ink-dark">
                {formatBRL(
                  selected.status === "Parcialmente paga"
                    ? getRemaining(selected)
                    : selected.finalAmount,
                )}
              </p>
              <p className="text-xs text-ink-soft dark:text-ink-soft-dark font-semibold">
                {selected.supplier}
              </p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-line dark:border-line-dark text-[11px] font-semibold">
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
                      ? "border-brand-navy-900 dark:border-blue-200 text-brand-navy-900 dark:text-blue-200"
                      : "border-transparent text-ink-soft dark:text-ink-soft-dark hover:text-zinc-600 dark:hover:text-zinc-300"
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" /> {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4 space-y-3 text-xs max-h-[60vh] overflow-y-auto">
              {panelError && (
                <div className="flex items-start gap-2 text-xs text-brand-red-600 bg-brand-red-600/5 dark:bg-brand-red-600/10 border border-brand-red-600/20 dark:border-brand-red-600/30 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {panelError}
                </div>
              )}

              {/* INFORMAÇÕES */}
              {panelTab === "info" && !isEditingInfo && (
                <div className="space-y-3">
                  <div className="bg-zinc-50 dark:bg-zinc-800/70 rounded-lg border border-zinc-200/70 dark:border-zinc-700 divide-y divide-zinc-200/70 dark:divide-zinc-700">
                    {[
                      ["Fornecedor", selected.supplier],
                      ["Nº Documento", selected.documentNumber || "N/A"],
                      ["Descrição", selected.description],
                      ...(selected.installmentCount
                        ? ([["Parcela", `${selected.installmentNumber} de ${selected.installmentCount}`]] as [string, string][])
                        : []),
                      ["Vencimento", formatDate(selected.dueDate)],
                      ["Emissão", formatDate(selected.issueDate)],
                      ["Categoria", selected.category],
                      ...(selected.subCategory
                        ? ([["Subcategoria", selected.subCategory]] as [string, string][])
                        : []),
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
                        <span className="text-ink-soft dark:text-ink-soft-dark">{label}</span>
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
                        className="w-full text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-surface dark:bg-surface-dark hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-line dark:border-line-dark py-2.5 rounded-lg cursor-pointer"
                      >
                        Marcar como pago
                      </button>
                    )}
                    {selected.status === "A vencer" && (
                      <button
                        onClick={() => void scheduleAccountPayable(selected.id).then((result) => {
                          if (!result.success) setPanelError(result.error || "Não foi possível agendar o pagamento.");
                        })}
                        className="w-full text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/25 py-2.5 rounded-lg cursor-pointer"
                      >
                        Agendar pagamento
                      </button>
                    )}
                    {canEdit(selected) && (
                      <button
                        onClick={startEditFromPanel}
                        className="w-full text-xs font-semibold bg-brand-navy-900 hover:bg-brand-navy-900/90 text-white py-2.5 rounded-lg cursor-pointer"
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
                    <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">Descrição *</label>
                    <input
                      type="text"
                      className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg focus:outline-none"
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
                      onChange={(value) => {
                        setEditCategory(value);
                        setEditSubCategory("");
                      }}
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
                  <QuickAddSelect
                    label="Subcategoria"
                    value={editSubCategory}
                    onChange={setEditSubCategory}
                    options={subCategoryOptions(editCategory)}
                    onAdd={(name) =>
                      addMasterData(
                        "SUBCATEGORY",
                        name,
                        masterOptions("CATEGORY").find((item) => item.name === editCategory)?.id,
                      )
                    }
                    canAdd={Boolean(editCategory)}
                    placeholder={editCategory ? "Selecione..." : "Escolha uma categoria primeiro"}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">Emissão</label>
                      <BrazilianDateInput
                        className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg"
                        value={editIssueDate}
                        onValueChange={setEditIssueDate}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">Vencimento *</label>
                      <BrazilianDateInput
                        className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg"
                        value={editDueDate}
                        onValueChange={setEditDueDate}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">Valor (R$) *</label>
                      <CurrencyInput
                        className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg"
                        value={editAmount}
                        onChange={setEditAmount}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">Desconto (R$)</label>
                      <CurrencyInput
                        className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg"
                        value={editDiscount}
                        onChange={setEditDiscount}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">Juros (R$)</label>
                      <CurrencyInput
                        className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg"
                        value={editInterest}
                        onChange={setEditInterest}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">Multa (R$)</label>
                      <CurrencyInput
                        className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg"
                        value={editPenalty}
                        onChange={setEditPenalty}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">Conta bancária de origem</label>
                    <select
                      className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg cursor-pointer"
                      value={editBankAccountId}
                      onChange={(e) => setEditBankAccountId(e.target.value)}
                    >
                      {accounts.map((ba) => (
                        <option key={ba.id} value={ba.id}>{ba.bankName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">Nº Documento</label>
                    <input
                      type="text"
                      className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg"
                      value={editDocumentNumber}
                      onChange={(e) => setEditDocumentNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">Observação</label>
                    <textarea
                      rows={2}
                      className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditingInfo(false)}
                      className="text-ink-soft dark:text-ink-soft-dark font-semibold px-3 py-2 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="bg-brand-red-600 hover:bg-brand-red-500 text-white font-semibold px-4 py-2 rounded-lg cursor-pointer"
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
                    <p className="text-ink-soft dark:text-ink-soft-dark italic py-6 text-center">
                      {selected.status === "Paga"
                        ? "Este título já está totalmente pago."
                        : "Este título foi cancelado e não pode receber pagamentos."}
                    </p>
                  ) : (
                    <>
                      <div className="bg-zinc-50 dark:bg-zinc-800/70 border border-line dark:border-line-dark rounded-lg p-3 flex items-center justify-between">
                        <span className="text-ink-soft dark:text-ink-soft-dark font-semibold">Saldo em aberto</span>
                        <span className="font-semibold text-ink dark:text-ink-dark">{formatBRL(getRemaining(selected))}</span>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">Banco de origem *</label>
                        <select
                          className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg cursor-pointer"
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
                        <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">Valor a pagar (R$) *</label>
                        <CurrencyInput
                          className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg"
                          value={payAmount}
                          onChange={setPayAmount}
                        />
                        {Number(payAmount) > 0 && Number(payAmount) < getRemaining(selected) && (
                          <p className="text-[10px] text-cyan-700 dark:text-cyan-400 font-semibold">
                            Pagamento parcial
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">Juros (R$)</label>
                          <CurrencyInput
                            className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg"
                            value={payInterest}
                            onChange={setPayInterest}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">Multa (R$)</label>
                          <CurrencyInput
                            className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg"
                            value={payPenalty}
                            onChange={setPayPenalty}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">Desconto (R$)</label>
                          <CurrencyInput
                            className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg"
                            value={payDiscount}
                            onChange={setPayDiscount}
                          />
                        </div>
                      </div>

                      {(Number(payInterest) > 0 || Number(payPenalty) > 0 || Number(payDiscount) > 0) && (
                        <div className="bg-brand-navy-900/5 dark:bg-brand-navy-700/20 border border-brand-navy-900/20 dark:border-brand-navy-700/40 rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-semibold text-brand-navy-900 dark:text-blue-200 uppercase block">
                              Valor final (com juros/multa/desconto)
                            </span>
                            <span className="text-lg font-semibold text-brand-navy-900 dark:text-blue-200">
                              {formatBRL(payFinalTotal)}
                            </span>
                          </div>
                          {Number(payAmount) !== payFinalTotal && (
                            <button
                              type="button"
                              onClick={() => setPayAmount(payFinalTotal)}
                              className="text-[10px] font-semibold text-brand-navy-900 dark:text-blue-200 hover:underline cursor-pointer shrink-0"
                            >
                              Usar este valor
                            </button>
                          )}
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">Data do pagamento</label>
                        <BrazilianDateInput
                          className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg"
                          value={payDate}
                          onValueChange={setPayDate}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">Comprovante</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Nenhum comprovante anexado"
                            readOnly
                            className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 border border-line dark:border-line-dark rounded-lg text-ink-soft dark:text-ink-soft-dark"
                            value={payReceiptUrl ? "comprovante_upload_simulado.pdf" : ""}
                          />
                          <button
                            type="button"
                            onClick={() => setPayReceiptUrl("#")}
                            className="text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-line dark:border-line-dark p-2 rounded-lg cursor-pointer text-zinc-700 dark:text-zinc-200 font-semibold flex items-center gap-1 shrink-0"
                          >
                            <Paperclip className="h-3.5 w-3.5" /> Simular
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block">Observação</label>
                        <textarea
                          rows={2}
                          className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg"
                          value={payNotes}
                          onChange={(e) => setPayNotes(e.target.value)}
                        />
                      </div>

                      <button
                        onClick={handleConfirmPayment}
                        className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg cursor-pointer"
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
                    <span className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block mb-1">Anexo do título</span>
                    {selected.attachmentName ? (
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          alert("Abrindo documento com token seguro assinado por S3...");
                        }}
                        className="font-semibold text-ink dark:text-ink-dark hover:underline flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/70 border border-line dark:border-line-dark rounded-lg p-3"
                      >
                        <Paperclip className="h-3.5 w-3.5 text-ink-soft dark:text-ink-soft-dark shrink-0" />
                        {selected.attachmentName}
                        <ExternalLink className="h-3 w-3 text-ink-soft dark:text-ink-soft-dark" />
                      </a>
                    ) : (
                      <p className="text-ink-soft dark:text-ink-soft-dark italic bg-zinc-50 dark:bg-zinc-800/70 border border-line dark:border-line-dark rounded-lg p-3">
                        Nenhum anexo enviado.
                      </p>
                    )}
                    {canEdit(selected) && (
                      <button
                        onClick={handleAttachSimulated}
                        className="mt-2 text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-line dark:border-line-dark px-3 py-2 rounded-lg cursor-pointer text-zinc-700 dark:text-zinc-200 font-semibold flex items-center gap-1.5"
                      >
                        <Paperclip className="h-3.5 w-3.5" /> Substituir anexo (simular)
                      </button>
                    )}
                  </div>

                  {(selected.paymentHistory || []).some((p) => p.receiptUrl) && (
                    <div>
                      <span className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase block mb-1">Comprovantes de pagamento</span>
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
                              className="font-semibold text-zinc-800 dark:text-zinc-200 hover:underline flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/70 border border-line dark:border-line-dark rounded-lg p-2.5"
                            >
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                              Comprovante de {formatDate(p.date)} — {formatBRL(p.amount)}
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
                    <p className="text-ink-soft dark:text-ink-soft-dark italic py-6 text-center">
                      Nenhum pagamento registrado ainda.
                    </p>
                  ) : (
                    [...(selected.paymentHistory || [])]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((p) => (
                        <div key={p.id} className="bg-zinc-50 dark:bg-zinc-800/70 border border-line dark:border-line-dark rounded-lg p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-ink dark:text-ink-dark">{formatBRL(p.amount)}</span>
                            <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark">
                              {formatDate(p.date)}
                            </span>
                          </div>
                          <div className="text-[10px] text-ink-soft dark:text-ink-soft-dark flex items-center gap-1">
                            <Landmark className="h-3 w-3" /> {p.bankAccountName}
                          </div>
                          {(p.interest > 0 || p.penalty > 0 || p.discount > 0) && (
                            <div className="text-[10px] text-ink-soft dark:text-ink-soft-dark">
                              {p.interest > 0 && <>Juros: {formatBRL(p.interest)} · </>}
                              {p.penalty > 0 && <>Multa: {formatBRL(p.penalty)} · </>}
                              {p.discount > 0 && <>Desconto: {formatBRL(p.discount)}</>}
                            </div>
                          )}
                          {p.notes && (
                            <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark italic">"{p.notes}"</p>
                          )}
                          <div className="text-[9px] text-ink-soft dark:text-ink-soft-dark flex items-center gap-1 pt-1 border-t border-zinc-200/70 dark:border-zinc-700">
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

      <ConfirmDialog
        open={cancelTargetId !== null}
        onClose={() => setCancelTargetId(null)}
        onConfirm={confirmCancel}
        title="Cancelar este lançamento?"
        description="O registro histórico será preservado para auditoria."
        confirmLabel="Cancelar lançamento"
        cancelLabel="Voltar"
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() => void confirmBulkDelete()}
        loading={bulkDeleting}
        title={`Excluir ${selectedPayables.length} conta(s) a pagar?`}
        description="As contas selecionadas e os registros correspondentes na tela de Lançamentos serão excluídos. Contas com pagamentos registrados não podem ser excluídas."
        confirmLabel="Excluir selecionadas"
        cancelLabel="Voltar"
      />
    </div>
  );
}
