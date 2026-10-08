'use client';

import type { ClipboardEvent, KeyboardEvent } from 'react';

interface CurrencyInputProps {
  /** string numérica "crua" (ex: "3000", "199.9", "") — mesmo contrato de um `<input type="number">` controlado; quem usa continua fazendo `Number(value)`. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  autoFocus?: boolean;
}

const MAX_CENTS = 10 ** 12; // R$ 9.999.999.999,99 — teto generoso só pra não deixar crescer sem limite

function centsFromValue(value: string): number {
  const n = Number(value);
  if (!value || !Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** string pronta pra `Number()` do resto do app — "" quando zerado, pra preservar o "vazio = opcional" dos campos de promo. */
function valueFromCents(cents: number): string {
  return cents === 0 ? '' : (cents / 100).toFixed(2);
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const NAVIGATION_KEYS = ['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', 'Escape'];

/** true quando o texto inteiro do campo está selecionado — digitar nesse momento deve começar um valor novo, não emendar no que já tinha. */
function isFullySelected(el: HTMLInputElement): boolean {
  return el.value.length > 0 && el.selectionStart === 0 && el.selectionEnd === el.value.length;
}

/**
 * Campo de valor em reais com máscara progressiva — à medida que o usuário
 * digita, os dígitos entram pela direita (centavos) e empurram o resto, tipo
 * "300" -> "3,00" -> "30,00" -> "300,00". Evita a armadilha de digitar
 * "3.000" num `<input type="number">` nativo (que usa ponto como separador
 * DECIMAL, não de milhar) e virar "3" sem ningém notar.
 *
 * Mantém o mesmo contrato `value`/`onChange` (string numérica crua, ex.
 * "3000.5") de um input numérico comum — quem consome continua fazendo
 * `Number(value)` sem mudar nada.
 */
export function CurrencyInput({ value, onChange, placeholder, disabled, className, id, autoFocus }: CurrencyInputProps) {
  const cents = centsFromValue(value);
  const display = value === '' ? '' : formatCents(cents);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (NAVIGATION_KEYS.includes(e.key) || e.metaKey || e.ctrlKey) return;

    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      if (isFullySelected(e.currentTarget)) {
        onChange('');
        return;
      }
      onChange(valueFromCents(Math.floor(cents / 10)));
      return;
    }

    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      // campo preenchido com tudo selecionado (ex: acabou de focar um preço já
      // salvo) -> digitar começa um valor novo, em vez de emendar no antigo
      const base = isFullySelected(e.currentTarget) ? 0 : cents;
      if (base >= MAX_CENTS) return;
      onChange(valueFromCents(base * 10 + Number(e.key)));
      return;
    }

    // qualquer outra tecla de caractere (letras, ".", ",", etc.) é ignorada —
    // o valor só é formado digitando números, nunca digitando separadores
    e.preventDefault();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!digits) return;
    let next = cents;
    for (const digit of digits) {
      if (next >= MAX_CENTS) break;
      next = next * 10 + Number(digit);
    }
    onChange(valueFromCents(next));
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={display}
      onChange={() => {}} // controlado só via onKeyDown/onPaste — sem isso o React reclama de "value sem onChange"
      onFocus={(e) => e.currentTarget.select()} // seleciona tudo ao focar — some com isFullySelected pra digitar substituir em vez de emendar
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      className={className}
    />
  );
}
