"use client";
import { useEffect, useState } from "react";
import { isChunkLoadError, reloadOnceForChunk } from "@/lib/chunk-recovery";

/**
 * Erro no próprio layout raiz: substitui o documento inteiro, por isso traz <html> e <body>. Fica acima dos dois
 * layouts raiz (app e gate), então não importa nada do produto (catálogos de texto, marca): texto fixo e neutro.
 * Se o erro é um pedaço de script que sumiu num deploy novo, recarrega sozinha uma vez.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const chunk = isChunkLoadError(error);
  const [reloading, setReloading] = useState(chunk);
  useEffect(() => { if (chunk && !reloadOnceForChunk()) setReloading(false); }, [chunk]);
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", background: "#f7f5f1", color: "#111" }}>
        <main role="alert" style={{ textAlign: "center", padding: 24 }}>
          <p>{reloading ? "Atualizando…" : "Algo deu errado. / Something went wrong."}</p>
          {!reloading && <button type="button" onClick={reset} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", font: "inherit", cursor: "pointer" }}>Tentar de novo / Try again</button>}
          {error.digest && <p style={{ marginTop: 12, fontSize: 12, color: "#666" }}>{error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
