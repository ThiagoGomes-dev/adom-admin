'use client';

import { useId, useMemo } from 'react';
import { formatPrice } from '@/lib/currency';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { VariantAllocationRow } from './VariantAllocationRow';

export interface VariantStockAllocatorRow {
  /** comboKey (produto ainda não existe) ou sku.id (produto já existe) */
  key: string;
  label: string;
  /** estoque já existente desta variação — só faz sentido numa reposição, não no cadastro inicial */
  currentStock?: number;
}

export type AllocationStatus = 'empty' | 'incomplete' | 'exact' | 'excess';

interface VariantStockAllocatorProps {
  rows: VariantStockAllocatorRow[];
  totalQuantity: string;
  onTotalQuantityChange: (value: string) => void;
  totalCost: string;
  onTotalCostChange: (value: string) => void;
  allocations: Record<string, string>;
  onAllocationChange: (key: string, value: string) => void;
  /** substitui todas as alocações de uma vez — usado pelo botão "Distribuir igualmente" */
  onAllocationsReplace?: (next: Record<string, string>) => void;
  note?: string;
  onNoteChange?: (value: string) => void;
  /** trava os campos durante o envio, pra impedir double-submit */
  disabled?: boolean;
}

function sumAllocations(rows: VariantStockAllocatorRow[], allocations: Record<string, string>): number {
  return rows.reduce((sum, row) => sum + (Number(allocations[row.key]) || 0), 0);
}

/** Divide o total igualmente entre as linhas, dando o resto da divisão às primeiras (ex: 7 ÷ 3 -> 3, 2, 2). */
export function distributeEvenly(rows: VariantStockAllocatorRow[], totalQuantity: number): Record<string, string> {
  if (rows.length === 0 || totalQuantity <= 0) return {};
  const base = Math.floor(totalQuantity / rows.length);
  const remainder = totalQuantity % rows.length;
  const next: Record<string, string> = {};
  rows.forEach((row, i) => {
    next[row.key] = String(base + (i < remainder ? 1 : 0));
  });
  return next;
}

/**
 * Estado da distribuição, usado tanto pra pintar a barra de progresso quanto
 * pra decidir a mensagem/estado do botão de confirmar. Separar `excess` de
 * `incomplete` evita o "Faltam -3 unid." sem sentido que aparecia quando a
 * soma das variações passava do total do lote.
 */
export function getAllocationStatus(
  rows: VariantStockAllocatorRow[],
  totalQuantity: string,
  allocations: Record<string, string>,
): AllocationStatus {
  const totalQty = Number(totalQuantity) || 0;
  if (totalQty <= 0) return 'empty';
  const allocatedSum = sumAllocations(rows, allocations);
  if (allocatedSum === totalQty) return 'exact';
  if (allocatedSum > totalQty) return 'excess';
  return 'incomplete';
}

/** `canSubmit` compartilhado entre cadastro inicial e reposição: total e custo preenchidos, e a soma das linhas bate exatamente. */
export function allocatorCanSubmit(rows: VariantStockAllocatorRow[], totalQuantity: string, totalCost: string, allocations: Record<string, string>): boolean {
  const totalCostNum = Number(totalCost) || 0;
  return getAllocationStatus(rows, totalQuantity, allocations) === 'exact' && totalCostNum > 0;
}

const STATUS_STYLES: Record<
  AllocationStatus,
  { bar: string; text: string; label: (allocated: number, total: number) => string }
> = {
  empty: {
    bar: 'bg-slate-200',
    text: 'text-slate-400',
    label: () => 'Informe a quantidade total do lote pra começar a distribuir.',
  },
  incomplete: {
    bar: 'bg-amber-400',
    text: 'text-amber-600',
    label: (allocated, total) => `Faltam ${total - allocated} de ${total} unid.`,
  },
  exact: {
    bar: 'bg-emerald-500',
    text: 'text-emerald-600',
    label: () => 'Quantidade batendo ✓',
  },
  excess: {
    bar: 'bg-red-500',
    text: 'text-red-600',
    label: (allocated, total) => `${allocated - total} unid. além do lote — ajuste a distribuição abaixo`,
  },
};

/**
 * Tabela de distribuição de um lote entre variações (cor/tamanho): total do
 * lote + quantidade por combinação, com barra de progresso e reconciliação
 * obrigatória ("faltam X" / "além do lote") antes de liberar o envio. Usada
 * tanto no cadastro inicial de um produto com variação quanto nas reposições
 * seguintes — mesma mecânica, pra não haver dois jeitos diferentes de fazer a
 * mesma coisa.
 */
export function VariantStockAllocator({
  rows,
  totalQuantity,
  onTotalQuantityChange,
  totalCost,
  onTotalCostChange,
  allocations,
  onAllocationChange,
  onAllocationsReplace,
  note,
  onNoteChange,
  disabled = false,
}: VariantStockAllocatorProps) {
  const progressLabelId = useId();
  const totalQty = Number(totalQuantity) || 0;
  const totalCostNum = Number(totalCost) || 0;
  const unitCost = totalQty > 0 && totalCostNum > 0 ? totalCostNum / totalQty : 0;

  const allocatedSum = useMemo(() => sumAllocations(rows, allocations), [rows, allocations]);
  const status = getAllocationStatus(rows, totalQuantity, allocations);
  const progressPct = totalQty > 0 ? Math.min(100, (allocatedSum / totalQty) * 100) : 0;
  const style = STATUS_STYLES[status];

  const handleDistributeEvenly = () => {
    const next = distributeEvenly(rows, totalQty);
    if (onAllocationsReplace) {
      onAllocationsReplace(next);
    } else {
      rows.forEach((row) => onAllocationChange(row.key, next[row.key] ?? ''));
    }
  };

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium text-slate-700">Quantidade total do lote</label>
          <input
            type="number"
            min={1}
            step={1}
            value={totalQuantity}
            disabled={disabled}
            onChange={(e) => onTotalQuantityChange(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Valor total pago (R$)</label>
          <CurrencyInput
            value={totalCost}
            disabled={disabled}
            onChange={onTotalCostChange}
            placeholder="quanto pagou pelo lote inteiro"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50"
          />
        </div>
        {onNoteChange && (
          <div>
            <label className="text-sm font-medium text-slate-700">
              Observação <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              type="text"
              value={note ?? ''}
              disabled={disabled}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Ex: fornecedor X"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50"
            />
          </div>
        )}
      </div>

      {totalQty > 0 && (
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id={progressLabelId} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Distribua entre as variações
            </h3>
            <button
              type="button"
              onClick={handleDistributeEvenly}
              disabled={disabled || rows.length === 0}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Distribuir igualmente
            </button>
          </div>

          <div
            role="progressbar"
            aria-labelledby={progressLabelId}
            aria-valuemin={0}
            aria-valuemax={totalQty}
            aria-valuenow={Math.min(allocatedSum, totalQty)}
            aria-valuetext={`${allocatedSum} de ${totalQty} unidades distribuídas`}
            className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100"
          >
            <div className={`h-full rounded-full transition-all duration-200 ${style.bar}`} style={{ width: `${progressPct}%` }} />
          </div>
          <p role="status" aria-live="polite" className={`mt-1.5 text-xs font-semibold ${style.text}`}>
            {style.label(allocatedSum, totalQty)}
          </p>

          <div className="mt-3 space-y-2">
            {rows.map((row) => (
              <VariantAllocationRow
                key={row.key}
                row={row}
                value={allocations[row.key] ?? ''}
                onChange={(value) => onAllocationChange(row.key, value)}
                disabled={disabled}
              />
            ))}
          </div>

          {unitCost > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              Custo por unidade neste lote: <span className="font-semibold text-slate-700">{formatPrice(unitCost)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
