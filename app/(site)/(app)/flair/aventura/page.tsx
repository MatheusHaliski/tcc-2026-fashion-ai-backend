'use client';
import {RequireAuth} from '@/components/app-shell';
import {AfterpartyAdventure} from '@/components/flair/afterparty-adventure';
export default function Page(){return <RequireAuth><AfterpartyAdventure/></RequireAuth>;}
