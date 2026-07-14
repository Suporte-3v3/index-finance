/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useBPOState } from '../hooks/useBPOState';
import { AccountReceivable } from '../types';
import { 
  Plus, 
  Search, 
  Filter, 
  DollarSign, 
  TrendingUp, 
  ChevronDown, 
  ChevronUp, 
  Paperclip,
  CheckCircle,
  Clock,
  Ban,
  ArrowUpRight,
  ExternalLink
} from 'lucide-react';

export default function AccountsReceivableView() {
  const { 
    activeCompany, 
    bankAccounts, 
    accountsReceivable, 
    addAccountReceivable, 
    receiveAccountReceivable, 
    cancelAccountReceivable,
    currentUser,
    hasPermission 
  } = useBPOState();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  
  // Expanded detailed panels for receivables
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Partial Receipt Pop-up state
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [receivedAmountVal, setReceivedAmountVal] = useState('');

  // Creation Form Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2>(1);

  // Form Fields
  const [description, setDescription] = useState('');
  const [customer, setCustomer] = useState('');
  const [category, setCategory] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [competenceMonth, setCompetenceMonth] = useState('2026-07');
  const [issueDate, setIssueDate] = useState('2026-07-13');
  const [dueDate, setDueDate] = useState('2026-07-30');
  const [amount, setAmount] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState('Boleto Bancário');
  const [bankAccountId, setBankAccountId] = useState('');
  const [recurrence, setRecurrence] = useState<'Nenhuma' | 'Semanal' | 'Mensal' | 'Trimestral' | 'Anual'>('Nenhuma');
  const [documentNumber, setDocumentNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  if (!activeCompany) return null;

  const accounts = bankAccounts.filter(ba => ba.companyId === activeCompany.id);
  const companyReceivables = accountsReceivable.filter(ar => ar.companyId === activeCompany.id);

  // Filter items
  const filteredReceivables = companyReceivables.filter(ar => {
    const matchesSearch = 
      ar.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ar.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ar.documentNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || ar.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: AccountReceivable['status']) => {
    switch (status) {
      case 'Rascunho':
        return 'bg-zinc-100 text-zinc-600 border-zinc-200';
      case 'Pendente':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'Emitida':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Parcialmente recebida':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Recebida':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Vencida':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Em cobrança':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'Negociada':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Cancelada':
        return 'bg-zinc-200 text-zinc-800 border-zinc-300 line-through';
      default:
        return 'bg-zinc-50 text-zinc-600 border-zinc-200';
    }
  };

  const resetForm = () => {
    setDescription('');
    setCustomer('');
    setCategory('');
    setCostCenter('');
    setCompetenceMonth('2026-07');
    setIssueDate('2026-07-13');
    setDueDate('2026-07-30');
    setAmount('0');
    setPaymentMethod('Boleto Bancário');
    setBankAccountId(accounts[0]?.id || '');
    setRecurrence('Nenhuma');
    setDocumentNumber('');
    setNotes('');
    setAttachmentName('');
    setFormStep(1);
    setIsFormOpen(false);
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !customer || !category || !costCenter) {
      alert('Preencha os campos obrigatórios da primeira etapa.');
      return;
    }
    setFormStep(2);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addAccountReceivable({
      description,
      customer,
      category,
      costCenter,
      competenceMonth,
      issueDate,
      dueDate,
      amount: Number(amount),
      interest: 0,
      penalty: 0,
      discount: 0,
      paymentMethod,
      bankAccountId: bankAccountId || accounts[0]?.id,
      recurrence,
      documentNumber,
      notes,
      attachmentName: attachmentName || undefined,
      attachmentUrl: attachmentName ? '#' : undefined,
      responsibleId: currentUser.id
    });
    resetForm();
  };

  const handleFullReceipt = (id: string, amount: number) => {
    const today = new Date().toISOString().split('T')[0];
    receiveAccountReceivable(id, amount, today);
  };

  const handlePartialReceiptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingId) return;
    const amountVal = Number(receivedAmountVal);
    if (amountVal <= 0) {
      alert('Digite um valor positivo válido.');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    receiveAccountReceivable(receivingId, amountVal, today);
    setReceivingId(null);
    setReceivedAmountVal('');
  };

  const handleCancel = (id: string) => {
    if (window.confirm('Confirmar cancelamento deste recebível?')) {
      cancelAccountReceivable(id);
    }
  };

  return (
    <div id="accounts-receivable-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 id="receivable-title" className="text-xl font-bold text-zinc-900 tracking-tight font-sans">Contas a Receber</h2>
          <p className="text-zinc-500 text-xs font-sans">Controle de faturamentos, geração de boletos, fluxos de recebimento parcial e baixas no banco.</p>
        </div>

        {hasPermission('accounts-receivable.create') && (
          <button
            onClick={() => {
              setBankAccountId(accounts[0]?.id || '');
              setIsFormOpen(true);
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#d20010] hover:bg-[#850000] px-4 py-2.5 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Nova Conta a Receber
          </button>
        )}
      </div>

      {/* Grid Filtering / Searching */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96 font-sans">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por Descrição, Cliente ou Número..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 hover:bg-zinc-100/50 focus:bg-white rounded-lg border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#d20010] transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto font-sans">
          <div className="flex items-center gap-1.5 bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs text-zinc-600">
            <Filter className="h-3.5 w-3.5" />
            <select
              className="bg-transparent font-medium focus:outline-none cursor-pointer"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Todos os Status</option>
              <option value="Emitida">Emitidas</option>
              <option value="Parcialmente recebida">Parcialmente Recebidas</option>
              <option value="Recebida">Recebidas / Liquidadas</option>
              <option value="Vencida">Vencidas</option>
              <option value="Cancelada">Canceladas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Creation Step Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-zinc-100 bg-gradient-to-r from-[#00304c] to-[#d20010] text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Lançar Nova Conta a Receber</h3>
                <p className="text-[10px] text-[#ffefd1]">Dividido em 2 etapas estruturadas de faturamento BPO.</p>
              </div>
              <button onClick={resetForm} className="text-[#ffefd1] hover:text-white font-bold text-xs cursor-pointer">Fechar</button>
            </div>

            <div className="flex bg-[#00304c] border-b border-[#00304c]/20 px-5 py-3.5 text-xs justify-between font-medium">
              <span className={`flex items-center gap-1.5 ${formStep >= 1 ? 'text-white font-extrabold' : 'text-white/40'}`}>
                <span className="h-5 w-5 rounded-full bg-[#d20010] text-white flex items-center justify-center text-[10px] font-black">1</span> Cliente & Classificação
              </span>
              <span className={`flex items-center gap-1.5 ${formStep >= 2 ? 'text-white font-extrabold' : 'text-white/40'}`}>
                <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black ${formStep >= 2 ? 'bg-[#d20010] text-white' : 'bg-[#002236] text-white/40'}`}>2</span> Faturamento & Anexos
              </span>
            </div>

            <form onSubmit={formStep === 2 ? handleSubmit : handleNextStep} className="p-6 space-y-4">
              {/* Step 1 */}
              {formStep === 1 && (
                <div className="space-y-4 animate-in slide-in-from-right-5 duration-150">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 block">Descrição do Faturamento *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Mensalidade Desenvolvimento de Software Julho"
                      className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 block">Cliente / Sacado *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: InterSistemas Corporativos S.A."
                      className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                      value={customer}
                      onChange={(e) => setCustomer(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 block">Categoria Receita *</label>
                      <select
                        required
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg cursor-pointer"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        <option value="">Selecione...</option>
                        <option value="Serviços de Tecnologia">Serviços de Tecnologia</option>
                        <option value="Consultoria TI">Consultoria TI</option>
                        <option value="Eventos Externos">Eventos Externos</option>
                        <option value="Vendas de Produtos">Vendas de Produtos</option>
                        <option value="Apoio e Suporte">Apoio e Suporte</option>
                        <option value="Outros">Outros</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 block">Centro de Custo *</label>
                      <select
                        required
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg cursor-pointer"
                        value={costCenter}
                        onChange={(e) => setCostCenter(e.target.value)}
                      >
                        <option value="">Selecione...</option>
                        <option value="Comercial e Marketing">Comercial e Marketing</option>
                        <option value="Operações e P&D">Operações e P&D</option>
                        <option value="Eventos">Eventos</option>
                        <option value="Geral">Geral</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2 */}
              {formStep === 2 && (
                <div className="space-y-4 animate-in slide-in-from-right-5 duration-150">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 block">Mês Competência</label>
                      <input
                        type="month"
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                        value={competenceMonth}
                        onChange={(e) => setCompetenceMonth(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 block">Data Emissão</label>
                      <input
                        type="date"
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 block">Vencimento *</label>
                      <input
                        type="date"
                        required
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 block">Valor Principal (R$) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 block">Cobrar por Qual Banco *</label>
                      <select
                        required
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg cursor-pointer"
                        value={bankAccountId}
                        onChange={(e) => setBankAccountId(e.target.value)}
                      >
                        {accounts.map(ba => (
                          <option key={ba.id} value={ba.id}>{ba.bankName} - Ag. {ba.agency}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 block">Forma Recebimento</label>
                      <select
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg cursor-pointer"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      >
                        <option value="Boleto Bancário">Boleto Bancário</option>
                        <option value="Pix">Pix / QR code</option>
                        <option value="Transferência Bancária">Transferência (TED/DOC)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 block">Número do Documento / NFe</label>
                      <input
                        type="text"
                        placeholder="Ex: NFe-40291"
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none"
                        value={documentNumber}
                        onChange={(e) => setDocumentNumber(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 block">Fatura PDF Anexa</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Nome do arquivo faturado..."
                        className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none"
                        value={attachmentName}
                        onChange={(e) => setAttachmentName(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setAttachmentName('nota_faturamento_alfa.pdf')}
                        className="text-xs bg-zinc-100 border border-zinc-200 p-2 rounded-lg cursor-pointer text-zinc-700 font-bold flex items-center gap-1 shrink-0"
                      >
                        <Paperclip className="h-3.5 w-3.5" /> Simular
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 block">Instruções de Cobrança / Notas</label>
                    <textarea
                      placeholder="Ex: Juros de 2% ao mês após vencimento."
                      rows={2}
                      className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-between border-t border-zinc-100 pt-4 mt-6">
                {formStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setFormStep(1)}
                    className="text-xs bg-zinc-100 hover:bg-zinc-200 font-bold px-4 py-2 rounded-lg cursor-pointer text-zinc-800"
                  >
                    Voltar Etapa
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs text-zinc-500 hover:text-zinc-950 font-medium px-3 py-2 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="text-xs font-bold bg-zinc-950 hover:bg-zinc-850 text-white px-4 py-2 rounded-lg shadow-xs cursor-pointer"
                  >
                    {formStep === 2 ? 'Lançar Faturamento' : 'Próxima Etapa'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Partial Receipt Pop-up Modal */}
      {receivingId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-100">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Registrar Entrada / Baixa Parcial</h3>
              <p className="text-[10px] text-zinc-400 mt-1">Insira o valor creditado no banco para esta conta.</p>
            </div>
            
            <form onSubmit={handlePartialReceiptSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase block">Valor Creditado (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="Ex: R$ 5.000,00"
                  className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none"
                  value={receivedAmountVal}
                  onChange={(e) => setReceivedAmountVal(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 text-xs pt-2">
                <button
                  type="button"
                  onClick={() => setReceivingId(null)}
                  className="text-zinc-500 font-semibold px-3 py-1.5 hover:text-zinc-900 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 font-bold text-white px-3 py-1.5 rounded-lg cursor-pointer shadow-xs"
                >
                  Confirmar Baixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Table view of receivables */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="p-4 w-6"></th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Descrição Lançamento</th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Cliente</th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Vencimento</th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Valor Faturado</th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Valor Creditado</th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-center">Status</th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-xs">
              {filteredReceivables.map((ar) => {
                const isExpanded = expandedId === ar.id;
                const outstanding = ar.amount - ar.receivedAmount;
                const isOverdue = new Date(ar.dueDate) < new Date() && ar.status !== 'Recebida' && ar.status !== 'Cancelada';

                return (
                  <React.Fragment key={ar.id}>
                    <tr 
                      className={`hover:bg-zinc-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-zinc-50/30' : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : ar.id)}
                    >
                      <td className="p-4 text-center">
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
                      </td>
                      <td className="p-4 font-semibold text-zinc-900">
                        {ar.description}
                        <div className="text-[10px] text-zinc-400 font-normal font-sans">Nº Doc: {ar.documentNumber || 'N/A'} | Categoria: {ar.category}</div>
                      </td>
                      <td className="p-4 text-zinc-600 font-medium">{ar.customer}</td>
                      <td className={`p-4 font-medium ${isOverdue ? 'text-rose-600 font-bold' : 'text-zinc-600'}`}>
                        {new Date(ar.dueDate).toLocaleDateString('pt-BR')}
                        {isOverdue && <span className="text-[9px] bg-rose-50 border border-rose-100 text-rose-600 px-1.5 py-0.5 rounded ml-2 font-bold uppercase tracking-wider">Atrasado</span>}
                      </td>
                      <td className="p-4 text-right font-bold text-zinc-900 font-mono">
                        R$ {ar.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-right font-bold text-emerald-600 font-mono">
                        R$ {ar.receivedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(ar.status)}`}>
                          {ar.status}
                        </span>
                      </td>
                      <td className="p-4 text-right font-sans" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {ar.status !== 'Recebida' && ar.status !== 'Cancelada' && hasPermission('reconciliation.execute') && (
                            <>
                              <button
                                onClick={() => handleFullReceipt(ar.id, outstanding)}
                                className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded border border-emerald-200 cursor-pointer"
                                title="Baixa Total"
                              >
                                Total
                              </button>
                              <button
                                onClick={() => setReceivingId(ar.id)}
                                className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold px-2 py-1 rounded border border-amber-200 cursor-pointer"
                                title="Baixa Parcial"
                              >
                                Parcial
                              </button>
                            </>
                          )}
                          {ar.status !== 'Recebida' && ar.status !== 'Cancelada' && hasPermission('accounts-receivable.cancel') && (
                            <button
                              onClick={() => handleCancel(ar.id)}
                              className="text-[10px] bg-zinc-50 hover:bg-zinc-200 text-zinc-700 font-bold px-2 py-1 rounded border border-zinc-200 cursor-pointer"
                              title="Cancelar Lançamento"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Collapsible details for receivable */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="p-4 bg-zinc-50/50 border-t border-b border-zinc-100">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-zinc-600 font-sans">
                            {/* Value details */}
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                                <DollarSign className="h-3.5 w-3.5" /> Lançamento de Caixa
                              </h4>
                              <div className="space-y-1 bg-white p-3 rounded-lg border border-zinc-200/60 font-mono">
                                <div className="flex justify-between">
                                  <span>Total Faturado:</span>
                                  <span>R$ {ar.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-emerald-600">
                                  <span>Creditado / Recebido:</span>
                                  <span>- R$ {ar.receivedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between font-bold text-zinc-900 border-t border-zinc-100 pt-1 text-sm">
                                  <span>Saldo Restante:</span>
                                  <span>R$ {outstanding.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                              </div>
                            </div>

                            {/* Faturamento options */}
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" /> Classificação Operacional
                              </h4>
                              <div className="space-y-1.5 bg-white p-3 rounded-lg border border-zinc-200/60">
                                <div>
                                  <span className="text-zinc-400 font-medium block text-[9px] uppercase">Forma Recebimento</span>
                                  <span className="font-bold text-zinc-800">{ar.paymentMethod}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-medium block text-[9px] uppercase">Centro de Custo</span>
                                  <span className="font-semibold text-zinc-800">{ar.costCenter}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-medium block text-[9px] uppercase">Compensar na Conta</span>
                                  <span className="font-semibold text-zinc-800">
                                    {bankAccounts.find(ba => ba.id === ar.bankAccountId)?.bankName || 'Itaú'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Documents and audit trail */}
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                                <Paperclip className="h-3.5 w-3.5" /> Faturas e Conciliação
                              </h4>
                              <div className="space-y-2 bg-white p-3 rounded-lg border border-zinc-200/60 font-sans">
                                <div>
                                  <span className="text-zinc-400 font-medium block text-[9px] uppercase">Fatura / Nota Fiscal</span>
                                  {ar.attachmentName ? (
                                    <a 
                                      href="#" 
                                      onClick={(e) => { e.preventDefault(); alert('Visualizando Nota Fiscal via link seguro criptografado...'); }}
                                      className="font-bold text-zinc-900 hover:underline flex items-center gap-1 mt-0.5"
                                    >
                                      <Paperclip className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                                      {ar.attachmentName} <ExternalLink className="h-3 w-3 text-zinc-400" />
                                    </a>
                                  ) : (
                                    <span className="text-zinc-400 italic">Nota Fiscal não anexada</span>
                                  )}
                                </div>

                                {ar.status === 'Recebida' && (
                                  <div>
                                    <span className="text-zinc-400 font-medium block text-[9px] uppercase">Comprovante de Entrada</span>
                                    <span className="text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Liquidado em {new Date(ar.receiptDate || '').toLocaleDateString('pt-BR')}
                                    </span>
                                  </div>
                                )}

                                <div className="border-t border-zinc-100 pt-1.5 text-[10px] text-zinc-400 font-mono leading-tight">
                                  Recebível UUID: {ar.id}<br />
                                  Competência: {ar.competenceMonth}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filteredReceivables.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-400 italic">
                    Nenhuma conta a receber correspondente à busca.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
