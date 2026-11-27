package br.com.fashionai.web.controller;

import br.com.fashionai.application.flair3d.cbc.FlairCbcSquadService;
import br.com.fashionai.application.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** FLAIR Card Building Challenge — os cinco elencos: lista, formação, conferir e entrega numerada (todas pedem sessão). */
@RestController
@Tag(name = "FLAIR CBC — elencos")
public class FlairCbcSquadController {
    private final FlairCbcSquadService service;

    public FlairCbcSquadController(FlairCbcSquadService service) {
        this.service = service;
    }

    @GetMapping("/api/flair/elencos")
    @Operation(summary = "Os cinco elencos com número de vagas e linhas, se a pessoa concluiu e a edição dela")
    public Map<String, Object> lista(CurrentUser user) {
        return service.lista(user);
    }

    @GetMapping("/api/flair/elencos/{codigo}")
    @Operation(summary = "Formação: vagas com posição e coordenada, linhas e requisitos")
    public Map<String, Object> formacao(@PathVariable String codigo) {
        return service.formacao(codigo);
    }

    @PostMapping("/api/flair/elencos/{codigo}/conferir")
    @Operation(summary = "Confere o elenco: links, química por carta e do elenco, requisitos (422 com carta alheia)")
    public Map<String, Object> conferir(CurrentUser user, @PathVariable String codigo, @RequestBody FlairCbcSquadService.Pedido body) {
        return service.conferir(user, codigo, body);
    }

    @PostMapping("/api/flair/elencos/{codigo}/entrega")
    @Operation(summary = "Entrega o elenco (422 se algum requisito falha) e devolve o resultado com a edição")
    public Map<String, Object> entregar(CurrentUser user, @PathVariable String codigo, @RequestBody FlairCbcSquadService.Pedido body) {
        return service.entregar(user, codigo, body);
    }
}
