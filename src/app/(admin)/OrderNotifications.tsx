'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useOrdersBadge } from './OrdersBadgeProvider';

interface ToastMessage {
  id: number;
  text: string;
}

let nextToastId = 0;

/**
 * Avisa em tempo real quando um pedido novo chega do site (Supabase
 * Realtime na tabela `orders`) — toast + contador no item "Pedidos" do
 * menu, sem precisar de nenhuma infraestrutura de notificação nova (a
 * tabela já está na publication `supabase_realtime`, ver schema.sql).
 */
type OrderRealtimeRow = { status?: string; shipped_at?: string | null; customer_name?: string | null };

export function OrderNotifications() {
  const { setPendingCount } = useOrdersBadge();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const supabase = createClient();

    const pushToast = (text: string) => {
      const id = nextToastId++;
      setToasts((prev) => [...prev, { id, text }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
    };

    const channel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const row = payload.new as OrderRealtimeRow;
        if (row.status !== 'pending') return;

        setPendingCount((c) => c + 1);
        pushToast(`Novo pedido${row.customer_name ? ` de ${row.customer_name}` : ''}!`);
      })
      // Requer `alter table orders replica identity full` (ver schema.sql) —
      // senão `payload.old` só traz o id, sem o status anterior.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        const oldRow = payload.old as OrderRealtimeRow;
        const newRow = payload.new as OrderRealtimeRow;

        if (oldRow.status === 'pending' && newRow.status === 'confirmed') {
          // pagamento aprovado — continua contando como pendência (agora é "aguardando envio", não mais "aguardando pagamento")
          pushToast(`Pagamento aprovado${newRow.customer_name ? ` — ${newRow.customer_name}` : ''}! Pedido pronto pra envio.`);
          return;
        }
        if (oldRow.status === 'pending' && newRow.status !== 'pending') {
          setPendingCount((c) => c - 1);
          return;
        }
        if (oldRow.status === 'confirmed' && !oldRow.shipped_at && newRow.shipped_at) {
          setPendingCount((c) => c - 1);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast.text}
        </div>
      ))}
    </div>
  );
}
