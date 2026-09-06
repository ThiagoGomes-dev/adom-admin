import { listProducts } from '../../produtos/actions';
import { NewSaleForm } from './NewSaleForm';

export default async function NovaVendaPage() {
  const products = await listProducts();

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Registrar venda</h1>
      <p className="mt-1 text-sm text-slate-500">
        O pagamento já foi combinado com o cliente (WhatsApp, Pix, etc.) — aqui é só o registro pra baixar o estoque.
      </p>
      <div className="mt-6">
        <NewSaleForm products={products} />
      </div>
    </div>
  );
}
