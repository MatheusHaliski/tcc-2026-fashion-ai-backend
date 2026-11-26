package br.com.fashionai.web.controller;

import br.com.fashionai.application.service.CouponChannelResolver;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.repository.CanalCupomRepository;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Exercício 14 — opções de canal de utilização do cupom, só leitura e iguais para todos: sob {@code /api/opcoes/**},
 * públicas por convenção. A oferta grava o ID escolhido em {@code canalCupomId} (POST/PUT de promoção e de combinação FLAIR).
 */
@RestController
public class CouponReferenceController {
    private final CanalCupomRepository canais;

    public CouponReferenceController(CanalCupomRepository canais) {
        this.canais = canais;
    }

    @GetMapping("/api/opcoes/canais-cupom")
    @Transactional(readOnly = true)
    @Operation(summary = "Canais de utilização do cupom ativos na tabela canais_cupom (id, código e nome)")
    public List<Views.ReferenceOptionView> canaisCupom() {
        return canais.findAllByAtivoTrueOrderByNomeAsc().stream().map(CouponChannelResolver::view).toList();
    }
}
