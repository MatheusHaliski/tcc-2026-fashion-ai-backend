/**
 * O que roda sozinho depois de entregar (seção 2, coluna "Automático"), montado com o resultado do servidor: a
 * plateia aplaude pela nota, a silhueta se revela, a claquete bate, a porta abre, a cliente prova, o mapa avança.
 * No fim, o avatar reage às estrelas. A cena só mostra o que o servidor calculou.
 */
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";
import { reacaoPorEstrelas } from "@/lib/flair/nucleos/scene/clips/comuns";
import { duracaoDaSequencia, type Sequencia } from "@/lib/flair/nucleos/scene/director";
import { LABIRINTO_ESPELHO, LABIRINTO_PORTA } from "@/lib/flair/nucleos/scene/salas/labirinto";
import { AVATAR, fig, luzId, movelId, Roteiro } from "@/lib/flair/nucleos/scene/script";
import { giroPara, PONTA_DA_PASSARELA } from "@/lib/flair/nucleos/scene/sequences-manual";
import { sequenciaDaLuta, sequenciaDaPartida } from "@/lib/flair/nucleos/scene/sequences-match";

/** Reação da plateia pela nota: levanta com 3 estrelas, aplaude com 1 ou 2, lamenta com 0. */
export function reacaoDaPlateia(estrelas: number): string {
  if (estrelas >= 3) return "F_COMEMORA";
  return estrelas >= 1 ? "F_APLAUSO" : "F_LAMENTA";
}

type Montagem = (r: Roteiro, resultado: NucleoResultado) => void;

const passarela: Montagem = (r, res) => {
  r.depois(AVATAR, "CAMINHADA_DE_PASSARELA", { repete: 2, mover: { z: PONTA_DA_PASSARELA } });
  r.junto(fig("PLATEIA"), reacaoDaPlateia(res.estrelas)).junto(luzId("flash"), "L_FLASH");
  if (res.estrelas >= 2) r.junto(luzId("flash"), "L_FLASH", {}, 1.3);
  r.depois(AVATAR, "PARADA_NA_PONTA");
};

const dressTheStar: Montagem = (r, res) => {
  r.depois(AVATAR, "ENTRADA_NO_PALCO", { repete: 2, mover: { z: 0.9 } });
  r.junto(fig("ESTRELA", 0), "F_REVELA").junto(luzId("estrela"), "L_ACENDE", { mantem: true }).depois(AVATAR, "POSE_DE_ESTRELA");
  r.junto(fig("PLATEIA"), reacaoDaPlateia(res.estrelas)).depois(AVATAR, "REVERENCIA");
};

const personagemFilme: Montagem = (r, res) => {
  const tituloCerto = res.regras.some((regra) => regra.codigo === "TITULO" && regra.ok);
  r.junto(luzId("set"), "L_ACENDE", { mantem: true }).junto(luzId("set2"), "L_ACENDE", { mantem: true }, 0.4).depois(movelId("claquete"), "M_CLAQUETE");
  r.depois(AVATAR, "ACAO").depois(AVATAR, "POSE_DE_CENA_1");
  if (tituloCerto) r.junto(luzId("genero"), "L_ACENDE", { mantem: true }).depois(movelId("claquete"), "M_CLAQUETE");
  r.depois(AVATAR, "CORTA");
};

const roadToGlory: Montagem = (r) => {
  r.junto(luzId("flash"), "L_FLASH", {}, 0.8).depois(AVATAR, "OLHAR_PARA_A_CAMERA");
  r.junto(luzId("flash"), "L_FLASH", {}, 1.0).depois(AVATAR, "VIRAR_O_ROSTO");
};

const PORTA_DA_GALA_Z = -4.4;

const fashionDetective: Montagem = (r, res) => {
  const acesso = res.regras.some((regra) => regra.codigo === "ACESSO" && regra.ok);
  const favoravel = res.resultado === "FAVORAVEL";
  r.depois(AVATAR, "MEIA_VOLTA", { mover: { giro: 180 } });
  r.depois(AVATAR, "CAMINHAR", { repete: 3, mover: { z: PORTA_DA_GALA_Z } });
  r.depois(AVATAR, "MOSTRAR_O_LOOK");
  if (acesso) r.depois(movelId("cordao"), "M_CORDAO_ABRE", { mantem: true });
  else r.depois(fig("SEGURANCA", 0), "F_BARRA");
  if (favoravel) {
    r.junto(movelId("portaE"), "M_PORTA_ABRE", { mantem: true }).junto(luzId("porta"), "L_ACENDE", { mantem: true });
    r.depois(movelId("portaD"), "M_PORTA_ABRE_D", { mantem: true });
    r.depois(AVATAR, "CAMINHAR", { repete: 2, mover: { z: -6.3 } });
  } else {
    r.depois(AVATAR, "EXAMINAR_A_PISTA");
  }
  r.depois(AVATAR, "MEIA_VOLTA", { mover: { giro: 0 } });
};

const boutique: Montagem = (r, res) => {
  const aprovou = res.resultado === "APROVADO";
  r.depois(AVATAR, "ENTREGAR_A_PECA");
  r.junto(luzId("espelho"), "L_ACENDE").depois(fig("CLIENTE", 0), "F_PROVA_E_GIRA");
  r.depois(fig("CLIENTE", 0), aprovou ? "F_COMEMORA" : "F_DEVOLVE");
};

const labirinto: Montagem = (r, res) => {
  const [ex, ez] = LABIRINTO_ESPELHO;
  const [px, pz] = LABIRINTO_PORTA;
  r.depois(AVATAR, "MEIA_VOLTA", { mover: { giro: giroPara(ex, ez) } });
  r.depois(AVATAR, "CAMINHAR", { repete: 2, mover: { x: ex, z: ez } });
  r.depois(AVATAR, "APRESENTAR_O_LOOK");
  if (res.resultado !== "ABRE") {
    r.depois(luzId("falha"), "L_ONDULA");
    return;
  }
  r.junto(luzId("espelho"), "L_ACENDE", { mantem: true }).depois(movelId("porta"), "M_PORTA_ABRE", { mantem: true });
  r.depois(AVATAR, "MEIA_VOLTA", { mover: { giro: giroPara(px - ex, pz + 0.9 - ez) } });
  r.depois(AVATAR, "CAMINHAR", { repete: 2, mover: { x: px, z: pz + 0.9 } });
  r.depois(AVATAR, "ATRAVESSAR_A_PORTA", { mover: { x: px, z: pz - 0.5, giro: 180 } });
};

const aroundTheWorld: Montagem = (r, res) => {
  r.depois(AVATAR, "CAMINHADA_DE_RUA", { repete: 2, mover: { z: 1.2 } });
  r.junto(fig("PASSANTE"), "F_ACENA").depois(AVATAR, "ACENAR");
  if (res.estrelas >= 1) r.junto(luzId("mapa"), "L_ACENDE", { mantem: true }).depois(movelId("marcador"), "M_MAPA_AVANCA", { mantem: true });
};

const batalha: Montagem = (r, res) => {
  const venceu = res.resultado === "VITORIA";
  r.depois(AVATAR, "ENTRADA_NO_PALCO", { mover: { z: 0.5 } });
  r.junto(fig("ADVERSARIO", 0), "F_POSE").depois(AVATAR, "POSE_LADO_A_LADO");
  r.junto(fig("PLATEIA"), reacaoDaPlateia(res.estrelas));
  if (venceu) r.junto(luzId("vencedor"), "L_ACENDE", { mantem: true }).depois(AVATAR, "VENCEDOR_LEVANTA_O_BRACO");
  else r.depois(fig("ADVERSARIO", 0), "F_LEVANTA_O_BRACO");
};

const MONTAGENS: Partial<Record<NucleoCodigo, Montagem>> = {
  PASSARELA: passarela,
  DRESS_THE_STAR: dressTheStar,
  PERSONAGEM_FILME: personagemFilme,
  ROAD_TO_GLORY: roadToGlory,
  FASHION_DETECTIVE: fashionDetective,
  BOUTIQUE_3D: boutique,
  LABIRINTO: labirinto,
  AROUND_THE_WORLD: aroundTheWorld,
  BATALHA_LOOKS: batalha,
};

/** O avatar saiu de cena no fim (atravessou a porta)? Então não há reação na frente da câmera. */
function saiuDeCena(codigo: NucleoCodigo, res: NucleoResultado): boolean {
  return (codigo === "LABIRINTO" && res.resultado === "ABRE") || (codigo === "FASHION_DETECTIVE" && res.resultado === "FAVORAVEL");
}

/** Sequência automática do jogo para este resultado, terminando na reação do avatar às estrelas. */
export function sequenciaDoResultado(codigo: NucleoCodigo, resultado: NucleoResultado): Sequencia {
  const r = new Roteiro("resultado");
  if (codigo === "DRESS_FIGHTER" || codigo === "FASHION_SPORTS") {
    const disputa = codigo === "DRESS_FIGHTER" ? sequenciaDaLuta(resultado) : sequenciaDaPartida(resultado);
    for (const p of disputa.passos) r.junto(p.ator, p.clip, { repete: p.repete, mover: p.mover, mantem: p.mantem }, p.inicio);
    r.espera(duracaoDaSequencia(disputa));
  } else {
    MONTAGENS[codigo]?.(r, resultado);
  }
  if (!saiuDeCena(codigo, resultado)) r.depois(AVATAR, reacaoPorEstrelas(resultado.estrelas));
  return r.fim();
}

/** Texto do placar no painel de LED (só números), quando o jogo tem placar. */
export function placarDaCena(codigo: NucleoCodigo, resultado: NucleoResultado | null | undefined): string | null {
  if (!resultado) return null;
  if (codigo === "FASHION_SPORTS") {
    const placar = resultado.eventos.find((e) => e.codigo === "PLACAR")?.valor;
    return placar == null ? null : String(placar).replace(/\D+/, " × ");
  }
  if (codigo === "BATALHA_LOOKS") {
    const adversario = resultado.eventos.find((e) => e.codigo === "ADVERSARIO")?.valor;
    return adversario == null ? String(Math.round(resultado.pontos)) : `${Math.round(resultado.pontos)} × ${String(adversario)}`;
  }
  return codigo === "PASSARELA" ? String(Math.round(resultado.pontos)) : null;
}
