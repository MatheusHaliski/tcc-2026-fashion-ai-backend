"use client";
/**
 * O HUD mínimo do Fashion Detective no perfil console (no máximo seis palavras sobre a cena): a sala e o objetivo numa
 * linha, a vida e o relógio, o recurso equipado com quantas cartas dele há na mão (tocar abre a roda), a retícula ao
 * mirar e o prompt do botão só quando vale ("E Abrir", "F Convencer"). O texto inteiro dos avisos fica no painel do
 * caso; aqui só o aviso curto. Com o dedo, os botões E, A, F e X aparecem na tela.
 */
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import { AnalogicoDeToque } from "@/components/flair/nucleos/analogico-de-toque";
import { IconeConsole, type IconeConsoleNome } from "@/components/flair/nucleos/console/icone-console";
import type { AvisoCurto } from "@/components/flair/nucleos/console/use-aviso-curto";
import type { TelaCheia } from "@/components/flair/nucleos/console/use-tela-cheia";
import type { DetetiveConsole } from "@/components/flair/detetive/use-detetive-console";
import type { AcaoDeCor } from "@/lib/flair/detetive/acoes";
import { relogio, type Retrato } from "@/lib/flair/detetive/types";
import type { AcaoConsole } from "@/lib/flair/nucleos/controle/perfil-console";

export const ICONE_DO_RECURSO: Record<AcaoDeCor, IconeConsoleNome> = { ABRIR: "chave", FURTIVIDADE: "disfarce", DANO: "distracao", PISTA: "lupa", VIDA: "folego", MOEDA: "moeda" };

/** O objetivo da vez em poucas palavras: juntar pistas, ir à passarela, acusar. */
export function objetivoCurto(r: Retrato): { chave: string; vars?: Record<string, number> } {
  if (r.podeAcusar === false) return { chave: "flair3d.detetive.tela.objetivo.pistas", vars: { n: r.pistas.length, meta: r.pistasParaAcusar ?? 6 } };
  return { chave: r.sala === "PASSARELA" ? "flair3d.detetive.tela.objetivo.acusar" : "flair3d.detetive.tela.objetivo.passarela" };
}

const TOQUE: { acao: AcaoConsole; tecla: string }[] = [
  { acao: "INTERAGIR", tecla: "E" },
  { acao: "MIRAR", tecla: "A" },
  { acao: "DISPARAR", tecla: "F" },
  { acao: "RODA", tecla: "X" },
];

interface Props {
  r: Retrato;
  ctl: DetetiveConsole;
  usos: (acao: AcaoDeCor) => number;
  aviso: AvisoCurto | null;
  telaCheia: TelaCheia;
  andar: boolean;
}

export function DetetiveHud({ r, ctl, usos, aviso, telaCheia, andar }: Props) {
  const { t } = useI18n();
  const obj = objetivoCurto(r);
  const verbo = (a: { verbo: string }) => t(`flair3d.detetive.tela.curto.${a.verbo}`);
  const prompt = ctl.mirando ? ctl.alvo && { tecla: "F", acao: ctl.alvo.acao } : ctl.perto && { tecla: "E", acao: ctl.perto.acao };
  return (
    <div className="dtv-hud2" data-testid="detetive-hud">
      <div className="dtv-hud2-topo">
        <Link href="/flair/3d" className="cst-icone-btn" aria-label={t("flair3d.ui.back")} title={t("flair3d.ui.back")}><IconeConsole nome="voltar" /></Link>
        <div className="dtv-hud2-titulo" data-testid="detetive-objetivo">
          <b>{t(`flair3d.detetive.sala.${r.sala}`)}</b>
          <span>{t(obj.chave, obj.vars)}</span>
        </div>
        <span className="dtv-vida" aria-label={t("flair3d.detetive.ui.vida", { n: r.vida })}>{"●".repeat(r.vida)}<i>{"○".repeat(Math.max(0, (r.vidaMaxima ?? 3) - r.vida))}</i></span>
        <span className="dtv-relogio tabular" aria-label={t("flair3d.detetive.ui.tempo")}>{relogio(r.tempo)}</span>
        {r.escondido && <span className="dtv-hud2-escondido" aria-label={t("flair3d.detetive.ui.escondido")} title={t("flair3d.detetive.ui.escondido")}><IconeConsole nome="escondido" /></span>}
        <button type="button" className="cst-icone-btn" onClick={() => ctl.setAjuda(true)} aria-label={t("flair3d.console.ajuda.titulo")} title={t("flair3d.console.ajuda.titulo")}><IconeConsole nome="ajuda" /></button>
        <button type="button" className="cst-icone-btn" onClick={telaCheia.alternar} aria-label={t(telaCheia.cheia ? "flair3d.console.sairTelaCheia" : "flair3d.console.telaCheia")} title={t("flair3d.console.telaCheia")}>
          <IconeConsole nome={telaCheia.cheia ? "sairTela" : "telaCheia"} />
        </button>
      </div>
      <button type="button" className="dmo-arma dtv-hud2-arma" onClick={() => ctl.tocar("RODA")} aria-label={ctl.equipada ? t(`flair3d.detetive.tela.recurso.${ctl.equipada}`) : t("flair3d.console.roda")} data-testid="detetive-equipada" data-acao={ctl.equipada ?? "NENHUMA"}>
        <IconeConsole nome={ctl.equipada ? ICONE_DO_RECURSO[ctl.equipada] : "roda"} tamanho={30} />
        {ctl.equipada && <span className="tabular">×{usos(ctl.equipada)}</span>}
      </button>
      {ctl.mirando && <div className={`dmo-reticula${ctl.alvo ? " is-travada" : ""}`} aria-hidden data-testid="detetive-reticula"><IconeConsole nome="mira" tamanho={44} /></div>}
      {prompt && (
        <p className="dmo-prompt" data-testid="detetive-prompt"><kbd>{prompt.tecla}</kbd>{prompt.acao.cor && prompt.acao.cor !== "QUALQUER" && <i className={`dtv-cor is-${prompt.acao.cor}`} aria-hidden />}{verbo(prompt.acao)}</p>
      )}
      {aviso && <p key={aviso.id} className={`cst-aviso is-${aviso.tom}`} role="status" data-testid="detetive-aviso">{aviso.texto}</p>}
      <AnalogicoDeToque ativo={andar} rotulo={t("flair3d.demo.analogico")} />
      <div className="dmo-toque" aria-label={t("flair3d.demo.botoes")}>
        {TOQUE.map((b) => (
          <button key={b.acao} type="button" className={`dmo-toque-btn${b.acao === "MIRAR" && ctl.mirando ? " is-ativo" : ""}`} onClick={() => ctl.tocar(b.acao)} aria-label={t(`flair3d.console.acao.${b.acao}`)}>{b.tecla}</button>
        ))}
      </div>
    </div>
  );
}
