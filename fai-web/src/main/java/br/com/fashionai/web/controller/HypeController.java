package br.com.fashionai.web.controller;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.HypeSnapshotService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * HypeScore v2 — leitura do Hype de peças e looks (docs/hype/HYPESCORE_ARCHITECTURE.md §7). As rotas /api/hype/** são
 * públicas para GET (visitante vê o Hype do que é público); cada serviço aplica a visibilidade de quem pede. O painel
 * pessoal fica em /api/me/hype/** (autenticado), seguindo a convenção /api/me do resto da API.
 */
@RestController
@Tag(name = "HypeScore v2 — relevância de peças e looks ao longo do tempo")
public class HypeController {
    private final HypeQueryService hype;
    private final HypeSnapshotService snapshots;
    private final Guard guard;

    public HypeController(HypeQueryService hype, HypeSnapshotService snapshots, Guard guard) {
        this.hype = hype;
        this.snapshots = snapshots;
        this.guard = guard;
    }

    static HypeEntityType type(String raw) {
        String t = raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
        return switch (t) {
            case "PIECE", "PIECES", "PECA", "PECAS" -> HypeEntityType.PIECE;
            case "SCHEME", "SCHEMES", "LOOK", "LOOKS" -> HypeEntityType.SCHEME;
            default -> throw ApiException.badRequest("TIPO_INVALIDO", "type: PIECE | LOOK");
        };
    }

    static List<UUID> ids(String csv) {
        List<UUID> out = new ArrayList<>();
        if (csv == null) {
            return out;
        }
        for (String part : csv.split(",")) {
            try {
                out.add(UUID.fromString(part.trim()));
            } catch (IllegalArgumentException ignored) {
                // id malformado: ignorado (o lote continua)
            }
            if (out.size() >= HypeQueryService.MAX_BATCH) {
                break;
            }
        }
        return out;
    }

    @GetMapping("/api/hype/summaries")
    @Operation(summary = "Hype de vários cards de uma vez (frente e verso) — uma requisição por grade")
    public Map<String, Object> summaries(CurrentUser viewer, @RequestParam String type, @RequestParam String ids) {
        return hype.summaries(viewer, type(type), ids(ids));
    }

    @GetMapping("/api/hype/pieces/{id}")
    @Operation(summary = "Análise completa do Hype de uma peça (dimensões, motivos, compatibilidade com o seu estilo à parte)")
    public Map<String, Object> piece(CurrentUser viewer, @PathVariable UUID id) {
        return hype.detail(viewer, HypeEntityType.PIECE, id);
    }

    @GetMapping("/api/hype/looks/{id}")
    @Operation(summary = "Análise completa do Hype de um look")
    public Map<String, Object> look(CurrentUser viewer, @PathVariable UUID id) {
        return hype.detail(viewer, HypeEntityType.SCHEME, id);
    }

    @GetMapping("/api/hype/pieces/{id}/history")
    @Operation(summary = "Série histórica (snapshots diários) do Hype de uma peça")
    public Map<String, Object> pieceHistory(CurrentUser viewer, @PathVariable UUID id, @RequestParam(defaultValue = "90") int days) {
        return hype.history(viewer, HypeEntityType.PIECE, id, days);
    }

    @GetMapping("/api/hype/looks/{id}/history")
    @Operation(summary = "Série histórica (snapshots diários) do Hype de um look")
    public Map<String, Object> lookHistory(CurrentUser viewer, @PathVariable UUID id, @RequestParam(defaultValue = "90") int days) {
        return hype.history(viewer, HypeEntityType.SCHEME, id, days);
    }

    @GetMapping("/api/hype/trending")
    @Operation(summary = "Em alta — ranking com recortes (janela 1/7/30 dias, tipo, categoria, estilo, ocasião); só conteúdo público")
    public Map<String, Object> trending(CurrentUser viewer, @RequestParam(defaultValue = "PIECE") String type,
                                        @RequestParam(defaultValue = "7") int window,
                                        @RequestParam(required = false) String category,
                                        @RequestParam(required = false) String style,
                                        @RequestParam(required = false) String occasion,
                                        @RequestParam(defaultValue = "24") int limit) {
        return hype.trending(viewer, type(type), window, category, style, occasion, limit);
    }

    @GetMapping("/api/me/hype/wardrobe")
    @Operation(summary = "Seu guarda-roupa: Hype médio, destaques (maior Hype, crescimento, clássica, rara, esquecida) e redescobertas")
    public Map<String, Object> wardrobe(CurrentUser user) {
        return hype.wardrobe(user);
    }

    @GetMapping("/api/me/hype/movers")
    @Operation(summary = "Histórico → Hype: evolução, itens que subiram/caíram, novas tendências, redescobertas e looks emergentes")
    public Map<String, Object> movers(CurrentUser user, @RequestParam(defaultValue = "90") int days) {
        return hype.movers(user, days);
    }

    @PostMapping("/api/admin/hype/snapshots")
    @Operation(summary = "Recalcular agora os snapshots do HypeScore v2 (o job roda sozinho a cada 6 h)")
    public Map<String, Object> recalculate(CurrentUser user) {
        guard.requireAdmin(user);
        return snapshots.recalculate();
    }
}
