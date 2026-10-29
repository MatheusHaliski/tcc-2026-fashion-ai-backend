package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.EstadoConservacaoRepository;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

/** Called only after WardrobeService has authorized ownership. Never derives a FK from GOOD. */
@Service
public class PieceConservationService {
    private final EstadoConservacaoRepository estados;

    public PieceConservationService(EstadoConservacaoRepository estados) {
        this.estados = estados;
    }

    public void apply(WardrobeItem piece, UUID id, boolean clear) {
        if (id != null && clear) throw invalid();
        if (clear) {
            piece.setEstadoConservacao(null);
            // An explicit owner clear must not reveal an older enum as the current choice.
            piece.setCondition(null);
        } else if (id != null) {
            var state = estados.findById(id).filter(s -> s.isAtivo()).orElseThrow(this::invalid);
            piece.setEstadoConservacao(state);
        }
        // An omitted/null ID preserves existing data, including an unselected legacy piece.
    }

    private ApiException invalid() {
        String message = Msg.t("wardrobe.estado_conservacao_invalido");
        return ApiException.badRequest("ESTADO_CONSERVACAO_INVALIDO", message, Map.of("estadoConservacaoId", message));
    }
}
