/**
 * Mesmo contrato de dados usado pelo site público (Adom-Website), acrescido
 * de `stockQuantity`. É o formato que a rota pública `/api/products` expõe.
 */

export interface ProductVariantOption {
  id: string;
  label: string;
  /** valor extra (ex: código hex de cor) usado só para exibição */
  meta?: string;
  /** foto do produto (uma das URLs em `images`) a mostrar quando esta opção é selecionada */
  image?: string;
}

export interface ProductVariantGroup {
  id: string;
  name: string;
  options: ProductVariantOption[];
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription?: string;
  price: number;
  promoPrice?: number;
  images: string[];
  category: string;
  variants: ProductVariantGroup[];
  available: boolean;
  featured: boolean;
  tags: string[];
  stockQuantity: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}
