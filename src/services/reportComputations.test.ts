import assert from "node:assert/strict";
import test from "node:test";
import type {
  AccountPayable,
  AccountReceivable,
  BankAccount,
  ReportBlockConfig,
  ReportFilters,
  ReportModelType,
} from "../types";
import { computeDreSections, computeReportSections } from "./reportComputations";

const filters: ReportFilters = {
  startDate: "2026-07-01",
  endDate: "2026-07-31",
  dateBasis: "due",
  cashFlowView: "realized",
  cashFlowGrouping: "daily",
};

const payable = (patch: Partial<AccountPayable> = {}) => ({
  id: "ap-1",
  companyId: "company-1",
  description: "Serviço com descrição suficientemente longa para validar preservação do conteúdo",
  supplier: "Fornecedor Alfa",
  category: "Serviços",
  costCenter: "Administrativo",
  competenceMonth: "2026-07",
  issueDate: "2026-07-01",
  dueDate: "2026-07-10",
  amount: 1000,
  interest: 0,
  penalty: 0,
  discount: 0,
  finalAmount: 1000,
  paymentMethod: "PIX",
  bankAccountId: "bank-1",
  recurrence: "Nenhuma",
  documentNumber: "NF-1",
  notes: "",
  status: "Vencida",
  responsibleId: "user-1",
  needsApproval: false,
  createdAt: "2026-07-01T12:00:00.000Z",
  updatedAt: "2026-07-01T12:00:00.000Z",
  ...patch,
}) as AccountPayable;

const receivable = (patch: Partial<AccountReceivable> = {}) => ({
  id: "ar-1",
  companyId: "company-1",
  description: "Mensalidade",
  customer: "Cliente Beta",
  category: "Receitas",
  costCenter: "Comercial",
  competenceMonth: "2026-07",
  issueDate: "2026-07-01",
  dueDate: "2026-07-12",
  amount: 2000,
  interest: 0,
  penalty: 0,
  discount: 0,
  receivedAmount: 500,
  paymentMethod: "Boleto",
  bankAccountId: "bank-1",
  recurrence: "Nenhuma",
  documentNumber: "FAT-1",
  notes: "",
  status: "Vencido",
  responsibleId: "user-1",
  createdAt: "2026-07-01T12:00:00.000Z",
  updatedAt: "2026-07-01T12:00:00.000Z",
  ...patch,
}) as AccountReceivable;

const bank = {
  id: "bank-1",
  companyId: "company-1",
  bankName: "Banco Idex",
  agency: "0001",
  accountNumber: "12345-6",
  type: "Corrente",
  balance: 5000,
} as BankAccount;

const summary = (
  modelType: Exclude<ReportModelType, "DRE Gerencial">,
  blockKey: ReportBlockConfig["blockKey"],
  payables: AccountPayable[],
  receivables: AccountReceivable[],
) => computeReportSections(
  modelType,
  [{ instanceId: "summary", blockKey, visualization: "table" }],
  filters,
  { accountsPayable: payables, accountsReceivable: receivables, bankAccounts: [bank] },
)[0];

test("resumo de contas a pagar usa dados reais e inclui quantidade", () => {
  const section = summary("Contas a Pagar", "AP_SUMMARY", [payable()], []);
  assert.equal(section.kind, "kpis");
  if (section.kind !== "kpis") return;
  assert.deepEqual(section.items.map((item) => item.label), [
    "Total geral",
    "Total pago",
    "Total pendente",
    "Total vencido",
    "Quantidade de lançamentos",
  ]);
  assert.equal(section.items.at(-1)?.value, "1");
});

test("resumo de contas a receber calcula pendência, vencido e inadimplência", () => {
  const section = summary("Contas a Receber", "AR_SUMMARY", [], [receivable()]);
  assert.equal(section.kind, "kpis");
  if (section.kind !== "kpis") return;
  assert.equal(section.items.find((item) => item.label === "Inadimplência")?.value, "75,0%");
  assert.match(section.items.find((item) => item.label === "Total vencido")?.value || "", /1\.500,00/);
});

test("resumo de fluxo de caixa inclui saldo inicial, entradas, saídas, resultado e saldo final", () => {
  const paid = payable({ status: "Paga", paymentDate: "2026-07-10", paidAmount: 1000 });
  const received = receivable({ status: "Recebido", receiptDate: "2026-07-12", receivedAmount: 2000 });
  const section = summary("Fluxo de Caixa", "CF_BALANCE_SUMMARY", [paid], [received]);
  assert.equal(section.kind, "kpis");
  if (section.kind !== "kpis") return;
  assert.deepEqual(section.items.map((item) => item.label), [
    "Saldo inicial do período",
    "Total de entradas",
    "Total de saídas",
    "Resultado do período",
    "Saldo final",
  ]);
});

test("relatório sem registros mantém resumo zerado com segurança", () => {
  const section = summary("Contas a Pagar", "AP_SUMMARY", [], []);
  assert.equal(section.kind, "kpis");
  if (section.kind !== "kpis") return;
  assert.equal(section.items.find((item) => item.label === "Quantidade de lançamentos")?.value, "0");
  assert.match(section.items[0].value, /0,00/);
});

test("DRE usa a mesma fonte filtrada e preserva observações", () => {
  const sections = computeDreSections(
    filters,
    { detailed: true, showPercent: true, comment: "Validado pelo financeiro." },
    { accountsPayable: [payable()], accountsReceivable: [receivable()], bankAccounts: [bank] },
  );
  assert.equal(sections[0].kind, "kpis");
  assert.equal(sections.some((section) => section.kind === "table"), true);
  const comment = sections.find((section) => section.kind === "kpis" && section.title === "Comentário");
  assert.equal(comment?.kind === "kpis" ? comment.items[0].value : "", "Validado pelo financeiro.");
});

test("base de pagamento ignora títulos sem baixa e usa somente movimentos do período", () => {
  const paymentFilters: ReportFilters = { ...filters, dateBasis: "payment" };
  const unpaid = computeReportSections(
    "Contas a Pagar",
    [{ instanceId: "summary", blockKey: "AP_SUMMARY", visualization: "table" }],
    paymentFilters,
    { accountsPayable: [payable()], accountsReceivable: [], bankAccounts: [bank] },
  )[0];
  assert.equal(unpaid.kind, "kpis");
  if (unpaid.kind === "kpis") {
    assert.equal(unpaid.items.find((item) => item.label === "Quantidade de lançamentos")?.value, "0");
  }

  const partiallyPaid = payable({
    status: "Parcialmente paga",
    paidAmount: 500,
    paymentHistory: [
      {
        id: "payment-june",
        date: "2026-06-30",
        amount: 200,
        bankAccountId: "bank-1",
        bankAccountName: "Banco Idex",
        interest: 0,
        penalty: 0,
        discount: 0,
        registeredById: "user-1",
        registeredByName: "Usuário",
        createdAt: "2026-06-30T12:00:00.000Z",
      },
      {
        id: "payment-july",
        date: "2026-07-15",
        amount: 300,
        bankAccountId: "bank-1",
        bankAccountName: "Banco Idex",
        interest: 0,
        penalty: 0,
        discount: 0,
        registeredById: "user-1",
        registeredByName: "Usuário",
        createdAt: "2026-07-15T12:00:00.000Z",
      },
    ],
  });
  const section = computeReportSections(
    "Contas a Pagar",
    [{ instanceId: "summary", blockKey: "AP_SUMMARY", visualization: "table" }],
    paymentFilters,
    { accountsPayable: [payable(), partiallyPaid], accountsReceivable: [], bankAccounts: [bank] },
  )[0];
  assert.equal(section.kind, "kpis");
  if (section.kind !== "kpis") return;
  assert.match(section.items.find((item) => item.label === "Total geral")?.value || "", /300,00/);
  assert.equal(section.items.find((item) => item.label === "Quantidade de lançamentos")?.value, "1");
});

test("DRE por caixa considera somente pagamentos e recebimentos do período", () => {
  const paid = payable({
    status: "Parcialmente paga",
    paidAmount: 300,
    paymentHistory: [{
      id: "payment-1",
      date: "2026-07-15",
      amount: 300,
      bankAccountId: "bank-1",
      bankAccountName: "Banco Idex",
      interest: 0,
      penalty: 0,
      discount: 0,
      registeredById: "user-1",
      registeredByName: "Usuário",
      createdAt: "2026-07-15T12:00:00.000Z",
    }],
  });
  const received = receivable({
    status: "Parcialmente recebido",
    receivedAmount: 250,
    receiptHistory: [{
      id: "receipt-1",
      date: "2026-07-16",
      amount: 250,
      bankAccountId: "bank-1",
      bankAccountName: "Banco Idex",
      interest: 0,
      penalty: 0,
      discount: 0,
      registeredById: "user-1",
      registeredByName: "Usuário",
      createdAt: "2026-07-16T12:00:00.000Z",
    }],
  });
  const sections = computeDreSections(
    { ...filters, dateBasis: "payment" },
    { detailed: true },
    { accountsPayable: [payable(), paid], accountsReceivable: [receivable(), received], bankAccounts: [bank] },
  );
  assert.equal(sections[0].kind, "kpis");
  if (sections[0].kind !== "kpis") return;
  assert.match(sections[0].items.find((item) => item.label === "Receita Bruta")?.value || "", /250,00/);
  assert.match(sections[0].items.find((item) => item.label === "(-) Despesas")?.value || "", /300,00/);
  assert.match(sections[0].items.find((item) => item.label === "(=) Resultado Líquido")?.value || "", /-.*50,00/);
});
