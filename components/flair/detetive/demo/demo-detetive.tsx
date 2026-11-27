"use client";
/**
 * A demonstração jogável do Fashion Detective (/flair/3d/detective/demo): a cena 3D ocupa a tela toda abaixo do
 * cabeçalho (T ou o botão: tela cheia de verdade), com o HUD mínimo, a roda de recursos e armas (segurar X; P ou soltar
 * X equipa), a ajuda dos controles (?), a pausa (Esc) e o fim ("Você foi pega" ou o dossiê recuperado), com reiniciar.
 * Tudo no navegador (lib/flair/detetive/demo): não grava nada no servidor.
 */
import { useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import { useReducedMotion, useWebGL } from "@/components/three/common";
import { AjudaDeControles } from "@/components/flair/nucleos/console/ajuda-de-controles";
import { IconeConsole } from "@/components/flair/nucleos/console/icone-console";
import { RodaRadial } from "@/components/flair/nucleos/console/roda-radial";
import { useTelaCheia } from "@/components/flair/nucleos/console/use-tela-cheia";
import { DemoHud, ICONE_DA_ARMA, textoDeUsos } from "@/components/flair/detetive/demo/demo-hud";
import { useDemo, type Demo } from "@/components/flair/detetive/demo/use-demo";
import { ORDEM_DA_RODA, usosDe } from "@/lib/flair/detetive/demo/armas";

const Cena3D = dynamic(() => import("@/components/flair/detetive/demo/demo-cena-3d"), { ssr: false, loading: () => null });

/** As teclas que valem na demonstração (o cartão ? não mostra os painéis, que ela não tem). */
const AJUDA_DA_DEMO = ["MOVER", "CORRER", "INTERAGIR", "MIRAR", "DISPARAR", "RODA", "PEGAR", "RECARREGAR", "TELA_CHEIA", "PAUSA", "AJUDA"];

function Roda({ demo, reduzido }: { demo: Demo; reduzido: boolean }) {
  const { t } = useI18n();
  const e = demo.quadro;
  const itens = ORDEM_DA_RODA.map((id) => {
    const u = usosDe(e, id);
    return { id, nome: t(`flair3d.demo.arma.${id}`), icone: <IconeConsole nome={ICONE_DA_ARMA[id]} tamanho={40} />, usos: textoDeUsos(e, id), habilitado: !u || u.agora + (u.reserva ?? 0) > 0, equipado: e.jogador.arma === id };
  });
  return <RodaRadial itens={itens} foco={demo.roda.foco} onFoco={(foco) => demo.setRoda((r) => ({ ...r, foco }))} onEscolher={demo.escolher} rotulo={t("flair3d.console.roda")} reduzido={reduzido} />;
}

function Fim({ demo }: { demo: Demo }) {
  const { t } = useI18n();
  const fim = demo.quadro.fim;
  if (!fim) return null;
  return (
    <section className={`dmo-fim is-${fim.toLowerCase()}`} role="dialog" aria-label={t(`flair3d.demo.fim.${fim}`)} data-testid="demo-fim">
      <h2>{t(`flair3d.demo.fim.${fim}`)}</h2>
      <button type="button" className="btn btn-primary" onClick={demo.reiniciar} autoFocus>{t("flair3d.demo.reiniciar")}</button>
    </section>
  );
}

function Pausa({ demo }: { demo: Demo }) {
  const { t } = useI18n();
  return (
    <section className="dmo-pausa" role="dialog" aria-label={t("flair3d.demo.pausa")} data-testid="demo-pausa">
      <h2>{t("flair3d.demo.pausa")}</h2>
      <button type="button" className="btn btn-primary" onClick={() => demo.setPausa(false)} autoFocus>{t("flair3d.demo.continuar")}</button>
      <button type="button" className="btn" onClick={() => demo.setAjuda(true)}>{t("flair3d.console.ajuda.titulo")}</button>
      <button type="button" className="btn" onClick={demo.reiniciar}>{t("flair3d.demo.reiniciar")}</button>
      <Link href="/flair/3d" className="btn">{t("flair3d.ui.back")}</Link>
      <p className="dmo-pausa-nota">{t("flair3d.demo.nota")}</p>
    </section>
  );
}

export function DemoDetetive() {
  const { t } = useI18n();
  const webgl = useWebGL();
  const reduzido = useReducedMotion();
  const raiz = useRef<HTMLDivElement>(null);
  const telaCheia = useTelaCheia(raiz);
  const demo = useDemo(telaCheia);
  const classes = ["cst-palco", "dmo-tela", telaCheia.cheia && !telaCheia.nativa ? "is-imersivo" : "", demo.roda.aberta ? "is-lenta" : "", demo.parada ? "is-parada" : ""].filter(Boolean).join(" ");
  return (
    <div ref={raiz} className={classes} data-testid="demo-detetive" data-fim={demo.quadro.fim ?? undefined} data-mirando={demo.mirando || undefined}>
      <h1 className="sr-only">{t("flair3d.demo.titulo")}</h1>
      <div className="cst-cena">
        {webgl === false ? <p className="dmo-sem-webgl" role="status">{t("flair3d.demo.semWebgl")}</p> : webgl === null ? null : (
          <Cena3D sim={demo.sim} onQuadro={demo.setQuadro} onEventos={demo.onEventos} mirando={demo.mirando} reduzido={reduzido} rotulo={t("flair3d.demo.titulo")} />
        )}
      </div>
      <DemoHud demo={demo} telaCheia={telaCheia} />
      {demo.roda.aberta && <Roda demo={demo} reduzido={reduzido} />}
      {demo.pausa && !demo.ajuda && !demo.quadro.fim && <Pausa demo={demo} />}
      {demo.ajuda && <AjudaDeControles acoes={AJUDA_DA_DEMO} onFechar={() => demo.setAjuda(false)} />}
      <Fim demo={demo} />
    </div>
  );
}
