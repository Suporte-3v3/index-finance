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
  Trash2,
  X,
} from "lucide-react";
import { useBPOState } from "../hooks/useBPOState";
import { Document } from "../types";
import FileTypeIcon from "../components/FileTypeIcon";
import DocumentDownloadButton from "../components/DocumentDownloadButton";
import ImportEntriesActions from "../components/ImportEntriesActions";
import QuickAddSelect from "../components/QuickAddSelect";
import CurrencyInput from "../components/CurrencyInput";
import { Badge, BadgeTone, BrazilianDateInput, BrazilianMonthInput, Button, Card, ConfirmDialog, MetricCard, Modal, useToast } from "../components/ui";
import { MetricTone } from "../components/ui/MetricCard";
import { formatDate, formatDateTime } from "../services/dateFormatters";

const STATUS: Document["status"][] = [
  "Aguardando Análise",
  "Aguardando Aprovação",
  "Lançado",
  "Cancelado",
];
const STATUS_TONE: Record<Document["status"], BadgeTone> = {
  "Aguardando Análise": "gold",
  "Aguardando Aprovação": "navy",
  Compartilhado: "navy",
  Lançado: "green",
  Cancelado: "neutral",
};
// Pílulas compactas para as colunas Status/Origem da grade densa (table-fixed) —
// o Badge padrão (rounded-full + dot) não cabe nas colunas estreitas de 8-12%.
const PILL_TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "bg-zinc-100 text-zinc-600 dark:bg-white/5 dark:text-ink-soft-dark",
  navy: "bg-brand-blue-50 text-brand-navy-900 dark:bg-brand-navy-700/20 dark:text-brand-navy-700/90",
  red: "bg-brand-red-50 text-brand-red-600 dark:bg-brand-red-600/15 dark:text-red-300",
  green: "bg-brand-green-50 text-brand-green-600 dark:bg-brand-green-600/15 dark:text-emerald-300",
  gold: "bg-brand-gold-300/25 text-amber-700 dark:bg-brand-gold-600/15 dark:text-brand-gold-300",
};
const STATUS_VISUALS: Record<
  Document["status"],
  { icon: typeof Clock; tone: MetricTone }
> = {
  "Aguardando Análise": { icon: Clock, tone: "gold" },
  "Aguardando Aprovação": { icon: Send, tone: "navy" },
  Compartilhado: { icon: Send, tone: "navy" },
  Lançado: { icon: Check, tone: "green" },
  Cancelado: { icon: X, tone: "neutral" },
};
const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
// Estilo dos inputs/selects dentro de <Field>, reaproveitado nos QuickAddSelect
// para que o botão "+" de cadastro rápido fique visualmente igual aos demais campos.
const FIELD_LABEL_CLASS =
  "block text-[9px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide";
const FIELD_SELECT_CLASS =
  "mt-1 w-full rounded-lg border border-line dark:border-line-dark bg-canvas dark:bg-white/5 px-2.5 py-2 text-xs text-ink dark:text-ink-dark shadow-sm transition-colors hover:border-brand-navy-700/40 dark:hover:border-brand-navy-700/50 focus:border-brand-navy-700 focus:bg-surface dark:focus:bg-surface-dark focus:outline-none focus:ring-2 focus:ring-brand-navy-700/20 dark:[color-scheme:dark]";
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
  amount: 0,
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
  const { showToast } = useToast();
  const {
    activeCompany,
    currentUser,
    users,
    documents,
    accountsPayable,
    accountsReceivable,
    bankAccounts,
    masterData,
    refreshDocumentRecords,
    updateDocument,
    launchDocument,
    submitDocumentForApproval,
    cancelDocument,
    deleteDocuments,
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
  const [documentsToDelete, setDocumentsToDelete] = useState<Document[]>([]);
  const [deleting, setDeleting] = useState(false);
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
  useEffect(() => {
    void refreshDocumentRecords().catch((error) => {
      console.error(
        "Falha ao carregar a fila de documentos:",
        error instanceof Error ? error.message : error,
      );
    });
  }, [refreshDocumentRecords]);
  useEffect(() => setApprovalRecipientId(""), [activeCompany?.id]);
  if (!["BPO_ADMIN", "BPO_TEAM"].includes(currentUser.role)) {
    return (
      <Card className="text-center text-xs text-ink-soft dark:text-ink-soft-dark">
        A fila de lançamentos é exclusiva da equipe BPO.
      </Card>
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
  const selectedDocuments = filtered.filter((item) => selectedIds.has(item.id));
  const selectedEligible = selectedDocuments.filter(
    (item) => item.status === "Aguardando Análise",
  );
  const toggleSelection = (id: string) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleAllFiltered = () =>
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected =
        filtered.length > 0 && filtered.every((item) => next.has(item.id));
      filtered.forEach((item) =>
        allSelected ? next.delete(item.id) : next.add(item.id),
      );
      return next;
    });

  const confirmDeleteDocuments = async () => {
    if (!documentsToDelete.length) return;
    setDeleting(true);
    const ids = documentsToDelete.map((item) => item.id);
    const deletedIds = await deleteDocuments(ids);
    setDeleting(false);
    if (deletedIds.length !== ids.length) {
      showToast(
        "error",
        "Não foi possível excluir os lançamentos.",
        "Atualize a tela, confira suas permissões e tente novamente.",
      );
      return;
    }
    const deletedSet = new Set(deletedIds);
    setSelectedIds((current) => {
      const next = new Set(current);
      deletedIds.forEach((id) => next.delete(id));
      return next;
    });
    if (selectedId && deletedSet.has(selectedId)) setSelectedId(null);
    setDocumentsToDelete([]);
    showToast(
      "success",
      `${deletedIds.length} lançamento(s) excluído(s).`,
      "Os registros foram removidos da fila de Lançamentos.",
    );
  };
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
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink dark:text-ink-dark tracking-tight">
            Lançamentos
          </h1>
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark leading-relaxed mt-1">
            Confira documentos recebidos ou registre um lançamento avulso
            diretamente no financeiro.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <ImportEntriesActions />
          <Button icon={<Plus className="h-4 w-4" />} variant="secondary" onClick={() => setNewLaunchOpen(true)}>
            Novo lançamento
          </Button>
        </div>
      </div>

      <Modal
        open={newLaunchOpen}
        onClose={() => setNewLaunchOpen(false)}
        title="Novo lançamento avulso"
        description="Será incluído diretamente no financeiro com status Lançado, sem aprovação do cliente."
        size="lg"
        footer={
          <>
            <Button variant="text" onClick={() => setNewLaunchOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="standalone-launch-form"
              className="bg-brand-green-600! hover:bg-emerald-600!"
              icon={<Check className="h-4 w-4" />}
            >
              Criar como lançado
            </Button>
          </>
        }
      >
        <form
          id="standalone-launch-form"
          onSubmit={submitStandalone}
          className="grid sm:grid-cols-2 gap-3"
        >
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
            <CurrencyInput
              required
              value={newLaunch.amount}
              onChange={(amount) =>
                setNewLaunch({ ...newLaunch, amount })
              }
            />
          </Field>
          <Field label="Vencimento" required>
            <BrazilianDateInput
              required
              value={newLaunch.dueDate}
              onValueChange={(dueDate) =>
                setNewLaunch({ ...newLaunch, dueDate })
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
            <BrazilianMonthInput
              required
              value={newLaunch.competenceMonth}
              onValueChange={(competenceMonth) =>
                setNewLaunch({
                  ...newLaunch,
                  competenceMonth,
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
        </form>
      </Modal>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {STATUS.map((status) => {
          const visual = STATUS_VISUALS[status];
          return (
            <MetricCard
              key={status}
              icon={<visual.icon strokeWidth={2.25} />}
              label={status}
              value={String(counts(status))}
              helpText="Documentos"
              tone={visual.tone}
              onClick={() => setStatusFilter(status)}
              className={
                statusFilter === status
                  ? "border-brand-navy-700 ring-2 ring-brand-navy-700/15"
                  : undefined
              }
            />
          );
        })}
      </div>

      <div className="grid xl:grid-cols-[minmax(0,2.35fr)_minmax(340px,0.85fr)] 2xl:grid-cols-[minmax(0,2.6fr)_minmax(360px,0.8fr)] gap-4 items-start">
        <Card padding={false} className="overflow-hidden">
          <div className="p-3 border-b border-line dark:border-line-dark flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-2 rounded-lg text-[10px] font-semibold cursor-pointer transition-colors ${statusFilter === "ALL" ? "bg-brand-navy-900 text-white" : "bg-canvas dark:bg-white/5 text-ink dark:text-ink-dark"}`}
            >
              Todos{" "}
              <span className="ml-1 opacity-70">{companyDocuments.length}</span>
            </button>
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-ink-soft dark:text-ink-soft-dark" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar documento ou fornecedor..."
                className="w-full bg-canvas dark:bg-white/5 text-ink dark:text-ink-dark placeholder:text-ink-soft dark:placeholder:text-ink-soft-dark border border-line dark:border-line-dark rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30"
              />
            </div>
            <button className="border border-line dark:border-line-dark text-ink dark:text-ink-dark hover:bg-canvas dark:hover:bg-white/5 rounded-lg px-3 text-xs flex items-center gap-1.5 cursor-pointer">
              <Filter className="h-3.5 w-3.5" /> Filtros
            </button>
            {selectedDocuments.length > 0 && (
              <div className="flex w-full flex-wrap items-center gap-2 border-t border-line pt-3 dark:border-line-dark">
                <Badge tone="navy">{selectedDocuments.length} selecionado(s)</Badge>
                {selectedEligible.length > 0 && (
                  <>
                    <select
                      aria-label="Cliente aprovador dos lançamentos selecionados"
                      value={approvalRecipientId}
                      onChange={(event) =>
                        setApprovalRecipientId(event.target.value)
                      }
                      className="border border-line dark:border-line-dark rounded-lg px-3 py-2 text-xs bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark dark:[color-scheme:dark]"
                    >
                      <option value="">Cliente aprovador</option>
                      {approvalRecipients.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!approvalRecipientId}
                      title={
                        approvalRecipientId
                          ? "Enviar selecionados para aprovação"
                          : "Selecione o cliente aprovador"
                      }
                      icon={<Send className="h-3.5 w-3.5" />}
                      onClick={() => approveBatch(selectedEligible)}
                    >
                      Enviar para aprovação ({selectedEligible.length})
                    </Button>
                    <Button
                      size="sm"
                      className="bg-brand-green-600! hover:bg-emerald-600!"
                      icon={<Check className="h-3.5 w-3.5" />}
                      onClick={() => launchBatch(selectedEligible)}
                    >
                      Lançar selecionados ({selectedEligible.length})
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={() => setDocumentsToDelete(selectedDocuments)}
                >
                  Excluir selecionados ({selectedDocuments.length})
                </Button>
                <Button size="sm" variant="text" onClick={() => setSelectedIds(new Set())}>
                  Limpar seleção
                </Button>
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
              <thead className="bg-canvas/70 dark:bg-white/[0.03] text-[9px] uppercase text-ink-soft dark:text-ink-soft-dark">
                <tr>
                  <th className="p-3 w-8">
                    <button
                      onClick={toggleAllFiltered}
                      title="Selecionar todos os lançamentos exibidos"
                      className={`block h-4 w-4 rounded border cursor-pointer ${filtered.length > 0 && filtered.every((item) => selectedIds.has(item.id)) ? "bg-brand-navy-900 border-brand-navy-900" : "bg-surface dark:bg-surface-dark border-line dark:border-line-dark"}`}
                    >
                      {filtered.length > 0 &&
                        filtered.every((item) =>
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
                  <th className="p-3">Enviado/Lançado por</th>
                  <th className="p-3">Recebido em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line dark:divide-line-dark">
                {filtered.map((document) => (
                  <tr
                    key={document.id}
                    onClick={() => {
                      setSelectedId(document.id);
                      setDraft({});
                    }}
                    className={`cursor-pointer transition-colors ${selected?.id === document.id ? "bg-brand-blue-50 dark:bg-brand-navy-700/15 outline outline-1 -outline-offset-1 outline-brand-navy-700/30" : "hover:bg-canvas dark:hover:bg-white/[0.03]"}`}
                  >
                    <td className="p-3">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleSelection(document.id);
                        }}
                        title="Selecionar lançamento"
                        className={`block h-4 w-4 rounded border cursor-pointer ${selectedIds.has(document.id) ? "bg-brand-navy-900 border-brand-navy-900" : "bg-surface dark:bg-surface-dark border-line dark:border-line-dark"}`}
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
                          <p className="font-semibold text-ink dark:text-ink-dark truncate max-w-56 2xl:max-w-72">
                            {document.name}
                          </p>
                          <p className="text-[9px] text-ink-soft dark:text-ink-soft-dark">
                            {document.category}
                          </p>
                          <div className="mt-1 flex items-center gap-1">
                            {document.mimeType !== "application/x-manual-entry" && (
                              <DocumentDownloadButton
                                url={document.signedUrl}
                                name={document.name}
                                iconOnly
                                className="text-brand-green-600 dark:text-emerald-300 hover:bg-brand-green-50 dark:hover:bg-brand-green-600/10"
                              />
                            )}
                            <button
                              type="button"
                              title="Excluir lançamento"
                              aria-label={`Excluir ${document.name}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setDocumentsToDelete([document]);
                              }}
                              className="rounded-md p-1 text-brand-red-600 transition-colors hover:bg-brand-red-50 dark:hover:bg-brand-red-600/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td
                      className="p-3 text-ink dark:text-ink-dark truncate"
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
                          <span className="h-5 w-5 rounded-full bg-brand-navy-900 text-white text-[8px] font-semibold flex items-center justify-center shrink-0">
                            {getInitials(document.supplier)}
                          </span>
                          <span className="truncate font-medium text-ink dark:text-ink-dark">
                            {document.supplier}
                          </span>
                        </div>
                      ) : (
                        <span className="text-ink-soft dark:text-ink-soft-dark">
                          A confirmar
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono whitespace-nowrap text-ink dark:text-ink-dark">
                      {document.amount
                        ? `R$ ${document.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                        : "—"}
                    </td>
                    <td className="p-3 whitespace-nowrap text-ink dark:text-ink-dark">
                      {document.dueDate ? formatDate(document.dueDate) : "—"}
                    </td>
                    <td className="p-3">
                      <span className={`inline-block whitespace-nowrap text-[9px] font-semibold px-1.5 py-1 rounded ${PILL_TONE_CLASS[STATUS_TONE[document.status]]}`}>
                        {document.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block whitespace-nowrap text-[9px] font-semibold px-1.5 py-1 rounded ${PILL_TONE_CLASS[
                          (document.origin || (document.mimeType === "application/x-manual-entry" ? "Manual" : "Documento")) === "Manual"
                            ? "gold"
                            : "navy"
                        ]}`}
                      >
                        {document.origin ||
                          (document.mimeType === "application/x-manual-entry"
                            ? "Manual"
                            : "Documento")}
                      </span>
                    </td>
                    <td
                      className="p-3 text-ink dark:text-ink-dark truncate"
                      title={
                        document.launchedByName ||
                        document.uploadedByName
                      }
                    >
                      {document.launchedByName || document.uploadedByName}
                    </td>
                    <td className="p-3 text-ink-soft dark:text-ink-soft-dark whitespace-nowrap">
                      {formatDateTime(document.uploadedAt)}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="p-12 text-center text-ink-soft dark:text-ink-soft-dark"
                    >
                      Nenhum documento encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-line dark:border-line-dark text-[10px] text-ink-soft dark:text-ink-soft-dark">
            Mostrando {filtered.length} de {companyDocuments.length} registros
          </div>
        </Card>

        <Card padding={false} className="overflow-hidden xl:sticky xl:top-4">
          {selected ? (
            <>
              <div className="p-4 border-b border-line dark:border-line-dark flex justify-between gap-3">
                <div className="flex gap-3 min-w-0">
                  <FileTypeIcon
                    name={selected.name}
                    mimeType={selected.mimeType}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold text-ink dark:text-ink-dark truncate">
                      {selected.name}
                    </h3>
                    <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark mt-1">
                      {selected.category} · Recebido{" "}
                      {formatDate(selected.uploadedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!isManualLaunch && (
                    <DocumentDownloadButton
                      url={selected.signedUrl}
                      name={selected.name}
                      iconOnly
                      className="text-brand-green-600 dark:text-emerald-300 hover:bg-brand-green-50 dark:hover:bg-brand-green-600/10"
                    />
                  )}
                  <Badge tone={STATUS_TONE[selected.status]} dot className="h-fit whitespace-nowrap">
                    {selected.status}
                  </Badge>
                </div>
              </div>
              <div className="px-4 border-b border-line dark:border-line-dark flex gap-5">
                <button className="py-3 text-[10px] font-semibold text-brand-red-600 border-b-2 border-brand-red-600">
                  Dados do lançamento
                </button>
                <button className="py-3 text-[10px] text-ink-soft dark:text-ink-soft-dark">
                  Documento
                </button>
                <button className="py-3 text-[10px] text-ink-soft dark:text-ink-soft-dark">
                  Histórico
                </button>
              </div>
              <div className="p-4 space-y-3 max-h-[58vh] overflow-y-auto">
                {canEditSelected ? (
                  <div className="rounded-lg border border-brand-navy-700/20 dark:border-brand-navy-700/25 bg-brand-blue-50 dark:bg-brand-navy-700/15 px-3 py-2 text-[10px] text-brand-navy-900 dark:text-brand-navy-700/90">
                    <strong>Campos editáveis</strong> —{" "}
                    {isManualLaunch
                      ? "as alterações serão sincronizadas com o registro financeiro vinculado."
                      : "confira e ajuste as informações destacadas abaixo."}
                  </div>
                ) : (
                  <div className="rounded-lg border border-line dark:border-line-dark bg-canvas dark:bg-white/5 px-3 py-2 text-[10px] text-ink-soft dark:text-ink-soft-dark">
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
                      <CurrencyInput
                        required
                        value={Number(value("amount")) || 0}
                        onChange={(amount) => set("amount", amount)}
                      />
                    </Field>
                    <Field label="Vencimento" required>
                      <BrazilianDateInput
                        value={String(value("dueDate"))}
                        onValueChange={(dueDate) => set("dueDate", dueDate)}
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
                      <BrazilianMonthInput
                        value={String(value("competenceMonth"))}
                        onValueChange={(competenceMonth) => set("competenceMonth", competenceMonth)}
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
                    className="text-[10px] font-semibold text-brand-navy-900 dark:text-brand-navy-700/90 cursor-pointer hover:underline"
                  >
                    Salvar alterações
                  </button>
                )}
              </div>
              <div className="p-4 border-t border-line dark:border-line-dark">
                <p className="text-xs font-semibold text-ink dark:text-ink-dark mb-3">
                  Ações do BPO
                </p>
                {selected.status === "Aguardando Análise" ? (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark">
                      Cliente aprovador
                      <select
                        value={approvalRecipientId}
                        onChange={(event) =>
                          setApprovalRecipientId(event.target.value)
                        }
                        className="mt-1 w-full border border-line dark:border-line-dark rounded-lg px-3 py-2 text-xs bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark dark:[color-scheme:dark]"
                      >
                        <option value="">Selecione o cliente</option>
                        {approvalRecipients.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark">
                      {approvalRecipientId
                        ? `A aprovação será enviada para ${approvalRecipients.find((user) => user.id === approvalRecipientId)?.name}.`
                        : "Selecione o cliente aprovador acima."}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => act("launch")}
                        className="bg-brand-green-600 hover:bg-emerald-600 text-white rounded-lg py-2 text-[10px] font-semibold flex justify-center items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" /> Lançar
                      </button>
                      <button
                        onClick={() => act("approval")}
                        disabled={!approvalRecipientId}
                        className="bg-brand-navy-900 hover:bg-brand-navy-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed dark:disabled:text-ink-soft-dark text-white rounded-lg py-2 text-[10px] font-semibold flex justify-center items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Send className="h-3.5 w-3.5" /> Aprovação
                      </button>
                      <button
                        onClick={() => act("cancel")}
                        className="bg-brand-red-600 hover:bg-brand-red-500 text-white rounded-lg py-2 text-[10px] font-semibold flex justify-center items-center gap-1 cursor-pointer transition-colors"
                      >
                        <X className="h-3.5 w-3.5" /> Cancelar
                      </button>
                    </div>
                  </div>
                ) : isManualLaunch && selected.status === "Lançado" ? (
                  <div className="space-y-2">
                    <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark">
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
                        className="bg-brand-navy-900 hover:bg-brand-navy-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed dark:disabled:text-ink-soft-dark text-white rounded-lg py-2 text-[10px] font-semibold flex justify-center items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" /> Salvar alterações
                      </button>
                      <button
                        onClick={cancelManualLaunch}
                        disabled={manualFinancialLocked}
                        className="bg-brand-red-600 hover:bg-brand-red-500 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed dark:disabled:text-ink-soft-dark text-white rounded-lg py-2 text-[10px] font-semibold flex justify-center items-center gap-1 cursor-pointer transition-colors"
                      >
                        <X className="h-3.5 w-3.5" /> Cancelar lançamento
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark">
                    Este documento não possui ações pendentes para o BPO.
                  </p>
                )}
                <Button
                  fullWidth
                  size="sm"
                  variant="outline"
                  className="mt-3 border-brand-red-600/30 text-brand-red-600 hover:bg-brand-red-50 dark:hover:bg-brand-red-600/10"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={() => setDocumentsToDelete([selected])}
                >
                  Excluir da fila de Lançamentos
                </Button>
              </div>
              <div className="border-t border-line dark:border-line-dark p-4">
                <button className="w-full flex justify-between text-[10px] font-semibold text-ink dark:text-ink-dark cursor-pointer">
                  <span className="flex gap-2">
                    <Sparkles className="h-3.5 w-3.5" /> Informações extraídas
                    pelo assistente
                  </span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          ) : (
            <div className="p-16 text-center text-xs text-ink-soft dark:text-ink-soft-dark">
              Selecione um documento.
            </div>
          )}
        </Card>
      </div>
      <ConfirmDialog
        open={documentsToDelete.length > 0}
        onClose={() => setDocumentsToDelete([])}
        onConfirm={() => void confirmDeleteDocuments()}
        loading={deleting}
        title={
          documentsToDelete.length === 1
            ? "Excluir este lançamento?"
            : `Excluir ${documentsToDelete.length} lançamentos?`
        }
        description={
          documentsToDelete.some((item) => item.status === "Lançado")
            ? "Os itens serão removidos da fila de Lançamentos. Registros já efetivados permanecem no Contas a Pagar ou Contas a Receber; para desfazê-los financeiramente, use a ação Cancelar lançamento antes da exclusão."
            : "Os itens selecionados serão removidos da fila de Lançamentos e a exclusão ficará registrada nos logs."
        }
        confirmLabel={documentsToDelete.length === 1 ? "Excluir lançamento" : "Excluir selecionados"}
      />
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
    <label className="block text-[9px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide">
      {label}
      {required && <span className="text-brand-red-600"> *</span>}
      {React.cloneElement(children, {
        className:
          "mt-1 w-full rounded-lg border border-line dark:border-line-dark bg-canvas dark:bg-white/5 px-2.5 py-2 text-xs text-ink dark:text-ink-dark shadow-sm transition-colors hover:border-brand-navy-700/40 dark:hover:border-brand-navy-700/50 focus:border-brand-navy-700 focus:bg-surface dark:focus:bg-surface-dark focus:outline-none focus:ring-2 focus:ring-brand-navy-700/20 disabled:cursor-not-allowed disabled:border-line dark:disabled:border-line-dark disabled:bg-zinc-100 dark:disabled:bg-white/5 disabled:text-ink-soft dark:disabled:text-ink-soft-dark disabled:shadow-none dark:[color-scheme:dark]",
      } as React.HTMLAttributes<HTMLElement>)}
    </label>
  );
}
