import { RequireAuth } from '@/components/app-shell';
import { PrintableTechPack } from '@/components/atelier-projects/printable-tech-pack';
export default async function TechPackPage({ params }: { params: Promise<{ id: string; revisionId: string }> }) { const { id, revisionId } = await params; return <RequireAuth><PrintableTechPack id={id} revisionId={revisionId}/></RequireAuth>; }
