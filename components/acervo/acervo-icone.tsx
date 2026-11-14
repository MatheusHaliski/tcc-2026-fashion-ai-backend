/** ACERVO — ícones de traço fino (24×24) do diretório, dos cartões e da barra da cena. Sempre decorativos. */
const TRACOS = {
  casa: "M4 11l8-7 8 7M6 10v10h12V10M10 20v-6h4v6",
  cabide: "M12 8a2 2 0 1 0-2-2M12 8v2M12 10l9 6v2H3v-2l9-6",
  armario: "M5 3h14v18H5zM12 3v18M9.5 11v2M14.5 11v2",
  gaveta: "M3 7h18v10H3zM3 12h18M10 9.5h4M10 14.5h4",
  prateleira: "M3 6h18M3 12h18M3 18h18M5 6v12M19 6v12",
  brilho: "M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8L11 3zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z",
  coracao: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  estrela: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.8L12 3.5z",
  local: "M12 21s6-5.7 6-11a6 6 0 1 0-12 0c0 5.3 6 11 6 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  expandir: "M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7",
  grade: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  lista: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  calendario: "M5 5h14v15H5zM5 9h14M9 3v4M15 3v4",
  frente: "M4 4h16v16H4zM12 4v16",
  cubo: "M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12L4 7.5",
  camadas: "M12 4l9 4.5-9 4.5-9-4.5L12 4zM3 12.5l9 4.5 9-4.5M3 16.5L12 21l9-4.5",
  barras: "M5 20V10M12 20V4M19 20v-7",
  roupa: "M8 4l4 2 4-2 5 4-3 3-2-1.5V20H8V9.5L6 11 3 8l5-4z",
  sapato: "M3 16v-5l5 1 3 3 7 1a3 3 0 0 1 3 3H3v-3z",
  bolsa: "M5 9h14l1 11H4L5 9zM9 9V7a3 3 0 0 1 6 0v2",
  outros: "M4 10a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM14 10a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM10 10h4",
  vassoura: "M14 3l-4 9M7 12h7l2 9H5l2-9zM9 16v5M12 16v5",
  lapis: "M4 20l1-4L16 5l3 3L8 19l-4 1zM14 7l3 3",
} as const;

export type AcervoIconeNome = keyof typeof TRACOS;

export function AcervoIcone({ nome, tamanho = 18, cheio }: { nome: AcervoIconeNome; tamanho?: number; cheio?: boolean }) {
  return (
    <svg className="acv-icone" width={tamanho} height={tamanho} viewBox="0 0 24 24" fill={cheio ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      <path d={TRACOS[nome]} />
    </svg>
  );
}
