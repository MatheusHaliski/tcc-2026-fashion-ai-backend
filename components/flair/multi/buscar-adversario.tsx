"use client";
/**
 * Busca de adversários na rede FAI (componente reutilizável: FLAIR 3D, duelo do FLAIR 2D e desafios). Nunca pede a tag:
 * a pessoa busca por nome, filtra (relação, nível, estilo, país, cidade, ativa, deck para o jogo) e escolhe na lista.
 * Quem está bloqueado, a própria pessoa e conta de teste nem aparecem (servidor); conta privada que não se segue
 * aparece com o botão desligado e o motivo.
 */
import { useState } from "react";
import { Chip, Input, Skeleton, UiIcon } from "@/components/ui";
import { FiltrosDaBusca } from "@/components/flair/multi/filtros-da-busca";
import { ItemAdversario } from "@/components/flair/multi/item-adversario";
import { useAdversarios } from "@/components/flair/multi/use-adversarios";
import { filtrosAtivos, RELACOES } from "@/lib/flair/multi/filtros";
import type { Adversario, FiltrosAdversario } from "@/lib/flair/multi/types";
import { useI18n } from "@/lib/i18n/i18n";

interface Props {
  /** o jogo do convite: liga o filtro "tem deck para este jogo" */
  jogo?: string | null;
  /** ids já escolhidos (escolha de várias pessoas, como nos desafios) */
  selecionados?: string[];
  onEscolher: (a: Adversario) => void;
  /** texto do botão de cada pessoa (padrão: Convidar) */
  rotuloAcao?: string;
  /** id da pessoa cujo convite está saindo */
  ocupado?: string | null;
}

export function BuscarAdversario({ jogo = null, selecionados = [], onEscolher, rotuloAcao, ocupado = null }: Props) {
  const { t } = useI18n();
  const [filtros, setFiltros] = useState<FiltrosAdversario>({ relacao: "TODOS", jogo: jogo ?? undefined });
  const [abertos, setAbertos] = useState(false);
  const busca = useAdversarios(filtros);
  const mudar = (parte: Partial<FiltrosAdversario>) => setFiltros((f) => ({ ...f, ...parte }));
  const contagem = filtrosAtivos(filtros);
  return (
    <section className="fm-busca" aria-label={t("flair3d.multi.busca.titulo")}>
      <label className="fm-busca-campo">
        <UiIcon name="search" size={18} />
        <span className="sr-only">{t("flair3d.multi.busca.titulo")}</span>
        <Input type="search" value={filtros.q ?? ""} placeholder={t("flair3d.multi.busca.placeholder")} onChange={(e) => mudar({ q: e.target.value })} data-testid="fm-busca-termo" />
      </label>
      <div className="fm-busca-chips" role="group" aria-label={t("flair3d.multi.busca.relacao")}>
        {RELACOES.map((r) => (
          <Chip key={r} active={(filtros.relacao ?? "TODOS") === r} onClick={() => mudar({ relacao: r })}>{t(`flair3d.multi.relacao.${r}`)}</Chip>
        ))}
        <Chip active={abertos} onClick={() => setAbertos((a) => !a)}>
          {contagem ? t("flair3d.multi.busca.filtrosN", { n: contagem }) : t("flair3d.multi.busca.filtros")}
        </Chip>
      </div>
      {abertos && <FiltrosDaBusca filtros={filtros} jogo={jogo} onMudar={mudar} />}
      <div aria-live="polite">
        {busca.carregando && !busca.resultados.length ? <Skeleton className="h-24" /> : busca.resultados.length === 0
          ? <p className="type-caption text-muted fm-vazio">{t("flair3d.multi.busca.vazio")}</p>
          : (
            <ul className="fm-lista" data-testid="fm-resultados">
              {busca.resultados.map((a) => (
                <ItemAdversario key={a.id} pessoa={a} escolhida={selecionados.includes(a.id)} ocupado={ocupado === a.id}
                  rotuloAcao={rotuloAcao ?? t("flair3d.multi.convidar")} onEscolher={() => onEscolher(a)} />
              ))}
            </ul>
          )}
      </div>
    </section>
  );
}
