/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useBPOState } from '../hooks/useBPOState';
import { BankStatementItem, AccountPayable, AccountReceivable } from '../types';
import { 
  Building2, 
  Upload, 
  Sparkles, 
  ArrowRight, 
  HelpCircle, 
  Check, 
  AlertCircle, 
  CheckCircle,
  Clock,
  RefreshCw,
  Search,
  FileCheck2,
  Trash,
  Ban
} from 'lucide-react';

export default function ReconciliationView() {
  const { 
    activeCompany, 
    bankAccounts, 
    accountsPayable, 
    accountsReceivable, 
    statementItems, 
    importStatement, 
    reconcileItemManually, 
    autoReconcileBank, 
    ignoreStatementItem,
    hasPermission 
  } = useBPOState();

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedStatementItem, setSelectedStatementItem] = useState<BankStatementItem | null>(null);
  
  // Ledger selection search filters for manual matching
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState('');
  const [ledgerType, setLedgerType] = useState<'A_PAGAR' | 'A_RECEBER'>('A_PAGAR');

  if (!activeCompany) return null;

  const accounts = bankAccounts.filter(ba => ba.companyId === activeCompany.id);
  
  // Default to first account if none selected
  const activeAccount = accounts.find(ba => ba.id === selectedAccountId) || accounts[0];
  if (accounts.length > 0 && !selectedAccountId) {
    setSelectedAccountId(accounts[0].id);
  }

  const statementList = activeAccount ? (statementItems[activeAccount.id] || []) : [];
  
  const unReconciledStatementItems = statementList.filter(item => !item.isReconciled);
  const reconciledStatementItems = statementList.filter(item => item.isReconciled);

  // Filter financial options for manual match in accordance with the transaction amount direction
  const payablesOptions = accountsPayable.filter(
    ap => ap.companyId === activeCompany.id && 
    ap.status !== 'Paga' && 
    ap.status !== 'Cancelada' &&
    ap.description.toLowerCase().includes(ledgerSearchTerm.toLowerCase())
  );

  const receivablesOptions = accountsReceivable.filter(
    ar => ar.companyId === activeCompany.id && 
    ar.status !== 'Recebida' && 
    ar.status !== 'Cancelada' &&
    ar.description.toLowerCase().includes(ledgerSearchTerm.toLowerCase())
  );

  const handleImport = () => {
    if (!activeAccount) return;
    importStatement(activeAccount.id);
  };

  const handleAutoReconcile = () => {
    if (!activeAccount) return;
    autoReconcileBank(activeAccount.id);
  };

  const handleManualReconcile = (recordId: string) => {
    if (!activeAccount || !selectedStatementItem) return;

    reconcileItemManually(
      activeAccount.id,
      selectedStatementItem.id,
      recordId,
      ledgerType,
      'Conciliado manualmente no painel BPO'
    );
    setSelectedStatementItem(null);
  };

  const handleIgnore = (itemId: string) => {
    if (!activeAccount) return;
    const reason = prompt('Insira o motivo para ignorar este item do extrato:');
    if (reason) {
      ignoreStatementItem(activeAccount.id, itemId, reason);
    }
  };

  const openManualMatch = (item: BankStatementItem) => {
    setSelectedStatementItem(item);
    setLedgerType(item.amount < 0 ? 'A_PAGAR' : 'A_RECEBER');
    setLedgerSearchTerm('');
  };

  return (
    <div id="reconciliation-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-sans">
        <div>
          <h2 id="recon-title" className="text-xl font-bold text-zinc-900 tracking-tight">Conciliação Bancária</h2>
          <p className="text-zinc-500 text-xs">Confronte o extrato importado do banco (OFX) com os faturamentos e contas a pagar do sistema.</p>
        </div>
      </div>

      {/* Account Selector and Import/Auto Action */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans text-xs">
        <div className="flex items-center gap-3 w-full md:w-96">
          <Building2 className="h-5 w-5 text-zinc-400 shrink-0" />
          <select
            className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 font-bold cursor-pointer text-xs"
            value={selectedAccountId}
            onChange={(e) => {
              setSelectedAccountId(e.target.value);
              setSelectedStatementItem(null);
            }}
          >
            {accounts.map(ba => (
              <option key={ba.id} value={ba.id}>{ba.bankName} - Ag. {ba.agency} - C/C: {ba.accountNumber}</option>
            ))}
          </select>
        </div>

        {activeAccount && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-zinc-500 font-mono font-medium bg-zinc-50 px-3 py-1.5 border border-zinc-200 rounded-lg">
              Saldo no Sistema: <strong>R$ {activeAccount.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
            </span>

            {hasPermission('reconciliation.execute') && (
              <>
                <button
                  onClick={handleImport}
                  className="flex items-center gap-1.5 text-zinc-950 hover:bg-zinc-100 bg-white border border-zinc-200 px-3 py-2 rounded-lg font-bold transition-colors cursor-pointer"
                >
                  <Upload className="h-4 w-4" /> Importar Extrato (OFX)
                </button>

                <button
                  onClick={handleAutoReconcile}
                  className="flex items-center gap-1.5 text-white bg-[#d20010] hover:bg-[#850000] px-3.5 py-2.5 rounded-lg font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" /> Auto-Conciliar Inteligente
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Side-by-side reconciliation zone */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-sans">
        
        {/* Left column: Statement items list */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wide">Lançamentos do Extrato Bancário</h3>
              <p className="text-[10px] text-zinc-400">Clique em qualquer item pendente para realizar o de-para manual com o contas a pagar/receber.</p>
            </div>
            <span className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full font-mono">
              {unReconciledStatementItems.length} Pendentes
            </span>
          </div>

          <div className="divide-y divide-zinc-200 overflow-y-auto max-h-[500px]">
            {unReconciledStatementItems.map(item => {
              const isSelected = selectedStatementItem?.id === item.id;
              const isExpense = item.amount < 0;

              return (
                <div 
                  key={item.id}
                  onClick={() => openManualMatch(item)}
                  className={`p-4 hover:bg-zinc-50/50 cursor-pointer transition-all flex items-center justify-between border-l-4 ${
                    isSelected ? 'border-zinc-900 bg-zinc-50/70' : isExpense ? 'border-rose-400' : 'border-emerald-400'
                  }`}
                >
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-400 font-mono font-bold">{new Date(item.date).toLocaleDateString('pt-BR')}</span>
                      <span className="text-[10px] text-zinc-400 font-mono">Nº: {item.documentNumber || 'N/A'}</span>
                    </div>
                    <p className="text-xs font-semibold text-zinc-800 uppercase leading-snug">{item.description}</p>
                  </div>

                  <div className="text-right shrink-0 space-y-2" onClick={(e) => e.stopPropagation()}>
                    <span className={`text-sm font-bold font-mono block ${isExpense ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {isExpense ? '-' : '+'} R$ {Math.abs(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openManualMatch(item)}
                        className="text-[9px] bg-zinc-100 hover:bg-zinc-950 hover:text-white text-zinc-800 px-1.5 py-0.5 border border-zinc-200 font-bold rounded cursor-pointer"
                      >
                        Vincular
                      </button>
                      <button
                        onClick={() => handleIgnore(item.id)}
                        className="text-[9px] bg-zinc-50 hover:bg-zinc-100 text-zinc-500 px-1.5 py-0.5 font-semibold rounded cursor-pointer"
                        title="Ignorar lançamentos (ex: tarifas)"
                      >
                        Ignorar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {statementList.length === 0 && (
              <div className="p-12 text-center text-zinc-400 text-xs italic space-y-3">
                <AlertCircle className="h-8 w-8 mx-auto text-zinc-300" />
                <p>Nenhum extrato importado para este banco.</p>
                <button
                  onClick={handleImport}
                  className="text-xs bg-zinc-100 border border-zinc-200 hover:bg-zinc-200 px-3 py-1.5 rounded font-bold text-zinc-700 cursor-pointer"
                >
                  Importar OFX do Mês
                </button>
              </div>
            )}

            {statementList.length > 0 && unReconciledStatementItems.length === 0 && (
              <div className="p-12 text-center text-zinc-500 text-xs italic space-y-1.5">
                <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto" />
                <p className="font-bold">Todos os itens deste extrato foram conciliados com sucesso!</p>
                <p className="text-[10px] text-zinc-400">O saldo em conta foi atualizado na contabilidade de BPO.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Interactive matchmaking details */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-xs flex flex-col">
          <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wide">De-Para e Associação Manual</h3>
            {selectedStatementItem && (
              <span className="text-[10px] font-bold bg-amber-50 border border-amber-100 text-amber-800 px-2.5 py-0.5 rounded font-mono">
                Item Selecionado Ativo
              </span>
            )}
          </div>

          <div className="p-5 flex-grow space-y-5 flex flex-col justify-between">
            {!selectedStatementItem ? (
              <div className="my-auto py-12 text-center space-y-3 text-zinc-400 text-xs italic">
                <HelpCircle className="h-10 w-10 text-zinc-300 mx-auto animate-bounce duration-1000" />
                <p className="font-medium font-sans">Selecione um lançamento do extrato bancário na coluna da esquerda para realizar o cruzamento manual de contas.</p>
              </div>
            ) : (
              <div className="space-y-4 flex-grow flex flex-col justify-between h-full animate-in fade-in duration-150">
                {/* Active Statement Item info */}
                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Transação Bancária Selecionada</span>
                  <div className="flex items-center justify-between text-xs font-sans">
                    <div>
                      <h4 className="font-bold text-zinc-900 uppercase">{selectedStatementItem.description}</h4>
                      <span className="text-[10px] text-zinc-400 font-mono">Vencimento Extrato: {new Date(selectedStatementItem.date).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <span className={`text-base font-black font-mono ${selectedStatementItem.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      R$ {Math.abs(selectedStatementItem.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Ledger selector & search */}
                <div className="space-y-3 flex-grow flex flex-col">
                  <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-2">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Lançamentos em Aberto no Sistema</span>
                    <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 text-[10px] font-bold">
                      <button
                        onClick={() => setLedgerType('A_PAGAR')}
                        className={`px-2 py-1 rounded cursor-pointer ${ledgerType === 'A_PAGAR' ? 'bg-white text-zinc-800 shadow-xs' : 'text-zinc-400 hover:text-zinc-600'}`}
                      >
                        Contas a Pagar
                      </button>
                      <button
                        onClick={() => setLedgerType('A_RECEBER')}
                        className={`px-2 py-1 rounded cursor-pointer ${ledgerType === 'A_RECEBER' ? 'bg-white text-zinc-800 shadow-xs' : 'text-zinc-400 hover:text-zinc-600'}`}
                      >
                        Contas a Receber
                      </button>
                    </div>
                  </div>

                  {/* Ledger Search */}
                  <div className="relative">
                    <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-zinc-400" />
                    <input
                      type="text"
                      placeholder={`Buscar lançamentos em aberto em ${ledgerType === 'A_PAGAR' ? 'Contas a Pagar' : 'Contas a Receber'}...`}
                      className="w-full pl-8 pr-2 py-1.5 text-xs bg-zinc-50 hover:bg-zinc-100/50 focus:bg-white rounded-lg border border-zinc-200 focus:outline-none"
                      value={ledgerSearchTerm}
                      onChange={(e) => setLedgerSearchTerm(e.target.value)}
                    />
                  </div>

                  {/* Filtered Ledger list */}
                  <div className="overflow-y-auto max-h-[220px] divide-y divide-zinc-100 border border-zinc-200 rounded-lg flex-grow">
                    {ledgerType === 'A_PAGAR' ? (
                      payablesOptions.map(ap => {
                        const amountMatches = Math.abs(ap.finalAmount - Math.abs(selectedStatementItem.amount)) < 0.01;
                        return (
                          <div 
                            key={ap.id} 
                            onClick={() => handleManualReconcile(ap.id)}
                            className="p-3 hover:bg-zinc-50/50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                          >
                            <div className="space-y-0.5 pr-2">
                              <span className="font-bold text-zinc-800 block truncate max-w-[200px]">{ap.description}</span>
                              <span className="text-[10px] text-zinc-400 font-medium">Favorecido: {ap.supplier} | Venc: {new Date(ap.dueDate).toLocaleDateString('pt-BR')}</span>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="font-bold text-zinc-950 font-mono block">R$ {ap.finalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              {amountMatches && (
                                <span className="text-[8px] bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold font-mono uppercase px-1.5 py-0.5 rounded">
                                  Valor Compatível
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      receivablesOptions.map(ar => {
                        const remaining = ar.amount - ar.receivedAmount;
                        const amountMatches = Math.abs(remaining - Math.abs(selectedStatementItem.amount)) < 0.01;
                        return (
                          <div 
                            key={ar.id} 
                            onClick={() => handleManualReconcile(ar.id)}
                            className="p-3 hover:bg-zinc-50/50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                          >
                            <div className="space-y-0.5 pr-2">
                              <span className="font-bold text-zinc-800 block truncate max-w-[200px]">{ar.description}</span>
                              <span className="text-[10px] text-zinc-400 font-medium">Cliente: {ar.customer} | Venc: {new Date(ar.dueDate).toLocaleDateString('pt-BR')}</span>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="font-bold text-zinc-950 font-mono block">R$ {remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              {amountMatches && (
                                <span className="text-[8px] bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold font-mono uppercase px-1.5 py-0.5 rounded">
                                  Valor Compatível
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}

                    {ledgerType === 'A_PAGAR' && payablesOptions.length === 0 && (
                      <p className="p-6 text-center text-zinc-400 italic font-sans text-xs">Nenhuma conta a pagar encontrada em aberto.</p>
                    )}

                    {ledgerType === 'A_RECEBER' && receivablesOptions.length === 0 && (
                      <p className="p-6 text-center text-zinc-400 italic font-sans text-xs">Nenhum faturamento a receber em aberto.</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs text-zinc-400 pt-2 border-t border-zinc-100 font-sans">
                  <span>Selecione a conta correta acima para vincular e confirmar a conciliação.</span>
                  <button 
                    onClick={() => setSelectedStatementItem(null)}
                    className="text-zinc-500 font-bold hover:underline cursor-pointer"
                  >
                    Fechar painel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
