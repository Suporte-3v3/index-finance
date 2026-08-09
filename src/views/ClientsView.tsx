/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import { BankAccount, ClientModule, Company } from "../types";
import CurrencyInput from "../components/CurrencyInput";
import {
  ALL_CLIENT_MODULES,
  CLIENT_MODULE_OPTIONS,
  getCompanyClientModules,
} from "../config/clientModules";
import { Badge, Button, Card, ConfirmDialog, Modal, SearchField } from "../components/ui";
import {
  Plus,
  Layers,
  User,
  Mail,
  ShieldCheck,
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

const FIELD_INPUT_CLASS =
  "w-full p-2 bg-canvas dark:bg-white/5 text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30";

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
  const [approvalLimit, setApprovalLimit] = useState(10000);
  const [companyStatus, setCompanyStatus] =
    useState<Company["status"]>("Implantação");
  const [bpoResponsibleId, setBpoResponsibleId] = useState(currentUser.id);
  const [bankName, setBankName] = useState("");
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountType, setBankAccountType] =
    useState<BankAccount["type"]>("Corrente");
  const [initialBalance, setInitialBalance] = useState(0);
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
      <Card className="text-center text-ink-soft dark:text-ink-soft-dark text-xs italic">
        Apenas usuários com perfil "Administrador do BPO" possuem permissão para
        gerenciar clientes e faturamentos de inquilinos.
      </Card>
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
    setApprovalLimit(10000);
    setCompanyStatus("Implantação");
    setBpoResponsibleId(currentUser.id);
    setBankName("");
    setBankAgency("");
    setBankAccountNumber("");
    setBankAccountType("Corrente");
    setInitialBalance(0);
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
    setApprovalLimit(company.approvalLimit);
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
    <div id="clients-root" className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            id="clients-title"
            className="text-2xl sm:text-3xl font-bold text-ink dark:text-ink-dark tracking-tight"
          >
            Gestão de Clientes (Tenants)
          </h1>
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark leading-relaxed">
            Monitore todas as corporações integradas no monólito, controle
            regimes tributários e defina alçadas de aprovação.
          </p>
        </div>

        <Button icon={<Plus className="h-4 w-4" />} onClick={openNew}>
          Integrar Novo Cliente
        </Button>
      </div>

      {pageMessage && (
        <div className="flex items-center justify-between rounded-lg border border-brand-green-600/25 bg-brand-green-50 dark:bg-brand-green-600/10 px-4 py-3 text-xs font-semibold text-brand-green-600 dark:text-emerald-300">
          <span>{pageMessage}</span>
          <button
            type="button"
            onClick={() => setPageMessage("")}
            aria-label="Fechar mensagem"
            className="cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {pageError && (
        <div className="flex items-center justify-between rounded-lg border border-brand-red-600/25 bg-brand-red-50 dark:bg-brand-red-600/10 px-4 py-3 text-xs font-semibold text-brand-red-600 dark:text-red-300">
          <span>{pageError}</span>
          <button
            type="button"
            onClick={() => setPageError("")}
            aria-label="Fechar erro"
            className="cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Creation form modal */}
      <Modal
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingCompanyId(null);
        }}
        title={
          editingCompanyId
            ? "Editar Empresa Cliente"
            : "Cadastrar Novo Cliente e Empresa"
        }
        description={
          editingCompanyId
            ? "Atualize todas as informações cadastrais e operacionais."
            : "Provisiona a empresa, acessos, banco e cadastros iniciais em uma única operação."
        }
        size="xl"
        footer={
          <>
            <Button
              variant="text"
              onClick={() => {
                setIsFormOpen(false);
                setEditingCompanyId(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" form="clients-company-form">
              {editingCompanyId
                ? "Salvar todas as alterações"
                : "Criar empresa completa"}
            </Button>
          </>
        }
      >
        <form
          id="clients-company-form"
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
                Nome Fantasia *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Alfa Tech"
                className={FIELD_INPUT_CLASS}
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
                Razão Social *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Alfa Tecnologia Ltda"
                className={FIELD_INPUT_CLASS}
                value={corporateName}
                onChange={(e) => setCorporateName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
                CNPJ / Inscrição *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: 00.000.000/0001-00"
                className={`${FIELD_INPUT_CLASS} font-mono`}
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
                Segmento Atuação *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Tecnologia, Varejo, Saúde"
                className={FIELD_INPUT_CLASS}
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
                Regime Tributário
              </label>
              <select
                className={`${FIELD_INPUT_CLASS} cursor-pointer dark:[color-scheme:dark]`}
                value={taxRegime}
                onChange={(e) => setTaxRegime(e.target.value)}
              >
                <option value="Simples Nacional">Simples Nacional</option>
                <option value="Lucro Presumido">Lucro Presumido</option>
                <option value="Lucro Real">Lucro Real</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
                Limite Aprovação Direta (R$)
              </label>
              <CurrencyInput
                className={`${FIELD_INPUT_CLASS} font-mono`}
                value={approvalLimit}
                onChange={setApprovalLimit}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
              Responsável BPO *
            </label>
            <select
              required
              value={bpoResponsibleId}
              onChange={(e) => setBpoResponsibleId(e.target.value)}
              className={`${FIELD_INPUT_CLASS} cursor-pointer dark:[color-scheme:dark]`}
            >
              <option value="">Selecione o responsável</option>
              {bpoUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} — {user.title || "Equipe BPO"}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-line dark:border-line-dark pt-3 space-y-3">
            <span className="font-semibold text-ink dark:text-ink-dark block">
              Contatos de Referência
            </span>
            {!editingCompanyId && (
              <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark">
                O contato principal receberá um usuário de cliente. Quando
                informado, o contador também receberá um usuário próprio.
                E-mails já cadastrados serão apenas vinculados à nova empresa.
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
                  Contato Principal *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nome do cliente"
                  className={FIELD_INPUT_CLASS}
                  value={primaryContactName}
                  onChange={(e) => setPrimaryContactName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
                  Email Contato *
                </label>
                <input
                  type="email"
                  required
                  placeholder="cliente@email.com"
                  className={`${FIELD_INPUT_CLASS} font-mono`}
                  value={primaryContactEmail}
                  onChange={(e) => setPrimaryContactEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
                  Contador Credenciado
                </label>
                <input
                  type="text"
                  required={Boolean(accountantEmail)}
                  placeholder="Nome do contador"
                  className={FIELD_INPUT_CLASS}
                  value={accountantName}
                  onChange={(e) => setAccountantName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
                  Email Contador
                </label>
                <input
                  type="email"
                  required={Boolean(accountantName)}
                  placeholder="contador@email.com"
                  className={`${FIELD_INPUT_CLASS} font-mono`}
                  value={accountantEmail}
                  onChange={(e) => setAccountantEmail(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div
            ref={modulesSectionRef}
            className="border-t border-line dark:border-line-dark pt-3 space-y-3 scroll-mt-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="font-semibold text-ink dark:text-ink-dark block">
                  Módulos do Acesso Cliente
                </span>
                <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark">
                  A configuração é aplicada por empresa e pode ser alterada
                  posteriormente.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 rounded-lg border border-line dark:border-line-dark bg-canvas dark:bg-white/5 px-3 py-2 font-semibold text-ink dark:text-ink-dark cursor-pointer">
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
                  className="accent-brand-red-600"
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
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      selected
                        ? "border-brand-red-600/40 bg-brand-red-50/50 dark:bg-brand-red-600/10"
                        : "border-line dark:border-line-dark bg-canvas/50 dark:bg-white/[0.02] hover:bg-canvas dark:hover:bg-white/5"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleClientModule(module.id)}
                      className="mt-0.5 accent-brand-red-600"
                    />
                    <span>
                      <span className="block font-semibold text-ink dark:text-ink-dark">
                        {module.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-relaxed text-ink-soft dark:text-ink-soft-dark">
                        {module.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark">
              {selectedClientModules.length} de {ALL_CLIENT_MODULES.length}{" "}
              módulos selecionados.
            </p>
          </div>

          {!editingCompanyId && (
            <>
              <div className="border-t border-line dark:border-line-dark pt-3 space-y-3">
                <div>
                  <span className="font-semibold text-ink dark:text-ink-dark block">
                    Conta Bancária Inicial
                  </span>
                  <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark">
                    Cadastre uma conta real da empresa; nenhuma conta fictícia
                    será criada.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
                      Banco / Instituição *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Banco do Brasil"
                      className={FIELD_INPUT_CLASS}
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
                        Agência *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="0001"
                        className={`${FIELD_INPUT_CLASS} font-mono`}
                        value={bankAgency}
                        onChange={(e) => setBankAgency(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
                        Conta *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="12345-6"
                        className={`${FIELD_INPUT_CLASS} font-mono`}
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
                    <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
                      Tipo de conta
                    </label>
                    <select
                      value={bankAccountType}
                      onChange={(e) =>
                        setBankAccountType(
                          e.target.value as BankAccount["type"],
                        )
                      }
                      className={`${FIELD_INPUT_CLASS} dark:[color-scheme:dark]`}
                    >
                      <option value="Corrente">Corrente</option>
                      <option value="Poupança">Poupança</option>
                      <option value="Investimento">Investimento</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
                      Saldo inicial (R$)
                    </label>
                    <CurrencyInput
                      required
                      className={`${FIELD_INPUT_CLASS} font-mono`}
                      value={initialBalance}
                      onChange={setInitialBalance}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-line dark:border-line-dark pt-3 space-y-3">
                <div>
                  <span className="font-semibold text-ink dark:text-ink-dark block">
                    Cadastros Iniciais
                  </span>
                  <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark">
                    Informe um item por linha. Os cadastros poderão ser
                    complementados depois no módulo Cadastros.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
                      Fornecedores iniciais
                    </label>
                    <textarea
                      rows={4}
                      placeholder={"Fornecedor Alfa\nFornecedor Beta"}
                      className={`${FIELD_INPUT_CLASS} resize-y`}
                      value={initialSuppliers}
                      onChange={(e) => setInitialSuppliers(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
                      Clientes iniciais
                    </label>
                    <textarea
                      rows={4}
                      placeholder={"Cliente Alfa\nCliente Beta"}
                      className={`${FIELD_INPUT_CLASS} resize-y`}
                      value={initialCustomers}
                      onChange={(e) => setInitialCustomers(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
                      Categorias
                    </label>
                    <textarea
                      rows={4}
                      className={`${FIELD_INPUT_CLASS} resize-y`}
                      value={initialCategories}
                      onChange={(e) => setInitialCategories(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
                      Centros de custo
                    </label>
                    <textarea
                      rows={4}
                      className={`${FIELD_INPUT_CLASS} resize-y`}
                      value={initialCostCenters}
                      onChange={(e) => setInitialCostCenters(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
                      Formas de pagamento
                    </label>
                    <textarea
                      rows={4}
                      className={`${FIELD_INPUT_CLASS} resize-y`}
                      value={initialPaymentMethods}
                      onChange={(e) =>
                        setInitialPaymentMethods(e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
                      Tipos de documento
                    </label>
                    <textarea
                      rows={4}
                      className={`${FIELD_INPUT_CLASS} resize-y`}
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
              <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
                Status operacional
              </label>
              <select
                value={companyStatus}
                onChange={(e) =>
                  setCompanyStatus(e.target.value as Company["status"])
                }
                className={`${FIELD_INPUT_CLASS} dark:[color-scheme:dark]`}
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
              className="rounded-lg border border-brand-red-600/25 bg-brand-red-50 dark:bg-brand-red-600/10 px-3 py-2 text-xs font-semibold text-brand-red-600 dark:text-red-300"
            >
              {formError}
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(companyToDelete)}
        onClose={() => setCompanyToDelete(null)}
        onConfirm={handleDeleteCompany}
        title="Excluir empresa definitivamente?"
        description={
          companyToDelete
            ? `A empresa ${companyToDelete.tradeName} será removida com contas bancárias, cadastros, lançamentos, aprovações, documentos, relatórios e solicitações vinculadas. Usuários que também acessam outras empresas serão preservados. Esta ação não pode ser desfeita sem um backup.`
            : undefined
        }
        confirmLabel="Excluir empresa e dados"
        tone="danger"
      />

      {/* List Search */}
      <Card>
        <SearchField
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por Razão Social, Nome Fantasia ou CNPJ..."
          containerClassName="w-full md:w-96"
        />
      </Card>

      {/* Client List Grid */}
      <div className="space-y-4">
        {filteredCompanies.map((company) => (
          <Card
            key={company.id}
            className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center"
          >
            {/* General Info */}
            <div className="space-y-2 grow">
              <div className="flex items-center gap-2">
                <span className="text-[9px] bg-canvas dark:bg-white/5 border border-line dark:border-line-dark text-ink-soft dark:text-ink-soft-dark font-mono font-semibold px-2 py-0.5 rounded">
                  CNPJ {company.cnpj}
                </span>
                <span className="text-[9px] bg-brand-navy-900 text-white font-mono px-2 py-0.5 rounded font-semibold">
                  ID {company.id}
                </span>
              </div>
              <h3 className="text-base font-bold text-ink dark:text-ink-dark">
                {company.tradeName}
              </h3>
              <p className="text-ink-soft dark:text-ink-soft-dark text-xs">{company.corporateName}</p>

              <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-ink-soft dark:text-ink-soft-dark font-medium">
                <span className="flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5" />{" "}
                  {company.segment}
                </span>
                <span className="flex items-center gap-1">
                  <Award className="h-3.5 w-3.5" />{" "}
                  {company.taxRegime}
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" /> Alçada
                  Aprovação: R$ {company.approvalLimit.toLocaleString("pt-BR")}
                </span>
              </div>
            </div>

            {/* Contacts details panel */}
            <div className="bg-canvas/60 dark:bg-white/5 p-4 rounded-lg border border-line dark:border-line-dark space-y-1.5 w-full md:w-80 text-[11px]">
              <div className="flex items-center justify-between text-ink-soft dark:text-ink-soft-dark font-medium border-b border-line dark:border-line-dark pb-1.5">
                <span>Contatos e Alinhamentos</span>
                <ShieldCheck className="h-3.5 w-3.5 text-brand-green-600 dark:text-emerald-400" />
              </div>
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-ink-soft dark:text-ink-soft-dark shrink-0" />
                <span className="text-ink dark:text-ink-dark font-semibold">
                  {company.primaryContactName}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-ink-soft dark:text-ink-soft-dark font-mono">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{company.primaryContactEmail}</span>
              </div>
              <div className="flex items-center gap-1.5 pt-1.5 border-t border-line dark:border-line-dark">
                <span className="text-ink-soft dark:text-ink-soft-dark">
                  Contador: {company.accountantName}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-line dark:border-line-dark">
                <span className="text-ink-soft dark:text-ink-soft-dark">Módulos do cliente</span>
                <span className="font-semibold text-ink dark:text-ink-dark">
                  {getCompanyClientModules(company).length}/
                  {ALL_CLIENT_MODULES.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {CLIENT_MODULE_OPTIONS.filter((module) =>
                  getCompanyClientModules(company).includes(module.id),
                ).map((module) => (
                  <Badge key={module.id} tone="navy" className="text-[9px] px-1.5 py-0.5">
                    {module.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Actions / Status switch */}
            <div className="space-y-2 w-full md:w-44 shrink-0 text-right">
              <Button
                fullWidth
                variant="outline"
                size="sm"
                icon={<Pencil className="h-3.5 w-3.5" />}
                onClick={() => openEdit(company)}
              >
                Editar cadastro
              </Button>
              <Button
                fullWidth
                variant="outline"
                size="sm"
                icon={<Settings2 className="h-3.5 w-3.5" />}
                onClick={() => openEdit(company, true)}
              >
                Gerenciar módulos
              </Button>
              <Button
                fullWidth
                size="sm"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => {
                  setPageError("");
                  setCompanyToDelete(company);
                }}
              >
                Excluir empresa
              </Button>
              <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark font-semibold uppercase tracking-wider block">
                Status do Cliente
              </span>
              <select
                className="w-full p-2 bg-canvas dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 border border-line dark:border-line-dark text-ink dark:text-ink-dark rounded-lg text-xs font-semibold cursor-pointer dark:[color-scheme:dark]"
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
              <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark block mt-1">
                Modificado reflete no Centro de Operações
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
