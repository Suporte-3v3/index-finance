/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import DocumentPreview from "../components/DocumentPreview";
import DocumentDownloadButton from "../components/DocumentDownloadButton";
import { formatDate, formatDateTime } from "../services/dateFormatters";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Modal,
  Tabs,
} from "../components/ui";
import {
  Check,
  X,
  ShieldCheck,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  History,
  MessageSquare,
  Eye,
} from "lucide-react";

export default function ApprovalsView() {
  const {
    activeCompany,
    approvals,
    decideApproval,
    currentUser,
    isApprovalVisibleToCurrentUser,
    canDecideApproval,
  } = useBPOState();

  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Decision Modal State
  const [decisionApprovalId, setDecisionApprovalId] = useState<string | null>(
    null,
  );
  const [decisionType, setDecisionType] = useState<
    "Aprovada" | "Rejeitada" | "Ajuste solicitado" | null
  >(null);
  const [comment, setComment] = useState("");
  const [previewApprovalId, setPreviewApprovalId] = useState<string | null>(
    null,
  );

  if (!activeCompany) return null;

  const companyApprovals = approvals.filter(
    (a) =>
      a.companyId === activeCompany.id &&
      isApprovalVisibleToCurrentUser(a),
  );

  const pendingApprovals = companyApprovals.filter(
    (a) => a.status === "Pendente",
  );
  const historyApprovals = companyApprovals.filter(
    (a) => a.status !== "Pendente",
  );
  const decisionApproval = companyApprovals.find(
    (approval) => approval.id === decisionApprovalId,
  );
  const decisionIsDocument = decisionApproval?.type === "DOCUMENTO";
  const previewApproval = companyApprovals.find(
    (approval) => approval.id === previewApprovalId,
  );

  const openDecisionModal = (
    id: string,
    type: "Aprovada" | "Rejeitada" | "Ajuste solicitado",
  ) => {
    setDecisionApprovalId(id);
    setDecisionType(type);
    setComment("");
  };

  const handleDecisionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionApprovalId || !decisionType) return;

    if (decisionType !== "Aprovada" && !comment.trim()) {
      alert("Justificativa é obrigatória para rejeições.");
      return;
    }

    decideApproval(decisionApprovalId, decisionType, comment);
    setDecisionApprovalId(null);
    setDecisionType(null);
    setComment("");
  };

  return (
    <div id="approvals-root" className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            id="approvals-title"
            className="text-2xl sm:text-3xl font-bold text-ink dark:text-ink-dark tracking-tight"
          >
            Central de Aprovações
          </h1>
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark leading-relaxed">
            Documentos aparecem somente para o BPO remetente e o destinatário
            selecionado.
          </p>
        </div>

        <Badge tone="green" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
          LGPD & Assinatura Digital Ativos
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs
        items={[
          { id: "pending", label: "Aprovações Pendentes", badge: pendingApprovals.length },
          { id: "history", label: "Histórico e Decisões", badge: historyApprovals.length },
        ]}
        value={activeTab}
        onChange={(id) => setActiveTab(id as "pending" | "history")}
      />

      {/* Preview Modal */}
      <Modal
        open={Boolean(previewApproval)}
        onClose={() => setPreviewApprovalId(null)}
        title="Visualização do documento"
        description={previewApproval?.attachmentName || previewApproval?.description}
        size="xl"
        footer={
          previewApproval && (
            <>
              <DocumentDownloadButton
                url={previewApproval.attachmentUrl}
                name={previewApproval.attachmentName || previewApproval.description}
                className="border border-brand-blue-50 dark:border-brand-navy-700/40 text-brand-navy-900 dark:text-brand-navy-700/90 hover:bg-brand-blue-50 dark:hover:bg-brand-navy-700/20"
              />
              <Button onClick={() => setPreviewApprovalId(null)}>Fechar</Button>
            </>
          )
        }
      >
        {previewApproval && (
          <>
            <p className="text-xs text-ink-soft dark:text-ink-soft-dark mb-3 -mt-2">
              Enviado por <strong className="text-ink dark:text-ink-dark">{previewApproval.requesterName}</strong>
            </p>
            <div className="h-[60vh] bg-canvas dark:bg-white/[0.03] rounded-lg p-3 sm:p-5">
              <DocumentPreview
                name={
                  previewApproval.attachmentName || previewApproval.description
                }
                url={previewApproval.attachmentUrl}
              />
            </div>
          </>
        )}
      </Modal>

      {/* Decision Dialog Modal */}
      <Modal
        open={Boolean(decisionApprovalId && decisionType)}
        onClose={() => {
          setDecisionApprovalId(null);
          setDecisionType(null);
        }}
        size="sm"
        title={
          decisionType
            ? `Confirmar ${
                decisionType === "Aprovada"
                  ? decisionIsDocument
                    ? "Validação"
                    : "Aprovação"
                  : "Rejeição"
              } do ${decisionIsDocument ? "Documento" : "Pagamento"}`
            : undefined
        }
        description={
          decisionType === "Aprovada"
            ? decisionIsDocument
              ? "O pré-lançamento entrará no financeiro."
              : "Esta ação autoriza o BPO a agendar e liquidar este débito."
            : "Descreva detalhadamente o motivo para a correção."
        }
        footer={
          <>
            <Button
              type="button"
              variant="text"
              onClick={() => {
                setDecisionApprovalId(null);
                setDecisionType(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="approval-decision-form"
              className={
                decisionType === "Aprovada"
                  ? "bg-brand-green-600! hover:bg-emerald-600!"
                  : "bg-brand-red-600! hover:bg-brand-red-500!"
              }
            >
              Confirmar Assinatura
            </Button>
          </>
        }
      >
        <form
          id="approval-decision-form"
          onSubmit={handleDecisionSubmit}
          className="space-y-4 text-xs"
        >
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">
              Justificativa / Comentário{" "}
              {decisionType === "Rejeitada" && (
                <span className="text-brand-red-600">*</span>
              )}
            </label>
            <textarea
              required={decisionType !== "Aprovada"}
              placeholder="Descreva observações para o BPO..."
              rows={4}
              className="w-full p-2.5 bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark border border-line dark:border-line-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30 text-xs"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <div className="bg-canvas dark:bg-white/5 p-3 rounded-lg text-[10px] text-ink-soft dark:text-ink-soft-dark leading-normal font-mono">
            Assinante: <strong className="text-ink dark:text-ink-dark">{currentUser.name}</strong> (
            {currentUser.role})<br />
            Token de Autenticação: SEC_
            {Math.random().toString(16).substr(2, 10).toUpperCase()}
            <br />
            IP do Dispositivo: 186.20.103.54
          </div>
        </form>
      </Modal>

      {/* Main List */}
      <div className="space-y-4">
        {activeTab === "pending" ? (
          pendingApprovals.length === 0 ? (
            <Card className="border-dashed">
              <EmptyState
                icon={<ShieldCheck />}
                title="Uau! Nenhuma aprovação pendente para esta empresa."
                description="A equipe do BPO está em dia com os lançamentos."
              />
            </Card>
          ) : (
            pendingApprovals.map((apv) => (
              <Card
                key={apv.id}
                id={`approval-pending-card-${apv.id}`}
                padding={false}
                className="overflow-hidden"
              >
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Main details */}
                  <div className="space-y-1.5 flex-grow">
                    <div className="flex items-center gap-2">
                      <Badge tone="gold" className="font-mono uppercase">
                        {apv.type === "DOCUMENTO"
                          ? "DOCUMENTO PENDENTE"
                          : "PAGAMENTO PENDENTE"}
                      </Badge>
                      <span className="text-xs text-ink-soft dark:text-ink-soft-dark">
                        Solicitado em{" "}
                        {formatDate(apv.createdAt)}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-ink dark:text-ink-dark">
                      {apv.description}
                    </h3>
                    <p className="text-xs text-ink-soft dark:text-ink-soft-dark">
                      Solicitante: {apv.requesterName} |{" "}
                      {apv.type === "DOCUMENTO" ? "Documento de" : "Vence em"}
                      :{" "}
                      <strong className="text-ink dark:text-ink-dark">
                        {formatDate(apv.dueDate)}
                      </strong>
                    </p>
                    {apv.type === "DOCUMENTO" && apv.recipientName && (
                      <p className="text-[10px] text-brand-navy-700 dark:text-brand-navy-700/90">
                        Destinatário: {apv.recipientName} (
                        {apv.recipientRole === "CLIENT"
                          ? "Cliente"
                          : "Contador"}
                        )
                      </p>
                    )}
                  </div>

                  {/* Amount & Actions */}
                  <div className="flex flex-row md:flex-col items-baseline md:items-end justify-between md:justify-center gap-2 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark uppercase font-semibold block">
                        {apv.type === "DOCUMENTO"
                          ? "Arquivo para validação"
                          : "Valor Solicitado"}
                      </span>
                      <span
                        className={`${apv.type === "DOCUMENTO" ? "text-xs max-w-48 truncate block" : "text-lg"} font-bold text-ink dark:text-ink-dark font-mono`}
                      >
                        {apv.type === "DOCUMENTO"
                          ? apv.attachmentName
                          : `R$ ${apv.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                      </span>
                    </div>

                    {canDecideApproval(apv) ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() =>
                            openDecisionModal(apv.id, "Aprovada")
                          }
                          className="bg-brand-green-50 hover:bg-brand-green-50/70 dark:bg-brand-green-600/10 dark:hover:bg-brand-green-600/20 border border-brand-green-600/25 dark:border-brand-green-600/25 text-brand-green-600 dark:text-emerald-300 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" /> Aprovar
                        </button>
                        <button
                          onClick={() =>
                            openDecisionModal(apv.id, "Ajuste solicitado")
                          }
                          className="bg-brand-gold-300/20 hover:bg-brand-gold-300/30 dark:bg-brand-gold-600/10 dark:hover:bg-brand-gold-600/20 border border-brand-gold-600/30 dark:border-brand-gold-600/25 text-amber-700 dark:text-brand-gold-300 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <MessageSquare className="h-3.5 w-3.5" /> Solicitar
                          ajuste
                        </button>
                        <button
                          onClick={() =>
                            openDecisionModal(apv.id, "Rejeitada")
                          }
                          className="bg-brand-red-50 hover:bg-brand-red-50/70 dark:bg-brand-red-600/10 dark:hover:bg-brand-red-600/20 border border-brand-red-600/25 dark:border-brand-red-600/25 text-brand-red-600 dark:text-red-300 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" /> Rejeitar
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-brand-red-600 dark:text-red-400 bg-brand-red-50 dark:bg-brand-red-600/10 px-2 py-1 rounded">
                        Apenas leitura
                      </span>
                    )}
                  </div>
                </div>

                {/* Attachment view */}
                {apv.attachmentName && (
                  <div className="px-5 py-3 bg-canvas dark:bg-white/[0.03] border-t border-line dark:border-line-dark flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-ink dark:text-ink-dark font-medium">
                      <FileText className="h-4 w-4 text-ink-soft dark:text-ink-soft-dark shrink-0" />
                      <span>
                        {apv.type === "DOCUMENTO"
                          ? "Documento anexado"
                          : "Fatura / boleto anexo"}
                        : <strong>{apv.attachmentName}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<Eye className="h-3.5 w-3.5" />}
                        onClick={() => setPreviewApprovalId(apv.id)}
                      >
                        Visualizar
                      </Button>
                      <DocumentDownloadButton
                        url={apv.attachmentUrl}
                        name={apv.attachmentName}
                        className="border border-brand-green-600/20 dark:border-brand-green-600/25 text-brand-green-600 dark:text-emerald-300 hover:bg-brand-green-50 dark:hover:bg-brand-green-600/10"
                      />
                    </div>
                  </div>
                )}
              </Card>
            ))
          )
        ) : historyApprovals.length === 0 ? (
          <Card>
            <EmptyState
              icon={<History />}
              title="Nenhuma aprovação arquivada no histórico de auditoria."
            />
          </Card>
        ) : (
          historyApprovals.map((apv) => {
            const isExpanded = expandedId === apv.id;
            const step = apv.history[apv.history.length - 1]; // Latest decision step

            return (
              <Card key={apv.id} padding={false} className="overflow-hidden">
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge tone={apv.status === "Aprovada" ? "green" : "red"} dot>
                        {apv.status.toUpperCase()}
                      </Badge>
                      <span className="text-[11px] text-ink-soft dark:text-ink-soft-dark font-mono">
                        ID: {apv.id}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-ink dark:text-ink-dark">
                      {apv.description}
                    </h3>
                    <p className="text-xs text-ink-soft dark:text-ink-soft-dark">
                      Decidido em{" "}
                      {step
                        ? formatDateTime(step.timestamp)
                        : formatDate(new Date())}{" "}
                      por <strong className="text-ink dark:text-ink-dark">{step?.userName || "Cliente"}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-6 justify-between md:justify-end shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] text-ink-soft dark:text-ink-soft-dark font-semibold block uppercase">
                        {apv.type === "DOCUMENTO" ? "Tipo" : "Valor Final"}
                      </span>
                      <span className="text-sm font-bold text-ink dark:text-ink-dark font-mono">
                        {apv.type === "DOCUMENTO"
                          ? "Documento"
                          : `R$ ${apv.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                      </span>
                    </div>
                    <IconButton
                      icon={isExpanded ? <ChevronUp /> : <ChevronDown />}
                      label={isExpanded ? "Recolher" : "Expandir"}
                      variant="default"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : apv.id)}
                    />
                  </div>
                </div>

                {/* Expansion for Step audits */}
                {isExpanded && (
                  <div className="p-5 bg-canvas/60 dark:bg-white/[0.02] border-t border-line dark:border-line-dark space-y-4 text-xs text-ink dark:text-ink-dark">
                    <h4 className="font-bold text-ink dark:text-ink-dark flex items-center gap-1">
                      <History className="h-4 w-4" /> Rastro Histórico de
                      Assinatura
                    </h4>

                    <div className="space-y-3 pl-4 border-l-2 border-line dark:border-line-dark">
                      {apv.history.map((h, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between font-mono text-[10px]">
                            <span className="font-semibold text-ink dark:text-ink-dark">
                              {h.userName} ({h.role.replace(/_/g, " ")})
                            </span>
                            <span className="text-ink-soft dark:text-ink-soft-dark">
                              {formatDateTime(h.timestamp)}
                            </span>
                          </div>
                          <div className="bg-surface dark:bg-surface-dark p-2.5 rounded-lg border border-line dark:border-line-dark">
                            <span
                              className={`text-[10px] font-semibold uppercase ${h.decision === "Aprovada" ? "text-brand-green-600 dark:text-emerald-400" : "text-brand-red-600 dark:text-red-400"}`}
                            >
                              {h.decision}
                            </span>
                            {h.comment && (
                              <p className="mt-1 text-xs text-ink dark:text-ink-dark flex items-start gap-1">
                                <MessageSquare className="h-3 w-3 mt-0.5 text-ink-soft dark:text-ink-soft-dark shrink-0" />
                                <span>"{h.comment}"</span>
                              </p>
                            )}
                          </div>
                          <div className="text-[9px] text-ink-soft dark:text-ink-soft-dark font-mono pl-1">
                            IP Origem: {h.ipAddress} | User Agent:{" "}
                            {h.userAgent.substring(0, 50)}...
                          </div>
                        </div>
                      ))}
                      {apv.history.length === 0 && (
                        <div className="space-y-1">
                          <span className="font-semibold text-ink dark:text-ink-dark font-mono">
                            Assinatura Automática / Legado
                          </span>
                          <p className="bg-surface dark:bg-surface-dark p-2.5 rounded-lg border border-line dark:border-line-dark italic text-ink-soft dark:text-ink-soft-dark">
                            Sem rastro adicional de formulário.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {apv.attachmentName && (
                  <div className="px-5 py-3 bg-canvas dark:bg-white/[0.03] border-t border-line dark:border-line-dark flex items-center justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate text-ink dark:text-ink-dark font-medium">
                      {apv.attachmentName}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<Eye className="h-3.5 w-3.5" />}
                        onClick={() => setPreviewApprovalId(apv.id)}
                      >
                        Visualizar
                      </Button>
                      <DocumentDownloadButton
                        url={apv.attachmentUrl}
                        name={apv.attachmentName}
                        className="border border-brand-green-600/20 dark:border-brand-green-600/25 text-brand-green-600 dark:text-emerald-300 hover:bg-brand-green-50 dark:hover:bg-brand-green-600/10"
                      />
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
