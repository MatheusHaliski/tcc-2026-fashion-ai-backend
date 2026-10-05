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
    @Operation(summary = "Em alta — ranking com recortes (janela 1/7/30 dias; tipo PIECE, LOOK, BRAND ou CREATOR; categoria, estilo, ocasião); só conteúdo público")
    public Map<String, Object> trending(CurrentUser viewer, @RequestParam(defaultValue = "PIECE") String type,
                                        @RequestParam(defaultValue = "7") int window,
                                        @RequestParam(required = false) String category,
                                        @RequestParam(required = false) String style,
                                        @RequestParam(required = false) String occasion,
                                        @RequestParam(defaultValue = "24") int limit) {
        HypeQueryService.RankGroup group = HypeQueryService.RankGroup.parse(type);
        if (group != null) {
            // Marcas em alta / Criadores em alta: agregados de itens públicos elegíveis (mínimo de itens por grupo)
            return hype.trendingGroups(viewer, group, window, category, style, occasion, limit);
        }
        return hype.trending(viewer, type(type), window, category, style, occasion, limit);
    }

    /**
     * Lote A1 (P2-02, P2-03, P2-10): Hype agregado de várias marcas (chave = nome normalizado) ou pessoas (chave = id)
     * numa requisição — chips da busca, do perfil e de /brands. Só itens públicos elegíveis; {@code sufficient} = ≥ 3.
     * Substitui o antigo GET /api/hype/groups (agrupamentos por similaridade, v1), que foi para /api/similarity-groups/global.
     */
    @GetMapping("/api/hype/groups")
    @Operation(summary = "Hype agregado em lote de marcas (BRAND, chave = nome) ou criadores (CREATOR, chave = id): faixa, valor, itens públicos, suficiente (≥ 3) e posição; só conteúdo público")
    public Map<String, Object> groups(CurrentUser viewer, @RequestParam String type, @RequestParam(required = false) String keys,
                                      @RequestParam(defaultValue = "7") int window) {
        HypeQueryService.RankGroup group = HypeQueryService.RankGroup.parse(type);
        if (group == null) {
            throw ApiException.badRequest("TIPO_INVALIDO", "type: BRAND | CREATOR");
        }
        return hype.groups(viewer, group, keys == null ? List.of() : List.of(keys.split(",")), window);
    }

    @GetMapping("/api/hype/ranking")
    @Operation(summary = "Ranking de HypeScore por região do mundo, país, categoria e subcategoria (peças ou looks; o look entra pelas peças dele); só conteúdo público")
    public Map<String, Object> ranking(CurrentUser viewer, @RequestParam(defaultValue = "PIECE") String type,
                                       @RequestParam(defaultValue = "7") int window,
                                       @RequestParam(required = false) String region,
                                       @RequestParam(required = false) String country,
                                       @RequestParam(required = false) String category,
                                       @RequestParam(required = false) String subcategory,
                                       @RequestParam(defaultValue = "0") int page,
                                       @RequestParam(defaultValue = "24") int size) {
        return hype.ranking(viewer, type(type), window, region, country, category, subcategory, page, size);
    }

    @GetMapping("/api/hype/ranking/facets")
    @Operation(summary = "Contagens dos filtros do ranking (regiões com o Hype médio, países, categorias, subcategorias); só conteúdo público")
    public Map<String, Object> rankingFacets(@RequestParam(defaultValue = "PIECE") String type,
                                             @RequestParam(defaultValue = "7") int window,
                                             @RequestParam(required = false) String region,
                                             @RequestParam(required = false) String category) {
        return hype.rankingFacets(type(type), window, region, category);
    }

    @GetMapping("/api/hype/globe")
    @Operation(summary = "Globo do Painel global: Hype por país (médio, máximo, crescimento, faixas, criadores e o item de destaque) no recorte de tipo, janela, categoria e nível mínimo; só conteúdo público")
    public Map<String, Object> globe(CurrentUser viewer, @RequestParam(defaultValue = "PIECE") String type,
                                     @RequestParam(defaultValue = "7") int window,
                                     @RequestParam(required = false) String category,
                                     @RequestParam(required = false) String subcategory,
                                     @RequestParam(required = false) String minLevel) {
        return hype.globe(viewer, type(type), window, category, subcategory, minLevel);
    }

    @GetMapping("/api/hype/pieces/{id}/positions")
    @Operation(summary = "Posições da peça no ranking público: mundo, categoria, subcategoria, região e país")
    public Map<String, Object> piecePositions(CurrentUser viewer, @PathVariable UUID id) {
        return hype.positions(viewer, HypeEntityType.PIECE, id);
    }

    @GetMapping("/api/hype/looks/{id}/positions")
    @Operation(summary = "Posições do look no ranking público: mundo, região e país")
    public Map<String, Object> lookPositions(CurrentUser viewer, @PathVariable UUID id) {
        return hype.positions(viewer, HypeEntityType.SCHEME, id);
    }

    @GetMapping("/api/me/hype/wardrobe")
    @Operation(summary = "Seu guarda-roupa: Hype médio, destaques (maior Hype, crescimento, clássica, rara, esquecida) e redescobertas")
    public Map<String, Object> wardrobe(CurrentUser user) {
        return hype.wardrobe(user);
    }

    @GetMapping("/api/hype/me/wardrobe")
    @Operation(summary = "Alias de /api/me/hype/wardrobe (forma citada na especificação do HypeScore)")
    public Map<String, Object> wardrobeAlias(CurrentUser user) {
        if (user == null) {
            // /api/hype/** é GET público na SecurityConfig: o painel pessoal exige login aqui
            throw ApiException.unauthorized("login");
        }
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
