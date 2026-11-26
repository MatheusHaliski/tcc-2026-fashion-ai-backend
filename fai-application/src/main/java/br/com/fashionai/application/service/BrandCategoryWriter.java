package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.view.Views.ReferenceOptionView;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CategoriaMarca;
import br.com.fashionai.domain.repository.CategoriaMarcaRepository;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Categoria principal da marca (docs/banco-de-dados/solucoes/09-categoria-marca.md). O PATCH manda
 * {@code categoriaMarcaId} (UUID da opção) ou {@code clearCategoriaMarca}: campo omitido mantém a categoria; limpar
 * deixa o perfil sem categoria; ID novo precisa existir e estar ativo. A categoria que o perfil já tem continua valendo
 * mesmo depois de desativada. O texto legado {@code fashion_category} não é convertido nem apagado aqui.
 * Chamado pelo {@link InstitutionalProfileEditor} depois de achar o perfil pela sessão, na transação da edição.
 */
@Component
public class BrandCategoryWriter {
    static final String ID = "categoriaMarcaId";
    static final String CLEAR = "clearCategoriaMarca";

    private final CategoriaMarcaRepository categorias;

    public BrandCategoryWriter(CategoriaMarcaRepository categorias) {
        this.categorias = categorias;
    }

    public void apply(BrandProfile perfil, Map<String, ?> fields) {
        ReferenceChoice.Choice escolha = ReferenceChoice.read(fields, ID, CLEAR,
                () -> invalid("CATEGORIA_MARCA_INVALIDA", "institutional.categoria_marca_invalida"));
        if (escolha.keep()) {
            return;
        }
        if (escolha.id() == null) {
            perfil.setCategoriaMarca(null);
            return;
        }
        CategoriaMarca atual = perfil.getCategoriaMarca();
        if (atual != null && escolha.id().equals(atual.getId())) {
            return;
        }
        CategoriaMarca nova = categorias.findById(escolha.id())
                .orElseThrow(() -> invalid("CATEGORIA_MARCA_INVALIDA", "institutional.categoria_marca_invalida"));
        if (!nova.isAtivo()) {
            throw invalid("CATEGORIA_MARCA_INATIVA", "institutional.categoria_marca_inativa");
        }
        perfil.setCategoriaMarca(nova);
    }

    /** O que o card público mostra: id, código e nome (também de uma categoria já desativada); nulo sem categoria. */
    public static ReferenceOptionView view(CategoriaMarca categoria) {
        return categoria == null ? null : new ReferenceOptionView(categoria.getId(), categoria.getCodigo(), categoria.getNome());
    }

    private static ApiException invalid(String code, String key) {
        String message = Msg.t(key);
        return ApiException.badRequest(code, message, Map.of(ID, message));
    }
}
