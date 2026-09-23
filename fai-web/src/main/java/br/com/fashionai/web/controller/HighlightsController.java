package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.AchievementService;
import br.com.fashionai.application.service.FaiPointsService;
import br.com.fashionai.application.service.InventoryScoreService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@Tag(name = "RF34/RF35 — Destaques, Inventory Score, FAI Points e conquistas")
public class HighlightsController {
    private final InventoryScoreService inventory;
    private final FaiPointsService points;
    private final AchievementService achievements;

    public HighlightsController(InventoryScoreService inventory, FaiPointsService points, AchievementService achievements) {
        this.inventory = inventory;
        this.points = points;
        this.achievements = achievements;
    }

    @GetMapping("/api/me/highlights")
    @Operation(summary = "RF34.CA01 — Aba Destaques: Inventory Score, dimensões, dicas e álbum")
    public Map<String, Object> highlights(CurrentUser user) {
        return inventory.highlightsTab(user);
    }

    @GetMapping("/api/me/inventory-score/dimensions/{code}")
    @Operation(summary = "RF34.CA03 — Explicar uma dimensão (o que puxa a nota para baixo)")
    public InventoryScoreService.Dimension explain(CurrentUser user, @PathVariable String code) {
        return inventory.explain(user, code);
    }

    @GetMapping("/api/me/inventory-score/hints")
    @Operation(summary = "RF34.CA04 — Dicas para melhorar o inventário")
    public Map<String, Object> hints(CurrentUser user) {
        return inventory.improvementHints(user.id());
    }

    @GetMapping("/api/inventory-score/method")
    @Operation(summary = "RF34 — Como o Inventory Score é calculado")
    public Map<String, Object> method() {
        return inventory.describe();
    }

    @GetMapping("/api/me/album")
    @Operation(summary = "RF34.CA06 — Álbum de snapshots")
    public Map<String, Object> album(CurrentUser user) {
        return inventory.album(user);
    }

    @GetMapping("/api/me/retrospective/{year}")
    @Operation(summary = "RF34.CA07 — Retrospectiva anual")
    public Map<String, Object> retrospective(CurrentUser user, @PathVariable int year) {
        return inventory.retrospective(user, year);
    }

    public record OptInRequest(boolean optedIn, boolean shareCity, String city) {
    }

    @PutMapping("/api/me/rankings/opt-in")
    @Operation(summary = "RF34.CA08 — Entrar/sair dos rankings (k-anonimato 50)")
    public Map<String, Object> optIn(CurrentUser user, @RequestBody OptInRequest body) {
        return inventory.optIn(user, body.optedIn(), body.shareCity(), body.city());
    }

    @GetMapping("/api/me/rankings")
    @Operation(summary = "RF34.CA08 — Minha posição nos rankings")
    public Map<String, Object> rankings(CurrentUser user) {
        return inventory.rankings(user);
    }

    @GetMapping("/api/me/points")
    @Operation(summary = "RF35.CA01 — Saldo, nível e extrato de FAI Points")
    public Map<String, Object> account(CurrentUser user) {
        return points.account(user);
    }

    @GetMapping("/api/points/shop")
    @Operation(summary = "RF35.CA03 — Loja de acabamentos e decorações")
    public List<Map<String, Object>> shop(CurrentUser user) {
        return points.shop(user);
    }

    public record ModuleRequest(String moduleId) {
    }

    @PostMapping("/api/points/shop/{sku}/try-on")
    @Operation(summary = "RF35.CA03 — Experimentar item no módulo antes de comprar")
    public Map<String, Object> tryOn(CurrentUser user, @PathVariable String sku, @RequestBody(required = false) ModuleRequest body) {
        return points.tryOn(user, sku, body == null ? null : body.moduleId());
    }

    @PostMapping("/api/points/shop/{sku}/purchase")
    @Operation(summary = "RF35.CA04 — Comprar com FAI Points")
    public Map<String, Object> buy(CurrentUser user, @PathVariable String sku) {
        return points.buy(user, sku);
    }

    @PostMapping("/api/me/room-inventory/{inventoryId}/apply")
    @Operation(summary = "RF35.CA05 — Aplicar item comprado a um módulo do quarto")
    public Map<String, Object> apply(CurrentUser user, @PathVariable UUID inventoryId, @RequestBody ModuleRequest body) {
        return points.apply(user, inventoryId, body.moduleId());
    }

    @GetMapping("/api/me/achievements")
    @Operation(summary = "RF35 — Conquistas (inclusive secretas já desbloqueadas)")
    public List<Map<String, Object>> achievements(CurrentUser user) {
        return achievements.list(user);
    }
}
