package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.Colecao;
import br.com.fashionai.domain.model.IntensidadeTermica;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.ColecaoRepository;
import br.com.fashionai.domain.repository.CorteRepository;
import br.com.fashionai.domain.repository.IntensidadeTermicaRepository;
import br.com.fashionai.domain.repository.OrigemRepository;
import br.com.fashionai.domain.repository.TipoLavagemRepository;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

/**
 * Referências de coleção e intensidade térmica da peça e do look; tipo de lavagem, origem e corte da peça. O formulário manda o ID
 * da opção, que é conferido na tabela e vira uma FK. Chamado após autorização pelo WardrobeService/SchemeService.
 * ID nulo mantém o valor atual, salvo remoção explícita; ID inexistente responde 400 com o campo a corrigir.
 */
@Service
public class ClassificationService {
    private final ColecaoRepository colecoes;
    private final IntensidadeTermicaRepository intensidades;
    private final TipoLavagemRepository lavagens;
    private final OrigemRepository origens;
    private final CorteRepository cortes;

    public ClassificationService(ColecaoRepository colecoes, IntensidadeTermicaRepository intensidades,
                                 TipoLavagemRepository lavagens, OrigemRepository origens, CorteRepository cortes) {
        this.colecoes = colecoes;
        this.intensidades = intensidades;
        this.lavagens = lavagens;
        this.origens = origens;
        this.cortes = cortes;
    }

    public void apply(WardrobeItem piece, UUID colecaoId, UUID intensidadeTermicaId) {
        if (colecaoId != null) {
            piece.setColecao(colecao(colecaoId));
        }
        if (intensidadeTermicaId != null) {
            piece.setIntensidadeTermica(intensidade(intensidadeTermicaId));
        }
    }

    public void apply(Scheme look, UUID colecaoId, UUID intensidadeTermicaId) {
        if (colecaoId != null) {
            look.setColecao(colecao(colecaoId));
        }
        if (intensidadeTermicaId != null) {
            look.setIntensidadeTermica(intensidade(intensidadeTermicaId));
        }
    }

    /** Origem e corte da peça: ID nulo mantém o valor atual; corte desativado não entra em peça nova. */
    public void applyOrigemECorte(WardrobeItem piece, UUID origemId, UUID corteId) {
        if (origemId != null) {
            piece.setOrigem(origens.findById(origemId).orElseThrow(() ->
                    invalid("ORIGEM_INVALIDA", "origemId", "Origem inválida")));
        }
        if (corteId != null && (piece.getCorte() == null || !corteId.equals(piece.getCorte().getId()))) {
            piece.setCorte(cortes.findById(corteId).filter(c -> c.isAtivo()).orElseThrow(() ->
                    invalid("CORTE_INVALIDO", "corteId", "Corte inválido")));
        }
    }

    public void applyWashing(WardrobeItem piece, UUID id, boolean clear) {
        if (id != null && clear) {
            throw invalid("TIPO_LAVAGEM_INVALIDO", "tipoLavagemId", "Tipo de lavagem inválido");
        }
        if (clear) {
            piece.setTipoLavagem(null);
        } else if (id != null) {
            piece.setTipoLavagem(lavagens.findById(id).orElseThrow(() ->
                    invalid("TIPO_LAVAGEM_INVALIDO", "tipoLavagemId", "Tipo de lavagem inválido")));
        }
    }

    private Colecao colecao(UUID id) {
        return colecoes.findById(id).orElseThrow(() -> invalid("COLECAO_INVALIDA", "colecaoId", "Coleção inválida"));
    }

    private IntensidadeTermica intensidade(UUID id) {
        return intensidades.findById(id).orElseThrow(() ->
                invalid("INTENSIDADE_TERMICA_INVALIDA", "intensidadeTermicaId", "Intensidade térmica inválida"));
    }

    private static ApiException invalid(String code, String field, String message) {
        return ApiException.badRequest(code, message, Map.of(field, message));
    }
}
