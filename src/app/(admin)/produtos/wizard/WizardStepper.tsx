'use client';

import { Check } from 'lucide-react';

interface WizardStepperProps {
  steps: readonly string[];
  currentIndex: number;
  /** maior índice já validado/alcançado — em modo wizard define até onde dá pra clicar. */
  furthestUnlocked: number;
  /** 'wizard' trava passos além de `furthestUnlocked` (criação); 'tabs' deixa tudo clicável (edição). */
  mode: 'wizard' | 'tabs';
  onStepClick: (index: number) => void;
}

/**
 * Indicador de passos do cadastro de produto. Em modo "wizard" (criação),
 * passos além do que já foi validado ficam travados (`aria-disabled`,
 * `tabIndex=-1`) — sem isso o teclado alcançaria becos sem saída. Em modo
 * "tabs" (edição), é só um indicador visual: tudo já existe no banco, então
 * não há nada pra travar.
 */
export function WizardStepper({ steps, currentIndex, furthestUnlocked, mode, onStepClick }: WizardStepperProps) {
  return (
    <div role="tablist" aria-label="Passos do cadastro de produto" className="flex gap-1 border-b border-slate-200">
      {steps.map((label, i) => {
        const locked = mode === 'wizard' && i > furthestUnlocked;
        const completed = mode === 'wizard' && i < furthestUnlocked;
        const active = i === currentIndex;

        return (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={active}
            aria-disabled={locked}
            tabIndex={locked ? -1 : 0}
            onClick={() => !locked && onStepClick(i)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              active
                ? 'border-slate-900 text-slate-900'
                : locked
                  ? 'cursor-not-allowed border-transparent text-slate-300'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {mode === 'wizard' && (
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  completed ? 'bg-emerald-500 text-white' : active ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {completed ? <Check size={12} /> : i + 1}
              </span>
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}
