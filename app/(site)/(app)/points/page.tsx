"use client";
import { Suspense } from "react";
import { RequireAuth } from "@/components/app-shell";
import { PointsHub } from "@/components/points/hub";

/**
 * FAI Points (RF30 · RF39): central de seleção no mesmo formato da Central FLAIR. A lista lateral escolhe o lugar
 * (saldo e níveis, como ganhar, loja do quarto, extrato); o painel mostra título, objetivo, demonstração e a ação.
 */
export default function PointsPage() { return <RequireAuth><Suspense><PointsHub /></Suspense></RequireAuth>; }
