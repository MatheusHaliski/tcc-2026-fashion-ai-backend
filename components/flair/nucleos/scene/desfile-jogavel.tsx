"use client";
/**
 * O desfile jogável dentro da cena (lib/flair/nucleos/movimento/desfile.ts): a cada quadro confere as marcas que a
 * personagem alcançou; cada marca nova acende o flash e a plateia aplaude; □ na ponta faz a pose final, com flashes, e
 * depois avisa a tela (desfile-fim) para revelar o resultado. Publica o progresso para o painel da tela (desfile).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { assinarFx, emitirFx } from "@/lib/flair/nucleos/fx-events";
import { DESFILE_INICIO, marcasDoDesfile, noDesfile } from "@/lib/flair/nucleos/movimento/desfile";
import { AVATAR, fig, luzId, Roteiro } from "@/lib/flair/nucleos/scene/script";
import type { Sala } from "@/lib/flair/nucleos/scene/types";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";
import type { Jogador } from "@/components/flair/nucleos/scene/andarilho";
import { agora, useCena } from "@/components/flair/nucleos/scene/stage-context";

/** Quanto a pose final fica na tela antes de revelar o resultado. */
export const POSE_FINAL_MS = 1600;

export function DesfileJogavel({ codigo, sala, jogador, ativo }: { codigo: NucleoCodigo; sala: Sala; jogador: React.MutableRefObject<Jogador>; ativo: boolean }) {
  const cena = useCena();
  const marcas = useMemo(() => marcasDoDesfile(codigo, sala), [codigo, sala]);
  const estado = useRef(DESFILE_INICIO);
  const temFlash = sala.luzes.proprias.some((l) => l.id === "flash");

  useEffect(() => {
    estado.current = DESFILE_INICIO;
    if (!ativo) return;
    let timer = 0;
    const cancelar = assinarFx((e) => {
      if (e.tipo !== "desfile-pose" || !estado.current.naPonta || timer) return;
      const r = new Roteiro("pose-final");
      r.depois(AVATAR, "POSE_1");
      if (temFlash) r.junto(luzId("flash"), "L_FLASH").junto(luzId("flash"), "L_FLASH", {}, 0.6);
      cena.diretor.tocar(r.fim(), agora(), cena.reduzido);
      timer = window.setTimeout(() => emitirFx({ tipo: "desfile-fim", nucleo: codigo }), cena.reduzido ? 300 : POSE_FINAL_MS);
    });
    return () => {
      cancelar();
      if (timer) window.clearTimeout(timer);
    };
  }, [ativo, codigo, cena, temFlash]);

  useFrame(() => {
    if (!ativo) return;
    const antes = estado.current;
    const depois = noDesfile(antes, jogador.current.pos, marcas);
    if (depois === antes) return;
    estado.current = depois;
    if (depois.alcancadas > antes.alcancadas) {
      const r = new Roteiro("marca");
      r.junto(fig("PLATEIA"), "F_APLAUSO");
      if (temFlash) r.junto(luzId("flash"), "L_FLASH");
      cena.diretor.tocar(r.fim(), agora(), cena.reduzido);
    }
    emitirFx({ tipo: "desfile", nucleo: codigo, alcancadas: depois.alcancadas, total: marcas.length, naPonta: depois.naPonta });
  });
  return null;
}
