'use client';

import { useState } from 'react';
import { formatPrice } from '@/lib/currency';

export interface VariantPriceRow {
  /** comboKey (produto ainda não existe) ou sku.id (produto já existe) */
  key: string;
  label: string;
  /** só disponível em edição, quando o SKU já tem histórico de entradas */
  costPrice?: number;
  stockQuantity?: number;
}

interface VariantPriceTableProps {
  rows: VariantPriceRow[];
  prices: Record<string, string>;
  onPriceChange: (key: string, value: string) => void;
  promoPrices: Record<string, string>;
  onPromoPriceChange: (key: string, value: string) => void;
  /** mostra as colunas Custo médio/Em estoque (só faz sentido com o produto já salvo) */
  showInventoryColumns?: boolean;
}

/**
 * Preço por combinação de variação — sempre em tabela, uma linha por
 * combinação (não existe mais um modo "preço único" separado). O par
 * "Aplicar a todas" preenche todas as linhas de uma vez só; dali em diante
 * cada linha continua editável individualmente pra quem precisar de um preço
 * diferente numa variação específica (ex: tamanho GG mais caro).
 */
export function VariantPriceTable({
  rows,
  prices,
  onPriceChange,
  promoPrices,
  onPromoPriceChange,
  showInventoryColumns = false,
}: VariantPriceTableProps) {
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkPromo, setBulkPromo] = useState('');

  const applyToAll = () => {
    for (const row of rows) {
      onPriceChange(row.key, bulkPrice);
      onPromoPriceChange(row.key, bulkPromo);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div>
          <label className="text-xs font-medium text-slate-600">Aplicar a todas</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={bulkPrice}
            onChange={(e) => setBulkPrice(e.target.value)}
            placeholder="Preço"
            className="mt-1 w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Promo (opcional)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={bulkPromo}
            onChange={(e) => setBulkPromo(e.target.value)}
            placeholder="—"
            className="mt-1 w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>
        <button
          type="button"
          onClick={applyToAll}
          disabled={!bulkPrice}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
        >
          Aplicar a todas as variações
        </button>
        <span className="text-xs text-slate-400">preenche as {rows.length} linhas; ajuste só a exceção depois</span>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Combinação</th>
              <th className="px-3 py-2 text-right">Preço</th>
              <th className="px-3 py-2 text-right">Promo</th>
              {showInventoryColumns && (
                <>
                  <th className="px-3 py-2 text-right">Custo médio</th>
                  <th className="px-3 py-2 text-right">Em estoque</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="px-3 py-2 text-slate-700">{row.label}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={prices[row.key] ?? ''}
                    onChange={(e) => onPriceChange(row.key, e.target.value)}
                    placeholder="Preço"
                    className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 text-right text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={promoPrices[row.key] ?? ''}
                    onChange={(e) => onPromoPriceChange(row.key, e.target.value)}
                    placeholder="—"
                    className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 text-right text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </td>
                {showInventoryColumns && (
                  <>
                    <td className="px-3 py-2 text-right text-slate-500">
                      {row.costPrice != null ? formatPrice(row.costPrice) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500">{row.stockQuantity ?? 0}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
