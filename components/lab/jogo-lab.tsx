"use client";
/**
 * Laboratório da cena de jogo (FLAIR 3D): a cena 3D de verdade de um jogo, sem partida, com a modelo da casa na
 * preparação e o andar livre ligado, para conferir no navegador o andar (WASD), o clipe de caminhar, a área de andar
 * e a câmera que segue. `?jogo=DRESS_FIGHTER` escolhe o jogo e `?variante=REGIAO_PARIS` a sala dele; `?agilidade=N` a agilidade do look; nos jogos de zonas,
 * `?zonas=FRENTE:C8283A,MANGAS:F5F4F0` veste a peça pintada e `?fase=uso` abre a fase de uso (o campo, o palco, a pista,
 * o terraço) com um pedido de execução de exemplo: Espaço ✕, K ○, F □, I △; os toques aparecem em `data-toques`
 * (`?prazo=ms` e `?janela=ms` trocam o prazo da fase e a janela da deixa, para a máquina lenta de prova).
 */
import { useEffect, useRef, useState } from "react";
import NucleoScene3D from "@/components/flair/nucleos/nucleo-scene-3d";
import { MODELO_CASA } from "@/components/flair/nucleos/nucleo-avatar";
import { DesfileHud } from "@/components/flair/nucleos/desfile-hud";
import { NA_MARCA, type Jogador } from "@/components/flair/nucleos/scene/andarilho";
import { useEixoDeAndar } from "@/components/flair/nucleos/use-eixo-de-andar";
import { emitirFx } from "@/lib/flair/nucleos/fx-events";
import type { BotaoDaExecucao, Toque } from "@/lib/flair/nucleos/movimento/execucao";
import { SALA_DE_USO } from "@/lib/flair/nucleos/movimento/fase-de-uso";
import { NUCLEOS } from "@/lib/flair/nucleos/registry";
import { pecasDasZonas } from "@/lib/flair/nucleos/pecas-pintadas";
import type { NucleoCodigo, NucleoResultado, ZonaEscolha } from "@/lib/flair/nucleos/types";

const AVATAR = { giro: 0, zoom: 0, poses: 0, desfilando: false };
const TECLAS: Record<string, BotaoDaExecucao> = { Space: "VESTIR", KeyK: "TIRAR", KeyF: "DESFILAR", KeyI: "TROCAR_ABA" };
/** O pedido de exemplo da fase de uso (o do servidor sai da semente da partida). */
const PEDIDO = {
  botoes: ["VESTIR", "DESFILAR", "TIRAR", "TROCAR_ABA", "VESTIR"],
  ousados: ["TROCAR_ABA", "VESTIR", "DESFILAR", "TIRAR", "DESFILAR"],
  janelaMs: 1000,
  janelaOusadaMs: 600,
  prazoMs: 25000,
  custo: 12,
  recurso: "ENERGIA",
  reserva: 50,
  dreno: 15,
};
const emUso = (prazoMs: number, janelaMs: number) => ({ status: "EM_ACAO", pontos: 0, estrelas: 0, resultado: "EM_ACAO", regras: [], cartas: [], eventos: [{ codigo: "EXECUCAO_PEDIDA", valor: { ...PEDIDO, prazoMs, janelaMs, janelaOusadaMs: janelaMs * 0.6 } }] }) as unknown as NucleoResultado;

export default function JogoLab() {
  const [jogo, setJogo] = useState<{ codigo: NucleoCodigo; agilidade: number; zonas: Record<string, ZonaEscolha>; uso: boolean; pedido: NucleoResultado; variante: string | null } | null>(null);
  const [toques, setToques] = useState<Toque[] | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const zonas = Object.fromEntries((q.get("zonas") ?? "").split(",").filter(Boolean).map((z) => [z.split(":")[0], { cor: `#${z.split(":")[1]}` }]));
    setJogo({ codigo: (q.get("jogo") ?? "DRESS_FIGHTER") as NucleoCodigo, agilidade: Number(q.get("agilidade") ?? 50), zonas, uso: q.get("fase") === "uso", pedido: emUso(Number(q.get("prazo") ?? PEDIDO.prazoMs), Number(q.get("janela") ?? PEDIDO.janelaMs)), variante: q.get("variante") });
  }, []);
  useEixoDeAndar(!!jogo);
  // a posição da personagem, publicada em window.__jogoLab para os scripts de prova
  const jogador = useRef<Jogador>({ pos: NA_MARCA, andando: false });
  useEffect(() => {
    (window as unknown as { __jogoLab?: () => Jogador["pos"] }).__jogoLab = () => jogador.current.pos;
  }, []);
  const codigo = jogo?.codigo;
  const uso = !!jogo?.uso;
  useEffect(() => {
    if (!codigo || !uso) return;
    const tecla = (e: KeyboardEvent) => {
      const botao = TECLAS[e.code];
      if (botao) emitirFx({ tipo: "desfile-botao", nucleo: codigo, botao });
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [codigo, uso]);
  if (!jogo) return null;
  const config = NUCLEOS[jogo.codigo];
  return (
    <main className="p-4">
      <h1 className="type-h3 mb-2">Laboratório de jogo · {jogo.codigo}</h1>
      <div data-jogo-lab data-toques={toques ? JSON.stringify(toques) : undefined} className="n3d-stage" style={{ width: 1100, height: 680, background: "#15161a", position: "relative" }}>
        <NucleoScene3D config={config} avatar={AVATAR} pecas={pecasDasZonas(jogo.codigo, jogo.zonas)} reduzido={false} desfile={false} rotulo={jogo.codigo} protagonista={MODELO_CASA}
          semente={7} momento={uso ? "ACAO" : "PREPARO"} variante={uso ? SALA_DE_USO : jogo.variante} desfileAtivo={uso} andarLivre agilidade={jogo.agilidade} jogadorDeFora={jogador} />
        {uso && <DesfileHud codigo={jogo.codigo} onFim={() => undefined} resultado={toques ? null : jogo.pedido} onExecucao={setToques} />}
      </div>
    </main>
  );
}
