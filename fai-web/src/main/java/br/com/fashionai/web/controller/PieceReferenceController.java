package br.com.fashionai.web.controller;

import br.com.fashionai.application.view.Views;
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

    public PieceReferenceController(EstadoConservacaoRepository estados, TipoLavagemRepository lavagens) {
        this.estados = estados;
        this.lavagens = lavagens;
    }

    @GetMapping("/api/estados-conservacao")
    @Transactional(readOnly = true)
    @Operation(summary = "Opções de conservação cadastradas em EstadoConservacao")
    public List<Views.ReferenceOptionView> estadosConservacao() {
        return estados.findAllByOrderByNomeAsc().stream().map(Views::estadoConservacao).toList();
    }

    @GetMapping("/api/tipos-lavagem")
    @Transactional(readOnly = true)
    @Operation(summary = "Instruções de lavagem cadastradas em TipoLavagem")
    public List<Views.ReferenceOptionView> tiposLavagem() {
        return lavagens.findAllByOrderByNomeAsc().stream().map(Views::tipoLavagem).toList();
    }
}
