import React, { useEffect, useMemo, useRef, useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import { Document } from "../types";
import { analyzeDocumentVisually } from "../services/documentAnalysis";
import FileTypeIcon from "../components/FileTypeIcon";
import {
  Bot,
  Check,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  Filter,
  FolderOpen,
  Loader2,
  MessageSquare,
  Paperclip,
  Pencil,
  Save,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

interface PendingAnalysis {
  file: File;
  category: Document["category"];
  summary: string;
  competenceMonth: string;
  formattedSize: string;
  confidence: number;
  extractedData: Record<string, string>;
  supplier: string;
  dueDate: string;
  expenseType: string;
  companyId: string;
  documentNumber: string;
  amount: number;
  warnings: string[];
  source: "visual-ai" | "local-fallback";
}

const CATEGORIES: Document["category"][] = [
  "Nota fiscal",
  "Boleto",
  "Comprovante",
  "Extrato",
  "Contrato",
  "Recibo",
  "Relatório",
  "Documento contábil",
  "Outros",
];

function identifyCategory(fileName: string): Document["category"] {
  const name = fileName.toLocaleLowerCase("pt-BR");
  if (/boleto|cobranca|cobrança/.test(name)) return "Boleto";
  if (/nota|nfe|nf-|nf_/.test(name)) return "Nota fiscal";
  if (/comprovante|pix|pagamento/.test(name)) return "Comprovante";
  if (/extrato|ofx/.test(name)) return "Extrato";
  if (/contrato/.test(name)) return "Contrato";
  if (/recibo/.test(name)) return "Recibo";
  if (/relatorio|relatório|dre/.test(name)) return "Relatório";
  if (/contabil|contábil|balancete/.test(name)) return "Documento contábil";
  return "Outros";
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () =>
      reject(new Error("Não foi possível preparar o arquivo para envio."));
    reader.readAsDataURL(file);
  });
}

function inferDocumentDetails(fileName: string) {
  const name = fileName.toLocaleLowerCase("pt-BR");
  const rules = [
    {
      pattern: /aluguel|locacao|locação/,
      supplier: "Imobiliária / Locador",
      expenseType: "Aluguel e ocupação",
    },
    {
      pattern: /energia|eletric/,
      supplier: "Concessionária de energia",
      expenseType: "Energia elétrica",
    },
    {
      pattern: /telefone|telefonia|internet/,
      supplier: "Operadora de telecomunicações",
      expenseType: "Telefonia e internet",
    },
    {
      pattern: /aws|amazon/,
      supplier: "Amazon Web Services",
      expenseType: "Tecnologia e infraestrutura",
    },
    {
      pattern: /marketing|publicidade/,
      supplier: "Fornecedor de marketing",
      expenseType: "Marketing e publicidade",
    },
    {
      pattern: /imposto|tributo|das|darf/,
      supplier: "Órgão arrecadador",
      expenseType: "Impostos e tributos",
    },
    {
      pattern: /limpeza|conservacao|conservação/,
      supplier: "Fornecedor de serviços",
      expenseType: "Limpeza e conservação",
    },
  ];
  const match = rules.find((rule) => rule.pattern.test(name));
  const brDate = name.match(/(\d{2})[-_.](\d{2})[-_.](\d{4})/);
  const isoDate = name.match(/(\d{4})[-_.](\d{2})[-_.](\d{2})/);
  return {
    supplier: match?.supplier || "A confirmar",
    expenseType: match?.expenseType || "Outras despesas",
    dueDate: brDate
      ? `${brDate[3]}-${brDate[2]}-${brDate[1]}`
      : isoDate
        ? `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`
        : "",
  };
}

export default function DocumentsView() {
  const {
    activeCompany,
    companies,
    documents,
    uploadDocument,
    deleteDocument,
    currentUser,
    hasPermission,
  } = useBPOState();
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | Document["status"]>(
    "ALL",
  );
  const [pending, setPending] = useState<PendingAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatPrompt, setChatPrompt] = useState("");
  const [error, setError] = useState("");
  const [editingAnalysis, setEditingAnalysis] = useState(false);
  const [visualAiAvailable, setVisualAiAvailable] = useState<boolean | null>(
    null,
  );
  const [maxDocumentSize, setMaxDocumentSize] = useState(20 * 1024 * 1024);
  const [persistentUploads, setPersistentUploads] = useState(false);

  useEffect(() => {
    fetch("/api/documents/status")
      .then(async (response) =>
        response.ok
          ? (response.json() as Promise<{
              available: boolean;
              maxFileSize?: number;
              persistentUploads?: boolean;
            }>)
          : {
              available: false,
              maxFileSize: undefined,
              persistentUploads: false,
            },
      )
      .then((status) => {
        setVisualAiAvailable(status.available);
        if (status.maxFileSize) setMaxDocumentSize(status.maxFileSize);
        setPersistentUploads(Boolean(status.persistentUploads));
      })
      .catch(() => {
        setVisualAiAvailable(false);
        setPersistentUploads(false);
      });
  }, []);

  const availableCompanies =
    currentUser.role === "BPO_ADMIN"
      ? companies
      : companies.filter((company) =>
          currentUser.companies?.includes(company.id),
        );

  const companyDocuments = useMemo(
    () =>
      documents
        .filter((document) => document.companyId === activeCompany?.id)
        .sort(
          (first, second) =>
            new Date(second.uploadedAt).getTime() -
            new Date(first.uploadedAt).getTime(),
        ),
    [activeCompany?.id, documents],
  );

  const filteredDocuments = companyDocuments.filter((document) => {
    const query = search.toLocaleLowerCase("pt-BR");
    const matchesSearch =
      !query ||
      `${document.name} ${document.description} ${document.category} ${document.uploadedByName}`
        .toLocaleLowerCase("pt-BR")
        .includes(query);
    return (
      matchesSearch &&
      (statusFilter === "ALL" || document.status === statusFilter)
    );
  });

  if (!activeCompany) return null;

  const analyzeFile = async (file: File) => {
    setError("");
    if (file.size > maxDocumentSize) {
      setError(`O arquivo excede o limite de ${formatSize(maxDocumentSize)}.`);
      return;
    }
    setIsAnalyzing(true);
    setPending(null);
    const now = new Date();
    const defaultCompetence = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const details = inferDocumentDetails(file.name);
    const formattedSize = formatSize(file.size);
    const context = chatPrompt.trim();

    try {
      const analysis = await analyzeDocumentVisually(
        file,
        activeCompany.tradeName,
        context,
      );
      const matchedCompany = availableCompanies.find(
        (company) =>
          company.tradeName.toLocaleLowerCase("pt-BR") ===
            analysis.companyName.toLocaleLowerCase("pt-BR") ||
          company.corporateName.toLocaleLowerCase("pt-BR") ===
            analysis.companyName.toLocaleLowerCase("pt-BR"),
      );
      setPending({
        file,
        formattedSize,
        source: "visual-ai",
        category: analysis.documentType,
        competenceMonth: analysis.competenceMonth || defaultCompetence,
        confidence: Math.round(analysis.confidence),
        summary: analysis.summary,
        supplier: analysis.supplier || "A confirmar",
        dueDate: analysis.dueDate || "",
        expenseType: analysis.expenseType || "A confirmar",
        companyId: matchedCompany?.id || activeCompany.id,
        documentNumber: analysis.documentNumber || "",
        amount: Number(analysis.amount) || 0,
        warnings: analysis.warnings || [],
        extractedData: {
          "Tipo identificado": analysis.documentType,
          Fornecedor: analysis.supplier || "A confirmar",
          Vencimento: analysis.dueDate || "A confirmar",
          "Tipo de despesa": analysis.expenseType || "A confirmar",
          Empresa: matchedCompany?.tradeName || activeCompany.tradeName,
          Valor: analysis.amount
            ? `${analysis.currency || "BRL"} ${Number(analysis.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
            : "A confirmar",
          Documento: analysis.documentNumber || "A confirmar",
          Competência: analysis.competenceMonth || defaultCompetence,
          Formato:
            file.type ||
            file.name.split(".").pop()?.toUpperCase() ||
            "Desconhecido",
          Tamanho: formattedSize,
          "Enviado por": currentUser.name,
        },
      });
    } catch (reason) {
      const category = identifyCategory(file.name);
      const fallbackMessage =
        reason instanceof Error
          ? reason.message
          : "Análise visual indisponível.";
      setPending({
        file,
        category,
        competenceMonth: defaultCompetence,
        formattedSize,
        source: "local-fallback",
        confidence: category === "Outros" ? 30 : 55,
        summary: `${category} classificado apenas pelos dados do arquivo. Revise todos os campos antes de incluir.`,
        supplier: details.supplier,
        dueDate: details.dueDate,
        expenseType: details.expenseType,
        companyId: activeCompany.id,
        documentNumber: "",
        amount: 0,
        warnings: [
          fallbackMessage,
          "A leitura visual generativa não foi utilizada; os valores abaixo são sugestões locais.",
        ],
        extractedData: {
          "Tipo identificado": category,
          Fornecedor: details.supplier,
          Vencimento: details.dueDate || "A confirmar",
          "Tipo de despesa": details.expenseType,
          Empresa: activeCompany.tradeName,
          Competência: defaultCompetence,
          Formato:
            file.type ||
            file.name.split(".").pop()?.toUpperCase() ||
            "Desconhecido",
          Tamanho: formattedSize,
          "Enviado por": currentUser.name,
        },
      });
    } finally {
      setChatPrompt("");
      setEditingAnalysis(false);
      setIsAnalyzing(false);
    }
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) analyzeFile(file);
    event.target.value = "";
  };

  const confirmDocument = async () => {
    if (!pending) return;
    setError("");
    setIsAnalyzing(true);
    try {
      let previewUrl: string | undefined;
      const storageWarnings = [...pending.warnings];
      if (persistentUploads) {
        const data = await readFileAsBase64(pending.file);
        const response = await fetch("/api/documents/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data,
            fileName: pending.file.name,
            mimeType: pending.file.type,
          }),
        });
        const result = (await response.json()) as {
          url?: string;
          error?: string;
        };
        if (!response.ok || !result.url)
          throw new Error(
            result.error || "Não foi possível armazenar o arquivo.",
          );
        previewUrl = result.url;
      } else {
        storageWarnings.push(
          "Neste deploy, somente os dados extraídos são mantidos no navegador; o arquivo original não é armazenado.",
        );
      }
      uploadDocument({
        name: pending.file.name,
        description: pending.summary,
        category: pending.category,
        competenceMonth: pending.competenceMonth,
        fileSize: pending.formattedSize,
        mimeType: pending.file.type || "application/octet-stream",
        aiSummary: pending.summary,
        processingConfidence: pending.confidence,
        companyId: pending.companyId,
        supplier: pending.supplier,
        dueDate: pending.dueDate,
        expenseType: pending.expenseType,
        documentNumber: pending.documentNumber,
        amount: pending.amount,
        analysisWarnings: storageWarnings,
        previewUrl,
        extractedData: {
          ...pending.extractedData,
          "Tipo identificado": pending.category,
          Fornecedor: pending.supplier,
          Vencimento: pending.dueDate || "A confirmar",
          "Tipo de despesa": pending.expenseType,
          Valor: pending.amount
            ? `R$ ${pending.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
            : "A confirmar",
          Documento: pending.documentNumber || "A confirmar",
          Empresa:
            companies.find((company) => company.id === pending.companyId)
              ?.tradeName || activeCompany.tradeName,
        },
      });
      setPending(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Falha ao enviar o documento.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDelete = (document: Document) => {
    if (
      window.confirm(
        `Excluir “${document.name}”? Esta ação ficará registrada nos logs.`,
      )
    )
      deleteDocument(document.id);
  };

  const included = companyDocuments.filter(
    (document) => document.status === "Lançado",
  ).length;
  const pendingCount = companyDocuments.filter(
    (document) => document.status === "Aguardando Análise",
  ).length;
  const rejectedCount = companyDocuments.filter(
    (document) => document.status === "Cancelado",
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">
            Central de Documentos
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Envie documentos para leitura da IA e acompanhe o pré-lançamento.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-500 bg-white border border-zinc-200 rounded-lg px-3 py-2">
          <Database className="h-3.5 w-3.5 text-[#0B2C52]" /> Repositório da{" "}
          {activeCompany.tradeName}
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.9fr)] gap-5 items-start">
        <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm min-h-[680px] flex flex-col">
          <div className="p-4 border-b border-zinc-200 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[#F2D3A0]/35 flex items-center justify-center">
              <Bot className="h-5 w-5 text-[#0B2C52]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold">Assistente de Documentos</h3>
                <span
                  className={`text-[9px] font-bold ${visualAiAvailable ? "text-emerald-600" : visualAiAvailable === false ? "text-amber-600" : "text-zinc-400"}`}
                >
                  ●{" "}
                  {visualAiAvailable
                    ? "IA visual ativa"
                    : visualAiAvailable === false
                      ? "IA não configurada"
                      : "Verificando IA..."}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500">
                Identifica, organiza e resume arquivos antes da inclusão.
              </p>
            </div>
          </div>

          <div className="flex-1 bg-zinc-50/60 p-5 space-y-4 overflow-y-auto max-h-[570px]">
            <div className="flex items-start gap-2">
              <div className="h-8 w-8 rounded-full bg-[#F2D3A0]/35 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-white border border-zinc-200 rounded-xl rounded-tl-sm p-3 max-w-[82%]">
                <p className="text-xs text-zinc-700">
                  Olá! Envie boletos, notas fiscais, comprovantes, extratos ou
                  contratos. Vou identificar o arquivo, preparar um resumo e
                  mostrar os dados para sua confirmação.
                </p>
              </div>
            </div>

            {companyDocuments
              .slice(0, 3)
              .reverse()
              .map((document) => (
                <div key={`chat-${document.id}`} className="space-y-2">
                  <div className="flex justify-end">
                    <div className="bg-[#0B2C52] text-white rounded-xl rounded-tr-sm px-3 py-2 max-w-[78%]">
                      <p className="text-xs">
                        Documento enviado: <strong>{document.name}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="h-8 w-8 rounded-full bg-[#F2D3A0]/35 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl rounded-tl-sm p-3 max-w-[85%]">
                      <p className="text-[10px] text-emerald-700 font-black flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> DOCUMENTO
                        INCLUÍDO
                      </p>
                      <p className="text-xs text-zinc-700 mt-1">
                        {document.aiSummary || document.description}
                      </p>
                      <p className="text-[9px] text-zinc-400 mt-2">
                        {new Date(document.uploadedAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

            {isAnalyzing && (
              <div className="flex items-center gap-2 text-xs text-zinc-500 bg-white border rounded-xl p-4 w-fit">
                <Loader2 className="h-4 w-4 animate-spin text-[#C8102E]" />{" "}
                Lendo e classificando o documento...
              </div>
            )}

            {pending && (
              <div className="flex items-start gap-2">
                <div className="h-8 w-8 rounded-full bg-[#F2D3A0]/35 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-[#C8102E]" />
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl rounded-tl-sm p-4 w-full max-w-[92%] space-y-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="text-[10px] text-emerald-700 font-black">
                        DOCUMENTO RECEBIDO E ANALISADO
                      </p>
                      <h4 className="text-xs font-bold mt-1 break-all">
                        {pending.file.name}
                      </h4>
                    </div>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 h-fit px-2 py-1 rounded-full">
                      Confiança {pending.confidence}%
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    {pending.summary}
                  </p>
                  <div
                    className={`text-[10px] font-bold rounded-lg px-3 py-2 ${pending.source === "visual-ai" ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-amber-50 text-amber-700 border border-amber-200"}`}
                  >
                    {pending.source === "visual-ai"
                      ? "Leitura visual generativa aplicada ao conteúdo do documento."
                      : "Fallback local aplicado — revise os campos manualmente."}
                  </div>
                  {pending.warnings.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-[9px] font-black text-amber-700 uppercase">
                        Atenções da leitura
                      </p>
                      {pending.warnings.map((warning) => (
                        <p
                          key={warning}
                          className="text-[10px] text-amber-800 mt-1"
                        >
                          • {warning}
                        </p>
                      ))}
                    </div>
                  )}

                  {editingAnalysis ? (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="text-[10px] font-bold text-zinc-500">
                        Tipo de documento
                        <select
                          value={pending.category}
                          onChange={(event) =>
                            setPending({
                              ...pending,
                              category: event.target
                                .value as Document["category"],
                            })
                          }
                          className="mt-1 w-full border border-zinc-200 rounded-lg p-2 text-xs bg-white"
                        >
                          {CATEGORIES.map((category) => (
                            <option key={category}>{category}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[10px] font-bold text-zinc-500">
                        Fornecedor
                        <input
                          value={pending.supplier}
                          onChange={(event) =>
                            setPending({
                              ...pending,
                              supplier: event.target.value,
                            })
                          }
                          className="mt-1 w-full border border-zinc-200 rounded-lg p-2 text-xs"
                        />
                      </label>
                      <label className="text-[10px] font-bold text-zinc-500">
                        Vencimento
                        <input
                          type="date"
                          value={pending.dueDate}
                          onChange={(event) =>
                            setPending({
                              ...pending,
                              dueDate: event.target.value,
                            })
                          }
                          className="mt-1 w-full border border-zinc-200 rounded-lg p-2 text-xs"
                        />
                      </label>
                      <label className="text-[10px] font-bold text-zinc-500">
                        Tipo de despesa
                        <input
                          value={pending.expenseType}
                          onChange={(event) =>
                            setPending({
                              ...pending,
                              expenseType: event.target.value,
                            })
                          }
                          className="mt-1 w-full border border-zinc-200 rounded-lg p-2 text-xs"
                        />
                      </label>
                      <label className="text-[10px] font-bold text-zinc-500">
                        Número do documento
                        <input
                          value={pending.documentNumber}
                          onChange={(event) =>
                            setPending({
                              ...pending,
                              documentNumber: event.target.value,
                            })
                          }
                          className="mt-1 w-full border border-zinc-200 rounded-lg p-2 text-xs"
                        />
                      </label>
                      <label className="text-[10px] font-bold text-zinc-500">
                        Valor
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={pending.amount || ""}
                          onChange={(event) =>
                            setPending({
                              ...pending,
                              amount: Number(event.target.value) || 0,
                            })
                          }
                          className="mt-1 w-full border border-zinc-200 rounded-lg p-2 text-xs"
                        />
                      </label>
                      <label className="text-[10px] font-bold text-zinc-500 sm:col-span-2">
                        Empresa
                        <select
                          value={pending.companyId}
                          onChange={(event) =>
                            setPending({
                              ...pending,
                              companyId: event.target.value,
                            })
                          }
                          className="mt-1 w-full border border-zinc-200 rounded-lg p-2 text-xs bg-white"
                        >
                          {availableCompanies.map((company) => (
                            <option key={company.id} value={company.id}>
                              {company.tradeName}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-2">
                      {[
                        ["Tipo de documento", pending.category],
                        ["Fornecedor", pending.supplier],
                        [
                          "Vencimento",
                          pending.dueDate
                            ? new Date(
                                `${pending.dueDate}T12:00:00`,
                              ).toLocaleDateString("pt-BR")
                            : "A confirmar",
                        ],
                        ["Tipo de despesa", pending.expenseType],
                        [
                          "Número do documento",
                          pending.documentNumber || "A confirmar",
                        ],
                        [
                          "Valor",
                          pending.amount
                            ? `R$ ${pending.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                            : "A confirmar",
                        ],
                        [
                          "Empresa",
                          companies.find(
                            (company) => company.id === pending.companyId,
                          )?.tradeName || activeCompany.tradeName,
                        ],
                        ["Competência", pending.competenceMonth],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="bg-zinc-50 border border-zinc-100 rounded-lg p-2"
                        >
                          <span className="text-[9px] text-zinc-400 font-bold block">
                            {label}
                          </span>
                          <span className="text-[10px] text-zinc-800 font-semibold">
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {editingAnalysis ? (
                      <button
                        onClick={() => setEditingAnalysis(false)}
                        className="flex items-center gap-1.5 bg-[#0B2C52] text-white text-xs font-bold px-3 py-2 rounded-lg cursor-pointer"
                      >
                        <Save className="h-4 w-4" /> Salvar informações
                      </button>
                    ) : (
                      <button
                        onClick={() => setEditingAnalysis(true)}
                        className="flex items-center gap-1.5 border border-zinc-200 text-zinc-700 text-xs font-bold px-3 py-2 rounded-lg cursor-pointer"
                      >
                        <Pencil className="h-4 w-4" /> Editar informações
                      </button>
                    )}
                    <button
                      onClick={confirmDocument}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg cursor-pointer"
                    >
                      <Check className="h-4 w-4" /> Incluir documento
                    </button>
                    <button
                      onClick={() => {
                        setPending(null);
                        setEditingAnalysis(false);
                      }}
                      className="flex items-center gap-1.5 border border-zinc-200 text-zinc-600 text-xs font-bold px-3 py-2 rounded-lg cursor-pointer"
                    >
                      <X className="h-4 w-4" /> Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}
          </div>

          {hasPermission("documents.upload") && (
            <div className="p-4 border-t border-zinc-200">
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.heic,.ofx,.xml,.xlsx,.csv"
                className="hidden"
                onChange={handleFileInput}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={isAnalyzing}
                  title="Anexar documento"
                  className="p-2.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 cursor-pointer"
                >
                  <Paperclip className="h-4 w-4 text-zinc-600" />
                </button>
                <input
                  value={chatPrompt}
                  onChange={(event) => setChatPrompt(event.target.value)}
                  placeholder="Escreva um contexto e anexe o documento..."
                  className="flex-1 border border-zinc-200 rounded-lg px-3 text-xs focus:outline-none focus:border-[#0B2C52]"
                />
                <button
                  onClick={() => inputRef.current?.click()}
                  className="p-2.5 bg-[#0B2C52] text-white rounded-lg cursor-pointer"
                  title="Selecionar arquivo para enviar"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[9px] text-zinc-400 mt-2">
                PDF, JPG, PNG, HEIC, OFX, XML, XLSX e CSV · máximo de{" "}
                {formatSize(maxDocumentSize)}
                {!persistentUploads &&
                  " · no acesso remoto, o arquivo original não é persistido"}
              </p>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-zinc-200">
              <h3 className="text-sm font-bold">Histórico de Documentos</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                Inclusões e informações desta empresa.
              </p>
            </div>
            <div className="p-3 border-b border-zinc-100 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar documento..."
                  className="w-full border border-zinc-200 rounded-lg pl-8 pr-2 py-2 text-xs"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-2 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as typeof statusFilter)
                  }
                  className="border border-zinc-200 rounded-lg pl-7 pr-2 py-2 text-xs bg-white"
                >
                  <option value="ALL">Todos</option>
                  <option value="Aguardando Análise">Aguardando Análise</option>
                  <option value="Aguardando Aprovação">
                    Aguardando Aprovação
                  </option>
                  <option value="Lançado">Lançados</option>
                  <option value="Cancelado">Cancelados</option>
                </select>
              </div>
            </div>
            <div className="divide-y divide-zinc-100 max-h-[520px] overflow-y-auto">
              {filteredDocuments.map((document) => (
                <div key={document.id} className="p-4 hover:bg-zinc-50">
                  <div className="flex items-start gap-3">
                    <FileTypeIcon
                      name={document.name}
                      mimeType={document.mimeType}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <h4
                          className="text-xs font-bold truncate"
                          title={document.name}
                        >
                          {document.name}
                        </h4>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full h-fit ${document.status === "Lançado" ? "bg-emerald-50 text-emerald-700" : document.status.includes("Aguardando") ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-500"}`}
                        >
                          {document.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1">
                        {document.category} · {document.fileSize}
                      </p>
                      <p className="text-[9px] text-zinc-400 mt-1 flex items-center gap-1">
                        <Clock3 className="h-3 w-3" />{" "}
                        {new Date(document.uploadedAt).toLocaleString("pt-BR")}{" "}
                        · {document.uploadedByName}
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-2 line-clamp-2">
                        {document.aiSummary || document.description}
                      </p>
                      <div className="flex gap-1 mt-2">
                        <button
                          onClick={() =>
                            alert(
                              `Link seguro: ${document.signedUrl || "indisponível"}`,
                            )
                          }
                          className="p-1.5 text-[#0B2C52] hover:bg-blue-50 rounded cursor-pointer"
                          title="Baixar"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        {hasPermission("documents.upload") && (
                          <button
                            onClick={() => handleDelete(document)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {filteredDocuments.length === 0 && (
                <div className="p-10 text-center text-zinc-400">
                  <FolderOpen className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-xs">Nenhum documento encontrado.</p>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4 gap-2">
            <div className="bg-white border rounded-xl p-3">
              <p className="text-[9px] text-zinc-400 font-bold uppercase">
                Enviados
              </p>
              <p className="text-xl font-black mt-1">
                {companyDocuments.length}
              </p>
            </div>
            <div className="bg-white border rounded-xl p-3">
              <p className="text-[9px] text-emerald-600 font-bold uppercase">
                Lançados
              </p>
              <p className="text-xl font-black mt-1 text-emerald-700">
                {included}
              </p>
            </div>
            <div className="bg-white border rounded-xl p-3">
              <p className="text-[9px] text-amber-600 font-bold uppercase">
                Aguardando análise
              </p>
              <p className="text-xl font-black mt-1 text-amber-700">
                {pendingCount}
              </p>
            </div>
            <div className="bg-white border border-rose-200 rounded-xl p-3">
              <p className="text-[9px] text-rose-600 font-bold uppercase">
                Cancelados
              </p>
              <p className="text-xl font-black mt-1 text-rose-700">
                {rejectedCount}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
