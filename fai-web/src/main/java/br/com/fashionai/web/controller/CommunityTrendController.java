package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.CommunityTrendService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/challenges/trends")
public class CommunityTrendController {
    private final CommunityTrendService trends;
    public CommunityTrendController(CommunityTrendService trends) { this.trends = trends; }
    @GetMapping @Operation(summary = "RF32 — Trends da comunidade")
    public Map<String,Object> list(CurrentUser user, @RequestParam(required = false) String kind, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "12") int size) { return trends.list(kind, page, size); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) @Operation(summary = "RF32 — Criar trend")
    public Map<String,Object> create(CurrentUser user, @RequestBody CommunityTrendService.Create request) { return trends.create(user, request); }
    @PostMapping("/{id}/publish") @Operation(summary = "RF32 — Publicar trend e conceder FAI Points uma vez")
    public Map<String,Object> publish(CurrentUser user, @PathVariable UUID id) { return trends.publish(user, id); }
}
