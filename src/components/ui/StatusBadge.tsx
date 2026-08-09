/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import Badge, { BadgeTone } from "./Badge";

// Mapeamento de status financeiros usados em Contas a Pagar, Contas a Receber,
// Aprovações e Conciliação para um tom consistente em todo o app. A cor nunca é
// o único sinal — o texto do próprio status já comunica o estado.
const STATUS_TONE: Record<string, BadgeTone> = {
  // Positivo / concluído
  Paga: "green",
  Pago: "green",
  Recebido: "green",
  Aprovada: "green",
  Aprovado: "green",
  Conciliada: "green",
  Conciliado: "green",
  "Em dia": "green",
  OK: "green",
  // Atenção / em andamento
  Pendente: "gold",
  Agendada: "navy",
  "A vencer": "gold",
  "A receber": "gold",
  "Aguardando aprovação": "gold",
  "Aguardando Aprovação": "gold",
  "Parcialmente paga": "gold",
  "Parcialmente recebido": "gold",
  "Parcialmente conciliada": "gold",
  "Em cobrança": "gold",
  Negociada: "gold",
  Atenção: "gold",
  Implantação: "gold",
  Rascunho: "neutral",
  // Negativo / crítico
  Vencida: "red",
  Vencido: "red",
  Cancelada: "red",
  Cancelado: "red",
  Rejeitada: "red",
  Rejeitado: "red",
  Divergente: "red",
  Atraso: "red",
  Inativo: "red",
  "Sem movimentação": "neutral",
};

export default function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const tone = STATUS_TONE[status] || "neutral";
  return (
    <Badge tone={tone} dot className={className}>
      {status}
    </Badge>
  );
}
