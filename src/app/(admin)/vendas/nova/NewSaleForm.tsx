'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus, Trash2 } from 'lucide-react';
import type { PaymentMethod, Product } from '@/types';
import { formatPrice } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { registerSale } from '../actions';

interface CartLine {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  maxStock: number;
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'pix', label: 'Pix' },
  { value: 'credito', label: 'Cartão de crédito' },
  { value: 'dinheiro', label: 'Dinheiro' },
];

export function NewSaleForm({ products }: { products: Product[] }) {
  const router = useRouter();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  const addProduct = () => {
    if (!selectedProductId) return;
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;

    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id ? { ...l, quantity: Math.min(l.quantity + 1, l.maxStock) } : l,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.promoPrice ?? product.price,
          quantity: 1,
          maxStock: product.stockQuantity,
        },
      ];
    });
    setSelectedProductId('');
  };

  const changeQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((l) =>
        l.productId === productId ? { ...l, quantity: Math.max(1, Math.min(l.quantity + delta, l.maxStock)) } : l,
      ),
    );
  };

  const removeLine = (productId: string) => setCart((prev) => prev.filter((l) => l.productId !== productId));

  const handleSubmit = async () => {
    setError(null);
    if (!cart.length) {
      setError('Adicione ao menos um produto.');
      return;
    }

    setSaving(true);
    const result = await registerSale({
      items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
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

  const availableProducts = products.filter((p) => p.stockQuantity > 0);

  return (
    <div className="max-w-2xl space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Produtos</h2>

        <div className="mt-3 flex gap-2">
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="">Selecione um produto...</option>
            {availableProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatPrice(p.promoPrice ?? p.price)} ({p.stockQuantity} em estoque)
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addProduct}
            disabled={!selectedProductId}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Adicionar
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {cart.map((line) => (
            <div key={line.productId} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">{line.name}</p>
                <p className="text-xs text-slate-500">{formatPrice(line.unitPrice)} cada</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => changeQuantity(line.productId, -1)}
                  className="rounded-full border border-slate-200 p-1 text-slate-600 hover:bg-slate-50"
                >
                  <Minus size={13} />
                </button>
                <span className="w-6 text-center text-sm font-semibold text-slate-900">{line.quantity}</span>
                <button
                  type="button"
                  onClick={() => changeQuantity(line.productId, 1)}
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
                onClick={() => removeLine(line.productId)}
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

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5">
        <span className="text-sm font-semibold text-slate-500">Total</span>
        <span className="text-xl font-bold text-slate-900">{formatPrice(total)}</span>
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
