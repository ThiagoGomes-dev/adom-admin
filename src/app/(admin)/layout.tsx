import Image from 'next/image';
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
          {/* mesma logo do site (adom-website/public/img) */}
          <div className="flex flex-col items-center gap-2 md:items-start md:px-2">
            <Image src="/img/adom-icon-white.png" alt="ADOM" width={149} height={146} className="h-8 w-auto md:hidden" priority />
            <Image src="/img/adom.png" alt="ADOM" width={546} height={108} className="hidden h-7 w-auto md:block" priority />
            <span className="hidden text-xs text-slate-400 md:block">Painel da loja</span>
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
