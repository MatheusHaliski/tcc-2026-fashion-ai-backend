package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.BrandLogoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@Tag(name = "Logos de marca (busca na internet pela IA)")
public class BrandLogoController {
    private final BrandLogoService logos;
    private final Guard guard;

    public BrandLogoController(BrandLogoService logos, Guard guard) {
        this.logos = logos;
        this.guard = guard;
    }

    @GetMapping("/api/brand-logos")
    @Operation(summary = "Logo de uma marca pelo nome — procura na internet (Wikidata → IA com busca na web → ícone do site) na primeira vez")
    public Map<String, Object> logo(@RequestParam String name) {
        return logos.logo(name, false);
    }

    @GetMapping("/api/brand-logos/batch")
    @Operation(summary = "Logos de várias marcas (até 40); até 4 buscas novas por chamada, o resto entra no job de busca")
    public Map<String, Map<String, Object>> batch(@RequestParam List<String> names) {
        return logos.batch(names, 4);
    }

    @GetMapping("/api/admin/brand-logos")
    @Operation(summary = "Admin — logos encontrados, fonte, confiança e monogramas aguardando nova busca")
    public List<Map<String, Object>> all(CurrentUser user) {
        guard.requireAdmin(user);
        return logos.all();
    }

    @PostMapping("/api/admin/brand-logos/refresh")
    @Operation(summary = "Admin — força nova busca do logo de uma marca")
    public Map<String, Object> refresh(CurrentUser user, @RequestParam String name) {
        guard.requireAdmin(user);
        return logos.logo(name, true);
    }

    @PostMapping(value = "/api/admin/brand-logos/upload", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Admin — envia o logo correto de uma marca (fonte MANUAL)")
    public Map<String, Object> upload(CurrentUser user, @RequestParam String name, @RequestPart("file") org.springframework.web.multipart.MultipartFile file) {
        guard.requireAdmin(user);
        return logos.manual(name, br.com.fashionai.web.support.Uploads.image(file));
    }

    @PostMapping("/api/admin/brand-logos/refresh-pending")
    @Operation(summary = "Admin — roda agora o job de busca dos logos pendentes")
    public Map<String, Object> refreshPending(CurrentUser user) {
        guard.requireAdmin(user);
        return Map.of("processed", logos.refreshPending());
    }
}
