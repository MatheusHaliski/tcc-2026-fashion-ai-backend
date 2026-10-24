"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import { Suspense } from "react";
import { RequireAuth } from "@/components/app-shell";
import { FlairHub } from "@/components/flair/hub";

/**
 * Central FLAIR (RF37): tela de seleção de jogos. A lista lateral escolhe o modo; o painel mostra título, objetivo,
 * demonstração e a ação para começar. As partidas, a coleção e os desafios ficam nas sub-rotas /flair/*.
 * Links antigos (/flair?tab=…) são redirecionados pela própria central.
 */
export default function FlairPage() { const {t}=useI18n(); return <RequireAuth><Link href="/flair/aventura" className="btn mb-4">{t("afterparty.title")}</Link><Suspense><FlairHub /></Suspense></RequireAuth>; }
