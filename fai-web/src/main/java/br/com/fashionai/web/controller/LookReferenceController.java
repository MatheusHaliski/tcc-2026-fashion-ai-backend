package br.com.fashionai.web.controller;

import br.com.fashionai.application.view.PieceReferenceViews;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.repository.NivelTermicoRepository;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Opções de referência do look (docs/banco-de-dados/solucoes/04-nivel-termico.md), só leitura e iguais para todos: sob
 * {@code /api/opcoes/**}, públicas por convenção (SecurityConfig, OpcoesConvencaoTest). O look grava o ID escolhido em
 * POST/PUT /api/schemes ({@code nivelTermicoId}, {@code clearNivelTermico}); o Vista-me recebe o mesmo ID como critério.
 */
@RestController
public class LookReferenceController {
    private final NivelTermicoRepository niveis;

    public LookReferenceController(NivelTermicoRepository niveis) {
        this.niveis = niveis;
    }

    @GetMapping("/api/opcoes/niveis-termicos")
    @Transactional(readOnly = true)
    @Operation(summary = "Níveis térmicos do look ativos na tabela niveis_termicos (id, código e nome)")
    public List<Views.ReferenceOptionView> niveisTermicos() {
        return niveis.findAllByAtivoTrueOrderByNomeAsc().stream().map(PieceReferenceViews::nivelTermico).toList();
    }
}
