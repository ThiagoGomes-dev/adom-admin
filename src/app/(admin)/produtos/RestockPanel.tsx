'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PackagePlus, Undo2 } from 'lucide-react';
import type { Product, ProductVariantSku, StockEntry } from '@/types';
import { formatPrice } from '@/lib/currency';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { restockProduct, restockProductVariants, undoStockEntry } from './actions';
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
    if (saving) return; // trava contra duplo clique antes do re-render desabilitar o botão
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
      <div className="rounded-lg border-l-4 border-emerald-500 bg-emerald-50/50 p-4">
        <div className="flex items-center gap-2">
          <PackagePlus size={18} className="text-emerald-600" />
          <h2 className="text-sm font-semibold text-emerald-900">Chegou mercadoria? Registre a entrada aqui</h2>
        </div>
        <p className="mt-1 text-xs text-emerald-900/60">
          Estoque atual: <span className="font-semibold">{product.stockQuantity} unid.</span> a{' '}
          {formatPrice(product.costPrice)}/unid.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-sm font-medium text-slate-700">Quantidade recebida</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={saving}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50"
            />
            <p className="mt-1 text-xs text-slate-500">Quantas peças chegaram nesta compra.</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Valor total pago (R$)</label>
            <CurrencyInput
              value={totalCost}
              onChange={setTotalCost}
              placeholder="quanto pagou por essa leva"
              disabled={saving}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50"
            />
            <p className="mt-1 text-xs text-slate-500">Quanto você pagou pelo lote inteiro, não por peça. Ex.: 10 peças por R$ 500,00, digite 500,00. O custo por unidade é calculado sozinho.</p>
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
              disabled={saving}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50"
            />
            <p className="mt-1 text-xs text-slate-500">Anotação só sua, aparece no histórico de entradas. Ex.: nome do fornecedor ou número da nota.</p>
          </div>
        </div>

        {newUnitCost !== null && (
          <p className="mt-3 text-xs text-emerald-900/70">
            Depois desta entrada: <span className="font-semibold">{newStock} unid.</span> · novo custo médio por
            unidade <span className="font-semibold">{formatPrice(newUnitCost)}</span>
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
      </div>

      <StockEntryHistory productId={product.id} entries={entries} />
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
    if (saving) return; // trava contra duplo clique antes do re-render desabilitar o botão
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
      <div className="rounded-lg border-l-4 border-emerald-500 bg-emerald-50/50 p-4">
        <div className="flex items-center gap-2">
          <PackagePlus size={18} className="text-emerald-600" />
          <h2 className="text-sm font-semibold text-emerald-900">Chegou mercadoria? Registre a entrada aqui</h2>
        </div>

        {needsInitialDistribution && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Este produto tem <strong>{product.stockQuantity} unidades</strong> cadastradas mas ainda sem distribuição
            entre cor/tamanho. Preencha abaixo quanto tem de cada variação — os campos já vêm com o total atual
            preenchido.
          </div>
        )}

        <div className="mt-4">
          <VariantStockAllocator
            rows={allocatorRows}
            totalQuantity={totalQuantity}
            onTotalQuantityChange={setTotalQuantity}
            totalCost={totalCost}
            onTotalCostChange={setTotalCost}
            allocations={allocations}
            onAllocationChange={setAllocation}
            onAllocationsReplace={setAllocations}
            note={note}
            onNoteChange={setNote}
            disabled={saving}
          />
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || !canSubmit}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'Registrando...' : 'Registrar entrada'}
        </button>
      </div>

      <VariantStockOverview skus={skus} />

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

      <StockEntryHistory productId={product.id} entries={entries} skuLabels={skuLabels} />
    </section>
  );
}

/**
 * Estoque atual de cada combinação, agrupado pela primeira parte do rótulo
 * ("PRETA / 38" → grupo PRETA, quadradinho 38). Variação zerada fica em
 * destaque para o lojista ver na hora o que falta repor.
 */
function VariantStockOverview({ skus }: { skus: ProductVariantSku[] }) {
  const totalUnits = skus.reduce((sum, sku) => sum + sku.stockQuantity, 0);
  const outOfStock = skus.filter((sku) => sku.stockQuantity === 0).length;

  const groups = new Map<string, { sku: ProductVariantSku; name: string }[]>();
  for (const sku of skus) {
    const sep = sku.label.indexOf(' / ');
    const group = sep === -1 ? '' : sku.label.slice(0, sep);
    const name = sep === -1 ? sku.label : sku.label.slice(sep + 3);
    groups.set(group, [...(groups.get(group) ?? []), { sku, name }]);
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estoque atual por variação</h3>
        {skus.length > 0 && (
          <p className="text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{totalUnits} unid.</span> no total
            {outOfStock > 0 && (
              <>
                {' · '}
                <span className="font-semibold text-red-600">
                  {outOfStock === skus.length ? 'todas zeradas' : `${outOfStock} zerada${outOfStock > 1 ? 's' : ''}`}
                </span>
              </>
            )}
          </p>
        )}
      </div>

      {skus.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">Nenhuma variação cadastrada ainda.</p>
      ) : (
        <div className="mt-3 space-y-4">
          {[...groups.entries()].map(([group, items]) => (
            <div key={group || '_'}>
              {group && <p className="mb-2 text-sm font-semibold text-slate-700">{group}</p>}
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {items.map(({ sku, name }) => {
                  const empty = sku.stockQuantity === 0;
                  return (
                    <li
                      key={sku.id}
                      className={`rounded-lg border px-2 py-2 text-center ${
                        empty ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'
                      }`}
                    >
                      <p className="truncate text-xs font-medium text-slate-500" title={name}>
                        {name}
                      </p>
                      <p className={`text-lg font-semibold leading-tight ${empty ? 'text-red-600' : 'text-emerald-700'}`}>
                        {sku.stockQuantity}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {empty ? 'sem estoque' : sku.costPrice > 0 ? `${formatPrice(sku.costPrice)}/unid.` : 'unid.'}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Histórico agrupado por entrada: um lote de produto com variação grava uma
 * linha por variação, todas com o mesmo `createdAt` (mesma transação), então
 * aparecem juntas e o "Desfazer" desfaz o lote inteiro — é o que o lojista
 * precisa quando errou a quantidade ou esqueceu uma cor na distribuição.
 */
function StockEntryHistory({
  productId,
  entries,
  skuLabels,
}: {
  productId: string;
  entries: StockEntry[];
  skuLabels?: Record<string, string>;
}) {
  const router = useRouter();
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (entries.length === 0) return null;

  const batches = new Map<string, StockEntry[]>();
  for (const entry of entries) {
    batches.set(entry.createdAt, [...(batches.get(entry.createdAt) ?? []), entry]);
  }

  const handleUndo = async (batch: StockEntry[]) => {
    if (undoingId) return;
    const quantity = batch.reduce((sum, e) => sum + e.quantity, 0);
    const ok = confirm(
      `Desfazer esta entrada? ${quantity} unid. saem do estoque e o custo médio volta a ser calculado sem ela. ` +
        'A entrada some do histórico. Depois é só registrar de novo do jeito certo.',
    );
    if (!ok) return;

    setError(null);
    setUndoingId(batch[0].id);
    const result = await undoStockEntry({ entryId: batch[0].id, productId });
    setUndoingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="mt-6 border-t border-slate-100 pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Histórico de entradas</h3>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <ul className="mt-3 space-y-3">
        {[...batches.values()].map((batch) => {
          const first = batch[0];
          const quantity = batch.reduce((sum, e) => sum + e.quantity, 0);
          const totalCost = batch.reduce((sum, e) => sum + e.totalCost, 0);
          const variantLines = batch.filter((e) => e.skuId);
          const undoing = undoingId === first.id;
          return (
            <li key={first.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm text-slate-600">
              <div className="flex items-start justify-between gap-3">
                <span>
                  {new Date(first.createdAt).toLocaleDateString('pt-BR')} · {quantity} unid. · {formatPrice(totalCost)}
                  {first.note ? ` · ${first.note}` : ''}
                  <span className="ml-2 text-xs text-slate-400">{formatPrice(first.unitCost)}/unid.</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleUndo(batch)}
                  disabled={undoingId !== null}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <Undo2 size={13} /> {undoing ? 'Desfazendo...' : 'Desfazer'}
                </button>
              </div>
              {variantLines.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  {variantLines
                    .map((e) => `${skuLabels?.[e.skuId!] ?? 'variação removida'}: ${e.quantity}`)
                    .join(' · ')}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
