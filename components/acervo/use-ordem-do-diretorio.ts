"use client";
/**
 * ACERVO — reordenar o diretório: arrastar uma linha e soltar sobre outra do mesmo nível (ambientes, móveis de um
 * ambiente, compartimentos de um móvel) e, pelo teclado ou toque, "Mover para cima" e "Mover para baixo" no menu da
 * linha. Os dois caminhos gravam a ordem pela API. Arrastar peça continua separado (outro formato no arrasto).
 */
import { useState, type DragEvent } from "react";
import type { MenuItem } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { reordenar, type NivelDeOrdem } from "@/lib/acervo/ordem";
import { useAcervo } from "./acervo-contexto";

const TIPO = "application/x-acervo-ordem";

export interface OrdemDoDiretorio {
  /** atributos da linha arrastável */
  linha: (nivel: NivelDeOrdem, id: string) => {
    draggable: true;
    "data-alvo-ordem"?: "true";
    onDragStart: (e: DragEvent) => void;
    onDragOver: (e: DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: DragEvent) => void;
    onDragEnd: () => void;
  };
  /** "Mover para cima" e "Mover para baixo" (o menu da linha) */
  menu: (nivel: NivelDeOrdem, id: string) => MenuItem[];
}

export function useOrdemDoDiretorio(): OrdemDoDiretorio {
  const { t } = useI18n();
  const { dados } = useAcervo();
  const [arrastado, setArrastado] = useState<{ chave: string; id: string } | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);

  const gravar = (nivel: NivelDeOrdem, id: string, destino: number) => {
    const ids = reordenar(nivel.todos, nivel.visiveis, id, destino);
    if (ids) void dados.executar(() => nivel.salvar(ids), t("acervo.ordem.salva"));
  };
  const valeSoltar = (nivel: NivelDeOrdem, id: string) => !!arrastado && arrastado.chave === nivel.chave && arrastado.id !== id;
  const terminar = () => {
    setArrastado(null);
    setAlvo(null);
  };

  return {
    linha: (nivel, id) => ({
      draggable: true,
      "data-alvo-ordem": alvo === `${nivel.chave}:${id}` ? "true" : undefined,
      onDragStart: (e) => {
        // a linha de dentro (um compartimento dentro do móvel) arrasta só a si mesma
        e.stopPropagation();
        e.dataTransfer.setData(TIPO, id);
        e.dataTransfer.effectAllowed = "move";
        setArrastado({ chave: nivel.chave, id });
      },
      onDragOver: (e) => {
        if (!valeSoltar(nivel, id)) return;
        e.preventDefault();
        e.stopPropagation();
        setAlvo(`${nivel.chave}:${id}`);
      },
      onDragLeave: () => setAlvo(null),
      onDrop: (e) => {
        if (!arrastado || !valeSoltar(nivel, id)) return;
        e.preventDefault();
        e.stopPropagation();
        gravar(nivel, arrastado.id, nivel.visiveis.indexOf(id));
        terminar();
      },
      onDragEnd: terminar,
    }),
    menu: (nivel, id) => {
      const posicao = nivel.visiveis.indexOf(id);
      return [
        { label: t("acervo.ordem.subir"), disabled: posicao <= 0, onSelect: () => gravar(nivel, id, posicao - 1) },
        { label: t("acervo.ordem.descer"), disabled: posicao >= nivel.visiveis.length - 1, onSelect: () => gravar(nivel, id, posicao + 1) },
      ];
    },
  };
}
