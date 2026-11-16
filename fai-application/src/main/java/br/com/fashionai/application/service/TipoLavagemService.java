package br.com.fashionai.application.service;
import br.com.fashionai.domain.repository.TipoLavagemRepository;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.Colecao;
import br.com.fashionai.domain.model.IntensidadeTermica;
import br.com.fashionai.domain.model.TipoLavagem;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.ColecaoRepository;
import br.com.fashionai.domain.repository.IntensidadeTermicaRepository;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

/**
 * Coleção e intensidade térmica da peça e do look: o formulário manda só o ID da opção; aqui ele é conferido na tabela
 * e vira a FK (wardrobe_items / schemes). Chamado depois que o WardrobeService/SchemeService autorizou a gravação.
 * ID nulo mantém o valor atual; ID inexistente responde 400 com o campo a corrigir.
 */
@Service
public class TipoLavagemService {
    private final ColecaoRepository colecoes;
    private final IntensidadeTermicaRepository intensidades;
    private final TipoLavagemRepository lavagens;

    public TipoLavagemService(ColecaoRepository colecoes, IntensidadeTermicaRepository intensidades, TipoLavagemRepository lavagens) {
        this.colecoes = colecoes;
        this.intensidades = intensidades;
        this.lavagens = lavagens;
    }

    public void apply(WardrobeItem piece, UUID colecaoId, UUID intensidadeTermicaId, UUID tipoLavagemId) {
        if (colecaoId != null) {
            piece.setColecao(colecao(colecaoId));
        }
        if (intensidadeTermicaId != null) {
            piece.setIntensidadeTermica(intensidade(intensidadeTermicaId));
        }
        if (tipoLavagemId != null) {
            piece.setTipoLavagem(tipoLavagem(tipoLavagemId));
        }
    }

    public void apply(Scheme look, UUID colecaoId, UUID intensidadeTermicaId, UUID tipoLavagemId) {
        if (colecaoId != null) {
            look.setColecao(colecao(colecaoId));
        }
        if (intensidadeTermicaId != null) {
            look.setIntensidadeTermica(intensidade(intensidadeTermicaId));
        }
        if (tipoLavagemId != null) {
            look.setTipoLavagem(tipoLavagem(tipoLavagemId));
        }
    }

    private Colecao colecao(UUID id) {
        return colecoes.findById(id).orElseThrow(() -> invalid("COLECAO_INVALIDA", "colecaoId", "Coleção inválida"));
    }

    private IntensidadeTermica intensidade(UUID id) {
        return intensidades.findById(id).orElseThrow(() ->
                invalid("INTENSIDADE_TERMICA_INVALIDA", "intensidadeTermicaId", "Intensidade térmica inválida"));
    }

    private TipoLavagem tipoLavagem(UUID id) {
        return lavagens.findById(id).orElseThrow(() ->
                invalid("TIPO_LAVAGEM_INVALIDA", "tipoLavagemId", "Tipo de lavagem inválido"));
    }   

    private static ApiException invalid(String code, String field, String message) {
        return ApiException.badRequest(code, message, Map.of(field, message));
    }
}
