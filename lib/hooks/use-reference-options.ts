"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { ReferenceOption } from "@/lib/api/types";

export type ReferenceOptionsStatus = "loading" | "ready" | "error";

/**
 * Opções de um campo de seleção dos criadores de peça e de look, lidas de um GET de catálogo (UUID, código e nome).
 *
 * A leitura vai com a sessão de quem está criando (os criadores só abrem com login): um GET novo de opções passa pela
 * regra padrão "autenticado" do backend sem cadastrar nada em SecurityConfig. Sem sessão a mesma chamada sai sem token
 * e só carrega catálogos públicos (PUBLIC_GET, ou /api/opcoes/** por convenção). Nunca passe `anonymous: true` aqui:
 * era isso que travava em 401 o campo novo (ex.: Origem) mesmo com a pessoa logada, e "Tentar de novo" repetia o 401.
 */
export function useReferenceOptions(path: string) {
  const [options, setOptions] = useState<ReferenceOption[]>([]);
  const [status, setStatus] = useState<ReferenceOptionsStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    api.get<ReferenceOption[]>(path, { signal: controller.signal })
      .then(rows => { if (!controller.signal.aborted) { setOptions(Array.isArray(rows) ? rows : []); setStatus("ready"); } })
      .catch(() => { if (!controller.signal.aborted) setStatus("error"); });
    return () => controller.abort();
  }, [path, attempt]);
  return { options, status, retry: () => setAttempt(n => n + 1) };
}
