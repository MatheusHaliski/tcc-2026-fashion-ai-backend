"use client";
import { RequireAuth } from "@/components/app-shell";
import { MakeUpCareer } from "@/components/flair/make-up/makeup-career";

/** FLAIR › FLAIR 3D MAKE UP: carreira (nível, Prestígio e progresso) e a lista de briefs. */
export default function MakeUpPage() {
  return (
    <RequireAuth>
      <MakeUpCareer />
    </RequireAuth>
  );
}
