'use client';

import { Minus, Plus } from 'lucide-react';
import type { VariantStockAllocatorRow } from './VariantStockAllocator';

interface VariantAllocationRowProps {
  row: VariantStockAllocatorRow;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** Só dígitos — impede negativo/decimal contaminarem a soma do lote. */
function sanitizeQuantity(raw: string): string {
  return raw.replace(/[^0-9]/g, '');
}

/**
 * Uma linha do distribuidor de lote (combinação + quantidade). Empilha em
 * telas estreitas (rótulo acima, controles full-width) e volta ao layout
 * horizontal a partir de `sm:` — e nunca trunca rótulos longos tipo "Verde
 * Militar / Extra Grande".
 */
export function VariantAllocationRow({ row, value, onChange, disabled = false }: VariantAllocationRowProps) {
  const current = Number(value) || 0;

  const step = (delta: number) => {
    const next = Math.max(0, current + delta);
    onChange(String(next));
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-100 p-2.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="flex-1 break-words text-sm text-slate-700">
        {row.label}
        {row.currentStock !== undefined && (
          <span className="ml-1.5 text-xs text-slate-400">({row.currentStock} em estoque)</span>
        )}
      </span>
      <div className="flex items-center gap-1.5 self-end sm:self-auto">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={disabled || current <= 0}
          aria-label={`Diminuir quantidade de ${row.label}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
        >
          <Minus size={14} />
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(sanitizeQuantity(e.target.value))}
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          placeholder="Qtd."
          className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-center text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50"
        />
        <button
          type="button"
          onClick={() => step(1)}
          disabled={disabled}
          aria-label={`Aumentar quantidade de ${row.label}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
