import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Clock,
  Filter,
  Plus,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useBPOState } from "../hooks/useBPOState";
import { Document } from "../types";
import FileTypeIcon from "../components/FileTypeIcon";
import DocumentDownloadButton from "../components/DocumentDownloadButton";
import QuickAddSelect from "../components/QuickAddSelect";

const STATUS: Document["status"][] = [
  "Aguardando Análise",
  "Aguardando Aprovação",
  "Lançado",
  "Cancelado",
];
const statusStyle: Record<Document["status"], string> = {
  "Aguardando Análise":
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  "Aguardando Aprovação":
    "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  Compartilhado: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  Lançado:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  Cancelado: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};
const STATUS_VISUALS: Record<
  Document["status"],
  { icon: typeof Clock; tint: string }
> = {
  "Aguardando Análise": {
    icon: Clock,
    tint: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  },
  "Aguardando Aprovação": {
    icon: Send,
    tint: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
  },
  Compartilhado: {
    icon: Send,
    tint: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  },
  Lançado: {
    icon: Check,
    tint: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  Cancelado: {
    icon: X,
    tint: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  },
};
const DOC_AVATAR_PALETTE = [
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
  return DOC_AVATAR_PALETTE[Math.abs(hash) % DOC_AVATAR_PALETTE.length];
};
// Estilo dos inputs/selects dentro de <Field>, reaproveitado nos QuickAddSelect
// para que o botão "+" de cadastro rápido fique visualmente igual aos demais campos.
const FIELD_LABEL_CLASS =
  "block text-[9px] font-semibold text-zinc-600 dark:text-zinc-400";
const FIELD_SELECT_CLASS =
  "mt-1 w-full rounded-sm border border-blue-200 dark:border-[#3E6DA6]/40 bg-blue-50/60 dark:bg-[#123B6B]/10 px-2.5 py-2 text-xs text-zinc-800 dark:text-zinc-100 shadow-sm transition-colors hover:border-blue-400 dark:hover:border-[#3E6DA6]/70 hover:bg-blue-50 dark:hover:bg-[#123B6B]/20 focus:border-[#0B2C52] dark:focus:border-[#9DB8D9] focus:bg-white dark:focus:bg-[#091320] focus:outline-none focus:ring-2 focus:ring-[#0B2C52]/15 dark:focus:ring-[#9DB8D9]/20 dark:[color-scheme:dark]";
const categoryOptions: Document["category"][] = [
  "Nota fiscal",
  "Boleto",
  "Comprovante",
  "Extrato",
  "Contrato",
  "Recibo",
  "Relatório",
  "Documento contábil",
  "Outros",
];
const emptyLaunch = {
  entryType: "Conta a Pagar" as NonNullable<Document["entryType"]>,
  supplier: "",
  description: "",
  amount: "",
  dueDate: "",
  documentNumber: "",
  category: "Outros" as Document["category"],
  expenseType: "",
  costCenter: "",
  bankAccountId: "",
  destinationBankAccountId: "",
  paymentMethod: "",
  recurrence: "Nenhuma" as NonNullable<Document["recurrence"]>,
  installmentCount: "2",
  competenceMonth: new Date().toISOString().slice(0, 7),
  notes: "",
};

export default function DocumentsReceivedView() {
  const {
    activeCompany,
    currentUser,
    users,
    documents,
    accountsPayable,
    accountsReceivable,
    bankAccounts,
    masterData,
    updateDocument,
    launchDocument,
    submitDocumentForApproval,
    cancelDocument,
    createStandaloneLaunch,
    addMasterData,
  } = useBPOState();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | Document["status"]>(
    "ALL",
  );
  const [draft, setDraft] = useState<Partial<Document>>({});
  const [newLaunchOpen, setNewLaunchOpen] = useState(false);
  const [newLaunch, setNewLaunch] = useState(emptyLaunch);
  const [approvalRecipientId, setApprovalRecipientId] = useState("");
  const companyDocuments = useMemo(
    () =>
      documents.filter(
        (item) =>
          item.companyId === activeCompany?.id &&
          item.purpose !== "VIEW_ONLY" &&
          item.status !== "Compartilhado",
      ),
    [documents, activeCompany],
  );
  const filtered = companyDocuments.filter((item) => {
    const term = query.toLocaleLowerCase("pt-BR");
    return (
      (statusFilter === "ALL" || item.status === statusFilter) &&
      (!term ||
        `${item.name} ${item.supplier} ${item.category}`
          .toLocaleLowerCase("pt-BR")
          .includes(term))
    );
  });
  const selected =
    companyDocuments.find((item) => item.id === selectedId) || filtered[0];
  const isManualLaunch = Boolean(
    selected &&
      (selected.origin === "Manual" ||
        selected.mimeType === "application/x-manual-entry"),
  );
  const linkedPayable = accountsPayable.find(
    (item) => item.id === selected?.relatedEntityId,
  );
  const linkedReceivable = accountsReceivable.find(
    (item) => item.id === selected?.relatedEntityId,
  );
  const manualFinancialLocked = Boolean(
    isManualLaunch &&
      selected?.status === "Lançado" &&
      (selected.entryType === "Conta a Receber"
        ? !linkedReceivable ||
          linkedReceivable.receivedAmount > 0 ||
          ["Recebido", "Cancelado"].includes(linkedReceivable.status)
        : selected.entryType === "Transferência"
          ? false
          : !linkedPayable ||
            ["Paga", "Cancelada"].includes(linkedPayable.status)),
  );
  const canEditSelected = Boolean(
    selected &&
      (selected.status === "Aguardando Análise" ||
        (isManualLaunch &&
          selected.status === "Lançado" &&
          !manualFinancialLocked)),
  );

  useEffect(() => {
    if (!selectedId && filtered[0]) setSelectedId(filtered[0].id);
  }, [selectedId, filtered]);
  useEffect(() => setApprovalRecipientId(""), [activeCompany?.id]);
  if (!["BPO_ADMIN", "BPO_TEAM"].includes(currentUser.role)) {
    return (
      <div className="bg-white dark:bg-[#091320] border border-zinc-200 dark:border-zinc-800 rounded-sm p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
        A fila de lançamentos é exclusiva da equipe BPO.
      </div>
    );
  }
  if (!activeCompany) return null;
  const approvalRecipients = users.filter(
    (user) =>
      user.status === "ACTIVE" &&
      user.role === "CLIENT" &&
      user.companies?.includes(activeCompany.id),
  );
  const options = (type: import("../types").MasterDataType) =>
    masterData.filter(
      (item) =>
        item.companyId === activeCompany.id &&
        item.type === type &&
        item.active,
    );
  const documentTypes = options("DOCUMENT_TYPE").map((item) => item.name);
  const financialCategories = options("CATEGORY");
  const costCenters = options("COST_CENTER");
  const paymentMethods = options("PAYMENT_METHOD");
  const suppliers = options("SUPPLIER");
  const customers = options("CUSTOMER");

  const value = <K extends keyof Document>(key: K) =>
    draft[key] ?? selected?.[key] ?? "";
  const set = <K extends keyof Document>(key: K, next: Document[K]) =>
    setDraft((current) => ({ ...current, [key]: next }));
  const save = () => {
    if (selected && Object.keys(draft).length) {
      const updated = updateDocument(selected.id, draft);
      if (!updated) {
        alert(
          "Este lançamento não pode mais ser editado porque o registro financeiro vinculado já foi liquidado, recebido ou cancelado.",
        );
        return;
      }
    }
    setDraft({});
  };
  const cancelManualLaunch = () => {
    if (!selected) return;
    if (
      !window.confirm(
        "Cancelar este lançamento manual? O registro financeiro vinculado também será cancelado.",
      )
    )
      return;
    const cancelled = cancelDocument(selected.id);
    if (!cancelled) {
      alert(
        "Não foi possível cancelar. Verifique se a conta já foi paga ou recebeu algum valor.",
      );
      return;
    }
    setDraft({});
  };
  const act = (action: "launch" | "approval" | "cancel") => {
    if (!selected) return;
    if (Object.keys(draft).length) updateDocument(selected.id, draft);
    if (action === "launch") launchDocument(selected.id, draft);
    if (action === "approval") {
      if (!approvalRecipientId) {
        alert("Selecione o cliente que aprovará o lançamento.");
        return;
      }
      submitDocumentForApproval(selected.id, draft, approvalRecipientId);
    }
    if (action === "cancel") cancelDocument(selected.id);
    setDraft({});
  };
  const counts = (status: Document["status"]) =>
    companyDocuments.filter((item) => item.status === status).length;
  const submitStandalone = (event: React.FormEvent) => {
    event.preventDefault();
    if (newLaunch.recurrence === "Parcelada" && Number(newLaunch.installmentCount) < 2) {
      alert("Informe pelo menos 2 parcelas ou escolha outra recorrência.");
      return;
    }
    createStandaloneLaunch({
      ...newLaunch,
      amount: Number(newLaunch.amount),
      entryType: newLaunch.entryType,
      installmentCount:
        newLaunch.recurrence === "Parcelada"
          ? Number(newLaunch.installmentCount)
          : undefined,
    });
    setNewLaunchOpen(false);
    setNewLaunch(emptyLaunch);
  };
  const eligibleDocuments = filtered.filter(
    (item) => item.status === "Aguardando Análise",
  );
  const selectedEligible = companyDocuments.filter(
    (item) => selectedIds.has(item.id) && item.status === "Aguardando Análise",
  );
  const toggleSelection = (id: string) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleAllEligible = () =>
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected =
        eligibleDocuments.length > 0 &&
        eligibleDocuments.every((item) => next.has(item.id));
      eligibleDocuments.forEach((item) =>
        allSelected ? next.delete(item.id) : next.add(item.id),
      );
      return next;
    });
  const launchBatch = (items: Document[]) => {
    if (!items.length) return;
    const total = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const message = `Você está prestes a lançar ${items.length} ${items.length === 1 ? "registro" : "registros"} no financeiro, no total de R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Esta ação não poderá ser desfeita. Deseja continuar?`;
    if (!window.confirm(message)) return;
    items.forEach((item) => launchDocument(item.id));
    setSelectedIds((current) => {
      const next = new Set(current);
      items.forEach((item) => next.delete(item.id));
      return next;
    });
  };
  const approveBatch = (items: Document[]) => {
    if (!items.length) return;
    const recipient = approvalRecipients.find(
      (user) => user.id === approvalRecipientId,
    );
    if (!recipient) {
      alert("Selecione o cliente que aprovará os lançamentos.");
      return;
    }
    const message = `Você enviará ${items.length} ${items.length === 1 ? "lançamento" : "lançamentos"} para aprovação de ${recipient.name}. Deseja continuar?`;
    if (!window.confirm(message)) return;
    items.forEach((item) =>
      submitDocumentForApproval(item.id, {}, recipient.id),
    );
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight font-sans">
            Lançamentos
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-sans">
            Confira documentos recebidos ou registre um lançamento avulso
            diretamente no financeiro.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            onClick={() => setNewLaunchOpen(true)}
            className="self-end bg-[#0B2C52] text-white rounded-sm px-4 py-2.5 text-xs font-semibold flex items-center gap-2 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Novo lançamento
          </button>
        </div>
      </div>

      {newLaunchOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4"
          onClick={() => setNewLaunchOpen(false)}
        >
          <form
            onSubmit={submitStandalone}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#091320] border border-zinc-200 dark:border-zinc-800 rounded-sm shadow-2xl w-full max-w-2xl overflow-hidden"
          >
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between">
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                  Novo lançamento avulso
                </h3>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                  Será incluído diretamente no financeiro com status Lançado,
                  sem aprovação do cliente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNewLaunchOpen(false)}
                className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
              <div className="sm:col-span-2">
                <Field label="Tipo de lançamento" required>
                  <select
                    value={newLaunch.entryType}
                    onChange={(e) =>
                      setNewLaunch({
                        ...newLaunch,
                        entryType: e.target.value as NonNullable<
                          Document["entryType"]
                        >,
                      })
                    }
                  >
                    <option>Conta a Pagar</option>
                    <option>Conta a Receber</option>
                    <option>Transferência</option>
                  </select>
                </Field>
              </div>
              {newLaunch.entryType === "Transferência" ? (
                <Field label="Identificação da transferência" required>
                  <input
                    required
                    value={newLaunch.supplier}
                    onChange={(e) =>
                      setNewLaunch({ ...newLaunch, supplier: e.target.value })
                    }
                  />
                </Field>
              ) : (
                <QuickAddSelect
                  label={
                    newLaunch.entryType === "Conta a Receber"
                      ? "Cliente"
                      : "Fornecedor"
                  }
                  required
                  labelClassName={FIELD_LABEL_CLASS}
                  selectClassName={FIELD_SELECT_CLASS}
                  placeholder="Selecione"
                  value={newLaunch.supplier}
                  onChange={(value) =>
                    setNewLaunch({ ...newLaunch, supplier: value })
                  }
                  options={
                    newLaunch.entryType === "Conta a Receber"
                      ? customers
                      : suppliers
                  }
                  onAdd={(name) =>
                    addMasterData(
                      newLaunch.entryType === "Conta a Receber"
                        ? "CUSTOMER"
                        : "SUPPLIER",
                      name,
                    )
                  }
                />
              )}
              <Field label="Valor" required>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={newLaunch.amount}
                  onChange={(e) =>
                    setNewLaunch({ ...newLaunch, amount: e.target.value })
                  }
                />
              </Field>
              <Field label="Vencimento" required>
                <input
                  required
                  type="date"
                  value={newLaunch.dueDate}
                  onChange={(e) =>
                    setNewLaunch({ ...newLaunch, dueDate: e.target.value })
                  }
                />
              </Field>
              <Field label="Número do documento">
                <input
                  value={newLaunch.documentNumber}
                  onChange={(e) =>
                    setNewLaunch({
                      ...newLaunch,
                      documentNumber: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Tipo">
                <select
                  value={newLaunch.category}
                  onChange={(e) =>
                    setNewLaunch({
                      ...newLaunch,
                      category: e.target.value as Document["category"],
                    })
                  }
                >
                  {(documentTypes.length ? documentTypes : categoryOptions).map(
                    (item) => (
                      <option key={item}>{item}</option>
                    ),
                  )}
                </select>
              </Field>
              <QuickAddSelect
                label="Categoria"
                labelClassName={FIELD_LABEL_CLASS}
                selectClassName={FIELD_SELECT_CLASS}
                placeholder="Selecione"
                value={newLaunch.expenseType}
                onChange={(value) =>
                  setNewLaunch({ ...newLaunch, expenseType: value })
                }
                options={financialCategories}
                onAdd={(name) => addMasterData("CATEGORY", name)}
              />
              <QuickAddSelect
                label="Centro de custo"
                labelClassName={FIELD_LABEL_CLASS}
                selectClassName={FIELD_SELECT_CLASS}
                placeholder="A classificar"
                value={newLaunch.costCenter}
                onChange={(value) =>
                  setNewLaunch({ ...newLaunch, costCenter: value })
                }
                options={costCenters}
                onAdd={(name) => addMasterData("COST_CENTER", name)}
              />
              <Field
                label={
                  newLaunch.entryType === "Transferência"
                    ? "Conta de origem"
                    : "Conta bancária"
                }
              >
                <select
                  required={newLaunch.entryType === "Transferência"}
                  value={newLaunch.bankAccountId}
                  onChange={(e) =>
                    setNewLaunch({
                      ...newLaunch,
                      bankAccountId: e.target.value,
                    })
                  }
                >
                  <option value="">A definir</option>
                  {bankAccounts
                    .filter((item) => item.companyId === activeCompany.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.bankName} · {item.accountNumber}
                      </option>
                    ))}
                </select>
              </Field>
              {newLaunch.entryType === "Transferência" && (
                <Field label="Conta de destino" required>
                  <select
                    required
                    value={newLaunch.destinationBankAccountId}
                    onChange={(e) =>
                      setNewLaunch({
                        ...newLaunch,
                        destinationBankAccountId: e.target.value,
                      })
                    }
                  >
                    <option value="">Selecione</option>
                    {bankAccounts
                      .filter(
                        (item) =>
                          item.companyId === activeCompany.id &&
                          item.id !== newLaunch.bankAccountId,
                      )
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.bankName} · {item.accountNumber}
                        </option>
                      ))}
                  </select>
                </Field>
              )}
              <QuickAddSelect
                label="Forma de pagamento"
                labelClassName={FIELD_LABEL_CLASS}
                selectClassName={FIELD_SELECT_CLASS}
                placeholder="A definir"
                value={newLaunch.paymentMethod}
                onChange={(value) =>
                  setNewLaunch({ ...newLaunch, paymentMethod: value })
                }
                options={paymentMethods}
                onAdd={(name) => addMasterData("PAYMENT_METHOD", name)}
              />
              <Field label="Recorrência">
                <select
                  value={newLaunch.recurrence}
                  onChange={(e) =>
                    setNewLaunch({
                      ...newLaunch,
                      recurrence: e.target.value as NonNullable<
                        Document["recurrence"]
                      >,
                    })
                  }
                >
                  <option>Nenhuma</option>
                  <option>Parcelada</option>
                  <option>Semanal</option>
                  <option>Mensal</option>
                  <option>Trimestral</option>
                  <option>Anual</option>
                </select>
              </Field>
              {newLaunch.recurrence === "Parcelada" &&
                newLaunch.entryType !== "Transferência" && (
                  <Field label="Quantidade de parcelas" required>
                    <input
                      type="number"
                      min={2}
                      step={1}
                      value={newLaunch.installmentCount}
                      onChange={(e) =>
                        setNewLaunch({
                          ...newLaunch,
                          installmentCount: e.target.value,
                        })
                      }
                    />
                  </Field>
                )}
              <Field label="Competência" required>
                <input
                  required
                  type="month"
                  value={newLaunch.competenceMonth}
                  onChange={(e) =>
                    setNewLaunch({
                      ...newLaunch,
                      competenceMonth: e.target.value,
                    })
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Descrição" required>
                  <textarea
                    required
                    rows={3}
                    value={newLaunch.description}
                    onChange={(e) =>
                      setNewLaunch({
                        ...newLaunch,
                        description: e.target.value,
                      })
                    }
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Observações">
                  <textarea
                    rows={2}
                    value={newLaunch.notes}
                    onChange={(e) =>
                      setNewLaunch({ ...newLaunch, notes: e.target.value })
                    }
                  />
                </Field>
              </div>
            </div>
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewLaunchOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button className="px-4 py-2 bg-emerald-600 text-white rounded-sm text-xs font-semibold flex gap-1.5 items-center cursor-pointer">
                <Check className="h-4 w-4" /> Criar como lançado
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        {STATUS.map((status) => {
          const visual = STATUS_VISUALS[status];
          const VisualIcon = visual.icon;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`bg-white dark:bg-[#091320] rounded-sm border p-3 text-left cursor-pointer transition flex flex-col gap-2 ${statusFilter === status ? "border-[#0B2C52] dark:border-[#9DB8D9] ring-2 ring-[#0B2C52]/10 dark:ring-[#9DB8D9]/20" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"}`}
            >
              <div
                className={`h-7 w-7 rounded-sm flex items-center justify-center ${visual.tint}`}
              >
                <VisualIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold">
                  {status}
                </p>
                <p className="text-2xl font-semibold mt-0.5 text-zinc-900 dark:text-zinc-50">
                  {counts(status)}
                </p>
                <p className="text-[9px] text-zinc-400 dark:text-zinc-500">
                  Documentos
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid xl:grid-cols-[minmax(0,2.35fr)_minmax(340px,0.85fr)] 2xl:grid-cols-[minmax(0,2.6fr)_minmax(360px,0.8fr)] gap-4 items-start">
        <section className="bg-white dark:bg-[#091320] border border-zinc-200 dark:border-zinc-800 rounded-sm overflow-hidden shadow-sm">
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-2 rounded-sm text-[10px] font-semibold cursor-pointer ${statusFilter === "ALL" ? "bg-[#0B2C52] text-white" : "bg-zinc-50 dark:bg-zinc-800/70 text-zinc-600 dark:text-zinc-300"}`}
            >
              Todos{" "}
              <span className="ml-1 opacity-70">{companyDocuments.length}</span>
            </button>
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar documento ou fornecedor..."
                className="w-full bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 border border-zinc-200 dark:border-zinc-700 rounded-sm pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
              />
            </div>
            <button className="border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-sm px-3 text-xs flex items-center gap-1.5 cursor-pointer">
              <Filter className="h-3.5 w-3.5" /> Filtros
            </button>
            {selectedEligible.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label="Cliente aprovador dos lançamentos selecionados"
                  value={approvalRecipientId}
                  onChange={(event) =>
                    setApprovalRecipientId(event.target.value)
                  }
                  className="border border-zinc-200 dark:border-zinc-700 rounded-sm px-3 py-2 text-xs bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 dark:[color-scheme:dark]"
                >
                  <option value="">Cliente aprovador</option>
                  {approvalRecipients.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => approveBatch(selectedEligible)}
                  disabled={!approvalRecipientId}
                  title={
                    approvalRecipientId
                      ? "Enviar selecionados para aprovação"
                      : "Selecione o cliente aprovador"
                  }
                  className="bg-blue-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed dark:disabled:text-zinc-400 text-white rounded-sm px-3 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" /> Enviar para aprovação (
                  {selectedEligible.length})
                </button>
                <button
                  onClick={() => launchBatch(selectedEligible)}
                  className="bg-emerald-600 text-white rounded-sm px-3 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" /> Lançar selecionados (
                  {selectedEligible.length})
                </button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto xl:overflow-x-hidden">
            <table className="w-full table-fixed text-left text-[9px] [&_th]:px-1.5 [&_th]:py-2 [&_td]:px-1.5 [&_td]:py-2">
              <colgroup>
                <col className="w-7" />
                <col className="w-[18%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[9%]" />
                <col className="w-[9%]" />
                <col className="w-[12%]" />
                <col className="w-[8%]" />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
              </colgroup>
              <thead className="bg-zinc-50 dark:bg-[#091320]/60 text-[9px] uppercase text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="p-3 w-8">
                    <button
                      onClick={toggleAllEligible}
                      title="Selecionar todos os lançamentos aptos"
                      className={`block h-4 w-4 rounded border cursor-pointer ${eligibleDocuments.length > 0 && eligibleDocuments.every((item) => selectedIds.has(item.id)) ? "bg-blue-600 border-blue-600" : "bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600"}`}
                    >
                      {eligibleDocuments.length > 0 &&
                        eligibleDocuments.every((item) =>
                          selectedIds.has(item.id),
                        ) && <Check className="h-3.5 w-3.5 text-white" />}
                    </button>
                  </th>
                  <th className="p-3">Documento</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Fornecedor</th>
                  <th className="p-3 text-right">Valor</th>
                  <th className="p-3">Vencimento</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Origem</th>
                  <th className="p-3">Lançado por</th>
                  <th className="p-3">Recebido em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filtered.map((document) => (
                  <tr
                    key={document.id}
                    onClick={() => {
                      setSelectedId(document.id);
                      setDraft({});
                    }}
                    className={`cursor-pointer ${selected?.id === document.id ? "bg-blue-50/60 dark:bg-blue-500/10 outline outline-1 -outline-offset-1 outline-blue-200 dark:outline-blue-500/30" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"}`}
                  >
                    <td className="p-3">
                      <button
                        disabled={document.status !== "Aguardando Análise"}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleSelection(document.id);
                        }}
                        title={
                          document.status === "Aguardando Análise"
                            ? "Selecionar para lançamento em lote"
                            : "Este registro não está apto para lançamento"
                        }
                        className={`block h-4 w-4 rounded border disabled:cursor-not-allowed ${selectedIds.has(document.id) ? "bg-blue-600 border-blue-600" : document.status === "Aguardando Análise" ? "bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 cursor-pointer" : "bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700"}`}
                      >
                        {selectedIds.has(document.id) && (
                          <Check className="h-3.5 w-3.5 text-white" />
                        )}
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2 items-center">
                        <FileTypeIcon
                          name={document.name}
                          mimeType={document.mimeType}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-zinc-900 dark:text-zinc-50 truncate max-w-56 2xl:max-w-72">
                            {document.name}
                          </p>
                          <p className="text-[9px] text-zinc-400 dark:text-zinc-500">
                            {document.category}
                          </p>
                          {document.mimeType !== "application/x-manual-entry" && (
                            <DocumentDownloadButton
                              url={document.signedUrl}
                              name={document.name}
                              iconOnly
                              className="mt-1 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                            />
                          )}
                        </div>
                      </div>
                    </td>
                    <td
                      className="p-3 text-zinc-600 dark:text-zinc-300 truncate"
                      title={document.entryType || "Conta a Pagar"}
                    >
                      {document.entryType === "Conta a Pagar"
                        ? "A pagar"
                        : document.entryType === "Conta a Receber"
                          ? "A receber"
                          : document.entryType || "A pagar"}
                    </td>
                    <td
                      className="p-3 truncate"
                      title={document.supplier || "A confirmar"}
                    >
                      {document.supplier ? (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`h-5 w-5 rounded-full ${getAvatarTint(document.supplier)} text-white text-[8px] font-semibold flex items-center justify-center shrink-0`}
                          >
                            {getInitials(document.supplier)}
                          </span>
                          <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                            {document.supplier}
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500">
                          A confirmar
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono whitespace-nowrap text-zinc-800 dark:text-zinc-100">
                      {document.amount
                        ? `R$ ${document.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                        : "—"}
                    </td>
                    <td className="p-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                      {document.dueDate
                        ? new Date(
                            `${document.dueDate}T12:00:00`,
                          ).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[9px] font-semibold px-2 py-1 rounded whitespace-nowrap ${statusStyle[document.status]}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
                        {document.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-[9px] font-semibold px-2 py-1 rounded whitespace-nowrap ${(document.origin || (document.mimeType === "application/x-manual-entry" ? "Manual" : "Documento")) === "Manual" ? "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300" : "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"}`}
                      >
                        {document.origin ||
                          (document.mimeType === "application/x-manual-entry"
                            ? "Manual"
                            : "Documento")}
                      </span>
                    </td>
                    <td
                      className="p-3 text-zinc-600 dark:text-zinc-300 truncate"
                      title={
                        document.launchedByName ||
                        (document.status === "Lançado"
                          ? document.uploadedByName
                          : "Ainda não lançado")
                      }
                    >
                      {document.launchedByName ||
                        (document.status === "Lançado"
                          ? document.uploadedByName
                          : "Pendente")}
                    </td>
                    <td className="p-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {new Date(document.uploadedAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="p-12 text-center text-zinc-400 dark:text-zinc-500"
                    >
                      Nenhum documento encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-500 dark:text-zinc-400">
            Mostrando {filtered.length} de {companyDocuments.length} registros
          </div>
        </section>

        <aside className="bg-white dark:bg-[#091320] border border-zinc-200 dark:border-zinc-800 rounded-sm shadow-sm overflow-hidden xl:sticky xl:top-4">
          {selected ? (
            <>
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between gap-3">
                <div className="flex gap-3 min-w-0">
                  <FileTypeIcon
                    name={selected.name}
                    mimeType={selected.mimeType}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                      {selected.name}
                    </h3>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                      {selected.category} · Recebido{" "}
                      {new Date(selected.uploadedAt).toLocaleDateString(
                        "pt-BR",
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!isManualLaunch && (
                    <DocumentDownloadButton
                      url={selected.signedUrl}
                      name={selected.name}
                      iconOnly
                      className="text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                    />
                  )}
                  <span
                    className={`h-fit inline-flex items-center gap-1.5 text-[9px] font-semibold px-2 py-1 rounded whitespace-nowrap ${statusStyle[selected.status]}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
                    {selected.status}
                  </span>
                </div>
              </div>
              <div className="px-4 border-b border-zinc-200 dark:border-zinc-800 flex gap-5">
                <button className="py-3 text-[10px] font-semibold text-[#C8102E] border-b-2 border-[#C8102E]">
                  Dados do lançamento
                </button>
                <button className="py-3 text-[10px] text-zinc-400 dark:text-zinc-500">
                  Documento
                </button>
                <button className="py-3 text-[10px] text-zinc-400 dark:text-zinc-500">
                  Histórico
                </button>
              </div>
              <div className="p-4 space-y-3 max-h-[58vh] overflow-y-auto">
                {canEditSelected ? (
                  <div className="rounded-sm border border-blue-200 dark:border-[#3E6DA6]/40 bg-blue-50 dark:bg-[#123B6B]/20 px-3 py-2 text-[10px] text-blue-700 dark:text-[#9DB8D9]">
                    <strong>Campos editáveis</strong> —{" "}
                    {isManualLaunch
                      ? "as alterações serão sincronizadas com o registro financeiro vinculado."
                      : "confira e ajuste as informações destacadas abaixo."}
                  </div>
                ) : (
                  <div className="rounded-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                    <strong>Somente leitura</strong> —{" "}
                    {manualFinancialLocked
                      ? "a conta vinculada já foi liquidada, recebeu valores ou foi cancelada."
                      : "este lançamento não pode mais ser alterado neste status."}
                  </div>
                )}
                <fieldset
                  disabled={!canEditSelected}
                  className="space-y-3 disabled:cursor-not-allowed"
                >
                  <Field label="Tipo de lançamento" required>
                    <select
                      disabled={isManualLaunch && selected.status === "Lançado"}
                      title={
                        isManualLaunch && selected.status === "Lançado"
                          ? "O tipo não pode ser alterado após a criação do registro financeiro"
                          : undefined
                      }
                      value={String(value("entryType") || "Conta a Pagar")}
                      onChange={(e) =>
                        set(
                          "entryType",
                          e.target.value as Document["entryType"],
                        )
                      }
                    >
                      <option>Conta a Pagar</option>
                      <option>Conta a Receber</option>
                      <option>Transferência</option>
                    </select>
                  </Field>
                  {value("entryType") === "Transferência" ? (
                    <Field label="Identificação da transferência" required>
                      <input
                        value={String(value("supplier"))}
                        onChange={(e) => set("supplier", e.target.value)}
                      />
                    </Field>
                  ) : (
                    <QuickAddSelect
                      label={
                        value("entryType") === "Conta a Receber"
                          ? "Cliente"
                          : "Fornecedor"
                      }
                      required
                      labelClassName={FIELD_LABEL_CLASS}
                      selectClassName={FIELD_SELECT_CLASS}
                      placeholder="Selecione"
                      value={String(value("supplier"))}
                      onChange={(val) => set("supplier", val)}
                      options={
                        value("entryType") === "Conta a Receber"
                          ? customers
                          : suppliers
                      }
                      onAdd={(name) =>
                        addMasterData(
                          value("entryType") === "Conta a Receber"
                            ? "CUSTOMER"
                            : "SUPPLIER",
                          name,
                        )
                      }
                    />
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Valor" required>
                      <input
                        type="number"
                        step="0.01"
                        value={Number(value("amount")) || ""}
                        onChange={(e) => set("amount", Number(e.target.value))}
                      />
                    </Field>
                    <Field label="Vencimento" required>
                      <input
                        type="date"
                        value={String(value("dueDate"))}
                        onChange={(e) => set("dueDate", e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Número do documento">
                    <input
                      value={String(value("documentNumber"))}
                      onChange={(e) => set("documentNumber", e.target.value)}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Tipo" required>
                      <select
                        value={String(value("category"))}
                        onChange={(e) =>
                          set(
                            "category",
                            e.target.value as Document["category"],
                          )
                        }
                      >
                        {(documentTypes.length
                          ? documentTypes
                          : categoryOptions
                        ).map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    </Field>
                    <QuickAddSelect
                      label="Categoria"
                      labelClassName={FIELD_LABEL_CLASS}
                      selectClassName={FIELD_SELECT_CLASS}
                      placeholder="Selecione"
                      value={String(value("expenseType"))}
                      onChange={(val) => set("expenseType", val)}
                      options={financialCategories}
                      onAdd={(name) => addMasterData("CATEGORY", name)}
                    />
                    <QuickAddSelect
                      label="Centro de custo"
                      labelClassName={FIELD_LABEL_CLASS}
                      selectClassName={FIELD_SELECT_CLASS}
                      placeholder="A classificar"
                      value={String(value("costCenter"))}
                      onChange={(val) => set("costCenter", val)}
                      options={costCenters}
                      onAdd={(name) => addMasterData("COST_CENTER", name)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label={
                        value("entryType") === "Transferência"
                          ? "Conta de origem"
                          : "Conta bancária"
                      }
                    >
                      <select
                        value={String(value("bankAccountId"))}
                        onChange={(e) => set("bankAccountId", e.target.value)}
                      >
                        <option value="">A definir</option>
                        {bankAccounts
                          .filter((item) => item.companyId === activeCompany.id)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.bankName} · {item.accountNumber}
                            </option>
                          ))}
                      </select>
                    </Field>
                    {value("entryType") === "Transferência" && (
                      <Field label="Conta de destino" required>
                        <select
                          value={String(value("destinationBankAccountId"))}
                          onChange={(e) =>
                            set("destinationBankAccountId", e.target.value)
                          }
                        >
                          <option value="">Selecione</option>
                          {bankAccounts
                            .filter(
                              (item) =>
                                item.companyId === activeCompany.id &&
                                item.id !== value("bankAccountId"),
                            )
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.bankName} · {item.accountNumber}
                              </option>
                            ))}
                        </select>
                      </Field>
                    )}
                    <QuickAddSelect
                      label="Forma de pagamento"
                      labelClassName={FIELD_LABEL_CLASS}
                      selectClassName={FIELD_SELECT_CLASS}
                      placeholder="A definir"
                      value={String(value("paymentMethod"))}
                      onChange={(val) => set("paymentMethod", val)}
                      options={paymentMethods}
                      onAdd={(name) => addMasterData("PAYMENT_METHOD", name)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Recorrência">
                      <select
                        value={String(value("recurrence") || "Nenhuma")}
                        onChange={(e) =>
                          set(
                            "recurrence",
                            e.target.value as Document["recurrence"],
                          )
                        }
                      >
                        <option>Nenhuma</option>
                        <option>Parcelada</option>
                        <option>Semanal</option>
                        <option>Mensal</option>
                        <option>Trimestral</option>
                        <option>Anual</option>
                      </select>
                    </Field>
                    <Field label="Competência">
                      <input
                        type="month"
                        value={String(value("competenceMonth"))}
                        onChange={(e) => set("competenceMonth", e.target.value)}
                      />
                    </Field>
                  </div>
                  {value("recurrence") === "Parcelada" &&
                    value("entryType") !== "Transferência" && (
                      <Field label="Quantidade de parcelas" required>
                        <input
                          type="number"
                          min={2}
                          step={1}
                          value={String(value("installmentCount") || 2)}
                          onChange={(e) =>
                            set("installmentCount", Number(e.target.value))
                          }
                        />
                      </Field>
                    )}
                  <Field label="Observações">
                    <textarea
                      rows={2}
                      value={String(value("notes"))}
                      onChange={(e) => set("notes", e.target.value)}
                    />
                  </Field>
                </fieldset>
                {canEditSelected && Object.keys(draft).length > 0 && (
                  <button
                    onClick={save}
                    className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 cursor-pointer"
                  >
                    Salvar alterações
                  </button>
                )}
              </div>
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                  Ações do BPO
                </p>
                {selected.status === "Aguardando Análise" ? (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                      Cliente aprovador
                      <select
                        value={approvalRecipientId}
                        onChange={(event) =>
                          setApprovalRecipientId(event.target.value)
                        }
                        className="mt-1 w-full border border-zinc-200 dark:border-zinc-700 rounded-sm px-3 py-2 text-xs bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 dark:[color-scheme:dark]"
                      >
                        <option value="">Selecione o cliente</option>
                        {approvalRecipients.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {approvalRecipientId
                        ? `A aprovação será enviada para ${approvalRecipients.find((user) => user.id === approvalRecipientId)?.name}.`
                        : "Selecione o cliente aprovador acima."}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => act("launch")}
                        className="bg-emerald-600 text-white rounded-sm py-2 text-[10px] font-semibold flex justify-center items-center gap-1 cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5" /> Lançar
                      </button>
                      <button
                        onClick={() => act("approval")}
                        disabled={!approvalRecipientId}
                        className="bg-blue-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed dark:disabled:text-zinc-400 text-white rounded-sm py-2 text-[10px] font-semibold flex justify-center items-center gap-1 cursor-pointer"
                      >
                        <Send className="h-3.5 w-3.5" /> Aprovação
                      </button>
                      <button
                        onClick={() => act("cancel")}
                        className="bg-red-600 text-white rounded-sm py-2 text-[10px] font-semibold flex justify-center items-center gap-1 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" /> Cancelar
                      </button>
                    </div>
                  </div>
                ) : isManualLaunch && selected.status === "Lançado" ? (
                  <div className="space-y-2">
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      Edite os campos acima ou cancele o lançamento e o registro
                      financeiro vinculado.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={save}
                        disabled={
                          manualFinancialLocked ||
                          Object.keys(draft).length === 0
                        }
                        className="bg-blue-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed dark:disabled:text-zinc-400 text-white rounded-sm py-2 text-[10px] font-semibold flex justify-center items-center gap-1 cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5" /> Salvar alterações
                      </button>
                      <button
                        onClick={cancelManualLaunch}
                        disabled={manualFinancialLocked}
                        className="bg-red-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed dark:disabled:text-zinc-400 text-white rounded-sm py-2 text-[10px] font-semibold flex justify-center items-center gap-1 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" /> Cancelar lançamento
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    Este documento não possui ações pendentes para o BPO.
                  </p>
                )}
              </div>
              <div className="border-t border-zinc-200 dark:border-zinc-800 p-4">
                <button className="w-full flex justify-between text-[10px] font-semibold text-zinc-600 dark:text-zinc-300 cursor-pointer">
                  <span className="flex gap-2">
                    <Sparkles className="h-3.5 w-3.5" /> Informações extraídas
                    pelo assistente
                  </span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          ) : (
            <div className="p-16 text-center text-xs text-zinc-400 dark:text-zinc-500">
              Selecione um documento.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactElement;
}) {
  return (
    <label className="block text-[9px] font-semibold text-zinc-600 dark:text-zinc-400">
      {label}
      {required && <span className="text-red-500 dark:text-red-400"> *</span>}
      {React.cloneElement(children, {
        className:
          "mt-1 w-full rounded-sm border border-blue-200 dark:border-[#3E6DA6]/40 bg-blue-50/60 dark:bg-[#123B6B]/10 px-2.5 py-2 text-xs text-zinc-800 dark:text-zinc-100 shadow-sm transition-colors hover:border-blue-400 dark:hover:border-[#3E6DA6]/70 hover:bg-blue-50 dark:hover:bg-[#123B6B]/20 focus:border-[#0B2C52] dark:focus:border-[#9DB8D9] focus:bg-white dark:focus:bg-[#091320] focus:outline-none focus:ring-2 focus:ring-[#0B2C52]/15 dark:focus:ring-[#9DB8D9]/20 disabled:cursor-not-allowed disabled:border-zinc-200 dark:disabled:border-zinc-700 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-500 disabled:shadow-none dark:[color-scheme:dark]",
      } as React.HTMLAttributes<HTMLElement>)}
    </label>
  );
}
