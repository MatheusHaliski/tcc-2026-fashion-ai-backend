package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.view.Views.ReferenceOptionView;
import br.com.fashionai.domain.model.AreaArtistica;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.repository.AreaArtisticaRepository;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Área artística principal da celebridade (docs/banco-de-dados/solucoes/10-area-artistica.md). O PATCH manda
 * {@code areaArtisticaId} (UUID da opção) ou {@code clearAreaArtistica}: campo omitido mantém a área; limpar deixa o
 * perfil sem área principal; ID novo precisa existir e estar ativo. A área que o perfil já tem continua valendo mesmo
 * depois de desativada. A lista livre de áreas ({@code areas_json}) não é lida nem alterada aqui, e escolher a área
 * principal não muda a verificação do perfil. Chamado pelo {@link InstitutionalProfileEditor}, na transação da edição.
 */
@Component
public class CelebrityAreaWriter {
    static final String ID = "areaArtisticaId";
    static final String CLEAR = "clearAreaArtistica";

    private final AreaArtisticaRepository areas;

    public CelebrityAreaWriter(AreaArtisticaRepository areas) {
        this.areas = areas;
    }

    public void apply(CelebrityProfile perfil, Map<String, ?> fields) {
        ReferenceChoice.Choice escolha = ReferenceChoice.read(fields, ID, CLEAR,
                () -> invalid("AREA_ARTISTICA_INVALIDA", "institutional.area_artistica_invalida"));
        if (escolha.keep()) {
            return;
        }
        if (escolha.id() == null) {
            perfil.setAreaArtisticaPrincipal(null);
            return;
        }
        AreaArtistica atual = perfil.getAreaArtisticaPrincipal();
        if (atual != null && escolha.id().equals(atual.getId())) {
            return;
        }
        AreaArtistica nova = areas.findById(escolha.id())
                .orElseThrow(() -> invalid("AREA_ARTISTICA_INVALIDA", "institutional.area_artistica_invalida"));
        if (!nova.isAtivo()) {
            throw invalid("AREA_ARTISTICA_INATIVA", "institutional.area_artistica_inativa");
        }
        perfil.setAreaArtisticaPrincipal(nova);
    }

    /** O que o card público mostra: id, código e nome (também de uma área já desativada); nulo sem área principal. */
    public static ReferenceOptionView view(AreaArtistica area) {
        return area == null ? null : new ReferenceOptionView(area.getId(), area.getCodigo(), area.getNome());
    }

    private static ApiException invalid(String code, String key) {
        String message = Msg.t(key);
        return ApiException.badRequest(code, message, Map.of(ID, message));
    }
}
