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
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Modal,
  Tabs,
} from "../components/ui";
import { MetricTone } from "../components/ui/MetricCard";
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

const DOC_STAT_VISUALS: { icon: typeof Upload; tone: MetricTone }[] = [
  { icon: Upload, tone: "navy" },
  { icon: CheckCircle2, tone: "green" },
  { icon: Clock3, tone: "gold" },
  { icon: X, tone: "red" },
];

const TONE_CHIP: Record<MetricTone, string> = {
  neutral: "bg-zinc-100 text-zinc-600 dark:bg-white/5 dark:text-ink-soft-dark",
  navy: "bg-brand-blue-50 text-brand-navy-900 dark:bg-brand-navy-700/20 dark:text-brand-navy-700/90",
  red: "bg-brand-red-50 text-brand-red-600 dark:bg-brand-red-600/15 dark:text-red-300",
  green:
    "bg-brand-green-50 text-brand-green-600 dark:bg-brand-green-600/15 dark:text-emerald-300",
  gold: "bg-brand-gold-300/25 text-amber-700 dark:bg-brand-gold-600/15 dark:text-brand-gold-300",
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
      await uploadDocument({
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
      await uploadDocument({
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
      setEditingAnalysis(false);
      setStatusFilter("ALL");
      setHistoryTab("sent");
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
    <div className="space-y-5">
      {/* BPO upload-mode selection */}
      <Modal
        open={Boolean(queuedFile && isBpoUser)}
        onClose={resetBpoUploadFlow}
        title="Como deseja enviar este arquivo?"
        description={queuedFile?.name}
        footer={
          <>
            <Button variant="text" onClick={resetBpoUploadFlow}>
              Cancelar
            </Button>
            <Button
              icon={
                bpoUploadMode === "VIEW_ONLY" ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )
              }
              disabled={!bpoUploadMode || !flowRecipientId || isAnalyzing}
              onClick={
                bpoUploadMode === "VIEW_ONLY"
                  ? shareQueuedFile
                  : analyzeQueuedFileForApproval
              }
            >
              {isAnalyzing
                ? "Enviando..."
                : bpoUploadMode === "VIEW_ONLY"
                  ? "Compartilhar agora"
                  : "Continuar com a IA"}
            </Button>
          </>
        }
      >
        <p className="text-[10px] font-bold text-brand-red-600 uppercase tracking-wider -mt-2 mb-3">
          Defina a finalidade antes da IA
        </p>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              onClick={() => {
                setBpoUploadMode("VIEW_ONLY");
                setFlowRecipientId("");
              }}
              className={`rounded-lg border p-4 text-left cursor-pointer transition ${bpoUploadMode === "VIEW_ONLY" ? "border-brand-navy-700 bg-brand-blue-50 ring-2 ring-brand-navy-700/20 dark:bg-brand-navy-700/15 dark:ring-brand-navy-700/25" : "border-line dark:border-line-dark hover:border-brand-navy-700/40"}`}
            >
              <Eye className="h-5 w-5 text-brand-navy-900 dark:text-brand-navy-700/90" />
              <p className="text-xs font-bold text-ink dark:text-ink-dark mt-3">
                Compartilhar para visualização
              </p>
              <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark mt-1 leading-relaxed">
                Envia ao cliente ou contador sem acionar a IA, sem aprovação
                e sem gerar lançamento financeiro.
              </p>
            </button>
            <button
              onClick={() => {
                setBpoUploadMode("AI_APPROVAL");
                setFlowRecipientId("");
              }}
              className={`rounded-lg border p-4 text-left cursor-pointer transition ${bpoUploadMode === "AI_APPROVAL" ? "border-brand-gold-600 bg-brand-gold-300/20 ring-2 ring-brand-gold-600/25 dark:bg-brand-gold-600/10" : "border-line dark:border-line-dark hover:border-brand-gold-600/50"}`}
            >
              <Sparkles className="h-5 w-5 text-amber-600 dark:text-brand-gold-300" />
              <p className="text-xs font-bold text-ink dark:text-ink-dark mt-3">
                Analisar com IA e aprovar
              </p>
              <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark mt-1 leading-relaxed">
                A IA identifica os dados; depois da sua revisão, o documento
                segue para aprovação documental do cliente.
              </p>
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide">
              Empresa
              <select
                value={selectedFlowCompanyId}
                onChange={(event) => {
                  setFlowCompanyId(event.target.value);
                  setFlowRecipientId("");
                }}
                className="mt-1 w-full border border-line dark:border-line-dark rounded-lg px-3 py-2.5 text-xs bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark dark:[color-scheme:dark]"
              >
                {availableCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.tradeName}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide">
              {bpoUploadMode === "AI_APPROVAL"
                ? "Cliente aprovador"
                : "Destinatário"}
              <select
                disabled={!bpoUploadMode}
                value={flowRecipientId}
                onChange={(event) =>
                  setFlowRecipientId(event.target.value)
                }
                className="mt-1 w-full border border-line dark:border-line-dark rounded-lg px-3 py-2.5 text-xs bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark disabled:bg-canvas dark:disabled:bg-white/5 disabled:text-ink-soft dark:disabled:text-ink-soft-dark dark:[color-scheme:dark]"
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
      </Modal>

      {/* Preview modal */}
      <Modal
        open={Boolean(previewDocument)}
        onClose={() => setPreviewDocumentId(null)}
        title={previewDocument?.name}
        description={
          previewDocument
            ? historyTab === "received"
              ? "Documento recebido"
              : historyTab === "cancelled"
                ? "Documento cancelado"
                : "Visualização do documento"
            : undefined
        }
        size="xl"
        footer={
          previewDocument && (
            <>
              <DocumentDownloadButton
                url={previewDocument.signedUrl}
                name={previewDocument.name}
                className="border border-brand-blue-50 dark:border-brand-navy-700/40 text-brand-navy-900 dark:text-brand-navy-700/90 hover:bg-brand-blue-50 dark:hover:bg-brand-navy-700/20"
              />
              <Button onClick={() => setPreviewDocumentId(null)}>Fechar</Button>
            </>
          )
        }
      >
        {previewDocument && (
          <>
            <p className="text-xs text-ink-soft dark:text-ink-soft-dark mb-3 -mt-2">
              {isDocumentDeliveredByBpo(previewDocument, currentUser.id)
                ? `Enviado por ${previewDocument.sharedByName || "Equipe BPO"}`
                : previewDocument.recipientName
                  ? `Compartilhado com ${previewDocument.recipientName}`
                  : "Documento do seu histórico"}
            </p>
            <div className="min-h-[60vh] bg-canvas dark:bg-white/[0.03] rounded-lg p-3 sm:p-5">
              <DocumentPreview
                name={previewDocument.name}
                url={previewDocument.signedUrl}
              />
            </div>
          </>
        )}
      </Modal>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink dark:text-ink-dark tracking-tight">
            Central de Documentos
          </h1>
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark leading-relaxed">
            Envie documentos e acompanhe somente o histórico deste acesso.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-ink-soft dark:text-ink-soft-dark bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg px-3 py-2">
          <Database className="h-3.5 w-3.5 text-brand-navy-900 dark:text-brand-navy-700/90" />{" "}
          Repositório da {activeCompany.tradeName}
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.9fr)] gap-5 items-start">
        {/* Assistant panel */}
        <Card
          padding={false}
          className="overflow-hidden min-h-[680px] flex flex-col"
        >
          <div className="p-4 border-b border-line dark:border-line-dark flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-brand-gold-300/35 dark:bg-brand-gold-300/15 flex items-center justify-center">
              <Bot className="h-5 w-5 text-brand-navy-900 dark:text-brand-navy-700/90" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-ink dark:text-ink-dark">
                  Assistente de Documentos
                </h3>
                <span
                  className={`text-[9px] font-semibold ${visualAiAvailable ? "text-brand-green-600 dark:text-emerald-400" : visualAiAvailable === false ? "text-amber-600 dark:text-amber-400" : "text-ink-soft dark:text-ink-soft-dark"}`}
                >
                  ●{" "}
                  {visualAiAvailable
                    ? "IA visual ativa"
                    : visualAiAvailable === false
                      ? "IA não configurada"
                      : "Verificando IA..."}
                </span>
              </div>
              <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark">
                Identifica, organiza e resume arquivos antes da inclusão.
              </p>
            </div>
          </div>

          <div className="flex-1 bg-canvas/60 dark:bg-white/[0.02] p-5 space-y-4 overflow-y-auto max-h-[570px]">
            <div className="flex items-start gap-2">
              <div className="h-8 w-8 rounded-full bg-brand-gold-300/35 dark:bg-brand-gold-300/15 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-brand-navy-900 dark:text-brand-navy-700/90" />
              </div>
              <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg p-3 max-w-[82%]">
                <p className="text-xs text-ink dark:text-ink-dark">
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
                    <div className="bg-brand-navy-900 text-white rounded-lg px-3 py-2 max-w-[78%]">
                      <p className="text-xs">
                        Documento enviado: <strong>{document.name}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="h-8 w-8 rounded-full bg-brand-gold-300/35 dark:bg-brand-gold-300/15 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-brand-navy-900 dark:text-brand-navy-700/90" />
                    </div>
                    <div className="bg-brand-green-50 dark:bg-brand-green-600/10 border border-brand-green-600/25 dark:border-brand-green-600/25 rounded-lg p-3 max-w-[85%]">
                      <p className="text-[10px] text-brand-green-600 dark:text-emerald-300 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                        {isBpoUser
                          ? "DOCUMENTO INCLUÍDO"
                          : "ENVIADO PARA ANÁLISE DO BPO"}
                      </p>
                      <p className="text-xs text-ink dark:text-ink-dark mt-1">
                        {document.aiSummary || document.description}
                      </p>
                      <p className="text-[9px] text-ink-soft dark:text-ink-soft-dark mt-2">
                        {new Date(document.uploadedAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

            {isAnalyzing && (
              <div className="flex items-center gap-2 text-xs text-ink-soft dark:text-ink-soft-dark bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg p-4 w-fit">
                <Loader2 className="h-4 w-4 animate-spin text-brand-red-600" />{" "}
                Lendo e classificando o documento...
              </div>
            )}

            {pending && (
              <div className="flex items-start gap-2">
                <div className="h-8 w-8 rounded-full bg-brand-gold-300/35 dark:bg-brand-gold-300/15 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-brand-red-600" />
                </div>
                <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-lg p-4 w-full max-w-[92%] space-y-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="text-[10px] text-brand-green-600 dark:text-emerald-300 font-semibold">
                        DOCUMENTO RECEBIDO E ANALISADO
                      </p>
                      <h4 className="text-xs font-bold text-ink dark:text-ink-dark mt-1 break-all">
                        {pending.file.name}
                      </h4>
                    </div>
                    <Badge tone="green" className="h-fit">
                      Confiança {pending.confidence}%
                    </Badge>
                  </div>
                  <p className="text-xs text-ink-soft dark:text-ink-soft-dark leading-relaxed">
                    {pending.summary}
                  </p>
                  <div
                    className={`text-[10px] font-semibold rounded-lg px-3 py-2 ${pending.source === "visual-ai" ? "bg-brand-blue-50 text-brand-navy-900 border border-brand-navy-700/20 dark:bg-brand-navy-700/15 dark:text-brand-navy-700/90 dark:border-brand-navy-700/25" : "bg-brand-gold-300/20 text-amber-700 border border-brand-gold-600/30 dark:bg-brand-gold-600/10 dark:text-brand-gold-300 dark:border-brand-gold-600/25"}`}
                  >
                    {pending.source === "visual-ai"
                      ? "Leitura visual generativa aplicada ao conteúdo do documento."
                      : "Fallback local aplicado — revise os campos manualmente."}
                  </div>
                  {pending.warnings.length > 0 && (
                    <div className="bg-brand-gold-300/20 dark:bg-brand-gold-600/10 border border-brand-gold-600/30 dark:border-brand-gold-600/25 rounded-lg p-3">
                      <p className="text-[9px] font-semibold text-amber-700 dark:text-brand-gold-300 uppercase">
                        Atenções da leitura
                      </p>
                      {pending.warnings.map((warning) => (
                        <p
                          key={warning}
                          className="text-[10px] text-amber-800 dark:text-brand-gold-200 mt-1"
                        >
                          • {warning}
                        </p>
                      ))}
                    </div>
                  )}

                  {editingAnalysis ? (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark">
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
                          className="mt-1 w-full border border-line dark:border-line-dark rounded-lg p-2 text-xs bg-canvas dark:bg-white/5 text-ink dark:text-ink-dark dark:[color-scheme:dark]"
                        >
                          {CATEGORIES.map((category) => (
                            <option key={category}>{category}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark">
                        Fornecedor
                        <input
                          value={pending.supplier}
                          onChange={(event) =>
                            setPending({
                              ...pending,
                              supplier: event.target.value,
                            })
                          }
                          className="mt-1 w-full border border-line dark:border-line-dark rounded-lg p-2 text-xs bg-canvas dark:bg-white/5 text-ink dark:text-ink-dark"
                        />
                      </label>
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark">
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
                          className="mt-1 w-full border border-line dark:border-line-dark rounded-lg p-2 text-xs bg-canvas dark:bg-white/5 text-ink dark:text-ink-dark dark:[color-scheme:dark]"
                        />
                      </label>
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark">
                        Tipo de despesa
                        <input
                          value={pending.expenseType}
                          onChange={(event) =>
                            setPending({
                              ...pending,
                              expenseType: event.target.value,
                            })
                          }
                          className="mt-1 w-full border border-line dark:border-line-dark rounded-lg p-2 text-xs bg-canvas dark:bg-white/5 text-ink dark:text-ink-dark"
                        />
                      </label>
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark">
                        Número do documento
                        <input
                          value={pending.documentNumber}
                          onChange={(event) =>
                            setPending({
                              ...pending,
                              documentNumber: event.target.value,
                            })
                          }
                          className="mt-1 w-full border border-line dark:border-line-dark rounded-lg p-2 text-xs bg-canvas dark:bg-white/5 text-ink dark:text-ink-dark"
                        />
                      </label>
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark">
                        Valor
                        <CurrencyInput
                          value={pending.amount}
                          onChange={(amount) =>
                            setPending({ ...pending, amount })
                          }
                          className="mt-1 w-full border border-line dark:border-line-dark rounded-lg p-2 text-xs bg-canvas dark:bg-white/5 text-ink dark:text-ink-dark"
                        />
                      </label>
                      <label className="text-[10px] font-semibold text-ink-soft dark:text-ink-soft-dark sm:col-span-2">
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
                          className="mt-1 w-full border border-line dark:border-line-dark rounded-lg p-2 text-xs bg-canvas dark:bg-white/5 text-ink dark:text-ink-dark disabled:bg-zinc-100 dark:disabled:bg-white/10 disabled:text-ink-soft dark:disabled:text-ink-soft-dark dark:[color-scheme:dark]"
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
                          className="bg-canvas dark:bg-white/5 border border-line dark:border-line-dark rounded-lg p-2"
                        >
                          <span className="text-[9px] text-ink-soft dark:text-ink-soft-dark font-semibold block">
                            {label}
                          </span>
                          <span className="text-[10px] text-ink dark:text-ink-dark font-semibold">
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {isBpoUser && approvalRecipient && (
                    <div className="rounded-lg border border-brand-navy-700/20 dark:border-brand-navy-700/25 bg-brand-blue-50 dark:bg-brand-navy-700/15 px-3 py-2 text-[10px] text-brand-navy-900 dark:text-brand-navy-700/90">
                      <strong>Fluxo selecionado:</strong> análise por IA e envio
                      para aprovação documental de {approvalRecipient.name}.
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {editingAnalysis ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Save className="h-4 w-4" />}
                        onClick={() => setEditingAnalysis(false)}
                      >
                        Salvar informações
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<Pencil className="h-4 w-4" />}
                        onClick={() => setEditingAnalysis(true)}
                      >
                        Editar informações
                      </Button>
                    )}
                    <button
                      onClick={confirmDocument}
                      disabled={
                        isAnalyzing ||
                        Boolean(approvalRecipientId && !approvalRecipient)
                      }
                      className="inline-flex items-center gap-1.5 bg-brand-green-600 hover:bg-emerald-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer transition-colors"
                    >
                      {approvalRecipientId ? (
                        <Send className="h-4 w-4" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}{" "}
                      {approvalRecipientId
                        ? "Enviar para aprovação documental"
                        : isBpoUser
                          ? "Incluir documento"
                          : "Enviar para análise do BPO"}
                    </button>
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<X className="h-4 w-4" />}
                      onClick={() => {
                        setPending(null);
                        setEditingAnalysis(false);
                        setApprovalRecipientId("");
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="text-xs text-brand-red-600 dark:text-red-300 bg-brand-red-50 dark:bg-brand-red-600/10 border border-brand-red-600/25 rounded-lg p-3">
                {error}
              </div>
            )}
          </div>

          {hasPermission("documents.upload") && (
            <div className="p-4 border-t border-line dark:border-line-dark">
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.heic,.ofx,.xml,.xlsx,.csv"
                className="hidden"
                onChange={handleFileInput}
              />
              <div className="flex gap-2">
                <IconButton
                  icon={<Paperclip />}
                  label="Anexar documento"
                  variant="solid"
                  disabled={isAnalyzing}
                  onClick={() => inputRef.current?.click()}
                />
                <input
                  value={chatPrompt}
                  onChange={(event) => setChatPrompt(event.target.value)}
                  placeholder="Escreva um contexto e anexe o documento..."
                  className="flex-1 border border-line dark:border-line-dark rounded-lg px-3 text-xs bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark placeholder:text-ink-soft dark:placeholder:text-ink-soft-dark focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30"
                />
                <button
                  onClick={() => inputRef.current?.click()}
                  title="Selecionar arquivo para enviar"
                  aria-label="Selecionar arquivo para enviar"
                  className="h-9 w-9 shrink-0 rounded-lg bg-brand-navy-900 hover:bg-brand-navy-700 text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[9px] text-ink-soft dark:text-ink-soft-dark mt-2">
                PDF, JPG, PNG, HEIC, OFX, XML, XLSX e CSV · máximo de{" "}
                {formatSize(maxDocumentSize)}
                {!persistentUploads &&
                  " · no acesso remoto, o arquivo original não é persistido"}
              </p>
            </div>
          )}
        </Card>

        {/* History + stats */}
        <aside className="space-y-4">
          <Card padding={false} className="overflow-hidden">
            <div className="p-4 border-b border-line dark:border-line-dark">
              <h3 className="text-sm font-bold text-ink dark:text-ink-dark">
                Histórico de Documentos
              </h3>
              <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark mt-0.5">
                {historyTab === "sent"
                  ? `Somente os documentos enviados por ${currentUser.name}.`
                  : historyTab === "received"
                    ? "Documentos enviados para este acesso."
                    : "Documentos cancelados deste acesso."}
              </p>
              <Tabs
                className="mt-3 w-full grid grid-cols-3 gap-1 [&>button]:justify-center"
                items={[
                  { id: "sent", label: "Meus envios", badge: companyDocuments.length },
                  { id: "received", label: "Recebidos", badge: receivedDocuments.length },
                  { id: "cancelled", label: "Cancelados", badge: cancelledDocuments.length },
                ]}
                value={historyTab}
                onChange={(id) => {
                  setHistoryTab(id as "sent" | "received" | "cancelled");
                  setStatusFilter("ALL");
                  setPreviewDocumentId(null);
                }}
              />
            </div>
            <div className="p-3 border-b border-line dark:border-line-dark flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-soft dark:text-ink-soft-dark" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar documento..."
                  className="w-full border border-line dark:border-line-dark rounded-lg pl-8 pr-2 py-2 text-xs bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark placeholder:text-ink-soft dark:placeholder:text-ink-soft-dark focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30"
                />
              </div>
              {historyTab === "cancelled" ? (
                <Badge tone="red" icon={<X className="h-3.5 w-3.5" />}>
                  Somente cancelados
                </Badge>
              ) : (
                <div className="relative">
                  <Filter className="absolute left-2 top-2.5 h-3.5 w-3.5 text-ink-soft dark:text-ink-soft-dark" />
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as typeof statusFilter)
                    }
                    className="border border-line dark:border-line-dark rounded-lg pl-7 pr-2 py-2 text-xs bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark dark:[color-scheme:dark]"
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
            <div className="divide-y divide-line dark:divide-line-dark max-h-[520px] overflow-y-auto">
              {filteredDocuments.map((document) => (
                <div
                  key={document.id}
                  className="p-4 hover:bg-canvas/60 dark:hover:bg-white/[0.03]"
                >
                  <div className="flex items-start gap-3">
                    <FileTypeIcon
                      name={document.name}
                      mimeType={document.mimeType}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <h4
                          className="text-xs font-semibold text-ink dark:text-ink-dark truncate"
                          title={document.name}
                        >
                          {document.name}
                        </h4>
                        <Badge
                          dot
                          tone={
                            document.status === "Lançado"
                              ? "green"
                              : document.status === "Compartilhado"
                                ? "navy"
                                : document.status.includes("Aguardando")
                                  ? "gold"
                                  : "neutral"
                          }
                          className="h-fit shrink-0"
                        >
                          {document.status}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark mt-1">
                        {document.category} · {document.fileSize}
                      </p>
                      <p className="text-[9px] text-ink-soft dark:text-ink-soft-dark mt-1 flex items-center gap-1">
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
                        <p className="text-[9px] text-brand-navy-700 dark:text-brand-navy-700/90 mt-1">
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
                        <p className="text-[9px] text-brand-navy-700 dark:text-brand-navy-700/90 mt-1">
                          Enviado pelo BPO: {document.sharedByName || "Equipe BPO"}
                        </p>
                      )}
                      {historyTab === "cancelled" &&
                        !isDocumentDeliveredByBpo(
                          document,
                          currentUser.id,
                        ) && (
                          <p className="text-[9px] text-ink-soft dark:text-ink-soft-dark mt-1">
                            Enviado por este acesso
                          </p>
                        )}
                      <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark mt-2 line-clamp-2">
                        {document.aiSummary || document.description}
                      </p>
                      <div className="flex gap-1 mt-2">
                        <IconButton
                          icon={<Eye />}
                          label="Visualizar"
                          variant="solid"
                          size="sm"
                          onClick={() => setPreviewDocumentId(document.id)}
                        />
                        <DocumentDownloadButton
                          url={document.signedUrl}
                          name={document.name}
                          iconOnly
                          className="text-brand-green-600 dark:text-emerald-400 hover:bg-brand-green-50 dark:hover:bg-brand-green-600/10"
                        />
                        {historyTab === "sent" &&
                          document.uploadedById === currentUser.id &&
                          hasPermission("documents.upload") && (
                          <IconButton
                            icon={<Trash2 />}
                            label="Excluir"
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(document)}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {filteredDocuments.length === 0 && (
                <EmptyState
                  icon={<FolderOpen />}
                  title="Nenhum documento encontrado."
                />
              )}
            </div>
          </Card>
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4 gap-2">
            <Card className="flex flex-col gap-2">
              <div
                className={`h-7 w-7 rounded-lg flex items-center justify-center ${TONE_CHIP[DOC_STAT_VISUALS[0].tone]}`}
              >
                <Upload className="h-3.5 w-3.5" strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-[9px] text-ink-soft dark:text-ink-soft-dark font-semibold uppercase">
                  Enviados
                </p>
                <p className="text-xl font-bold mt-0.5 text-ink dark:text-ink-dark">
                  {companyDocuments.length}
                </p>
              </div>
            </Card>
            <Card className="flex flex-col gap-2">
              <div
                className={`h-7 w-7 rounded-lg flex items-center justify-center ${TONE_CHIP[DOC_STAT_VISUALS[1].tone]}`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-[9px] text-brand-green-600 dark:text-emerald-400 font-semibold uppercase">
                  Lançados
                </p>
                <p className="text-xl font-bold mt-0.5 text-brand-green-600 dark:text-emerald-400">
                  {included}
                </p>
              </div>
            </Card>
            <Card className="flex flex-col gap-2">
              <div
                className={`h-7 w-7 rounded-lg flex items-center justify-center ${TONE_CHIP[DOC_STAT_VISUALS[2].tone]}`}
              >
                <Clock3 className="h-3.5 w-3.5" strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-[9px] text-amber-600 dark:text-brand-gold-300 font-semibold uppercase">
                  Aguardando análise
                </p>
                <p className="text-xl font-bold mt-0.5 text-amber-700 dark:text-brand-gold-300">
                  {pendingCount}
                </p>
              </div>
            </Card>
            <Card className="flex flex-col gap-2 border-brand-red-600/25 dark:border-red-500/25">
              <div
                className={`h-7 w-7 rounded-lg flex items-center justify-center ${TONE_CHIP[DOC_STAT_VISUALS[3].tone]}`}
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-[9px] text-brand-red-600 dark:text-red-400 font-semibold uppercase">
                  Cancelados
                </p>
                <p className="text-xl font-bold mt-0.5 text-brand-red-600 dark:text-red-400">
                  {rejectedCount}
                </p>
              </div>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}
