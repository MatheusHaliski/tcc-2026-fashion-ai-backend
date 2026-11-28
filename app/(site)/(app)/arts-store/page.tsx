"use client";

import { RequireAuth } from "@/components/app-shell";
import { ArtsStore } from "@/components/fai-store/arts-store";

export default function ArtsStorePage() {
  return <RequireAuth><ArtsStore /></RequireAuth>;
}
