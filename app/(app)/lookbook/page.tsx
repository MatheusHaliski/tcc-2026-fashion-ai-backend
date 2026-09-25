"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/session";
import { RequireAuth } from "@/components/app-shell";
import { Skeleton } from "@/components/ui";

/** O Lookbook é o próprio perfil: esta rota leva ao /u/<seu usuário>, que mostra as abas de dono quando o perfil é seu. */
function LookbookRedirect() {
  const { user } = useAuth(); const router = useRouter();
  useEffect(() => {
    if (!user) return;
    const tab = new URLSearchParams(window.location.search).get("tab");
    router.replace(`/u/${encodeURIComponent(user.username)}${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`);
  }, [user, router]);
  return <Skeleton className="h-64" />;
}
export default function LookbookPage() { return <RequireAuth><LookbookRedirect /></RequireAuth>; }
