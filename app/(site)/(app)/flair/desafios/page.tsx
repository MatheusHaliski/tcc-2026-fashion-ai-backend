"use client";
import { Suspense } from "react";
import { RequireAuth } from "@/components/app-shell";
import { CbcList } from "@/components/flair/cbc";

/** FLAIR › Desafios de Montagem (Card Building Challenges): agora, em breve, sempre disponíveis, grupos e memórias. */
export default function CbcListPage() { return <RequireAuth><Suspense><CbcList /></Suspense></RequireAuth>; }
