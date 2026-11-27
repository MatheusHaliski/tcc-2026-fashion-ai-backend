/**
 * Recorte do quadro dinâmico em n peças (uma por vaga do desafio), puro. Reaproveita os cortes dos elencos
 * (lib/flair/elencos/recortes.ts): grade, jigsaw, setores e cacos. Como n vem do desafio, a grade escolhe a fatoração
 * de n cujas células ficam mais perto de quadradas; quando nenhuma serve (n primo, por exemplo), as fileiras ficam com
 * números diferentes de peças e cobrem o quadro do mesmo jeito. Os cacos nascem de raios gerados a partir do centro.
 */
import { n2 } from "@/lib/flair/elencos/jigsaw";
import { cacos, grade, jigsaw, setores, type Peca, type Ponto } from "@/lib/flair/elencos/recortes";
import type { FormaDinamica } from "@/lib/flair/montagem/dinamico/catalogo";

const ALTURA = 100;
/** proporção máxima (lado maior / menor) de uma célula para a grade exata valer */
const CELULA_MAX = 2.2;

/** Colunas × fileiras com produto n e células mais quadradas; null se a melhor ainda fica comprida demais. */
export function fatorar(n: number, largura: number): { colunas: number; fileiras: number } | null {
  let melhor: { colunas: number; fileiras: number; desvio: number } | null = null;
  for (let fileiras = 1; fileiras <= n; fileiras++) {
    if (n % fileiras) continue;
    const colunas = n / fileiras;
    const desvio = Math.abs(Math.log(largura / colunas / (ALTURA / fileiras)));
    if (!melhor || desvio < melhor.desvio) melhor = { colunas, fileiras, desvio };
  }
  if (!melhor || Math.exp(melhor.desvio) > CELULA_MAX) return null;
  return { colunas: melhor.colunas, fileiras: melhor.fileiras };
}

/** Quantas peças vão em cada fileira quando n não fatora bem: as primeiras fileiras levam uma a mais. */
export function fileirasIrregulares(n: number, largura: number): number[] {
  const fileiras = Math.max(1, Math.min(n, Math.round(Math.sqrt((n * ALTURA) / largura))));
  const base = Math.floor(n / fileiras);
  return Array.from({ length: fileiras }, (_, r) => base + (r < n % fileiras ? 1 : 0));
}

/** Grade com fileiras de tamanhos diferentes (retângulos), em ordem de leitura; cobre o quadro inteiro. */
export function gradeIrregular(n: number, largura: number): Peca[] {
  const linhas = fileirasIrregulares(n, largura);
  const h = ALTURA / linhas.length;
  return linhas.flatMap((k, r) => {
    const w = largura / k;
    const [y0, y1] = [r * h, (r + 1) * h];
    return Array.from({ length: k }, (_, c) => {
      const [x0, x1] = [c * w, (c + 1) * w];
      return { d: `M${n2(x0)} ${n2(y0)}H${n2(x1)}V${n2(y1)}H${n2(x0)}Z`, cx: n2(x0 + w / 2), cy: n2(y0 + h / 2) };
    });
  });
}

/** Onde o raio que sai de c no ângulo a encontra a borda do quadro. */
export function naBorda(c: Ponto, a: number, largura: number): Ponto {
  const [dx, dy] = [Math.cos(a), Math.sin(a)];
  const ts = [dx > 1e-9 ? (largura - c[0]) / dx : Infinity, dx < -1e-9 ? -c[0] / dx : Infinity, dy > 1e-9 ? (ALTURA - c[1]) / dy : Infinity, dy < -1e-9 ? -c[1] / dy : Infinity];
  const t = Math.min(...ts);
  return [n2(c[0] + dx * t), n2(c[1] + dy * t)];
}

/** n rachaduras a partir do centro, no sentido horário a partir do alto, com um leve tremor fixo por raio. */
export function rachaduras(n: number, largura: number): { impacto: Ponto; raios: Ponto[][] } {
  const impacto: Ponto = [n2(largura / 2 + 2), 48];
  const passo = (2 * Math.PI) / n;
  const raios = Array.from({ length: n }, (_, k) => {
    const a = -Math.PI / 2 + k * passo + (((k * 37) % 7) - 3) * passo * 0.04;
    const torto = (r: number, s: number): Ponto => {
      const b = a + s * passo * 0.12;
      return [n2(impacto[0] + r * Math.cos(b)), n2(impacto[1] + r * Math.sin(b))];
    };
    return [torto(14, k % 2 ? 1 : -1), torto(30, k % 2 ? -1 : 1), naBorda(impacto, a, largura)];
  });
  return { impacto, raios };
}

/** As n peças do quadro na forma pedida (setores e cacos centrados; grade e jigsaw cobrindo tudo). */
export function pecasDinamicas(forma: FormaDinamica, n: number, largura: number): Peca[] {
  if (n <= 0) return [];
  if (forma === "setores") return setores(n, largura / 2, 50, 50);
  if (forma === "cacos") {
    if (n < 3) return gradeIrregular(n, largura);
    const { impacto, raios } = rachaduras(n, largura);
    return cacos(impacto, raios, largura);
  }
  const f = fatorar(n, largura);
  if (!f) return gradeIrregular(n, largura);
  return forma === "jigsaw" ? jigsaw(f.colunas, f.fileiras, largura) : grade(f.colunas, f.fileiras, largura);
}
