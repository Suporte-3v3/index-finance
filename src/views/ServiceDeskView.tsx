import React, { useMemo, useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import {
  SupportTicket,
  SupportTicketPriority,
  SupportTicketStatus,
} from "../types";
import { uploadSupportAttachment } from "../services/fileUpload";
import { Badge, Card, ConfirmDialog, EmptyState, IconButton, MetricCard } from "../components/ui";
import { MetricTone } from "../components/ui/MetricCard";
import { formatDateTime } from "../services/dateFormatters";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  Inbox,
  MessageSquare,
  Paperclip,
  Send,
  Trash2,
  X,
} from "lucide-react";

const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  ABERTO: "Aberto",
  EM_ATENDIMENTO: "Em atendimento",
  AGUARDANDO_SOLICITANTE: "Aguardando solicitante",
  RESOLVIDO: "Resolvido",
  ENCERRADO: "Encerrado",
};

const getInitials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

export default function ServiceDeskView() {
  const {
    currentUser,
    users,
    companies,
    supportTickets,
    addSupportMessage,
    updateSupportTicket,
    deleteSupportTicket,
    isUserOnline,
  } = useBPOState();
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | SupportTicketStatus
  >("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [ticketToDelete, setTicketToDelete] = useState<SupportTicket | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState("");
  const [feedback, setFeedback] = useState("");

  const tickets = useMemo(
    () =>
      supportTickets.filter(
        (ticket) => statusFilter === "ALL" || ticket.status === statusFilter,
      ),
    [statusFilter, supportTickets],
  );
  const selected =
    tickets.find((ticket) => ticket.id === selectedId) || tickets[0];
  const bpoUsers = users.filter((user) =>
    ["BPO_ADMIN", "BPO_TEAM"].includes(user.role),
  );

  if (currentUser.role !== "BPO_ADMIN") {
    return (
      <Card className="text-center text-xs text-ink-soft dark:text-ink-soft-dark">
        Acesso exclusivo do Administrador BPO.
      </Card>
    );
  }

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || (!message.trim() && !attachment) || sending) return;
    setSending(true);
    setSendError("");
    try {
      const attachments = attachment
        ? [await uploadSupportAttachment(attachment, selected.id)]
        : [];
      addSupportMessage(selected.id, message, attachments);
      setMessage("");
      setAttachment(null);
    } catch (reason) {
      setSendError(
        reason instanceof Error ? reason.message : "Falha ao enviar.",
      );
    } finally {
      setSending(false);
    }
  };

  const count = (statuses: SupportTicketStatus[]) =>
    supportTickets.filter((ticket) => statuses.includes(ticket.status)).length;

  const handleDelete = () => {
    if (!ticketToDelete) return;
    const protocol = ticketToDelete.protocol;
    if (!deleteSupportTicket(ticketToDelete.id)) {
      setDeleteError("Não foi possível excluir este requerimento.");
      return;
    }
    setSelectedId(null);
    setTicketToDelete(null);
    setDeleteError("");
    setFeedback(`Requerimento ${protocol} e todo o chat foram excluídos.`);
  };

  const summaryCards: { label: string; value: number; icon: typeof Inbox; tone: MetricTone }[] = [
    { label: "Novos", value: count(["ABERTO"]), icon: Inbox, tone: "navy" },
    { label: "Em atendimento", value: count(["EM_ATENDIMENTO"]), icon: Clock3, tone: "gold" },
    { label: "Aguardando cliente", value: count(["AGUARDANDO_SOLICITANTE"]), icon: AlertCircle, tone: "red" },
    { label: "Concluídos", value: count(["RESOLVIDO", "ENCERRADO"]), icon: CheckCircle2, tone: "green" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink dark:text-ink-dark tracking-tight">
          Central de Requerimentos
        </h1>
        <p className="mt-1 text-sm text-ink-soft dark:text-ink-soft-dark leading-relaxed">
          Monitore, atribua e responda solicitações de clientes e contadores.
        </p>
      </div>

      {feedback && (
        <div className="flex items-center justify-between rounded-lg border border-brand-green-600/25 bg-brand-green-50 dark:bg-brand-green-600/10 px-4 py-3 text-xs font-semibold text-brand-green-600 dark:text-emerald-300">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback("")}
            aria-label="Fechar mensagem"
            className="cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <MetricCard
            key={card.label}
            icon={<card.icon strokeWidth={2.25} />}
            label={card.label}
            value={String(card.value)}
            tone={card.tone}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as typeof statusFilter)
          }
          className="rounded-lg border border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark p-2 text-xs dark:[color-scheme:dark]"
        >
          <option value="ALL">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid min-h-[570px] gap-5 xl:grid-cols-[360px_1fr]">
        <Card padding={false} className="overflow-hidden">
          <div className="border-b border-line dark:border-line-dark p-4 text-xs font-bold text-ink dark:text-ink-dark">
            Fila de atendimento ({tickets.length})
          </div>
          <div className="max-h-[620px] divide-y divide-line dark:divide-line-dark overflow-y-auto">
            {tickets.map((ticket) => (
              <button
                type="button"
                key={ticket.id}
                onClick={() => setSelectedId(ticket.id)}
                className={`w-full cursor-pointer p-4 text-left transition-colors ${
                  selected?.id === ticket.id
                    ? "border-l-4 border-brand-red-600 bg-brand-blue-50 dark:bg-brand-navy-700/15"
                    : "hover:bg-canvas dark:hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex justify-between">
                  <span className="font-mono text-[10px] text-ink-soft dark:text-ink-soft-dark">
                    {ticket.protocol}
                  </span>
                  <span
                    className={`text-[9px] font-semibold ${
                      ticket.priority === "URGENTE"
                        ? "text-brand-red-600 dark:text-red-400"
                        : "text-ink-soft dark:text-ink-soft-dark"
                    }`}
                  >
                    {ticket.priority}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs font-semibold text-ink dark:text-ink-dark">
                  {ticket.subject}
                </p>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-ink-soft dark:text-ink-soft-dark">
                  <span className="h-4 w-4 rounded-full bg-brand-navy-900 text-white text-[7px] font-semibold flex items-center justify-center shrink-0">
                    {getInitials(ticket.requesterName)}
                  </span>
                  {ticket.requesterName} ·{" "}
                  {
                    companies.find((company) => company.id === ticket.companyId)
                      ?.tradeName
                  }
                </div>
                <p className="mt-2 text-[9px] font-semibold text-brand-navy-900 dark:text-brand-navy-700/90">
                  {STATUS_LABELS[ticket.status]}
                </p>
              </button>
            ))}
            {tickets.length === 0 && (
              <EmptyState icon={<Inbox />} title="Fila vazia." />
            )}
          </div>
        </Card>

        <Card padding={false} className="flex flex-col overflow-hidden">
          {selected ? (
            <>
              <div className="space-y-4 border-b border-line dark:border-line-dark p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="font-mono text-[10px] text-ink-soft dark:text-ink-soft-dark">
                      {selected.protocol}
                    </span>
                    <h3 className="mt-1 font-bold text-ink dark:text-ink-dark">{selected.subject}</h3>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft dark:text-ink-soft-dark">
                      <span className="h-5 w-5 rounded-full bg-brand-navy-900 text-white text-[8px] font-semibold flex items-center justify-center shrink-0">
                        {getInitials(selected.requesterName)}
                      </span>
                      Solicitante: {selected.requesterName}
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isUserOnline(selected.requesterId)
                            ? "animate-pulse bg-emerald-500"
                            : "bg-zinc-300 dark:bg-zinc-600"
                        }`}
                      />
                      <strong
                        className={
                          isUserOnline(selected.requesterId)
                            ? "text-brand-green-600 dark:text-emerald-400"
                            : "text-ink-soft dark:text-ink-soft-dark"
                        }
                      >
                        {isUserOnline(selected.requesterId)
                          ? "online"
                          : "offline"}
                      </strong>
                    </div>
                  </div>
                  <IconButton
                    icon={<Trash2 />}
                    label="Excluir requerimento"
                    variant="danger"
                    onClick={() => {
                      setDeleteError("");
                      setTicketToDelete(selected);
                    }}
                  />
                </div>

                <p className="whitespace-pre-wrap rounded-lg border border-line dark:border-line-dark bg-canvas dark:bg-white/5 p-3 text-xs text-ink dark:text-ink-dark">
                  {selected.description}
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <select
                    value={selected.status}
                    onChange={(event) =>
                      updateSupportTicket(selected.id, {
                        status: event.target.value as SupportTicketStatus,
                      })
                    }
                    className="rounded-lg border border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark p-2 text-xs dark:[color-scheme:dark]"
                  >
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selected.priority}
                    onChange={(event) =>
                      updateSupportTicket(selected.id, {
                        priority: event.target.value as SupportTicketPriority,
                      })
                    }
                    className="rounded-lg border border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark p-2 text-xs dark:[color-scheme:dark]"
                  >
                    <option value="BAIXA">Prioridade baixa</option>
                    <option value="NORMAL">Prioridade normal</option>
                    <option value="ALTA">Prioridade alta</option>
                    <option value="URGENTE">Prioridade urgente</option>
                  </select>
                  <select
                    value={selected.assignedToId || ""}
                    onChange={(event) =>
                      updateSupportTicket(selected.id, {
                        assignedToId: event.target.value,
                      })
                    }
                    className="rounded-lg border border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark p-2 text-xs dark:[color-scheme:dark]"
                  >
                    <option value="">Sem responsável</option>
                    {bpoUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} — {isUserOnline(user.id) ? "online" : "offline"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="max-h-[340px] flex-1 space-y-3 overflow-y-auto bg-canvas/60 dark:bg-white/[0.02] p-5">
                {selected.messages.length === 0 && (
                  <EmptyState icon={<MessageSquare />} title="Envie a primeira resposta ao solicitante." className="py-8" />
                )}
                {selected.messages.map((item) => {
                  const fromBpo = ["BPO_ADMIN", "BPO_TEAM"].includes(
                    item.authorRole,
                  );
                  return (
                    <div
                      key={item.id}
                      className={`flex ${fromBpo ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 ${
                          fromBpo
                            ? "bg-brand-navy-900 text-white"
                            : "border border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark"
                        }`}
                      >
                        <p className="text-[10px] font-semibold opacity-70">
                          {item.authorName}
                        </p>
                        {item.content && (
                          <p className="mt-0.5 whitespace-pre-wrap text-xs">
                            {item.content}
                          </p>
                        )}
                        {item.attachments?.map((file) => (
                          <a
                            key={file.id}
                            href={file.url}
                            download={file.name}
                            className={`mt-2 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] font-semibold ${
                              fromBpo
                                ? "bg-white/10 hover:bg-white/20"
                                : "border border-line dark:border-line-dark bg-canvas dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10"
                            }`}
                          >
                            <FileText className="h-4 w-4" />
                            <span className="truncate">{file.name}</span>
                          </a>
                        ))}
                        <p className="mt-1 text-[9px] opacity-60">
                          {formatDateTime(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!['RESOLVIDO', 'ENCERRADO'].includes(selected.status) && (
                <form onSubmit={send} className="space-y-2 border-t border-line dark:border-line-dark p-4">
                  {attachment && (
                    <div className="flex justify-between rounded-lg border border-brand-navy-700/20 dark:border-brand-navy-700/25 bg-brand-blue-50 dark:bg-brand-navy-700/15 px-3 py-2 text-[10px] text-ink dark:text-ink-dark">
                      <span className="truncate font-semibold">
                        {attachment.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAttachment(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {sendError && (
                    <p className="text-[10px] text-brand-red-600 dark:text-red-400">{sendError}</p>
                  )}
                  <div className="flex gap-2">
                    <label
                      className="cursor-pointer rounded-lg border border-line dark:border-line-dark text-ink dark:text-ink-dark p-2.5 hover:bg-canvas dark:hover:bg-white/5"
                      title="Anexar arquivo"
                    >
                      <Paperclip className="h-4 w-4" />
                      <input
                        type="file"
                        className="hidden"
                        onChange={(event) =>
                          setAttachment(event.target.files?.[0] || null)
                        }
                      />
                    </label>
                    <input
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="Responder ao solicitante..."
                      className="flex-1 rounded-lg border border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark placeholder:text-ink-soft dark:placeholder:text-ink-soft-dark px-3 text-xs focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30"
                    />
                    <button
                      type="submit"
                      disabled={sending}
                      aria-label="Enviar resposta"
                      title="Enviar resposta"
                      className="h-9 w-9 shrink-0 rounded-lg bg-brand-red-600 hover:bg-brand-red-500 disabled:opacity-50 text-white flex items-center justify-center cursor-pointer disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-xs text-ink-soft dark:text-ink-soft-dark">
              Selecione um requerimento da fila.
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(ticketToDelete)}
        onClose={() => {
          setTicketToDelete(null);
          setDeleteError("");
        }}
        onConfirm={handleDelete}
        title="Excluir requerimento e chat?"
        description={
          ticketToDelete
            ? `O requerimento ${ticketToDelete.protocol}, a descrição e todas as mensagens do chat serão removidos definitivamente. Esta ação não pode ser desfeita sem restaurar um backup.${deleteError ? ` ${deleteError}` : ""}`
            : undefined
        }
        confirmLabel="Excluir requerimento e chat"
        tone="danger"
      />
    </div>
  );
}
