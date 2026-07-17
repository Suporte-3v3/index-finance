/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import { AccountPayable } from "../types";
import {
  Plus,
  Search,
  Filter,
  Trash2,
  Check,
  AlertCircle,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Paperclip,
  CheckCircle,
  FileCheck,
  Ban,
  Clock,
  Briefcase,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

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
    payAccountPayable,
    scheduleAccountPayable,
    cancelAccountPayable,
    currentUser,
    hasPermission,
    masterData,
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

  // Collapsible detailed panels for payments
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    "Nenhuma" | "Semanal" | "Mensal" | "Trimestral" | "Anual"
  >("Nenhuma");
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
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const payableMetrics = [
    [
      "A vencer",
      companyPayables.filter(
        (item) => item.status === "A vencer" && item.dueDate > today,
      ).length,
    ],
    [
      "Vencendo hoje",
      companyPayables.filter(
        (item) => item.status !== "Paga" && item.dueDate === today,
      ).length,
    ],
    [
      "Vencidas",
      companyPayables.filter(
        (item) =>
          item.status === "Vencida" ||
          (item.status !== "Paga" && item.dueDate < today),
      ).length,
    ],
    [
      "Aguardando aprovação",
      companyPayables.filter((item) => item.status === "Aguardando aprovação")
        .length,
    ],
    [
      "Agendadas",
      companyPayables.filter((item) => item.status === "Agendada").length,
    ],
    [
      "Pagas no mês",
      companyPayables.filter(
        (item) =>
          item.status === "Paga" && item.paymentDate?.startsWith(currentMonth),
      ).length,
    ],
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
        return "bg-zinc-100 text-zinc-600 border-zinc-200";
      case "Pendente":
      case "A vencer":
        return "bg-sky-50 text-sky-700 border-sky-200";
      case "Aguardando aprovação":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Aprovada":
        return "bg-violet-50 text-violet-700 border-violet-200";
      case "Agendada":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "Paga":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Vencida":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "Rejeitada":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "Cancelada":
        return "bg-zinc-200 text-zinc-800 border-zinc-300 line-through";
      default:
        return "bg-zinc-50 text-zinc-600 border-zinc-200";
    }
  };

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
      documentNumber,
      notes,
      attachmentName: attachmentName || undefined,
      attachmentUrl: attachmentName ? "#" : undefined,
      responsibleId: currentUser.id,
      needsApproval: Number(amount) >= activeCompany.approvalLimit,
    });
    resetForm();
  };

  const handlePay = (id: string) => {
    const today = new Date().toISOString().split("T")[0];
    payAccountPayable(id, today);
  };

  const handleCancel = (id: string) => {
    if (
      window.confirm(
        "Deseja realmente cancelar este lançamento? O registro histórico será preservado para auditoria.",
      )
    ) {
      cancelAccountPayable(id);
    }
  };

  return (
    <div id="accounts-payable-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2
            id="payable-title"
            className="text-xl font-bold text-zinc-900 tracking-tight"
          >
            Contas a Pagar
          </h2>
          <p className="text-zinc-500 text-xs">
            Gestão de compromissos, agendamentos, validação de boletos e
            histórico de liquidações.
          </p>
        </div>

        {hasPermission("accounts-payable.create") && (
          <button
            onClick={onNavigate}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#C8102E] hover:bg-[#8F071B] px-4 py-2.5 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <ChevronRight className="h-4 w-4" />
            Ir para Lançamentos
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {payableMetrics.map(([label, count]) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-zinc-200 p-3"
          >
            <p className="text-[9px] text-zinc-500 font-bold uppercase">
              {label}
            </p>
            <p className="text-xl font-black mt-1">{count}</p>
          </div>
        ))}
      </div>

      {/* Grid Filtering / Searching */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por Descrição, Fornecedor ou Doc..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 hover:bg-zinc-100/50 focus:bg-white rounded-lg border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs text-zinc-600">
            <Filter className="h-3.5 w-3.5" />
            <select
              className="bg-transparent font-medium focus:outline-none cursor-pointer"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Todos os Status</option>
              <option value="A vencer">A vencer</option>
              <option value="Aguardando aprovação">Aguardando Aprovação</option>
              <option value="Agendada">Agendadas</option>
              <option value="Paga">Pagas</option>
              <option value="Vencida">Vencidas</option>
              <option value="Cancelada">Canceladas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Step-by-Step Step Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-100 bg-gradient-to-r from-[#0B2C52] to-[#C8102E] text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">
                  Lançar Nova Conta a Pagar
                </h3>
                <p className="text-[10px] text-[#F2D3A0]">
                  Dividido em 3 etapas de verificação operacional para BPO.
                </p>
              </div>
              <button
                onClick={resetForm}
                className="text-[#F2D3A0] hover:text-white font-bold text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>

            {/* Steps Indicator bar */}
            <div className="flex bg-[#0B2C52] border-b border-[#0B2C52]/20 px-5 py-3.5 text-xs justify-between font-medium">
              <span
                className={`flex items-center gap-1.5 ${formStep >= 1 ? "text-white font-extrabold" : "text-white/40"}`}
              >
                <span className="h-5 w-5 rounded-full bg-[#C8102E] text-white flex items-center justify-center text-[10px] font-black">
                  1
                </span>{" "}
                Fornecedor
              </span>
              <span
                className={`flex items-center gap-1.5 ${formStep >= 2 ? "text-white font-extrabold" : "text-white/40"}`}
              >
                <span
                  className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black ${formStep >= 2 ? "bg-[#C8102E] text-white" : "bg-[#061425] text-white/40"}`}
                >
                  2
                </span>{" "}
                Valores
              </span>
              <span
                className={`flex items-center gap-1.5 ${formStep >= 3 ? "text-white font-extrabold" : "text-white/40"}`}
              >
                <span
                  className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black ${formStep >= 3 ? "bg-[#C8102E] text-white" : "bg-[#061425] text-white/40"}`}
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
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                      Descrição da Conta *
                    </label>
                    <select
                      required
                      placeholder="Ex: Licença mensal Softwares ERP"
                      className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                      Fornecedor / Beneficiário *
                    </label>
                    <select
                      required
                      className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900"
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {masterOptions("SUPPLIER").map((item) => (
                        <option key={item.id} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                        Categoria de Plano *
                      </label>
                      <select
                        required
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none cursor-pointer"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        <option value="">Selecione...</option>
                        {masterOptions("CATEGORY").map((item) => (
                          <option key={item.id} value={item.name}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                        Centro de Custo *
                      </label>
                      <select
                        required
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none cursor-pointer"
                        value={costCenter}
                        onChange={(e) => setCostCenter(e.target.value)}
                      >
                        <option value="">Selecione...</option>
                        {masterOptions("COST_CENTER").map((item) => (
                          <option key={item.id} value={item.name}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Datas e Valores */}
              {formStep === 2 && (
                <div className="space-y-4 animate-in slide-in-from-right-5 duration-150">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                        Mês Competência
                      </label>
                      <input
                        type="month"
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                        value={competenceMonth}
                        onChange={(e) => setCompetenceMonth(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                        Data Emissão
                      </label>
                      <input
                        type="date"
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                        Data Vencimento *
                      </label>
                      <input
                        type="date"
                        required
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                        Valor Principal (R$) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                        Desconto (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                        Juros (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none"
                        value={interest}
                        onChange={(e) => setInterest(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                        Multa (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none"
                        value={penalty}
                        onChange={(e) => setPenalty(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Informational Limit warning */}
                  <div className="p-3 bg-zinc-50 rounded-lg text-[10px] text-zinc-500 font-medium">
                    Previsão de Valor Líquido Final:{" "}
                    <strong>
                      R${" "}
                      {(
                        Number(amount) +
                        Number(interest) +
                        Number(penalty) -
                        Number(discount)
                      ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </strong>
                    .<br />
                    {Number(amount) >= activeCompany.approvalLimit && (
                      <span className="text-amber-600">
                        Este valor atinge ou excede o limite de aprovação (R${" "}
                        {activeCompany.approvalLimit.toLocaleString("pt-BR")}) e
                        exigirá autorização do cliente.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: Conta, Método e Anexo */}
              {formStep === 3 && (
                <div className="space-y-4 animate-in slide-in-from-right-5 duration-150">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                        Método Pagamento
                      </label>
                      <select
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg cursor-pointer"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      >
                        {masterOptions("PAYMENT_METHOD").map((item) => (
                          <option key={item.id} value={item.name}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                        Debitar de Qual Conta *
                      </label>
                      <select
                        required
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg cursor-pointer"
                        value={bankAccountId}
                        onChange={(e) => setBankAccountId(e.target.value)}
                      >
                        {accounts.map((ba) => (
                          <option key={ba.id} value={ba.id}>
                            {ba.bankName} - Saldo R${" "}
                            {ba.balance.toLocaleString("pt-BR")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                        Recorrência
                      </label>
                      <select
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg cursor-pointer"
                        value={recurrence}
                        onChange={(e) => setRecurrence(e.target.value as any)}
                      >
                        <option value="Nenhuma">Nenhuma / Único</option>
                        <option value="Semanal">Semanal</option>
                        <option value="Mensal">Mensal</option>
                        <option value="Trimestral">Trimestral</option>
                        <option value="Anual">Anual</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                        Número do Documento / NF
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: NF-12042"
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none"
                        value={documentNumber}
                        onChange={(e) => setDocumentNumber(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                      Anexar Fatura / Boleto (PDF/Imagem)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Nome do arquivo faturado..."
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none"
                        value={attachmentName}
                        onChange={(e) => setAttachmentName(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setAttachmentName("boleto_upload_simulado.pdf")
                        }
                        className="text-xs bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 p-2 rounded-lg cursor-pointer text-zinc-700 font-bold flex items-center gap-1 shrink-0"
                      >
                        <Paperclip className="h-3.5 w-3.5" /> Simular
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                      Observações adicionais
                    </label>
                    <textarea
                      placeholder="Alguma instrução de pagamento..."
                      rows={2}
                      className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-between border-t border-zinc-100 pt-4 mt-6">
                {formStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setFormStep((prev) => (prev - 1) as any)}
                    className="text-xs bg-zinc-100 hover:bg-zinc-200 font-bold px-4 py-2 rounded-lg cursor-pointer text-zinc-800"
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
                    className="text-xs text-zinc-500 hover:text-zinc-900 font-medium px-3 py-2 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="text-xs font-bold bg-zinc-950 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg shadow-xs cursor-pointer"
                  >
                    {formStep === 3 ? "Finalizar Lançamento" : "Próxima Etapa"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Table view of accounts */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="p-4 w-6"></th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Lançamento
                </th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Fornecedor
                </th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Vencimento
                </th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">
                  Valor Líquido
                </th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-center">
                  Status
                </th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-xs">
              {filteredPayables.map((ap) => {
                const isExpanded = expandedId === ap.id;
                const isOverdue =
                  new Date(ap.dueDate) < new Date() &&
                  ap.status !== "Paga" &&
                  ap.status !== "Cancelada";

                return (
                  <React.Fragment key={ap.id}>
                    <tr
                      className={`hover:bg-zinc-50/50 transition-colors cursor-pointer ${isExpanded ? "bg-zinc-50/30" : ""}`}
                      onClick={() => setExpandedId(isExpanded ? null : ap.id)}
                    >
                      <td className="p-4 text-center">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-zinc-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-zinc-500" />
                        )}
                      </td>
                      <td className="p-4 font-semibold text-zinc-900">
                        {ap.description}
                        <div className="text-[10px] text-zinc-400 font-normal">
                          Nº: {ap.documentNumber || "N/A"} | Cat: {ap.category}
                        </div>
                      </td>
                      <td className="p-4 text-zinc-600 font-medium">
                        {ap.supplier}
                      </td>
                      <td
                        className={`p-4 font-medium ${isOverdue ? "text-rose-600 font-bold" : "text-zinc-600"}`}
                      >
                        {new Date(ap.dueDate).toLocaleDateString("pt-BR")}
                        {isOverdue && (
                          <span className="text-[9px] bg-rose-50 border border-rose-100 text-rose-600 px-1.5 py-0.5 rounded ml-2 font-bold uppercase tracking-wider">
                            Atrasado
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right font-bold text-zinc-900 font-mono">
                        R${" "}
                        {ap.finalAmount.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(ap.status)}`}
                        >
                          {ap.status}
                        </span>
                      </td>
                      <td
                        className="p-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          {ap.status === "A vencer" && (
                            <button
                              onClick={() => scheduleAccountPayable(ap.id)}
                              className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-1 rounded border border-blue-200 cursor-pointer"
                            >
                              Agendar
                            </button>
                          )}
                          {ap.status !== "Paga" &&
                            ap.status !== "Cancelada" &&
                            ap.status !== "Aguardando aprovação" &&
                            hasPermission("reconciliation.execute") && (
                              <button
                                onClick={() => handlePay(ap.id)}
                                className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded border border-emerald-200 cursor-pointer flex items-center gap-1"
                                title="Confirmar Pagamento (Dar Baixa)"
                              >
                                <Check className="h-3 w-3" /> Pagar
                              </button>
                            )}
                          {ap.status !== "Paga" &&
                            ap.status !== "Cancelada" &&
                            hasPermission("accounts-payable.cancel") && (
                              <button
                                onClick={() => handleCancel(ap.id)}
                                className="text-[10px] bg-zinc-50 hover:bg-zinc-200 text-zinc-700 font-bold px-2 py-1 rounded border border-zinc-200 cursor-pointer flex items-center gap-1"
                                title="Cancelar Registro"
                              >
                                <Ban className="h-3 w-3" /> Cancelar
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>

                    {/* Collapsible Details Row */}
                    {isExpanded && (
                      <tr>
                        <td
                          colSpan={7}
                          className="p-4 bg-zinc-50/50 border-t border-b border-zinc-100"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-zinc-600">
                            {/* Finance breakdown column */}
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                                <DollarSign className="h-3.5 w-3.5" />{" "}
                                Detalhamento de Valores
                              </h4>
                              <div className="space-y-1 bg-white p-3 rounded-lg border border-zinc-200/60 font-mono">
                                <div className="flex justify-between">
                                  <span>Valor Principal:</span>
                                  <span>
                                    R${" "}
                                    {ap.amount.toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                                <div className="flex justify-between text-rose-500">
                                  <span>Juros:</span>
                                  <span>
                                    + R${" "}
                                    {ap.interest.toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                                <div className="flex justify-between text-rose-500">
                                  <span>Multa:</span>
                                  <span>
                                    + R${" "}
                                    {ap.penalty.toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                                <div className="flex justify-between text-emerald-600">
                                  <span>Desconto:</span>
                                  <span>
                                    - R${" "}
                                    {ap.discount.toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                                <div className="flex justify-between font-bold text-zinc-900 border-t border-zinc-100 pt-1 text-sm">
                                  <span>Líquido Final:</span>
                                  <span>
                                    R${" "}
                                    {ap.finalAmount.toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Payment details column */}
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" /> Metadados de
                                Liquidação
                              </h4>
                              <div className="space-y-1.5 bg-white p-3 rounded-lg border border-zinc-200/60">
                                <div>
                                  <span className="text-zinc-400 font-medium block text-[9px] uppercase">
                                    Forma de Pagamento
                                  </span>
                                  <span className="font-bold text-zinc-800">
                                    {ap.paymentMethod}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-medium block text-[9px] uppercase">
                                    Recorrência
                                  </span>
                                  <span className="font-semibold text-zinc-800">
                                    {ap.recurrence}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-medium block text-[9px] uppercase">
                                    Conta Bancária Origem
                                  </span>
                                  <span className="font-semibold text-zinc-800">
                                    {bankAccounts.find(
                                      (ba) => ba.id === ap.bankAccountId,
                                    )?.bankName || "Itaú"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Attachments & logs column */}
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                                <Paperclip className="h-3.5 w-3.5" /> Documentos
                                & Auditoria
                              </h4>
                              <div className="space-y-2 bg-white p-3 rounded-lg border border-zinc-200/60">
                                <div>
                                  <span className="text-zinc-400 font-medium block text-[9px] uppercase">
                                    Anexo Cadastrado
                                  </span>
                                  {ap.attachmentName ? (
                                    <a
                                      href="#"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        alert(
                                          "Abrindo documento com token seguro assinado por S3...",
                                        );
                                      }}
                                      className="font-bold text-zinc-900 hover:underline flex items-center gap-1 mt-0.5"
                                    >
                                      <Paperclip className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                                      {ap.attachmentName}{" "}
                                      <ExternalLink className="h-3 w-3 inline text-zinc-400" />
                                    </a>
                                  ) : (
                                    <span className="text-zinc-400 italic">
                                      Nenhum anexo enviado
                                    </span>
                                  )}
                                </div>

                                {ap.status === "Paga" && (
                                  <div>
                                    <span className="text-zinc-400 font-medium block text-[9px] uppercase">
                                      Comprovante de Baixa
                                    </span>
                                    <span className="text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />{" "}
                                      Confirmado em{" "}
                                      {new Date(
                                        ap.paymentDate || "",
                                      ).toLocaleDateString("pt-BR")}
                                    </span>
                                  </div>
                                )}

                                <div className="border-t border-zinc-100 pt-1.5 text-[10px] text-zinc-400 font-mono leading-tight">
                                  UUID: {ap.id}
                                  <br />
                                  Registrado:{" "}
                                  {new Date(ap.createdAt).toLocaleString(
                                    "pt-BR",
                                  )}
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
              {filteredPayables.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-zinc-400 italic"
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
    </div>
  );
}
