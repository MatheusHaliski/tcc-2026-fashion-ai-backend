package br.com.fashionai.web.controller;

import br.com.fashionai.application.view.PieceReferenceViews;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.repository.ColecaoRepository;
import br.com.fashionai.domain.repository.CorteRepository;
import br.com.fashionai.domain.repository.EstadoConservacaoRepository;
import br.com.fashionai.domain.repository.IntensidadeTermicaRepository;
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
    private final CorteRepository cortes;
    private final IntensidadeTermicaRepository intensidades;

    public PieceReferenceController(EstadoConservacaoRepository estados, TipoLavagemRepository lavagens,
                                    ColecaoRepository colecoes, IntensidadeTermicaRepository intensidades,
                                    CorteRepository cortes) {
        this.estados = estados;
        this.lavagens = lavagens;
        this.colecoes = colecoes;
        this.intensidades = intensidades;
        this.cortes = cortes;
    }

    @GetMapping({"/api/estados-conservacao", "/api/opcoes/estados-conservacao"})
    @Transactional(readOnly = true)
    @Operation(summary = "Opções de conservação cadastradas em EstadoConservacao")
    public List<Views.ReferenceOptionView> estadosConservacao() {
        return estados.findAllByAtivoTrueOrderByNomeAsc().stream().map(PieceReferenceViews::estadoConservacao).toList();
    }

    @GetMapping("/api/colecoes")
    @Transactional(readOnly = true)
    @Operation(summary = "Coleções cadastradas na tabela colecao")
    public List<Views.ReferenceOptionView> colecoes() {
        return colecoes.findAllByOrderByNomeAsc().stream().map(PieceReferenceViews::colecao).toList();
    }

    @GetMapping("/api/cortes")
    @Transactional(readOnly = true)
    @Operation(summary = "Cortes de peça ativos na tabela cortes")
    public List<Views.ReferenceOptionView> cortes() {
        return cortes.findAllByAtivoTrueOrderByNomeAsc().stream().map(PieceReferenceViews::corte).toList();
    }

    @GetMapping("/api/intensidades-termicas")
    @Transactional(readOnly = true)
    @Operation(summary = "Intensidades térmicas cadastradas na tabela intensidade_termica")
    public List<Views.ReferenceOptionView> intensidadesTermicas() {
        return intensidades.findAllByOrderByNomeAsc().stream().map(PieceReferenceViews::intensidadeTermica).toList();
    }

    @GetMapping({"/api/tipos-lavagem", "/api/tipo-lavagem"})
    @Transactional(readOnly = true)
    @Operation(summary = "Instruções de lavagem cadastradas em TipoLavagem")
    public List<Views.ReferenceOptionView> tiposLavagem() {
        return lavagens.findAllByOrderByNomeAsc().stream().map(PieceReferenceViews::tipoLavagem).toList();
    }
}
