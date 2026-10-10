"use client";
import { Suspense } from "react";
import { RequireAuth } from "@/components/app-shell";
import { PointsSection } from "@/components/points/sections";

/** FAI Points › loja: seção da central (components/points/sections.tsx). */
export default function PointsSectionPage() { return <RequireAuth><Suspense><PointsSection section="loja" /></Suspense></RequireAuth>; }
