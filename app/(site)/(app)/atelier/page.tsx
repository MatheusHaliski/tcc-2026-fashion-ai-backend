import { Suspense } from 'react';
import { RequireAuth } from '@/components/app-shell';
import { AtelierWorkspace } from '@/components/atelier-projects/atelier-workspace';
export default function AtelierPage() { return <RequireAuth><Suspense><AtelierWorkspace/></Suspense></RequireAuth>; }
