/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useBPOState } from '../hooks/useBPOState';
import { 
  FileText, 
  Download, 
  Play, 
  Search, 
  Clock, 
  Building2, 
  CalendarDays, 
  ListCollapse, 
  Sparkles,
  BarChart2,
  TableProperties,
  ArrowRight
} from 'lucide-react';

export default function ReportsView() {
  const { 
    activeCompany, 
    reports, 
    generateReport, 
    currentUser, 
    hasPermission 
  } = useBPOState();

  const [selectedReportType, setSelectedReportType] = useState('Fluxo de Caixa');
  const [startDate, setStartDate] = useState('2026-07-01');
  const [endDate, setEndDate] = useState('2026-07-31');
  const [exportFormat, setExportFormat] = useState<'PDF' | 'CSV'>('PDF');

  if (!activeCompany) return null;

  const companyReports = reports.filter(r => r.companyId === activeCompany.id);

  const reportOptions = [
    { name: 'Fluxo de Caixa Realizado vs Projetado', type: 'Fluxo de Caixa', desc: 'Resumo analítico das entradas e saídas e saldo de fechamento projetado.' },
    { name: 'Contas a Pagar Geral', type: 'Contas a Pagar', desc: 'Listagem de todas as faturas a liquidar filtradas por vencimento e status.' },
    { name: 'Contas a Receber Geral', type: 'Contas a Receber', desc: 'Faturamento pendente e liquidações de clientes no período correspondente.' },
    { name: 'Inadimplência de Clientes', type: 'Inadimplência', desc: 'Demonstrativo de faturas vencidas e não pagas organizadas por cliente.' },
    { name: 'DRE Gerencial Simplificada', type: 'DRE', desc: 'Demonstração de Resultado do Exercício com receitas, custos e margem bruta.' },
    { name: 'Conciliação Bancária Periódica', type: 'Conciliação', desc: 'Fechamento de extrato confrontando saldos bancários e registros operacionais.' },
  ];

  const handleCompile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission('reports.generate')) {
      alert('Seu perfil não possui autorização para compilar relatórios.');
      return;
    }

    const filters = `Período: ${new Date(startDate).toLocaleDateString('pt-BR')} até ${new Date(endDate).toLocaleDateString('pt-BR')} | Formato: ${exportFormat}`;
    generateReport(`${selectedReportType} - Fechamento`, selectedReportType, filters);
  };

  const downloadReportFile = (url: string, name: string) => {
    alert(`Transferindo arquivo do Relatório do Servidor:\n\nNome: ${name}\nUrl: ${url}\n\nDownload concluído com sucesso.`);
  };

  return (
    <div id="reports-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 id="reports-title" className="text-xl font-bold text-zinc-900 tracking-tight font-sans">Compilador de Relatórios</h2>
          <p className="text-zinc-500 text-xs font-sans">Gere demonstrativos, DRE, fluxo de caixa consolidado e relatórios para envio à contabilidade.</p>
        </div>
      </div>

      {/* Compiler Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compiler form */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-5 space-y-4 font-sans text-xs">
          <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wide flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-zinc-500" /> Parâmetros de Compilação
          </h3>
          <p className="text-zinc-400 text-[11px]">Selecione um demonstrativo e defina o período desejado para a compilação de dados.</p>

          <form onSubmit={handleCompile} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase block">Modelo de Relatório</label>
              <select
                className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 cursor-pointer"
                value={selectedReportType}
                onChange={(e) => setSelectedReportType(e.target.value)}
              >
                {reportOptions.map(opt => (
                  <option key={opt.type} value={opt.type}>{opt.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase block">Data Inicial</label>
                <input
                  type="date"
                  className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase block">Data Final</label>
                <input
                  type="date"
                  className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase block">Formato de Exportação</label>
              <div className="flex gap-2">
                <label className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 w-full cursor-pointer hover:bg-zinc-100/50 transition-colors">
                  <input
                    type="radio"
                    name="format"
                    checked={exportFormat === 'PDF'}
                    onChange={() => setExportFormat('PDF')}
                    className="cursor-pointer"
                  />
                  <span className="font-bold text-zinc-800">Formato PDF (.pdf)</span>
                </label>
                <label className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 w-full cursor-pointer hover:bg-zinc-100/50 transition-colors">
                  <input
                    type="radio"
                    name="format"
                    checked={exportFormat === 'CSV'}
                    onChange={() => setExportFormat('CSV')}
                    className="cursor-pointer"
                  />
                  <span className="font-bold text-zinc-800">Planilha CSV (.csv)</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={!hasPermission('reports.generate')}
              className="w-full font-bold text-white bg-[#C8102E] hover:bg-[#8F071B] disabled:bg-zinc-300 disabled:text-zinc-500 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <Play className="h-4 w-4 fill-white" />
              Compilar e Gerar Relatório
            </button>
          </form>
        </div>

        {/* Templates Details area */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-zinc-200 p-5 space-y-4 font-sans">
          <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wide">Modelos Disponíveis e Fórmulas</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-zinc-600">
            {reportOptions.map((opt, i) => (
              <div key={i} className="p-3.5 bg-zinc-50 hover:bg-zinc-50/80 transition-colors rounded-lg border border-zinc-200/60 flex items-start gap-3">
                <div className="p-2 bg-zinc-100 text-zinc-700 rounded-lg mt-0.5 border border-zinc-200">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-zinc-900">{opt.name}</h4>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">{opt.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Generated Reports log list */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-5 space-y-4">
        <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wide font-sans">Histórico de Relatórios Compilados</h3>
        
        <div className="overflow-x-auto font-sans text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="p-3 text-zinc-500 font-bold uppercase">Relatório</th>
                <th className="p-3 text-zinc-500 font-bold uppercase">Tipo</th>
                <th className="p-3 text-zinc-500 font-bold uppercase">Parâmetros Aplicados</th>
                <th className="p-3 text-zinc-500 font-bold uppercase">Gerado por</th>
                <th className="p-3 text-zinc-500 font-bold uppercase">Data Compilação</th>
                <th className="p-3 text-zinc-500 font-bold uppercase text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {companyReports.map(rep => (
                <tr key={rep.id} className="hover:bg-zinc-50/50 transition-colors font-sans">
                  <td className="p-3 font-bold text-zinc-900 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-zinc-400 shrink-0" />
                    {rep.name}
                  </td>
                  <td className="p-3 font-medium text-zinc-600">{rep.type}</td>
                  <td className="p-3 text-zinc-400 max-w-xs truncate">{rep.filters}</td>
                  <td className="p-3 text-zinc-500 font-medium">{rep.generatedByName}</td>
                  <td className="p-3 text-zinc-500">{new Date(rep.generatedAt).toLocaleString('pt-BR')}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => downloadReportFile(rep.fileUrl, rep.name)}
                      className="text-xs bg-zinc-100 hover:bg-zinc-950 hover:text-white text-zinc-800 px-3 py-1.5 rounded font-bold border border-zinc-200 transition-colors cursor-pointer flex items-center gap-1 inline-flex"
                    >
                      <Download className="h-3.5 w-3.5" /> Baixar ({rep.fileSize})
                    </button>
                  </td>
                </tr>
              ))}
              {companyReports.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-400 italic">
                    Nenhum relatório compilado na sessão recente. Use o painel acima para gerar um novo.
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
