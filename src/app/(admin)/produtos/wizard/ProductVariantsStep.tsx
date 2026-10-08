'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Plus, Trash2, X } from 'lucide-react';
import type { ProductVariantGroup } from '@/types';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { VariantPriceTable, type VariantPriceRow } from '../VariantPriceTable';

interface ProductVariantsStepProps {
  variants: ProductVariantGroup[];
  images: string[];
  onAddVariantGroup: () => void;
  onRemoveVariantGroup: (groupId: string) => void;
  onUpdateVariantGroupName: (groupId: string, name: string) => void;
  onAddVariantOption: (groupId: string) => void;
  onUpdateVariantOption: (groupId: string, optionId: string, field: 'label' | 'meta' | 'image', value: string) => void;
  onRemoveVariantOption: (groupId: string, optionId: string) => void;
  hasVariants: boolean;
  isEditing: boolean;
  variantPriceRows: VariantPriceRow[];
  variantPrices: Record<string, string>;
  onVariantPriceChange: (key: string, value: string) => void;
  variantPromoPrices: Record<string, string>;
  onVariantPromoPriceChange: (key: string, value: string) => void;
  price: string;
  onPriceChange: (value: string) => void;
  promoPrice: string;
  onPromoPriceChange: (value: string) => void;
}

const isColorGroup = (groupName: string) => /cor/i.test(groupName);

/**
 * Passo 2: grupos de variação (cor/tamanho) + preço. Quando o produto ainda
 * não tem nenhuma variação, o editor de grupos fica recolhido atrás de um
 * link discreto — o preço (caso comum: produto sem variação) é que fica em
 * destaque, em vez de competir visualmente com uma seção de variantes vazia.
 */
export function ProductVariantsStep({
  variants,
  images,
  onAddVariantGroup,
  onRemoveVariantGroup,
  onUpdateVariantGroupName,
  onAddVariantOption,
  onUpdateVariantOption,
  onRemoveVariantOption,
  hasVariants,
  isEditing,
  variantPriceRows,
  variantPrices,
  onVariantPriceChange,
  variantPromoPrices,
  onVariantPromoPriceChange,
  price,
  onPriceChange,
  promoPrice,
  onPromoPriceChange,
}: ProductVariantsStepProps) {
  const [expanded, setExpanded] = useState(variants.length > 0);

  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Variantes</h2>
          {expanded && (
            <button
              type="button"
              onClick={onAddVariantGroup}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus size={14} /> Adicionar grupo
            </button>
          )}
        </div>

        {!expanded ? (
          <button
            type="button"
            onClick={() => {
              setExpanded(true);
              onAddVariantGroup();
            }}
            className="mt-3 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            Este produto tem variações (cor/tamanho)? + Adicionar variação
          </button>
        ) : (
          <div className="mt-4 space-y-4">
            {variants.map((group) => (
              <div key={group.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={group.name}
                    onChange={(e) => onUpdateVariantGroupName(group.id, e.target.value)}
                    placeholder="Nome do grupo (ex: Cor, Tamanho)"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveVariantGroup(group.id)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="mt-3 space-y-3">
                  {group.options.map((option) => (
                    <div key={option.id} className="rounded-lg border border-slate-100 p-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={option.label}
                          onChange={(e) => onUpdateVariantOption(group.id, option.id, 'label', e.target.value)}
                          placeholder="Ex: Azul Marinho"
                          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                        />
                        {isColorGroup(group.name) && (
                          <input
                            type="color"
                            value={option.meta || '#000000'}
                            onChange={(e) => onUpdateVariantOption(group.id, option.id, 'meta', e.target.value)}
                            className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-slate-300"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => onRemoveVariantOption(group.id, option.id)}
                          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {isColorGroup(group.name) && (
                        <div className="mt-2">
                          {images.length === 0 ? (
                            <p className="text-xs text-slate-400">
                              Adicione fotos no passo &quot;Dados&quot; para poder vincular a esta cor.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {images.map((url) => {
                                const selected = option.image === url;
                                return (
                                  <button
                                    key={url}
                                    type="button"
                                    onClick={() => onUpdateVariantOption(group.id, option.id, 'image', selected ? '' : url)}
                                    className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-md border-2 ${
                                      selected ? 'border-slate-900' : 'border-transparent opacity-60 hover:opacity-100'
                                    }`}
                                    title={selected ? 'Foto vinculada a esta cor (clique para remover)' : 'Vincular esta foto a esta cor'}
                                  >
                                    <Image src={url} alt="" fill sizes="48px" className="object-cover" />
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => onAddVariantOption(group.id)}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    + Adicionar opção
                  </button>
                </div>
              </div>
            ))}
            {variants.length === 0 && (
              <p className="text-sm text-slate-500">Nenhum grupo de variante — o produto não terá seleção de cor/tamanho.</p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Preço</h2>
        {hasVariants ? (
          <>
            <p className="mt-1 text-xs text-slate-400">Estoque e custo ficam no passo &quot;Estoque&quot; — aqui é só preço de venda.</p>
            {variantPriceRows.length > 0 ? (
              <div className="mt-4">
                <VariantPriceTable
                  rows={variantPriceRows}
                  prices={variantPrices}
                  onPriceChange={onVariantPriceChange}
                  promoPrices={variantPromoPrices}
                  onPromoPriceChange={onVariantPromoPriceChange}
                  showInventoryColumns={isEditing}
                />
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">Defina ao menos um grupo de variante acima para poder definir o preço de cada combinação.</p>
            )}
          </>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Preço (R$)</label>
              <CurrencyInput
                value={price}
                onChange={onPriceChange}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Preço promocional</label>
              <CurrencyInput
                value={promoPrice}
                onChange={onPromoPriceChange}
                placeholder="opcional"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>
        )}
      </section>
    </>
  );
}
