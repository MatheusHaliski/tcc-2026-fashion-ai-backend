"use client";
import { ErrorScreen } from "@/components/error-screen";

/** Fronteira de erro das páginas: mantém o layout e mostra a tela de erro (ou recarrega após um deploy novo). */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} />;
}
