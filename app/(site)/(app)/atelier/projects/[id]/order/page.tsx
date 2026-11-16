import { RequireAuth } from '@/components/app-shell';
import { OrderCheckout } from '@/components/garment-delivery/order-checkout';

/** Checkout da encomenda à Fábrica FashionAI; ?revision= escolhe a revisão (padrão: a publicada mais recente). */
export default async function AtelierOrderCheckoutPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ revision?: string }> }) {
  const [{ id }, { revision }] = await Promise.all([params, searchParams]);
  return <RequireAuth><OrderCheckout projectId={id} revisionId={revision ?? null} /></RequireAuth>;
}
