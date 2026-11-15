"use client";
/**
 * As folhas do caso, por cima da cena sem cobrir o avatar no celular (sobem do pé da tela): o caderno ("Pistas N de 12",
 * cada papel com o texto inteiro ou a meia folha rasgada), o mapa das nove salas (onde a pessoa está, as visitadas, as
 * resolvidas e as portas que pedem chave) e o inventário (chaves e cartas no baralho).
 */
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { PISTAS, SALAS, type Retrato } from "@/lib/flair/detetive/types";

export type Folha = "CADERNO" | "MAPA" | "INVENTARIO";

/** Onde cada sala fica no desenho do mapa (coluna, linha), como em FASHION_DETECTIVE_HISTORIA.md, seção 3. */
const NO_MAPA: Record<string, [number, number]> = {
  PASSARELA: [2, 0], CLUBE: [0, 1], ATELIE: [2, 1], ARQUIVO: [3, 1],
  ENTRADA: [0, 2], SALAO: [1, 2], CAMARIM: [2, 2], SEGURANCA: [0, 3], ESCRITORIO: [1, 3],
};

/** Meia folha: a primeira metade das palavras e a marca de rasgo. */
export function meiaFolha(texto: string): string {
  const palavras = texto.split(" ");
  return `${palavras.slice(0, Math.ceil(palavras.length / 2)).join(" ")} …`;
}

function Caderno({ r }: { r: Retrato }) {
  const tx = useNucleoText();
  const achadas = new Map(r.pistas.map((p) => [p.id, p.completa]));
  return (
    <ol className="dtv-caderno">
      {PISTAS.map((id) => {
        const completa = achadas.get(id);
        const texto = tx.t(`flair3d.detetive.pista.${id}.texto`);
        return (
          <li key={id} className={completa === undefined ? "is-faltando" : undefined} data-pista={id}>
            <strong>{id} · {completa === undefined ? tx.t("flair3d.detetive.ui.naoAchada") : tx.t(`flair3d.detetive.pista.${id}.titulo`)}</strong>
            {completa !== undefined && <p>{completa ? texto : meiaFolha(texto)}</p>}
            {completa === false && <em>{tx.t("flair3d.detetive.ui.rasgada")}</em>}
          </li>
        );
      })}
    </ol>
  );
}

function Mapa({ r }: { r: Retrato }) {
  const tx = useNucleoText();
  const c = (s: string) => [NO_MAPA[s][0] * 90 + 45, NO_MAPA[s][1] * 70 + 35] as const;
  return (
    <svg className="dtv-mapa" viewBox="0 0 360 280" role="img" aria-label={tx.t("flair3d.detetive.ui.mapa")}>
      {r.mapa.map((p) => {
        const [x1, y1] = c(p.de);
        const [x2, y2] = c(p.para);
        const aberta = !p.chave || r.portasAbertas.includes([p.de, p.para].sort().join("-"));
        return <line key={`${p.de}-${p.para}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={aberta ? "#8FD19E" : "#E5484D"} strokeWidth={3} strokeDasharray={aberta ? undefined : "6 4"} />;
      })}
      {SALAS.map((s) => {
        const [x, y] = c(s);
        const visitada = r.visitadas.includes(s);
        return (
          <g key={s} data-sala={s}>
            <rect x={x - 40} y={y - 22} width={80} height={44} rx={8} fill={s === r.sala ? "#F2C230" : visitada ? "#2C3440" : "#15181E"} stroke={r.resolvidas.includes(s) ? "#8FD19E" : "#fff6"} strokeWidth={2} />
            <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fill={s === r.sala ? "#111" : "#F4F2EE"}>{visitada ? tx.t(`flair3d.detetive.sala.${s}`) : "?"}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Inventario({ r }: { r: Retrato }) {
  const tx = useNucleoText();
  return (
    <div className="dtv-inventario">
      <h4>{tx.t("flair3d.detetive.ui.chaves")}</h4>
      <ul>{r.chaves.length === 0 ? <li>{tx.t("flair3d.detetive.ui.nenhuma")}</li> : r.chaves.map((k) => <li key={k}>{tx.t(`flair3d.detetive.chave.${k}`)}</li>)}</ul>
      <p>{tx.t("flair3d.detetive.ui.baralho", { n: r.baralho })}</p>
    </div>
  );
}

export function DetetiveFolha({ folha, r, onFechar }: { folha: Folha; r: Retrato; onFechar: () => void }) {
  const tx = useNucleoText();
  const achadas = r.pistas.length;
  const titulo = folha === "CADERNO" ? tx.t("flair3d.detetive.ui.pistas", { n: achadas, total: r.totalDePistas }) : tx.t(`flair3d.detetive.ui.${folha === "MAPA" ? "mapa" : "inventario"}`);
  return (
    <section className="dtv-folha" role="dialog" aria-label={titulo} data-testid={`detetive-${folha.toLowerCase()}`}>
      <header>
        <h3>{titulo}</h3>
        <button type="button" className="btn btn-sm" onClick={onFechar}>{tx.t("flair3d.detetive.ui.fechar")}</button>
      </header>
      {folha === "CADERNO" ? <Caderno r={r} /> : folha === "MAPA" ? <Mapa r={r} /> : <Inventario r={r} />}
    </section>
  );
}
