/**
 * O que roda sozinho depois de entregar (seção 2, coluna "Automático"), montado com o resultado do servidor: a
 * plateia aplaude pela nota, a silhueta se revela, a claquete bate, a porta abre, a cliente prova, o mapa avança.
 * No fim, o avatar reage ao desfecho (vitória, empate, derrota; sem ele, às estrelas). A cena só mostra o que o servidor
 * calculou.
 */
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";
import { duracaoDaSequencia, type Sequencia } from "@/lib/flair/nucleos/scene/director";
import { MONTAGENS_DO_ATELIE } from "@/lib/flair/nucleos/scene/montagens-atelie";
import { AVATAR, fig, luzId, movelId, Roteiro } from "@/lib/flair/nucleos/scene/script";
import { sequenciaDaLuta, sequenciaDaPartida } from "@/lib/flair/nucleos/scene/sequences-match";
import { desfechoDe, type Desfecho } from "@/lib/flair/nucleos/narrativa";

/** Reação da plateia pela nota: levanta com 3 estrelas, aplaude com 1 ou 2, lamenta com 0. */
export function reacaoDaPlateia(estrelas: number): string {
  if (estrelas >= 3) return "F_COMEMORA";
  return estrelas >= 1 ? "F_APLAUSO" : "F_LAMENTA";
}

type Montagem = (r: Roteiro, resultado: NucleoResultado) => void;

const passarela: Montagem = (r, res) => {
  // o desfile é da pessoa (desfile jogável): a personagem não anda sozinha até a ponta
  r.junto(fig("PLATEIA"), reacaoDaPlateia(res.estrelas)).junto(luzId("flash"), "L_FLASH");
  if (res.estrelas >= 2) r.junto(luzId("flash"), "L_FLASH", {}, 1.3);
  // sem estrela, os fotógrafos baixam a câmera em vez de seguir fotografando
  if (res.estrelas === 0) r.junto(fig("FOTOGRAFO"), "F_LAMENTA");
  r.depois(AVATAR, "PARADA_NA_PONTA");
};

const dressTheStar: Montagem = (r, res) => {
  r.depois(AVATAR, "ENTRADA_NO_PALCO", { repete: 2 });
  r.junto(fig("ESTRELA", 0), "F_REVELA").junto(luzId("estrela"), "L_ACENDE", { mantem: true }).depois(AVATAR, "POSE_DE_ESTRELA");
  // a estrela reage ao look que vestiu: comemora, aplaude ou devolve com desânimo
  r.junto(fig("ESTRELA", 0), reacaoDaPlateia(res.estrelas)).junto(fig("PLATEIA"), reacaoDaPlateia(res.estrelas)).depois(AVATAR, "REVERENCIA");
};

const personagemFilme: Montagem = (r, res) => {
  const tituloCerto = res.regras.some((regra) => regra.codigo === "TITULO" && regra.ok);
  r.junto(luzId("set"), "L_ACENDE", { mantem: true }).junto(luzId("set2"), "L_ACENDE", { mantem: true }, 0.4).depois(movelId("claquete"), "M_CLAQUETE");
  r.depois(AVATAR, "ACAO").depois(AVATAR, "POSE_DE_CENA_1");
  if (tituloCerto) r.junto(luzId("genero"), "L_ACENDE", { mantem: true }).depois(movelId("claquete"), "M_CLAQUETE");
  // a equipe do set reage ao "corta": aplaude a cena com o título certo, lamenta a que não fechou
  r.junto(fig("CAMERA"), tituloCerto ? "F_APLAUSO" : "F_LAMENTA").junto(fig("CLAQUETE"), tituloCerto ? "F_APLAUSO" : "F_LAMENTA").depois(AVATAR, "CORTA");
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
  // a vendedora acompanha a prova de mão no queixo; a outra cliente só olha quando o look agrada
  r.junto(fig("VENDEDORA", 0), "F_POSE").junto(luzId("espelho"), "L_ACENDE").depois(fig("CLIENTE", 0), "F_PROVA_E_GIRA");
  if (aprovou) r.junto(fig("VENDEDORA", 0), "F_APLAUSO").junto(fig("CLIENTE_DA_LOJA", 0), "F_APLAUSO", {}, 0.5);
  else r.junto(fig("VENDEDORA", 0), "F_LAMENTA", {}, 0.4);
  r.depois(fig("CLIENTE", 0), aprovou ? "F_COMEMORA" : "F_DEVOLVE");
};

const labirinto: Montagem = (r, res) => {
  // a pessoa leva a personagem até o espelho (ação jogável); aqui só a apresentação e o que o espelho responde
  r.depois(AVATAR, "APRESENTAR_O_LOOK");
  if (res.resultado !== "ABRE") {
    r.depois(luzId("falha"), "L_ONDULA");
    return;
  }
  r.junto(luzId("espelho"), "L_ACENDE", { mantem: true }).depois(movelId("porta"), "M_PORTA_ABRE", { mantem: true });
};

const aroundTheWorld: Montagem = (r, res) => {
  // os passantes reagem ao look pela nota: aplaudem, acenam ou seguem o caminho deles
  if (res.estrelas >= 2) r.junto(fig("PASSANTE"), "F_APLAUSO").depois(AVATAR, "ACENAR");
  else if (res.estrelas === 1) r.junto(fig("PASSANTE", 0), "F_ACENA").depois(AVATAR, "ACENAR");
  if (res.estrelas >= 1) r.junto(luzId("mapa"), "L_ACENDE", { mantem: true }).depois(movelId("marcador"), "M_MAPA_AVANCA", { mantem: true });
};

/** Reação do avatar no fim, pelo desfecho: o modo artístico do ateliê conclui com 0 estrela e ainda assim é vitória. */
export function reacaoDoAvatar(res: Pick<NucleoResultado, "resultado" | "estrelas">): string {
  const d = desfechoDe(res);
  return d === "BOM" ? "REACAO_3" : d === "MEDIO" ? "REACAO_1" : "REACAO_0";
}

/**
 * O desfecho da batalha. Na campanha a rodada volta como ETAPA_CUMPRIDA ou ABERTA, sem VITORIA nem DERROTA: aí quem
 * venceu é quem fez mais pontos que o adversário daquela rodada (evento ADVERSARIO).
 */
export function desfechoDaBatalha(res: NucleoResultado): Desfecho {
  if (res.resultado === "VITORIA" || res.resultado === "DERROTA" || res.resultado === "EMPATE") return desfechoDe(res);
  const adversario = Number(res.eventos.find((e) => e.codigo === "ADVERSARIO")?.valor);
  if (!Number.isFinite(adversario)) return desfechoDe(res);
  return res.pontos > adversario ? "BOM" : res.pontos === adversario ? "MEDIO" : "RUIM";
}

/**
 * A plateia da batalha segue o desfecho, não só a nota: comemora ou aplaude quando escolhe a pessoa, hesita na batalha
 * apertada e, na derrota, aplaude o desafiante se o look da pessoa foi bom (2 estrelas ou mais) ou lamenta.
 */
export function plateiaDaBatalha(res: NucleoResultado): string {
  const desfecho = desfechoDaBatalha(res);
  if (desfecho === "BOM") return res.estrelas >= 3 ? "F_COMEMORA" : "F_APLAUSO";
  if (desfecho === "MEDIO") return "F_POSE";
  return res.estrelas >= 2 ? "F_APLAUSO" : "F_LAMENTA";
}

const batalha: Montagem = (r, res) => {
  const venceu = desfechoDaBatalha(res) === "BOM";
  r.depois(AVATAR, "ENTRADA_NO_PALCO");
  // os jurados avaliam os dois looks de mão no queixo; depois, plateia e jurados reagem ao desfecho de verdade
  r.junto(fig("JURADO"), "F_POSE").junto(fig("ADVERSARIO", 0), "F_POSE").depois(AVATAR, "POSE_LADO_A_LADO");
  r.junto(fig("PLATEIA"), plateiaDaBatalha(res)).junto(fig("JURADO"), desfechoDaBatalha(res) === "MEDIO" ? "F_POSE" : "F_APLAUSO");
  // o braço que sobe é o de quem venceu; quem perdeu lamenta
  if (venceu) r.junto(fig("ADVERSARIO", 0), "F_LAMENTA").junto(luzId("vencedor"), "L_ACENDE", { mantem: true }).depois(AVATAR, "VENCEDOR_LEVANTA_O_BRACO");
  else if (desfechoDaBatalha(res) === "RUIM") r.depois(fig("ADVERSARIO", 0), "F_LEVANTA_O_BRACO");
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
  ...MONTAGENS_DO_ATELIE,
};

/** O avatar saiu de cena no fim (atravessou a porta)? Então não há reação na frente da câmera. */
function saiuDeCena(codigo: NucleoCodigo, res: NucleoResultado): boolean {
  return codigo === "FASHION_DETECTIVE" && res.resultado === "FAVORAVEL";
}

/** Sequência automática do jogo para este resultado, terminando na reação do avatar ao desfecho. */
export function sequenciaDoResultado(codigo: NucleoCodigo, resultado: NucleoResultado): Sequencia {
  const r = new Roteiro("resultado");
  if (codigo === "DRESS_FIGHTER" || codigo === "FASHION_SPORTS") {
    const disputa = codigo === "DRESS_FIGHTER" ? sequenciaDaLuta(resultado) : sequenciaDaPartida(resultado);
    for (const p of disputa.passos) r.junto(p.ator, p.clip, { repete: p.repete, mover: p.mover, mantem: p.mantem }, p.inicio);
    r.espera(duracaoDaSequencia(disputa));
  } else {
    MONTAGENS[codigo]?.(r, resultado);
  }
  // no meio da disputa (EM_ACAO) ainda não há estrelas: a reação fica para o fim
  if (!saiuDeCena(codigo, resultado) && resultado.status !== "EM_ACAO" && resultado.resultado !== "EM_ACAO") r.depois(AVATAR, codigo === "BATALHA_LOOKS" ? reacaoDaBatalha(resultado) : reacaoDoAvatar(resultado));
  return r.fim();
}

function reacaoDaBatalha(res: NucleoResultado): string {
  const d = desfechoDaBatalha(res);
  return d === "BOM" ? "REACAO_3" : d === "MEDIO" ? "REACAO_1" : "REACAO_0";
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
