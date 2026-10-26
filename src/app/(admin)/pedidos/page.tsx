import { PageHeader } from '@/components/ui/PageHeader';
import { listOrders } from './actions';
import { OrdersTable } from './OrdersTable';

export default async function PedidosPage() {
  const orders = await listOrders();
  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  return (
    <div>
      <PageHeader
        eyebrow="Loja virtual"
        title="Pedidos"
        description={
          <>
            {pendingCount} pedido{pendingCount === 1 ? '' : 's'} aguardando pagamento · {orders.length} no total. Os pagos
            pelo Mercado Pago entram como confirmados automaticamente.
          </>
        }
      />

      <OrdersTable initialOrders={orders} />
    </div>
  );
}
