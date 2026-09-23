'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus, Trash2 } from 'lucide-react';
import type { PaymentMethod, Product, ProductVariantSku } from '@/types';
import { formatPrice } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { registerSale } from '../actions';

interface CartLine {
  productId: string;
  skuId?: string;
  name: string;
  variantLabel?: string;
  unitPrice: number;
  unitCost: number;
  quantity: number;
  maxStock: number;
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'pix', label: 'Pix' },
  { value: 'credito', label: 'Cartão de crédito' },
  { value: 'dinheiro', label: 'Dinheiro' },
];

export function NewSaleForm({
  products,
  skusByProduct,
}: {
  products: Product[];
  skusByProduct: Record<string, ProductVariantSku[]>;
}) {
  const router = useRouter();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedSkuId, setSelectedSkuId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const lucroEstimado = cart.reduce((sum, line) => sum + (line.unitPrice - line.unitCost) * line.quantity, 0);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const selectedProductSkus = selectedProductId ? skusByProduct[selectedProductId] ?? [] : [];
  const needsSkuChoice = selectedProductSkus.length > 0;
  const availableSkus = selectedProductSkus.filter((sku) => sku.stockQuantity > 0);
  const selectedSku = availableSkus.find((sku) => sku.id === selectedSkuId);

  const canAdd = Boolean(selectedProduct) && (!needsSkuChoice || Boolean(selectedSku));

  const addProduct = () => {
    if (!selectedProduct || !canAdd) return;

    const skuId = selectedSku?.id;
    const unitCost = selectedSku ? selectedSku.costPrice : selectedProduct.costPrice;
    const maxStock = selectedSku ? selectedSku.stockQuantity : selectedProduct.stockQuantity;

    setCart((prev) => {
      const existing = prev.find((l) => l.productId === selectedProduct.id && l.skuId === skuId);
      if (existing) {
        return prev.map((l) =>
          l.productId === selectedProduct.id && l.skuId === skuId
            ? { ...l, quantity: Math.min(l.quantity + 1, l.maxStock) }
            : l,
        );
      }
      return [
        ...prev,
        {
          productId: selectedProduct.id,
          skuId,
          name: selectedProduct.name,
          variantLabel: selectedSku?.label,
          unitPrice: selectedSku
            ? selectedSku.promoPrice ?? selectedSku.price ?? selectedProduct.promoPrice ?? selectedProduct.price
            : selectedProduct.promoPrice ?? selectedProduct.price,
          unitCost,
          quantity: 1,
          maxStock,
        },
      ];
    });
    setSelectedProductId('');
    setSelectedSkuId('');
  };

  const lineKey = (line: CartLine) => `${line.productId}__${line.skuId ?? ''}`;

  const changeQuantity = (key: string, delta: number) => {
    setCart((prev) =>
      prev.map((l) =>
        lineKey(l) === key ? { ...l, quantity: Math.max(1, Math.min(l.quantity + delta, l.maxStock)) } : l,
      ),
    );
  };

  const removeLine = (key: string) => setCart((prev) => prev.filter((l) => lineKey(l) !== key));

  const handleSubmit = async () => {
    setError(null);
    if (!cart.length) {
      setError('Adicione ao menos um produto.');
      return;
    }

    setSaving(true);
    const result = await registerSale({
      items: cart.map((l) => ({ productId: l.productId, skuId: l.skuId, quantity: l.quantity })),
      paymentMethod: paymentMethod ?? undefined,
      note: note || undefined,
    });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.push('/vendas');
    router.refresh();
  };

  const availableProducts = useMemo(() => products.filter((p) => p.stockQuantity > 0), [products]);

  return (
    <div className="max-w-2xl space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Produtos</h2>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select
            value={selectedProductId}
            onChange={(e) => {
              setSelectedProductId(e.target.value);
              setSelectedSkuId('');
            }}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="">Selecione um produto...</option>
            {availableProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatPrice(p.promoPrice ?? p.price)} ({p.stockQuantity} em estoque)
              </option>
            ))}
          </select>

          {needsSkuChoice && (
            <select
              value={selectedSkuId}
              onChange={(e) => setSelectedSkuId(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="">Escolha a variação...</option>
              {availableSkus.map((sku) => {
                const skuPrice = sku.promoPrice ?? sku.price;
                return (
                  <option key={sku.id} value={sku.id}>
                    {sku.label}
                    {skuPrice != null ? ` — ${formatPrice(skuPrice)}` : ''} ({sku.stockQuantity} em estoque)
                  </option>
                );
              })}
            </select>
          )}

          <button
            type="button"
            onClick={addProduct}
            disabled={!canAdd}
            className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Adicionar
          </button>
        </div>
        {needsSkuChoice && availableSkus.length === 0 && selectedProductId && (
          <p className="mt-2 text-xs text-red-600">Nenhuma variação deste produto tem estoque disponível.</p>
        )}

        <div className="mt-4 space-y-2">
          {cart.map((line) => (
            <div key={lineKey(line)} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">
                  {line.name}
                  {line.variantLabel && <span className="font-normal text-slate-500"> — {line.variantLabel}</span>}
                </p>
                <p className="text-xs text-slate-500">{formatPrice(line.unitPrice)} cada</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => changeQuantity(lineKey(line), -1)}
                  className="rounded-full border border-slate-200 p-1 text-slate-600 hover:bg-slate-50"
                >
                  <Minus size={13} />
                </button>
                <span className="w-6 text-center text-sm font-semibold text-slate-900">{line.quantity}</span>
                <button
                  type="button"
                  onClick={() => changeQuantity(lineKey(line), 1)}
                  disabled={line.quantity >= line.maxStock}
                  className="rounded-full border border-slate-200 p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                >
                  <Plus size={13} />
                </button>
              </div>
              <span className="w-20 text-right text-sm font-semibold text-slate-900">
                {formatPrice(line.unitPrice * line.quantity)}
              </span>
              <button
                type="button"
                onClick={() => removeLine(lineKey(line))}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {cart.length === 0 && <p className="text-sm text-slate-400">Nenhum produto adicionado ainda.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Forma de pagamento</h2>
        <p className="mt-1 text-xs text-slate-400">Opcional — só pra referência, nada é cobrado por aqui.</p>
        <div className="mt-3 flex gap-2">
          {PAYMENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPaymentMethod((prev) => (prev === opt.value ? null : opt.value))}
              className={cn(
                'flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors',
                paymentMethod === opt.value
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 text-slate-600 hover:border-slate-400',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Observação (opcional)
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex: cliente Fulano, retirou na loja..."
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </label>
      </section>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-500">Total</span>
          <span className="text-xl font-bold text-slate-900">{formatPrice(total)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-slate-400">Lucro estimado</span>
          <span className="text-sm font-semibold text-emerald-600">{formatPrice(lucroEstimado)}</span>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || cart.length === 0}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'Registrando...' : 'Registrar venda'}
        </button>
        <button type="button" onClick={() => router.push('/vendas')} className="text-sm font-medium text-slate-500 hover:text-slate-900">
          Cancelar
        </button>
      </div>
    </div>
  );
}
