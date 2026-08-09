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
import { computeShiftTotals } from "../views/bakery/calculations";

const loadState = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(`bpo_saas_${key}`);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
};

export interface OperationResult {
  success: boolean;
  error?: string;
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
  }) => OperationResult;

  addExpense: (data: {
    shiftId: string;
    description: string;
    supplier?: string;
    amount: number;
    source: "CAIXA" | "BOLSA";
    category?: string;
    note?: string;
    receiptUrl?: string;
  }) => OperationResult;
  cancelExpense: (id: string) => OperationResult;

  addWithdrawal: (data: {
    shiftId: string;
    amount: number;
    note?: string;
    receiptUrl?: string;
  }) => OperationResult;
  cancelWithdrawal: (id: string) => OperationResult;

  addPixSale: (data: {
    shiftId: string;
    amount: number;
    bankAccountId: string;
    bankAccountName: string;
    customerName?: string;
    description?: string;
    note?: string;
    receiptUrl?: string;
  }) => OperationResult;
  cancelPixSale: (id: string) => OperationResult;
  setPixReconciliationStatus: (
    id: string,
    status: BakeryPixReconciliationStatus,
  ) => OperationResult;

  markAwaitingClose: (shiftId: string) => void;
  cancelPendingClose: (shiftId: string) => void;
  closeShift: (data: {
    shiftId: string;
    finalBalanceCounted: number;
    closeNote?: string;
    cardMachineEntries?: BakeryCardMachineEntry[];
  }) => OperationResult;
  reopenShift: (data: { shiftId: string; reason: string }) => OperationResult;
  cancelShift: (shiftId: string) => OperationResult;
}

const BakeryCashContext = createContext<BakeryCashContextType | undefined>(
  undefined,
);

export function BakeryCashProvider({ children }: { children: ReactNode }) {
  const {
    currentUser,
    activeCompany,
    bankAccounts,
    masterData,
    ensureBolsaAccount,
    applyBakeryBankMovement,
  } = useBPOState();

  const [shifts, setShifts] = useState<BakeryShift[]>(() =>
    loadState("bakeryShifts", []),
  );
  const [expenses, setExpenses] = useState<BakeryExpense[]>(() =>
    loadState("bakeryExpenses", []),
  );
  const [withdrawals, setWithdrawals] = useState<BakeryWithdrawal[]>(() =>
    loadState("bakeryWithdrawals", []),
  );
  const [pixSales, setPixSales] = useState<BakeryPixSale[]>(() =>
    loadState("bakeryPixSales", []),
  );

  const persistBolsaAccount = (companyId: string) => {
    void ensureBolsaAccount(companyId).catch((error) => {
      console.error("Falha ao preparar a conta Bolsa:", error);
    });
  };

  const persistBakeryBankMovement = (
    bankAccountId: string,
    delta: number,
    meta: { action: string; entityType: string; entityId: string },
  ) => {
    void applyBakeryBankMovement(bankAccountId, delta, meta).catch((error) => {
      console.error("Falha ao persistir movimentação bancária da Padaria:", error);
    });
  };

  useEffect(() => {
    localStorage.setItem("bpo_saas_bakeryShifts", JSON.stringify(shifts));
  }, [shifts]);
  useEffect(() => {
    localStorage.setItem("bpo_saas_bakeryExpenses", JSON.stringify(expenses));
  }, [expenses]);
  useEffect(() => {
    localStorage.setItem(
      "bpo_saas_bakeryWithdrawals",
      JSON.stringify(withdrawals),
    );
  }, [withdrawals]);
  useEffect(() => {
    localStorage.setItem("bpo_saas_bakeryPixSales", JSON.stringify(pixSales));
  }, [pixSales]);

  // Garante que a empresa ativa tenha a conta "Bolsa" assim que o módulo é
  // usado, sem exigir nenhum passo manual de cadastro do BPO.
  useEffect(() => {
    if (activeCompany) persistBolsaAccount(activeCompany.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const findEditableShift = (
    shiftId: string,
    predicate: (shift: BakeryShift) => boolean = () => true,
  ): { shift?: BakeryShift; error?: string } => {
    const shift = shifts.find((item) => item.id === shiftId);
    if (!shift) return { error: "Turno não encontrado." };
    if (shift.companyId !== activeCompany?.id)
      return { error: "Este turno não pertence à empresa ativa." };
    if (!["Aberto", "Reaberto"].includes(shift.status))
      return { error: "Este turno não está aberto para lançamentos." };
    if (shift.operatorId !== currentUser.id && !isBpoStaff)
      return { error: "Você só pode lançar movimentações no seu próprio turno." };
    if (!predicate(shift)) return { error: "Operação não permitida para este turno." };
    return { shift };
  };

  // --- ABERTURA DE TURNO ---
  const openShift: BakeryCashContextType["openShift"] = (data) => {
    if (!activeCompany) return { success: false, error: "Nenhuma empresa ativa." };
    if (getOpenShiftForOperator(activeCompany.id, currentUser.id))
      return {
        success: false,
        error: "Você já tem um turno aberto. Feche-o antes de iniciar outro.",
      };
    const conflictingShift = shifts.find(
      (shift) =>
        shift.registerId === data.registerId &&
        ["Aberto", "Aguardando fechamento", "Reaberto"].includes(shift.status),
    );
    if (conflictingShift)
      return {
        success: false,
        error: `${conflictingShift.registerName} já está aberto com ${conflictingShift.operatorName}.`,
      };

    persistBolsaAccount(activeCompany.id);

    const previousShift = getLastClosedShiftForRegister(data.registerId);

    const shift: BakeryShift = {
      id: `bshift-${Date.now()}`,
      companyId: activeCompany.id,
      registerId: data.registerId,
      registerName: data.registerName,
      shiftLabel: data.shiftLabel,
      operatorId: currentUser.id,
      operatorName: currentUser.name,
      status: "Aberto",
      openedAt: new Date().toISOString(),
      initialBalance: Number(data.initialBalance),
      openNote: data.openNote,
      initialBalanceJustification: data.initialBalanceJustification,
      previousShiftFinalBalance: previousShift?.finalBalanceCounted,
      closeHistory: [],
    };
    setShifts((prev) => [...prev, shift]);
    return { success: true };
  };

  // --- DESPESAS ---
  const addExpense: BakeryCashContextType["addExpense"] = (data) => {
    const { shift, error } = findEditableShift(data.shiftId);
    if (!shift) return { success: false, error };
    if (!(data.amount > 0))
      return { success: false, error: "Informe um valor válido." };

    const expense: BakeryExpense = {
      id: `bexp-${Date.now()}`,
      companyId: shift.companyId,
      shiftId: shift.id,
      description: data.description,
      supplier: data.supplier,
      amount: Number(data.amount),
      source: data.source,
      category: data.category,
      note: data.note,
      receiptUrl: data.receiptUrl,
      createdAt: new Date().toISOString(),
      createdById: currentUser.id,
      createdByName: currentUser.name,
    };
    setExpenses((prev) => [...prev, expense]);

    if (data.source === "BOLSA") {
      const bolsa = getBolsaAccount(shift.companyId);
      if (bolsa)
        persistBakeryBankMovement(bolsa.id, -expense.amount, {
          action: "CAIXA_PADARIA_DESPESA_BOLSA",
          entityType: "BakeryExpense",
          entityId: expense.id,
        });
    }
    return { success: true };
  };

  const cancelExpense: BakeryCashContextType["cancelExpense"] = (id) => {
    const expense = expenses.find((item) => item.id === id);
    if (!expense) return { success: false, error: "Despesa não encontrada." };
    if (expense.canceled) return { success: false, error: "Despesa já cancelada." };
    const shift = shifts.find((item) => item.id === expense.shiftId);
    const canCancel =
      isBpoStaff ||
      (expense.createdById === currentUser.id &&
        shift &&
        ["Aberto", "Reaberto"].includes(shift.status));
    if (!canCancel)
      return { success: false, error: "Você não pode cancelar esta despesa." };

    setExpenses((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              canceled: true,
              canceledAt: new Date().toISOString(),
              canceledById: currentUser.id,
            }
          : item,
      ),
    );
    if (expense.source === "BOLSA") {
      const bolsa = getBolsaAccount(expense.companyId);
      if (bolsa)
        persistBakeryBankMovement(bolsa.id, expense.amount, {
          action: "CAIXA_PADARIA_CANCELAR_DESPESA_BOLSA",
          entityType: "BakeryExpense",
          entityId: expense.id,
        });
    }
    return { success: true };
  };

  // --- SANGRIAS ---
  const addWithdrawal: BakeryCashContextType["addWithdrawal"] = (data) => {
    const { shift, error } = findEditableShift(data.shiftId);
    if (!shift) return { success: false, error };
    if (!(data.amount > 0))
      return { success: false, error: "Informe um valor válido." };

    const withdrawal: BakeryWithdrawal = {
      id: `bwd-${Date.now()}`,
      companyId: shift.companyId,
      shiftId: shift.id,
      amount: Number(data.amount),
      note: data.note,
      receiptUrl: data.receiptUrl,
      createdAt: new Date().toISOString(),
      createdById: currentUser.id,
      createdByName: currentUser.name,
    };
    setWithdrawals((prev) => [...prev, withdrawal]);

    const bolsa = getBolsaAccount(shift.companyId);
    if (bolsa)
      persistBakeryBankMovement(bolsa.id, withdrawal.amount, {
        action: "CAIXA_PADARIA_SANGRIA",
        entityType: "BakeryWithdrawal",
        entityId: withdrawal.id,
      });
    return { success: true };
  };

  const cancelWithdrawal: BakeryCashContextType["cancelWithdrawal"] = (id) => {
    const withdrawal = withdrawals.find((item) => item.id === id);
    if (!withdrawal) return { success: false, error: "Sangria não encontrada." };
    if (withdrawal.canceled)
      return { success: false, error: "Sangria já cancelada." };
    const shift = shifts.find((item) => item.id === withdrawal.shiftId);
    const canCancel =
      isBpoStaff ||
      (withdrawal.createdById === currentUser.id &&
        shift &&
        ["Aberto", "Reaberto"].includes(shift.status));
    if (!canCancel)
      return { success: false, error: "Você não pode cancelar esta sangria." };

    setWithdrawals((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              canceled: true,
              canceledAt: new Date().toISOString(),
              canceledById: currentUser.id,
            }
          : item,
      ),
    );
    const bolsa = getBolsaAccount(withdrawal.companyId);
    if (bolsa)
      persistBakeryBankMovement(bolsa.id, -withdrawal.amount, {
        action: "CAIXA_PADARIA_CANCELAR_SANGRIA",
        entityType: "BakeryWithdrawal",
        entityId: withdrawal.id,
      });
    return { success: true };
  };

  // --- VENDAS NO PIX ---
  const addPixSale: BakeryCashContextType["addPixSale"] = (data) => {
    const { shift, error } = findEditableShift(data.shiftId);
    if (!shift) return { success: false, error };
    if (!(data.amount > 0))
      return { success: false, error: "Informe um valor válido." };
    const bankAccount = bankAccounts.find(
      (ba) => ba.id === data.bankAccountId && ba.companyId === shift.companyId,
    );
    if (!bankAccount || bankAccount.isBolsaAccount)
      return { success: false, error: "Selecione um banco válido para o PIX." };

    const sale: BakeryPixSale = {
      id: `bpix-${Date.now()}`,
      companyId: shift.companyId,
      shiftId: shift.id,
      amount: Number(data.amount),
      bankAccountId: bankAccount.id,
      bankAccountName: bankAccount.bankName,
      customerName: data.customerName,
      description: data.description,
      note: data.note,
      receiptUrl: data.receiptUrl,
      createdAt: new Date().toISOString(),
      createdById: currentUser.id,
      createdByName: currentUser.name,
      reconciliationStatus: "Aguardando conciliação",
    };
    setPixSales((prev) => [...prev, sale]);
    persistBakeryBankMovement(bankAccount.id, sale.amount, {
      action: "CAIXA_PADARIA_VENDA_PIX",
      entityType: "BakeryPixSale",
      entityId: sale.id,
    });
    return { success: true };
  };

  const cancelPixSale: BakeryCashContextType["cancelPixSale"] = (id) => {
    const sale = pixSales.find((item) => item.id === id);
    if (!sale) return { success: false, error: "Venda não encontrada." };
    if (sale.canceled) return { success: false, error: "Venda já cancelada." };
    if (sale.reconciliationStatus === "Conciliado")
      return {
        success: false,
        error: "Uma venda já conciliada só pode ser corrigida pelo BPO.",
      };
    const shift = shifts.find((item) => item.id === sale.shiftId);
    const canCancel =
      isBpoStaff ||
      (sale.createdById === currentUser.id &&
        shift &&
        ["Aberto", "Reaberto"].includes(shift.status));
    if (!canCancel)
      return { success: false, error: "Você não pode cancelar esta venda." };

    setPixSales((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              canceled: true,
              canceledAt: new Date().toISOString(),
              canceledById: currentUser.id,
            }
          : item,
      ),
    );
    persistBakeryBankMovement(sale.bankAccountId, -sale.amount, {
      action: "CAIXA_PADARIA_CANCELAR_VENDA_PIX",
      entityType: "BakeryPixSale",
      entityId: sale.id,
    });
    return { success: true };
  };

  const setPixReconciliationStatus: BakeryCashContextType["setPixReconciliationStatus"] = (
    id,
    status,
  ) => {
    if (!isBpoStaff)
      return {
        success: false,
        error: "Apenas o BPO pode alterar o status de conciliação.",
      };
    setPixSales((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              reconciliationStatus: status,
              reconciledAt:
                status === "Aguardando conciliação" ? undefined : new Date().toISOString(),
              reconciledById:
                status === "Aguardando conciliação" ? undefined : currentUser.id,
            }
          : item,
      ),
    );
    return { success: true };
  };

  // --- FECHAMENTO ---
  const markAwaitingClose = (shiftId: string) => {
    setShifts((prev) =>
      prev.map((shift) =>
        shift.id === shiftId && ["Aberto", "Reaberto"].includes(shift.status)
          ? { ...shift, status: "Aguardando fechamento" }
          : shift,
      ),
    );
  };

  const cancelPendingClose = (shiftId: string) => {
    setShifts((prev) =>
      prev.map((shift) =>
        shift.id === shiftId && shift.status === "Aguardando fechamento"
          ? { ...shift, status: "Aberto" }
          : shift,
      ),
    );
  };

  const closeShift: BakeryCashContextType["closeShift"] = (data) => {
    const shift = shifts.find((item) => item.id === data.shiftId);
    if (!shift) return { success: false, error: "Turno não encontrado." };
    if (shift.operatorId !== currentUser.id && !isBpoStaff)
      return { success: false, error: "Você só pode fechar o próprio turno." };
    if (!["Aberto", "Aguardando fechamento", "Reaberto"].includes(shift.status))
      return { success: false, error: "Este turno não pode ser fechado." };
    if (!(data.finalBalanceCounted >= 0))
      return { success: false, error: "Informe o saldo final contado." };

    // Reabertura + novo fechamento: desfaz os lançamentos de maquininha do
    // fechamento anterior antes de aplicar os novos, para não contar em
    // dobro o saldo bancário.
    (shift.cardMachineEntries || []).forEach((entry) => {
      persistBakeryBankMovement(entry.bankAccountId, -entry.amount, {
        action: "CAIXA_PADARIA_ESTORNAR_MAQUININHA_REFECHAMENTO",
        entityType: "BakeryShift",
        entityId: shift.id,
      });
    });

    const cardMachineEntries = data.cardMachineEntries || [];
    cardMachineEntries.forEach((entry) => {
      persistBakeryBankMovement(entry.bankAccountId, entry.amount, {
        action: "CAIXA_PADARIA_VENDA_MAQUININHA",
        entityType: "BakeryShift",
        entityId: shift.id,
      });
    });

    const totals = computeShiftTotals(
      {
        ...shift,
        finalBalanceCounted: Number(data.finalBalanceCounted),
        cardMachineEntries,
      },
      expenses,
      withdrawals,
      pixSales,
    );

    const snapshot = {
      closedAt: new Date().toISOString(),
      finalBalanceCounted: Number(data.finalBalanceCounted),
      estimatedCashRevenue: totals.estimatedCashRevenue,
      pixRevenueTotal: totals.pixTotal,
      cardMachineTotal: totals.cardMachineTotal,
      cardMachineEntries,
      totalRevenue: totals.totalRevenue,
      changedById: currentUser.id,
      changedByName: currentUser.name,
      reason: shift.status === "Reaberto" ? shift.reopenReason : undefined,
    };

    setShifts((prev) =>
      prev.map((item) =>
        item.id === shift.id
          ? {
              ...item,
              status: "Fechado",
              closedAt: snapshot.closedAt,
              finalBalanceCounted: snapshot.finalBalanceCounted,
              closeNote: data.closeNote,
              estimatedCashRevenue: snapshot.estimatedCashRevenue,
              pixRevenueTotal: snapshot.pixRevenueTotal,
              cardMachineEntries: snapshot.cardMachineEntries,
              cardMachineTotal: snapshot.cardMachineTotal,
              totalRevenue: snapshot.totalRevenue,
              closeHistory: [...item.closeHistory, snapshot],
            }
          : item,
      ),
    );
    return { success: true };
  };

  const reopenShift: BakeryCashContextType["reopenShift"] = (data) => {
    if (!isBpoStaff)
      return {
        success: false,
        error: "Apenas o BPO pode reabrir um turno fechado.",
      };
    const shift = shifts.find((item) => item.id === data.shiftId);
    if (!shift) return { success: false, error: "Turno não encontrado." };
    if (shift.status !== "Fechado")
      return { success: false, error: "Somente turnos fechados podem ser reabertos." };
    if (!data.reason.trim())
      return { success: false, error: "Informe a justificativa da reabertura." };

    setShifts((prev) =>
      prev.map((item) =>
        item.id === shift.id
          ? {
              ...item,
              status: "Reaberto",
              reopenedAt: new Date().toISOString(),
              reopenedById: currentUser.id,
              reopenedByName: currentUser.name,
              reopenReason: data.reason,
            }
          : item,
      ),
    );
    return { success: true };
  };

  const cancelShift: BakeryCashContextType["cancelShift"] = (shiftId) => {
    if (!isBpoStaff)
      return { success: false, error: "Apenas o BPO pode cancelar um turno." };
    const shift = shifts.find((item) => item.id === shiftId);
    if (!shift) return { success: false, error: "Turno não encontrado." };
    if (shift.status === "Fechado")
      return {
        success: false,
        error: "Reabra o turno antes de cancelá-lo.",
      };
    setShifts((prev) =>
      prev.map((item) =>
        item.id === shiftId ? { ...item, status: "Cancelado" } : item,
      ),
    );
    return { success: true };
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
