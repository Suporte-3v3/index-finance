import React, { useMemo, useState } from 'react';
import { useBPOState } from '../hooks/useBPOState';
import { SupportTicketPriority } from '../types';
import { uploadSupportAttachment } from '../services/fileUpload';
import { Clock3, FileText, MessageSquare, Paperclip, Plus, Send, X } from 'lucide-react';

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
    return <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-xs text-zinc-500">Esta área é destinada a clientes e contadores.</div>;
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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div><h2 className="text-xl font-bold text-zinc-900">Requerimentos ao BPO</h2><p className="text-xs text-zinc-500 mt-1">Abra solicitações e acompanhe a conversa com a equipe responsável.</p><span className={`inline-flex items-center gap-1.5 text-[10px] font-bold mt-2 ${bpoOnline ? 'text-emerald-700' : 'text-zinc-500'}`}><span className={`h-2 w-2 rounded-full ${bpoOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-300'}`} />Equipe BPO {bpoOnline ? 'online agora' : 'offline no momento'}</span></div>
        <button onClick={() => setFormOpen(true)} className="flex items-center gap-2 bg-[#0B2C52] text-white text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer"><Plus className="h-4 w-4" /> Novo requerimento</button>
      </div>

      {formOpen && <form onSubmit={submitTicket} className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex justify-between"><div><h3 className="text-sm font-bold">Abrir requerimento</h3><p className="text-[11px] text-zinc-500">Descreva claramente o que precisa ser atendido.</p></div><button type="button" onClick={() => setFormOpen(false)} className="cursor-pointer"><X className="h-4 w-4" /></button></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-[11px] font-bold text-zinc-600">Categoria<select value={category} onChange={e => setCategory(e.target.value as typeof category)} className="mt-1 w-full border border-zinc-200 rounded-lg p-2.5 text-xs bg-white"><option value="FINANCEIRO">Financeiro</option><option value="DOCUMENTOS">Documentos</option><option value="PAGAMENTOS">Pagamentos</option><option value="RECEBIMENTOS">Recebimentos</option><option value="CONTABIL">Contábil</option><option value="ACESSO">Acesso ao sistema</option><option value="OUTROS">Outros</option></select></label>
          <label className="text-[11px] font-bold text-zinc-600">Prioridade<select value={priority} onChange={e => setPriority(e.target.value as SupportTicketPriority)} className="mt-1 w-full border border-zinc-200 rounded-lg p-2.5 text-xs bg-white"><option value="BAIXA">Baixa</option><option value="NORMAL">Normal</option><option value="ALTA">Alta</option><option value="URGENTE">Urgente</option></select></label>
        </div>
        <input value={subject} onChange={e => setSubject(e.target.value)} required placeholder="Assunto do requerimento" className="w-full border border-zinc-200 rounded-lg p-2.5 text-xs" />
        <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={4} placeholder="Explique sua necessidade, prazo e informações importantes..." className="w-full border border-zinc-200 rounded-lg p-2.5 text-xs resize-none" />
        <div className="flex justify-end"><button className="bg-[#C8102E] text-white text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer">Enviar ao BPO</button></div>
      </form>}

      <div className="grid lg:grid-cols-[320px_1fr] gap-5 min-h-[520px]">
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-200 text-xs font-bold">Meus requerimentos ({tickets.length})</div>
          <div className="divide-y divide-zinc-100 max-h-[580px] overflow-y-auto">{tickets.map(ticket => <button key={ticket.id} onClick={() => setSelectedId(ticket.id)} className={`w-full p-4 text-left cursor-pointer ${selected?.id === ticket.id ? 'bg-[#0B2C52]/5 border-l-4 border-[#C8102E]' : 'hover:bg-zinc-50'}`}><div className="flex justify-between gap-2"><span className="font-mono text-[10px] text-zinc-400">{ticket.protocol}</span><span className="text-[9px] font-bold text-[#0B2C52]">{STATUS_LABELS[ticket.status]}</span></div><p className="text-xs font-bold text-zinc-900 mt-1 truncate">{ticket.subject}</p><div className="flex items-center gap-1 text-[10px] text-zinc-400 mt-2"><Clock3 className="h-3 w-3" /> {new Date(ticket.updatedAt).toLocaleString('pt-BR')}</div></button>)}{tickets.length === 0 && <div className="p-8 text-center text-xs text-zinc-400">Nenhum requerimento aberto.</div>}</div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl flex flex-col overflow-hidden">
          {selected ? <><div className="p-5 border-b border-zinc-200"><div className="flex flex-wrap justify-between gap-2"><div><span className="font-mono text-[10px] text-zinc-400">{selected.protocol}</span><h3 className="font-bold text-zinc-900 mt-1">{selected.subject}</h3></div><span className="text-[10px] font-bold bg-[#0B2C52]/10 text-[#0B2C52] px-2 py-1 rounded-full h-fit">{STATUS_LABELS[selected.status]}</span></div><p className="text-xs text-zinc-600 mt-3 whitespace-pre-wrap">{selected.description}</p></div>
            <div className="flex-1 p-5 space-y-3 bg-zinc-50 overflow-y-auto max-h-[360px]">{selected.messages.length === 0 && <div className="text-center text-xs text-zinc-400 py-10"><MessageSquare className="h-7 w-7 mx-auto mb-2" />Aguardando resposta da equipe BPO.</div>}{selected.messages.map(item => { const mine = item.authorId === currentUser.id; return <div key={item.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] rounded-xl px-3 py-2 ${mine ? 'bg-[#0B2C52] text-white' : 'bg-white border border-zinc-200'}`}><p className="text-[10px] font-bold opacity-70">{item.authorName}</p>{item.content && <p className="text-xs mt-0.5 whitespace-pre-wrap">{item.content}</p>}{item.attachments?.map(file => <a key={file.id} href={file.url} download={file.name} className={`mt-2 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] font-bold ${mine ? 'bg-white/10 hover:bg-white/20' : 'bg-zinc-50 border hover:bg-zinc-100'}`}><FileText className="h-4 w-4 shrink-0" /><span className="truncate">{file.name}</span></a>)}<p className="text-[9px] opacity-60 mt-1">{new Date(item.createdAt).toLocaleString('pt-BR')}</p></div></div>; })}</div>
            {!['RESOLVIDO', 'ENCERRADO'].includes(selected.status) && <form onSubmit={sendMessage} className="p-4 border-t border-zinc-200 space-y-2">{attachment && <div className="flex items-center justify-between text-[10px] bg-blue-50 text-[#0B2C52] border border-blue-100 rounded-lg px-3 py-2"><span className="truncate font-bold">{attachment.name}</span><button type="button" onClick={() => setAttachment(null)} className="cursor-pointer"><X className="h-3.5 w-3.5" /></button></div>}{sendError && <p className="text-[10px] text-rose-600">{sendError}</p>}<div className="flex gap-2"><label className="border border-zinc-200 p-2.5 rounded-lg cursor-pointer hover:bg-zinc-50" title="Anexar arquivo"><Paperclip className="h-4 w-4" /><input type="file" className="hidden" onChange={event => setAttachment(event.target.files?.[0] || null)} /></label><input value={message} onChange={e => setMessage(e.target.value)} placeholder="Escreva uma mensagem para o BPO..." className="flex-1 border border-zinc-200 rounded-lg px-3 text-xs" /><button disabled={sending} className="bg-[#C8102E] disabled:opacity-50 text-white p-2.5 rounded-lg cursor-pointer"><Send className="h-4 w-4" /></button></div></form>}</> : <div className="flex-1 flex items-center justify-center text-xs text-zinc-400">Selecione ou abra um requerimento.</div>}
        </div>
      </div>
    </div>
  );
}
