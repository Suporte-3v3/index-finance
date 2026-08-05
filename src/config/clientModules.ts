import { ClientModule, Company, User } from "../types";

export const CLIENT_MODULE_OPTIONS: Array<{
  id: ClientModule;
  label: string;
  description: string;
}> = [
  {
    id: "dashboard",
    label: "Painel Geral",
    description: "Saldos, entradas, saídas, vencimentos e aprovações.",
  },
  {
    id: "approvals",
    label: "Central de Aprovações",
    description: "Aprovar, rejeitar ou solicitar ajustes.",
  },
  {
    id: "documents",
    label: "Central de Documentos",
    description: "Receber, enviar, visualizar e baixar documentos.",
  },
  {
    id: "cash-flow",
    label: "Fluxo de Caixa",
    description: "Consultar movimentações e exportar Excel.",
  },
  {
    id: "reports",
    label: "DRE e Relatórios",
    description: "Montar, gerar e baixar relatórios em PDF ou Excel.",
  },
  {
    id: "support",
    label: "Falar com o BPO",
    description: "Abrir solicitações e conversar com a equipe BPO.",
  },
  {
    id: "bakery-cash",
    label: "Caixa Padaria",
    description: "Módulo de caixa para a operação de padarias.",
  },
];

export const ALL_CLIENT_MODULES = CLIENT_MODULE_OPTIONS.map(
  (module) => module.id,
);

// Preserve the module set of companies persisted before Caixa Padaria existed.
export const LEGACY_CLIENT_MODULES = ALL_CLIENT_MODULES.filter(
  (module) => module !== "bakery-cash",
);

export const getCompanyClientModules = (
  company?: Company | null,
): ClientModule[] =>
  company?.clientModules === undefined
    ? [...LEGACY_CLIENT_MODULES]
    : company.clientModules;

// "Operador do cliente": nunca pode acessar Painel Geral, Central de
// Aprovações ou Fluxo de Caixa, independente dos módulos liberados para a
// empresa.
export const CLIENT_OPERATOR_BLOCKED_MODULES: ClientModule[] = [
  "dashboard",
  "approvals",
  "cash-flow",
];

export const getEffectiveClientModules = (
  company: Company | null | undefined,
  user: Pick<User, "role" | "clientOperator">,
): ClientModule[] => {
  const modules = getCompanyClientModules(company);
  if (user.role === "CLIENT" && user.clientOperator) {
    return modules.filter(
      (module) => !CLIENT_OPERATOR_BLOCKED_MODULES.includes(module),
    );
  }
  return modules;
};
