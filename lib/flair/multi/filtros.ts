/** Regras puras do multiplayer na tela: a consulta da busca, o lado de cada pessoa na sala e para onde cada sala leva. */
import { rotaDoBrief } from "@/lib/flair/make-up/briefs";
import { isNucleoCodigo, rotaDoNucleo } from "@/lib/flair/nucleos/registry";
import { NUCLEO_CODIGOS } from "@/lib/flair/nucleos/types";
import type { FiltrosAdversario, Lado, ModoSala, PessoaDaSala, Sala } from "@/lib/flair/multi/types";

export const MAKE_UP = "MAKE_UP";
export const RELACOES = ["TODOS", "MUTUOS", "SIGO", "ME_SEGUE"] as const;
export const ESTILOS = ["ROMANTIC", "DRAMATIC", "CLASSIC", "NATURAL", "GAMINE"] as const;
export const NIVEIS = ["ROOKIE", "TRENDSETTER", "STYLE_MAVEN", "FASHION_ARCHITECT", "ICONIC", "LEGEND"] as const;
/** Os jogos que abrem sala: os 15 núcleos e o MAKE UP. */
export const JOGOS_DA_SALA: string[] = [...NUCLEO_CODIGOS, MAKE_UP];
/** Os jogos de confronto com sala por turnos (o servidor julga cada turno: Flair3dDuelo). */
export const JOGOS_POR_TURNOS = ["BATALHA_LOOKS", "DRESS_FIGHTER", "FASHION_SPORTS"];
/** Intervalo do polling da sala (o servidor é a fonte da vez e do julgamento). */
export const POLLING_MS = 2000;

/** A query string da busca: só os filtros preenchidos, em ordem estável (o termo sem "@"). */
export function consultaDosFiltros(f: FiltrosAdversario): string {
  const p = new URLSearchParams();
  const q = f.q?.trim().replace(/^@/, "");
  if (q) p.set("q", q);
  if (f.relacao && f.relacao !== "TODOS") p.set("relacao", f.relacao);
  if (f.nivel) p.set("nivel", f.nivel);
  if (f.estilo) p.set("estilo", f.estilo);
  if (f.pais?.trim()) p.set("pais", f.pais.trim().toUpperCase());
  if (f.cidade?.trim()) p.set("cidade", f.cidade.trim());
  if (f.ativo) p.set("ativo", "true");
  if (f.jogo) p.set("jogo", f.jogo);
  if (f.jogo && f.comDeck) p.set("comDeck", "true");
  return p.toString();
}

/** Os modos de sala do jogo, na ordem em que a tela oferece (o mesmo do servidor: Flair3dSalaJogos.modos). */
export function modosDoJogo(jogo: string): ModoSala[] {
  return JOGOS_POR_TURNOS.includes(jogo) ? ["TURNOS", "ASSINCRONO"] : ["ASSINCRONO"];
}

/** Quantos filtros além do termo estão ligados (o contador do botão "Filtros"). */
export function filtrosAtivos(f: FiltrosAdversario): number {
  return [f.relacao && f.relacao !== "TODOS", f.nivel, f.estilo, f.pais?.trim(), f.cidade?.trim(), f.ativo, f.jogo && f.comDeck].filter(Boolean).length;
}

export function outroLado(lado: Lado): Lado {
  return lado === "DE" ? "PARA" : "DE";
}

/** A outra pessoa da sala, para quem lê. */
export function outraPessoa(sala: Sala): PessoaDaSala {
  return sala.voce === "DE" ? sala.para : sala.de;
}

/** Venci, perdi ou empatei (nulo enquanto a sala não fechou). */
export function desfecho(sala: Sala): "VITORIA" | "DERROTA" | "EMPATE" | null {
  if (sala.estado !== "FECHADO" || !sala.vencedor) return null;
  if (sala.vencedor === "EMPATE") return "EMPATE";
  return sala.vencedor === sala.voce ? "VITORIA" : "DERROTA";
}

export function rotaDaSala(id: string): string {
  return `/flair/3d/sala/${id}`;
}

/** A tela do jogo para a partida da sala com a mesma semente (o jogo lê ?sala= e abre pela sala). */
export function rotaDoJogoNaSala(sala: Pick<Sala, "id" | "jogo" | "rodada">): string {
  if (sala.jogo === MAKE_UP) return `${rotaDoBrief(sala.rodada ?? "")}?sala=${sala.id}`;
  return isNucleoCodigo(sala.jogo) ? `${rotaDoNucleo(sala.jogo)}?sala=${sala.id}` : rotaDaSala(sala.id);
}

/** A pessoa precisa agir nesta sala? (convite recebido, vez de lançar ou partida por jogar) */
export function precisaAgir(sala: Sala): boolean {
  if (sala.estado === "CONVIDADO") return sala.voce === "PARA";
  if (sala.estado !== "JOGANDO") return false;
  if (sala.turnos) return !sala.turnos.esperando && !sala.turnos.encerrado;
  return !sala.assincrono?.eu?.terminou;
}
