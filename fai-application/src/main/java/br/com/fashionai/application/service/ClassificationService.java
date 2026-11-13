package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.Colecao;
import br.com.fashionai.domain.model.IntensidadeTermica;
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
public class ClassificationService {
    private final ColecaoRepository colecoes;
    private final IntensidadeTermicaRepository intensidades;

    public ClassificationService(ColecaoRepository colecoes, IntensidadeTermicaRepository intensidades) {
        this.colecoes = colecoes;
        this.intensidades = intensidades;
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
