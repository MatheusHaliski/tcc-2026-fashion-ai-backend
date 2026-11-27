"use client";
/** O nome de um jogo da sala no idioma da pessoa: o nome do núcleo ou "FLAIR 3D MAKE UP". */
import { useCallback } from "react";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { isNucleoCodigo } from "@/lib/flair/nucleos/registry";

export function useNomeDoJogo() {
  const tx = useNucleoText();
  return useCallback((jogo: string) => (isNucleoCodigo(jogo) ? tx.nome(jogo) : tx.t("flair3d.multi.makeUp")), [tx]);
}
