'use client';

import { formatPrice } from '@/lib/currency';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { VariantStockAllocator, type VariantStockAllocatorRow } from '../VariantStockAllocator';

interface ProductStockStepProps {
  hasVariants: boolean;
  draftAllocatorRows: VariantStockAllocatorRow[];
  initialTotalQuantity: string;
  onInitialTotalQuantityChange: (value: string) => void;
  initialTotalCost: string;
  onInitialTotalCostChange: (value: string) => void;
  initialAllocations: Record<string, string>;
  onInitialAllocationChange: (key: string, value: string) => void;
  onInitialAllocationsReplace: (next: Record<string, string>) => void;
  initialNote: string;
  onInitialNoteChange: (value: string) => void;
  initialSimpleQuantity: string;
  onInitialSimpleQuantityChange: (value: string) => void;
  initialSimpleCost: string;
  onInitialSimpleCostChange: (value: string) => void;
  initialSimpleNote: string;
  onInitialSimpleNoteChange: (value: string) => void;
}

/**
 * Passo 3 do cadastro (produto novo, ainda não existe no banco) — estoque
 * inicial, opcional. Reaproveita o mesmo `VariantStockAllocator` usado na
 * reposição em edição (`RestockPanel`), pra herdar a mesma experiência de
 * distribuição de lote nos dois fluxos.
 */
export function ProductStockStep({
  hasVariants,
  draftAllocatorRows,
  initialTotalQuantity,
  onInitialTotalQuantityChange,
  initialTotalCost,
  onInitialTotalCostChange,
  initialAllocations,
  onInitialAllocationChange,
  onInitialAllocationsReplace,
  initialNote,
  onInitialNoteChange,
  initialSimpleQuantity,
  onInitialSimpleQuantityChange,
  initialSimpleCost,
  onInitialSimpleCostChange,
  initialSimpleNote,
  onInitialSimpleNoteChange,
}: ProductStockStepProps) {
  if (hasVariants) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Estoque inicial</h2>
        <p className="mt-1 text-xs text-slate-400">
          Opcional — pode cadastrar o produto sem estoque ainda e repor depois aqui mesmo. Se preencher, informe o
          valor total do lote e distribua a quantidade entre cor/tamanho (a soma precisa bater com o total).
        </p>
        <div className="mt-4">
          <VariantStockAllocator
            rows={draftAllocatorRows}
            totalQuantity={initialTotalQuantity}
            onTotalQuantityChange={onInitialTotalQuantityChange}
            totalCost={initialTotalCost}
            onTotalCostChange={onInitialTotalCostChange}
            allocations={initialAllocations}
            onAllocationChange={onInitialAllocationChange}
            onAllocationsReplace={onInitialAllocationsReplace}
            note={initialNote}
            onNoteChange={onInitialNoteChange}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Estoque inicial</h2>
      <p className="mt-1 text-xs text-slate-400">Opcional — pode cadastrar o produto sem estoque ainda e repor depois aqui mesmo.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium text-slate-700">Quantidade recebida</label>
          <input
            type="number"
            min={0}
            value={initialSimpleQuantity}
            onChange={(e) => onInitialSimpleQuantityChange(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Valor total pago (R$)</label>
          <CurrencyInput
            value={initialSimpleCost}
            onChange={onInitialSimpleCostChange}
            placeholder="quanto pagou no total"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">
            Observação <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <input
            type="text"
            value={initialSimpleNote}
            onChange={(e) => onInitialSimpleNoteChange(e.target.value)}
            placeholder="Ex: fornecedor X"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>
      </div>
      {Number(initialSimpleQuantity) > 0 && Number(initialSimpleCost) > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Custo por unidade:{' '}
          <span className="font-semibold text-slate-700">{formatPrice(Number(initialSimpleCost) / Number(initialSimpleQuantity))}</span>
        </p>
      )}
    </section>
  );
}
