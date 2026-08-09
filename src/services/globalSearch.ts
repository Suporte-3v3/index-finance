/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AccountPayable,
  AccountReceivable,
  Company,
  Document as AppDocument,
  MasterDataOption,
  ReportRecord,
  ReportTemplate,
  User,
} from "../types";

export type GlobalSearchCategory =
  | "company"
  | "supplier"
  | "customer"
  | "payable"
  | "receivable"
  | "document"
  | "report";

export interface GlobalSearchResult {
  id: string;
  category: GlobalSearchCategory;
  title: string;
  subtitle?: string;
  // Empresa para a qual trocar antes de navegar (resultados de empresa).
  companyId?: string;
  // View de destino no shell do app (ver ViewType em App.tsx).
  view: string;
}

export interface GlobalSearchGroup {
  category: GlobalSearchCategory;
  label: string;
  results: GlobalSearchResult[];
}

export interface GlobalSearchSources {
  companies: Company[];
  masterData: MasterDataOption[];
  accountsPayable: AccountPayable[];
  accountsReceivable: AccountReceivable[];
  documents: AppDocument[];
  reports: ReportRecord[];
  reportTemplates: ReportTemplate[];
}

export interface GlobalSearchContext {
  currentUser: User;
  activeCompanyId: string;
}

const RESULTS_PER_GROUP = 5;
const MIN_QUERY_LENGTH = 2;

const normalize = (value: string) =>
  value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const matches = (query: string, ...fields: (string | undefined)[]) =>
  fields.some((field) => field && normalize(field).includes(query));

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function searchAll(
  query: string,
  sources: GlobalSearchSources,
  ctx: GlobalSearchContext,
): GlobalSearchGroup[] {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];
  const needle = normalize(trimmed);
  const { currentUser, activeCompanyId } = ctx;

  const authorizedCompanies =
    currentUser.role === "BPO_ADMIN"
      ? sources.companies
      : sources.companies.filter((company) =>
          currentUser.companies?.includes(company.id),
        );

  const companyResults: GlobalSearchResult[] = authorizedCompanies
    .filter((company) =>
      matches(needle, company.tradeName, company.corporateName, company.cnpj),
    )
    .slice(0, RESULTS_PER_GROUP)
    .map((company) => ({
      id: `company-${company.id}`,
      category: "company",
      title: company.tradeName,
      subtitle: `${company.cnpj} · ${company.segment}`,
      companyId: company.id,
      view: "dashboard",
    }));

  const supplierResults: GlobalSearchResult[] = sources.masterData
    .filter(
      (item) =>
        item.companyId === activeCompanyId &&
        item.type === "SUPPLIER" &&
        item.active &&
        matches(needle, item.name),
    )
    .slice(0, RESULTS_PER_GROUP)
    .map((item) => ({
      id: `supplier-${item.id}`,
      category: "supplier",
      title: item.name,
      subtitle: "Fornecedor cadastrado",
      view: "master-data",
    }));

  const customerResults: GlobalSearchResult[] = sources.masterData
    .filter(
      (item) =>
        item.companyId === activeCompanyId &&
        item.type === "CUSTOMER" &&
        item.active &&
        matches(needle, item.name),
    )
    .slice(0, RESULTS_PER_GROUP)
    .map((item) => ({
      id: `customer-${item.id}`,
      category: "customer",
      title: item.name,
      subtitle: "Cliente cadastrado",
      view: "master-data",
    }));

  const payableResults: GlobalSearchResult[] = sources.accountsPayable
    .filter(
      (item) =>
        item.companyId === activeCompanyId &&
        matches(needle, item.description, item.supplier, item.documentNumber),
    )
    .slice(0, RESULTS_PER_GROUP)
    .map((item) => ({
      id: `payable-${item.id}`,
      category: "payable",
      title: item.description,
      subtitle: `${item.supplier} · ${money(item.finalAmount)} · ${item.status}`,
      view: "payable",
    }));

  const receivableResults: GlobalSearchResult[] = sources.accountsReceivable
    .filter(
      (item) =>
        item.companyId === activeCompanyId &&
        matches(needle, item.description, item.customer, item.documentNumber),
    )
    .slice(0, RESULTS_PER_GROUP)
    .map((item) => ({
      id: `receivable-${item.id}`,
      category: "receivable",
      title: item.description,
      subtitle: `${item.customer} · ${money(item.amount)} · ${item.status}`,
      view: "receivable",
    }));

  // `sources.documents` já vem filtrado por visibilidade do usuário atual
  // (ver getDocumentsVisibleToUser, consumido por useBPOState) — não precisa
  // de filtro de permissão adicional aqui, só de empresa.
  const documentResults: GlobalSearchResult[] = sources.documents
    .filter(
      (item) =>
        item.companyId === activeCompanyId &&
        matches(needle, item.name, item.description, item.supplier),
    )
    .slice(0, RESULTS_PER_GROUP)
    .map((item) => ({
      id: `document-${item.id}`,
      category: "document",
      title: item.name,
      subtitle: `${item.category} · ${item.status}`,
      view: "documents",
    }));

  const reportResults: GlobalSearchResult[] = [
    ...sources.reportTemplates
      .filter(
        (template) =>
          template.companyId === activeCompanyId &&
          !template.archived &&
          matches(needle, template.name, template.modelType),
      )
      .map((template) => ({
        id: `report-template-${template.id}`,
        category: "report" as const,
        title: template.name,
        subtitle: `Modelo salvo · ${template.modelType}`,
        view: "reports",
      })),
    ...sources.reports
      .filter(
        (report) =>
          report.companyId === activeCompanyId &&
          matches(needle, report.name, report.type),
      )
      .map((report) => ({
        id: `report-${report.id}`,
        category: "report" as const,
        title: report.name,
        subtitle: `Relatório gerado · ${report.type}`,
        view: "reports",
      })),
  ].slice(0, RESULTS_PER_GROUP);

  const groups: GlobalSearchGroup[] = [
    { category: "company", label: "Empresas", results: companyResults },
    { category: "supplier", label: "Fornecedores", results: supplierResults },
    { category: "customer", label: "Clientes", results: customerResults },
    { category: "payable", label: "Contas a pagar", results: payableResults },
    { category: "receivable", label: "Contas a receber", results: receivableResults },
    { category: "document", label: "Documentos", results: documentResults },
    { category: "report", label: "Relatórios", results: reportResults },
  ];

  return groups.filter((group) => group.results.length > 0);
}
