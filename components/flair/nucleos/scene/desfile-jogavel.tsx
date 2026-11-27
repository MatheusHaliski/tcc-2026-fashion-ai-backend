"use client";
/**
 * O desfile jogável dentro da cena (lib/flair/nucleos/movimento/desfile.ts): a cada quadro confere as marcas que a
 * personagem alcançou; cada marca nova acende o flash e a plateia aplaude; □ na ponta faz a pose final, com flashes, e
 * depois avisa a tela (desfile-fim) para revelar o resultado. Publica o progresso para o painel da tela (desfile) e
 * desenha as marcas no piso (marcas-do-percurso.tsx). Na fase de uso dos jogos de zonas, cada nota da execução vira o
 * gesto do lance (o passe, o chute, o agudo, o golpe) e a reação de quem assiste, que comemora o momento-chave certo e
 * a carta de Hype alto (a torcida reage à faixa) e lamenta o erro.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { assinarFx, emitirFx } from "@/lib/flair/nucleos/fx-events";
import { DESFILE_INICIO, marcasDoDesfile, noDesfile } from "@/lib/flair/nucleos/movimento/desfile";
import { AVATAR, fig, luzId, Roteiro } from "@/lib/flair/nucleos/scene/script";
import type { Sala } from "@/lib/flair/nucleos/scene/types";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";
import type { Jogador } from "@/components/flair/nucleos/scene/andarilho";
import { MarcasDoPercurso } from "@/components/flair/nucleos/scene/marcas-do-percurso";
import { faseDeUsoDe, reacaoAoLance } from "@/lib/flair/nucleos/movimento/fase-de-uso";
import { agora, useCena } from "@/components/flair/nucleos/scene/stage-context";

/** Quanto a pose final fica na tela antes de revelar o resultado. */
export const POSE_FINAL_MS = 1600;

/** Quem reage a cada ponto e o gesto final de cada jogo. */
const PUBLICO: Partial<Record<NucleoCodigo, string>> = { PASSARELA: "PLATEIA", DRESS_THE_STAR: "PLATEIA", BATALHA_LOOKS: "PLATEIA", BOUTIQUE_3D: "VENDEDORA", AROUND_THE_WORLD: "PASSANTE", PERSONAGEM_FILME: "CAMERA", CLUBE_CORACAO: "TORCIDA" };
const GESTO: Partial<Record<NucleoCodigo, string>> = { LABIRINTO: "APRESENTAR_O_LOOK", BOUTIQUE_3D: "ENTREGAR_A_PECA", PERSONAGEM_FILME: "ACAO", AROUND_THE_WORLD: "ACENAR", ROAD_TO_GLORY: "OLHAR_PARA_A_CAMERA",
  PILOTO_FAVORITO: "BAIXAR_A_VISEIRA", SUPER_HEROI: "POSE_DE_HEROI_1" };

export function DesfileJogavel({ codigo, sala, jogador, ativo }: { codigo: NucleoCodigo; sala: Sala; jogador: React.MutableRefObject<Jogador>; ativo: boolean }) {
  const cena = useCena();
  const marcas = useMemo(() => marcasDoDesfile(codigo, sala), [codigo, sala]);
  const estado = useRef(DESFILE_INICIO);
  const temFlash = sala.luzes.proprias.some((l) => l.id === "flash");
  // a fase de uso só vale no lugar dela (no ateliê, a peça que não saiu de lá, fica a pose no tablado)
  const uso = sala.zonas.avatar.marca === "tablado" ? null : faseDeUsoDe(codigo);

  useEffect(() => {
    estado.current = DESFILE_INICIO;
    if (!ativo) return;
    let timer = 0;
    const cancelar = assinarFx((e) => {
      if (e.tipo === "desfile-nota" && e.nucleo === codigo && uso) {
        const r = new Roteiro("lance");
        const reacao = reacaoAoLance(e.nota, e.carta?.faixa);
        r.junto(AVATAR, reacao.gesto === "OUSADO" ? uso.gesto.ousado : reacao.gesto === "ERRO" ? uso.gesto.erro : uso.gesto.seguro);
        if (uso.publico) r.junto(fig(uso.publico), reacao.publico);
        if (reacao.flash && temFlash) r.junto(luzId("flash"), "L_FLASH");
        cena.diretor.tocar(r.fim(), agora(), cena.reduzido);
        return;
      }
      if (e.tipo !== "desfile-pose" || !estado.current.naPonta || timer) return;
      const r = new Roteiro("pose-final");
      r.depois(AVATAR, GESTO[codigo] ?? "POSE_1");
      if (temFlash) r.junto(luzId("flash"), "L_FLASH").junto(luzId("flash"), "L_FLASH", {}, 0.6);
      cena.diretor.tocar(r.fim(), agora(), cena.reduzido);
      timer = window.setTimeout(() => emitirFx({ tipo: "desfile-fim", nucleo: codigo }), cena.reduzido ? 300 : POSE_FINAL_MS);
    });
    return () => {
      cancelar();
      if (timer) window.clearTimeout(timer);
    };
  }, [ativo, codigo, cena, temFlash, uso]);

  useFrame(() => {
    if (!ativo) return;
    const antes = estado.current;
    const depois = noDesfile(antes, jogador.current.pos, marcas);
    if (depois === antes) return;
    estado.current = depois;
    if (depois.alcancadas > antes.alcancadas) {
      const r = new Roteiro("marca");
      const publico = uso ? null : PUBLICO[codigo];
      if (publico) r.junto(fig(publico), "F_APLAUSO");
      if (temFlash) r.junto(luzId("flash"), "L_FLASH");
      cena.diretor.tocar(r.fim(), agora(), cena.reduzido);
    }
    emitirFx({ tipo: "desfile", nucleo: codigo, alcancadas: depois.alcancadas, total: marcas.length, naPonta: depois.naPonta });
  });
  if (!ativo) return null;
  return <MarcasDoPercurso codigo={codigo} marcas={marcas} altura={sala.zonas.avatar.altura} alvo={uso?.alvo} reduzido={cena.reduzido} />;
}
