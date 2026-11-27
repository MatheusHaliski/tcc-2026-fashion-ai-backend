/**
 * E na demonstração: a coisa mais perto ao alcance da mão (porta, gaveta, armário ou item no chão) e o que acontece ao
 * usá-la. A porta do arquivo só abre com a chave da gaveta; o armário dá alfinetes e laquê; o kit de costura vai para
 * a roda; o carretel vira alfinetes de reserva; o dossiê fecha a demonstração. Puro (mexe no rascunho do passo).
 */
import { efeito } from "@/lib/flair/detetive/demo/armas";
import { distancia } from "@/lib/flair/detetive/demo/colisao";
import { LUGAR, RAIO_DE_USO } from "@/lib/flair/detetive/demo/mundo";
import type { EstadoDaDemo, EventoDaDemo, Interativo } from "@/lib/flair/detetive/demo/tipos";

/** O que o botão E diz para cada coisa (a chave do texto do prompt). */
export type Prompt = "ABRIR" | "DESTRANCAR" | "TRANCADA" | "COLETAR";

export const MUNICAO_DO_ARMARIO = { alfinetes: 12, laque: 2 };
export const ALFINETES_DO_CARRETEL = 12;

function pendente(i: Interativo): boolean {
  return i.tipo === "ITEM" ? !i.coletado : !i.aberta;
}

/** A coisa mais perto que ainda dá para usar, ao alcance da pessoa, ou nula. */
export function interativoProximo(e: EstadoDaDemo): Interativo | null {
  let melhor: { i: Interativo; d: number } | null = null;
  for (const i of e.interativos) {
    const lugar = LUGAR[i.id];
    if (!lugar || !pendente(i)) continue;
    const d = distancia(e.jogador, lugar);
    if (d <= RAIO_DE_USO && (!melhor || d < melhor.d)) melhor = { i, d };
  }
  return melhor?.i ?? null;
}

export function promptDe(e: EstadoDaDemo, i: Interativo): Prompt {
  if (i.tipo === "ITEM") return "COLETAR";
  if (i.tipo === "PORTA") return e.jogador.chave ? "DESTRANCAR" : "TRANCADA";
  return "ABRIR";
}

/** E: usa a coisa mais perto. */
export function interagir(e: EstadoDaDemo, eventos: EventoDaDemo[]): void {
  const i = interativoProximo(e);
  if (!i) return;
  const j = e.jogador;
  const lugar = LUGAR[i.id];
  if (i.tipo === "PORTA") {
    if (!j.chave) return void eventos.push({ tipo: "TRANCADA" });
    i.aberta = true;
    eventos.push({ tipo: "ABRIU", id: i.id });
  } else if (i.tipo === "GAVETA") {
    i.aberta = true;
    j.chave = true;
    eventos.push({ tipo: "ABRIU", id: i.id }, { tipo: "PEGOU", item: "CHAVE" });
  } else if (i.tipo === "ARMARIO") {
    i.aberta = true;
    j.municao.reserva += MUNICAO_DO_ARMARIO.alfinetes;
    j.municao.laque += MUNICAO_DO_ARMARIO.laque;
    eventos.push({ tipo: "ABRIU", id: i.id }, { tipo: "PEGOU", item: "MUNICAO" });
  } else if (i.tipo === "ITEM") {
    i.coletado = true;
    if (i.item === "KIT") j.municao.kits += 1;
    if (i.item === "CARRETEL") j.municao.reserva += ALFINETES_DO_CARRETEL;
    eventos.push({ tipo: "PEGOU", item: i.item });
    if (i.item === "DOSSIE") {
      e.fim = "RESOLVIDO";
      eventos.push({ tipo: "FIM", fim: "RESOLVIDO" });
    }
  }
  efeito(e, "BRILHO", lugar.x, lugar.z);
}
