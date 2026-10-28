'use client';

import Image from 'next/image';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (signInError) {
      setError('E-mail ou senha inválidos.');
      return;
    }

    router.replace('/produtos');
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm rounded-[22px] bg-white p-8 shadow-xl">
        <div className="flex flex-col gap-1.5">
          <Image src="/img/adom-dark.png" alt="ADOM" width={546} height={108} className="h-8 w-auto self-start" priority />
          <span className="text-xs text-slate-500">Painel da loja</span>
        </div>
        <h1 className="mt-6 font-display text-2xl font-medium text-ink">Entrar no painel</h1>
        <p className="mt-1 text-sm text-slate-600">Gerencie pedidos, vendas, produtos e estoque.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full min-h-11 rounded-xl border border-line px-3.5 text-sm text-ink focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full min-h-11 rounded-xl border border-line px-3.5 text-sm text-ink focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="min-h-11 w-full rounded-xl bg-ink text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
