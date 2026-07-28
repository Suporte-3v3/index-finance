import React, { useEffect, useMemo, useRef, useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import { Document } from "../types";
import { analyzeDocumentVisually } from "../services/documentAnalysis";
import FileTypeIcon from "../components/FileTypeIcon";
import DocumentPreview from "../components/DocumentPreview";
import DocumentDownloadButton from "../components/DocumentDownloadButton";
import CurrencyInput from "../components/CurrencyInput";
import { isDocumentDeliveredByBpo } from "../services/documentVisibility";
import {
  Bot,
  Check,
  CheckCircle2,
  Clock3,
  Database,
  Eye,
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
  Upload,
  X,
} from "lucide-react";

const DOC_STAT_VISUALS = [
  {
    icon: Upload,
    tint: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  {
    icon: CheckCircle2,
    tint: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    icon: Clock3,
    tint: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  },
  {
    icon: X,
    tint: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  },
] as const;

const DOC_AVATAR_PALETTE = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-sky-500",
  "bg-purple-500",
  "bg-teal-500",
];

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

const getAvatarTint = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return DOC_AVATAR_PALETTE[Math.abs(hash) % DOC_AVATAR_PALETTE.length];
};

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

type BPOUploadMode = "VIEW_ONLY" | "AI_APPROVAL";

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
    users,
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
  const [queuedFile, setQueuedFile] = useState<File | null>(null);
  const [bpoUploadMode, setBpoUploadMode] = useState<BPOUploadMode | null>(null);
  const [flowCompanyId, setFlowCompanyId] = useState("");
  const [flowRecipientId, setFlowRecipientId] = useState("");
  const [approvalRecipientId, setApprovalRecipientId] = useState("");
  const [historyTab, setHistoryTab] = useState<
    "sent" | "received" | "cancelled"
  >(() =>
    ["CLIENT", "ACCOUNTANT"].includes(currentUser.role) ? "received" : "sent",
  );
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(
    null,
  );
  const [visualAiAvailable, setVisualAiAvailable] = useState<boolean | null>(
    null,
  );
  const [maxDocumentSize, setMaxDocumentSize] = useState(20 * 1024 * 1024);
  const [persistentUploads, setPersistentUploads] = useState(false);

  useEffect(() => {
    setPending(null);
    setIsAnalyzing(false);
    setChatPrompt("");
    setError("");
    setEditingAnalysis(false);
    setQueuedFile(null);
    setBpoUploadMode(null);
    setFlowCompanyId("");
    setFlowRecipientId("");
    setApprovalRecipientId("");
    setPreviewDocumentId(null);
    setSearch("");
    setStatusFilter("ALL");
    setHistoryTab(
      ["CLIENT", "ACCOUNTANT"].includes(currentUser.role)
        ? "received"
        : "sent",
    );
  }, [currentUser.id, currentUser.role]);

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
        .filter(
          (document) =>
            document.companyId === activeCompany?.id &&
            document.status !== "Cancelado" &&
            document.uploadedById === currentUser.id &&
            !isDocumentDeliveredByBpo(document, currentUser.id),
        )
        .sort(
          (first, second) =>
            new Date(second.uploadedAt).getTime() -
            new Date(first.uploadedAt).getTime(),
        ),
    [activeCompany?.id, currentUser.id, documents],
  );

  const receivedDocuments = useMemo(
    () =>
      documents
        .filter(
          (document) =>
            document.companyId === activeCompany?.id &&
            document.status !== "Cancelado" &&
            isDocumentDeliveredByBpo(document, currentUser.id),
        )
        .sort(
          (first, second) =>
            new Date(second.sharedAt || second.uploadedAt).getTime() -
            new Date(first.sharedAt || first.uploadedAt).getTime(),
        ),
    [activeCompany?.id, currentUser.id, documents],
  );

  const cancelledDocuments = useMemo(
    () =>
      documents
        .filter(
          (document) =>
            document.companyId === activeCompany?.id &&
            document.status === "Cancelado" &&
            (document.uploadedById === currentUser.id ||
              isDocumentDeliveredByBpo(document, currentUser.id)),
        )
        .sort(
          (first, second) =>
            new Date(second.sharedAt || second.uploadedAt).getTime() -
            new Date(first.sharedAt || first.uploadedAt).getTime(),
        ),
    [activeCompany?.id, currentUser.id, documents],
  );

  const isBpoUser = ["BPO_ADMIN", "BPO_TEAM"].includes(currentUser.role);
  const selectedFlowCompanyId = flowCompanyId || activeCompany?.id || "";
  const flowRecipients = users.filter(
    (user) =>
      user.status === "ACTIVE" &&
      (bpoUploadMode === "AI_APPROVAL"
        ? user.role === "CLIENT"
        : ["CLIENT", "ACCOUNTANT"].includes(user.role)) &&
      user.companies?.includes(selectedFlowCompanyId),
  );
  const approvalRecipient = users.find(
    (user) => user.id === approvalRecipientId,
  );

  const historyDocuments =
    historyTab === "sent"
      ? companyDocuments
      : historyTab === "received"
        ? receivedDocuments
        : cancelledDocuments;
  const filteredDocuments = historyDocuments.filter((document) => {
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
  const previewDocument = historyDocuments.find(
    (document) => document.id === previewDocumentId,
  );

  if (!activeCompany) return null;

  const analyzeFile = async (
    file: File,
    forcedCompanyId?: string,
    targetApprovalRecipientId?: string,
  ) => {
    setError("");
    setApprovalRecipientId(targetApprovalRecipientId || "");
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
    const analysisCompany =
      availableCompanies.find((company) => company.id === forcedCompanyId) ||
      activeCompany;

    try {
      const analysis = await analyzeDocumentVisually(
        file,
        analysisCompany.tradeName,
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
        companyId: forcedCompanyId || matchedCompany?.id || activeCompany.id,
        documentNumber: analysis.documentNumber || "",
        amount: Number(analysis.amount) || 0,
        warnings: analysis.warnings || [],
        extractedData: {
          "Tipo identificado": analysis.documentType,
          Fornecedor: analysis.supplier || "A confirmar",
          Vencimento: analysis.dueDate || "A confirmar",
          "Tipo de despesa": analysis.expenseType || "A confirmar",
          Empresa:
            forcedCompanyId
              ? analysisCompany.tradeName
              : matchedCompany?.tradeName || activeCompany.tradeName,
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
        companyId: forcedCompanyId || activeCompany.id,
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
          Empresa: analysisCompany.tradeName,
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

  const storeOriginalFile = async (file: File, warnings: string[]) => {
    if (!persistentUploads) {
      warnings.push(
        "Neste deploy, somente os dados do envio são mantidos no navegador; o arquivo original não é armazenado.",
      );
      return undefined;
    }
    const data = await readFileAsBase64(file);
    const response = await fetch("/api/documents/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data,
        fileName: file.name,
        mimeType: file.type,
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
    return result.url;
  };

  const resetBpoUploadFlow = () => {
    setQueuedFile(null);
    setBpoUploadMode(null);
    setFlowCompanyId("");
    setFlowRecipientId("");
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (file.size > maxDocumentSize) {
      setError(`O arquivo excede o limite de ${formatSize(maxDocumentSize)}.`);
      return;
    }
    if (isBpoUser) {
      setQueuedFile(file);
      setBpoUploadMode(null);
      setFlowCompanyId(activeCompany.id);
      setFlowRecipientId("");
      return;
    }
    void analyzeFile(file);
  };

  const shareQueuedFile = async () => {
    if (!queuedFile || !flowRecipientId || !selectedFlowCompanyId) return;
    setError("");
    setIsAnalyzing(true);
    const file = queuedFile;
    const warnings: string[] = [];
    try {
      const previewUrl = await storeOriginalFile(file, warnings);
      const now = new Date();
      uploadDocument({
        name: file.name,
        description: "Documento avulso compartilhado somente para visualização.",
        category: "Outros",
        competenceMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
        fileSize: formatSize(file.size),
        mimeType: file.type || "application/octet-stream",
        companyId: selectedFlowCompanyId,
        recipientId: flowRecipientId,
        analysisWarnings: warnings,
        previewUrl,
        extractedData: {
          Finalidade: "Somente visualização",
          Empresa:
            companies.find((company) => company.id === selectedFlowCompanyId)
              ?.tradeName || activeCompany.tradeName,
          "Compartilhado por": currentUser.name,
        },
      });
      setChatPrompt("");
      resetBpoUploadFlow();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Falha ao compartilhar o documento.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeQueuedFileForApproval = () => {
    if (!queuedFile || !flowRecipientId || !selectedFlowCompanyId) return;
    const file = queuedFile;
    const companyId = selectedFlowCompanyId;
    const recipientId = flowRecipientId;
    resetBpoUploadFlow();
    void analyzeFile(file, companyId, recipientId);
  };

  const confirmDocument = async () => {
    if (!pending) return;
    setError("");
    setIsAnalyzing(true);
    try {
      const storageWarnings = [...pending.warnings];
      const previewUrl = await storeOriginalFile(
        pending.file,
        storageWarnings,
      );
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
        approvalRecipientId: isBpoUser
          ? approvalRecipientId || undefined
          : undefined,
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
      setApprovalRecipientId("");
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
  const rejectedCount = cancelledDocuments.length;

  return (
    <div className="space-y-4">
      {queuedFile && isBpoUser && (
        <div
          className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={resetBpoUploadFlow}
        >
          <div
            className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold text-[#C8102E] uppercase tracking-wider">
                  Defina a finalidade antes da IA
                </p>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mt-1">
                  Como deseja enviar este arquivo?
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 break-all">
                  {queuedFile.name}
                </p>
              </div>
              <button
                onClick={resetBpoUploadFlow}
                className="p-2 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-pointer"
                aria-label="Fechar escolha de finalidade"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setBpoUploadMode("VIEW_ONLY");
                    setFlowRecipientId("");
                  }}
                  className={`rounded-sm border p-4 text-left cursor-pointer transition ${bpoUploadMode === "VIEW_ONLY" ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100 dark:bg-blue-500/10 dark:ring-blue-500/20 dark:border-blue-500" : "border-zinc-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-500/60"}`}
                >
                  <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-50 mt-3">
                    Compartilhar para visualização
                  </p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    Envia ao cliente ou contador sem acionar a IA, sem aprovação
                    e sem gerar lançamento financeiro.
                  </p>
                </button>
                <button
                  onClick={() => {
                    setBpoUploadMode("AI_APPROVAL");
                    setFlowRecipientId("");
                  }}
                  className={`rounded-sm border p-4 text-left cursor-pointer transition ${bpoUploadMode === "AI_APPROVAL" ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100 dark:bg-violet-500/10 dark:ring-violet-500/20 dark:border-violet-500" : "border-zinc-200 dark:border-zinc-700 hover:border-violet-300 dark:hover:border-violet-500/60"}`}
                >
                  <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-50 mt-3">
                    Analisar com IA e aprovar
                  </p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    A IA identifica os dados; depois da sua revisão, o documento
                    segue para aprovação documental do cliente.
                  </p>
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                  Empresa
                  <select
                    value={selectedFlowCompanyId}
                    onChange={(event) => {
                      setFlowCompanyId(event.target.value);
                      setFlowRecipientId("");
                    }}
                    className="mt-1 w-full border border-zinc-200 dark:border-zinc-700 rounded-sm px-3 py-2.5 text-xs bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100"
                  >
                    {availableCompanies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.tradeName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                  {bpoUploadMode === "AI_APPROVAL"
                    ? "Cliente aprovador"
                    : "Destinatário"}
                  <select
                    disabled={!bpoUploadMode}
                    value={flowRecipientId}
                    onChange={(event) =>
                      setFlowRecipientId(event.target.value)
                    }
                    className="mt-1 w-full border border-zinc-200 dark:border-zinc-700 rounded-sm px-3 py-2.5 text-xs bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                  >
                    <option value="">
                      {bpoUploadMode
                        ? "Selecione o destinatário"
                        : "Escolha primeiro a finalidade"}
                    </option>
                    {flowRecipients.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ·{" "}
                        {user.role === "CLIENT" ? "Cliente" : "Contador"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2">
              <button
                onClick={resetBpoUploadFlow}
                className="px-4 py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={
                  bpoUploadMode === "VIEW_ONLY"
                    ? shareQueuedFile
                    : analyzeQueuedFileForApproval
                }
                disabled={!bpoUploadMode || !flowRecipientId || isAnalyzing}
                className="px-4 py-2 bg-[#0B2C52] disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-sm text-xs font-semibold flex items-center gap-2 cursor-pointer"
              >
                {bpoUploadMode === "VIEW_ONLY" ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isAnalyzing
                  ? "Enviando..."
                  : bpoUploadMode === "VIEW_ONLY"
                    ? "Compartilhar agora"
                    : "Continuar com a IA"}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewDocument && (
        <div
          className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
          onClick={() => setPreviewDocumentId(null)}
        >
          <div
            className="bg-white dark:bg-[#091320] rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-5xl h-[88vh] overflow-hidden flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-[#0B2C52] dark:text-[#9DB8D9] uppercase tracking-wider">
                  {historyTab === "received"
                    ? "Documento recebido"
                    : historyTab === "cancelled"
                      ? "Documento cancelado"
                      : "Visualização do documento"}
                </p>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                  {previewDocument.name}
                </h3>
              </div>
              <button
                onClick={() => setPreviewDocumentId(null)}
                className="p-2 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-pointer"
                aria-label="Fechar visualização"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 bg-zinc-100 dark:bg-zinc-900/60 p-3 sm:p-5">
              <DocumentPreview
                name={previewDocument.name}
                url={previewDocument.signedUrl}
              />
            </div>
            <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center gap-3 text-xs">
              <span className="text-zinc-500 dark:text-zinc-400 truncate">
                {isDocumentDeliveredByBpo(
                  previewDocument,
                  currentUser.id,
                )
                  ? `Enviado por ${previewDocument.sharedByName || "Equipe BPO"}`
                  : previewDocument.recipientName
                    ? `Compartilhado com ${previewDocument.recipientName}`
                    : "Documento do seu histórico"}
              </span>
              <div className="flex items-center gap-2">
                <DocumentDownloadButton
                  url={previewDocument.signedUrl}
                  name={previewDocument.name}
                  className="border border-blue-100 dark:border-blue-900/40 text-[#0B2C52] dark:text-[#9DB8D9] hover:bg-blue-50 dark:hover:bg-blue-500/10"
                />
                <button
                  onClick={() => setPreviewDocumentId(null)}
                  className="px-4 py-2 bg-[#0B2C52] text-white rounded-sm font-semibold cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Central de Documentos
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Envie documentos e acompanhe somente o histórico deste acesso.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400 bg-white dark:bg-[#091320] border border-zinc-200 dark:border-zinc-800 rounded-sm px-3 py-2">
          <Database className="h-3.5 w-3.5 text-[#0B2C52] dark:text-[#9DB8D9]" /> Repositório da{" "}
          {activeCompany.tradeName}
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.9fr)] gap-5 items-start">
        <section className="bg-white dark:bg-[#091320] border border-zinc-200 dark:border-zinc-800 rounded-sm overflow-hidden shadow-sm min-h-[680px] flex flex-col">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[#F2D3A0]/35 dark:bg-[#F2D3A0]/15 flex items-center justify-center">
              <Bot className="h-5 w-5 text-[#0B2C52] dark:text-[#9DB8D9]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Assistente de Documentos</h3>
                <span
                  className={`text-[9px] font-semibold ${visualAiAvailable ? "text-emerald-600 dark:text-emerald-400" : visualAiAvailable === false ? "text-amber-600 dark:text-amber-400" : "text-zinc-400 dark:text-zinc-500"}`}
                >
                  ●{" "}
                  {visualAiAvailable
                    ? "IA visual ativa"
                    : visualAiAvailable === false
                      ? "IA não configurada"
                      : "Verificando IA..."}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                Identifica, organiza e resume arquivos antes da inclusão.
              </p>
            </div>
          </div>

          <div className="flex-1 bg-zinc-50/60 dark:bg-zinc-900/40 p-5 space-y-4 overflow-y-auto max-h-[570px]">
            <div className="flex items-start gap-2">
              <div className="h-8 w-8 rounded-full bg-[#F2D3A0]/35 dark:bg-[#F2D3A0]/15 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-[#0B2C52] dark:text-[#9DB8D9]" />
              </div>
              <div className="bg-white dark:bg-[#091320] border border-zinc-200 dark:border-zinc-800 rounded-sm p-3 max-w-[82%]">
                <p className="text-xs text-zinc-700 dark:text-zinc-300">
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
                    <div className="bg-[#0B2C52] text-white rounded-sm px-3 py-2 max-w-[78%]">
                      <p className="text-xs">
                        Documento enviado: <strong>{document.name}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="h-8 w-8 rounded-full bg-[#F2D3A0]/35 dark:bg-[#F2D3A0]/15 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-[#0B2C52] dark:text-[#9DB8D9]" />
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 rounded-sm p-3 max-w-[85%]">
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> DOCUMENTO
                        INCLUÍDO
                      </p>
                      <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-1">
                        {document.aiSummary || document.description}
                      </p>
                      <p className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-2">
                        {new Date(document.uploadedAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

            {isAnalyzing && (
              <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 bg-white dark:bg-[#091320] border border-zinc-200 dark:border-zinc-800 rounded-sm p-4 w-fit">
                <Loader2 className="h-4 w-4 animate-spin text-[#C8102E]" />{" "}
                Lendo e classificando o documento...
              </div>
            )}

            {pending && (
              <div className="flex items-start gap-2">
                <div className="h-8 w-8 rounded-full bg-[#F2D3A0]/35 dark:bg-[#F2D3A0]/15 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-[#C8102E]" />
                </div>
                <div className="bg-white dark:bg-[#091320] border border-zinc-200 dark:border-zinc-800 rounded-sm p-4 w-full max-w-[92%] space-y-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold">
                        DOCUMENTO RECEBIDO E ANALISADO
                      </p>
                      <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-50 mt-1 break-all">
                        {pending.file.name}
                      </h4>
                    </div>
                    <span className="text-[10px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25 h-fit px-2 py-1 rounded font-semibold">
                      Confiança {pending.confidence}%
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {pending.summary}
                  </p>
                  <div
                    className={`text-[10px] font-semibold rounded-sm px-3 py-2 ${pending.source === "visual-ai" ? "bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/25" : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25"}`}
                  >
                    {pending.source === "visual-ai"
                      ? "Leitura visual generativa aplicada ao conteúdo do documento."
                      : "Fallback local aplicado — revise os campos manualmente."}
                  </div>
                  {pending.warnings.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-sm p-3">
                      <p className="text-[9px] font-semibold text-amber-700 dark:text-amber-300 uppercase">
                        Atenções da leitura
                      </p>
                      {pending.warnings.map((warning) => (
                        <p
                          key={warning}
                          className="text-[10px] text-amber-800 dark:text-amber-200 mt-1"
                        >
                          • {warning}
                        </p>
                      ))}
                    </div>
                  )}

                  {editingAnalysis ? (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
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
                          className="mt-1 w-full border border-zinc-200 dark:border-zinc-700 rounded-sm p-2 text-xs bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100"
                        >
                          {CATEGORIES.map((category) => (
                            <option key={category}>{category}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                        Fornecedor
                        <input
                          value={pending.supplier}
                          onChange={(event) =>
                            setPending({
                              ...pending,
                              supplier: event.target.value,
                            })
                          }
                          className="mt-1 w-full border border-zinc-200 dark:border-zinc-700 rounded-sm p-2 text-xs bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100"
                        />
                      </label>
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
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
                          className="mt-1 w-full border border-zinc-200 dark:border-zinc-700 rounded-sm p-2 text-xs bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100"
                        />
                      </label>
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                        Tipo de despesa
                        <input
                          value={pending.expenseType}
                          onChange={(event) =>
                            setPending({
                              ...pending,
                              expenseType: event.target.value,
                            })
                          }
                          className="mt-1 w-full border border-zinc-200 dark:border-zinc-700 rounded-sm p-2 text-xs bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100"
                        />
                      </label>
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                        Número do documento
                        <input
                          value={pending.documentNumber}
                          onChange={(event) =>
                            setPending({
                              ...pending,
                              documentNumber: event.target.value,
                            })
                          }
                          className="mt-1 w-full border border-zinc-200 dark:border-zinc-700 rounded-sm p-2 text-xs bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100"
                        />
                      </label>
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                        Valor
                        <CurrencyInput
                          value={pending.amount}
                          onChange={(amount) =>
                            setPending({ ...pending, amount })
                          }
                          className="mt-1 w-full border border-zinc-200 dark:border-zinc-700 rounded-sm p-2 text-xs bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100"
                        />
                      </label>
                      <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 sm:col-span-2">
                        Empresa
                        <select
                          disabled={Boolean(approvalRecipientId)}
                          value={pending.companyId}
                          onChange={(event) => {
                            setPending({
                              ...pending,
                              companyId: event.target.value,
                            });
                          }}
                          className="mt-1 w-full border border-zinc-200 dark:border-zinc-700 rounded-sm p-2 text-xs bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-500"
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
                          className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-sm p-2"
                        >
                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-semibold block">
                            {label}
                          </span>
                          <span className="text-[10px] text-zinc-800 dark:text-zinc-200 font-semibold">
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {isBpoUser && approvalRecipient && (
                    <div className="rounded-sm border border-blue-200 dark:border-blue-500/25 bg-blue-50 dark:bg-blue-500/10 px-3 py-2 text-[10px] text-blue-700 dark:text-blue-300">
                      <strong>Fluxo selecionado:</strong> análise por IA e envio
                      para aprovação documental de {approvalRecipient.name}.
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {editingAnalysis ? (
                      <button
                        onClick={() => setEditingAnalysis(false)}
                        className="flex items-center gap-1.5 bg-[#0B2C52] text-white text-xs font-semibold px-3 py-2 rounded-sm cursor-pointer"
                      >
                        <Save className="h-4 w-4" /> Salvar informações
                      </button>
                    ) : (
                      <button
                        onClick={() => setEditingAnalysis(true)}
                        className="flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold px-3 py-2 rounded-sm cursor-pointer"
                      >
                        <Pencil className="h-4 w-4" /> Editar informações
                      </button>
                    )}
                    <button
                      onClick={confirmDocument}
                      disabled={
                        isAnalyzing ||
                        Boolean(approvalRecipientId && !approvalRecipient)
                      }
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-2 rounded-sm cursor-pointer"
                    >
                      {approvalRecipientId ? (
                        <Send className="h-4 w-4" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}{" "}
                      {approvalRecipientId
                        ? "Enviar para aprovação documental"
                        : "Incluir documento"}
                    </button>
                    <button
                      onClick={() => {
                        setPending(null);
                        setEditingAnalysis(false);
                        setApprovalRecipientId("");
                      }}
                      className="flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs font-semibold px-3 py-2 rounded-sm cursor-pointer"
                    >
                      <X className="h-4 w-4" /> Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25 rounded-sm p-3">
                {error}
              </div>
            )}
          </div>

          {hasPermission("documents.upload") && (
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
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
                  className="p-2.5 border border-zinc-200 dark:border-zinc-700 rounded-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <Paperclip className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
                </button>
                <input
                  value={chatPrompt}
                  onChange={(event) => setChatPrompt(event.target.value)}
                  placeholder="Escreva um contexto e anexe o documento..."
                  className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-sm px-3 text-xs bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 focus:outline-none focus:border-[#0B2C52] dark:focus:border-[#9DB8D9]"
                />
                <button
                  onClick={() => inputRef.current?.click()}
                  className="p-2.5 bg-[#0B2C52] text-white rounded-sm cursor-pointer"
                  title="Selecionar arquivo para enviar"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-2">
                PDF, JPG, PNG, HEIC, OFX, XML, XLSX e CSV · máximo de{" "}
                {formatSize(maxDocumentSize)}
                {!persistentUploads &&
                  " · no acesso remoto, o arquivo original não é persistido"}
              </p>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="bg-white dark:bg-[#091320] border border-zinc-200 dark:border-zinc-800 rounded-sm overflow-hidden shadow-sm">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Histórico de Documentos</h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                {historyTab === "sent"
                  ? `Somente os documentos enviados por ${currentUser.name}.`
                  : historyTab === "received"
                    ? "Documentos enviados para este acesso."
                    : "Documentos cancelados deste acesso."}
              </p>
              <div className="grid grid-cols-3 gap-1 mt-3 bg-zinc-100 dark:bg-zinc-800/70 rounded-sm p-1">
                <button
                  onClick={() => {
                    setHistoryTab("sent");
                    setStatusFilter("ALL");
                    setPreviewDocumentId(null);
                  }}
                  className={`rounded-sm px-2 py-1.5 text-[10px] font-semibold cursor-pointer ${historyTab === "sent" ? "bg-white dark:bg-zinc-900 text-[#0B2C52] dark:text-[#9DB8D9] shadow-sm" : "text-zinc-500 dark:text-zinc-400"}`}
                >
                  Meus envios ({companyDocuments.length})
                </button>
                <button
                  onClick={() => {
                    setHistoryTab("received");
                    setStatusFilter("ALL");
                    setPreviewDocumentId(null);
                  }}
                  className={`rounded-sm px-2 py-1.5 text-[10px] font-semibold cursor-pointer ${historyTab === "received" ? "bg-white dark:bg-zinc-900 text-[#0B2C52] dark:text-[#9DB8D9] shadow-sm" : "text-zinc-500 dark:text-zinc-400"}`}
                >
                  Recebidos ({receivedDocuments.length})
                </button>
                <button
                  onClick={() => {
                    setHistoryTab("cancelled");
                    setStatusFilter("ALL");
                    setPreviewDocumentId(null);
                  }}
                  className={`rounded-sm px-2 py-1.5 text-[10px] font-semibold cursor-pointer ${historyTab === "cancelled" ? "bg-white dark:bg-zinc-900 text-rose-700 dark:text-rose-400 shadow-sm" : "text-zinc-500 dark:text-zinc-400"}`}
                >
                  Cancelados ({cancelledDocuments.length})
                </button>
              </div>
            </div>
            <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar documento..."
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-sm pl-8 pr-2 py-2 text-xs bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
              </div>
              {historyTab === "cancelled" ? (
                <div className="flex items-center gap-1.5 rounded-sm border border-rose-100 dark:border-rose-500/25 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-[10px] font-semibold text-rose-700 dark:text-rose-300">
                  <X className="h-3.5 w-3.5" /> Somente cancelados
                </div>
              ) : (
                <div className="relative">
                  <Filter className="absolute left-2 top-2.5 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as typeof statusFilter)
                    }
                    className="border border-zinc-200 dark:border-zinc-700 rounded-sm pl-7 pr-2 py-2 text-xs bg-white dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="ALL">Todos</option>
                    <option value="Aguardando Análise">
                      Aguardando Análise
                    </option>
                    <option value="Aguardando Aprovação">
                      Aguardando Aprovação
                    </option>
                    <option value="Compartilhado">Compartilhados</option>
                    <option value="Lançado">Lançados</option>
                  </select>
                </div>
              )}
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[520px] overflow-y-auto">
              {filteredDocuments.map((document) => (
                <div key={document.id} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <div className="flex items-start gap-3">
                    <FileTypeIcon
                      name={document.name}
                      mimeType={document.mimeType}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <h4
                          className="text-xs font-semibold text-zinc-900 dark:text-zinc-50 truncate"
                          title={document.name}
                        >
                          {document.name}
                        </h4>
                        <span
                          className={`inline-flex items-center gap-1.5 text-[9px] font-semibold px-2 py-0.5 rounded border h-fit ${document.status === "Lançado" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25" : document.status === "Compartilhado" ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/25" : document.status.includes("Aguardando") ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25" : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
                          {document.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                        {document.category} · {document.fileSize}
                      </p>
                      <p className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-1 flex items-center gap-1">
                        <Clock3 className="h-3 w-3" />{" "}
                        {new Date(
                          isDocumentDeliveredByBpo(document, currentUser.id)
                            ? document.sharedAt || document.uploadedAt
                            : document.uploadedAt,
                        ).toLocaleString("pt-BR")}{" "}
                        ·{" "}
                        {historyTab === "cancelled"
                          ? "cancelado"
                          : historyTab === "received"
                            ? "recebido"
                            : "este acesso"}
                      </p>
                      {historyTab === "sent" && document.recipientName && (
                        <p className="text-[9px] text-blue-600 dark:text-blue-400 mt-1">
                          Compartilhado para visualização com{" "}
                          {document.recipientName}
                        </p>
                      )}
                      {(historyTab === "received" ||
                        (historyTab === "cancelled" &&
                          isDocumentDeliveredByBpo(
                            document,
                            currentUser.id,
                          ))) && (
                        <p className="text-[9px] text-blue-600 dark:text-blue-400 mt-1">
                          Enviado pelo BPO: {document.sharedByName || "Equipe BPO"}
                        </p>
                      )}
                      {historyTab === "cancelled" &&
                        !isDocumentDeliveredByBpo(
                          document,
                          currentUser.id,
                        ) && (
                          <p className="text-[9px] text-zinc-500 dark:text-zinc-400 mt-1">
                            Enviado por este acesso
                          </p>
                        )}
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-2 line-clamp-2">
                        {document.aiSummary || document.description}
                      </p>
                      <div className="flex gap-1 mt-2">
                        <button
                          onClick={() => setPreviewDocumentId(document.id)}
                          className="p-1.5 text-[#0B2C52] dark:text-[#9DB8D9] hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded cursor-pointer"
                          title="Visualizar"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <DocumentDownloadButton
                          url={document.signedUrl}
                          name={document.name}
                          iconOnly
                          className="text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                        />
                        {historyTab === "sent" &&
                          document.uploadedById === currentUser.id &&
                          hasPermission("documents.upload") && (
                          <button
                            onClick={() => handleDelete(document)}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded cursor-pointer"
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
                <div className="p-10 text-center text-zinc-400 dark:text-zinc-500">
                  <FolderOpen className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-xs">Nenhum documento encontrado.</p>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4 gap-2">
            <div className="bg-white dark:bg-[#091320] border border-zinc-200 dark:border-zinc-800 rounded-sm p-2.5 flex flex-col gap-2">
              <div className={`h-7 w-7 rounded-sm flex items-center justify-center ${DOC_STAT_VISUALS[0].tint}`}>
                {React.createElement(DOC_STAT_VISUALS[0].icon, { className: "h-3.5 w-3.5", strokeWidth: 2.25 })}
              </div>
              <div>
                <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-semibold uppercase">
                  Enviados
                </p>
                <p className="text-xl font-semibold mt-0.5 text-zinc-900 dark:text-zinc-50">
                  {companyDocuments.length}
                </p>
              </div>
            </div>
            <div className="bg-white dark:bg-[#091320] border border-zinc-200 dark:border-zinc-800 rounded-sm p-2.5 flex flex-col gap-2">
              <div className={`h-7 w-7 rounded-sm flex items-center justify-center ${DOC_STAT_VISUALS[1].tint}`}>
                {React.createElement(DOC_STAT_VISUALS[1].icon, { className: "h-3.5 w-3.5", strokeWidth: 2.25 })}
              </div>
              <div>
                <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase">
                  Lançados
                </p>
                <p className="text-xl font-semibold mt-0.5 text-emerald-700 dark:text-emerald-400">
                  {included}
                </p>
              </div>
            </div>
            <div className="bg-white dark:bg-[#091320] border border-zinc-200 dark:border-zinc-800 rounded-sm p-2.5 flex flex-col gap-2">
              <div className={`h-7 w-7 rounded-sm flex items-center justify-center ${DOC_STAT_VISUALS[2].tint}`}>
                {React.createElement(DOC_STAT_VISUALS[2].icon, { className: "h-3.5 w-3.5", strokeWidth: 2.25 })}
              </div>
              <div>
                <p className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold uppercase">
                  Aguardando análise
                </p>
                <p className="text-xl font-semibold mt-0.5 text-amber-700 dark:text-amber-400">
                  {pendingCount}
                </p>
              </div>
            </div>
            <div className="bg-white dark:bg-[#091320] border border-rose-200 dark:border-rose-500/25 rounded-sm p-2.5 flex flex-col gap-2">
              <div className={`h-7 w-7 rounded-sm flex items-center justify-center ${DOC_STAT_VISUALS[3].tint}`}>
                {React.createElement(DOC_STAT_VISUALS[3].icon, { className: "h-3.5 w-3.5", strokeWidth: 2.25 })}
              </div>
              <div>
                <p className="text-[9px] text-rose-600 dark:text-rose-400 font-semibold uppercase">
                  Cancelados
                </p>
                <p className="text-xl font-semibold mt-0.5 text-rose-700 dark:text-rose-400">
                  {rejectedCount}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
