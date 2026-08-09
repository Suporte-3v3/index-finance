import { Prisma } from "./generated/prisma/client.js";
import { getDatabaseClient } from "./database.js";
import { writeNotification } from "./notifications.js";

type Role = "BPO_ADMIN" | "BPO_TEAM" | "CLIENT" | "ACCOUNTANT";

export interface SupportTicketAccessProfile {
  id: string;
  name: string;
  isPlatformAdmin: boolean;
  tenantMemberships: Array<{ tenantId: string; role: Role }>;
  companyMemberships: Array<{ companyId: string; role: Role }>;
}

export class SupportTicketApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const CATEGORY_TO_DATABASE = {
  FINANCEIRO: "FINANCIAL",
  DOCUMENTOS: "DOCUMENTS",
  PAGAMENTOS: "PAYMENTS",
  RECEBIMENTOS: "RECEIVABLES",
  CONTABIL: "ACCOUNTING",
  ACESSO: "ACCESS",
  OUTROS: "OTHER",
} as const;
const CATEGORY_FROM_DATABASE = {
  FINANCIAL: "FINANCEIRO",
  DOCUMENTS: "DOCUMENTOS",
  PAYMENTS: "PAGAMENTOS",
  RECEIVABLES: "RECEBIMENTOS",
  ACCOUNTING: "CONTABIL",
  ACCESS: "ACESSO",
  OTHER: "OUTROS",
} as const;
const PRIORITY_TO_DATABASE = { BAIXA: "LOW", NORMAL: "NORMAL", ALTA: "HIGH", URGENTE: "URGENT" } as const;
const PRIORITY_FROM_DATABASE = { LOW: "BAIXA", NORMAL: "NORMAL", HIGH: "ALTA", URGENT: "URGENTE" } as const;
const STATUS_TO_DATABASE = {
  ABERTO: "OPEN",
  EM_ATENDIMENTO: "IN_PROGRESS",
  AGUARDANDO_SOLICITANTE: "AWAITING_REQUESTER",
  RESOLVIDO: "RESOLVED",
  ENCERRADO: "CLOSED",
} as const;
const STATUS_FROM_DATABASE = {
  OPEN: "ABERTO",
  IN_PROGRESS: "EM_ATENDIMENTO",
  AWAITING_REQUESTER: "AGUARDANDO_SOLICITANTE",
  RESOLVED: "RESOLVIDO",
  CLOSED: "ENCERRADO",
} as const;

function text(value: unknown, field: string, max: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new SupportTicketApiError(`Informe ${field}.`);
  }
  const normalized = value.trim();
  if (normalized.length > max) throw new SupportTicketApiError(`${field} excede o tamanho permitido.`);
  return normalized;
}
function optionalText(value: unknown, max: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new SupportTicketApiError("Campo inválido.");
  const normalized = value.trim();
  if (normalized.length > max) throw new SupportTicketApiError("Campo excede o tamanho permitido.");
  return normalized || null;
}
function uuid(value: unknown, field: string, required = true) {
  const normalized = optionalText(value, 36);
  if (!normalized && !required) return null;
  if (!normalized || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new SupportTicketApiError(`${field} inválido.`);
  }
  return normalized;
}

function accessibleTenantIds(profile: SupportTicketAccessProfile) {
  return profile.tenantMemberships
    .filter(({ role }) => role === "BPO_ADMIN" || role === "BPO_TEAM")
    .map(({ tenantId }) => tenantId);
}

function isBpoForCompany(profile: SupportTicketAccessProfile, company: { id: string; tenantId: string }) {
  return (
    profile.isPlatformAdmin ||
    accessibleTenantIds(profile).includes(company.tenantId) ||
    profile.companyMemberships.some(
      ({ companyId, role }) => companyId === company.id && (role === "BPO_ADMIN" || role === "BPO_TEAM"),
    )
  );
}

function membershipRole(profile: SupportTicketAccessProfile, companyId: string): Role | null {
  const membership = profile.companyMemberships.find((item) => item.companyId === companyId);
  return membership?.role ?? null;
}

async function requireCompany(profile: SupportTicketAccessProfile, companyId: string) {
  const company = await getDatabaseClient().company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { id: true, tenantId: true },
  });
  if (!company) throw new SupportTicketApiError("Empresa não encontrada.", 404);
  return company;
}

function mapTicket(ticket: any) {
  return {
    id: ticket.id,
    protocol: ticket.protocol,
    companyId: ticket.companyId,
    requesterId: ticket.requesterId,
    requesterName: ticket.requesterName,
    requesterRole: ticket.requesterRole,
    category: CATEGORY_FROM_DATABASE[ticket.category as keyof typeof CATEGORY_FROM_DATABASE],
    subject: ticket.subject,
    description: ticket.description,
    priority: PRIORITY_FROM_DATABASE[ticket.priority as keyof typeof PRIORITY_FROM_DATABASE],
    status: STATUS_FROM_DATABASE[ticket.status as keyof typeof STATUS_FROM_DATABASE],
    assignedToId: ticket.assignedToId || undefined,
    assignedToName: ticket.assignedToName || undefined,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    messages: (ticket.messages || []).map(mapMessage),
  };
}

function mapMessage(message: any) {
  return {
    id: message.id,
    authorId: message.authorId,
    authorName: message.authorName,
    authorRole: message.authorRole,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    attachments: message.attachments || undefined,
  };
}

const TICKET_INCLUDE = { messages: { orderBy: { createdAt: "asc" as const } } };

export async function listSupportTickets(profile: SupportTicketAccessProfile) {
  const database = getDatabaseClient();
  const tenantIds = accessibleTenantIds(profile);
  const companyIds = profile.companyMemberships.map(({ companyId }) => companyId);

  const where = profile.isPlatformAdmin
    ? {}
    : {
        OR: [
          { requesterId: profile.id },
          { company: { tenantId: { in: tenantIds } } },
          { companyId: { in: companyIds }, company: { deletedAt: null } },
        ],
      };

  const tickets = await database.supportTicket.findMany({
    where,
    include: TICKET_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return tickets.map(mapTicket);
}

export async function createSupportTicket(profile: SupportTicketAccessProfile, body: any) {
  const companyId = uuid(body?.companyId, "a empresa");
  const company = await requireCompany(profile, companyId);
  const role = membershipRole(profile, companyId);
  if (role !== "CLIENT" && role !== "ACCOUNTANT" && !profile.isPlatformAdmin) {
    throw new SupportTicketApiError("Apenas clientes e contadores podem abrir chamados.", 403);
  }
  const category = CATEGORY_TO_DATABASE[body?.category as keyof typeof CATEGORY_TO_DATABASE];
  if (!category) throw new SupportTicketApiError("Categoria inválida.");
  const priority = body?.priority
    ? PRIORITY_TO_DATABASE[body.priority as keyof typeof PRIORITY_TO_DATABASE]
    : "NORMAL";
  if (!priority) throw new SupportTicketApiError("Prioridade inválida.");

  const now = new Date();
  const protocol = `REQ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${Date.now()}`;

  return getDatabaseClient().$transaction(async (transaction) => {
    const ticket = await transaction.supportTicket.create({
      data: {
        protocol,
        companyId,
        requesterId: profile.id,
        requesterName: profile.name,
        requesterRole: (role || "CLIENT") as Role,
        category,
        subject: text(body?.subject, "o assunto", 200),
        description: text(body?.description, "a descrição", 5000),
        priority,
      },
      include: TICKET_INCLUDE,
    });
    await transaction.auditLog.create({
      data: {
        tenantId: company.tenantId,
        companyId: company.id,
        userId: profile.id,
        action: "ABRIR_REQUERIMENTO_BPO",
        entityType: "SupportTicket",
        entityId: ticket.id,
        nextData: { protocol: ticket.protocol, subject: ticket.subject },
      },
    });
    await writeNotification(transaction, {
      companyId: company.id,
      title: "Novo chamado de suporte",
      message: `${profile.name} abriu o chamado ${protocol}: ${ticket.subject}`,
      type: "INFO",
    });
    return mapTicket(ticket);
  });
}

async function requireTicket(profile: SupportTicketAccessProfile, ticketId: string) {
  const ticket = await getDatabaseClient().supportTicket.findFirst({
    where: { id: uuid(ticketId, "o chamado") },
    include: { ...TICKET_INCLUDE, company: { select: { id: true, tenantId: true, deletedAt: true } } },
  });
  if (!ticket || ticket.company.deletedAt) throw new SupportTicketApiError("Chamado não encontrado.", 404);
  return ticket;
}

export async function addSupportMessage(profile: SupportTicketAccessProfile, ticketId: string, body: any) {
  const ticket = await requireTicket(profile, ticketId);
  const isBpo = isBpoForCompany(profile, ticket.company);
  if (!isBpo && ticket.requesterId !== profile.id) {
    throw new SupportTicketApiError("Sem permissão para este chamado.", 403);
  }
  const role: Role = isBpo ? "BPO_ADMIN" : (ticket.requesterRole as Role);
  const attachments = Array.isArray(body?.attachments) ? body.attachments : undefined;

  return getDatabaseClient().$transaction(async (transaction) => {
    const message = await transaction.supportMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: profile.id,
        authorName: profile.name,
        authorRole: role,
        content: text(body?.content, "a mensagem", 5000),
        attachments: attachments as Prisma.InputJsonValue | undefined,
      },
    });
    let status = ticket.status;
    if (isBpo && ticket.status === "OPEN") {
      status = "IN_PROGRESS";
      await transaction.supportTicket.update({ where: { id: ticket.id }, data: { status } });
    }
    const updated = await transaction.supportTicket.findUniqueOrThrow({
      where: { id: ticket.id },
      include: TICKET_INCLUDE,
    });
    await writeNotification(transaction, {
      companyId: ticket.companyId,
      userId: isBpo ? ticket.requesterId : undefined,
      title: "Nova resposta no chamado",
      message: `${profile.name} respondeu o chamado ${ticket.protocol}.`,
      type: "INFO",
    });
    return { ticket: mapTicket(updated), message: mapMessage(message) };
  });
}

export async function updateSupportTicket(profile: SupportTicketAccessProfile, ticketId: string, body: any) {
  const ticket = await requireTicket(profile, ticketId);
  if (!isBpoForCompany(profile, ticket.company)) {
    throw new SupportTicketApiError("Apenas a equipe BPO pode atualizar o chamado.", 403);
  }
  const data: Record<string, unknown> = {};
  if (body.status !== undefined) {
    const status = STATUS_TO_DATABASE[body.status as keyof typeof STATUS_TO_DATABASE];
    if (!status) throw new SupportTicketApiError("Status inválido.");
    data.status = status;
  }
  if (body.priority !== undefined) {
    const priority = PRIORITY_TO_DATABASE[body.priority as keyof typeof PRIORITY_TO_DATABASE];
    if (!priority) throw new SupportTicketApiError("Prioridade inválida.");
    data.priority = priority;
  }
  if (body.assignedToId !== undefined) {
    const assignedToId = uuid(body.assignedToId, "o responsável", false);
    if (assignedToId) {
      const assignee = await getDatabaseClient().user.findFirst({ where: { id: assignedToId }, select: { name: true } });
      if (!assignee) throw new SupportTicketApiError("Responsável inválido.");
      data.assignedToId = assignedToId;
      data.assignedToName = assignee.name;
    } else {
      data.assignedToId = null;
      data.assignedToName = null;
    }
  }

  return getDatabaseClient().$transaction(async (transaction) => {
    const updated = await transaction.supportTicket.update({
      where: { id: ticket.id },
      data,
      include: TICKET_INCLUDE,
    });
    await transaction.auditLog.create({
      data: {
        tenantId: ticket.company.tenantId,
        companyId: ticket.companyId,
        userId: profile.id,
        action: "ATUALIZAR_REQUERIMENTO_BPO",
        entityType: "SupportTicket",
        entityId: ticket.id,
        previousData: { status: ticket.status, priority: ticket.priority, assignedToId: ticket.assignedToId },
        nextData: { status: updated.status, priority: updated.priority, assignedToId: updated.assignedToId },
      },
    });
    return mapTicket(updated);
  });
}

export async function deleteSupportTicket(profile: SupportTicketAccessProfile, ticketId: string) {
  const ticket = await requireTicket(profile, ticketId);
  if (!isBpoForCompany(profile, ticket.company)) {
    throw new SupportTicketApiError("Apenas a equipe BPO pode excluir o chamado.", 403);
  }
  await getDatabaseClient().$transaction(async (transaction) => {
    await transaction.auditLog.create({
      data: {
        tenantId: ticket.company.tenantId,
        companyId: ticket.companyId,
        userId: profile.id,
        action: "EXCLUIR_REQUERIMENTO_BPO",
        entityType: "SupportTicket",
        entityId: ticket.id,
        previousData: {
          protocol: ticket.protocol,
          subject: ticket.subject,
          messageCount: ticket.messages.length,
        },
      },
    });
    await transaction.supportTicket.delete({ where: { id: ticket.id } });
  });
}
