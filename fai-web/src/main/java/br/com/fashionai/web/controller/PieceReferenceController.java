package br.com.fashionai.web.controller;

import br.com.fashionai.application.view.PieceReferenceViews;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.repository.ColecaoRepository;
import br.com.fashionai.domain.repository.EstadoConservacaoRepository;
import br.com.fashionai.domain.repository.TipoLavagemRepository;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Somente leitura das opções cadastradas; não concede ao cliente criação/alteração dessas tabelas. */
@RestController
public class PieceReferenceController {
    private final EstadoConservacaoRepository estados;
    private final TipoLavagemRepository lavagens;
    private final ColecaoRepository colecoes;

    public PieceReferenceController(EstadoConservacaoRepository estados, TipoLavagemRepository lavagens,
                                    ColecaoRepository colecoes) {
        this.estados = estados;
        this.lavagens = lavagens;
        this.colecoes = colecoes;
    }

    @GetMapping({"/api/estados-conservacao", "/api/opcoes/estados-conservacao"})
    @Transactional(readOnly = true)
    @Operation(summary = "Opções de conservação cadastradas em EstadoConservacao")
    public List<Views.ReferenceOptionView> estadosConservacao() {
        return estados.findAllByAtivoTrueOrderByNomeAsc().stream().map(Views::estadoConservacao).toList();
    }

    @GetMapping("/api/colecoes")
    @Transactional(readOnly = true)
    @Operation(summary = "Coleções cadastradas na tabela colecao")
    public List<Views.ReferenceOptionView> colecoes() {
        return colecoes.findAllByOrderByNomeAsc().stream().map(PieceReferenceViews::colecao).toList();
    }

    @GetMapping("/api/tipos-lavagem")
    @Transactional(readOnly = true)
    @Operation(summary = "Instruções de lavagem cadastradas em TipoLavagem")
    public List<Views.ReferenceOptionView> tiposLavagem() {
        return lavagens.findAllByOrderByNomeAsc().stream().map(Views::tipoLavagem).toList();
    }
}
