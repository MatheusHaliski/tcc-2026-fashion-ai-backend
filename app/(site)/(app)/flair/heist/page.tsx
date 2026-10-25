'use client';
import {RequireAuth} from '@/components/app-shell';
import {GalaHeist} from '@/components/flair/gala-heist';
export default function Page(){return <RequireAuth><GalaHeist/></RequireAuth>;}
