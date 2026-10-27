'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export const PAGE_SIZE = 10;

/**
 * Paginação no cliente: devolve só os itens da página atual.
 * Volta para a página 1 quando `resetKey` muda (ex.: filtro ou busca) e
 * recua sozinha se a página atual deixar de existir (ex.: item excluído).
 */
export function usePagination<T>(items: T[], resetKey = '', pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [lastKey, setLastKey] = useState(resetKey);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  // ajuste de estado durante o render (padrão do React) em vez de useEffect
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    setPage(1);
  }

  const current = Math.min(page, pageCount);
  const pageItems = useMemo(
    () => items.slice((current - 1) * pageSize, current * pageSize),
    [items, current, pageSize],
  );

  return { page: current, pageCount, pageItems, setPage, total: items.length, pageSize };
}

/** Números de página com reticências: 1 … 4 5 6 … 12 */
function pageList(page: number, pageCount: number): (number | 'gap')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Nome do item no plural, ex.: "pedidos". */
  itemLabel: string;
}

export function Pagination({ page, pageCount, total, pageSize, onPageChange, itemLabel }: PaginationProps) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const btn =
    'inline-flex h-10 min-w-10 items-center justify-center rounded-[10px] px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-5 py-4 sm:flex-row">
      <p className="text-sm text-slate-500">
        Mostrando <span className="font-semibold text-ink">{from}–{to}</span> de{' '}
        <span className="font-semibold text-ink">{total}</span> {itemLabel}
      </p>
      {pageCount > 1 && (
        <nav aria-label="Paginação" className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            aria-label="Página anterior"
            className={cn(btn, 'border border-line bg-white text-ink hover:bg-slate-100')}
          >
            <ChevronLeft size={16} />
          </button>
          {pageList(page, pageCount).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="px-1 text-sm text-slate-400">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={cn(btn, p === page ? 'bg-ink text-white' : 'text-ink hover:bg-slate-100')}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page === pageCount}
            aria-label="Próxima página"
            className={cn(btn, 'border border-line bg-white text-ink hover:bg-slate-100')}
          >
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}
