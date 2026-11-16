import { RequireAuth } from '@/components/app-shell';
import { OrderList } from '@/components/garment-delivery/order-list';

export default function AtelierOrdersPage() {
  return <RequireAuth><OrderList /></RequireAuth>;
}
