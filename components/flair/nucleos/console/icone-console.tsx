/**
 * Ícones do palco de jogo no perfil console: os botões dos cantos (painéis, tela cheia, ajuda), a mira e os itens da
 * roda de recursos e armas (chave, disfarce, fôlego, distração, lupa, moeda). Traço simples, 24 × 24.
 */
export type IconeConsoleNome =
  | "painel"
  | "mochila"
  | "telaCheia"
  | "sairTela"
  | "ajuda"
  | "mira"
  | "roda"
  | "chave"
  | "disfarce"
  | "folego"
  | "distracao"
  | "lupa"
  | "moeda"
  | "escondido"
  | "pistola"
  | "tesoura"
  | "spray"
  | "kit"
  | "punho"
  | "voltar";

const PATHS: Record<IconeConsoleNome, string> = {
  painel: "M4 6h16M4 12h16M4 18h10",
  mochila: "M8 7V5a4 4 0 018 0v2M5 9a2 2 0 012-2h10a2 2 0 012 2v10a1 1 0 01-1 1H6a1 1 0 01-1-1zM9 13h6",
  telaCheia: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  sairTela: "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5",
  ajuda: "M12 3a9 9 0 100 18 9 9 0 000-18zM9.5 9.5a2.5 2.5 0 114 2c-1 .7-1.5 1.2-1.5 2.5M12 17h.01",
  mira: "M12 3v5M12 16v5M3 12h5M16 12h5M12 9a3 3 0 100 6 3 3 0 000-6z",
  roda: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 3v6M12 15v6M3 12h6M15 12h6",
  chave: "M8 14a4 4 0 110-8 4 4 0 010 8zM11 11l9 9M17 17l2-2M15 15l2-2",
  disfarce: "M3 9c3-2 15-2 18 0l-1 4c-1 3-5 3-6 0h-4c-1 3-5 3-6 0zM7 11h2M15 11h2",
  folego: "M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z",
  distracao: "M4 10v4h3l7 4V6l-7 4zM17 9a4 4 0 010 6M19.5 7a7 7 0 010 10",
  lupa: "M10 4a6 6 0 100 12 6 6 0 000-12zM20 20l-5.6-5.6",
  moeda: "M12 3a9 9 0 100 18 9 9 0 000-18zM14.5 9c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6v1.5M12 16.5V18",
  pistola: "M3 8h14l2 2h2v3h-6l-1 2h-3l-1 4H6l1-5H3zM9 8V6h3v2",
  tesoura: "M6 4a3 3 0 100 6 3 3 0 000-6zM6 14a3 3 0 100 6 3 3 0 000-6zM8.5 8.5L20 19M8.5 15.5L20 5",
  spray: "M8 9h6v11a1 1 0 01-1 1H9a1 1 0 01-1-1zM9 9V6h4v3M13 6h2M17 5l2-1M17 7h3M17 9l2 1",
  kit: "M4 8h16v11H4zM9 8V6a1 1 0 011-1h4a1 1 0 011 1v2M12 11v5M9.5 13.5h5",
  punho: "M7 11V7a1.5 1.5 0 013 0v3M10 10V6a1.5 1.5 0 013 0v4M13 10V7a1.5 1.5 0 013 0v4M16 11V9a1.5 1.5 0 013 0v4a7 7 0 01-7 7h-1a5 5 0 01-5-5v-2a2 2 0 014 0",
  voltar: "M15 5l-7 7 7 7",
  escondido: "M3 3l18 18M10.6 6.1A9.7 9.7 0 0112 6c5 0 9 6 9 6a15 15 0 01-3 3.4M6.6 6.6C4.3 8.1 3 12 3 12s4 6 9 6a8.6 8.6 0 004.4-1.2",
};

export function IconeConsole({ nome, tamanho = 20 }: { nome: IconeConsoleNome; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      <path d={PATHS[nome]} />
    </svg>
  );
}
