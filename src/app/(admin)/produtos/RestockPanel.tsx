'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Product, StockEntry } from '@/types';
import { formatPrice } from '@/lib/currency';
import { restockProduct } from './actions';

interface RestockPanelProps {
  product: Product;
  entries: StockEntry[];
}

/**
 * Registra a chegada de mais unidades de um produto. Ao contrário do campo
 * "Estoque" no formulário de edição (correção manual pontual), aqui o custo
 * por unidade é recalculado automaticamente como média ponderada entre o
 * estoque atual e a nova leva — o jeito certo de misturar lotes comprados a
 * preços diferentes sem precisar rastrear cada lote separadamente.
 */
export function RestockPanel({ product, entries }: RestockPanelProps) {
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

      {entries.length > 0 && (
        <div className="mt-6 border-t border-slate-100 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Histórico de entradas</h3>
          <ul className="mt-3 space-y-2">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 text-sm text-slate-600">
                <span>
                  {new Date(entry.createdAt).toLocaleDateString('pt-BR')} · {entry.quantity} unid. ·{' '}
                  {formatPrice(entry.totalCost)}
                  {entry.note ? ` · ${entry.note}` : ''}
                </span>
                <span className="shrink-0 text-xs text-slate-400">{formatPrice(entry.unitCost)}/unid.</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
