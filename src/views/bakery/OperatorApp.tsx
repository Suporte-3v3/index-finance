/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useBPOState } from "../../hooks/useBPOState";
import { useBakeryCashState } from "../../hooks/useBakeryCashState";
import {
  BakeryCardMachineEntry,
  BakeryExpense,
  BakeryPixSale,
  BakeryShift,
  BakeryWithdrawal,
  BankAccount,
  MasterDataOption,
} from "../../types";
import { computeShiftTotals, formatBRL } from "./calculations";
import CurrencyInput from "../../components/CurrencyInput";
import { formatDate } from "../../services/dateFormatters";
import {
  ArrowLeft,
  Store,
  Receipt,
  ArrowDownToLine,
  QrCode,
  Camera,
  CheckCircle2,
  History,
  Home,
  ChevronRight,
  AlertCircle,
  Landmark,
  Ban,
  Plus,
  X,
  CreditCard,
  Wallet,
} from "lucide-react";

type Screen =
  | "home"
  | "open"
  | "workspace"
  | "new-expense"
  | "new-withdrawal"
  | "new-pix"
  | "bolsa"
  | "close"
  | "close-summary"
  | "closed"
  | "history"
  | "history-detail";

type BakeryCash = ReturnType<typeof useBakeryCashState>;

const SHIFT_PRESETS = ["Manhã", "Tarde", "Noite"];

function PrimaryButton({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "danger" | "outline";
  type?: "button" | "submit";
}) {
  const styles = {
    primary: "bg-brand-navy-900 hover:bg-brand-navy-700 text-white",
    danger: "bg-brand-red-600 hover:bg-brand-red-500 text-white",
    outline:
      "bg-surface dark:bg-surface-dark border border-line dark:border-line-dark text-ink dark:text-ink-dark hover:bg-canvas dark:hover:bg-white/5",
  } as const;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

function ScreenHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 mb-1">
      {onBack && (
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg text-ink-soft dark:text-ink-soft-dark hover:bg-canvas dark:hover:bg-white/5 cursor-pointer shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-ink dark:text-ink-dark leading-tight truncate">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-ink-soft dark:text-ink-soft-dark truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full text-base bg-canvas dark:bg-white/5 text-ink dark:text-ink-dark placeholder:text-ink-soft dark:placeholder:text-ink-soft-dark border border-line dark:border-line-dark rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30 focus:border-brand-navy-700 dark:[color-scheme:dark]";

function PhotoPicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (url?: string) => void;
}) {
  return (
    <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-line dark:border-line-dark rounded-lg py-4 text-ink-soft dark:text-ink-soft-dark cursor-pointer hover:border-brand-navy-900/40 hover:text-brand-navy-900 dark:hover:text-brand-navy-700/90">
      {value ? (
        <img
          src={value}
          alt="Comprovante"
          className="h-16 w-16 object-cover rounded-lg"
        />
      ) : (
        <Camera className="h-6 w-6" />
      )}
      <span className="text-[11px] font-semibold">
        {value ? "Trocar comprovante" : "Adicionar foto do comprovante (opcional)"}
      </span>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          onChange(file ? URL.createObjectURL(file) : undefined);
        }}
      />
    </label>
  );
}

function InlineError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 text-xs text-brand-red-600 dark:text-rose-400 bg-brand-red-600/5 dark:bg-brand-red-600/15 border border-brand-red-600/20 dark:border-rose-500/25 rounded-lg p-3">
      <AlertCircle className="h-4 w-4 shrink-0" /> {message}
    </div>
  );
}

function InitialBalanceDivergenceCard({ shift }: { shift: BakeryShift }) {
  const hasDivergence =
    shift.previousShiftFinalBalance !== undefined &&
    shift.previousShiftFinalBalance !== shift.initialBalance;
  if (!hasDivergence) return null;
  const delta = shift.initialBalance - (shift.previousShiftFinalBalance as number);

  return (
    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-sm">
        <AlertCircle className="h-4 w-4 shrink-0" /> Diferença no saldo inicial deste turno
      </div>
      <div className="text-sm space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-amber-700 dark:text-amber-400">
            Saldo final do turno anterior
          </span>
          <span className="font-semibold text-amber-900 dark:text-amber-200">
            {formatBRL(shift.previousShiftFinalBalance as number)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-amber-700 dark:text-amber-400">Saldo inicial informado</span>
          <span className="font-semibold text-amber-900 dark:text-amber-200">
            {formatBRL(shift.initialBalance)}
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-amber-200 dark:border-amber-500/25 pt-1">
          <span className="text-amber-800 dark:text-amber-300 font-semibold">Diferença</span>
          <span className="font-semibold text-brand-red-600 dark:text-rose-400">
            {delta < 0 ? "- " : "+ "}
            {formatBRL(Math.abs(delta))}
          </span>
        </div>
      </div>
      {shift.initialBalanceJustification && (
        <p className="text-xs text-amber-700 dark:text-amber-400 italic border-t border-amber-200 dark:border-amber-500/25 pt-2">
          Justificativa na abertura: "{shift.initialBalanceJustification}"
        </p>
      )}
    </div>
  );
}

function MovementRow({
  icon,
  iconClass,
  title,
  amountLabel,
  amountClass,
  detail,
  time,
  onCancel,
  canceled,
}: {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  amountLabel: string;
  amountClass: string;
  detail?: string;
  time: string;
  onCancel?: () => void;
  canceled?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg p-3.5 ${canceled ? "opacity-50" : ""}`}
    >
      <div className={`p-2 rounded-lg shrink-0 ${iconClass}`}>{icon}</div>
      <div className="min-w-0 grow">
        <p className="text-sm font-semibold text-ink dark:text-ink-dark truncate">
          {title}
          {canceled && (
            <span className="ml-1.5 text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase">
              Cancelada
            </span>
          )}
        </p>
        {detail && (
          <p className="text-[11px] text-ink-soft dark:text-ink-soft-dark truncate">{detail}</p>
        )}
        <p className="text-[11px] text-ink-soft dark:text-ink-soft-dark">{time}</p>
      </div>
      <div className="text-right shrink-0 space-y-1">
        <p className={`text-sm font-semibold ${amountClass}`}>{amountLabel}</p>
        {onCancel && !canceled && (
          <button
            onClick={onCancel}
            className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark hover:text-brand-red-600 dark:hover:text-rose-400 cursor-pointer"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------- ABERTURA ----------------
function OpenShiftScreen({
  registers,
  bakery,
  formError,
  setFormError,
  onBack,
  onSuccess,
}: {
  registers: MasterDataOption[];
  bakery: BakeryCash;
  formError: string;
  setFormError: (message: string) => void;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [registerId, setRegisterId] = useState(registers[0]?.id || "");
  const [shiftLabel, setShiftLabel] = useState("Manhã");
  const [customLabel, setCustomLabel] = useState("");
  const [initialBalance, setInitialBalance] = useState(0);
  const [initialBalanceTouched, setInitialBalanceTouched] = useState(false);
  const [justification, setJustification] = useState("");
  const [note, setNote] = useState("");

  const register = registers.find((item) => item.id === registerId);
  const suggested = register
    ? bakery.getLastClosedShiftForRegister(register.id)?.finalBalanceCounted
    : undefined;
  const effectiveLabel = shiftLabel === "Outro" ? customLabel : shiftLabel;
  const differsFromSuggestion =
    suggested !== undefined &&
    initialBalanceTouched &&
    initialBalance !== suggested;

  const submit = () => {
    setFormError("");
    if (!register) {
      setFormError("Cadastre um caixa em Cadastros antes de abrir o turno.");
      return;
    }
    if (!effectiveLabel.trim()) {
      setFormError("Informe o turno.");
      return;
    }
    if (!initialBalanceTouched || initialBalance < 0) {
      setFormError("Informe o saldo inicial (troco).");
      return;
    }
    if (differsFromSuggestion && !justification.trim()) {
      setFormError(
        "O saldo inicial é diferente do saldo final do turno anterior. Informe uma justificativa.",
      );
      return;
    }
    bakery
      .openShift({
        registerId: register.id,
        registerName: register.name,
        shiftLabel: effectiveLabel.trim(),
        initialBalance,
        openNote: note || undefined,
        initialBalanceJustification: differsFromSuggestion
          ? justification.trim()
          : undefined,
      })
      .then((result) => {
        if (!result.success) setFormError(result.error || "Não foi possível abrir o caixa.");
        else onSuccess();
      });
  };

  return (
    <div className="space-y-4">
      <ScreenHeader title="Abertura do caixa" onBack={onBack} />
      <InlineError message={formError} />

      {registers.length === 0 && (
        <InlineError message="Nenhum caixa cadastrado para esta empresa. Peça ao BPO para cadastrar um caixa em Cadastros → Caixas (Padaria)." />
      )}

      <Field label="Caixa">
        <select
          className={inputClass}
          value={registerId}
          onChange={(event) => setRegisterId(event.target.value)}
        >
          {registers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Turno">
        <div className="flex flex-wrap gap-2">
          {[...SHIFT_PRESETS, "Outro"].map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setShiftLabel(label)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border cursor-pointer ${
                shiftLabel === label
                  ? "bg-brand-navy-900 text-white border-brand-navy-900"
                  : "bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark border-line dark:border-line-dark"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {shiftLabel === "Outro" && (
          <input
            className={`${inputClass} mt-2`}
            placeholder="Nome do turno"
            value={customLabel}
            onChange={(event) => setCustomLabel(event.target.value)}
          />
        )}
      </Field>

      <Field label="Saldo inicial (troco)">
        <CurrencyInput
          className={inputClass}
          value={initialBalance}
          onChange={(value) => {
            setInitialBalance(value);
            setInitialBalanceTouched(true);
          }}
        />
        {suggested !== undefined && (
          <button
            type="button"
            onClick={() => {
              setInitialBalance(suggested);
              setInitialBalanceTouched(true);
            }}
            className="text-[11px] font-semibold text-brand-navy-900 dark:text-brand-navy-700/90 hover:underline cursor-pointer"
          >
            Usar saldo final do turno anterior: {formatBRL(suggested)}
          </button>
        )}
      </Field>

      {differsFromSuggestion && (
        <Field label="Justificativa da diferença">
          <textarea
            className={inputClass}
            rows={2}
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
            placeholder="Ex.: Troco extra recebido do gerente"
          />
        </Field>
      )}

      <Field label="Observação (opcional)">
        <input
          className={inputClass}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Ex.: Troco recebido do turno anterior"
        />
      </Field>

      <PrimaryButton onClick={submit} disabled={registers.length === 0}>
        Abrir caixa
      </PrimaryButton>
    </div>
  );
}

// ---------------- NOVA DESPESA ----------------
function NewExpenseScreen({
  shiftId,
  bakery,
  formError,
  setFormError,
  onBack,
  onSuccess,
}: {
  shiftId: string;
  bakery: BakeryCash;
  formError: string;
  setFormError: (message: string) => void;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [description, setDescription] = useState("");
  const [supplier, setSupplier] = useState("");
  const [amount, setAmount] = useState(0);
  const [source, setSource] = useState<"CAIXA" | "BOLSA">("CAIXA");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>();

  const submit = () => {
    setFormError("");
    if (!description.trim()) return setFormError("Informe a descrição.");
    if (!(amount > 0)) return setFormError("Informe um valor válido.");
    bakery
      .addExpense({
        shiftId,
        description: description.trim(),
        supplier: supplier.trim() || undefined,
        amount,
        source,
        category: category.trim() || undefined,
        note: note.trim() || undefined,
        receiptUrl,
      })
      .then((result) => {
        if (!result.success) setFormError(result.error || "Não foi possível salvar.");
        else onSuccess();
      });
  };

  return (
    <div className="space-y-4">
      <ScreenHeader title="Nova despesa" onBack={onBack} />
      <InlineError message={formError} />

      <Field label="Descrição">
        <input
          className={inputClass}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Ex.: Compra de leite"
        />
      </Field>
      <Field label="Fornecedor (opcional)">
        <input
          className={inputClass}
          value={supplier}
          onChange={(event) => setSupplier(event.target.value)}
        />
      </Field>
      <Field label="Valor">
        <CurrencyInput
          className={inputClass}
          value={amount}
          onChange={setAmount}
        />
      </Field>

      <Field label="De onde saiu o dinheiro?">
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setSource("CAIXA")}
            className={`py-3 rounded-lg border text-sm font-semibold cursor-pointer ${
              source === "CAIXA"
                ? "bg-brand-navy-900 text-white border-brand-navy-900"
                : "bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark border-line dark:border-line-dark"
            }`}
          >
            Caixa
          </button>
          <button
            type="button"
            onClick={() => setSource("BOLSA")}
            className={`py-3 rounded-lg border text-sm font-semibold cursor-pointer ${
              source === "BOLSA"
                ? "bg-brand-navy-900 text-white border-brand-navy-900"
                : "bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark border-line dark:border-line-dark"
            }`}
          >
            Bolsa
          </button>
        </div>
      </Field>

      <Field label="Categoria (opcional)">
        <input
          className={inputClass}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        />
      </Field>
      <Field label="Observação (opcional)">
        <input
          className={inputClass}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
      <PhotoPicker value={receiptUrl} onChange={setReceiptUrl} />

      <PrimaryButton onClick={submit}>Salvar despesa</PrimaryButton>
    </div>
  );
}

// ---------------- NOVA SANGRIA ----------------
function NewWithdrawalScreen({
  shiftId,
  bakery,
  formError,
  setFormError,
  onBack,
  onSuccess,
}: {
  shiftId: string;
  bakery: BakeryCash;
  formError: string;
  setFormError: (message: string) => void;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>();

  const submit = () => {
    setFormError("");
    if (!(amount > 0)) return setFormError("Informe um valor válido.");
    bakery
      .addWithdrawal({
        shiftId,
        amount,
        note: note.trim() || undefined,
        receiptUrl,
      })
      .then((result) => {
        if (!result.success) setFormError(result.error || "Não foi possível salvar.");
        else onSuccess();
      });
  };

  return (
    <div className="space-y-4">
      <ScreenHeader title="Nova sangria" onBack={onBack} />
      <InlineError message={formError} />

      <Field label="Valor">
        <CurrencyInput
          className={inputClass}
          value={amount}
          onChange={setAmount}
        />
      </Field>

      <div className="bg-canvas dark:bg-white/5 border border-line dark:border-line-dark rounded-lg p-3 text-xs text-ink-soft dark:text-ink-soft-dark flex items-center gap-2">
        <ArrowDownToLine className="h-4 w-4 text-brand-navy-900 dark:text-brand-navy-700/90" />
        Sai do Caixa e entra na Bolsa automaticamente.
      </div>

      <Field label="Observação (opcional)">
        <input
          className={inputClass}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Ex.: Retirada para pagamento"
        />
      </Field>
      <PhotoPicker value={receiptUrl} onChange={setReceiptUrl} />

      <PrimaryButton onClick={submit}>Confirmar sangria</PrimaryButton>
    </div>
  );
}

// ---------------- VENDA NO PIX ----------------
function NewPixScreen({
  shiftId,
  pixBanks,
  bakery,
  formError,
  setFormError,
  onBack,
  onSuccess,
}: {
  shiftId: string;
  pixBanks: BankAccount[];
  bakery: BakeryCash;
  formError: string;
  setFormError: (message: string) => void;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(0);
  const [bankAccountId, setBankAccountId] = useState(pixBanks[0]?.id || "");
  const [customerName, setCustomerName] = useState("");
  const [description, setDescription] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>();

  const submit = () => {
    setFormError("");
    if (!(amount > 0)) return setFormError("Informe um valor válido.");
    const bank = pixBanks.find((item) => item.id === bankAccountId);
    if (!bank) return setFormError("Selecione o banco que recebeu o PIX.");
    bakery
      .addPixSale({
        shiftId,
        amount,
        bankAccountId: bank.id,
        bankAccountName: bank.bankName,
        customerName: customerName.trim() || undefined,
        description: description.trim() || undefined,
        receiptUrl,
      })
      .then((result) => {
        if (!result.success) setFormError(result.error || "Não foi possível salvar.");
        else onSuccess();
      });
  };

  return (
    <div className="space-y-4">
      <ScreenHeader title="Nova venda no PIX" onBack={onBack} />
      <InlineError message={formError} />

      {pixBanks.length === 0 && (
        <InlineError message="Nenhum banco cadastrado para receber PIX. Peça ao BPO para cadastrar uma conta bancária." />
      )}

      <Field label="Valor">
        <CurrencyInput
          className={inputClass}
          value={amount}
          onChange={setAmount}
        />
      </Field>
      <Field label="Recebido em">
        <select
          className={inputClass}
          value={bankAccountId}
          onChange={(event) => setBankAccountId(event.target.value)}
        >
          {pixBanks.map((bank) => (
            <option key={bank.id} value={bank.id}>
              {bank.bankName}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Cliente (opcional)">
        <input
          className={inputClass}
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
        />
      </Field>
      <Field label="Descrição (opcional)">
        <input
          className={inputClass}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Ex.: Venda no balcão"
        />
      </Field>
      <PhotoPicker value={receiptUrl} onChange={setReceiptUrl} />

      <PrimaryButton onClick={submit} disabled={pixBanks.length === 0}>
        Confirmar venda
      </PrimaryButton>
    </div>
  );
}

// ---------------- FECHAMENTO ----------------
interface CardMachineRow {
  rowId: string;
  bankAccountId: string;
  amount: number;
}

function CloseScreen({
  banks,
  formError,
  setFormError,
  onBack,
  onCalculated,
}: {
  banks: BankAccount[];
  formError: string;
  setFormError: (message: string) => void;
  onBack: () => void;
  onCalculated: (data: {
    finalBalance: number;
    note: string;
    cardMachineEntries: BakeryCardMachineEntry[];
  }) => void;
}) {
  const [finalBalance, setFinalBalance] = useState(0);
  const [finalBalanceTouched, setFinalBalanceTouched] = useState(false);
  const [note, setNote] = useState("");
  const [machines, setMachines] = useState<CardMachineRow[]>([]);

  const addMachine = () =>
    setMachines((prev) => [
      ...prev,
      {
        rowId: `row-${Date.now()}-${prev.length}`,
        bankAccountId: banks[0]?.id || "",
        amount: 0,
      },
    ]);

  const updateMachine = (rowId: string, updates: Partial<CardMachineRow>) =>
    setMachines((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, ...updates } : row)),
    );

  const removeMachine = (rowId: string) =>
    setMachines((prev) => prev.filter((row) => row.rowId !== rowId));

  const submit = () => {
    setFormError("");
    if (!finalBalanceTouched || finalBalance < 0)
      return setFormError("Informe o saldo final contado.");
    for (const row of machines) {
      if (row.amount < 0)
        return setFormError("O valor da maquininha não pode ser negativo.");
      if (row.amount > 0 && !row.bankAccountId)
        return setFormError("Selecione o banco de cada maquininha.");
    }
    const cardMachineEntries: BakeryCardMachineEntry[] = machines
      .filter((row) => row.amount > 0)
      .map((row) => {
        const bank = banks.find((item) => item.id === row.bankAccountId);
        return {
          id: row.rowId,
          bankAccountId: row.bankAccountId,
          bankAccountName: bank?.bankName || "Banco",
          amount: row.amount,
        };
      });
    onCalculated({
      finalBalance,
      note: note.trim(),
      cardMachineEntries,
    });
  };

  return (
    <div className="space-y-4">
      <ScreenHeader title="Fechamento do caixa" onBack={onBack} />
      <InlineError message={formError} />

      <Field label="Saldo final contado">
        <CurrencyInput
          className={inputClass}
          value={finalBalance}
          onChange={(value) => {
            setFinalBalance(value);
            setFinalBalanceTouched(true);
          }}
        />
      </Field>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide">
            Vendas nas maquininhas (opcional)
          </span>
        </div>
        <p className="text-[11px] text-ink-soft dark:text-ink-soft-dark">
          A maquininha é do banco — o valor informado é somado ao saldo do
          banco escolhido.
        </p>
        {banks.length === 0 && (
          <InlineError message="Nenhum banco cadastrado para receber maquininha. Peça ao BPO para cadastrar uma conta bancária." />
        )}
        {machines.length === 0 && banks.length > 0 && (
          <p className="text-xs text-ink-soft dark:text-ink-soft-dark italic">
            Nenhuma maquininha adicionada. Adicione se houve vendas no cartão.
          </p>
        )}
        {machines.map((row) => (
          <div key={row.rowId} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <select
                className={`${inputClass} py-2.5 dark:[color-scheme:dark]`}
                value={row.bankAccountId}
                onChange={(event) =>
                  updateMachine(row.rowId, { bankAccountId: event.target.value })
                }
              >
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.bankName}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-24 shrink-0">
              <CurrencyInput
                className={`${inputClass} py-2.5`}
                value={row.amount}
                onChange={(amount) => updateMachine(row.rowId, { amount })}
              />
            </div>
            <button
              type="button"
              onClick={() => removeMachine(row.rowId)}
              className="p-2 text-ink-soft dark:text-ink-soft-dark hover:text-brand-red-600 dark:hover:text-rose-400 cursor-pointer shrink-0"
              aria-label="Remover maquininha"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addMachine}
          disabled={banks.length === 0}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed border-line dark:border-line-dark text-xs font-semibold text-ink-soft dark:text-ink-soft-dark hover:border-brand-navy-900/40 hover:text-brand-navy-900 dark:hover:text-brand-navy-700/90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar maquininha
        </button>
      </div>

      <Field label="Observação (opcional)">
        <textarea
          className={inputClass}
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Ex.: Tudo certo no caixa"
        />
      </Field>

      <PrimaryButton onClick={submit}>Calcular fechamento</PrimaryButton>
    </div>
  );
}

function CloseSummaryScreen({
  shift,
  shiftExpenses,
  shiftWithdrawals,
  shiftPixSales,
  pendingClose,
  bolsaBalance,
  bolsaBalanceLabel,
  bakery,
  onBack,
  onConfirmed,
  onError,
}: {
  shift: BakeryShift;
  shiftExpenses: BakeryExpense[];
  shiftWithdrawals: BakeryWithdrawal[];
  shiftPixSales: BakeryPixSale[];
  pendingClose: {
    finalBalance: number;
    note: string;
    cardMachineEntries: BakeryCardMachineEntry[];
  };
  bolsaBalance: number;
  bolsaBalanceLabel: string;
  bakery: BakeryCash;
  onBack: () => void;
  onConfirmed: () => void;
  onError: (message: string) => void;
}) {
  const previewTotals = computeShiftTotals(
    {
      ...shift,
      finalBalanceCounted: pendingClose.finalBalance,
      cardMachineEntries: pendingClose.cardMachineEntries,
    },
    shiftExpenses,
    shiftWithdrawals,
    shiftPixSales,
  );
  const pixByBank = shiftPixSales
    .filter((sale) => !sale.canceled)
    .reduce<Record<string, number>>((acc, sale) => {
      acc[sale.bankAccountName] = (acc[sale.bankAccountName] || 0) + sale.amount;
      return acc;
    }, {});

  const confirm = () => {
    bakery
      .closeShift({
        shiftId: shift.id,
        finalBalanceCounted: pendingClose.finalBalance,
        closeNote: pendingClose.note || undefined,
        cardMachineEntries: pendingClose.cardMachineEntries,
      })
      .then((result) => {
        if (!result.success) onError(result.error || "Não foi possível fechar o turno.");
        else onConfirmed();
      });
  };

  return (
    <div className="space-y-4">
      <ScreenHeader title="Resumo do turno" onBack={onBack} />

      <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg divide-y divide-line dark:divide-line-dark">
        {[
          ["Operadora", shift.operatorName],
          ["Turno", `${shift.shiftLabel} · ${shift.registerName}`],
          ["Saldo inicial", formatBRL(shift.initialBalance)],
          ["Despesas pagas pelo Caixa", formatBRL(previewTotals.caixaExpenses)],
          ["Despesas pagas pela Bolsa", formatBRL(previewTotals.bolsaExpenses)],
          ["Sangrias", formatBRL(previewTotals.withdrawalsTotal)],
          ["Saldo final", formatBRL(pendingClose.finalBalance)],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="text-ink-soft dark:text-ink-soft-dark">{label}</span>
            <span className="font-semibold text-ink dark:text-ink-dark">{value}</span>
          </div>
        ))}
      </div>

      <InitialBalanceDivergenceCard shift={shift} />

      <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 rounded-lg divide-y divide-emerald-100 dark:divide-emerald-500/20">
        <div className="flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
            Receita estimada em espécie
          </span>
          <span className="font-semibold text-emerald-800 dark:text-emerald-300">
            {formatBRL(previewTotals.estimatedCashRevenue)}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
            Vendas no PIX
          </span>
          <span className="font-semibold text-emerald-800 dark:text-emerald-300">
            {formatBRL(previewTotals.pixTotal)}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
            Vendas nas maquininhas
          </span>
          <span className="font-semibold text-emerald-800 dark:text-emerald-300">
            {formatBRL(previewTotals.cardMachineTotal)}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-base">
          <span className="text-emerald-800 dark:text-emerald-300 font-semibold">
            Receita total do turno
          </span>
          <span className="font-semibold text-emerald-900 dark:text-emerald-200">
            {formatBRL(previewTotals.totalRevenue)}
          </span>
        </div>
      </div>

      {Object.keys(pixByBank).length > 0 && (
        <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg divide-y divide-line dark:divide-line-dark">
          {Object.entries(pixByBank).map(([bank, value]: [string, number]) => (
            <div key={bank} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-ink-soft dark:text-ink-soft-dark">{bank}</span>
              <span className="font-semibold text-ink dark:text-ink-dark">
                {formatBRL(value)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="text-ink-soft dark:text-ink-soft-dark font-semibold">Total no PIX</span>
            <span className="font-semibold text-ink dark:text-ink-dark">
              {formatBRL(previewTotals.pixTotal)}
            </span>
          </div>
        </div>
      )}

      {pendingClose.cardMachineEntries.length > 0 && (
        <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg divide-y divide-line dark:divide-line-dark">
          {pendingClose.cardMachineEntries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-ink-soft dark:text-ink-soft-dark flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-ink-soft dark:text-ink-soft-dark" />{" "}
                {entry.bankAccountName}
              </span>
              <span className="font-semibold text-ink dark:text-ink-dark">
                {formatBRL(entry.amount)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="text-ink-soft dark:text-ink-soft-dark font-semibold">
              Total nas maquininhas
            </span>
            <span className="font-semibold text-ink dark:text-ink-dark">
              {formatBRL(previewTotals.cardMachineTotal)}
            </span>
          </div>
        </div>
      )}

      <div className="bg-brand-navy-900 rounded-lg p-4 text-white flex items-center justify-between">
        <p className="text-xs font-semibold text-brand-gold-300/80 uppercase">{bolsaBalanceLabel}</p>
        <p className="text-lg font-semibold">{formatBRL(bolsaBalance)}</p>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        <PrimaryButton variant="outline" onClick={onBack}>
          Voltar e corrigir
        </PrimaryButton>
        <PrimaryButton onClick={confirm}>Confirmar fechamento</PrimaryButton>
      </div>
    </div>
  );
}

function ClosedScreen({
  onViewHistory,
  onHome,
}: {
  onViewHistory: () => void;
  onHome: () => void;
}) {
  return (
    <div className="space-y-5 text-center py-6">
      <div className="mx-auto h-14 w-14 rounded-full bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">
        Turno fechado com sucesso!
      </h2>
      <p className="text-sm text-ink-soft dark:text-ink-soft-dark">
        O resumo foi salvo e o turno já está disponível no histórico.
      </p>
      <PrimaryButton variant="outline" onClick={onViewHistory}>
        Ver histórico de turnos
      </PrimaryButton>
      <PrimaryButton onClick={onHome}>Voltar para o início</PrimaryButton>
    </div>
  );
}

export default function OperatorApp() {
  const { currentUser, activeCompany, bankAccounts } = useBPOState();
  const bakery = useBakeryCashState();

  const [screen, setScreen] = useState<Screen>("home");
  const [formError, setFormError] = useState("");
  const [historyShiftId, setHistoryShiftId] = useState<string | null>(null);
  const [pendingClose, setPendingClose] = useState<{
    finalBalance: number;
    note: string;
    cardMachineEntries: BakeryCardMachineEntry[];
  }>({ finalBalance: 0, note: "", cardMachineEntries: [] });

  if (!activeCompany) return null;

  const openShift = bakery.getOpenShiftForOperator(
    activeCompany.id,
    currentUser.id,
  );
  const bolsa = bakery.getBolsaAccount(activeCompany.id);
  const registers = bakery.getRegistersForCompany(activeCompany.id);
  const pixBanks = bankAccounts.filter(
    (ba) => ba.companyId === activeCompany.id && !ba.isBolsaAccount,
  );

  const shiftExpenses = openShift
    ? bakery.expenses.filter((item) => item.shiftId === openShift.id)
    : [];
  const shiftWithdrawals = openShift
    ? bakery.withdrawals.filter((item) => item.shiftId === openShift.id)
    : [];
  const shiftPixSales = openShift
    ? bakery.pixSales.filter((item) => item.shiftId === openShift.id)
    : [];
  const totals = openShift
    ? computeShiftTotals(openShift, shiftExpenses, shiftWithdrawals, shiftPixSales)
    : null;

  const goHome = () => {
    setFormError("");
    setScreen("home");
  };

  const now = new Date();

  // "Operador do cliente": só enxerga o saldo da Bolsa movimentado no dia,
  // nunca o saldo acumulado da conta interna.
  const isRestrictedBolsaView =
    currentUser.role === "CLIENT" && Boolean(currentUser.clientOperator);

  const todayKey = now.toISOString().slice(0, 10);
  const companyShiftIds = new Set(
    bakery.shifts
      .filter((shift) => shift.companyId === activeCompany.id)
      .map((shift) => shift.id),
  );
  const todaysWithdrawals = bakery.withdrawals.filter(
    (item) =>
      companyShiftIds.has(item.shiftId) &&
      !item.canceled &&
      item.createdAt.slice(0, 10) === todayKey,
  );
  const todaysBolsaExpenses = bakery.expenses.filter(
    (item) =>
      companyShiftIds.has(item.shiftId) &&
      item.source === "BOLSA" &&
      !item.canceled &&
      item.createdAt.slice(0, 10) === todayKey,
  );
  const dailyBolsaBalance =
    todaysWithdrawals.reduce((sum, item) => sum + item.amount, 0) -
    todaysBolsaExpenses.reduce((sum, item) => sum + item.amount, 0);

  const bolsaBalanceLabel = isRestrictedBolsaView
    ? "Saldo diário da Bolsa"
    : "Saldo atual da Bolsa";
  const bolsaBalanceValue = isRestrictedBolsaView
    ? dailyBolsaBalance
    : bolsa?.balance || 0;

  // ---------------- HOME ----------------
  const renderHome = () => (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-brand-navy-900 text-brand-gold-300">
          <Store className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider">
            Caixa da Padaria
          </p>
          <h1 className="text-lg font-semibold text-ink dark:text-ink-dark">
            Olá, {currentUser.name.split(" ")[0]}!
          </h1>
        </div>
      </div>

      <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg p-4 space-y-2 shadow-sm">
        <p className="text-xs text-ink-soft dark:text-ink-soft-dark capitalize">
          {now.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </p>
        {openShift ? (
          <>
            <p className="text-sm font-semibold text-ink dark:text-ink-dark">
              Turno atual
            </p>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-ink dark:text-ink-dark">
                {openShift.shiftLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 px-2.5 py-1 rounded">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                {openShift.status}
              </span>
            </div>
            <p className="text-xs text-ink-soft dark:text-ink-soft-dark">
              {openShift.registerName} · Aberto às{" "}
              {new Date(openShift.openedAt).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark">
            Nenhum turno em andamento no momento.
          </p>
        )}
      </div>

      <div className="bg-brand-navy-900 rounded-lg p-4 space-y-1 text-white shadow-sm">
        <p className="text-[11px] font-semibold text-brand-gold-300/80 uppercase tracking-wider">
          {bolsaBalanceLabel}
        </p>
        <p className="text-2xl font-semibold">{formatBRL(bolsaBalanceValue)}</p>
        <button
          onClick={() => setScreen("bolsa")}
          className="text-[11px] font-semibold text-brand-gold-300 hover:underline cursor-pointer inline-flex items-center gap-1"
        >
          Ver movimentações de hoje <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <PrimaryButton
        onClick={() => setScreen(openShift ? "workspace" : "open")}
      >
        {openShift ? "Acessar turno" : "Iniciar turno"}
      </PrimaryButton>

      <PrimaryButton variant="outline" onClick={() => setScreen("history")}>
        <History className="h-4 w-4" /> Histórico de turnos
      </PrimaryButton>
    </div>
  );

  // ---------------- TURNO (WORKSPACE) ----------------
  const renderWorkspace = () => {
    if (!openShift || !totals) return null;

    const movements = [
      ...shiftExpenses.map((item) => ({
        id: item.id,
        kind: "expense" as const,
        createdAt: item.createdAt,
        item,
      })),
      ...shiftWithdrawals.map((item) => ({
        id: item.id,
        kind: "withdrawal" as const,
        createdAt: item.createdAt,
        item,
      })),
      ...shiftPixSales.map((item) => ({
        id: item.id,
        kind: "pix" as const,
        createdAt: item.createdAt,
        item,
      })),
    ].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return (
      <div className="space-y-4">
        <ScreenHeader
          title={`Turno da ${openShift.shiftLabel.toLowerCase()}`}
          subtitle={`${openShift.registerName} · Aberto desde ${new Date(
            openShift.openedAt,
          ).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
          onBack={goHome}
        />

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg p-2.5 flex flex-col gap-1.5">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-brand-navy-900/5 text-brand-navy-900 dark:bg-brand-navy-700/25 dark:text-brand-navy-700/90">
              <Wallet className="h-3.5 w-3.5" strokeWidth={2.25} />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase">
                Saldo inicial
              </p>
              <p className="text-base font-semibold text-ink dark:text-ink-dark">
                {formatBRL(openShift.initialBalance)}
              </p>
            </div>
          </div>
          <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg p-2.5 flex flex-col gap-1.5">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
              <Receipt className="h-3.5 w-3.5" strokeWidth={2.25} />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase">
                Despesas do Caixa
              </p>
              <p className="text-base font-semibold text-ink dark:text-ink-dark">
                {formatBRL(totals.caixaExpenses)}
              </p>
            </div>
          </div>
          <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg p-2.5 flex flex-col gap-1.5">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
              <Receipt className="h-3.5 w-3.5" strokeWidth={2.25} />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase">
                Despesas da Bolsa
              </p>
              <p className="text-base font-semibold text-ink dark:text-ink-dark">
                {formatBRL(totals.bolsaExpenses)}
              </p>
            </div>
          </div>
          <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg p-2.5 flex flex-col gap-1.5">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">
              <ArrowDownToLine className="h-3.5 w-3.5" strokeWidth={2.25} />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase">
                Sangrias
              </p>
              <p className="text-base font-semibold text-ink dark:text-ink-dark">
                {formatBRL(totals.withdrawalsTotal)}
              </p>
            </div>
          </div>
          <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg p-2.5 flex flex-col gap-1.5">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
              <QrCode className="h-3.5 w-3.5" strokeWidth={2.25} />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase">
                Vendas no PIX
              </p>
              <p className="text-base font-semibold text-ink dark:text-ink-dark">
                {formatBRL(totals.pixTotal)}
              </p>
            </div>
          </div>
          <button
            onClick={() => setScreen("bolsa")}
            className="bg-brand-navy-900 rounded-lg p-2.5 text-left text-white cursor-pointer flex flex-col gap-1.5"
          >
            <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-white/10 text-brand-gold-300">
              <Landmark className="h-3.5 w-3.5" strokeWidth={2.25} />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-brand-gold-300/80 uppercase">
                {bolsaBalanceLabel}
              </p>
              <p className="text-base font-semibold">{formatBRL(bolsaBalanceValue)}</p>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          <PrimaryButton onClick={() => setScreen("new-expense")}>
            <Receipt className="h-4 w-4" /> Nova despesa
          </PrimaryButton>
          <PrimaryButton onClick={() => setScreen("new-withdrawal")}>
            <ArrowDownToLine className="h-4 w-4" /> Nova sangria
          </PrimaryButton>
          <PrimaryButton onClick={() => setScreen("new-pix")}>
            <QrCode className="h-4 w-4" /> Venda no PIX
          </PrimaryButton>
          <PrimaryButton variant="danger" onClick={() => setScreen("close")}>
            Fechar caixa
          </PrimaryButton>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide">
            Movimentações do turno
          </p>
          {movements.length === 0 && (
            <p className="text-sm text-ink-soft dark:text-ink-soft-dark italic py-4 text-center">
              Nenhuma movimentação registrada ainda.
            </p>
          )}
          {movements.map(({ id, kind, item }) => {
            const time = new Date(item.createdAt).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            });
            if (kind === "expense") {
              const expense = item as (typeof shiftExpenses)[number];
              return (
                <div key={id}>
                  <MovementRow
                    icon={<Receipt className="h-4 w-4" />}
                    iconClass="bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
                    title={expense.description}
                    detail={`Origem: ${expense.source === "CAIXA" ? "Caixa" : "Bolsa"}`}
                    amountLabel={`- ${formatBRL(expense.amount)}`}
                    amountClass="text-brand-red-600 dark:text-rose-400"
                    time={time}
                    canceled={expense.canceled}
                    onCancel={() => bakery.cancelExpense(expense.id)}
                  />
                </div>
              );
            }
            if (kind === "withdrawal") {
              const withdrawal = item as (typeof shiftWithdrawals)[number];
              return (
                <div key={id}>
                  <MovementRow
                    icon={<ArrowDownToLine className="h-4 w-4" />}
                    iconClass="bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300"
                    title="Sangria"
                    detail="Caixa → Bolsa"
                    amountLabel={formatBRL(withdrawal.amount)}
                    amountClass="text-ink dark:text-ink-dark"
                    time={time}
                    canceled={withdrawal.canceled}
                    onCancel={() => bakery.cancelWithdrawal(withdrawal.id)}
                  />
                </div>
              );
            }
            const sale = item as BakeryPixSale;
            return (
              <div key={id}>
                <MovementRow
                  icon={<QrCode className="h-4 w-4" />}
                  iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                  title="Venda no PIX"
                  detail={`Recebido em: ${sale.bankAccountName} · ${sale.reconciliationStatus}`}
                  amountLabel={`+ ${formatBRL(sale.amount)}`}
                  amountClass="text-emerald-700 dark:text-emerald-400"
                  time={time}
                  canceled={sale.canceled}
                  onCancel={
                    sale.reconciliationStatus === "Conciliado"
                      ? undefined
                      : () => bakery.cancelPixSale(sale.id)
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ---------------- MOVIMENTAÇÕES DA BOLSA ----------------
  const renderBolsaMovements = () => {
    const events = [
      ...todaysWithdrawals.map((item) => ({
        time: item.createdAt,
        label: "Sangria recebida",
        amount: item.amount,
      })),
      ...todaysBolsaExpenses.map((item) => ({
        time: item.createdAt,
        label: item.description,
        amount: -item.amount,
      })),
    ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    const startOfDayBalance = (bolsa?.balance || 0) - dailyBolsaBalance;

    return (
      <div className="space-y-4">
        <ScreenHeader title="Movimentações da Bolsa" subtitle="Hoje" onBack={goHome} />

        {!isRestrictedBolsaView && (
          <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase">
                Saldo no início do dia
              </p>
              <p className="text-base font-semibold text-ink dark:text-ink-dark">
                {formatBRL(startOfDayBalance)}
              </p>
            </div>
            <Landmark className="h-6 w-6 text-ink-soft dark:text-ink-soft-dark" />
          </div>
        )}

        <div className="space-y-2">
          {events.length === 0 && (
            <p className="text-sm text-ink-soft dark:text-ink-soft-dark italic py-4 text-center">
              Nenhuma movimentação da Bolsa hoje.
            </p>
          )}
          {events.map((event, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg p-3.5"
            >
              <div>
                <p className="text-sm font-semibold text-ink dark:text-ink-dark">
                  {event.label}
                </p>
                <p className="text-[11px] text-ink-soft dark:text-ink-soft-dark">
                  {new Date(event.time).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <p
                className={`text-sm font-semibold ${event.amount >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-brand-red-600 dark:text-rose-400"}`}
              >
                {event.amount >= 0 ? "+ " : "- "}
                {formatBRL(Math.abs(event.amount))}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-brand-navy-900 rounded-lg p-4 text-white flex items-center justify-between">
          <p className="text-xs font-semibold text-brand-gold-300/80 uppercase">
            {isRestrictedBolsaView ? "Saldo diário da Bolsa" : "Saldo atual"}
          </p>
          <p className="text-xl font-semibold">{formatBRL(bolsaBalanceValue)}</p>
        </div>
      </div>
    );
  };

  // ---------------- HISTÓRICO ----------------
  const renderHistory = () => {
    const own = bakery.shifts
      .filter(
        (shift) =>
          shift.companyId === activeCompany.id && shift.operatorId === currentUser.id,
      )
      .sort(
        (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
      );

    return (
      <div className="space-y-4">
        <ScreenHeader title="Histórico" onBack={goHome} />
        {own.length === 0 && (
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark italic py-8 text-center">
            Você ainda não tem turnos registrados.
          </p>
        )}
        {own.map((shift) => (
          <button
            key={shift.id}
            onClick={() => {
              setHistoryShiftId(shift.id);
              setScreen("history-detail");
            }}
            className="w-full text-left bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg p-4 space-y-2 cursor-pointer hover:border-brand-navy-900/30 dark:hover:border-brand-navy-700/30"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink dark:text-ink-dark">
                {formatDate(shift.openedAt)} — {shift.shiftLabel}
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  shift.status === "Fechado"
                    ? "bg-canvas dark:bg-white/5 text-ink dark:text-ink-dark border-line dark:border-line-dark"
                    : shift.status === "Cancelado"
                      ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/25"
                      : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25"
                }`}
              >
                {shift.status}
              </span>
            </div>
            {shift.status === "Fechado" && (
              <div className="grid grid-cols-3 gap-2 text-xs text-ink-soft dark:text-ink-soft-dark">
                <div>
                  <p>Em espécie</p>
                  <p className="font-semibold text-ink dark:text-ink-dark">
                    {formatBRL(shift.estimatedCashRevenue || 0)}
                  </p>
                </div>
                <div>
                  <p>PIX</p>
                  <p className="font-semibold text-ink dark:text-ink-dark">
                    {formatBRL(shift.pixRevenueTotal || 0)}
                  </p>
                </div>
                <div>
                  <p>Total</p>
                  <p className="font-semibold text-ink dark:text-ink-dark">
                    {formatBRL(shift.totalRevenue || 0)}
                  </p>
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
    );
  };

  const renderHistoryDetail = () => {
    const shift = bakery.shifts.find((item) => item.id === historyShiftId);
    if (!shift) return null;
    const historyExpenses = bakery.expenses.filter((item) => item.shiftId === shift.id);
    const historyWithdrawals = bakery.withdrawals.filter((item) => item.shiftId === shift.id);
    const historyPix = bakery.pixSales.filter((item) => item.shiftId === shift.id);
    const historyTotals = computeShiftTotals(
      shift,
      historyExpenses,
      historyWithdrawals,
      historyPix,
    );
    const pixByBank = historyPix
      .filter((sale) => !sale.canceled)
      .reduce<Record<string, number>>((acc, sale) => {
        acc[sale.bankAccountName] = (acc[sale.bankAccountName] || 0) + sale.amount;
        return acc;
      }, {});

    return (
      <div className="space-y-4">
        <ScreenHeader
          title={`${shift.shiftLabel} · ${formatDate(shift.openedAt)}`}
          subtitle={shift.registerName}
          onBack={() => setScreen("history")}
        />
        <InitialBalanceDivergenceCard shift={shift} />
        <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg divide-y divide-line dark:divide-line-dark">
          {[
            ["Saldo inicial", formatBRL(shift.initialBalance)],
            ["Despesas do Caixa", formatBRL(historyTotals.caixaExpenses)],
            ["Despesas da Bolsa", formatBRL(historyTotals.bolsaExpenses)],
            ["Sangrias", formatBRL(historyTotals.withdrawalsTotal)],
            ["Vendas no PIX", formatBRL(historyTotals.pixTotal)],
            ["Vendas nas maquininhas", formatBRL(historyTotals.cardMachineTotal)],
            ["Saldo final", formatBRL(shift.finalBalanceCounted || 0)],
            ["Receita em espécie", formatBRL(shift.estimatedCashRevenue || 0)],
            ["Receita total", formatBRL(shift.totalRevenue || 0)],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-ink-soft dark:text-ink-soft-dark">{label}</span>
              <span className="font-semibold text-ink dark:text-ink-dark">{value}</span>
            </div>
          ))}
        </div>
        {Object.keys(pixByBank).length > 0 && (
          <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg divide-y divide-line dark:divide-line-dark">
            <div className="px-4 py-2 text-[11px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase">
              PIX por banco
            </div>
            {Object.entries(pixByBank).map(([bank, value]: [string, number]) => (
              <div key={bank} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-ink-soft dark:text-ink-soft-dark">{bank}</span>
                <span className="font-semibold text-ink dark:text-ink-dark">{formatBRL(value)}</span>
              </div>
            ))}
          </div>
        )}
        {(shift.cardMachineEntries || []).length > 0 && (
          <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg divide-y divide-line dark:divide-line-dark">
            <div className="px-4 py-2 text-[11px] font-semibold text-ink-soft dark:text-ink-soft-dark uppercase">
              Maquininhas
            </div>
            {(shift.cardMachineEntries || []).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-ink-soft dark:text-ink-soft-dark">{entry.bankAccountName}</span>
                <span className="font-semibold text-ink dark:text-ink-dark">{formatBRL(entry.amount)}</span>
              </div>
            ))}
          </div>
        )}
        {shift.status === "Cancelado" && (
          <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 rounded-lg p-3">
            <Ban className="h-4 w-4" /> Este turno foi cancelado pelo BPO.
          </div>
        )}
      </div>
    );
  };

  const screens: Record<Screen, () => React.ReactNode> = {
    home: renderHome,
    open: () => (
      <OpenShiftScreen
        registers={registers}
        bakery={bakery}
        formError={formError}
        setFormError={setFormError}
        onBack={goHome}
        onSuccess={() => setScreen("workspace")}
      />
    ),
    workspace: renderWorkspace,
    "new-expense": () =>
      openShift && (
        <NewExpenseScreen
          shiftId={openShift.id}
          bakery={bakery}
          formError={formError}
          setFormError={setFormError}
          onBack={() => setScreen("workspace")}
          onSuccess={() => setScreen("workspace")}
        />
      ),
    "new-withdrawal": () =>
      openShift && (
        <NewWithdrawalScreen
          shiftId={openShift.id}
          bakery={bakery}
          formError={formError}
          setFormError={setFormError}
          onBack={() => setScreen("workspace")}
          onSuccess={() => setScreen("workspace")}
        />
      ),
    "new-pix": () =>
      openShift && (
        <NewPixScreen
          shiftId={openShift.id}
          pixBanks={pixBanks}
          bakery={bakery}
          formError={formError}
          setFormError={setFormError}
          onBack={() => setScreen("workspace")}
          onSuccess={() => setScreen("workspace")}
        />
      ),
    bolsa: renderBolsaMovements,
    close: () => (
      <CloseScreen
        banks={pixBanks}
        formError={formError}
        setFormError={setFormError}
        onBack={() => setScreen("workspace")}
        onCalculated={(data) => {
          if (openShift) bakery.markAwaitingClose(openShift.id);
          setPendingClose(data);
          setScreen("close-summary");
        }}
      />
    ),
    "close-summary": () =>
      openShift && (
        <CloseSummaryScreen
          shift={openShift}
          shiftExpenses={shiftExpenses}
          shiftWithdrawals={shiftWithdrawals}
          shiftPixSales={shiftPixSales}
          pendingClose={pendingClose}
          bolsaBalance={bolsaBalanceValue}
          bolsaBalanceLabel={bolsaBalanceLabel}
          bakery={bakery}
          onBack={() => {
            bakery.cancelPendingClose(openShift.id);
            setScreen("close");
          }}
          onConfirmed={() => setScreen("closed")}
          onError={(message) => {
            setFormError(message);
            setScreen("close");
          }}
        />
      ),
    closed: () => (
      <ClosedScreen
        onViewHistory={() => setScreen("history")}
        onHome={goHome}
      />
    ),
    history: renderHistory,
    "history-detail": renderHistoryDetail,
  };

  return (
    <div className="max-w-md mx-auto pb-8">
      {screens[screen]()}
      {(screen === "home" || screen === "history") && (
        <div className="fixed bottom-0 left-0 right-0 md:hidden bg-surface dark:bg-surface-dark border-t border-line dark:border-line-dark flex items-center justify-around py-2 z-20">
          <button
            onClick={goHome}
            className={`flex flex-col items-center gap-0.5 px-6 py-1 text-[11px] font-semibold cursor-pointer ${
              screen === "home" ? "text-brand-navy-900 dark:text-brand-navy-700/90" : "text-ink-soft dark:text-ink-soft-dark"
            }`}
          >
            <Home className="h-5 w-5" /> Início
          </button>
          <button
            onClick={() => setScreen("history")}
            className={`flex flex-col items-center gap-0.5 px-6 py-1 text-[11px] font-semibold cursor-pointer ${
              screen === "history" ? "text-brand-navy-900 dark:text-brand-navy-700/90" : "text-ink-soft dark:text-ink-soft-dark"
            }`}
          >
            <History className="h-5 w-5" /> Histórico
          </button>
        </div>
      )}
    </div>
  );
}
