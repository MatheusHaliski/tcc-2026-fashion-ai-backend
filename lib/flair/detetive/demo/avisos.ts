/**
 * O que a tela da demonstração diz: o aviso curto de cada evento (a chave do texto, até seis palavras) e o objetivo da
 * vez numa linha. O dano na pessoa não vira texto: vira o flash vermelho na borda e o tremor da câmera. Puro.
 */
import type { EstadoDaDemo, EventoDaDemo } from "@/lib/flair/detetive/demo/tipos";

export interface AvisoDaDemo {
  chave: string;
  tom: "info" | "alerta";
}

export function avisoDoEvento(ev: EventoDaDemo): AvisoDaDemo | null {
  switch (ev.tipo) {
    case "ACERTO":
      return ev.abatido ? { chave: "abatido", tom: "info" } : null;
    case "SECO":
      return { chave: "seco", tom: "alerta" };
    case "RECARGA_FEITA":
      return { chave: "recarregado", tom: "info" };
    case "SEM_RESERVA":
      return { chave: "semReserva", tom: "alerta" };
    case "TRANCADA":
      return { chave: "trancada", tom: "alerta" };
    case "ABRIU":
      return ev.id === "PORTA" ? { chave: "portaAberta", tom: "info" } : null;
    case "PEGOU":
      return ev.item === "DOSSIE" ? null : { chave: `pegou.${ev.item}`, tom: "info" };
    case "CUROU":
      return { chave: "curou", tom: "info" };
    case "VISTO":
      return { chave: "visto", tom: "alerta" };
    default:
      return null;
  }
}

/** O objetivo da vez: achar a chave, abrir a porta do arquivo, pegar o dossiê. */
export function objetivoDa(e: EstadoDaDemo): "CHAVE" | "PORTA" | "DOSSIE" {
  if (!e.jogador.chave) return "CHAVE";
  const porta = e.interativos.find((i) => i.id === "PORTA");
  return porta && porta.tipo === "PORTA" && !porta.aberta ? "PORTA" : "DOSSIE";
}
