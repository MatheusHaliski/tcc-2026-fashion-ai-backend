"use client";
import { ErrorScreen } from "@/components/error-screen";

/** Erro no próprio layout raiz: substitui o documento inteiro, por isso traz <html> e <body>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f7f5f1", color: "#111" }}>
        <ErrorScreen error={error} reset={reset} />
      </body>
    </html>
  );
}
