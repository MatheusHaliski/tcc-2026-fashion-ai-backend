"use client";
/**
 * O painel do desfile jogável na tela: quantas marcas faltam e, na ponta, o botão da pose final (□). Ouve os eventos
 * da cena (fx-events) e avisa a tela quando a pose final acabou, para revelar o resultado. Lido pelo leitor de tela.
 */
import { useEffect, useState } from "react";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { assinarFx, emitirFx } from "@/lib/flair/nucleos/fx-events";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

export function DesfileHud({ codigo, onFim }: { codigo: NucleoCodigo; onFim: () => void }) {
  const tx = useNucleoText();
  const [p, setP] = useState({ alcancadas: 0, total: 3, naPonta: false });
  const gesto = tx.ou(`flair3d.desfile.acao.${codigo}`, tx.t("flair3d.desfile.acao.padrao"));
  useEffect(() => assinarFx((e) => {
    if (e.nucleo !== codigo) return;
    if (e.tipo === "desfile") setP({ alcancadas: e.alcancadas, total: e.total, naPonta: e.naPonta });
    if (e.tipo === "desfile-fim") onFim();
  }), [codigo, onFim]);
  return (
    <div className="n3d-desfile" data-testid="desfile-hud" data-ponta={p.naPonta || undefined}>
      <p role="status">{tx.t(p.naPonta ? "flair3d.desfile.ponta" : "flair3d.desfile.marcas", { alcancadas: p.alcancadas, total: p.total, acao: gesto })}</p>
      {p.naPonta && (
        <button type="button" className="n3d-desfile-pose" onClick={() => emitirFx({ tipo: "desfile-pose", nucleo: codigo })}>
          □ {gesto}
        </button>
      )}
    </div>
  );
}
