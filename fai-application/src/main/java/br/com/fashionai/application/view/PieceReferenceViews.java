package br.com.fashionai.application.view;

import br.com.fashionai.application.view.Views.ReferenceOptionView;
import br.com.fashionai.domain.model.Colecao;
import br.com.fashionai.domain.model.EstadoConservacao;
import br.com.fashionai.domain.model.IntensidadeTermica;
import br.com.fashionai.domain.model.Origem;
import br.com.fashionai.domain.model.TipoLavagem;

/** Opções de referência da peça e do look mostradas ao cliente (id, código e nome), sem timestamps/autoria da entidade. */
public final class PieceReferenceViews {
    private PieceReferenceViews() {
    }

    public static ReferenceOptionView estadoConservacao(EstadoConservacao estado) {
        return estado == null ? null : new ReferenceOptionView(estado.getId(), estado.getCodigo(), estado.getNome());
    }

    public static ReferenceOptionView tipoLavagem(TipoLavagem tipo) {
        return tipo == null ? null : new ReferenceOptionView(tipo.getId(), tipo.getCodigo(), tipo.getNome());
    }

    public static ReferenceOptionView colecao(Colecao colecao) {
        return colecao == null ? null : new ReferenceOptionView(colecao.getId(), colecao.getCodigo(), colecao.getNome());
    }

    public static ReferenceOptionView intensidadeTermica(IntensidadeTermica intensidade) {
        return intensidade == null ? null
                : new ReferenceOptionView(intensidade.getId(), intensidade.getCodigo(), intensidade.getNome());
    }

    public static ReferenceOptionView origem(Origem origem) {
        return origem == null ? null : new ReferenceOptionView(origem.getId(), origem.getCodigo(), origem.getNome());
    }
      public static ReferenceOptionView cortes(Cortes cortes) {
        return cortes == null ? null : new ReferenceOptionView(cortes.getId(), cortes.getCodigo(), cortes.getNome());
    }
}
