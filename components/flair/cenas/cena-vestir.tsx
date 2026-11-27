"use client";
/**
 * Cena dos Desafios de Montagem "vestir a cena": a imagem ANTES ao fundo e, por cima, o recorte da roupa de cada
 * personagem (a roupa exata da imagem DEPOIS), que entra com um fade e uma cortina de cima para baixo quando a vaga
 * dele recebe a carta certa e sai quando a carta sai. Com todos vestidos, a imagem DEPOIS inteira fecha a cena.
 * Dados e regra de "vestido" em lib/flair/vestir/cenas.ts.
 */
import type { CSSProperties } from "react";
import { cn } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { caixaEmPercentual, imagemAntes, imagemDepois, imagemVeste, type CenaVestir as Cena } from "@/lib/flair/vestir/cenas";

interface Props {
  cena: Cena;
  /** um por personagem, na ordem das vagas (esquerda para a direita) */
  vestidos: boolean[];
  /** nome do desafio, para o rótulo da imagem */
  nome: string;
  decorativa?: boolean;
  className?: string;
}

export function CenaVestir({ cena, vestidos, nome, decorativa = false, className }: Props) {
  const { t } = useI18n();
  const total = cena.pessoas.length;
  const prontos = cena.pessoas.filter((_, i) => vestidos[i]).length;
  const completa = total > 0 && prontos === total;
  const rotulo = completa ? t("cbc.vestir.complete", { cena: nome, total }) : t("cbc.vestir.progress", { cena: nome, vestidos: prontos, total });
  return (
    <div className={cn("cena-vestir", completa && "is-completa", className)} data-cenario={cena.cenario} data-vestidos={cena.pessoas.map((_, i) => (vestidos[i] ? 1 : 0)).join(",")}
      role={decorativa ? undefined : "img"} aria-label={decorativa ? undefined : rotulo} aria-hidden={decorativa || undefined}
      style={{ "--cv-ratio": `${cena.largura} / ${cena.altura}` } as CSSProperties}>
      <img className="cv-antes" src={imagemAntes(cena)} alt="" decoding="async" draggable={false} />
      {cena.pessoas.map((p, i) => {
        const caixa = caixaEmPercentual(cena, p);
        return (
          <img key={p.vaga} className={cn("cv-veste", vestidos[i] && "is-on")} data-vaga={p.vaga} src={imagemVeste(cena, i)} alt="" decoding="async" draggable={false}
            style={{ left: `${caixa.left}%`, top: `${caixa.top}%`, width: `${caixa.width}%`, height: `${caixa.height}%` }} />
        );
      })}
      <img className={cn("cv-depois", completa && "is-on")} src={imagemDepois(cena)} alt="" decoding="async" loading="lazy" draggable={false} />
    </div>
  );
}
