import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
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

const STATUS: Document["status"][] = [
  "Aguardando Análise",
  "Aguardando Aprovação",
  "Lançado",
  "Cancelado",
];
const statusStyle: Record<Document["status"], string> = {
  "Aguardando Análise": "bg-amber-50 text-amber-700",
  "Aguardando Aprovação": "bg-blue-50 text-blue-700",
  Lançado: "bg-emerald-50 text-emerald-700",
  Cancelado: "bg-zinc-100 text-zinc-500",
};
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
  competenceMonth: new Date().toISOString().slice(0, 7),
  notes: "",
};

export default function DocumentsReceivedView() {
  const {
    activeCompany,
    documents,
    bankAccounts,
    masterData,
    updateDocument,
    launchDocument,
    submitDocumentForApproval,
    cancelDocument,
    createStandaloneLaunch,
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
  const companyDocuments = useMemo(
    () => documents.filter((item) => item.companyId === activeCompany?.id),
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

  useEffect(() => {
    if (!selectedId && filtered[0]) setSelectedId(filtered[0].id);
  }, [selectedId, filtered]);
  if (!activeCompany) return null;
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
    if (selected && Object.keys(draft).length)
      updateDocument(selected.id, draft);
    setDraft({});
  };
  const act = (action: "launch" | "approval" | "cancel") => {
    if (!selected) return;
    if (Object.keys(draft).length) updateDocument(selected.id, draft);
    if (action === "launch") launchDocument(selected.id, draft);
    if (action === "approval") submitDocumentForApproval(selected.id, draft);
    if (action === "cancel") cancelDocument(selected.id);
    setDraft({});
  };
  const counts = (status: Document["status"]) =>
    companyDocuments.filter((item) => item.status === status).length;
  const submitStandalone = (event: React.FormEvent) => {
    event.preventDefault();
    createStandaloneLaunch({
      ...newLaunch,
      amount: Number(newLaunch.amount),
      entryType: newLaunch.entryType,
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
    const message = `Você enviará ${items.length} ${items.length === 1 ? "lançamento" : "lançamentos"} para aprovação do cliente. Deseja continuar?`;
    if (!window.confirm(message)) return;
    items.forEach((item) => submitDocumentForApproval(item.id));
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Lançamentos</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Confira documentos recebidos ou registre um lançamento avulso
            diretamente no financeiro.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            onClick={() => setNewLaunchOpen(true)}
            className="bg-[#0B2C52] text-white rounded-lg px-4 py-2.5 text-xs font-bold flex items-center gap-2 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Novo lançamento
          </button>
        </div>
      </div>

      {newLaunchOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setNewLaunchOpen(false)}
        >
          <form
            onSubmit={submitStandalone}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden"
          >
            <div className="p-5 border-b flex justify-between">
              <div>
                <h3 className="font-bold">Novo lançamento avulso</h3>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Será incluído diretamente no financeiro com status Lançado.
                </p>
              </div>
              <button type="button" onClick={() => setNewLaunchOpen(false)}>
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
              <Field
                label={
                  newLaunch.entryType === "Conta a Receber"
                    ? "Cliente"
                    : newLaunch.entryType === "Transferência"
                      ? "Identificação da transferência"
                      : "Fornecedor"
                }
                required
              >
                {newLaunch.entryType === "Transferência" ? (
                  <input
                    required
                    value={newLaunch.supplier}
                    onChange={(e) =>
                      setNewLaunch({ ...newLaunch, supplier: e.target.value })
                    }
                  />
                ) : (
                  <select
                    required
                    value={newLaunch.supplier}
                    onChange={(e) =>
                      setNewLaunch({ ...newLaunch, supplier: e.target.value })
                    }
                  >
                    <option value="">Selecione</option>
                    {(newLaunch.entryType === "Conta a Receber"
                      ? customers
                      : suppliers
                    ).map((item) => (
                      <option key={item.id}>{item.name}</option>
                    ))}
                  </select>
                )}
              </Field>
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
              <Field label="Categoria">
                <select
                  value={newLaunch.expenseType}
                  onChange={(e) =>
                    setNewLaunch({
                      ...newLaunch,
                      expenseType: e.target.value,
                    })
                  }
                >
                  <option value="">Selecione</option>
                  {financialCategories.map((item) => (
                    <option key={item.id}>{item.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Centro de custo">
                <select
                  value={newLaunch.costCenter}
                  onChange={(e) =>
                    setNewLaunch({ ...newLaunch, costCenter: e.target.value })
                  }
                >
                  <option value="">A classificar</option>
                  {costCenters.map((item) => (
                    <option key={item.id}>{item.name}</option>
                  ))}
                </select>
              </Field>
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
              <Field label="Forma de pagamento">
                <select
                  value={newLaunch.paymentMethod}
                  onChange={(e) =>
                    setNewLaunch({
                      ...newLaunch,
                      paymentMethod: e.target.value,
                    })
                  }
                >
                  <option value="">A definir</option>
                  {paymentMethods.map((item) => (
                    <option key={item.id}>{item.name}</option>
                  ))}
                </select>
              </Field>
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
                  <option>Semanal</option>
                  <option>Mensal</option>
                  <option>Trimestral</option>
                  <option>Anual</option>
                </select>
              </Field>
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
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewLaunchOpen(false)}
                className="px-4 py-2 text-xs font-bold text-zinc-500"
              >
                Cancelar
              </button>
              <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold flex gap-1.5 items-center">
                <Check className="h-4 w-4" /> Criar como lançado
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {STATUS.map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`bg-white rounded-xl border p-4 text-left cursor-pointer transition ${statusFilter === status ? "border-[#0B2C52] ring-2 ring-[#0B2C52]/10" : "border-zinc-200 hover:border-zinc-300"}`}
          >
            <p className="text-[10px] text-zinc-500 font-bold">{status}</p>
            <p className="text-2xl font-black mt-1">{counts(status)}</p>
            <p className="text-[9px] text-zinc-400">Documentos</p>
          </button>
        ))}
      </div>

      <div className="grid xl:grid-cols-[minmax(0,2.35fr)_minmax(340px,0.85fr)] 2xl:grid-cols-[minmax(0,2.6fr)_minmax(360px,0.8fr)] gap-4 items-start">
        <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-3 border-b flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-2 rounded-lg text-[10px] font-bold cursor-pointer ${statusFilter === "ALL" ? "bg-[#0B2C52] text-white" : "bg-zinc-50 text-zinc-600"}`}
            >
              Todos{" "}
              <span className="ml-1 opacity-70">{companyDocuments.length}</span>
            </button>
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar documento ou fornecedor..."
                className="w-full border rounded-lg pl-9 pr-3 py-2 text-xs"
              />
            </div>
            <button className="border rounded-lg px-3 text-xs flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5" /> Filtros
            </button>
            {selectedEligible.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => approveBatch(selectedEligible)}
                  className="bg-blue-600 text-white rounded-lg px-3 py-2 text-xs font-bold flex items-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" /> Enviar para aprovação (
                  {selectedEligible.length})
                </button>
                <button
                  onClick={() => launchBatch(selectedEligible)}
                  className="bg-emerald-600 text-white rounded-lg px-3 py-2 text-xs font-bold flex items-center gap-1.5"
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
              <thead className="bg-zinc-50 text-[9px] uppercase text-zinc-500">
                <tr>
                  <th className="p-3 w-8">
                    <button
                      onClick={toggleAllEligible}
                      title="Selecionar todos os lançamentos aptos"
                      className={`block h-4 w-4 rounded border cursor-pointer ${eligibleDocuments.length > 0 && eligibleDocuments.every((item) => selectedIds.has(item.id)) ? "bg-blue-600 border-blue-600" : "bg-white border-zinc-300"}`}
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
              <tbody className="divide-y">
                {filtered.map((document) => (
                  <tr
                    key={document.id}
                    onClick={() => {
                      setSelectedId(document.id);
                      setDraft({});
                    }}
                    className={`cursor-pointer ${selected?.id === document.id ? "bg-blue-50/60 outline outline-1 -outline-offset-1 outline-blue-200" : "hover:bg-zinc-50"}`}
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
                        className={`block h-4 w-4 rounded border disabled:cursor-not-allowed ${selectedIds.has(document.id) ? "bg-blue-600 border-blue-600" : document.status === "Aguardando Análise" ? "bg-white border-zinc-300 cursor-pointer" : "bg-zinc-100 border-zinc-200"}`}
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
                          <p className="font-bold truncate max-w-56 2xl:max-w-72">
                            {document.name}
                          </p>
                          <p className="text-[9px] text-zinc-400">
                            {document.category}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td
                      className="p-3 text-zinc-600 truncate"
                      title={document.entryType || "Conta a Pagar"}
                    >
                      {document.entryType === "Conta a Pagar"
                        ? "A pagar"
                        : document.entryType === "Conta a Receber"
                          ? "A receber"
                          : document.entryType || "A pagar"}
                    </td>
                    <td
                      className="p-3 font-medium truncate"
                      title={document.supplier || "A confirmar"}
                    >
                      {document.supplier || "A confirmar"}
                    </td>
                    <td className="p-3 text-right font-mono whitespace-nowrap">
                      {document.amount
                        ? `R$ ${document.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                        : "—"}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {document.dueDate
                        ? new Date(
                            `${document.dueDate}T12:00:00`,
                          ).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-[9px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${statusStyle[document.status]}`}
                      >
                        {document.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-[9px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${(document.origin || (document.mimeType === "application/x-manual-entry" ? "Manual" : "Documento")) === "Manual" ? "bg-violet-50 text-violet-700" : "bg-sky-50 text-sky-700"}`}
                      >
                        {document.origin ||
                          (document.mimeType === "application/x-manual-entry"
                            ? "Manual"
                            : "Documento")}
                      </span>
                    </td>
                    <td
                      className="p-3 text-zinc-600 truncate"
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
                    <td className="p-3 text-zinc-500 whitespace-nowrap">
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
                    <td colSpan={10} className="p-12 text-center text-zinc-400">
                      Nenhum documento encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t text-[10px] text-zinc-500">
            Mostrando {filtered.length} de {companyDocuments.length} registros
          </div>
        </section>

        <aside className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden xl:sticky xl:top-4">
          {selected ? (
            <>
              <div className="p-4 border-b flex justify-between gap-3">
                <div className="flex gap-3 min-w-0">
                  <FileTypeIcon
                    name={selected.name}
                    mimeType={selected.mimeType}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold truncate">
                      {selected.name}
                    </h3>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {selected.category} · Recebido{" "}
                      {new Date(selected.uploadedAt).toLocaleDateString(
                        "pt-BR",
                      )}
                    </p>
                  </div>
                </div>
                <span
                  className={`h-fit text-[9px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${statusStyle[selected.status]}`}
                >
                  {selected.status}
                </span>
              </div>
              <div className="px-4 border-b flex gap-5">
                <button className="py-3 text-[10px] font-bold text-[#C8102E] border-b-2 border-[#C8102E]">
                  Dados do lançamento
                </button>
                <button className="py-3 text-[10px] text-zinc-400">
                  Documento
                </button>
                <button className="py-3 text-[10px] text-zinc-400">
                  Histórico
                </button>
              </div>
              <div className="p-4 space-y-3 max-h-[58vh] overflow-y-auto">
                {selected.status === "Aguardando Análise" ? (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] text-blue-700">
                    <strong>Campos editáveis</strong> — confira e ajuste as
                    informações destacadas abaixo.
                  </div>
                ) : (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[10px] text-zinc-500">
                    <strong>Somente leitura</strong> — este lançamento não pode
                    mais ser alterado neste status.
                  </div>
                )}
                <fieldset
                  disabled={selected.status !== "Aguardando Análise"}
                  className="space-y-3 disabled:cursor-not-allowed"
                >
                  <Field label="Tipo de lançamento" required>
                    <select
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
                  <Field
                    label={
                      value("entryType") === "Transferência"
                        ? "Identificação da transferência"
                        : value("entryType") === "Conta a Receber"
                          ? "Cliente"
                          : "Fornecedor"
                    }
                    required
                  >
                    {value("entryType") === "Transferência" ? (
                      <input
                        value={String(value("supplier"))}
                        onChange={(e) => set("supplier", e.target.value)}
                      />
                    ) : (
                      <select
                        value={String(value("supplier"))}
                        onChange={(e) => set("supplier", e.target.value)}
                      >
                        <option value="">Selecione</option>
                        {(value("entryType") === "Conta a Receber"
                          ? customers
                          : suppliers
                        ).map((item) => (
                          <option key={item.id}>{item.name}</option>
                        ))}
                      </select>
                    )}
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Valor" required>
                      <input
                        type="number"
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
                    <Field label="Categoria">
                      <select
                        value={String(value("expenseType"))}
                        onChange={(e) => set("expenseType", e.target.value)}
                      >
                        <option value="">Selecione</option>
                        {financialCategories.map((item) => (
                          <option key={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Centro de custo">
                      <select
                        value={String(value("costCenter"))}
                        onChange={(e) => set("costCenter", e.target.value)}
                      >
                        <option value="">A classificar</option>
                        {costCenters.map((item) => (
                          <option key={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </Field>
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
                    <Field label="Forma de pagamento">
                      <select
                        value={String(value("paymentMethod"))}
                        onChange={(e) => set("paymentMethod", e.target.value)}
                      >
                        <option value="">A definir</option>
                        {paymentMethods.map((item) => (
                          <option key={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </Field>
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
                  <Field label="Observações">
                    <textarea
                      rows={2}
                      value={String(value("notes"))}
                      onChange={(e) => set("notes", e.target.value)}
                    />
                  </Field>
                </fieldset>
                {Object.keys(draft).length > 0 && (
                  <button
                    onClick={save}
                    className="text-[10px] font-bold text-blue-700"
                  >
                    Salvar alterações
                  </button>
                )}
              </div>
              <div className="p-4 border-t">
                <p className="text-xs font-bold mb-3">Ações do BPO</p>
                {selected.status === "Aguardando Análise" ? (
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => act("launch")}
                      className="bg-emerald-600 text-white rounded-lg py-2 text-[10px] font-bold flex justify-center items-center gap-1 cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" /> Lançar
                    </button>
                    <button
                      onClick={() => act("approval")}
                      className="bg-blue-600 text-white rounded-lg py-2 text-[10px] font-bold flex justify-center items-center gap-1 cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5" /> Aprovação
                    </button>
                    <button
                      onClick={() => act("cancel")}
                      className="bg-red-600 text-white rounded-lg py-2 text-[10px] font-bold flex justify-center items-center gap-1 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" /> Cancelar
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] text-zinc-400">
                    Este documento não possui ações pendentes para o BPO.
                  </p>
                )}
              </div>
              <div className="border-t p-4">
                <button className="w-full flex justify-between text-[10px] font-bold text-zinc-600">
                  <span className="flex gap-2">
                    <Sparkles className="h-3.5 w-3.5" /> Informações extraídas
                    pelo assistente
                  </span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          ) : (
            <div className="p-16 text-center text-xs text-zinc-400">
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
    <label className="block text-[9px] font-bold text-zinc-600">
      {label}
      {required && <span className="text-red-500"> *</span>}
      {React.cloneElement(children, {
        className:
          "mt-1 w-full rounded-lg border border-blue-200 bg-blue-50/60 px-2.5 py-2 text-xs text-zinc-800 shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50 focus:border-[#0B2C52] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B2C52]/15 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:shadow-none",
      } as React.HTMLAttributes<HTMLElement>)}
    </label>
  );
}
