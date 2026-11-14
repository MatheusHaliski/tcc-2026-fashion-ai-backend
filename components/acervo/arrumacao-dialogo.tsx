"use client";
/**
 * ACERVO — modo arrumação: o servidor propõe um lugar para cada peça sem gravar nada; a tela mostra o lugar atual e o
 * proposto lado a lado, a pessoa tira o que não quer e só então confirma.
 */
import { useEffect, useState } from "react";
import { Button, Dialog, EmptyState, SegmentPicker } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { acervoApi } from "@/lib/acervo/api";
import type { AcervoPrevia } from "@/lib/acervo/types";
import { useAcervo } from "./acervo-contexto";
import { PecaFoto } from "./peca-card";

type Escopo = "SEM_LUGAR" | "TUDO";

export function ArrumacaoDialogo({ aberto, onClose }: { aberto: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { dados } = useAcervo();
  const [escopo, setEscopo] = useState<Escopo>("SEM_LUGAR");
  const [previa, setPrevia] = useState<AcervoPrevia | null>(null);
  const [fora, setFora] = useState<string[]>([]);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    setPrevia(null);
    setFora([]);
    setErro(false);
    acervoApi.previa(escopo)
      .then((p) => {
        if (vivo) setPrevia(p);
      })
      .catch(() => {
        if (vivo) setErro(true);
      });
    return () => {
      vivo = false;
    };
  }, [aberto, escopo]);

  if (!aberto) return null;
  const aceitos = (previa?.movimentos ?? []).filter((m) => !fora.includes(m.pieceId));
  const alternar = (id: string) => setFora((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));

  async function confirmar() {
    const movimentos = aceitos.map((m) => ({ pieceId: m.pieceId, compartimentoId: m.para.compartimentoId }));
    const ok = await dados.executar(() => acervoApi.confirmar(movimentos), t("acervo.arrumacao.feito", { count: movimentos.length }));
    if (ok) onClose();
  }

  return (
    <Dialog open onClose={onClose} title={t("acervo.arrumacao.titulo")} size="lg"
      footer={<>
        <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="primary" disabled={aceitos.length === 0} loading={dados.ocupado} onClick={() => { void confirmar(); }}>
          {t("acervo.arrumacao.confirmar", { count: aceitos.length })}
        </Button>
      </>}>
      <div className="acv acv-arrumacao">
        <p className="acv-dica">{t("acervo.arrumacao.explica")}</p>
        <SegmentPicker<Escopo> label={t("acervo.arrumacao.escopo")} value={escopo} onChange={setEscopo} options={[
          { id: "SEM_LUGAR", label: t("acervo.arrumacao.soSemLugar") },
          { id: "TUDO", label: t("acervo.arrumacao.tudo") },
        ]} />
        {erro && <p role="alert" className="acv-dica">{t("acervo.arrumacao.erro")}</p>}
        {!previa && !erro && <p role="status" className="acv-dica">{t("common.loading")}</p>}
        {previa && previa.movimentos.length === 0 && (
          <EmptyState title={t("acervo.arrumacao.nada")} hint={previa.semDestino.length > 0 ? undefined : t("acervo.arrumacao.nadaDica")} />
        )}
        {previa && previa.semDestino.length > 0 && <p className="acv-dica">{t("acervo.arrumacao.semDestino", { count: previa.semDestino.length })}</p>}
        {previa && previa.movimentos.length > 0 && (
          <table className="acv-arrumacao-tabela">
            <thead>
              <tr>
                <th scope="col">{t("acervo.arrumacao.peca")}</th>
                <th scope="col">{t("acervo.arrumacao.atual")}</th>
                <th scope="col">{t("acervo.arrumacao.proposto")}</th>
                <th scope="col">{t("acervo.arrumacao.aplicar")}</th>
              </tr>
            </thead>
            <tbody>
              {previa.movimentos.map((m) => (
                <tr key={m.pieceId} className={fora.includes(m.pieceId) ? "is-fora" : undefined}>
                  <th scope="row"><PecaFoto peca={m} /><span>{m.name}</span></th>
                  <td>{m.de.caminho ?? t("acervo.dir.semLugar")}</td>
                  <td><strong>{m.para.caminho}</strong><span className="acv-dica">{m.motivo}</span></td>
                  <td>
                    <input type="checkbox" checked={!fora.includes(m.pieceId)} onChange={() => alternar(m.pieceId)}
                      aria-label={t("acervo.arrumacao.aplicarEm", { nome: m.name })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Dialog>
  );
}
