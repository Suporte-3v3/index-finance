import React, { useState } from "react";
import {
  Building2,
  CreditCard,
  FolderTree,
  Landmark,
  Pencil,
  Plus,
  Tags,
  Trash2,
} from "lucide-react";
import { useBPOState } from "../hooks/useBPOState";
import { BankAccount, MasterDataOption, MasterDataType } from "../types";

const tabs: {
  type: MasterDataType | "BANK";
  label: string;
  icon: React.ElementType;
}[] = [
  { type: "CATEGORY", label: "Categorias", icon: Tags },
  { type: "SUBCATEGORY", label: "Subcategorias", icon: FolderTree },
  { type: "COST_CENTER", label: "Centros de custo", icon: Building2 },
  { type: "PAYMENT_METHOD", label: "Formas de pagamento", icon: CreditCard },
  { type: "DOCUMENT_TYPE", label: "Tipos de documento", icon: FolderTree },
  { type: "SUPPLIER", label: "Fornecedores", icon: Building2 },
  { type: "CUSTOMER", label: "Clientes", icon: Building2 },
  { type: "BANK", label: "Contas bancárias", icon: Landmark },
];

export default function MasterDataView() {
  const {
    activeCompany,
    currentUser,
    masterData,
    bankAccounts,
    addMasterData,
    updateMasterData,
    deleteMasterData,
    addBankAccount,
    updateBankAccount,
    deleteBankAccount,
  } = useBPOState();
  const [tab, setTab] = useState<MasterDataType | "BANK">("CATEGORY");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [editingItem, setEditingItem] = useState<MasterDataOption | null>(null);
  const [bank, setBank] = useState({
    bankName: "",
    agency: "",
    accountNumber: "",
    type: "Corrente" as const,
    balance: 0,
  });
  if (!activeCompany || !["BPO_ADMIN", "BPO_TEAM"].includes(currentUser.role))
    return null;
  const items = masterData.filter(
    (item) => item.companyId === activeCompany.id && item.type === tab,
  );
  const categories = masterData.filter(
    (item) =>
      item.companyId === activeCompany.id &&
      item.type === "CATEGORY" &&
      item.active,
  );
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (tab === "BANK") addBankAccount(bank);
    else addMasterData(tab, name, tab === "SUBCATEGORY" ? parentId : undefined);
    setName("");
    setParentId("");
    setBank({
      bankName: "",
      agency: "",
      accountNumber: "",
      type: "Corrente",
      balance: 0,
    });
  };
  const saveItemEdit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingItem || !editingItem.name.trim()) return;
    updateMasterData(editingItem.id, {
      name: editingItem.name.trim(),
      parentId:
        editingItem.type === "SUBCATEGORY" ? editingItem.parentId : undefined,
      active: editingItem.active,
    });
    setEditingItem(null);
  };
  const saveBankEdit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingBank) return;
    updateBankAccount(editingBank.id, {
      bankName: editingBank.bankName.trim(),
      agency: editingBank.agency.trim(),
      accountNumber: editingBank.accountNumber.trim(),
      type: editingBank.type,
      balance: Number(editingBank.balance),
    });
    setEditingBank(null);
  };

  return (
    <div className="space-y-5">
      {editingBank && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setEditingBank(null)}
        >
          <form
            onSubmit={saveBankEdit}
            onClick={(event) => event.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden"
          >
            <div className="p-5 border-b">
              <h3 className="font-bold">Editar conta bancária</h3>
              <p className="text-[10px] text-zinc-500 mt-1">
                Atualize todas as informações da conta.
              </p>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-4">
              <Input
                label="Banco"
                value={editingBank.bankName}
                onChange={(value) =>
                  setEditingBank({ ...editingBank, bankName: value })
                }
              />
              <Input
                label="Agência"
                value={editingBank.agency}
                onChange={(value) =>
                  setEditingBank({ ...editingBank, agency: value })
                }
              />
              <Input
                label="Número da conta"
                value={editingBank.accountNumber}
                onChange={(value) =>
                  setEditingBank({ ...editingBank, accountNumber: value })
                }
              />
              <label className="text-[10px] font-bold text-zinc-500">
                Tipo
                <select
                  value={editingBank.type}
                  onChange={(event) =>
                    setEditingBank({
                      ...editingBank,
                      type: event.target.value as BankAccount["type"],
                    })
                  }
                  className="mt-1 w-full border rounded-lg p-2 text-xs"
                >
                  <option>Corrente</option>
                  <option>Poupança</option>
                  <option>Investimento</option>
                </select>
              </label>
              <label className="text-[10px] font-bold text-zinc-500 sm:col-span-2">
                Saldo atual
                <input
                  required
                  type="number"
                  step="0.01"
                  value={editingBank.balance}
                  onChange={(event) =>
                    setEditingBank({
                      ...editingBank,
                      balance: Number(event.target.value),
                    })
                  }
                  className="mt-1 w-full border rounded-lg p-2 text-xs"
                />
              </label>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingBank(null)}
                className="px-4 py-2 text-xs font-bold text-zinc-500"
              >
                Cancelar
              </button>
              <button className="px-4 py-2 bg-[#0B2C52] text-white rounded-lg text-xs font-bold">
                Salvar alterações
              </button>
            </div>
          </form>
        </div>
      )}
      {editingItem && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setEditingItem(null)}
        >
          <form
            onSubmit={saveItemEdit}
            onClick={(event) => event.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <div className="p-5 border-b">
              <h3 className="font-bold">
                Editar{" "}
                {tabs
                  .find((item) => item.type === editingItem.type)
                  ?.label.toLowerCase()}
              </h3>
              <p className="text-[10px] text-zinc-500 mt-1">
                Atualize as informações deste cadastro.
              </p>
            </div>
            <div className="p-5 space-y-4">
              <Input
                label="Nome"
                value={editingItem.name}
                onChange={(value) =>
                  setEditingItem({ ...editingItem, name: value })
                }
              />
              {editingItem.type === "SUBCATEGORY" && (
                <label className="block text-[10px] font-bold text-zinc-500">
                  Categoria principal
                  <select
                    required
                    value={editingItem.parentId || ""}
                    onChange={(event) =>
                      setEditingItem({
                        ...editingItem,
                        parentId: event.target.value,
                      })
                    }
                    className="mt-1 w-full border rounded-lg p-2 text-xs"
                  >
                    <option value="">Selecione</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-600">
                <input
                  type="checkbox"
                  checked={editingItem.active}
                  onChange={(event) =>
                    setEditingItem({
                      ...editingItem,
                      active: event.target.checked,
                    })
                  }
                  className="h-4 w-4"
                />{" "}
                Cadastro ativo
              </label>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-xs font-bold text-zinc-500"
              >
                Cancelar
              </button>
              <button className="px-4 py-2 bg-[#0B2C52] text-white rounded-lg text-xs font-bold">
                Salvar alterações
              </button>
            </div>
          </form>
        </div>
      )}
      <div>
        <h2 className="text-xl font-bold">Cadastros</h2>
        <p className="text-xs text-zinc-500 mt-1">
          Gerencie as informações utilizadas nos formulários e lançamentos de{" "}
          {activeCompany.tradeName}.
        </p>
      </div>
      <div className="grid lg:grid-cols-[230px_1fr] gap-4">
        <aside className="bg-white border rounded-xl p-2 h-fit">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                onClick={() => setTab(item.type)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold cursor-pointer ${tab === item.type ? "bg-[#0B2C52] text-white" : "text-zinc-600 hover:bg-zinc-50"}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </aside>
        <main className="space-y-4">
          <form onSubmit={submit} className="bg-white border rounded-xl p-4">
            <h3 className="text-sm font-bold mb-3">
              Adicionar{" "}
              {tabs.find((item) => item.type === tab)?.label.toLowerCase()}
            </h3>
            {tab === "BANK" ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
                <Input
                  label="Banco"
                  value={bank.bankName}
                  onChange={(value) => setBank({ ...bank, bankName: value })}
                />
                <Input
                  label="Agência"
                  value={bank.agency}
                  onChange={(value) => setBank({ ...bank, agency: value })}
                />
                <Input
                  label="Conta"
                  value={bank.accountNumber}
                  onChange={(value) =>
                    setBank({ ...bank, accountNumber: value })
                  }
                />
                <label className="text-[10px] font-bold text-zinc-500">
                  Tipo
                  <select
                    value={bank.type}
                    onChange={(e) =>
                      setBank({
                        ...bank,
                        type: e.target.value as typeof bank.type,
                      })
                    }
                    className="mt-1 w-full border rounded-lg p-2 text-xs"
                  >
                    <option>Corrente</option>
                    <option>Poupança</option>
                    <option>Investimento</option>
                  </select>
                </label>
                <label className="text-[10px] font-bold text-zinc-500">
                  Saldo inicial
                  <input
                    type="number"
                    value={bank.balance}
                    onChange={(e) =>
                      setBank({ ...bank, balance: Number(e.target.value) })
                    }
                    className="mt-1 w-full border rounded-lg p-2 text-xs"
                  />
                </label>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do cadastro"
                  className="flex-1 min-w-56 border rounded-lg px-3 py-2 text-xs"
                />
                {tab === "SUBCATEGORY" && (
                  <select
                    required
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-xs"
                  >
                    <option value="">Categoria principal</option>
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            <button className="mt-3 bg-[#0B2C52] text-white rounded-lg px-4 py-2 text-xs font-bold flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Adicionar
            </button>
          </form>
          <section className="bg-white border rounded-xl overflow-hidden">
            <div className="p-4 border-b text-sm font-bold">
              Registros cadastrados
            </div>
            <div className="divide-y">
              {tab === "BANK"
                ? bankAccounts
                    .filter((item) => item.companyId === activeCompany.id)
                    .map((account) => (
                      <Row
                        key={account.id}
                        title={`${account.bankName} · ${account.accountNumber}`}
                        detail={`Agência ${account.agency} · ${account.type} · Saldo R$ ${account.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                        onEdit={() => setEditingBank({ ...account })}
                        onDelete={() => deleteBankAccount(account.id)}
                      />
                    ))
                : items.map((item) => (
                    <div key={item.id} className="p-4 flex items-center gap-3">
                      <span className="flex-1 px-2 py-1.5 text-xs font-bold">
                        {item.name}
                      </span>
                      <button
                        onClick={() =>
                          updateMasterData(item.id, { active: !item.active })
                        }
                        className={`text-[9px] font-bold px-2 py-1 rounded-full ${item.active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}
                      >
                        {item.active ? "Ativo" : "Inativo"}
                      </button>
                      <button
                        onClick={() => setEditingItem({ ...item })}
                        className="text-blue-700 p-2 flex items-center gap-1 text-[10px] font-bold"
                      >
                        <Pencil className="h-4 w-4" /> Editar
                      </button>
                      <button
                        onClick={() => deleteMasterData(item.id)}
                        className="text-red-500 p-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
              {(tab === "BANK"
                ? bankAccounts.filter(
                    (item) => item.companyId === activeCompany.id,
                  ).length === 0
                : items.length === 0) && (
                <p className="p-10 text-center text-xs text-zinc-400">
                  Nenhum registro cadastrado.
                </p>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-[10px] font-bold text-zinc-500">
      {label}
      <input
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border rounded-lg p-2 text-xs"
      />
    </label>
  );
}
function Row({
  title,
  detail,
  onDelete,
  onEdit,
}: {
  key?: React.Key;
  title: string;
  detail: string;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="p-4 flex justify-between gap-3">
      <div>
        <p className="text-xs font-bold">{title}</p>
        <p className="text-[10px] text-zinc-500 mt-1">{detail}</p>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onEdit}
          className="text-blue-700 p-2 flex items-center gap-1 text-[10px] font-bold"
        >
          <Pencil className="h-4 w-4" /> Editar
        </button>
        <button onClick={onDelete} className="text-red-500 p-2">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
