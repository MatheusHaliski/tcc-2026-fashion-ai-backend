"use client";
/**
 * ACERVO — palco de "Meu espaço": a cena 3D quando o aparelho tem WebGL; sem WebGL (ou se a cena falhar), o esquema 2D
 * com as mesmas interações (escolher compartimento, abrir peça, arrastar e soltar).
 */
import { Component, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useWebGL } from "@/components/three/common";
import { useI18n } from "@/lib/i18n/i18n";
import { pecasDoCompartimento } from "@/lib/acervo/arvore";
import { useAcervo } from "../acervo-contexto";
import { EsquemaMoveis } from "../esquema-moveis";
import { useCorDaPeca, useFantasmas } from "../use-acervo-destaques";
import type { CenaProps } from "./cena-tipos";

const Cena3D = dynamic(() => import("./cena-3d"), { ssr: false, loading: () => null });

class Limite extends Component<{ children: ReactNode; reserva: ReactNode }, { falhou: boolean }> {
  state = { falhou: false };
  static getDerivedStateFromError() {
    return { falhou: true };
  }
  render() {
    return this.state.falhou ? this.props.reserva : this.props.children;
  }
}

export function Cena2D(props: CenaProps) {
  const { t } = useI18n();
  const { dados, tela } = useAcervo();
  const corDe = useCorDaPeca();
  const fantasmasDe = useFantasmas();
  const arvore = dados.arvore;
  if (!arvore) return null;
  return (
    <div className="acv-cena2d" data-testid="acervo-cena-2d">
      <p className="acv-dica">{t("acervo.espaco.cena2d")}</p>
      <EsquemaMoveis moveis={props.moveis} detalhado selecionado={props.selecionado} acesos={props.acesos} parados={props.parados}
        marcadores={props.marcadores} raioX={props.raioX} gavetasAbertas={props.gavetasAbertas} corDe={corDe} fantasmasDe={fantasmasDe}
        pecasDe={(id) => pecasDoCompartimento(arvore, id)} onEscolher={props.onEscolher} onSoltar={props.onSoltar}
        onPeca={(peca) => tela.abrirPeca(peca.id)} />
    </div>
  );
}

export function Cena(props: CenaProps) {
  const { t } = useI18n();
  const webgl = useWebGL();
  const reserva = <Cena2D {...props} />;
  if (webgl === false) return reserva;
  if (webgl === null) return <div className="acv-cena2d" role="status">{t("common.loading")}</div>;
  return <Limite reserva={reserva}><Cena3D {...props} /></Limite>;
}
