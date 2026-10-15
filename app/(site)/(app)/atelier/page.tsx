"use client";
import { RequireAuth } from "@/components/app-shell";
import { AtelierView } from "@/components/atelier/atelier-view";

export default function AtelierPage() {
  return <RequireAuth><AtelierView /></RequireAuth>;
}
