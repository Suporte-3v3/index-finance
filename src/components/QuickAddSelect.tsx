/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { MasterDataOption } from "../types";

const DEFAULT_LABEL_CLASS =
  "text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase block";
const DEFAULT_SELECT_CLASS =
  "w-full p-2 text-xs bg-zinc-50 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E] cursor-pointer dark:[color-scheme:dark]";

// Select de cadastro (fornecedor, categoria, centro de custo...) com opção de
// cadastrar um novo item sem sair da tela — usado em Contas a Pagar, Contas a
// Receber e nos lançamentos manuais, sempre que o campo referencia um cadastro
// mestre (masterData) em vez de um valor livre.
export default function QuickAddSelect({
  label,
  required,
  value,
  onChange,
  options,
  onAdd,
  placeholder = "Selecione...",
  containerClassName,
  labelClassName = DEFAULT_LABEL_CLASS,
  selectClassName = DEFAULT_SELECT_CLASS,
  canAdd = true,
}: {
  label?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: MasterDataOption[];
  onAdd: (name: string) => void | Promise<unknown>;
  placeholder?: string;
  containerClassName?: string;
  labelClassName?: string;
  selectClassName?: string;
  canAdd?: boolean;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const confirmAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed || isSaving) return;
    setAddError("");
    setIsSaving(true);
    try {
      await onAdd(trimmed);
      onChange(trimmed);
      setNewName("");
      setIsAdding(false);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Não foi possível cadastrar.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`space-y-1 ${containerClassName || ""}`}>
      {label && (
        <label className={labelClassName}>
          {label} {required && "*"}
        </label>
      )}
      {isAdding ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            type="text"
            placeholder="Nome do novo cadastro..."
            className="w-full p-2 text-xs bg-white dark:bg-[#091320] text-zinc-900 dark:text-zinc-100 border border-[#0B2C52] dark:border-[#3E6DA6]/60 rounded-sm focus:outline-none"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void confirmAdd();
              }
              if (event.key === "Escape") {
                setIsAdding(false);
                setNewName("");
              }
            }}
          />
          <button
            type="button"
            onClick={() => void confirmAdd()}
            disabled={isSaving}
            title="Salvar novo cadastro"
            className="p-2 bg-[#0B2C52] hover:bg-[#0B2C52]/90 text-white rounded-sm cursor-pointer shrink-0"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              setNewName("");
              setAddError("");
            }}
            title="Cancelar"
            className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-sm cursor-pointer shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <select
            required={required}
            className={selectClassName}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          >
            <option value="">{placeholder}</option>
            {options.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          {canAdd && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              title="Cadastrar novo"
              className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-sm cursor-pointer text-zinc-700 dark:text-zinc-200 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      {addError && <p className="text-[10px] font-semibold text-red-600">{addError}</p>}
    </div>
  );
}
