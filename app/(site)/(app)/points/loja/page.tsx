"use client";

import { RequireAuth } from "@/components/app-shell";
import { FaiDigitalStore } from "@/components/fai-store/digital-store";

export default function FaiStorePage() {
  return <RequireAuth><FaiDigitalStore /></RequireAuth>;
}
