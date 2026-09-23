'use client';

import { useMemo } from 'react';
import { formatPrice } from '@/lib/currency';

export interface VariantStockAllocatorRow {
  /** comboKey (produto ainda não existe) ou sku.id (produto já existe) */
  key: string;
  label: string;
  /** estoque já existente desta variação — só faz sentido numa reposição, não no cadastro inicial */
  currentStock?: number;
}

interface VariantStockAllocatorProps {
  rows: VariantStockAllocatorRow[];
  totalQuantity: string;
  onTotalQuantityChange: (value: string) => void;
  totalCost: string;
  onTotalCostChange: (value: string) => void;
  allocations: Record<string, string>;
  onAllocationChange: (key: string, value: string) => void;
  note?: string;
  onNoteChange?: (value: string) => void;
}

/**
 * Tabela de distribuição de um lote entre variações (cor/tamanho): total do
 * lote + quantidade por combinação, com conferência obrigatória ("faltam X")
 * antes de liberar o envio. Usada tanto no cadastro inicial de um produto com
 * variação quanto nas reposições seguintes — mesma mecânica, pra não haver
 * dois jeitos diferentes de fazer a mesma coisa.
 */
export function VariantStockAllocator({
  rows,
  totalQuantity,
  onTotalQuantityChange,
  totalCost,
  onTotalCostChange,
  allocations,
  onAllocationChange,
  note,
  onNoteChange,
}: VariantStockAllocatorProps) {
  const totalQty = Number(totalQuantity) || 0;
  const totalCostNum = Number(totalCost) || 0;
  const unitCost = totalQty > 0 && totalCostNum > 0 ? totalCostNum / totalQty : 0;

  const allocatedSum = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(allocations[row.key]) || 0), 0),
    [rows, allocations],
  );
  const remaining = totalQty - allocatedSum;

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium text-slate-700">Quantidade total do lote</label>
          <input
            type="number"
            min={1}
            value={totalQuantity}
            onChange={(e) => onTotalQuantityChange(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Valor total pago (R$)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={totalCost}
            onChange={(e) => onTotalCostChange(e.target.value)}
            placeholder="quanto pagou pelo lote inteiro"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
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
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Ex: fornecedor X"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
        )}
      </div>

      {totalQty > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Distribua entre as variações</h3>
            <span className={`text-xs font-semibold ${remaining === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {remaining === 0 ? 'Quantidade batendo ✓' : `Faltam ${remaining} de ${totalQty} unid.`}
            </span>
          </div>
          <div className="mt-2 space-y-2">
            {rows.map((row) => (
              <div key={row.key} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 p-2.5">
                <span className="flex-1 text-sm text-slate-700">
                  {row.label}
                  {row.currentStock !== undefined && (
                    <span className="ml-1.5 text-xs text-slate-400">({row.currentStock} em estoque)</span>
                  )}
                </span>
                <input
                  type="number"
                  min={0}
                  value={allocations[row.key] ?? ''}
                  onChange={(e) => onAllocationChange(row.key, e.target.value)}
                  placeholder="Qtd."
                  className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 text-right text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
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

/** `canSubmit` compartilhado entre cadastro inicial e reposição: total e custo preenchidos, e a soma das linhas bate exatamente. */
export function allocatorCanSubmit(rows: VariantStockAllocatorRow[], totalQuantity: string, totalCost: string, allocations: Record<string, string>): boolean {
  const totalQty = Number(totalQuantity) || 0;
  const totalCostNum = Number(totalCost) || 0;
  const allocatedSum = rows.reduce((sum, row) => sum + (Number(allocations[row.key]) || 0), 0);
  return totalQty > 0 && totalCostNum > 0 && allocatedSum > 0 && allocatedSum === totalQty;
}
