/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  loading?: boolean;
}

// Confirmação obrigatória para ações críticas (cancelar título, excluir cadastro,
// desfazer conciliação...). Sempre usar antes de disparar a ação real.
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "danger",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant="primary" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        {tone === "danger" && (
          <div className="h-9 w-9 rounded-full bg-brand-red-50 dark:bg-brand-red-600/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4.5 w-4.5 text-brand-red-600" aria-hidden="true" />
          </div>
        )}
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-ink dark:text-ink-dark">{title}</h3>
          {description && (
            <p className="text-xs text-ink-soft dark:text-ink-soft-dark leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
