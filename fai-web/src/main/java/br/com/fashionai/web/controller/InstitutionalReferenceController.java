package br.com.fashionai.web.controller;

import br.com.fashionai.application.service.BrandCategoryWriter;
import br.com.fashionai.application.service.CelebrityAreaWriter;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.repository.AreaArtisticaRepository;
import br.com.fashionai.domain.repository.CategoriaMarcaRepository;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Opções de referência dos perfis institucionais (docs/banco-de-dados/solucoes/09-categoria-marca.md e
 * 10-area-artistica.md), só leitura e iguais para todos: sob {@code /api/opcoes/**}, públicas por convenção
 * (SecurityConfig, OpcoesConvencaoTest). O perfil grava o ID escolhido no PATCH /api/me/brand-profile
 * ({@code categoriaMarcaId}, {@code clearCategoriaMarca}) e no PATCH /api/me/celebrity-profile
 * ({@code areaArtisticaId}, {@code clearAreaArtistica}), sempre no perfil da própria sessão.
 */
@RestController
public class InstitutionalReferenceController {
    private final CategoriaMarcaRepository categorias;
    private final AreaArtisticaRepository areas;

    public InstitutionalReferenceController(CategoriaMarcaRepository categorias, AreaArtisticaRepository areas) {
        this.categorias = categorias;
        this.areas = areas;
    }

    @GetMapping("/api/opcoes/categorias-marca")
    @Transactional(readOnly = true)
    @Operation(summary = "Categorias de marca ativas na tabela categorias_marca (id, código e nome)")
    public List<Views.ReferenceOptionView> categoriasMarca() {
        return categorias.findAllByAtivoTrueOrderByNomeAsc().stream().map(BrandCategoryWriter::view).toList();
    }

    @GetMapping("/api/opcoes/areas-artisticas")
    @Transactional(readOnly = true)
    @Operation(summary = "Áreas artísticas ativas na tabela areas_artisticas (id, código e nome)")
    public List<Views.ReferenceOptionView> areasArtisticas() {
        return areas.findAllByAtivoTrueOrderByNomeAsc().stream().map(CelebrityAreaWriter::view).toList();
    }
}
