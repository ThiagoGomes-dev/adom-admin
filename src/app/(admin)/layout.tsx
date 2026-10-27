import { LogoutButton } from '@/components/LogoutButton';
import { createClient } from '@/lib/supabase/server';
import { AdminNav } from './AdminNav';
import { OrdersBadgeProvider } from './OrdersBadgeProvider';
import { OrderNotifications } from './OrderNotifications';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  // conta tanto "aguardando pagamento" (pending) quanto "pago, aguardando envio" (confirmed sem shipped_at)
  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .or('status.eq.pending,and(status.eq.confirmed,shipped_at.is.null)');

  return (
    <OrdersBadgeProvider initialCount={count ?? 0}>
      <div className="flex min-h-screen bg-ground">
        <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col gap-7 bg-ink px-2 py-6 text-slate-200 md:w-64 md:px-4">
          <div className="flex items-center justify-center gap-3 md:justify-start md:px-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-bronze font-display text-lg font-semibold text-ink">
              A
            </span>
            <span className="hidden flex-col md:flex">
              <span className="font-display text-lg font-semibold tracking-[0.18em] text-white">ADOM</span>
              <span className="text-xs text-slate-400">Painel da loja</span>
            </span>
          </div>
          <AdminNav />
          <div className="mt-auto border-t border-slate-800 pt-3">
            <LogoutButton />
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
      <OrderNotifications />
    </OrdersBadgeProvider>
  );
}
