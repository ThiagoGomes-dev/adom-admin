import { LogoutButton } from '@/components/LogoutButton';
import { AdminNav } from './AdminNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-16 shrink-0 flex-col border-r border-slate-200 bg-white px-2 py-5 md:w-60 md:px-4">
        <span className="mb-6 hidden text-sm font-bold uppercase tracking-wider text-slate-900 md:block">
          ADOM — Painel
        </span>
        <div className="flex flex-1 flex-col justify-between">
          <AdminNav />
          <div className="border-t border-slate-200 pt-3">
            <LogoutButton />
          </div>
        </div>
      </aside>
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
