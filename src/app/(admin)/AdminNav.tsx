'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, Tag, ShoppingCart, Bell } from 'lucide-react';
import { useOrdersBadge } from './OrdersBadgeProvider';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/produtos', label: 'Produtos', icon: Package },
  { href: '/categorias', label: 'Categorias', icon: Tag },
  { href: '/pedidos', label: 'Pedidos', icon: Bell },
  { href: '/vendas', label: 'Vendas', icon: ShoppingCart },
];

export function AdminNav() {
  const pathname = usePathname();
  const { pendingCount } = useOrdersBadge();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const showBadge = href === '/pedidos' && pendingCount > 0;
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="relative shrink-0">
              <Icon size={18} />
              {showBadge && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </span>
            <span className="hidden md:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
