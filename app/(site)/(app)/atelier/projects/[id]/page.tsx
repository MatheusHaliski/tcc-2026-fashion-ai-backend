import { RequireAuth } from '@/components/app-shell';
import { AtelierProjectDetail } from '@/components/atelier-projects/project-detail';
export default async function AtelierProjectPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <RequireAuth><AtelierProjectDetail id={id}/></RequireAuth>; }
