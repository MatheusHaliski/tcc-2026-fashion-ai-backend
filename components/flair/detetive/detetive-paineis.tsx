"use client";
/**
 * O que vai nos painéis laterais do Fashion Detective (tudo o que antes ficava empilhado sobre a cena, só
 * reorganizado): à esquerda o caso (sala, objetivo, vida, relógio, o que o look muda, o último aviso por inteiro, a
 * câmera e rever a cena), o mapa e o caderno de pistas; à direita as ações (enigma, acusação, ações do ponto e a mão de
 * cartas, detetive-painel.tsx) e o inventário (chaves, baralho, as cartas por cor e a roda de recursos da partida).
 */
import type { ReactNode } from "react";
import { NucleoCameraSelector } from "@/components/flair/nucleos/nucleo-camera-selector";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { IconeConsole } from "@/components/flair/nucleos/console/icone-console";
import type { AbaDoPainel } from "@/components/flair/nucleos/console/painel-lateral";
import { Caderno, Inventario, Mapa } from "@/components/flair/detetive/detetive-folhas";
import { ICONE_DO_RECURSO, objetivoCurto } from "@/components/flair/detetive/detetive-hud";
import { arsenalDaMao, type CartaComAcao } from "@/lib/flair/detetive/console";
import { relogio, type Retrato } from "@/lib/flair/detetive/types";

/** O texto inteiro do aviso do último passo ("VISTO:SEG_SALAO" → "Um segurança viu você..."). */
export function useAviso(r: Retrato): { codigo: string; texto: string } | null {
  const tx = useNucleoText();
  const a = r.avisos[r.avisos.length - 1];
  if (!a) return null;
  const [codigo, assunto = ""] = a.split(":");
  const nome = assunto.startsWith("P") && assunto.length <= 3 ? assunto : tx.ou(`flair3d.detetive.chave.${assunto}`, tx.ou(`flair3d.detetive.compra.${assunto}`, assunto));
  return { codigo, texto: tx.ou(`flair3d.detetive.aviso.${codigo}`, codigo, { assunto: nome }) };
}

interface CasoProps {
  r: Retrato;
  camera: { opcoes: string[]; atual: string; onTrocar: (id: string) => void } | null;
  onRever: (() => void) | null;
}

function Caso({ r, camera, onRever }: CasoProps) {
  const tx = useNucleoText();
  const aviso = useAviso(r);
  const obj = objetivoCurto(r);
  return (
    <div className="dtv-caso" data-testid="detetive-caso">
      <h3>{tx.t(`flair3d.detetive.sala.${r.sala}`)}</h3>
      <p>{tx.t(obj.chave, obj.vars)}</p>
      <dl>
        <div><dt>{tx.t("flair3d.detetive.tela.vida")}</dt><dd>{tx.t("flair3d.detetive.ui.vida", { n: r.vida })}</dd></div>
        <div><dt>{tx.t("flair3d.detetive.ui.tempo")}</dt><dd className="tabular">{relogio(r.tempo)}</dd></div>
        <div><dt>{tx.t("flair3d.detetive.tela.aba.pistas")}</dt><dd>{tx.t("flair3d.detetive.ui.pistas", { n: r.pistas.length, total: r.totalDePistas })}</dd></div>
      </dl>
      {r.escondido && <p className="dtv-escondido">{tx.t("flair3d.detetive.ui.escondido")}</p>}
      {r.doLook && <p className="dtv-look" data-testid="detetive-look">{tx.t("flair3d.detetive.ui.doLook", { vida: r.doLook.vidaMaxima, cone: r.doLook.alcance, passo: r.doLook.segundosPorPasso })}</p>}
      {aviso && <p className="dtv-caso-aviso" data-testid="detetive-aviso-inteiro">{aviso.texto}</p>}
      <div className="dtv-caso-botoes">
        {onRever && <button type="button" className="btn btn-sm" onClick={onRever}>{tx.t("flair3d.detetive.ui.reverCena")}</button>}
        {camera && <NucleoCameraSelector opcoes={camera.opcoes} atual={camera.atual} onTrocar={camera.onTrocar} />}
      </div>
    </div>
  );
}

function Arsenal({ mao }: { mao: CartaComAcao[] }) {
  const tx = useNucleoText();
  return (
    <ul className="dtv-arsenal" aria-label={tx.t("flair3d.console.roda")}>
      {arsenalDaMao(mao).map((a) => (
        <li key={a.acao} className={a.cartas.length ? undefined : "is-vazio"}>
          <IconeConsole nome={ICONE_DO_RECURSO[a.acao]} /> {tx.t(`flair3d.detetive.tela.recurso.${a.acao}`)} <b className="tabular">×{a.cartas.length}</b>
        </li>
      ))}
    </ul>
  );
}

export function abasDoCaso(props: CasoProps, t: (k: string) => string): AbaDoPainel[] {
  return [
    { id: "caso", nome: t("flair3d.detetive.tela.aba.caso"), conteudo: <Caso {...props} /> },
    { id: "mapa", nome: t("flair3d.detetive.ui.mapa"), conteudo: <Mapa r={props.r} /> },
    { id: "pistas", nome: t("flair3d.detetive.tela.aba.pistas"), conteudo: <Caderno r={props.r} /> },
  ];
}

export function abasDaMochila(r: Retrato, mao: CartaComAcao[], acoes: ReactNode, extra: ReactNode, t: (k: string) => string): AbaDoPainel[] {
  return [
    { id: "acoes", nome: t("flair3d.detetive.tela.aba.acoes"), conteudo: acoes },
    {
      id: "inventario",
      nome: t("flair3d.detetive.ui.inventario"),
      conteudo: (
        <>
          <Inventario r={r} />
          <Arsenal mao={mao} />
          <div className="dtv-recursos">{extra}</div>
        </>
      ),
    },
  ];
}
