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
import { Badge, Button, Card, EmptyState, IconButton, Modal } from "../components/ui";

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

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
    <div className="space-y-5">
      <Modal
        open={Boolean(editingBank)}
        onClose={() => setEditingBank(null)}
        title="Editar conta bancária"
        description="Atualize todas as informações da conta."
        footer={
          <Button type="submit" form="master-data-bank-edit-form">
            Salvar alterações
          </Button>
        }
      >
        {editingBank && (
          <form id="master-data-bank-edit-form" onSubmit={saveBankEdit} className="grid sm:grid-cols-2 gap-4">
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
            <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide">
              Tipo
              <select
                value={editingBank.type}
                onChange={(event) =>
                  setEditingBank({
                    ...editingBank,
                    type: event.target.value as BankAccount["type"],
                  })
                }
                className="mt-1 w-full border border-line dark:border-line-dark rounded-lg p-2 text-xs bg-canvas dark:bg-white/5 text-ink dark:text-ink-dark dark:[color-scheme:dark]"
              >
                <option>Corrente</option>
                <option>Poupança</option>
                <option>Investimento</option>
              </select>
            </label>
            <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide sm:col-span-2">
              Saldo atual
              <CurrencyInput
                required
                value={editingBank.balance}
                onChange={(balance) =>
                  setEditingBank({ ...editingBank, balance })
                }
                className="mt-1 w-full border border-line dark:border-line-dark rounded-lg p-2 text-xs bg-canvas dark:bg-white/5 text-ink dark:text-ink-dark"
              />
            </label>
          </form>
        )}
      </Modal>

      <Modal
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title={
          editingItem
            ? `Editar ${tabs.find((item) => item.type === editingItem.type)?.label.toLowerCase()}`
            : undefined
        }
        description="Atualize as informações deste cadastro."
        size="sm"
        footer={
          <Button type="submit" form="master-data-item-edit-form">
            Salvar alterações
          </Button>
        }
      >
        {editingItem && (
          <form id="master-data-item-edit-form" onSubmit={saveItemEdit} className="space-y-4">
            <Input
              label="Nome"
              value={editingItem.name}
              onChange={(value) =>
                setEditingItem({ ...editingItem, name: value })
              }
            />
            {editingItem.type === "SUBCATEGORY" && (
              <label className="block text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide">
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
                  className="mt-1 w-full border border-line dark:border-line-dark rounded-lg p-2 text-xs bg-canvas dark:bg-white/5 text-ink dark:text-ink-dark dark:[color-scheme:dark]"
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
            <label className="flex items-center gap-2 text-xs font-semibold text-ink dark:text-ink-dark">
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
          </form>
        )}
      </Modal>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink dark:text-ink-dark tracking-tight">Cadastros</h1>
        <p className="text-sm text-ink-soft dark:text-ink-soft-dark leading-relaxed mt-1">
          Gerencie as informações utilizadas nos formulários e lançamentos de{" "}
          {activeCompany.tradeName}.
        </p>
      </div>
      <div className="grid lg:grid-cols-[230px_1fr] gap-4">
        <Card padding={false} className="p-2 h-fit">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                onClick={() => setTab(item.type)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${tab === item.type ? "bg-brand-navy-900 text-white" : "text-ink dark:text-ink-dark hover:bg-canvas dark:hover:bg-white/5"}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </Card>
        <main className="space-y-4">
          <form
            onSubmit={submit}
            className="bg-surface dark:bg-surface-dark rounded-xl border border-line dark:border-line-dark shadow-[0_1px_2px_rgba(23,32,51,0.05)] p-5"
          >
            <h3 className="text-sm font-bold text-ink dark:text-ink-dark mb-3">
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
                <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide">
                  Tipo
                  <select
                    value={bank.type}
                    onChange={(e) =>
                      setBank({
                        ...bank,
                        type: e.target.value as typeof bank.type,
                      })
                    }
                    className="mt-1 w-full border border-line dark:border-line-dark rounded-lg p-2 text-xs bg-canvas dark:bg-white/5 text-ink dark:text-ink-dark dark:[color-scheme:dark]"
                  >
                    <option>Corrente</option>
                    <option>Poupança</option>
                    <option>Investimento</option>
                  </select>
                </label>
                <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide">
                  Saldo inicial
                  <CurrencyInput
                    value={bank.balance}
                    onChange={(balance) => setBank({ ...bank, balance })}
                    className="mt-1 w-full border border-line dark:border-line-dark rounded-lg p-2 text-xs bg-canvas dark:bg-white/5 text-ink dark:text-ink-dark"
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
                  className="flex-1 min-w-56 border border-line dark:border-line-dark rounded-lg px-3 py-2 text-xs bg-canvas dark:bg-white/5 text-ink dark:text-ink-dark placeholder:text-ink-soft dark:placeholder:text-ink-soft-dark"
                />
                {tab === "SUBCATEGORY" && (
                  <select
                    required
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    className="border border-line dark:border-line-dark rounded-lg px-3 py-2 text-xs bg-canvas dark:bg-white/5 text-ink dark:text-ink-dark dark:[color-scheme:dark]"
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
            <Button type="submit" size="sm" className="mt-3" icon={<Plus className="h-4 w-4" />}>
              Adicionar
            </Button>
          </form>
          <Card padding={false} className="overflow-hidden">
            <div className="p-4 border-b border-line dark:border-line-dark text-sm font-bold text-ink dark:text-ink-dark">
              Registros cadastrados
            </div>
            <div className="divide-y divide-line dark:divide-line-dark">
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
                    <div key={item.id} className="p-4 flex items-center gap-3 hover:bg-canvas/60 dark:hover:bg-white/[0.03]">
                      <span className="flex-1 px-2 py-1.5 text-xs font-semibold text-ink dark:text-ink-dark">
                        {(tab === "SUPPLIER" || tab === "CUSTOMER") ? (
                          <span className="flex items-center gap-2">
                            <span className="h-6 w-6 rounded-full bg-brand-navy-900 text-white text-[9px] font-semibold flex items-center justify-center shrink-0">
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
                        className="cursor-pointer"
                      >
                        <Badge tone={item.active ? "green" : "neutral"} dot>
                          {item.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </button>
                      <Button
                        size="sm"
                        variant="text"
                        icon={<Pencil className="h-4 w-4" />}
                        onClick={() => setEditingItem({ ...item })}
                      >
                        Editar
                      </Button>
                      <IconButton
                        icon={<Trash2 />}
                        label="Excluir"
                        variant="danger"
                        size="sm"
                        onClick={() => deleteMasterData(item.id)}
                      />
                    </div>
                  ))}
              {(tab === "BANK"
                ? bankAccounts.filter(
                    (item) => item.companyId === activeCompany.id,
                  ).length === 0
                : items.length === 0) && (
                <EmptyState title="Nenhum registro cadastrado." />
              )}
            </div>
          </Card>
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
    <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide">
      {label}
      <input
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-line dark:border-line-dark rounded-lg p-2 text-xs bg-canvas dark:bg-white/5 text-ink dark:text-ink-dark"
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
    <div className="p-4 flex justify-between gap-3 hover:bg-canvas/60 dark:hover:bg-white/[0.03]">
      <div>
        <p className="text-xs font-semibold text-ink dark:text-ink-dark">{title}</p>
        <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark mt-1">{detail}</p>
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="text" icon={<Pencil className="h-4 w-4" />} onClick={onEdit}>
          Editar
        </Button>
        <IconButton icon={<Trash2 />} label="Excluir" variant="danger" size="sm" onClick={onDelete} />
      </div>
    </div>
  );
}
