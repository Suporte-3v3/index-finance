import React, { useState } from "react";
import {
  Building2,
  CreditCard,
  FolderTree,
  Landmark,
  Pencil,
  Plus,
  Store,
  Tags,
  Trash2,
} from "lucide-react";
import { useBPOState } from "../hooks/useBPOState";
import { BankAccount, MasterDataOption, MasterDataType } from "../types";
import CurrencyInput from "../components/CurrencyInput";

const MD_AVATAR_PALETTE = [
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
  return MD_AVATAR_PALETTE[Math.abs(hash) % MD_AVATAR_PALETTE.length];
};

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
  { type: "BAKERY_REGISTER", label: "Caixas (Padaria)", icon: Store },
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
    <div className="space-y-4">
      {editingBank && (
        <div
          className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4"
          onClick={() => setEditingBank(null)}
        >
          <form
            onSubmit={saveBankEdit}
            onClick={(event) => event.stopPropagation()}
            className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-xl overflow-hidden"
          >
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Editar conta bancária</h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
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
              <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                Tipo
                <select
                  value={editingBank.type}
                  onChange={(event) =>
                    setEditingBank({
                      ...editingBank,
                      type: event.target.value as BankAccount["type"],
                    })
                  }
                  className="mt-1 w-full border border-zinc-200 dark:border-zinc-700 rounded-sm p-2 text-xs bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100"
                >
                  <option>Corrente</option>
                  <option>Poupança</option>
                  <option>Investimento</option>
                </select>
              </label>
              <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 sm:col-span-2">
                Saldo atual
                <CurrencyInput
                  required
                  value={editingBank.balance}
                  onChange={(balance) =>
                    setEditingBank({ ...editingBank, balance })
                  }
                  className="mt-1 w-full border border-zinc-200 dark:border-zinc-700 rounded-sm p-2 text-xs bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100"
                />
              </label>
            </div>
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingBank(null)}
                className="px-4 py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400"
              >
                Cancelar
              </button>
              <button className="px-4 py-2 bg-[#0B2C52] text-white rounded-sm text-xs font-semibold">
                Salvar alterações
              </button>
            </div>
          </form>
        </div>
      )}
      {editingItem && (
        <div
          className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4"
          onClick={() => setEditingItem(null)}
        >
          <form
            onSubmit={saveItemEdit}
            onClick={(event) => event.stopPropagation()}
            className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                Editar{" "}
                {tabs
                  .find((item) => item.type === editingItem.type)
                  ?.label.toLowerCase()}
              </h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
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
                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
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
                    className="mt-1 w-full border border-zinc-200 dark:border-zinc-700 rounded-sm p-2 text-xs bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100"
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
              <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
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
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400"
              >
                Cancelar
              </button>
              <button className="px-4 py-2 bg-[#0B2C52] text-white rounded-sm text-xs font-semibold">
                Salvar alterações
              </button>
            </div>
          </form>
        </div>
      )}
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Cadastros</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Gerencie as informações utilizadas nos formulários e lançamentos de{" "}
          {activeCompany.tradeName}.
        </p>
      </div>
      <div className="grid lg:grid-cols-[230px_1fr] gap-4">
        <aside className="bg-white dark:bg-[#091320] border border-zinc-200 dark:border-zinc-800 rounded-sm p-2 h-fit">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                onClick={() => setTab(item.type)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-sm text-xs font-semibold cursor-pointer ${tab === item.type ? "bg-[#0B2C52] text-white" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </aside>
        <main className="space-y-4">
          <form onSubmit={submit} className="bg-white dark:bg-[#091320] border border-zinc-200 dark:border-zinc-800 rounded-sm p-4">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
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
                <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                  Tipo
                  <select
                    value={bank.type}
                    onChange={(e) =>
                      setBank({
                        ...bank,
                        type: e.target.value as typeof bank.type,
                      })
                    }
                    className="mt-1 w-full border border-zinc-200 dark:border-zinc-700 rounded-sm p-2 text-xs bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100"
                  >
                    <option>Corrente</option>
                    <option>Poupança</option>
                    <option>Investimento</option>
                  </select>
                </label>
                <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                  Saldo inicial
                  <CurrencyInput
                    value={bank.balance}
                    onChange={(balance) => setBank({ ...bank, balance })}
                    className="mt-1 w-full border border-zinc-200 dark:border-zinc-700 rounded-sm p-2 text-xs bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100"
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
                  className="flex-1 min-w-56 border border-zinc-200 dark:border-zinc-700 rounded-sm px-3 py-2 text-xs bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
                {tab === "SUBCATEGORY" && (
                  <select
                    required
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    className="border border-zinc-200 dark:border-zinc-700 rounded-sm px-3 py-2 text-xs bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100"
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
            <button className="mt-3 bg-[#0B2C52] text-white rounded-sm px-4 py-2 text-xs font-semibold flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Adicionar
            </button>
          </form>
          <section className="bg-white dark:bg-[#091320] border border-zinc-200 dark:border-zinc-800 rounded-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Registros cadastrados
            </div>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
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
                    <div key={item.id} className="p-4 flex items-center gap-3 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40">
                      <span className="flex-1 px-2 py-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                        {(tab === "SUPPLIER" || tab === "CUSTOMER") ? (
                          <span className="flex items-center gap-2">
                            <span
                              className={`h-6 w-6 rounded-full ${getAvatarTint(item.name)} text-white text-[9px] font-semibold flex items-center justify-center shrink-0`}
                            >
                              {getInitials(item.name)}
                            </span>
                            {item.name}
                          </span>
                        ) : (
                          item.name
                        )}
                      </span>
                      <button
                        onClick={() =>
                          updateMasterData(item.id, { active: !item.active })
                        }
                        className={`inline-flex items-center gap-1.5 text-[9px] font-semibold px-2 py-1 rounded border cursor-pointer ${item.active ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25" : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
                        {item.active ? "Ativo" : "Inativo"}
                      </button>
                      <button
                        onClick={() => setEditingItem({ ...item })}
                        className="text-blue-700 dark:text-blue-400 p-2 flex items-center gap-1 text-[10px] font-semibold cursor-pointer"
                      >
                        <Pencil className="h-4 w-4" /> Editar
                      </button>
                      <button
                        onClick={() => deleteMasterData(item.id)}
                        className="text-red-500 dark:text-red-400 p-2 cursor-pointer"
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
                <p className="p-10 text-center text-xs text-zinc-400 dark:text-zinc-500">
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
    <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
      {label}
      <input
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-zinc-200 dark:border-zinc-700 rounded-sm p-2 text-xs bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100"
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
    <div className="p-4 flex justify-between gap-3 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40">
      <div>
        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-50">{title}</p>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">{detail}</p>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onEdit}
          className="text-blue-700 dark:text-blue-400 p-2 flex items-center gap-1 text-[10px] font-semibold cursor-pointer"
        >
          <Pencil className="h-4 w-4" /> Editar
        </button>
        <button onClick={onDelete} className="text-red-500 dark:text-red-400 p-2 cursor-pointer">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
