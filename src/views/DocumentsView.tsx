/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { useBPOState } from '../hooks/useBPOState';
import { Document } from '../types';
import { 
  Upload, 
  Search, 
  Filter, 
  FileText, 
  Download, 
  Trash2, 
  Paperclip, 
  ShieldAlert, 
  Layers, 
  Database,
  ArrowRight,
  Sparkles,
  RefreshCw,
  FolderOpen
} from 'lucide-react';

export default function DocumentsView() {
  const { 
    activeCompany, 
    documents, 
    uploadDocument, 
    deleteDocument, 
    currentUser,
    hasPermission 
  } = useBPOState();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  
  // Drag and drop states
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload simulated states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [simulatedFileName, setSimulatedFileName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Document['category']>('Nota fiscal');
  const [docDescription, setDocDescription] = useState('');

  if (!activeCompany) return null;

  const companyDocs = documents.filter(d => d.companyId === activeCompany.id);

  const filteredDocs = companyDocs.filter(doc => {
    const matchesSearch = 
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || doc.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  // Handle Drag Over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (hasPermission('documents.upload')) {
      setIsDragging(true);
    }
  };

  // Handle Drag Leave
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Process File upload helper
  const processUpload = (name: string, sizeBytes: number, type: string) => {
    setIsUploading(true);
    setUploadProgress(10);
    setSimulatedFileName(name);

    // Simulate progress tick
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          
          // Complete the upload state
          setTimeout(() => {
            const sizeKB = (sizeBytes / 1024).toFixed(0);
            const formattedSize = Number(sizeKB) > 1024 
              ? (Number(sizeKB) / 1024).toFixed(1) + ' MB' 
              : sizeKB + ' KB';

            uploadDocument({
              name,
              category: selectedCategory,
              description: docDescription || `Documento operacional do mês de faturamento de ${activeCompany.tradeName}.`,
              competenceMonth: '2026-07',
              fileSize: formattedSize,
              mimeType: type || 'application/pdf',
            });

            setIsUploading(false);
            setUploadProgress(0);
            setSimulatedFileName('');
            setDocDescription('');
          }, 400);

          return 100;
        }
        return prev + 30;
      });
    }, 150);
  };

  // Handle Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!hasPermission('documents.upload')) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      processUpload(file.name, file.size, file.type);
    }
  };

  // Handle Click select
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      processUpload(file.name, file.size, file.type);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDownload = (doc: Document) => {
    alert(`Gerando Link Assinado Temporário para S3 Schedulers:\n\nUrl: ${doc.signedUrl}\n\nToken válido por 15 minutos.`);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o documento "${name}"? Esta ação gerará um log de auditoria.`)) {
      deleteDocument(id);
    }
  };

  return (
    <div id="documents-root" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 id="docs-title" className="text-xl font-bold text-zinc-900 tracking-tight font-sans">Gestor de Documentos</h2>
          <p className="text-zinc-500 text-xs font-sans">Repositório seguro isolado por empresa. Armazene notas fiscais, boletos e extratos mensais.</p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-100 border border-zinc-200 px-3 py-1.5 rounded-lg font-mono">
          <Database className="h-3.5 w-3.5" />
          Armazenamento: AWS S3 Encriptado
        </div>
      </div>

      {/* Upload Zone & Form */}
      {hasPermission('documents.upload') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form setup for classification */}
          <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-5 space-y-4 font-sans text-xs">
            <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wide">Classificação Pré-envio</h3>
            <p className="text-zinc-400 text-[11px]">Selecione a categoria e insira a descrição antes de realizar o upload para classificar o arquivo adequadamente.</p>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase block">Categoria de Destino</label>
              <select
                className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 cursor-pointer"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as any)}
              >
                <option value="Nota fiscal">Nota fiscal (NFe)</option>
                <option value="Boleto">Boleto Bancário</option>
                <option value="Comprovante">Comprovante de Pagamento</option>
                <option value="Extrato">Extrato Bancário</option>
                <option value="Contrato">Contrato de Serviço</option>
                <option value="Recibo">Recibo / Fatura avulsa</option>
                <option value="Documento contábil">Documento Contábil</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase block">Descrição do Arquivo</label>
              <textarea
                placeholder="Ex: NF de assessoria mensal de marketing..."
                rows={3}
                className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 text-xs"
                value={docDescription}
                onChange={(e) => setDocDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Interactive Drag & Drop Area */}
          <div className="lg:col-span-2">
            <div
              id="upload-dropzone"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              className={`h-full min-h-[200px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all ${
                isDragging 
                  ? 'border-zinc-900 bg-zinc-100/80 scale-[0.99]' 
                  : 'border-zinc-200 bg-white hover:bg-zinc-50/50 hover:border-zinc-300'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileSelect}
                accept=".pdf,.png,.jpg,.jpeg,.ofx,.xlsx,.csv,.xml"
              />

              {isUploading ? (
                <div className="space-y-3 w-full max-w-xs animate-pulse">
                  <RefreshCw className="h-8 w-8 text-zinc-600 animate-spin mx-auto" />
                  <div>
                    <h4 className="text-xs font-bold text-zinc-800">Transmitindo {simulatedFileName}</h4>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Calculando hashes SHA-256 e compactando...</p>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-zinc-900 h-full transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono font-bold">{uploadProgress}%</span>
                </div>
              ) : (
                <div className="space-y-3 font-sans">
                  <div className="p-3 bg-zinc-100 text-zinc-700 rounded-full inline-block">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900">Arraste e solte o documento aqui</h4>
                    <p className="text-xs text-zinc-400 mt-1">Ou clique para selecionar arquivos do seu computador.</p>
                  </div>
                  <p className="text-[10px] text-zinc-400">Suporta PDF, OFX, XML, PNG, JPG, XLSX até 15MB. Classificação ativa: <strong>{selectedCategory}</strong></p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96 font-sans">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por nome do arquivo ou descrição..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 hover:bg-zinc-100/50 focus:bg-white rounded-lg border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto font-sans">
          <div className="flex items-center gap-1.5 bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs text-zinc-600">
            <Layers className="h-3.5 w-3.5" />
            <select
              className="bg-transparent font-medium focus:outline-none cursor-pointer"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">Todas as Categorias</option>
              <option value="Nota fiscal">Nota fiscal (NFe)</option>
              <option value="Boleto">Boleto Bancário</option>
              <option value="Comprovante">Comprovantes</option>
              <option value="Extrato">Extratos Bancários</option>
              <option value="Contrato">Contratos</option>
              <option value="Documento contábil">Documentos Contábeis</option>
            </select>
          </div>
        </div>
      </div>

      {/* Documents List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.length === 0 ? (
          <div className="col-span-full bg-zinc-50 border border-zinc-200 border-dashed py-12 rounded-xl text-center space-y-2">
            <FolderOpen className="h-10 w-10 text-zinc-300 mx-auto" />
            <p className="text-zinc-500 text-sm font-medium">Nenhum documento encontrado.</p>
            <p className="text-zinc-400 text-xs">Realize um upload ou mude os filtros de busca.</p>
          </div>
        ) : (
          filteredDocs.map(doc => (
            <div 
              key={doc.id} 
              id={`doc-card-${doc.id}`}
              className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs hover:border-zinc-300 transition-colors flex flex-col justify-between"
            >
              <div className="p-5 space-y-3.5">
                {/* Header info */}
                <div className="flex items-start justify-between gap-2 font-sans">
                  <div className="space-y-1">
                    <span className="text-[9px] bg-zinc-100 text-zinc-600 border border-zinc-200 font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wider">
                      {doc.category}
                    </span>
                    <h3 className="text-xs font-bold text-zinc-900 line-clamp-1 mt-1.5" title={doc.name}>{doc.name}</h3>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono shrink-0">{doc.fileSize}</span>
                </div>

                <p className="text-zinc-500 text-xs line-clamp-2 leading-relaxed font-sans">{doc.description}</p>

                {/* Audit Hash information */}
                <div className="p-2 bg-zinc-50 rounded-lg font-mono text-[9px] text-zinc-400 break-all leading-normal border border-zinc-100">
                  SHA-256 HASH: {doc.hash.substring(0, 32)}...
                </div>
              </div>

              {/* Action bar */}
              <div className="px-4 py-3 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between text-xs font-sans">
                <span className="text-zinc-400 font-medium">Enviado por: {doc.uploadedByName.split(' ')[0]}</span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-1.5 hover:bg-zinc-200 rounded text-zinc-700 cursor-pointer"
                    title="Baixar via URL assinada"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  {hasPermission('documents.upload') && (
                    <button
                      onClick={() => handleDelete(doc.id, doc.name)}
                      className="p-1.5 hover:bg-rose-100 rounded text-rose-600 cursor-pointer"
                      title="Deletar documento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
