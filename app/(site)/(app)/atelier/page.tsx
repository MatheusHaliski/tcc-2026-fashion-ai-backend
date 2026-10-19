import {Suspense} from 'react';
import {RequireAuth} from '@/components/app-shell';
import {AtelierHub} from '@/components/atelier/atelier-hub';
export default function AtelierPage(){return <RequireAuth><Suspense><AtelierHub/></Suspense></RequireAuth>;}
