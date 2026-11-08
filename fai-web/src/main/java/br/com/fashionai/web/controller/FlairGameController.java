package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.FlairChallengeService;
import br.com.fashionai.application.service.FlairGameService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** FLAIR 3D — os 100 jogos FLAIR (linhas de flair_challenges com série), com bloqueio por nível no servidor. */
@RestController
@Tag(name = "FLAIR 3D — jogos FLAIR")
public class FlairGameController {
    private final FlairGameService service;

    public FlairGameController(FlairGameService service) {
        this.service = service;
    }

    @GetMapping("/api/flair/games/summary")
    @Operation(summary = "Hub: total de jogos, quantos a pessoa já pode jogar e a contagem por nível exigido")
    public Map<String, Object> summary(CurrentUser viewer) {
        return service.summary(viewer);
    }

    @GetMapping("/api/flair/games")
    @Operation(summary = "Catálogo: jogos por número com acesso informado (nível FAI e faixa do guarda-roupa), filtros opcionais")
    public Map<String, Object> list(CurrentUser viewer,
                                    @RequestParam(required = false) String level,
                                    @RequestParam(required = false) String wardrobe,
                                    @RequestParam(required = false) String difficulty,
                                    @RequestParam(required = false) String rarity,
                                    @RequestParam(required = false) String series,
                                    @RequestParam(required = false) String district,
                                    @RequestParam(required = false) String q) {
        return service.list(viewer, new FlairGameService.Filters(level, wardrobe, difficulty, rarity, series, district, q));
    }

    @GetMapping("/api/flair/games/{slug}")
    @Operation(summary = "Detalhe do jogo: ficha, cena, vagas com efeitos, regras de Hype, acesso e recompensas (nunca bloqueia a leitura)")
    public Map<String, Object> detail(CurrentUser viewer, @PathVariable String slug) {
        return service.detail(viewer, slug);
    }

    @PostMapping("/api/flair/games/{slug}/check")
    @Operation(summary = "Confere a montagem (403 abaixo do nível exigido) e devolve o resultado do CBC com o bloco flair3d")
    public Map<String, Object> check(CurrentUser user, @PathVariable String slug, @RequestBody FlairChallengeService.BuildRequest body) {
        return service.check(user, slug, body);
    }

    @PostMapping("/api/flair/games/{slug}/submit")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Entrega atômica (403 abaixo do nível exigido): CBC + flair3d + bônus de perfeição + recompensas extras")
    public Map<String, Object> submit(CurrentUser user, @PathVariable String slug, @RequestBody FlairChallengeService.BuildRequest body) {
        return service.submit(user, slug, body);
    }
}
