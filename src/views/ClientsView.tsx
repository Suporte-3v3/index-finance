/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import { BankAccount, ClientModule, Company } from "../types";
import {
  ALL_CLIENT_MODULES,
  CLIENT_MODULE_OPTIONS,
  getCompanyClientModules,
} from "../config/clientModules";
import {
  Plus,
  Layers,
  User,
  Mail,
  ShieldCheck,
  Search,
  Award,
  DollarSign,
  Pencil,
  Settings2,
  Trash2,
  X,
} from "lucide-react";

const DEFAULT_CATEGORIES = "Aluguel\nEnergia\nMarketing\nFornecedores";
const DEFAULT_COST_CENTERS = "Administrativo\nComercial\nOperacional";
const DEFAULT_PAYMENT_METHODS = "PIX\nTransferência\nBoleto\nDébito automático";
const DEFAULT_DOCUMENT_TYPES =
  "Nota fiscal\nBoleto\nComprovante\nRecibo\nContrato\nExtrato\nOutros";

const parseInitialRecords = (value: string) =>
  Array.from(
    new Map(
      value
        .split(/\r?\n|,|;/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => [item.toLocaleLowerCase("pt-BR"), item]),
    ).values(),
  );

export default function ClientsView() {
  const {
    companies,
    users,
    addCompany,
    updateCompany,
    deleteCompany,
    updateCompanyStatus,
    currentUser,
    activeTenant,
  } = useBPOState();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [pageError, setPageError] = useState("");
  const modulesSectionRef = useRef<HTMLDivElement>(null);

  // Form Fields
  const [corporateName, setCorporateName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [segment, setSegment] = useState("");
  const [taxRegime, setTaxRegime] = useState("Simples Nacional");
  const [accountantName, setAccountantName] = useState("");
  const [accountantEmail, setAccountantEmail] = useState("");
  const [primaryContactName, setPrimaryContactName] = useState("");
  const [primaryContactEmail, setPrimaryContactEmail] = useState("");
  const [approvalLimit, setApprovalLimit] = useState<string>("10000");
  const [companyStatus, setCompanyStatus] =
    useState<Company["status"]>("Implantação");
  const [bpoResponsibleId, setBpoResponsibleId] = useState(currentUser.id);
  const [bankName, setBankName] = useState("");
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountType, setBankAccountType] =
    useState<BankAccount["type"]>("Corrente");
  const [initialBalance, setInitialBalance] = useState("0");
  const [initialSuppliers, setInitialSuppliers] = useState("");
  const [initialCustomers, setInitialCustomers] = useState("");
  const [initialCategories, setInitialCategories] =
    useState(DEFAULT_CATEGORIES);
  const [initialCostCenters, setInitialCostCenters] = useState(
    DEFAULT_COST_CENTERS,
  );
  const [initialPaymentMethods, setInitialPaymentMethods] = useState(
    DEFAULT_PAYMENT_METHODS,
  );
  const [initialDocumentTypes, setInitialDocumentTypes] = useState(
    DEFAULT_DOCUMENT_TYPES,
  );
  const [selectedClientModules, setSelectedClientModules] = useState<
    ClientModule[]
  >([...ALL_CLIENT_MODULES]);
  const [formError, setFormError] = useState("");

  if (currentUser.role !== "BPO_ADMIN") {
    return (
      <div className="bg-white dark:bg-[#091320] border border-zinc-200 dark:border-zinc-800 rounded-sm p-8 text-center text-zinc-500 dark:text-zinc-400 text-xs italic">
        Apenas usuários com perfil "Administrador do BPO" possuem permissão para
        gerenciar clientes e faturamentos de inquilinos.
      </div>
    );
  }

  const filteredCompanies = companies.filter(
    (c) =>
      c.tradeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.corporateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cnpj.includes(searchTerm),
  );
  const bpoUsers = users.filter(
    (user) =>
      user.status === "ACTIVE" &&
      (user.role === "BPO_ADMIN" || user.role === "BPO_TEAM"),
  );

  const resetForm = () => {
    setCorporateName("");
    setTradeName("");
    setCnpj("");
    setSegment("");
    setTaxRegime("Simples Nacional");
    setAccountantName("");
    setAccountantEmail("");
    setPrimaryContactName("");
    setPrimaryContactEmail("");
    setApprovalLimit("10000");
    setCompanyStatus("Implantação");
    setBpoResponsibleId(currentUser.id);
    setBankName("");
    setBankAgency("");
    setBankAccountNumber("");
    setBankAccountType("Corrente");
    setInitialBalance("0");
    setInitialSuppliers("");
    setInitialCustomers("");
    setInitialCategories(DEFAULT_CATEGORIES);
    setInitialCostCenters(DEFAULT_COST_CENTERS);
    setInitialPaymentMethods(DEFAULT_PAYMENT_METHODS);
    setInitialDocumentTypes(DEFAULT_DOCUMENT_TYPES);
    setSelectedClientModules([...ALL_CLIENT_MODULES]);
    setFormError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (
      !corporateName ||
      !tradeName ||
      !cnpj ||
      !segment ||
      !primaryContactName ||
      !primaryContactEmail ||
      !bpoResponsibleId
    ) {
      setFormError("Preencha todos os campos obrigatórios.");
      return;
    }
    if (Boolean(accountantName.trim()) !== Boolean(accountantEmail.trim())) {
      setFormError("Informe o nome e o e-mail do contador, ou deixe ambos vazios.");
      return;
    }
    if (selectedClientModules.length === 0) {
      setFormError("Selecione pelo menos um módulo para o acesso do cliente.");
      return;
    }

    const data = {
      tenantId: activeTenant?.id || "t-1111-1111",
      cnpj,
      corporateName,
      tradeName,
      segment,
      taxRegime,
      accountantName,
      accountantEmail,
      primaryContactName,
      primaryContactEmail,
      bpoResponsibleId,
      approvalLimit: Number(approvalLimit),
      clientModules: selectedClientModules,
    };
    const wasEditing = Boolean(editingCompanyId);
    if (editingCompanyId) {
      const result = updateCompany(editingCompanyId, {
        ...data,
        status: companyStatus,
      });
      if (!result.success) {
        setFormError(result.error || "Não foi possível atualizar a empresa.");
        return;
      }
    } else {
      const result = addCompany(data, {
        initialBankAccount: {
          bankName,
          agency: bankAgency,
          accountNumber: bankAccountNumber,
          type: bankAccountType,
          balance: Number(initialBalance),
        },
        masterData: {
          SUPPLIER: parseInitialRecords(initialSuppliers),
          CUSTOMER: parseInitialRecords(initialCustomers),
          CATEGORY: parseInitialRecords(initialCategories),
          COST_CENTER: parseInitialRecords(initialCostCenters),
          PAYMENT_METHOD: parseInitialRecords(initialPaymentMethods),
          DOCUMENT_TYPE: parseInitialRecords(initialDocumentTypes),
        },
      });
      if (!result.success) {
        setFormError(result.error || "Não foi possível cadastrar a empresa.");
        return;
      }
    }

    resetForm();
    setEditingCompanyId(null);
    setIsFormOpen(false);
    setPageError("");
    setPageMessage(
      wasEditing
        ? "Empresa e módulos de acesso atualizados com sucesso."
        : "Empresa criada com sucesso.",
    );
  };

  const openEdit = (company: Company, focusModules = false) => {
    setEditingCompanyId(company.id);
    setCorporateName(company.corporateName);
    setTradeName(company.tradeName);
    setCnpj(company.cnpj);
    setSegment(company.segment);
    setTaxRegime(company.taxRegime);
    setAccountantName(company.accountantName);
    setAccountantEmail(company.accountantEmail);
    setPrimaryContactName(company.primaryContactName);
    setPrimaryContactEmail(company.primaryContactEmail);
    setApprovalLimit(String(company.approvalLimit));
    setCompanyStatus(company.status);
    setBpoResponsibleId(company.bpoResponsibleId);
    setSelectedClientModules(getCompanyClientModules(company));
    setFormError("");
    setIsFormOpen(true);
    if (focusModules) {
      window.setTimeout(
        () =>
          modulesSectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        0,
      );
    }
  };
  const openNew = () => {
    setEditingCompanyId(null);
    resetForm();
    setIsFormOpen(true);
  };

  const handleStatusChange = (id: string, status: Company["status"]) => {
    updateCompanyStatus(id, status);
  };

  const handleDeleteCompany = () => {
    if (!companyToDelete) return;
    const deletedName = companyToDelete.tradeName;
    const result = deleteCompany(companyToDelete.id);
    if (!result.success) {
      setPageMessage("");
      setPageError(result.error || "Não foi possível excluir a empresa.");
      return;
    }
    setCompanyToDelete(null);
    setPageError("");
    setPageMessage(`A empresa “${deletedName}” e seus dados foram excluídos.`);
  };

  const toggleClientModule = (moduleId: ClientModule) => {
    setSelectedClientModules((current) =>
      current.includes(moduleId)
        ? current.filter((id) => id !== moduleId)
        : [...current, moduleId],
    );
  };

  return (
    <div id="clients-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-sans">
        <div>
          <h2
            id="clients-title"
            className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight"
          >
            Gestão de Clientes (Tenants)
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">
            Monitore todas as corporações integradas no monólito, controle
            regimes tributários e defina alçadas de aprovação.
          </p>
        </div>

        <button
          onClick={openNew}
          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#C8102E] hover:bg-[#8F071B] px-3.5 py-2.5 rounded-sm transition-colors cursor-pointer shadow-xs"
        >
          <Plus className="h-4 w-4" /> Integrar Novo Cliente
        </button>
      </div>

      {pageMessage && (
        <div className="flex items-center justify-between rounded-sm border border-emerald-200 dark:border-emerald-500/25 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          <span>{pageMessage}</span>
          <button
            type="button"
            onClick={() => setPageMessage("")}
            aria-label="Fechar mensagem"
            className="cursor-pointer text-emerald-700 dark:text-emerald-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {pageError && (
        <div className="flex items-center justify-between rounded-sm border border-red-200 dark:border-red-500/25 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-800 dark:text-red-300">
          <span>{pageError}</span>
          <button
            type="button"
            onClick={() => setPageError("")}
            aria-label="Fechar erro"
            className="cursor-pointer text-red-700 dark:text-red-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Creation form modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans text-xs">
          <div className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-4xl max-h-[calc(100vh-2rem)] w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-gradient-to-r from-[#0B2C52] to-[#C8102E] text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">
                  {editingCompanyId
                    ? "Editar Empresa Cliente"
                    : "Cadastrar Novo Cliente e Empresa"}
                </h3>
                <p className="text-[10px] text-[#F2D3A0]">
                  {editingCompanyId
                    ? "Atualize todas as informações cadastrais e operacionais."
                    : "Provisiona a empresa, acessos, banco e cadastros iniciais em uma única operação."}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingCompanyId(null);
                }}
                className="text-[#F2D3A0] hover:text-white font-semibold cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-4 overflow-y-auto"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                    Nome Fantasia *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Alfa Tech"
                    className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs"
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                    Razão Social *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Alfa Tecnologia Ltda"
                    className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs"
                    value={corporateName}
                    onChange={(e) => setCorporateName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                    CNPJ / Inscrição *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 00.000.000/0001-00"
                    className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs font-mono"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                    Segmento Atuação *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Tecnologia, Varejo, Saúde"
                    className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs"
                    value={segment}
                    onChange={(e) => setSegment(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                    Regime Tributário
                  </label>
                  <select
                    className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm cursor-pointer text-xs"
                    value={taxRegime}
                    onChange={(e) => setTaxRegime(e.target.value)}
                  >
                    <option value="Simples Nacional">Simples Nacional</option>
                    <option value="Lucro Presumido">Lucro Presumido</option>
                    <option value="Lucro Real">Lucro Real</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                    Limite Aprovação Direta (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs font-mono"
                    value={approvalLimit}
                    onChange={(e) => setApprovalLimit(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                  Responsável BPO *
                </label>
                <select
                  required
                  value={bpoResponsibleId}
                  onChange={(e) => setBpoResponsibleId(e.target.value)}
                  className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm cursor-pointer text-xs"
                >
                  <option value="">Selecione o responsável</option>
                  {bpoUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} — {user.title || "Equipe BPO"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 space-y-3">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 block">
                  Contatos de Referência
                </span>
                {!editingCompanyId && (
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    O contato principal receberá um usuário de cliente. Quando
                    informado, o contador também receberá um usuário próprio.
                    E-mails já cadastrados serão apenas vinculados à nova empresa.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                      Contato Principal *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nome do cliente"
                      className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs"
                      value={primaryContactName}
                      onChange={(e) => setPrimaryContactName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                      Email Contato *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="cliente@email.com"
                      className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs font-mono"
                      value={primaryContactEmail}
                      onChange={(e) => setPrimaryContactEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                      Contador Credenciado
                    </label>
                    <input
                      type="text"
                      required={Boolean(accountantEmail)}
                      placeholder="Nome do contador"
                      className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs"
                      value={accountantName}
                      onChange={(e) => setAccountantName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                      Email Contador
                    </label>
                    <input
                      type="email"
                      required={Boolean(accountantName)}
                      placeholder="contador@email.com"
                      className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs font-mono"
                      value={accountantEmail}
                      onChange={(e) => setAccountantEmail(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div
                ref={modulesSectionRef}
                className="border-t border-zinc-100 dark:border-zinc-800 pt-3 space-y-3 scroll-mt-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 block">
                      Módulos do Acesso Cliente
                    </span>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      A configuração é aplicada por empresa e pode ser alterada
                      posteriormente.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/70 px-3 py-2 font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ALL_CLIENT_MODULES.every((moduleId) =>
                        selectedClientModules.includes(moduleId),
                      )}
                      onChange={(event) =>
                        setSelectedClientModules(
                          event.target.checked ? [...ALL_CLIENT_MODULES] : [],
                        )
                      }
                      className="accent-[#C8102E]"
                    />
                    Selecionar todos
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {CLIENT_MODULE_OPTIONS.map((module) => {
                    const selected = selectedClientModules.includes(module.id);
                    return (
                      <label
                        key={module.id}
                        className={`flex items-start gap-3 rounded-sm border p-3 cursor-pointer transition-colors ${
                          selected
                            ? "border-[#C8102E]/40 bg-red-50/50 dark:bg-red-500/10"
                            : "border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/70"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleClientModule(module.id)}
                          className="mt-0.5 accent-[#C8102E]"
                        />
                        <span>
                          <span className="block font-semibold text-zinc-800 dark:text-zinc-100">
                            {module.label}
                          </span>
                          <span className="mt-0.5 block text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                            {module.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                  {selectedClientModules.length} de {ALL_CLIENT_MODULES.length}{" "}
                  módulos selecionados.
                </p>
              </div>

              {!editingCompanyId && (
                <>
                  <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 space-y-3">
                    <div>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300 block">
                        Conta Bancária Inicial
                      </span>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        Cadastre uma conta real da empresa; nenhuma conta fictícia
                        será criada.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                          Banco / Instituição *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Banco do Brasil"
                          className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                            Agência *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="0001"
                            className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs font-mono"
                            value={bankAgency}
                            onChange={(e) => setBankAgency(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                            Conta *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="12345-6"
                            className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs font-mono"
                            value={bankAccountNumber}
                            onChange={(e) =>
                              setBankAccountNumber(e.target.value)
                            }
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                          Tipo de conta
                        </label>
                        <select
                          value={bankAccountType}
                          onChange={(e) =>
                            setBankAccountType(
                              e.target.value as BankAccount["type"],
                            )
                          }
                          className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs"
                        >
                          <option value="Corrente">Corrente</option>
                          <option value="Poupança">Poupança</option>
                          <option value="Investimento">Investimento</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                          Saldo inicial (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs font-mono"
                          value={initialBalance}
                          onChange={(e) => setInitialBalance(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 space-y-3">
                    <div>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300 block">
                        Cadastros Iniciais
                      </span>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        Informe um item por linha. Os cadastros poderão ser
                        complementados depois no módulo Cadastros.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                          Fornecedores iniciais
                        </label>
                        <textarea
                          rows={4}
                          placeholder={"Fornecedor Alfa\nFornecedor Beta"}
                          className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs resize-y"
                          value={initialSuppliers}
                          onChange={(e) => setInitialSuppliers(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                          Clientes iniciais
                        </label>
                        <textarea
                          rows={4}
                          placeholder={"Cliente Alfa\nCliente Beta"}
                          className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs resize-y"
                          value={initialCustomers}
                          onChange={(e) => setInitialCustomers(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                          Categorias
                        </label>
                        <textarea
                          rows={4}
                          className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs resize-y"
                          value={initialCategories}
                          onChange={(e) => setInitialCategories(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                          Centros de custo
                        </label>
                        <textarea
                          rows={4}
                          className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs resize-y"
                          value={initialCostCenters}
                          onChange={(e) => setInitialCostCenters(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                          Formas de pagamento
                        </label>
                        <textarea
                          rows={4}
                          className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs resize-y"
                          value={initialPaymentMethods}
                          onChange={(e) =>
                            setInitialPaymentMethods(e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                          Tipos de documento
                        </label>
                        <textarea
                          rows={4}
                          className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs resize-y"
                          value={initialDocumentTypes}
                          onChange={(e) =>
                            setInitialDocumentTypes(e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {editingCompanyId && (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block">
                    Status operacional
                  </label>
                  <select
                    value={companyStatus}
                    onChange={(e) =>
                      setCompanyStatus(e.target.value as Company["status"])
                    }
                    className="w-full p-2 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs"
                  >
                    <option>Em dia</option>
                    <option>Atenção</option>
                    <option>Atraso</option>
                    <option>Sem movimentação</option>
                    <option>Implantação</option>
                    <option>Inativo</option>
                  </select>
                </div>
              )}

              {formError && (
                <div
                  role="alert"
                  className="rounded-sm border border-red-200 dark:border-red-500/25 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-300"
                >
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingCompanyId(null);
                  }}
                  className="text-zinc-500 dark:text-zinc-400 font-semibold px-3 py-2 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="font-semibold text-white bg-[#C8102E] hover:bg-[#8F071B] px-4 py-2 rounded-sm cursor-pointer shadow-xs"
                >
                  {editingCompanyId
                    ? "Salvar todas as alterações"
                    : "Criar empresa completa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {companyToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 dark:bg-black/70 p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-company-title"
            className="w-full max-w-md rounded-sm border border-red-200 dark:border-red-500/25 bg-white dark:bg-[#091320] p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-100 dark:bg-red-500/15 p-2 text-red-700 dark:text-red-300">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3
                  id="delete-company-title"
                  className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
                >
                  Excluir empresa definitivamente?
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  A empresa <strong>{companyToDelete.tradeName}</strong> será
                  removida com contas bancárias, cadastros, lançamentos,
                  aprovações, documentos, relatórios e solicitações vinculadas.
                  Usuários que também acessam outras empresas serão preservados.
                </p>
                <p className="mt-2 text-xs font-semibold text-red-700 dark:text-red-400">
                  Esta ação não pode ser desfeita sem um backup.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCompanyToDelete(null)}
                className="cursor-pointer rounded-sm px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteCompany}
                className="cursor-pointer rounded-sm bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800"
              >
                Excluir empresa e dados
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List Search */}
      <div className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-xs p-4">
        <div className="relative w-full md:w-96 font-sans">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por Razão Social, Nome Fantasia ou CNPJ..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 hover:bg-zinc-100/50 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 rounded-sm border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Client List Grid */}
      <div className="space-y-4 font-sans text-xs">
        {filteredCompanies.map((company) => (
          <div
            key={company.id}
            className="bg-white dark:bg-[#091320] border border-zinc-200 dark:border-zinc-800 rounded-sm overflow-hidden shadow-xs p-5 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center"
          >
            {/* General Info */}
            <div className="space-y-2 flex-grow">
              <div className="flex items-center gap-2">
                <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 font-mono font-semibold px-2 py-0.5 rounded">
                  CNPJ {company.cnpj}
                </span>
                <span className="text-[9px] bg-zinc-950 dark:bg-zinc-800 text-white font-mono px-2 py-0.5 rounded font-semibold">
                  ID {company.id}
                </span>
              </div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                {company.tradeName}
              </h3>
              <p className="text-zinc-400 dark:text-zinc-500 text-xs">{company.corporateName}</p>

              <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                <span className="flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />{" "}
                  {company.segment}
                </span>
                <span className="flex items-center gap-1">
                  <Award className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />{" "}
                  {company.taxRegime}
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" /> Alçada
                  Aprovação: R$ {company.approvalLimit.toLocaleString("pt-BR")}
                </span>
              </div>
            </div>

            {/* Contacts details panel */}
            <div className="bg-zinc-50/50 dark:bg-zinc-800/40 p-4 rounded-sm border border-zinc-200/50 dark:border-zinc-800 space-y-1.5 w-full md:w-80 font-sans text-[11px]">
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 font-medium border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
                <span>Contatos e Alinhamentos</span>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                <span className="text-zinc-800 dark:text-zinc-100 font-semibold">
                  {company.primaryContactName}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500 font-mono">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{company.primaryContactEmail}</span>
              </div>
              <div className="flex items-center gap-1.5 pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-400 dark:text-zinc-500">
                  Contador: {company.accountantName}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-400 dark:text-zinc-500">Módulos do cliente</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {getCompanyClientModules(company).length}/
                  {ALL_CLIENT_MODULES.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {CLIENT_MODULE_OPTIONS.filter((module) =>
                  getCompanyClientModules(company).includes(module.id),
                ).map((module) => (
                  <span
                    key={module.id}
                    className="rounded-md border border-blue-100 dark:border-blue-500/25 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700 dark:text-blue-300"
                  >
                    {module.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions / Status switch */}
            <div className="space-y-2 w-full md:w-44 shrink-0 text-right">
              <button
                onClick={() => openEdit(company)}
                className="w-full p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/25 rounded-sm text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar cadastro
              </button>
              <button
                onClick={() => openEdit(company, true)}
                className="w-full p-2 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/25 rounded-sm text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Settings2 className="h-3.5 w-3.5" /> Gerenciar módulos
              </button>
              <button
                onClick={() => {
                  setPageError("");
                  setCompanyToDelete(company);
                }}
                className="w-full p-2 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/25 rounded-sm text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir empresa
              </button>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold uppercase tracking-wider block">
                Status do Cliente
              </span>
              <select
                className="w-full p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-sm text-xs font-semibold cursor-pointer"
                value={company.status}
                onChange={(e) =>
                  handleStatusChange(company.id, e.target.value as any)
                }
              >
                <option value="Em dia">Em dia</option>
                <option value="Atenção">Atenção</option>
                <option value="Atraso">Atraso</option>
                <option value="Sem movimentação">Sem Movimentação</option>
                <option value="Implantação">Implantação</option>
                <option value="Inativo">Inativo</option>
              </select>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block mt-1">
                Modificado reflete no Centro de Operações
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
