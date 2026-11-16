"use client";
/**
 * ACERVO — view 2, "Meu espaço": os móveis em perspectiva dentro da interface 2D. Dois modos: "Meu espaço" (o
 * guarda-roupa real, com medidas reais) e "Dream Space" (módulos suspensos, superfícies translúcidas, luz embutida e
 * closet que cresce, com o orçamento dos desejos). Clicar num compartimento abre o conteúdo dele ampliado.
 */
import { useCallback, useState } from "react";
import { EmptyState, SegmentPicker } from "@/components/ui";
import { useReducedMotion } from "@/components/three/common";
import { useI18n } from "@/lib/i18n/i18n";
import { iniciarArrasto } from "@/lib/acervo/arrasto";
import { acharCompartimento, marcadoresPorCompartimento, pecasDoCompartimento } from "@/lib/acervo/arvore";
import type { VistaDaCena } from "@/lib/acervo/cena/camera";
import type { ItemDoCompartimento } from "@/lib/acervo/cena/roupas";
import type { AcervoModo, AcervoPeca } from "@/lib/acervo/types";
import { isWithoutPhoto, pieceImageUrl } from "@/lib/pieces/piece-image";
import { AcervoBarra } from "../acervo-barra";
import { useAcervo } from "../acervo-contexto";
import { PecaFoto } from "../peca-card";
import { useCorDaPeca, useFantasmas, useParados } from "../use-acervo-destaques";
import { Cena } from "./cena";
import { CenaFerramentas } from "./cena-ferramentas";
import { GavetaExpandida } from "./gaveta-expandida";
import { PainelConfig } from "./painel-config";
import { PainelDream } from "./painel-dream";

const MAX_NA_BANDEJA = 16;

/** Miniatura (320 px) da foto própria da peça; a ilustração da categoria não entra na cena, que já mostra a cor. */
function fotoNaCena(peca: AcervoPeca): string | undefined {
  return isWithoutPhoto(peca) ? undefined : pieceImageUrl({ thumbnailUrl: peca.thumbnailUrl }, 320);
}

export function AcervoEspaco() {
  const { t } = useI18n();
  const { dados, tela, busca } = useAcervo();
  const reduzido = useReducedMotion();
  const corDe = useCorDaPeca();
  const fantasmasDe = useFantasmas();
  const parados = useParados();
  const [vista, setVista] = useState<VistaDaCena>("PERSPECTIVA");
  const [comandoDeCamera, setComandoDeCamera] = useState({ vez: 0, giro: 0 });
  const escolherVista = (nova: VistaDaCena) => {
    setVista(nova);
    setComandoDeCamera((c) => ({ vez: c.vez + 1, giro: 0 }));
  };
  const girar = (graus: number) => setComandoDeCamera((c) => ({ vez: c.vez + 1, giro: graus }));
  const [gavetasAbertas, setGavetasAbertas] = useState(false);
  const arvore = dados.arvore;

  const itensDe = useCallback((id: string): ItemDoCompartimento[] => {
    if (!arvore) return [];
    const pecas = pecasDoCompartimento(arvore, id).map((p) => ({ id: p.id, categoria: p.category, cor: corDe(p), foto: fotoNaCena(p) }));
    const fantasmas = fantasmasDe(id).map((d) => ({ id: d.id, categoria: d.categoria, cor: "#DDF247", fantasma: true }));
    return [...pecas, ...fantasmas];
  }, [arvore, corDe, fantasmasDe]);

  if (!arvore) return null;
  const escolhido = tela.local.tipo === "COMPARTIMENTO" ? acharCompartimento(arvore, tela.local.id) : null;
  const noModo = escolhido && escolhido.movel.modo === tela.modo ? escolhido : null;
  const ambiente = noModo?.ambiente ?? arvore.ambientes.find((a) => a.moveis.some((m) => m.modo === tela.modo)) ?? null;
  const moveis = (ambiente?.moveis ?? []).filter((m) => m.modo === tela.modo);
  const movel = noModo?.movel ?? moveis[0] ?? null;
  const semLugar = arvore.pecas.filter((p) => !p.compartimentoId);
  const gavetas = moveis.reduce((soma, m) => soma + m.compartimentos.filter((c) => c.tipo === "GAVETA").length, 0);
  const comRaioX = gavetas > 0 || moveis.some((m) => m.porta !== "SEM_PORTA");
  const mover = (ids: string[], id: string) => {
    void dados.mover(ids, id, t("acervo.mover.feito"));
  };

  return (
    <div className="acv-espaco">
      <div className="acv-principal">
        <SegmentPicker<AcervoModo> className="acv-modos" label={t("acervo.modo.titulo")} value={tela.modo} onChange={tela.setModo} options={[
          { id: "MEU_ESPACO", label: t("acervo.modo.meuEspaco") },
          { id: "DREAM_SPACE", label: t("acervo.modo.dreamSpace") },
        ]} />
        <p className="acv-dica">{t(tela.modo === "DREAM_SPACE" ? "acervo.modo.dreamSpaceDica" : "acervo.modo.meuEspacoDica")}</p>
        <AcervoBarra />
        {moveis.length === 0 ? (
          <EmptyState title={t(tela.modo === "DREAM_SPACE" ? "acervo.dream.vazio" : "acervo.espaco.vazio")}
            hint={t(tela.modo === "DREAM_SPACE" ? "acervo.dream.vazioDica" : "acervo.espaco.vazioDica")} />
        ) : (
          <div className="acv-palco" data-modo={tela.modo}>
            <Cena moveis={moveis} itensDe={itensDe} selecionado={noModo?.compartimento.id ?? null} acesos={busca.acesos} parados={parados}
              marcadores={marcadoresPorCompartimento(arvore, tela.selecao)} raioX={tela.raioX} gavetasAbertas={gavetasAbertas} vista={vista}
              comandoDeCamera={comandoDeCamera} reduzido={reduzido} rotulo={t("acervo.espaco.cenaRotulo", { ambiente: ambiente?.nome ?? "" })}
              onEscolher={(id) => tela.setLocal({ tipo: "COMPARTIMENTO", id })} onSoltar={mover} onPeca={tela.abrirPeca} />
            {noModo && <GavetaExpandida compartimentoId={noModo.compartimento.id} onFechar={() => tela.setLocal({ tipo: "TODAS" })} />}
            <CenaFerramentas comRaioX={comRaioX} vista={vista} onVista={escolherVista} gavetasAbertas={gavetasAbertas}
              onGavetas={setGavetasAbertas} onGirar={girar} />
          </div>
        )}
        {semLugar.length > 0 && moveis.length > 0 && (
          <section className="acv-bandeja" aria-label={t("acervo.dir.semLugar")}>
            <h3 className="acv-cartao-titulo">{t("acervo.espaco.bandeja", { count: semLugar.length })}</h3>
            <ul>
              {semLugar.slice(0, MAX_NA_BANDEJA).map((p) => (
                <li key={p.id} draggable onDragStart={(e) => iniciarArrasto(e, [p.id])}>
                  <button type="button" className="acv-bandeja-peca" onClick={() => tela.abrirPeca(p.id)} aria-label={t("acervo.peca.abrir", { nome: p.name })}>
                    <PecaFoto peca={p} />
                    <span>{p.name}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="acv-dica">{t("acervo.espaco.bandejaDica")}</p>
          </section>
        )}
      </div>
      <aside className="acv-espaco-lateral" aria-label={t("acervo.espaco.painel")}>
        {movel && <PainelConfig movel={movel} resumo={t("acervo.config.resumo", { armarios: moveis.length, gavetas })} />}
        {tela.modo === "DREAM_SPACE" && <PainelDream ambienteId={ambiente?.id ?? arvore.ambientes[0]?.id ?? null} modulos={moveis.length} />}
      </aside>
    </div>
  );
}
