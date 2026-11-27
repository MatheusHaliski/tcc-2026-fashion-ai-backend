package br.com.fashionai.web.controller;

import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.makeup.FlairMakeUpService;
import br.com.fashionai.application.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** FLAIR 3D MAKE UP — carreira de beleza, briefs e entrega com Prestígio (todas as rotas pedem sessão). */
@RestController
@Tag(name = "FLAIR 3D — MAKE UP")
public class FlairMakeUpController {
    private final FlairMakeUpService service;

    public FlairMakeUpController(FlairMakeUpService service) {
        this.service = service;
    }

    @GetMapping("/api/flair/make-up/carreira")
    @Operation(summary = "Carreira: nível, Prestígio, quanto falta para o próximo nível e desbloqueios")
    public Map<String, Object> carreira(CurrentUser user) {
        return service.carreira(user);
    }

    @GetMapping("/api/flair/make-up/briefs")
    @Operation(summary = "Briefs com nível mínimo, se estão liberados e as melhores estrelas da pessoa")
    public Map<String, Object> briefs(CurrentUser user) {
        return service.briefs(user);
    }

    @GetMapping("/api/flair/make-up/briefs/{codigo}")
    @Operation(summary = "Detalhe do brief: regras, vagas, áreas e paleta")
    public Map<String, Object> detalhe(@PathVariable String codigo) {
        return service.detalhe(codigo);
    }

    @PostMapping("/api/flair/make-up/briefs/{codigo}/entrega")
    @Operation(summary = "Entrega o look (403 abaixo do nível; 422 com carta alheia): pontos, estrelas, Prestígio ganho e carreira")
    public Map<String, Object> entregar(CurrentUser user, @PathVariable String codigo, @RequestBody(required = false) Entrega body) {
        return service.entregar(user, codigo, body);
    }
}
