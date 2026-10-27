'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      title="Sair"
      className="flex min-h-11 w-full items-center justify-center gap-3 rounded-[10px] px-3 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white md:justify-start"
    >
      <LogOut size={18} />
      <span className="hidden md:inline">Sair</span>
    </button>
  );
}
