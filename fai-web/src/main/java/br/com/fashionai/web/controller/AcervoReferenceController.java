package br.com.fashionai.web.controller;

import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.repository.acervo.TipoIluminacaoRepository;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Opções de referência do acervo (exercício 07), só leitura e iguais para todos: sob {@code /api/opcoes/**}, públicas por
 * convenção (SecurityConfig, OpcoesConvencaoTest). O ambiente grava o ID escolhido em PUT /api/me/acervo/ambientes/{id}/luz.
 */
@RestController
public class AcervoReferenceController {
    private final TipoIluminacaoRepository tipos;

    public AcervoReferenceController(TipoIluminacaoRepository tipos) {
        this.tipos = tipos;
    }

    @GetMapping("/api/opcoes/tipos-iluminacao")
    @Transactional(readOnly = true)
    @Operation(summary = "Tipos de iluminação ativos na tabela tipos_iluminacao (id, código e nome), em ordem de nome")
    public List<Views.ReferenceOptionView> tiposIluminacao() {
        return tipos.findAllByAtivoTrueOrderByNomeAsc().stream().map(t -> new Views.ReferenceOptionView(t.getId(), t.getCodigo(), t.getNome())).toList();
    }
}
