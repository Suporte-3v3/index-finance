/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  BakeryCardMachineEntry,
  BakeryExpense,
  BakeryPixReconciliationStatus,
  BakeryPixSale,
  BakeryShift,
  BakeryWithdrawal,
  BankAccount,
  MasterDataOption,
} from "../types";
import { useBPOState } from "./useBPOState";
import {
  BakeryCashServiceError,
  addPersistedExpense,
  addPersistedPixSale,
  addPersistedWithdrawal,
  cancelPersistedExpense,
  cancelPersistedPendingClose,
  cancelPersistedPixSale,
  cancelPersistedShift,
  cancelPersistedWithdrawal,
  closePersistedShift,
  fetchBakeryCash,
  markPersistedShiftAwaitingClose,
  openPersistedShift,
  reopenPersistedShift,
  setPersistedPixReconciliationStatus,
} from "../services/bakeryCash";

export interface OperationResult {
  success: boolean;
  error?: string;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof BakeryCashServiceError ? error.message : fallback;
}

interface BakeryCashContextType {
  shifts: BakeryShift[];
  expenses: BakeryExpense[];
  withdrawals: BakeryWithdrawal[];
  pixSales: BakeryPixSale[];

  getRegistersForCompany: (companyId: string) => MasterDataOption[];
  getBolsaAccount: (companyId: string) => BankAccount | undefined;
  getOpenShiftForOperator: (
    companyId: string,
    operatorId: string,
  ) => BakeryShift | undefined;
  getLastClosedShiftForRegister: (registerId: string) => BakeryShift | undefined;

  openShift: (data: {
    registerId: string;
    registerName: string;
    shiftLabel: string;
    initialBalance: number;
    openNote?: string;
    initialBalanceJustification?: string;
  }) => Promise<OperationResult>;

  addExpense: (data: {
    shiftId: string;
    description: string;
    supplier?: string;
    amount: number;
    source: "CAIXA" | "BOLSA";
    category?: string;
    note?: string;
    receiptUrl?: string;
  }) => Promise<OperationResult>;
  cancelExpense: (id: string) => Promise<OperationResult>;

  addWithdrawal: (data: {
    shiftId: string;
    amount: number;
    note?: string;
    receiptUrl?: string;
  }) => Promise<OperationResult>;
  cancelWithdrawal: (id: string) => Promise<OperationResult>;

  addPixSale: (data: {
    shiftId: string;
    amount: number;
    bankAccountId: string;
    bankAccountName: string;
    customerName?: string;
    description?: string;
    note?: string;
    receiptUrl?: string;
  }) => Promise<OperationResult>;
  cancelPixSale: (id: string) => Promise<OperationResult>;
  setPixReconciliationStatus: (
    id: string,
    status: BakeryPixReconciliationStatus,
  ) => Promise<OperationResult>;

  markAwaitingClose: (shiftId: string) => void;
  cancelPendingClose: (shiftId: string) => void;
  closeShift: (data: {
    shiftId: string;
    finalBalanceCounted: number;
    closeNote?: string;
    cardMachineEntries?: BakeryCardMachineEntry[];
  }) => Promise<OperationResult>;
  reopenShift: (data: { shiftId: string; reason: string }) => Promise<OperationResult>;
  cancelShift: (shiftId: string) => Promise<OperationResult>;
}

const BakeryCashContext = createContext<BakeryCashContextType | undefined>(
  undefined,
);

export function BakeryCashProvider({ children }: { children: ReactNode }) {
  const { currentUser, activeCompany, bankAccounts, masterData } = useBPOState();

  const [shifts, setShifts] = useState<BakeryShift[]>([]);
  const [expenses, setExpenses] = useState<BakeryExpense[]>([]);
  const [withdrawals, setWithdrawals] = useState<BakeryWithdrawal[]>([]);
  const [pixSales, setPixSales] = useState<BakeryPixSale[]>([]);

  useEffect(() => {
    if (!activeCompany) return;
    let cancelled = false;
    void fetchBakeryCash()
      .then((workspace) => {
        if (cancelled) return;
        setShifts(workspace.shifts);
        setExpenses(workspace.expenses);
        setWithdrawals(workspace.withdrawals);
        setPixSales(workspace.pixSales);
      })
      .catch((error) =>
        console.error("Failed to load bakery cash:", error instanceof Error ? error.message : error),
      );
    return () => {
      cancelled = true;
    };
  }, [activeCompany?.id]);

  const isBpoStaff = ["BPO_ADMIN", "BPO_TEAM"].includes(currentUser.role);

  const getRegistersForCompany = (companyId: string) =>
    masterData.filter(
      (item) =>
        item.companyId === companyId &&
        item.type === "BAKERY_REGISTER" &&
        item.active,
    );

  const getBolsaAccount = (companyId: string) =>
    bankAccounts.find((ba) => ba.companyId === companyId && ba.isBolsaAccount);

  const getOpenShiftForOperator = (companyId: string, operatorId: string) =>
    shifts.find(
      (shift) =>
        shift.companyId === companyId &&
        shift.operatorId === operatorId &&
        ["Aberto", "Aguardando fechamento", "Reaberto"].includes(shift.status),
    );

  const getLastClosedShiftForRegister = (registerId: string) =>
    shifts
      .filter((shift) => shift.registerId === registerId && shift.status === "Fechado")
      .sort(
        (a, b) => new Date(b.closedAt || 0).getTime() - new Date(a.closedAt || 0).getTime(),
      )[0];

  // --- ABERTURA DE TURNO ---
  const openShift: BakeryCashContextType["openShift"] = (data) => {
    if (!activeCompany) return Promise.resolve({ success: false, error: "Nenhuma empresa ativa." });
    return openPersistedShift({ companyId: activeCompany.id, ...data })
      .then((shift) => {
        setShifts((prev) => [...prev, shift]);
        return { success: true };
      })
      .catch((error) => ({ success: false, error: errorMessage(error, "Não foi possível abrir o caixa.") }));
  };

  // --- DESPESAS ---
  const addExpense: BakeryCashContextType["addExpense"] = (data) =>
    addPersistedExpense(data)
      .then((expense) => {
        setExpenses((prev) => [...prev, expense]);
        return { success: true };
      })
      .catch((error) => ({ success: false, error: errorMessage(error, "Não foi possível lançar a despesa.") }));

  const cancelExpense: BakeryCashContextType["cancelExpense"] = (id) =>
    cancelPersistedExpense(id)
      .then((expense) => {
        setExpenses((prev) => prev.map((item) => (item.id === expense.id ? expense : item)));
        return { success: true };
      })
      .catch((error) => ({ success: false, error: errorMessage(error, "Não foi possível cancelar a despesa.") }));

  // --- SANGRIAS ---
  const addWithdrawal: BakeryCashContextType["addWithdrawal"] = (data) =>
    addPersistedWithdrawal(data)
      .then((withdrawal) => {
        setWithdrawals((prev) => [...prev, withdrawal]);
        return { success: true };
      })
      .catch((error) => ({ success: false, error: errorMessage(error, "Não foi possível lançar a sangria.") }));

  const cancelWithdrawal: BakeryCashContextType["cancelWithdrawal"] = (id) =>
    cancelPersistedWithdrawal(id)
      .then((withdrawal) => {
        setWithdrawals((prev) => prev.map((item) => (item.id === withdrawal.id ? withdrawal : item)));
        return { success: true };
      })
      .catch((error) => ({ success: false, error: errorMessage(error, "Não foi possível cancelar a sangria.") }));

  // --- VENDAS NO PIX ---
  const addPixSale: BakeryCashContextType["addPixSale"] = (data) =>
    addPersistedPixSale(data)
      .then((sale) => {
        setPixSales((prev) => [...prev, sale]);
        return { success: true };
      })
      .catch((error) => ({ success: false, error: errorMessage(error, "Não foi possível lançar a venda no PIX.") }));

  const cancelPixSale: BakeryCashContextType["cancelPixSale"] = (id) =>
    cancelPersistedPixSale(id)
      .then((sale) => {
        setPixSales((prev) => prev.map((item) => (item.id === sale.id ? sale : item)));
        return { success: true };
      })
      .catch((error) => ({ success: false, error: errorMessage(error, "Não foi possível cancelar a venda no PIX.") }));

  const setPixReconciliationStatus: BakeryCashContextType["setPixReconciliationStatus"] = (
    id,
    status,
  ) => {
    if (!isBpoStaff) {
      return Promise.resolve({
        success: false,
        error: "Apenas o BPO pode alterar o status de conciliação.",
      });
    }
    return setPersistedPixReconciliationStatus(id, status)
      .then((sale) => {
        setPixSales((prev) => prev.map((item) => (item.id === sale.id ? sale : item)));
        return { success: true };
      })
      .catch((error) => ({
        success: false,
        error: errorMessage(error, "Não foi possível atualizar a conciliação."),
      }));
  };

  // --- FECHAMENTO ---
  const markAwaitingClose = (shiftId: string) => {
    void markPersistedShiftAwaitingClose(shiftId)
      .then((shift) => setShifts((prev) => prev.map((item) => (item.id === shift.id ? shift : item))))
      .catch((error) =>
        console.error("Failed to mark shift awaiting close:", error instanceof Error ? error.message : error),
      );
  };

  const cancelPendingClose = (shiftId: string) => {
    void cancelPersistedPendingClose(shiftId)
      .then((shift) => setShifts((prev) => prev.map((item) => (item.id === shift.id ? shift : item))))
      .catch((error) =>
        console.error("Failed to cancel pending close:", error instanceof Error ? error.message : error),
      );
  };

  const closeShift: BakeryCashContextType["closeShift"] = (data) =>
    closePersistedShift(data.shiftId, {
      finalBalanceCounted: data.finalBalanceCounted,
      closeNote: data.closeNote,
      cardMachineEntries: data.cardMachineEntries || [],
    })
      .then((shift) => {
        setShifts((prev) => prev.map((item) => (item.id === shift.id ? shift : item)));
        return { success: true };
      })
      .catch((error) => ({ success: false, error: errorMessage(error, "Não foi possível fechar o turno.") }));

  const reopenShift: BakeryCashContextType["reopenShift"] = (data) => {
    if (!isBpoStaff) {
      return Promise.resolve({
        success: false,
        error: "Apenas o BPO pode reabrir um turno fechado.",
      });
    }
    return reopenPersistedShift(data.shiftId, data.reason)
      .then((shift) => {
        setShifts((prev) => prev.map((item) => (item.id === shift.id ? shift : item)));
        return { success: true };
      })
      .catch((error) => ({ success: false, error: errorMessage(error, "Não foi possível reabrir o turno.") }));
  };

  const cancelShift: BakeryCashContextType["cancelShift"] = (shiftId) => {
    if (!isBpoStaff) {
      return Promise.resolve({ success: false, error: "Apenas o BPO pode cancelar um turno." });
    }
    return cancelPersistedShift(shiftId)
      .then((shift) => {
        setShifts((prev) => prev.map((item) => (item.id === shift.id ? shift : item)));
        return { success: true };
      })
      .catch((error) => ({ success: false, error: errorMessage(error, "Não foi possível cancelar o turno.") }));
  };

  return (
    <BakeryCashContext.Provider
      value={{
        shifts,
        expenses,
        withdrawals,
        pixSales,
        getRegistersForCompany,
        getBolsaAccount,
        getOpenShiftForOperator,
        getLastClosedShiftForRegister,
        openShift,
        addExpense,
        cancelExpense,
        addWithdrawal,
        cancelWithdrawal,
        addPixSale,
        cancelPixSale,
        setPixReconciliationStatus,
        markAwaitingClose,
        cancelPendingClose,
        closeShift,
        reopenShift,
        cancelShift,
      }}
    >
      {children}
    </BakeryCashContext.Provider>
  );
}

export function useBakeryCashState() {
  const context = useContext(BakeryCashContext);
  if (!context)
    throw new Error(
      "useBakeryCashState deve ser usado dentro de um BakeryCashProvider",
    );
  return context;
}
