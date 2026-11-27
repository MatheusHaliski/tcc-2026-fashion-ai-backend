"use client";
/**
 * O HUD mínimo de console da demonstração (no máximo seis palavras sobre a cena): o objetivo numa linha, a barra de vida
 * no canto de baixo à esquerda, a arma equipada com a munição no canto de baixo à direita (tocar abre a roda), a
 * retícula ao mirar, o prompt do botão só quando vale ("E Coletar", "R Recarregar"), o aviso curto e o flash vermelho
 * na borda ao levar golpe. Com o dedo, os botões E, A, F, X e R e o analógico aparecem na tela.
 */
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import { AnalogicoDeToque } from "@/components/flair/nucleos/analogico-de-toque";
import { IconeConsole, type IconeConsoleNome } from "@/components/flair/nucleos/console/icone-console";
import type { TelaCheia } from "@/components/flair/nucleos/console/use-tela-cheia";
import type { Demo } from "@/components/flair/detetive/demo/use-demo";
import { alvoTravado, usosDe } from "@/lib/flair/detetive/demo/armas";
import { objetivoDa } from "@/lib/flair/detetive/demo/avisos";
import { interativoProximo, promptDe } from "@/lib/flair/detetive/demo/interacao";
import { VIDA_MAXIMA } from "@/lib/flair/detetive/demo/mundo";
import type { ArmaId, EstadoDaDemo } from "@/lib/flair/detetive/demo/tipos";
import type { AcaoConsole } from "@/lib/flair/nucleos/controle/perfil-console";

export const ICONE_DA_ARMA: Record<ArmaId, IconeConsoleNome> = { PISTOLA: "pistola", LEQUE: "tesoura", LAQUE: "spray", KIT: "kit", MAOS: "punho" };

/** "8 / 12" (pente e reserva), "×3" (usos) ou vazio. */
export function textoDeUsos(e: EstadoDaDemo, arma: ArmaId): string {
  const u = usosDe(e, arma);
  if (!u) return "";
  return u.reserva === undefined ? `×${u.agora}` : `${u.agora} / ${u.reserva}`;
}

/** O prompt do botão que vale agora (tecla e a chave do texto), ou nulo. */
function promptAgora(e: EstadoDaDemo, mirando: boolean): { tecla: string; chave: string } | null {
  if (e.fim) return null;
  const perto = interativoProximo(e);
  if (perto) return { tecla: "E", chave: `prompt.${promptDe(e, perto)}` };
  const m = e.jogador.municao;
  if (e.jogador.arma === "PISTOLA" && m.pente === 0 && m.reserva > 0) return { tecla: "R", chave: "prompt.RECARREGAR" };
  if (mirando && (e.jogador.arma === "PISTOLA" || e.jogador.arma === "LAQUE")) return { tecla: "F", chave: "prompt.DISPARAR" };
  return null;
}

const TOQUE: { acao: AcaoConsole; tecla: string }[] = [
  { acao: "INTERAGIR", tecla: "E" },
  { acao: "MIRAR", tecla: "A" },
  { acao: "DISPARAR", tecla: "F" },
  { acao: "RODA", tecla: "X" },
  { acao: "RECARREGAR", tecla: "R" },
];

export function DemoHud({ demo, telaCheia }: { demo: Demo; telaCheia: TelaCheia }) {
  const { t } = useI18n();
  const e = demo.quadro;
  const j = e.jogador;
  const vida = Math.round((j.vida / VIDA_MAXIMA) * 100);
  const prompt = promptAgora(e, demo.mirando);
  const travado = demo.mirando && !!alvoTravado(e);
  const ativo = !demo.parada && !demo.roda.aberta;
  const tocar = (a: AcaoConsole) => (a === "MIRAR" ? demo.alternarMira() : demo.tocar(a));
  return (
    <div className="dmo-hud" data-testid="demo-hud">
      <div className="dmo-topo">
        <Link href="/flair/3d" className="cst-icone-btn" aria-label={t("flair3d.ui.back")} title={t("flair3d.ui.back")}><IconeConsole nome="voltar" /></Link>
        <p className="dmo-objetivo" data-testid="demo-objetivo">{t(`flair3d.demo.objetivo.${objetivoDa(e)}`)}</p>
        <button type="button" className="cst-icone-btn" onClick={() => demo.setAjuda(true)} aria-label={t("flair3d.console.ajuda.titulo")} title={t("flair3d.console.ajuda.titulo")}><IconeConsole nome="ajuda" /></button>
        <button type="button" className="cst-icone-btn" onClick={telaCheia.alternar} aria-label={t(telaCheia.cheia ? "flair3d.console.sairTelaCheia" : "flair3d.console.telaCheia")} title={t("flair3d.console.telaCheia")} data-testid="demo-tela-cheia">
          <IconeConsole nome={telaCheia.cheia ? "sairTela" : "telaCheia"} />
        </button>
      </div>
      <div className="dmo-vida" data-testid="demo-vida">
        <span className="sr-only">{t("flair3d.demo.vida")}</span>
        <span className="dmo-vida-barra" role="meter" aria-label={t("flair3d.demo.vida")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={vida}>
          <span style={{ width: `${vida}%` }} className={vida <= 25 ? "is-baixa" : vida <= 50 ? "is-media" : undefined} />
        </span>
        <b className="tabular">{vida}</b>
      </div>
      <button type="button" className="dmo-arma" onClick={() => demo.tocar("RODA")} aria-label={t(`flair3d.demo.arma.${j.arma}`)} data-testid="demo-arma" data-arma={j.arma}>
        <IconeConsole nome={ICONE_DA_ARMA[j.arma]} tamanho={30} />
        <span className="tabular" data-testid="demo-municao">{j.recarregando > 0 ? "…" : textoDeUsos(e, j.arma)}</span>
      </button>
      {demo.mirando && <div className={`dmo-reticula${travado ? " is-travada" : ""}`} aria-hidden data-testid="demo-reticula"><IconeConsole nome="mira" tamanho={44} /></div>}
      {prompt && (
        <p className="dmo-prompt" data-testid="demo-prompt"><kbd>{prompt.tecla}</kbd>{t(`flair3d.demo.${prompt.chave}`)}</p>
      )}
      {demo.aviso && <p key={demo.aviso.id} className={`cst-aviso is-${demo.aviso.tom}`} role="status" data-testid="demo-aviso">{demo.aviso.texto}</p>}
      {demo.flash > 0 && <div key={demo.flash} className="dmo-flash" aria-hidden data-testid="demo-flash" />}
      <AnalogicoDeToque ativo={ativo} rotulo={t("flair3d.demo.analogico")} />
      <div className="dmo-toque" aria-label={t("flair3d.demo.botoes")}>
        {TOQUE.map((b) => (
          <button key={b.acao} type="button" className={`dmo-toque-btn${b.acao === "MIRAR" && demo.mirando ? " is-ativo" : ""}`} onClick={() => tocar(b.acao)} aria-label={t(`flair3d.console.acao.${b.acao}`)}>{b.tecla}</button>
        ))}
      </div>
    </div>
  );
}
