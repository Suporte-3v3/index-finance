/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import { Company, Tenant } from "../types";
import {
  Plus,
  Building2,
  Layers,
  User,
  Mail,
  ShieldCheck,
  Search,
  Award,
  Calendar,
  DollarSign,
  Pencil,
} from "lucide-react";

export default function ClientsView() {
  const {
    tenants,
    companies,
    addCompany,
    updateCompany,
    updateCompanyStatus,
    currentUser,
  } = useBPOState();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

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

  if (currentUser.role !== "BPO_ADMIN") {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-zinc-500 text-xs italic">
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!corporateName || !tradeName || !cnpj || !segment) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    const data = {
      tenantId: "t-1111-1111", // default to main simulated tenant
      cnpj,
      corporateName,
      tradeName,
      segment,
      taxRegime,
      accountantName,
      accountantEmail,
      primaryContactName,
      primaryContactEmail,
      bpoResponsibleId: "u-bpo-analyst",
      approvalLimit: Number(approvalLimit),
    };
    if (editingCompanyId)
      updateCompany(editingCompanyId, { ...data, status: companyStatus });
    else addCompany(data);

    // Reset Form
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
    setEditingCompanyId(null);
    setIsFormOpen(false);
  };

  const openEdit = (company: Company) => {
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
    setIsFormOpen(true);
  };
  const openNew = () => {
    setEditingCompanyId(null);
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
    setIsFormOpen(true);
  };

  const handleStatusChange = (id: string, status: Company["status"]) => {
    updateCompanyStatus(id, status);
  };

  return (
    <div id="clients-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-sans">
        <div>
          <h2
            id="clients-title"
            className="text-xl font-bold text-zinc-900 tracking-tight"
          >
            Gestão de Clientes (Tenants)
          </h2>
          <p className="text-zinc-500 text-xs">
            Monitore todas as corporações integradas no monólito, controle
            regimes tributários e defina alçadas de aprovação.
          </p>
        </div>

        <button
          onClick={openNew}
          className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#C8102E] hover:bg-[#8F071B] px-3.5 py-2.5 rounded-lg transition-colors cursor-pointer shadow-xs"
        >
          <Plus className="h-4 w-4" /> Integrar Novo Cliente
        </button>
      </div>

      {/* Creation form modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans text-xs">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-zinc-100 bg-gradient-to-r from-[#0B2C52] to-[#C8102E] text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">
                  {editingCompanyId
                    ? "Editar Empresa Cliente"
                    : "Cadastrar Novo Cliente e Empresa"}
                </h3>
                <p className="text-[10px] text-[#F2D3A0]">
                  {editingCompanyId
                    ? "Atualize todas as informações cadastrais e operacionais."
                    : "Gera um ambiente de dados isolado e parametriza os limites do BPO."}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingCompanyId(null);
                }}
                className="text-[#F2D3A0] hover:text-white font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                    Nome Fantasia *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Alfa Tech"
                    className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                    Razão Social *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Alfa Tecnologia Ltda"
                    className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                    value={corporateName}
                    onChange={(e) => setCorporateName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                    CNPJ / Inscrição *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 00.000.000/0001-00"
                    className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                    Segmento Atuação *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Tecnologia, Varejo, Saúde"
                    className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                    value={segment}
                    onChange={(e) => setSegment(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                    Regime Tributário
                  </label>
                  <select
                    className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg cursor-pointer text-xs"
                    value={taxRegime}
                    onChange={(e) => setTaxRegime(e.target.value)}
                  >
                    <option value="Simples Nacional">Simples Nacional</option>
                    <option value="Lucro Presumido">Lucro Presumido</option>
                    <option value="Lucro Real">Lucro Real</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                    Limite Aprovação Direta (R$)
                  </label>
                  <input
                    type="number"
                    className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono"
                    value={approvalLimit}
                    onChange={(e) => setApprovalLimit(e.target.value)}
                  />
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-3 space-y-3">
                <span className="font-bold text-zinc-700 block">
                  Contatos de Referência
                </span>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                      Contato Principal *
                    </label>
                    <input
                      type="text"
                      placeholder="Nome do cliente"
                      className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                      value={primaryContactName}
                      onChange={(e) => setPrimaryContactName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                      Email Contato *
                    </label>
                    <input
                      type="email"
                      placeholder="cliente@email.com"
                      className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono"
                      value={primaryContactEmail}
                      onChange={(e) => setPrimaryContactEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                      Contador Credenciado
                    </label>
                    <input
                      type="text"
                      placeholder="Nome do contador"
                      className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                      value={accountantName}
                      onChange={(e) => setAccountantName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                      Email Contador
                    </label>
                    <input
                      type="email"
                      placeholder="contador@email.com"
                      className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono"
                      value={accountantEmail}
                      onChange={(e) => setAccountantEmail(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {editingCompanyId && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block">
                    Status operacional
                  </label>
                  <select
                    value={companyStatus}
                    onChange={(e) =>
                      setCompanyStatus(e.target.value as Company["status"])
                    }
                    className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
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

              <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingCompanyId(null);
                  }}
                  className="text-zinc-500 font-bold px-3 py-2 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="font-bold text-white bg-[#C8102E] hover:bg-[#8F071B] px-4 py-2 rounded-lg cursor-pointer shadow-xs"
                >
                  {editingCompanyId
                    ? "Salvar todas as alterações"
                    : "Ativar Empresa e Banco"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List Search */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-4">
        <div className="relative w-full md:w-96 font-sans">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por Razão Social, Nome Fantasia ou CNPJ..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 hover:bg-zinc-100/50 focus:bg-white rounded-lg border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-colors"
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
            className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs p-5 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center"
          >
            {/* General Info */}
            <div className="space-y-2 flex-grow">
              <div className="flex items-center gap-2">
                <span className="text-[9px] bg-zinc-100 border border-zinc-200 text-zinc-500 font-mono font-bold px-2 py-0.5 rounded">
                  CNPJ {company.cnpj}
                </span>
                <span className="text-[9px] bg-zinc-950 text-white font-mono px-2 py-0.5 rounded font-bold">
                  ID {company.id}
                </span>
              </div>
              <h3 className="text-base font-black text-zinc-900">
                {company.tradeName}
              </h3>
              <p className="text-zinc-400 text-xs">{company.corporateName}</p>

              <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-zinc-500 font-medium">
                <span className="flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5 text-zinc-400" />{" "}
                  {company.segment}
                </span>
                <span className="flex items-center gap-1">
                  <Award className="h-3.5 w-3.5 text-zinc-400" />{" "}
                  {company.taxRegime}
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5 text-zinc-400" /> Alçada
                  Aprovação: R$ {company.approvalLimit.toLocaleString("pt-BR")}
                </span>
              </div>
            </div>

            {/* Contacts details panel */}
            <div className="bg-zinc-50/50 p-4 rounded-xl border border-zinc-200/50 space-y-1.5 w-full md:w-80 font-sans text-[11px]">
              <div className="flex items-center justify-between text-zinc-500 font-medium border-b border-zinc-100 pb-1.5">
                <span>Contatos e Alinhamentos</span>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                <span className="text-zinc-800 font-semibold">
                  {company.primaryContactName}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400 font-mono">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{company.primaryContactEmail}</span>
              </div>
              <div className="flex items-center gap-1.5 pt-1.5 border-t border-zinc-100">
                <span className="text-zinc-400">
                  Contador: {company.accountantName}
                </span>
              </div>
            </div>

            {/* Actions / Status switch */}
            <div className="space-y-2 w-full md:w-36 shrink-0 text-right">
              <button
                onClick={() => openEdit(company)}
                className="w-full p-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
                Status do Cliente
              </span>
              <select
                className="w-full p-2 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-lg text-xs font-bold cursor-pointer"
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
              <span className="text-[10px] text-zinc-400 block mt-1">
                Modificado reflete no Centro de Operações
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
