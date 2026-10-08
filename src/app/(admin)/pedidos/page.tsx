import { listOrders } from './actions';
import { OrdersTable } from './OrdersTable';

export default async function PedidosPage() {
  const orders = await listOrders();
  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pedidos</h1>
        <p className="mt-1 text-sm text-slate-500">
          {pendingCount} pedido{pendingCount === 1 ? '' : 's'} pendente{pendingCount === 1 ? '' : 's'} · {orders.length}{' '}
          no total
        </p>
      </div>

      <OrdersTable initialOrders={orders} />
    </div>
  );
}
