/**
 * Variante de uma cena: a mesma coreografia com outra luz. Gira o matiz de todas as cores (fundo, túneis, pulsos,
 * elenco, enfeites) e, se pedido, espelha a cena na horizontal (trilhos, enfeites e giros; o elenco continua de pé
 * e legível, só anda para o outro lado). Assim nenhum elenco ou cenário repete o desenho de outro, sem uma cena nova
 * para cada uso.
 */
import { ARTE_L } from "@/lib/flair/cenas/enfeites";
import { rgb } from "@/lib/flair/cenas/formas";
import type { Cena, Enfeite, Trilho } from "@/lib/flair/cenas/tipos";

export interface Variacao {
  /** nome do uso (elenco ou cenário); vai em Cena.variante */
  nome: string;
  /** giro do matiz em graus */
  matiz?: number;
  espelho?: boolean;
}

/** Cor com o matiz girado `graus` (saturação e luminosidade iguais). */
export function girarMatiz(hex: string, graus: number): string {
  if (!graus) return hex;
  const [r, g, b] = rgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return hex;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (((h * 60 + graus) % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const setor = Math.floor(h / 60);
  const [r1, g1, b1] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][setor];
  const canal = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${canal(r1)}${canal(g1)}${canal(b1)}`;
}

/** Espelha na horizontal um caminho de comandos absolutos M, L, H, V, C, Q, Z. */
export function espelharCaminho(d: string): string {
  const partes = d.match(/[MLHVCQZ][^MLHVCQZ]*/gi) ?? [];
  return partes
    .map((parte) => {
      const cmd = parte[0];
      const nums = (parte.slice(1).match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
      const espelhados = nums.map((n, i) => {
        const ehX = cmd.toUpperCase() === "H" || (cmd.toUpperCase() !== "V" && i % 2 === 0);
        return ehX ? Math.round((ARTE_L - n) * 1000) / 1000 : n;
      });
      return cmd + espelhados.join(" ");
    })
    .join("");
}

/** Cena variada; a original não muda. O id fica o mesmo (nome e descrição da cena continuam valendo). */
export function variar(cena: Cena, v: Variacao): Cena {
  const cor = (c: string) => girarMatiz(c, v.matiz ?? 0);
  const x = (n: number) => (v.espelho ? ARTE_L - n : n);
  const caminho = (d: string) => (v.espelho ? espelharCaminho(d) : d);

  const enfeite = (e: Enfeite): Enfeite => {
    if (e.k === "halo" || e.k === "aneis") return { ...e, x: x(e.x), cor: cor(e.cor) };
    if (e.k === "traco") return { ...e, d: caminho(e.d), cor: cor(e.cor) };
    if (e.k === "forma") return { ...e, x: x(e.x), giro: v.espelho && e.giro ? -e.giro : e.giro, cor: cor(e.cor) };
    return { ...e, cor: cor(e.cor) };
  };

  const trilho = (t: Trilho): Trilho => ({
    ...t,
    d: caminho(t.d),
    tubo: t.tubo && { ...t.tubo, cor: cor(t.tubo.cor) },
    fio: t.fio && { ...t.fio, cor: cor(t.fio.cor) },
    mangas: t.mangas?.map((m) => ({ ...m, cor: cor(m.cor) })),
    pulsos: t.pulsos && { ...t.pulsos, cor: cor(t.pulsos.cor) },
  });

  return {
    ...cena,
    variante: v.nome,
    paleta: { fundo: [cor(cena.paleta.fundo[0]), cor(cena.paleta.fundo[1])], luz: cor(cena.paleta.luz), acentos: cena.paleta.acentos.map(cor) },
    fundo: cena.fundo.map(enfeite),
    frente: cena.frente?.map(enfeite),
    trilhos: cena.trilhos.map(trilho),
    elenco: cena.elenco.map((g) => ({ ...g, cores: g.cores.map(cor) })),
    giros: cena.giros?.map((g) => ({ ...g, x: x(g.x), cor: cor(g.cor), sentido: v.espelho ? (g.sentido === -1 ? 1 : -1) : g.sentido })),
  };
}
