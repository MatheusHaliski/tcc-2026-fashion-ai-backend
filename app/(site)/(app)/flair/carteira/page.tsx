"use client";
import { Suspense } from "react";
import { RequireAuth } from "@/components/app-shell";
import { FlairSection } from "@/components/flair/sections";

/** FLAIR › carteira: seção da central (components/flair/sections.tsx). */
export default function FlairSectionPage() { return <RequireAuth><Suspense><FlairSection section="carteira" /></Suspense></RequireAuth>; }
