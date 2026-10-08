'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface OrdersBadgeContextValue {
  pendingCount: number;
  setPendingCount: (updater: (count: number) => number) => void;
}

const OrdersBadgeContext = createContext<OrdersBadgeContextValue | null>(null);

/** Guarda a contagem de pedidos pendentes, compartilhada entre `AdminNav` (mostra o badge) e `OrderNotifications` (atualiza em tempo real). */
export function OrdersBadgeProvider({ initialCount, children }: { initialCount: number; children: ReactNode }) {
  const [pendingCount, setCount] = useState(initialCount);
  const setPendingCount = (updater: (count: number) => number) => setCount((c) => Math.max(0, updater(c)));

  return <OrdersBadgeContext.Provider value={{ pendingCount, setPendingCount }}>{children}</OrdersBadgeContext.Provider>;
}

export function useOrdersBadge(): OrdersBadgeContextValue {
  const ctx = useContext(OrdersBadgeContext);
  if (!ctx) throw new Error('useOrdersBadge deve ser usado dentro de <OrdersBadgeProvider>');
  return ctx;
}
