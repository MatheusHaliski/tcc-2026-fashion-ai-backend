"use client";
/**
 * O perfil de controles "console" na fase de uso dos jogos de zonas (lib/flair/nucleos/controle/perfil-console.ts):
 * as setas levam a personagem (no Piloto as setas são o volante: ↑ acelera, ↓ freia, ← → viram); E (✕) faz o lance
 * seguro ou a primeira opção do momento-chave, F (R2) o ousado ou a segunda; X segurado abre a roda de cartas e,
 * solto, arma a carta em foco (P também arma); T alterna a tela cheia; ? abre o cartão de controles. Escreve o eixo de
 * andar da cena (lib/flair/entrada/eixo-de-andar.ts) e os botões da deixa (fx "desfile-botao").
 */
import { useEffect, useRef, useState } from "react";
import { useControleConsole } from "@/components/flair/nucleos/console/use-controle-console";
import type { Deixa } from "@/components/flair/nucleos/use-execucao-do-desfile";
import { definirAndar, definirEixo } from "@/lib/flair/entrada/eixo-de-andar";
import { estadoDoConsole } from "@/lib/flair/nucleos/controle/estado-do-console";
import { perfilDoJogo } from "@/lib/flair/nucleos/controle/perfil-console";
import { girarFoco } from "@/lib/flair/nucleos/controle/roda-radial";
import { emitirFx } from "@/lib/flair/nucleos/fx-events";
import { eixoDoVolante, VOLANTE } from "@/lib/flair/nucleos/movimento/volante";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

interface Opcoes {
  codigo: NucleoCodigo;
  ativo: boolean;
  deixa: Deixa | null;
  /** quantas cartas a roda tem e o que armar a de índice i faz */
  cartas: number;
  armar: (i: number) => void;
  alternarTelaCheia: () => void;
}

export function usaConsoleNaFase(codigo: NucleoCodigo): boolean {
  return perfilDoJogo(codigo) === "console";
}

export function useConsoleDaFaseDeUso({ codigo, ativo, deixa, cartas, armar, alternarTelaCheia }: Opcoes) {
  const ligado = ativo && usaConsoleNaFase(codigo);
  const [roda, setRoda] = useState<{ aberta: boolean; foco: number }>({ aberta: false, foco: 0 });
  const [ajuda, setAjuda] = useState(false);
  const ref = useRef({ deixa, roda, cartas, armar, alternarTelaCheia });
  ref.current = { deixa, roda, cartas, armar, alternarTelaCheia };

  useControleConsole({
    ativo: ligado,
    onAcao: (acao, fase) => {
      const r = ref.current;
      const botao = (ousado: boolean) => {
        const d = r.deixa;
        if (!d) return ousado ? null : "DESFILAR";
        return ousado ? d.ousado ?? d.botao : d.botao;
      };
      if (acao === "INTERAGIR" || acao === "DISPARAR") {
        const b = botao(acao === "DISPARAR");
        if (b) emitirFx({ tipo: "desfile-botao", nucleo: codigo, botao: b });
      } else if (acao === "RODA") {
        if (fase === "desce") setRoda((x) => ({ ...x, aberta: r.cartas > 0 }));
        else {
          if (r.roda.aberta) r.armar(r.roda.foco);
          setRoda((x) => ({ ...x, aberta: false }));
        }
      } else if (acao === "PEGAR" && r.roda.aberta) {
        r.armar(r.roda.foco);
        setRoda((x) => ({ ...x, aberta: false }));
      } else if (acao === "PAINEL_DIREITO" || acao === "PAINEL_ESQUERDO") {
        setRoda((x) => ({ ...x, foco: girarFoco(x.foco, acao === "PAINEL_DIREITO" ? 1 : -1, Math.max(1, r.cartas)) }));
      } else if (acao === "TELA_CHEIA") r.alternarTelaCheia();
      else if (acao === "AJUDA") setAjuda((a) => !a);
      else if (acao === "PAUSA") {
        setAjuda(false);
        setRoda((x) => ({ ...x, aberta: false }));
      }
    },
  });

  // as setas (ou o analógico) levam a personagem; com a roda aberta elas escolhem a carta e a personagem para
  useEffect(() => {
    if (!ligado || typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return;
    definirAndar(true);
    const volante = VOLANTE.has(codigo);
    const carro = { giro: 0, antes: performance.now() };
    let frame = 0;
    const ler = () => {
      const agora = performance.now();
      // o comando legado desliga o andar quando a ação começa: aqui ele fica ligado enquanto o console manda
      definirAndar(true);
      const { mover } = estadoDoConsole();
      const parado = ref.current.roda.aberta;
      definirEixo(parado ? { x: 0, y: 0 } : volante ? eixoDoVolante(carro, mover, (agora - carro.antes) / 1000) : mover);
      carro.antes = agora;
      frame = window.requestAnimationFrame(ler);
    };
    frame = window.requestAnimationFrame(ler);
    return () => {
      window.cancelAnimationFrame(frame);
      definirAndar(false);
    };
  }, [ligado, codigo]);

  return { ligado, roda, setFoco: (foco: number) => setRoda((x) => ({ ...x, foco })), fecharRoda: () => setRoda((x) => ({ ...x, aberta: false })), ajuda, fecharAjuda: () => setAjuda(false) };
}
