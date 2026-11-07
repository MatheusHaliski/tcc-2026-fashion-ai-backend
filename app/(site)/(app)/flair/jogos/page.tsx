"use client";
import { Suspense } from "react";
import { RequireAuth } from "@/components/app-shell";
import { GamesCatalog } from "@/components/flair/games/games-catalog";

/** FLAIR › FLAIR 3D MAKE UP: catálogo dos 100 jogos por série, com filtros na URL e cadeado por nível (acesso vem do servidor). */
export default function GamesCatalogPage() { return <RequireAuth><Suspense><GamesCatalog /></Suspense></RequireAuth>; }
