import { RequireAuth } from '@/components/app-shell';
import { OrderTracker } from '@/components/garment-delivery/order-tracker';

export default async function AtelierOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequireAuth><OrderTracker id={id} /></RequireAuth>;
}
