"use client";

import { Suspense } from "react";
import { RequireAuth } from "@/components/app-shell";
import { NegotiationsPanel } from "@/components/marketplace/negotiations-panel";

export default function MarketplaceNegotiationsPage() {
  return <RequireAuth><Suspense><NegotiationsPanel /></Suspense></RequireAuth>;
}
