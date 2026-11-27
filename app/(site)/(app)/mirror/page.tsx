"use client";
import { Suspense } from "react";
import { RequireAuth } from "@/components/app-shell";
import { MirrorPage } from "@/components/mirror/mirror-page";

/** O Espelho (RF28) com casa própria: a prova 2D do look, as partes, o Vista-me e as ações, sobre /api/me/mirror. */
export default function MirrorRoute() { return <RequireAuth><Suspense><MirrorPage /></Suspense></RequireAuth>; }
