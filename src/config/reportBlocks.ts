/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReportBlockKey, ReportBlockVisualization, ReportModelType } from "../types";

export interface ReportBlockDefinition {
  key: ReportBlockKey;
  label: string;
  description: string;
  // Visualizações aceitas pelo bloco; o primeiro item é o padrão.
  visualizations: ReportBlockVisualization[];
  supportsLimit?: boolean;
  supportsPercent?: boolean;
  supportsCompare?: boolean;
  // Colunas disponíveis para configuração, apenas nos blocos de lista
  // detalhada.
  availableColumns?: string[];
  defaultColumns?: string[];
}

const AP_DETAIL_COLUMNS = [
  "Vencimento",
  "Fornecedor",
  "Descrição",
  "Categoria",
  "Centro de custo",
  "Valor",
  "Status",
  "Conta bancária",
  "Número do documento",
  "Competência",
];

const AR_DETAIL_COLUMNS = [
  "Vencimento",
  "Cliente",
  "Descrição",
  "Categoria",
  "Centro de custo",
  "Valor",
  "Status",
  "Conta bancária",
  "Número do documento",
  "Competência",
];

const CF_DETAIL_COLUMNS = [
  "Data",
  "Tipo",
  "Descrição",
  "Categoria",
  "Conta bancária",
  "Valor",
  "Situação",
];

export const REPORT_BLOCKS: Record<ReportModelType, ReportBlockDefinition[]> = {
  "Contas a Pagar": [
    {
      key: "AP_SUMMARY",
      label: "Resumo geral",
      description: "Total previsto, total pago, total em aberto e vencido no período.",
      visualizations: ["table"],
      supportsCompare: true,
    },
    {
      key: "AP_OVERDUE",
      label: "Contas vencidas",
      description: "Títulos com vencimento no passado ainda não quitados.",
      visualizations: ["table"],
      supportsLimit: true,
    },
    {
      key: "AP_UPCOMING",
      label: "Próximos vencimentos",
      description: "Títulos a vencer dentro do período selecionado.",
      visualizations: ["table"],
      supportsLimit: true,
    },
    {
      key: "AP_BY_PERIOD",
      label: "Pagamentos por período",
      description: "Evolução mensal dos pagamentos ao longo do período selecionado.",
      visualizations: ["bar", "table"],
    },
    {
      key: "AP_BY_CATEGORY",
      label: "Despesas por categoria",
      description: "Distribuição das despesas por categoria.",
      visualizations: ["bar", "pie", "table"],
      supportsLimit: true,
      supportsPercent: true,
      supportsCompare: true,
    },
    {
      key: "AP_BY_COST_CENTER",
      label: "Despesas por centro de custo",
      description: "Distribuição das despesas por centro de custo.",
      visualizations: ["bar", "pie", "table"],
      supportsLimit: true,
      supportsPercent: true,
      supportsCompare: true,
    },
    {
      key: "AP_BY_SUPPLIER",
      label: "Despesas por fornecedor",
      description: "Maiores fornecedores por valor pago/a pagar.",
      visualizations: ["bar", "table"],
      supportsLimit: true,
      supportsPercent: true,
    },
    {
      key: "AP_BY_BANK_ACCOUNT",
      label: "Pagamentos por conta financeira",
      description: "Distribuição dos pagamentos por conta bancária.",
      visualizations: ["bar", "pie", "table"],
      supportsLimit: true,
      supportsPercent: true,
    },
    {
      key: "AP_DETAIL_LIST",
      label: "Lista detalhada de títulos",
      description: "Listagem título a título com as colunas selecionadas.",
      visualizations: ["table"],
      availableColumns: AP_DETAIL_COLUMNS,
      defaultColumns: [
        "Vencimento",
        "Fornecedor",
        "Descrição",
        "Categoria",
        "Centro de custo",
        "Valor",
        "Status",
      ],
    },
  ],
  "Contas a Receber": [
    {
      key: "AR_SUMMARY",
      label: "Resumo geral",
      description: "Total previsto, total recebido e total em aberto no período.",
      visualizations: ["table"],
      supportsCompare: true,
    },
    {
      key: "AR_OVERDUE",
      label: "Valores vencidos",
      description: "Listagem das faturas vencidas e ainda não recebidas.",
      visualizations: ["table"],
      supportsLimit: true,
    },
    {
      key: "AR_DELINQUENCY",
      label: "Inadimplência",
      description: "Saldo em atraso agrupado por cliente, do maior para o menor.",
      visualizations: ["bar", "table"],
      supportsLimit: true,
      supportsPercent: true,
    },
    {
      key: "AR_BY_CUSTOMER",
      label: "Recebimentos por cliente",
      description: "Maiores clientes por valor recebido/a receber.",
      visualizations: ["bar", "table"],
      supportsLimit: true,
      supportsPercent: true,
    },
    {
      key: "AR_BY_CATEGORY",
      label: "Receitas por categoria",
      description: "Distribuição das receitas por categoria.",
      visualizations: ["bar", "pie", "table"],
      supportsLimit: true,
      supportsPercent: true,
      supportsCompare: true,
    },
    {
      key: "AR_BY_COST_CENTER",
      label: "Receitas por centro de custo",
      description: "Distribuição das receitas por centro de custo.",
      visualizations: ["bar", "pie", "table"],
      supportsLimit: true,
      supportsPercent: true,
      supportsCompare: true,
    },
    {
      key: "AR_BY_BANK_ACCOUNT",
      label: "Recebimentos por conta financeira",
      description: "Distribuição dos recebimentos por conta bancária.",
      visualizations: ["bar", "pie", "table"],
      supportsLimit: true,
      supportsPercent: true,
    },
    {
      key: "AR_MONTHLY_EVOLUTION",
      label: "Evolução das receitas",
      description: "Receita mensal ao longo do período selecionado.",
      visualizations: ["bar", "table"],
    },
    {
      key: "AR_FORECAST_VS_REALIZED",
      label: "Comparação entre previsto e realizado",
      description: "Total previsto (a receber) contra o total efetivamente recebido no período.",
      visualizations: ["table"],
    },
    {
      key: "AR_DETAIL_LIST",
      label: "Títulos detalhados",
      description: "Listagem título a título com as colunas selecionadas.",
      visualizations: ["table"],
      availableColumns: AR_DETAIL_COLUMNS,
      defaultColumns: [
        "Vencimento",
        "Cliente",
        "Descrição",
        "Categoria",
        "Centro de custo",
        "Valor",
        "Status",
      ],
    },
  ],
  "Fluxo de Caixa": [
    {
      key: "CF_BALANCE_SUMMARY",
      label: "Saldo inicial e final",
      description: "Saldo das contas no início e no fim do período.",
      visualizations: ["table"],
    },
    {
      key: "CF_REALIZED_IN_OUT",
      label: "Entradas x Saídas realizadas",
      description: "Total de entradas e saídas já realizadas no período.",
      visualizations: ["bar", "table"],
      supportsCompare: true,
    },
    {
      key: "CF_FORECAST_VS_REALIZED",
      label: "Previsto x Realizado",
      description: "Comparativo entre valores previstos e valores realizados.",
      visualizations: ["bar", "table"],
    },
    {
      key: "CF_BY_PERIOD",
      label: "Fluxo por período",
      description: "Entradas e saídas agrupadas por dia, semana ou mês.",
      visualizations: ["bar", "table"],
    },
    {
      key: "CF_BY_CATEGORY",
      label: "Movimentações por categoria",
      description: "Entradas e saídas agrupadas por categoria.",
      visualizations: ["bar", "pie", "table"],
      supportsLimit: true,
      supportsPercent: true,
    },
    {
      key: "CF_BY_BANK_ACCOUNT",
      label: "Movimentações por conta",
      description: "Entradas e saídas agrupadas por conta bancária.",
      visualizations: ["bar", "pie", "table"],
      supportsLimit: true,
      supportsPercent: true,
    },
    {
      key: "CF_DETAIL_LIST",
      label: "Lista de movimentações",
      description: "Listagem detalhada das movimentações do período.",
      visualizations: ["table"],
      availableColumns: CF_DETAIL_COLUMNS,
      defaultColumns: CF_DETAIL_COLUMNS,
    },
  ],
  "DRE Gerencial": [],
};

export const REPORT_MODEL_TYPES: ReportModelType[] = [
  "Contas a Pagar",
  "Contas a Receber",
  "Fluxo de Caixa",
  "DRE Gerencial",
];

export const REPORT_MODEL_INFO: Record<
  ReportModelType,
  { description: string }
> = {
  "Contas a Pagar": {
    description: "Pagamentos, obrigações e despesas do período.",
  },
  "Contas a Receber": {
    description: "Recebimentos, inadimplência e receitas do período.",
  },
  "Fluxo de Caixa": {
    description: "Entradas, saídas e saldo projetado das contas financeiras.",
  },
  "DRE Gerencial": {
    description: "Demonstração de resultado simplificada por categoria.",
  },
};

export const getBlockDefinition = (
  modelType: ReportModelType,
  blockKey: ReportBlockKey,
): ReportBlockDefinition | undefined =>
  REPORT_BLOCKS[modelType].find((block) => block.key === blockKey);
