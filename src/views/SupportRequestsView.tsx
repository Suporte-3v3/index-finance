import React, { useMemo, useState } from 'react';
import { useBPOState } from '../hooks/useBPOState';
import { SupportTicketPriority } from '../types';
import { uploadSupportAttachment } from '../services/fileUpload';
import { Badge, Button, Card, EmptyState, Modal } from '../components/ui';
import { Clock3, FileText, MessageSquare, Paperclip, Plus, Send, X } from 'lucide-react';
import { formatDateTime } from '../services/dateFormatters';

const STATUS_LABELS = {
  ABERTO: 'Aberto', EM_ATENDIMENTO: 'Em atendimento', AGUARDANDO_SOLICITANTE: 'Aguardando você', RESOLVIDO: 'Resolvido', ENCERRADO: 'Encerrado'
};

export default function SupportRequestsView() {
  const { currentUser, users, supportTickets, createSupportTicket, addSupportMessage, isUserOnline } = useBPOState();
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [category, setCategory] = useState<'FINANCEIRO' | 'DOCUMENTOS' | 'PAGAMENTOS' | 'RECEBIMENTOS' | 'CONTABIL' | 'ACESSO' | 'OUTROS'>('FINANCEIRO');
  const [priority, setPriority] = useState<SupportTicketPriority>('NORMAL');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const tickets = useMemo(() => supportTickets.filter(ticket => ticket.requesterId === currentUser.id), [currentUser.id, supportTickets]);
  const selected = tickets.find(ticket => ticket.id === selectedId) || tickets[0];
  const bpoOnline = users.some(user => ['BPO_ADMIN', 'BPO_TEAM'].includes(user.role) && isUserOnline(user.id));

  if (!['CLIENT', 'ACCOUNTANT'].includes(currentUser.role)) {
    return (
      <Card className="text-center text-xs text-ink-soft dark:text-ink-soft-dark">
        Esta área é destinada a clientes e contadores.
      </Card>
    );
  }

  const submitTicket = (event: React.FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    const id = createSupportTicket({ category, priority, subject: subject.trim(), description: description.trim() });
    if (id) setSelectedId(id);
    setSubject(''); setDescription(''); setPriority('NORMAL'); setFormOpen(false);
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || (!message.trim() && !attachment) || sending) return;
    setSending(true); setSendError('');
    try {
      const attachments = attachment ? [await uploadSupportAttachment(attachment)] : [];
      addSupportMessage(selected.id, message, attachments);
      setMessage(''); setAttachment(null);
    } catch (reason) { setSendError(reason instanceof Error ? reason.message : 'Falha ao enviar.'); }
    finally { setSending(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink dark:text-ink-dark tracking-tight">Requerimentos ao BPO</h1>
          <p className="text-sm text-ink-soft dark:text-ink-soft-dark leading-relaxed">Abra solicitações e acompanhe a conversa com a equipe responsável.</p>
          <Badge tone={bpoOnline ? 'green' : 'neutral'} dot className="mt-2">
            Equipe BPO {bpoOnline ? 'online agora' : 'offline no momento'}
          </Badge>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
          Novo requerimento
        </Button>
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Abrir requerimento"
        description="Descreva claramente o que precisa ser atendido."
        footer={
          <Button type="submit" form="support-new-ticket-form">
            Enviar ao BPO
          </Button>
        }
      >
        <form id="support-new-ticket-form" onSubmit={submitTicket} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide">
              Categoria
              <select value={category} onChange={e => setCategory(e.target.value as typeof category)} className="mt-1 w-full border border-line dark:border-line-dark rounded-lg p-2.5 text-xs bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark dark:[color-scheme:dark]">
                <option value="FINANCEIRO">Financeiro</option>
                <option value="DOCUMENTOS">Documentos</option>
                <option value="PAGAMENTOS">Pagamentos</option>
                <option value="RECEBIMENTOS">Recebimentos</option>
                <option value="CONTABIL">Contábil</option>
                <option value="ACESSO">Acesso ao sistema</option>
                <option value="OUTROS">Outros</option>
              </select>
            </label>
            <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide">
              Prioridade
              <select value={priority} onChange={e => setPriority(e.target.value as SupportTicketPriority)} className="mt-1 w-full border border-line dark:border-line-dark rounded-lg p-2.5 text-xs bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark dark:[color-scheme:dark]">
                <option value="BAIXA">Baixa</option>
                <option value="NORMAL">Normal</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </label>
          </div>
          <input value={subject} onChange={e => setSubject(e.target.value)} required placeholder="Assunto do requerimento" className="w-full border border-line dark:border-line-dark rounded-lg p-2.5 text-xs bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark placeholder:text-ink-soft dark:placeholder:text-ink-soft-dark" />
          <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={4} placeholder="Explique sua necessidade, prazo e informações importantes..." className="w-full border border-line dark:border-line-dark rounded-lg p-2.5 text-xs resize-none bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark placeholder:text-ink-soft dark:placeholder:text-ink-soft-dark" />
        </form>
      </Modal>

      <div className="grid lg:grid-cols-[320px_1fr] gap-5 min-h-[520px]">
        <Card padding={false} className="overflow-hidden">
          <div className="p-4 border-b border-line dark:border-line-dark text-xs font-bold text-ink dark:text-ink-dark">
            Meus requerimentos ({tickets.length})
          </div>
          <div className="divide-y divide-line dark:divide-line-dark max-h-[580px] overflow-y-auto">
            {tickets.map(ticket => (
              <button
                key={ticket.id}
                onClick={() => setSelectedId(ticket.id)}
                className={`w-full p-4 text-left cursor-pointer transition-colors ${selected?.id === ticket.id ? 'bg-brand-blue-50 dark:bg-brand-navy-700/15 border-l-4 border-brand-red-600' : 'hover:bg-canvas dark:hover:bg-white/[0.03]'}`}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-[10px] text-ink-soft dark:text-ink-soft-dark">{ticket.protocol}</span>
                  <span className="text-[9px] font-semibold text-brand-navy-900 dark:text-brand-navy-700/90">{STATUS_LABELS[ticket.status]}</span>
                </div>
                <p className="text-xs font-semibold text-ink dark:text-ink-dark mt-1 truncate">{ticket.subject}</p>
                <div className="flex items-center gap-1 text-[10px] text-ink-soft dark:text-ink-soft-dark mt-2">
                  <Clock3 className="h-3 w-3" /> {formatDateTime(ticket.updatedAt)}
                </div>
              </button>
            ))}
            {tickets.length === 0 && (
              <EmptyState icon={<MessageSquare />} title="Nenhum requerimento aberto." />
            )}
          </div>
        </Card>

        <Card padding={false} className="flex flex-col overflow-hidden">
          {selected ? (
            <>
              <div className="p-5 border-b border-line dark:border-line-dark">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <span className="font-mono text-[10px] text-ink-soft dark:text-ink-soft-dark">{selected.protocol}</span>
                    <h3 className="font-bold text-ink dark:text-ink-dark mt-1">{selected.subject}</h3>
                  </div>
                  <Badge tone="navy" className="h-fit">{STATUS_LABELS[selected.status]}</Badge>
                </div>
                <p className="text-xs text-ink-soft dark:text-ink-soft-dark mt-3 whitespace-pre-wrap">{selected.description}</p>
              </div>
              <div className="flex-1 p-5 space-y-3 bg-canvas/60 dark:bg-white/[0.02] overflow-y-auto max-h-[360px]">
                {selected.messages.length === 0 && (
                  <EmptyState icon={<MessageSquare />} title="Aguardando resposta da equipe BPO." className="py-10" />
                )}
                {selected.messages.map(item => {
                  const mine = item.authorId === currentUser.id;
                  return (
                    <div key={item.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 ${mine ? 'bg-brand-navy-900 text-white' : 'border border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark'}`}>
                        <p className="text-[10px] font-semibold opacity-70">{item.authorName}</p>
                        {item.content && <p className="text-xs mt-0.5 whitespace-pre-wrap">{item.content}</p>}
                        {item.attachments?.map(file => (
                          <a key={file.id} href={file.url} download={file.name} className={`mt-2 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] font-semibold ${mine ? 'bg-white/10 hover:bg-white/20' : 'border border-line dark:border-line-dark bg-canvas dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10'}`}>
                            <FileText className="h-4 w-4 shrink-0" /><span className="truncate">{file.name}</span>
                          </a>
                        ))}
                        <p className="text-[9px] opacity-60 mt-1">{formatDateTime(item.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!['RESOLVIDO', 'ENCERRADO'].includes(selected.status) && (
                <form onSubmit={sendMessage} className="p-4 border-t border-line dark:border-line-dark space-y-2">
                  {attachment && (
                    <div className="flex items-center justify-between text-[10px] bg-brand-blue-50 dark:bg-brand-navy-700/15 text-brand-navy-900 dark:text-brand-navy-700/90 border border-brand-navy-700/20 dark:border-brand-navy-700/25 rounded-lg px-3 py-2">
                      <span className="truncate font-semibold">{attachment.name}</span>
                      <button type="button" onClick={() => setAttachment(null)} className="cursor-pointer"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                  {sendError && <p className="text-[10px] text-brand-red-600 dark:text-red-400">{sendError}</p>}
                  <div className="flex gap-2">
                    <label className="border border-line dark:border-line-dark p-2.5 rounded-lg cursor-pointer hover:bg-canvas dark:hover:bg-white/5 text-ink dark:text-ink-dark" title="Anexar arquivo">
                      <Paperclip className="h-4 w-4" />
                      <input type="file" className="hidden" onChange={event => setAttachment(event.target.files?.[0] || null)} />
                    </label>
                    <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Escreva uma mensagem para o BPO..." className="flex-1 border border-line dark:border-line-dark rounded-lg px-3 text-xs bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark placeholder:text-ink-soft dark:placeholder:text-ink-soft-dark focus:outline-none focus:ring-2 focus:ring-brand-navy-700/30" />
                    <button
                      type="submit"
                      disabled={sending}
                      aria-label="Enviar mensagem"
                      title="Enviar mensagem"
                      className="h-9 w-9 shrink-0 rounded-lg bg-brand-red-600 hover:bg-brand-red-500 disabled:opacity-50 text-white flex items-center justify-center cursor-pointer disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-ink-soft dark:text-ink-soft-dark">
              Selecione ou abra um requerimento.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
