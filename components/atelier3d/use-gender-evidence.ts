"use client";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import type { GenderEvidence } from "./contracts";

const RETRIES = 2;
const RETRY_DELAY_MS = 1500;

/**
 * Dados da composição que liberam o "Salvar" do editor. Uma falha passageira não pode deixar o bloco em
 * "Carregando…" para sempre (e o salvar desligado): a conferência é refeita antes de avisar o erro.
 * Acesso negado (401/403) não é repetido.
 */
export function useGenderEvidence(
  load: (ids: string[]) => Promise<GenderEvidence>,
  ids: string[],
  onError: (error: unknown) => void,
) {
  const [evidence, setEvidence] = useState<GenderEvidence | null>(null);
  const key = JSON.stringify(ids); // identidade estável das fontes, não a referência do array
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setEvidence(null);
    const attempt = (left: number) => {
      load(JSON.parse(key) as string[])
        .then((next) => {
          if (alive) setEvidence(next);
        })
        .catch((error) => {
          if (!alive) return;
          const denied = error instanceof ApiError && (error.status === 401 || error.status === 403);
          if (left > 0 && !denied) timer = setTimeout(() => attempt(left - 1), RETRY_DELAY_MS);
          else onError(error);
        });
    };
    attempt(RETRIES);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [load, key, onError]);
  return [evidence, setEvidence] as const;
}
