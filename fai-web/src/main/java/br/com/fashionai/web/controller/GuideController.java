package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.GuideService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Orientação "Como funciona": preferências por tutorial (docs/ux/ORIENTACAO.md). */
@RestController
@Tag(name = "UX — orientação por tutorial")
public class GuideController {
    private final GuideService guides;

    public GuideController(GuideService guides) {
        this.guides = guides;
    }

    @GetMapping("/api/me/guides")
    @Operation(summary = "Estado de cada tutorial da pessoa (versão vista, escondido, aberturas automáticas)")
    public Map<String, Object> mine(CurrentUser user) {
        return guides.mine(user);
    }

    @PutMapping("/api/me/guides/{key}")
    @Operation(summary = "Registra abertura, fechamento ou \"Não mostrar novamente\" de um tutorial")
    public Map<String, Object> record(CurrentUser user, @PathVariable String key, @RequestBody GuideService.GuideEvent body) {
        return guides.record(user, key, body);
    }
}
