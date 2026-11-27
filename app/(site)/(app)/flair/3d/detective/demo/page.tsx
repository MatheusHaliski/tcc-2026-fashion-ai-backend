"use client";
import { RequireAuth } from "@/components/app-shell";
import { DemoDetetive } from "@/components/flair/detetive/demo/demo-detetive";

/** FLAIR › FLAIR 3D › Fashion Detective › demonstração jogável (movimento, combate e interação, simulados no navegador). */
export default function DemoDoDetetivePage() {
  return (
    <RequireAuth>
      <DemoDetetive />
    </RequireAuth>
  );
}
