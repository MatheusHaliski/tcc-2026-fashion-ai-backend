"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui";

// Prévia 2D (PROV-2D): o mesmo Avatar 3D do espelho, parado e de frente, como imagem (reflexo no vidro e no Vista-me)
export const AvatarStill = dynamic(() => import("@/components/three/avatar-still"), { ssr: false, loading: () => <Skeleton className="h-full w-full" /> });
