package br.com.fashionai.web.controller;

import java.util.Map;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import br.com.fashionai.application.aura.AuraUnlocksService;
import br.com.fashionai.application.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Circuito Aura — "O que este card destrava". Fica sob /api/hype/** (GET público na SecurityConfig, como as demais
 * leituras de Hype): visitante vê o que é público; item privado só responde ao dono.
 */
@RestController
@Tag(name = "Circuito Aura — o que o card destrava")
public class AuraUnlocksController {
    private final AuraUnlocksService unlocks;

    public AuraUnlocksController(AuraUnlocksService unlocks) {
        this.unlocks = unlocks;
    }

    @GetMapping("/api/hype/{type}/{id}/unlocks")
    @Operation(summary = "O que o Hype deste card destrava (cupons, campanhas de selo, faixa no FLAIR, pontos de marco, recompensas de Aura) e o que vem na próxima faixa; só leitura")
    public Map<String, Object> unlocks(CurrentUser viewer, @PathVariable String type, @PathVariable UUID id) {
        return unlocks.unlocks(viewer, HypeController.type(type), id);
    }
}
