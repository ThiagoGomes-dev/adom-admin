'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, Tag, ShoppingCart, ShoppingBag } from 'lucide-react';
import { useOrdersBadge } from './OrdersBadgeProvider';
import { cn } from '@/lib/cn';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { href: '/vendas', label: 'Vendas', icon: ShoppingCart },
  { href: '/produtos', label: 'Produtos', icon: Package },
  { href: '/categorias', label: 'Categorias', icon: Tag },
];

export function AdminNav() {
  const pathname = usePathname();
  const { pendingCount } = useOrdersBadge();

  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-1">
      <span className="hidden px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 md:block">
        Gestão
      </span>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const showBadge = href === '/pedidos' && pendingCount > 0;
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex min-h-11 items-center justify-center gap-3 rounded-[10px] px-3 text-sm transition-colors md:justify-start',
              active
                ? 'bg-bronze/15 font-semibold text-bronze-soft'
                : 'font-medium text-slate-300 hover:bg-white/5 hover:text-white',
            )}
          >
            <span className="relative shrink-0">
              <Icon size={18} />
              {showBadge && (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-bronze px-1 text-[10px] font-bold text-ink md:hidden">
                  {pendingCount}
                </span>
              )}
            </span>
            <span className="hidden flex-1 md:inline">{label}</span>
            {showBadge && (
              <span className="hidden h-[22px] min-w-[22px] items-center justify-center rounded-full bg-bronze px-1.5 text-xs font-bold text-ink md:flex">
                {pendingCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
