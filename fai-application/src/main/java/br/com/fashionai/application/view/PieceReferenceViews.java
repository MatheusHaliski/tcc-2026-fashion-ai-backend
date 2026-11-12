package br.com.fashionai.application.view;

import br.com.fashionai.application.view.Views.ReferenceOptionView;
import br.com.fashionai.domain.model.Colecao;

/** Opções de referência da peça mostradas ao cliente (id, código e nome), sem timestamps/autoria da entidade. */
public final class PieceReferenceViews {
    private PieceReferenceViews() {
    }

    public static ReferenceOptionView colecao(Colecao colecao) {
        return colecao == null ? null : new ReferenceOptionView(colecao.getId(), colecao.getCodigo(), colecao.getNome());
    }
}
