/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AccountPayable,
  AccountReceivable,
  BankAccount,
  DreReportOptions,
  ReportBlockConfig,
  ReportDateBasis,
  ReportFilters,
  ReportModelType,
} from "../types";
import { ReportCell, ReportSectionData } from "./reportFiles";
import { getBlockDefinition } from "../config/reportBlocks";

export interface ReportDataSource {
  accountsPayable: AccountPayable[];
  accountsReceivable: AccountReceivable[];
  bankAccounts: BankAccount[];
}

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const percent = (value: number, total: number) =>
  total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "—";

const today = () => new Date().toISOString().slice(0, 10);

const inRange = (date: string, start: string, end: string) =>
  Boolean(date) && date >= start && date <= end;

const isCanceledPayable = (status: AccountPayable["status"]) =>
  status === "Cancelada" || status === "Rejeitada";
const isPaidPayable = (status: AccountPayable["status"]) => status === "Paga";
const isCanceledReceivable = (status: AccountReceivable["status"]) =>
  status === "Cancelado";

export const apDate = (item: AccountPayable, basis: ReportDateBasis): string => {
  if (basis === "payment") return item.paymentDate || item.dueDate;
  if (basis === "competence") return `${item.competenceMonth}-01`;
  return item.dueDate;
};

export const arDate = (item: AccountReceivable, basis: ReportDateBasis): string => {
  if (basis === "payment") return item.receiptDate || item.dueDate;
  if (basis === "competence") return `${item.competenceMonth}-01`;
  return item.dueDate;
};

export const previousPeriodRange = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days + 1);
  return {
    startDate: prevStart.toISOString().slice(0, 10),
    endDate: prevEnd.toISOString().slice(0, 10),
  };
};

const filterPayables = (
  payables: AccountPayable[],
  filters: ReportFilters,
  range: { startDate: string; endDate: string },
) =>
  payables.filter(
    (item) =>
      !isCanceledPayable(item.status) &&
      inRange(apDate(item, filters.dateBasis), range.startDate, range.endDate) &&
      (!filters.supplier || item.supplier === filters.supplier) &&
      (!filters.category || item.category === filters.category) &&
      (!filters.costCenter || item.costCenter === filters.costCenter) &&
      (!filters.bankAccountId || item.bankAccountId === filters.bankAccountId) &&
      (!filters.status || item.status === filters.status) &&
      (!filters.paymentMethod || item.paymentMethod === filters.paymentMethod),
  );

const filterReceivables = (
  receivables: AccountReceivable[],
  filters: ReportFilters,
  range: { startDate: string; endDate: string },
) =>
  receivables.filter(
    (item) =>
      !isCanceledReceivable(item.status) &&
      inRange(arDate(item, filters.dateBasis), range.startDate, range.endDate) &&
      (!filters.customer || item.customer === filters.customer) &&
      (!filters.category || item.category === filters.category) &&
      (!filters.costCenter || item.costCenter === filters.costCenter) &&
      (!filters.bankAccountId || item.bankAccountId === filters.bankAccountId) &&
      (!filters.status || item.status === filters.status) &&
      (!filters.paymentMethod || item.paymentMethod === filters.paymentMethod),
  );

const payablePaid = (item: AccountPayable) =>
  item.paidAmount ?? (isPaidPayable(item.status) ? item.finalAmount : 0);

const groupSum = <T,>(items: T[], keyOf: (item: T) => string, valueOf: (item: T) => number) => {
  const map = new Map<string, number>();
  items.forEach((item) => {
    const key = keyOf(item) || "—";
    map.set(key, (map.get(key) || 0) + valueOf(item));
  });
  return map;
};

const rankedRows = (
  groupLabel: string,
  map: Map<string, number>,
  limit: number | undefined,
  showPercent: boolean | undefined,
) => {
  const total = Array.from(map.values()).reduce((sum, value) => sum + value, 0);
  const sorted = Array.from(map.entries()).sort(([, left], [, right]) => right - left);
  const sliced = limit ? sorted.slice(0, limit) : sorted;
  const columns = showPercent ? [groupLabel, "Valor", "%"] : [groupLabel, "Valor"];
  const rows: ReportCell[][] = sliced.map(([label, value]) =>
    showPercent ? [label, money(value), percent(value, total)] : [label, money(value)],
  );
  const chartRows: ReportCell[][] = sliced.map(([label, value]) => [label, value]);
  return { columns, rows, chartRows, total };
};

const groupedSection = (
  title: string,
  groupLabel: string,
  map: Map<string, number>,
  config: ReportBlockConfig,
): ReportSectionData => {
  const { columns, rows, chartRows } = rankedRows(groupLabel, map, config.limit, config.showPercent);
  const visualization = config.visualization || "table";
  if (visualization === "table" || rows.length === 0) {
    return { kind: "table", title, columns, rows };
  }
  return {
    kind: "chart",
    title,
    chartType: visualization,
    columns: [groupLabel, "Valor"],
    rows: chartRows,
  };
};

const accountNameOf = (data: ReportDataSource, id: string) =>
  data.bankAccounts.find((account) => account.id === id)?.bankName || id;

const projectColumns = (
  availableColumns: string[],
  values: Record<string, ReportCell>,
  selected: string[] | undefined,
) => {
  const columns = selected && selected.length > 0 ? selected : availableColumns;
  return columns.map((column) => values[column] ?? "");
};

const daysLate = (dueDate: string) =>
  Math.max(0, Math.round((Date.parse(today()) - Date.parse(dueDate)) / 86400000));

function computeApBlock(
  config: ReportBlockConfig,
  filters: ReportFilters,
  range: { startDate: string; endDate: string },
  data: ReportDataSource,
): ReportSectionData {
  const definition = getBlockDefinition("Contas a Pagar", config.blockKey);
  const title = config.title || definition?.label || config.blockKey;
  const payables = filterPayables(data.accountsPayable, filters, range);

  switch (config.blockKey) {
    case "AP_SUMMARY": {
      const previsto = payables.reduce((sum, item) => sum + item.finalAmount, 0);
      const pago = payables.reduce((sum, item) => sum + payablePaid(item), 0);
      const vencido = payables
        .filter((item) => item.dueDate < today() && !isPaidPayable(item.status))
        .reduce((sum, item) => sum + (item.finalAmount - payablePaid(item)), 0);
      const items = [
        { label: "Total previsto", value: money(previsto) },
        { label: "Total pago", value: money(pago) },
        { label: "Total em aberto", value: money(Math.max(0, previsto - pago)) },
        { label: "Total vencido", value: money(vencido) },
      ];
      if (config.compareWithPreviousPeriod) {
        const prevPayables = filterPayables(data.accountsPayable, filters, previousPeriodRange(range.startDate, range.endDate));
        const prevPrevisto = prevPayables.reduce((sum, item) => sum + item.finalAmount, 0);
        items.push({ label: "Total previsto (período anterior)", value: money(prevPrevisto) });
      }
      return { kind: "kpis", title, items };
    }
    case "AP_OVERDUE": {
      const overdue = payables
        .filter((item) => item.dueDate < today() && !isPaidPayable(item.status))
        .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
      const sliced = config.limit ? overdue.slice(0, config.limit) : overdue;
      return {
        kind: "table",
        title,
        columns: ["Vencimento", "Fornecedor", "Descrição", "Valor", "Dias em atraso"],
        rows: sliced.map((item) => [
          item.dueDate,
          item.supplier,
          item.description,
          money(item.finalAmount - payablePaid(item)),
          daysLate(item.dueDate),
        ]),
      };
    }
    case "AP_UPCOMING": {
      const upcoming = payables
        .filter((item) => item.dueDate >= today() && !isPaidPayable(item.status))
        .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
      const sliced = config.limit ? upcoming.slice(0, config.limit) : upcoming;
      return {
        kind: "table",
        title,
        columns: ["Vencimento", "Fornecedor", "Descrição", "Valor"],
        rows: sliced.map((item) => [item.dueDate, item.supplier, item.description, money(item.finalAmount)]),
      };
    }
    case "AP_BY_PERIOD": {
      const map = groupSum(payables, (item) => apDate(item, filters.dateBasis).slice(0, 7), (item) => item.finalAmount);
      const sortedEntries = Array.from(map.entries()).sort(([left], [right]) => left.localeCompare(right));
      if ((config.visualization || "bar") === "table") {
        return {
          kind: "table",
          title,
          columns: ["Mês", "Pagamentos"],
          rows: sortedEntries.map(([month, value]) => [month, money(value)]),
        };
      }
      return {
        kind: "chart",
        title,
        chartType: "bar",
        columns: ["Mês", "Pagamentos"],
        rows: sortedEntries.map(([month, value]) => [month, value]),
      };
    }
    case "AP_BY_CATEGORY":
      return groupedSection(title, "Categoria", groupSum(payables, (item) => item.category, (item) => item.finalAmount), config);
    case "AP_BY_COST_CENTER":
      return groupedSection(title, "Centro de custo", groupSum(payables, (item) => item.costCenter, (item) => item.finalAmount), config);
    case "AP_BY_SUPPLIER":
      return groupedSection(title, "Fornecedor", groupSum(payables, (item) => item.supplier, (item) => item.finalAmount), config);
    case "AP_BY_BANK_ACCOUNT":
      return groupedSection(
        title,
        "Conta bancária",
        groupSum(payables, (item) => accountNameOf(data, item.bankAccountId), (item) => item.finalAmount),
        config,
      );
    case "AP_DETAIL_LIST": {
      const availableColumns = definition?.availableColumns || [];
      const columns = config.columns && config.columns.length > 0 ? config.columns : definition?.defaultColumns || availableColumns;
      const rows = payables
        .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
        .map((item) =>
          projectColumns(availableColumns, {
            Vencimento: item.dueDate,
            Fornecedor: item.supplier,
            Descrição: item.description,
            Categoria: item.category,
            "Centro de custo": item.costCenter,
            Valor: money(item.finalAmount),
            Status: item.status,
            "Conta bancária": accountNameOf(data, item.bankAccountId),
            "Número do documento": item.documentNumber,
            Competência: item.competenceMonth,
          }, columns),
        );
      return { kind: "table", title, columns, rows };
    }
    default:
      return { kind: "table", title, columns: [], rows: [] };
  }
}

function computeArBlock(
  config: ReportBlockConfig,
  filters: ReportFilters,
  range: { startDate: string; endDate: string },
  data: ReportDataSource,
): ReportSectionData {
  const definition = getBlockDefinition("Contas a Receber", config.blockKey);
  const title = config.title || definition?.label || config.blockKey;
  const receivables = filterReceivables(data.accountsReceivable, filters, range);

  switch (config.blockKey) {
    case "AR_SUMMARY": {
      const previsto = receivables.reduce((sum, item) => sum + item.amount, 0);
      const recebido = receivables.reduce((sum, item) => sum + item.receivedAmount, 0);
      const items = [
        { label: "Total previsto", value: money(previsto) },
        { label: "Total recebido", value: money(recebido) },
        { label: "Total em aberto", value: money(Math.max(0, previsto - recebido)) },
      ];
      if (config.compareWithPreviousPeriod) {
        const prevReceivables = filterReceivables(data.accountsReceivable, filters, previousPeriodRange(range.startDate, range.endDate));
        const prevPrevisto = prevReceivables.reduce((sum, item) => sum + item.amount, 0);
        items.push({ label: "Total previsto (período anterior)", value: money(prevPrevisto) });
      }
      return { kind: "kpis", title, items };
    }
    case "AR_OVERDUE": {
      const overdue = receivables
        .filter((item) => item.dueDate < today() && item.receivedAmount < item.amount)
        .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
      const sliced = config.limit ? overdue.slice(0, config.limit) : overdue;
      return {
        kind: "table",
        title,
        columns: ["Vencimento", "Cliente", "Descrição", "Saldo em aberto", "Dias em atraso"],
        rows: sliced.map((item) => [
          item.dueDate,
          item.customer,
          item.description,
          money(item.amount - item.receivedAmount),
          daysLate(item.dueDate),
        ]),
      };
    }
    case "AR_DELINQUENCY": {
      const overdueMap = groupSum(
        receivables.filter((item) => item.dueDate < today() && item.receivedAmount < item.amount),
        (item) => item.customer,
        (item) => item.amount - item.receivedAmount,
      );
      return groupedSection(title, "Cliente", overdueMap, config);
    }
    case "AR_BY_CUSTOMER":
      return groupedSection(title, "Cliente", groupSum(receivables, (item) => item.customer, (item) => item.amount), config);
    case "AR_BY_CATEGORY":
      return groupedSection(title, "Categoria", groupSum(receivables, (item) => item.category, (item) => item.amount), config);
    case "AR_BY_COST_CENTER":
      return groupedSection(title, "Centro de custo", groupSum(receivables, (item) => item.costCenter, (item) => item.amount), config);
    case "AR_BY_BANK_ACCOUNT":
      return groupedSection(
        title,
        "Conta bancária",
        groupSum(receivables, (item) => accountNameOf(data, item.bankAccountId), (item) => item.amount),
        config,
      );
    case "AR_FORECAST_VS_REALIZED": {
      const dueReceivables = filterReceivables(data.accountsReceivable, { ...filters, dateBasis: "due" }, range);
      const previsto = dueReceivables.reduce((sum, item) => sum + item.amount, 0);
      const realizado = dueReceivables.reduce((sum, item) => sum + item.receivedAmount, 0);
      return {
        kind: "table",
        title,
        columns: ["Métrica", "Previsto", "Realizado"],
        rows: [["Recebimentos", money(previsto), money(realizado)]],
      };
    }
    case "AR_MONTHLY_EVOLUTION": {
      const map = groupSum(
        receivables,
        (item) => arDate(item, filters.dateBasis).slice(0, 7),
        (item) => item.amount,
      );
      const sortedEntries = Array.from(map.entries()).sort(([left], [right]) => left.localeCompare(right));
      const visualization = config.visualization === "pie" ? "bar" : config.visualization || "bar";
      if (visualization === "table") {
        return {
          kind: "table",
          title,
          columns: ["Mês", "Receita"],
          rows: sortedEntries.map(([month, value]) => [month, money(value)]),
        };
      }
      return {
        kind: "chart",
        title,
        chartType: "bar",
        columns: ["Mês", "Receita"],
        rows: sortedEntries.map(([month, value]) => [month, value]),
      };
    }
    case "AR_DETAIL_LIST": {
      const availableColumns = definition?.availableColumns || [];
      const columns = config.columns && config.columns.length > 0 ? config.columns : definition?.defaultColumns || availableColumns;
      const rows = receivables
        .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
        .map((item) =>
          projectColumns(availableColumns, {
            Vencimento: item.dueDate,
            Cliente: item.customer,
            Descrição: item.description,
            Categoria: item.category,
            "Centro de custo": item.costCenter,
            Valor: money(item.amount),
            Status: item.status,
            "Conta bancária": accountNameOf(data, item.bankAccountId),
            "Número do documento": item.documentNumber,
            Competência: item.competenceMonth,
          }, columns),
        );
      return { kind: "table", title, columns, rows };
    }
    default:
      return { kind: "table", title, columns: [], rows: [] };
  }
}

function computeCfBlock(
  config: ReportBlockConfig,
  filters: ReportFilters,
  range: { startDate: string; endDate: string },
  data: ReportDataSource,
): ReportSectionData {
  const definition = getBlockDefinition("Fluxo de Caixa", config.blockKey);
  const title = config.title || definition?.label || config.blockKey;
  const accounts = data.bankAccounts.filter(
    (account) => !filters.bankAccountId || account.id === filters.bankAccountId,
  );

  // Movimentações efetivamente realizadas (pagas/recebidas) — usadas sempre
  // no saldo, independente do "Tipo de visão" escolhido para os demais blocos.
  const realizedPayables = filterPayables(data.accountsPayable, { ...filters, dateBasis: "payment" }, range).filter(
    (item) => isPaidPayable(item.status) || item.status === "Parcialmente paga",
  );
  const realizedReceivables = filterReceivables(data.accountsReceivable, { ...filters, dateBasis: "payment" }, range).filter(
    (item) => item.receivedAmount > 0,
  );

  // Movimentações consideradas pelos demais blocos de acordo com o "Tipo de
  // visão" (realizado, previsto ou ambos) escolhido nos filtros. Cada entrada
  // carrega seu próprio valor já resolvido (pago/recebido para o realizado,
  // saldo em aberto para o previsto) para não misturar as duas semânticas.
  interface CfEntry<T> {
    item: T;
    value: number;
    date: string;
  }
  const cfView = filters.cashFlowView || "realized";
  const realizedPayableEntries: CfEntry<AccountPayable>[] = realizedPayables.map((item) => ({
    item,
    value: payablePaid(item),
    date: apDate(item, "payment"),
  }));
  const realizedReceivableEntries: CfEntry<AccountReceivable>[] = realizedReceivables.map((item) => ({
    item,
    value: item.receivedAmount,
    date: arDate(item, "payment"),
  }));
  const projectedPayableEntries: CfEntry<AccountPayable>[] = filterPayables(
    data.accountsPayable,
    { ...filters, dateBasis: "due" },
    range,
  )
    .filter((item) => !isPaidPayable(item.status))
    .map((item) => ({ item, value: item.finalAmount - payablePaid(item), date: apDate(item, "due") }));
  const projectedReceivableEntries: CfEntry<AccountReceivable>[] = filterReceivables(
    data.accountsReceivable,
    { ...filters, dateBasis: "due" },
    range,
  )
    .filter((item) => item.receivedAmount < item.amount)
    .map((item) => ({ item, value: item.amount - item.receivedAmount, date: arDate(item, "due") }));

  const payableEntries =
    cfView === "realized"
      ? realizedPayableEntries
      : cfView === "projected"
        ? projectedPayableEntries
        : [...realizedPayableEntries, ...projectedPayableEntries];
  const receivableEntries =
    cfView === "realized"
      ? realizedReceivableEntries
      : cfView === "projected"
        ? projectedReceivableEntries
        : [...realizedReceivableEntries, ...projectedReceivableEntries];

  switch (config.blockKey) {
    case "CF_BALANCE_SUMMARY": {
      const finalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
      const realizedIn = realizedReceivableEntries.reduce((sum, entry) => sum + entry.value, 0);
      const realizedOut = realizedPayableEntries.reduce((sum, entry) => sum + entry.value, 0);
      const initialBalance = finalBalance - (realizedIn - realizedOut);
      return {
        kind: "kpis",
        title,
        items: [
          { label: "Saldo inicial do período", value: money(initialBalance) },
          { label: "Saldo final (atual)", value: money(finalBalance) },
        ],
      };
    }
    case "CF_REALIZED_IN_OUT": {
      const totalIn = receivableEntries.reduce((sum, entry) => sum + entry.value, 0);
      const totalOut = payableEntries.reduce((sum, entry) => sum + entry.value, 0);
      const items = [
        { label: "Entradas", value: money(totalIn) },
        { label: "Saídas", value: money(totalOut) },
        { label: "Saldo do período", value: money(totalIn - totalOut) },
      ];
      if (config.compareWithPreviousPeriod) {
        const prevRange = previousPeriodRange(range.startDate, range.endDate);
        const prevIn = filterReceivables(data.accountsReceivable, { ...filters, dateBasis: "payment" }, prevRange)
          .reduce((sum, item) => sum + item.receivedAmount, 0);
        const prevOut = filterPayables(data.accountsPayable, { ...filters, dateBasis: "payment" }, prevRange)
          .reduce((sum, item) => sum + payablePaid(item), 0);
        items.push({ label: "Saldo do período anterior", value: money(prevIn - prevOut) });
      }
      return { kind: "kpis", title, items };
    }
    case "CF_FORECAST_VS_REALIZED": {
      const duePayables = filterPayables(data.accountsPayable, { ...filters, dateBasis: "due" }, range);
      const dueReceivables = filterReceivables(data.accountsReceivable, { ...filters, dateBasis: "due" }, range);
      const previstoIn = dueReceivables.reduce((sum, item) => sum + item.amount, 0);
      const realizadoIn = dueReceivables.reduce((sum, item) => sum + item.receivedAmount, 0);
      const previstoOut = duePayables.reduce((sum, item) => sum + item.finalAmount, 0);
      const realizadoOut = duePayables.reduce((sum, item) => sum + payablePaid(item), 0);
      return {
        kind: "table",
        title,
        columns: ["Tipo", "Previsto", "Realizado"],
        rows: [
          ["Entradas", money(previstoIn), money(realizadoIn)],
          ["Saídas", money(previstoOut), money(realizadoOut)],
        ],
      };
    }
    case "CF_BY_PERIOD": {
      const grouping = filters.cashFlowGrouping || "daily";
      const bucketOf = (date: string) => {
        if (grouping === "monthly") return date.slice(0, 7);
        if (grouping === "weekly") {
          const parsed = new Date(`${date}T12:00:00`);
          const dayOfWeek = (parsed.getDay() + 6) % 7;
          parsed.setDate(parsed.getDate() - dayOfWeek);
          return parsed.toISOString().slice(0, 10);
        }
        return date;
      };
      const buckets = new Map<string, { in: number; out: number }>();
      receivableEntries.forEach((entry) => {
        const key = bucketOf(entry.date);
        const current = buckets.get(key) || { in: 0, out: 0 };
        current.in += entry.value;
        buckets.set(key, current);
      });
      payableEntries.forEach((entry) => {
        const key = bucketOf(entry.date);
        const current = buckets.get(key) || { in: 0, out: 0 };
        current.out += entry.value;
        buckets.set(key, current);
      });
      const sorted = Array.from(buckets.entries()).sort(([left], [right]) => left.localeCompare(right));
      const columns = ["Período", "Entradas", "Saídas"];
      if (config.visualization === "table") {
        return {
          kind: "table",
          title,
          columns,
          rows: sorted.map(([period, values]) => [period, money(values.in), money(values.out)]),
        };
      }
      return {
        kind: "chart",
        title,
        chartType: "bar",
        columns,
        rows: sorted.map(([period, values]) => [period, values.in, values.out]),
      };
    }
    case "CF_BY_CATEGORY": {
      const netMap = new Map<string, number>();
      receivableEntries.forEach((entry) =>
        netMap.set(entry.item.category, (netMap.get(entry.item.category) || 0) + entry.value),
      );
      payableEntries.forEach((entry) =>
        netMap.set(entry.item.category, (netMap.get(entry.item.category) || 0) - entry.value),
      );
      return groupedSection(title, "Categoria", netMap, config);
    }
    case "CF_BY_BANK_ACCOUNT": {
      const netMap = new Map<string, number>();
      receivableEntries.forEach((entry) => {
        const key = accountNameOf(data, entry.item.bankAccountId);
        netMap.set(key, (netMap.get(key) || 0) + entry.value);
      });
      payableEntries.forEach((entry) => {
        const key = accountNameOf(data, entry.item.bankAccountId);
        netMap.set(key, (netMap.get(key) || 0) - entry.value);
      });
      return groupedSection(title, "Conta bancária", netMap, config);
    }
    case "CF_DETAIL_LIST": {
      const availableColumns = definition?.availableColumns || [];
      const columns = config.columns && config.columns.length > 0 ? config.columns : definition?.defaultColumns || availableColumns;
      const combined = [
        ...receivableEntries.map((entry) => ({
          Data: entry.date,
          Tipo: "Entrada",
          Descrição: entry.item.description,
          Categoria: entry.item.category,
          "Conta bancária": accountNameOf(data, entry.item.bankAccountId),
          Valor: money(entry.value),
          Situação: entry.item.status,
          sortKey: entry.date,
        })),
        ...payableEntries.map((entry) => ({
          Data: entry.date,
          Tipo: "Saída",
          Descrição: entry.item.description,
          Categoria: entry.item.category,
          "Conta bancária": accountNameOf(data, entry.item.bankAccountId),
          Valor: money(entry.value),
          Situação: entry.item.status,
          sortKey: entry.date,
        })),
      ].sort((left, right) => left.sortKey.localeCompare(right.sortKey));
      const rows = combined.map((entry) => projectColumns(availableColumns, entry, columns));
      return { kind: "table", title, columns, rows };
    }
    default:
      return { kind: "table", title, columns: [], rows: [] };
  }
}

export function computeReportSections(
  modelType: ReportModelType,
  blocks: ReportBlockConfig[],
  filters: ReportFilters,
  data: ReportDataSource,
): ReportSectionData[] {
  const range = { startDate: filters.startDate, endDate: filters.endDate };
  return blocks.map((block) => {
    if (modelType === "Contas a Pagar") return computeApBlock(block, filters, range, data);
    if (modelType === "Contas a Receber") return computeArBlock(block, filters, range, data);
    return computeCfBlock(block, filters, range, data);
  });
}

export function computeDreSections(
  filters: ReportFilters,
  options: DreReportOptions,
  data: ReportDataSource,
): ReportSectionData[] {
  const range = { startDate: filters.startDate, endDate: filters.endDate };
  const dreFilters: ReportFilters = { ...filters, costCenter: options.costCenter };
  const receivables = filterReceivables(data.accountsReceivable, dreFilters, range);
  const payables = filterPayables(data.accountsPayable, dreFilters, range);

  const receitaBruta = receivables.reduce((sum, item) => sum + item.amount, 0);
  const expenseByCategory = groupSum(payables, (item) => item.category, (item) => item.finalAmount);
  const totalDespesas = Array.from(expenseByCategory.values()).reduce((sum, value) => sum + value, 0);
  const resultadoLiquido = receitaBruta - totalDespesas;

  const kpiItems = [
    { label: "Receita Bruta", value: money(receitaBruta) },
    { label: "(-) Despesas", value: money(totalDespesas) },
    { label: "(=) Resultado Líquido", value: money(resultadoLiquido) },
  ];
  if (options.showPercent) {
    kpiItems.push({ label: "Margem líquida", value: percent(resultadoLiquido, receitaBruta) });
  }
  if (options.compareWithPreviousPeriod) {
    const prevRange = previousPeriodRange(range.startDate, range.endDate);
    const prevReceivables = filterReceivables(data.accountsReceivable, dreFilters, prevRange);
    const prevPayables = filterPayables(data.accountsPayable, dreFilters, prevRange);
    const prevReceita = prevReceivables.reduce((sum, item) => sum + item.amount, 0);
    const prevDespesas = prevPayables.reduce((sum, item) => sum + item.finalAmount, 0);
    kpiItems.push(
      { label: "Receita Bruta (período anterior)", value: money(prevReceita) },
      { label: "Resultado Líquido (período anterior)", value: money(prevReceita - prevDespesas) },
    );
  }

  const sections: ReportSectionData[] = [{ kind: "kpis", title: "Resultado do período", items: kpiItems }];

  if (options.detailed) {
    const { columns, rows } = rankedRows("Categoria", expenseByCategory, undefined, options.showPercent);
    sections.push({ kind: "table", title: "Despesas por categoria", columns, rows });
  }

  if (options.comment) {
    sections.push({ kind: "kpis", title: "Comentário", items: [{ label: "Observação", value: options.comment }] });
  }

  return sections;
}

export const buildFiltersSummary = (
  modelType: ReportModelType,
  filters: ReportFilters,
  dreOptions?: DreReportOptions,
): string => {
  const basisLabel: Record<ReportDateBasis, string> = {
    due: "vencimento",
    payment: "pagamento/recebimento",
    competence: "competência",
  };
  const parts = [
    `Período: ${filters.startDate} a ${filters.endDate} (${basisLabel[filters.dateBasis]})`,
  ];
  if (filters.supplier) parts.push(`Fornecedor: ${filters.supplier}`);
  if (filters.customer) parts.push(`Cliente: ${filters.customer}`);
  if (filters.category) parts.push(`Categoria: ${filters.category}`);
  if (filters.costCenter) parts.push(`Centro de custo: ${filters.costCenter}`);
  if (filters.status) parts.push(`Status: ${filters.status}`);
  if (filters.paymentMethod) parts.push(`Forma: ${filters.paymentMethod}`);
  if (modelType === "DRE Gerencial" && dreOptions?.costCenter) parts.push(`Centro de custo: ${dreOptions.costCenter}`);
  return parts.join(" | ");
};
