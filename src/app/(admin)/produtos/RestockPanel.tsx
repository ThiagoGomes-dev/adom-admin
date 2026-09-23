'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Product, ProductVariantSku, StockEntry } from '@/types';
import { formatPrice } from '@/lib/currency';
import { restockProduct, restockProductVariants } from './actions';
import { VariantStockAllocator, allocatorCanSubmit, type VariantStockAllocatorRow } from './VariantStockAllocator';

interface RestockPanelProps {
  product: Product;
  entries: StockEntry[];
  /** SKUs (combinações de variação) do produto — só quando `product.variants` não está vazio. */
  skus?: ProductVariantSku[];
  /** Combinações que já não existem mais nas variações do produto, mas ainda têm estoque/custo registrado. */
  orphanSkus?: ProductVariantSku[];
}

export function RestockPanel({ product, entries, skus, orphanSkus }: RestockPanelProps) {
  if (product.variants && product.variants.length > 0) {
    return (
      <VariantRestockPanel product={product} entries={entries} skus={skus ?? []} orphanSkus={orphanSkus ?? []} />
    );
  }
  return <SimpleRestockPanel product={product} entries={entries} />;
}

/**
 * Registra a chegada de mais unidades de um produto SEM variação. Ao
 * contrário do campo "Estoque" no formulário de edição (correção manual
 * pontual), aqui o custo por unidade é recalculado automaticamente como
 * média ponderada entre o estoque atual e a nova leva — o jeito certo de
 * misturar lotes comprados a preços diferentes sem precisar rastrear cada
 * lote separadamente.
 */
function SimpleRestockPanel({ product, entries }: { product: Product; entries: StockEntry[] }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qty = Number(quantity) || 0;
  const cost = Number(totalCost) || 0;
  const newStock = product.stockQuantity + qty;
  const newUnitCost = qty > 0 && cost > 0 ? (product.stockQuantity * product.costPrice + cost) / newStock : null;

  const handleSubmit = async () => {
    setError(null);
    if (qty <= 0) {
      setError('Informe a quantidade recebida.');
      return;
    }
    if (cost <= 0) {
      setError('Informe o valor total pago por essa leva.');
      return;
    }

    setSaving(true);
    const result = await restockProduct({
      productId: product.id,
      quantity: qty,
      totalCost: cost,
      note: note || undefined,
    });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setQuantity('');
    setTotalCost('');
    setNote('');
    router.refresh();
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Repor estoque</h2>
      <p className="mt-1 text-xs text-slate-400">
        Estoque atual: <span className="font-semibold text-slate-600">{product.stockQuantity} unid.</span> a{' '}
        {formatPrice(product.costPrice)}/unid. Registre abaixo quando chegar uma nova leva.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium text-slate-700">Quantidade recebida</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
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
            onChange={(e) => setTotalCost(e.target.value)}
            placeholder="quanto pagou por essa leva"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">
            Observação <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex: fornecedor X"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>
      </div>

      {newUnitCost !== null && (
        <p className="mt-3 text-xs text-slate-500">
          Depois desta entrada: <span className="font-semibold text-slate-700">{newStock} unid.</span> · novo custo
          médio por unidade <span className="font-semibold text-slate-700">{formatPrice(newUnitCost)}</span>
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving}
        className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {saving ? 'Registrando...' : 'Registrar entrada'}
      </button>

      <StockEntryHistory entries={entries} />
    </section>
  );
}

/**
 * Registra a chegada de um lote de um produto COM variação e obriga a
 * distribuir a quantidade total entre as combinações (cor/tamanho) antes de
 * salvar — a soma precisa bater exatamente com a quantidade do lote, senão o
 * botão fica travado. É a mesma ideia do painel simples, só que por variação.
 */
function VariantRestockPanel({
  product,
  entries,
  skus,
  orphanSkus,
}: {
  product: Product;
  entries: StockEntry[];
  skus: ProductVariantSku[];
  orphanSkus: ProductVariantSku[];
}) {
  const router = useRouter();

  const needsInitialDistribution = product.stockQuantity > 0 && skus.every((s) => s.stockQuantity === 0);

  const [totalQuantity, setTotalQuantity] = useState(needsInitialDistribution ? String(product.stockQuantity) : '');
  const [totalCost, setTotalCost] = useState(
    needsInitialDistribution ? String(Number((product.stockQuantity * product.costPrice).toFixed(2))) : '',
  );
  const [note, setNote] = useState(needsInitialDistribution ? 'Distribuição inicial do estoque existente' : '');
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalQty = Number(totalQuantity) || 0;
  const totalCostNum = Number(totalCost) || 0;
  const allocatorRows: VariantStockAllocatorRow[] = skus.map((sku) => ({
    key: sku.id,
    label: sku.label,
    currentStock: sku.stockQuantity,
  }));
  const canSubmit = allocatorCanSubmit(allocatorRows, totalQuantity, totalCost, allocations);
  const skuLabels = Object.fromEntries([...skus, ...orphanSkus].map((sku) => [sku.id, sku.label]));

  const setAllocation = (skuId: string, value: string) => {
    setAllocations((prev) => ({ ...prev, [skuId]: value }));
  };

  const handleSubmit = async () => {
    setError(null);
    if (totalQty <= 0) {
      setError('Informe a quantidade total do lote.');
      return;
    }
    if (totalCostNum <= 0) {
      setError('Informe o valor total pago pelo lote.');
      return;
    }
    const allocatedSum = skus.reduce((sum, sku) => sum + (Number(allocations[sku.id]) || 0), 0);
    const remaining = totalQty - allocatedSum;
    if (remaining !== 0) {
      setError(`A soma das variações precisa bater com o total do lote (faltam ${remaining} unid.).`);
      return;
    }

    setSaving(true);
    const result = await restockProductVariants({
      productId: product.id,
      totalQuantity: totalQty,
      totalCost: totalCostNum,
      allocations: skus
        .map((sku) => ({ skuId: sku.id, quantity: Number(allocations[sku.id]) || 0 }))
        .filter((a) => a.quantity > 0),
      note: note || undefined,
    });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setTotalQuantity('');
    setTotalCost('');
    setNote('');
    setAllocations({});
    router.refresh();
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Repor estoque por variação</h2>

      {needsInitialDistribution && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Este produto tem <strong>{product.stockQuantity} unidades</strong> cadastradas mas ainda sem distribuição
          entre cor/tamanho. Preencha abaixo quanto tem de cada variação — os campos já vêm com o total atual
          preenchido.
        </div>
      )}

      <div className="mt-4 rounded-lg border border-slate-100 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estoque atual por variação</h3>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {skus.map((sku) => (
            <li key={sku.id} className="flex items-center justify-between">
              <span>{sku.label}</span>
              <span className="text-slate-500">
                {sku.stockQuantity} unid. · {formatPrice(sku.costPrice)}/unid.
              </span>
            </li>
          ))}
          {skus.length === 0 && <li className="text-slate-400">Nenhuma variação cadastrada ainda.</li>}
        </ul>
      </div>

      {orphanSkus.length > 0 && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <p className="font-semibold">Variações removidas do produto mas que ainda têm estoque/custo:</p>
          <ul className="mt-1 space-y-0.5">
            {orphanSkus.map((sku) => (
              <li key={sku.id}>
                {sku.label} — {sku.stockQuantity} unid. · {formatPrice(sku.costPrice)}/unid.
              </li>
            ))}
          </ul>
        </div>
      )}

      <VariantStockAllocator
        rows={allocatorRows}
        totalQuantity={totalQuantity}
        onTotalQuantityChange={setTotalQuantity}
        totalCost={totalCost}
        onTotalCostChange={setTotalCost}
        allocations={allocations}
        onAllocationChange={setAllocation}
        note={note}
        onNoteChange={setNote}
      />

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving || !canSubmit}
        className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {saving ? 'Registrando...' : 'Registrar entrada'}
      </button>

      <StockEntryHistory entries={entries} skuLabels={skuLabels} />
    </section>
  );
}

function StockEntryHistory({ entries, skuLabels }: { entries: StockEntry[]; skuLabels?: Record<string, string> }) {
  if (entries.length === 0) return null;

  return (
    <div className="mt-6 border-t border-slate-100 pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Histórico de entradas</h3>
      <ul className="mt-3 space-y-2">
        {entries.map((entry) => {
          const variantLabel = entry.skuId ? skuLabels?.[entry.skuId] : undefined;
          return (
            <li key={entry.id} className="flex items-center justify-between gap-3 text-sm text-slate-600">
              <span>
                {new Date(entry.createdAt).toLocaleDateString('pt-BR')} · {entry.quantity} unid. ·{' '}
                {formatPrice(entry.totalCost)}
                {variantLabel ? ` · ${variantLabel}` : ''}
                {entry.note ? ` · ${entry.note}` : ''}
              </span>
              <span className="shrink-0 text-xs text-slate-400">{formatPrice(entry.unitCost)}/unid.</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
