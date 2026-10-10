"use client";
import { Suspense } from "react";
import { RequireAuth } from "@/components/app-shell";
import { PointsSection } from "@/components/points/sections";

/** FAI Points › ganhar: seção da central (components/points/sections.tsx). */
export default function PointsSectionPage() { return <RequireAuth><Suspense><PointsSection section="ganhar" /></Suspense></RequireAuth>; }
