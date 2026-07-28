/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";

// Máscara de dígitos (padrão de caixa eletrônico/POS): o usuário digita apenas
// números e os dois últimos sempre são os centavos — "12345" vira "123,45".
// Evita qualquer ambiguidade entre separador decimal e de milhar, e já entrega
// o valor formatado como o resto do sistema exibe (vírgula decimal, ponto de milhar).
const onlyDigits = (raw: string) => raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

const digitsToNumber = (digits: string) => (digits ? Number(digits) / 100 : 0);

const numberToDigits = (value: number) =>
  value ? Math.round(Math.abs(value) * 100).toString() : "";

const formatDigits = (digits: string) => {
  if (!digits) return "";
  const padded = digits.padStart(3, "0");
  const cents = padded.slice(-2);
  const intPart = padded.slice(0, -2).replace(/^0+(?=\d)/, "");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withThousands},${cents}`;
};

export default function CurrencyInput({
  value,
  onChange,
  className,
  required,
  placeholder = "0,00",
  disabled,
  autoFocus,
  id,
}: {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
}) {
  const [digits, setDigits] = useState(() => numberToDigits(value));

  // Resincroniza quando o valor muda por fora da digitação (troca de registro
  // em edição, reset de formulário, "usar este valor" etc.).
  useEffect(() => {
    if (Math.abs(digitsToNumber(digits) - (value || 0)) > 0.001) {
      setDigits(numberToDigits(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      id={id}
      required={required}
      disabled={disabled}
      autoFocus={autoFocus}
      className={className}
      placeholder={placeholder}
      value={formatDigits(digits)}
      onChange={(event) => {
        const raw = onlyDigits(event.target.value);
        setDigits(raw);
        onChange(digitsToNumber(raw));
      }}
    />
  );
}
