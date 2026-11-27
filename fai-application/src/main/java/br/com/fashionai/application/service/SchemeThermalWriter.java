package br.com.fashionai.application.service;

import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Component;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.NivelTermico;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.repository.NivelTermicoRepository;

/**
 * Nível térmico do look (docs/banco-de-dados/solucoes/04-nivel-termico.md). O formulário manda o ID da opção ou o pedido
 * explícito de limpar: ID nulo mantém o nível atual; limpar deixa o look sem nível; ID novo precisa existir e estar
 * ativo. O nível que o look já tem continua valendo mesmo depois de desativado (a opção sai da escolha, não do look).
 * Chamado pelo {@link SchemeService} depois da autorização, dentro da transação do salvamento.
 */
@Component
public class SchemeThermalWriter {
    private final NivelTermicoRepository niveis;

    public SchemeThermalWriter(NivelTermicoRepository niveis) {
        this.niveis = niveis;
    }

    public void apply(Scheme look, UUID nivelTermicoId, boolean clear) {
        if (nivelTermicoId != null && clear) {
            throw invalid("NIVEL_TERMICO_INVALIDO", "Escolha um nível térmico ou limpe o campo, não os dois");
        }
        if (clear) {
            look.setNivelTermico(null);
            return;
        }
        NivelTermico atual = look.getNivelTermico();
        if (nivelTermicoId == null || (atual != null && nivelTermicoId.equals(atual.getId()))) {
            return;
        }
        look.setNivelTermico(ativo(nivelTermicoId));
    }

    /**
     * O critério térmico de uma recomendação (Vista-me): o código do nível pedido, que precisa existir e estar ativo;
     * nulo quando não foi pedido.
     */
    public String activeCode(UUID nivelTermicoId) {
        return nivelTermicoId == null ? null : ativo(nivelTermicoId).getCodigo();
    }

    private NivelTermico ativo(UUID id) {
        NivelTermico n = niveis.findById(id).orElseThrow(() -> invalid("NIVEL_TERMICO_INVALIDO", "Nível térmico inválido"));
        if (!n.isAtivo()) {
            throw invalid("NIVEL_TERMICO_INATIVO", "Este nível térmico não está mais disponível");
        }
        return n;
    }

    private static ApiException invalid(String code, String message) {
        return ApiException.badRequest(code, message, Map.of("nivelTermicoId", message));
    }
}
