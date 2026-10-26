interface PageHeaderProps {
  /** Linha pequena em bronze acima do título. */
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1.5">
        {eyebrow && (
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-bronze-text">{eyebrow}</span>
        )}
        <h1 className="font-display text-3xl font-medium leading-tight text-ink">{title}</h1>
        {description && <p className="text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}

/** Classes do botão principal (azul-marinho), para Links e buttons. */
export const primaryButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50';

/** Classes do cartão branco padrão. */
export const card = 'rounded-[18px] border border-line bg-white';
